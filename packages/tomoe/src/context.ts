/**
 * Context - Request context for handlers
 *
 * The context object is passed to every handler and middleware.
 * It wraps the native Web Request and provides convenience methods
 * for creating responses.
 *
 * What it does:
 *  1. Stores native Request directly (no wrapper overhead)
 *  2. Response helpers return native responses
 *  3. Generic Env type for runtime-specific bindings (CF Workers, etc)
 *  4. Params type for route parameters (inferred from Path)
 *  5. Relic store for typed scope context (populated by relic executor)
 */

import { LazyResponse } from "./lazy-response"
import type { ProvidingRelic } from "./relic/relic"
import type { Prettify } from "./types/utils"

export interface TypedResponse<T = any> extends Response {
  readonly __type?: T
}

const useLazyResponse =
  typeof process !== "undefined" &&
  process.versions &&
  process.versions.node &&
  !(process.versions as any).bun

export interface CookieOptions {
  domain?: string
  path?: string
  expires?: Date
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Strict" | "Lax" | "None"
}

const COOKIE_NAME_REGEXP = /^[\x21\x23-\x27\x2A-\x2B\x2D-\x2E\x30-\x39\x41-\x5A\x5E-\x7A\x7C\x7E]+$/

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!COOKIE_NAME_REGEXP.test(name)) {
    throw new Error(
      `Invalid cookie name "${name}". Cookie names can only contain valid US-ASCII characters according to RFC 6265.`
    )
  }
  let str = `${name}=${encodeURIComponent(value)}`
  if (options.domain) str += `; Domain=${options.domain}`
  if (options.path) str += `; Path=${options.path}`
  if (options.expires) str += `; Expires=${options.expires.toUTCString()}`
  if (options.maxAge !== undefined) str += `; Max-Age=${options.maxAge}`
  if (options.httpOnly) str += "; HttpOnly"
  if (options.secure) str += "; Secure"
  if (options.sameSite) str += `; SameSite=${options.sameSite}`
  return str
}

/**
 * Environment bindings type — extended by middleware to add properties.
 */
export type Env = Record<string, any>

/**
 * Context class
 *
 * Type parameters:
 *  - E: Environment object (from middleware)
 *  - P: Route parameters (from Path)
 *  - R: Relic context (from scope's unite() — populated at runtime)
 */
function getRawHeaders(
  initHeaders: any,
  headersToSet: Array<[string, string]>,
  contentType: string,
  contentLength: string
): Record<string, string> {
  const raw: Record<string, string> = {}

  if (initHeaders) {
    if (typeof initHeaders.forEach === "function") {
      initHeaders.forEach((val: string, key: string) => {
        raw[key.toLowerCase()] = val
      })
    } else if (Array.isArray(initHeaders)) {
      for (const [key, val] of initHeaders) {
        raw[key.toLowerCase()] = val
      }
    } else {
      for (const [key, val] of Object.entries(initHeaders)) {
        raw[key.toLowerCase()] = val as string
      }
    }
  }

  for (const [key, val] of headersToSet) {
    raw[key.toLowerCase()] = val
  }

  if (contentType) {
    raw["content-type"] = contentType
  }
  if (contentLength) {
    raw["content-length"] = contentLength
  }

  return raw
}

export class Context<
  E extends Env = Record<never, never>,
  P extends Record<string, string> = Record<never, never>,
  R extends Record<string, any> = Record<never, never>,
> {
  /**
   * Native Web Request object.
   * Direct access — no wrapper overhead.
   */
  req: Request

  /**
   * Environment bindings from middleware.
   */
  private _env: Record<string, any>

  /**
   * Route parameters extracted from path.
   */
  private _params: P

  /**
   * Relic store — populated by the executor before the handler runs.
   * Keyed by Relic._id (Symbol) for collision-free access.
   */
  private _relicStore: Map<symbol, any> | null = null

  /**
   * Relic store by name — populated by executor for named relics.
   */
  private _relicStoreByName: Map<string, any> | null = null

  /**
   * Cached parsed URL — avoids repeated new URL() calls.
   */
  private _url: URL | null = null

  /**
   * Execution context (Cloudflare Workers specific).
   */
  private _executionCtx?: ExecutionContext

  /**
   * List of cookies queued to be set in responses.
   */
  private _cookiesToSet: Array<{
    name: string
    value: string
    options?: CookieOptions | undefined
  }> = []

  /**
   * List of headers queued to be set in responses.
   */
  private _headersToSet: Array<[string, string]> = []

  /**
   * Cache of parsed request cookies.
   */
  private _parsedCookies: Record<string, string> | null = null

  constructor(
    req: Request,
    params: P = {} as P,
    env: E = {} as E,
    executionCtx?: ExecutionContext
  ) {
    this.req = req
    this._params = params
    this._env = env

    if (executionCtx) {
      this._executionCtx = executionCtx
    }
  }

  /** Get a request cookie by name */
  cookie(name: string): string | undefined {
    if (!this._parsedCookies) {
      const cookieHeader = this.req.headers.get("Cookie")
      if (!cookieHeader) {
        this._parsedCookies = {}
      } else {
        this._parsedCookies = cookieHeader.split(";").reduce(
          (acc, pair) => {
            const [k, v] = pair.split("=").map((s) => s.trim())
            if (k && v) {
              try {
                acc[k] = decodeURIComponent(v)
              } catch {
                acc[k] = v
              }
            }
            return acc
          },
          {} as Record<string, string>
        )
      }
    }
    return this._parsedCookies[name]
  }

  /** Queue a cookie to be set on the response */
  setCookie(name: string, value: string, options?: CookieOptions): void {
    this._cookiesToSet.push({ name, value, options })
  }

  get _parsedUrl(): URL {
    if (!this._url) this._url = new URL(this.req.url)
    return this._url
  }

  /**
   * Get route parameter by name.
   * Type-safe: parameter names inferred from route path.
   */
  param<K extends keyof P>(key: K): P[K] {
    return this._params[key]
  }

  /** Get all route parameters */
  get params(): Prettify<P> {
    return this._params as Prettify<P>
  }

  /**
   * Get query parameter from URL.
   * URL is parsed once and cached.
   */
  query(key: string): string | undefined {
    return this._parsedUrl.searchParams.get(key) ?? undefined
  }

  /** Get all query parameters as an object */
  get queries(): Record<string, string> {
    const res: Record<string, string> = {}
    for (const [key, value] of this._parsedUrl.searchParams) {
      res[key] = value
    }
    return res
  }

  /**
   * Get request header (case-insensitive) or set response header.
   */
  header(name: string): string | null
  header(name: string, value: string): void
  header(name: string, value?: string): string | null | undefined {
    if (value === undefined) {
      return this.req.headers.get(name)
    }
    this._headersToSet.push([name, value])
  }

  // Middleware env (set/get)

  /**
   * Set a value in the middleware environment.
   * Used by middleware to attach data to the context.
   */
  set<K extends keyof E>(key: K, value: E[K]) {
    this._env[key as string] = value
  }

  /**
   * Get a value from the middleware environment.
   * Type-safe: returns correct type based on Env generic.
   */
  get<K extends keyof E>(key: K): E[K] {
    return this._env[key as string]
  }

  /** Get all environment variables */
  get env(): E {
    return this._env as E
  }

  // Relic store (internal — used by executor and scope proxy)

  /**
   * Internal: store a relic-provided value by relic symbol id.
   * Called by the relic executor — not for user use.
   */
  _setRelic(id: symbol, value: any): void {
    if (!this._relicStore) this._relicStore = new Map()
    this._relicStore.set(id, value)
  }

  /**
   * Internal: store a relic-provided value by relic name.
   */
  _setRelicByName(name: string, value: any): void {
    if (!this._relicStoreByName) this._relicStoreByName = new Map()
    this._relicStoreByName.set(name, value)
  }

  /**
   * Internal: retrieve a relic-provided value by relic name.
   */
  _getRelicByName(name: string): any {
    return this._relicStoreByName ? this._relicStoreByName.get(name) : undefined
  }

  /**
   * Internal: retrieve a relic-provided value by relic symbol id.
   * Called by the relic executor.
   */
  _getRelic(id: symbol): any {
    return this._relicStore ? this._relicStore.get(id) : undefined
  }

  /**
   * Get a relic value by its typed relic reference.
   * This is the typed, user-facing relic accessor for anonymous relics.
   *
   * @example
   * const user = ctx.relic(auth)  // typed as User
   */
  relic<T>(targetRelic: ProvidingRelic<any, T>): T {
    const value = this._relicStore ? this._relicStore.get(targetRelic._id) : undefined

    if (value === undefined) {
      throw new Error(
        `ctx.relic(${targetRelic.name || "anonymous"}): value not found. Make sure this route is inside a scope with a relic that provides it.`
      )
    }

    return value as T
  }

  _injectHeaders(init?: ResponseInit): Headers {
    const headers = new Headers(init?.headers)
    for (const [name, val] of this._headersToSet) {
      headers.set(name, val)
    }
    for (const cookie of this._cookiesToSet) {
      headers.append("Set-Cookie", serializeCookie(cookie.name, cookie.value, cookie.options))
    }
    return headers
  }

  static encoder = new TextEncoder()

  /**
   * JSON response.
   * Sets Content-Type: application/json automatically.
   */
  json<T = any>(data: T, init?: ResponseInit): TypedResponse<T> {
    const bodyStr = JSON.stringify(data)

    let res: any
    if (useLazyResponse) {
      const lenStr = Context.encoder.encode(bodyStr).length.toString()
      const rawHeaders = getRawHeaders(
        init?.headers,
        this._headersToSet,
        "application/json; charset=utf-8",
        lenStr
      )
      let serializedCookies: string[] | null = null
      if (this._cookiesToSet.length > 0) {
        serializedCookies = this._cookiesToSet.map((cookie) =>
          serializeCookie(cookie.name, cookie.value, cookie.options)
        )
      }
      res = new LazyResponse(bodyStr, init)
      res._bodyStr = bodyStr
      res._rawHeaders = rawHeaders
      res._cookies = serializedCookies
    } else {
      const headers = this._injectHeaders(init)
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json; charset=utf-8")
      }
      if (!headers.has("Content-Length")) {
        headers.set("Content-Length", Context.encoder.encode(bodyStr).length.toString())
      }
      res = new Response(bodyStr, {
        status: 200,
        ...init,
        headers,
      })
      res._bodyStr = bodyStr
    }

    return res as TypedResponse<T>
  }

  /**
   * Plain text response.
   */
  text(text: string, init?: ResponseInit): Response {
    let res: any
    if (useLazyResponse) {
      const lenStr = Context.encoder.encode(text).length.toString()
      const rawHeaders = getRawHeaders(
        init?.headers,
        this._headersToSet,
        "text/plain; charset=utf-8",
        lenStr
      )
      let serializedCookies: string[] | null = null
      if (this._cookiesToSet.length > 0) {
        serializedCookies = this._cookiesToSet.map((cookie) =>
          serializeCookie(cookie.name, cookie.value, cookie.options)
        )
      }
      res = new LazyResponse(text, init)
      res._bodyStr = text
      res._rawHeaders = rawHeaders
      res._cookies = serializedCookies
    } else {
      const headers = this._injectHeaders(init)
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "text/plain; charset=utf-8")
      }
      if (!headers.has("Content-Length")) {
        headers.set("Content-Length", Context.encoder.encode(text).length.toString())
      }
      res = new Response(text, {
        status: 200,
        ...init,
        headers,
      })
      res._bodyStr = text
    }

    return res as Response
  }

  /**
   * HTML response.
   *
   * Security: does not sanitize HTML.
   * Escape user data before passing to this method.
   */
  html(html: string, init?: ResponseInit): Response {
    let res: any
    if (useLazyResponse) {
      const lenStr = Context.encoder.encode(html).length.toString()
      const rawHeaders = getRawHeaders(
        init?.headers,
        this._headersToSet,
        "text/html; charset=utf-8",
        lenStr
      )
      let serializedCookies: string[] | null = null
      if (this._cookiesToSet.length > 0) {
        serializedCookies = this._cookiesToSet.map((cookie) =>
          serializeCookie(cookie.name, cookie.value, cookie.options)
        )
      }
      res = new LazyResponse(html, init)
      res._bodyStr = html
      res._rawHeaders = rawHeaders
      res._cookies = serializedCookies
    } else {
      const headers = this._injectHeaders(init)
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "text/html; charset=utf-8")
      }
      if (!headers.has("Content-Length")) {
        headers.set("Content-Length", Context.encoder.encode(html).length.toString())
      }
      res = new Response(html, {
        status: 200,
        ...init,
        headers,
      })
      res._bodyStr = html
    }

    return res as Response
  }

  /**
   * Redirect response.
   * Default: 302 (temporary). Pass 301 for permanent.
   */
  redirect(url: string, status: 301 | 302 = 302): Response {
    let res: any
    if (useLazyResponse) {
      const rawHeaders = getRawHeaders(
        undefined,
        [...this._headersToSet, ["Location", url]],
        "",
        ""
      )
      let serializedCookies: string[] | null = null
      if (this._cookiesToSet.length > 0) {
        serializedCookies = this._cookiesToSet.map((cookie) =>
          serializeCookie(cookie.name, cookie.value, cookie.options)
        )
      }
      res = new LazyResponse(null, { status })
      res._bodyStr = ""
      res._rawHeaders = rawHeaders
      res._cookies = serializedCookies
    } else {
      const headers = this._injectHeaders()
      headers.set("Location", url)
      res = new Response(null, {
        status,
        headers,
      })
      res._bodyStr = ""
    }

    return res as Response
  }

  /**
   * 404 Not Found response.
   */
  notFound(message = "Not Found"): Response {
    return this.text(message, { status: 404 })
  }

  /**
   * Execution context — Cloudflare Workers specific.
   * Used for ctx.waitUntil() for background tasks.
   */
  get executionCtx(): ExecutionContext | undefined {
    return this._executionCtx
  }
}

/**
 * Cloudflare Workers ExecutionContext interface.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
}

/**
 * Lightweight Context for long-lived socket connections
 */
export interface SocketCtx<Params = Record<string, string>, Relics = Record<string, any>> {
  params: Params
  query: Record<string, string | string[]>
  relics: Relics
  handshake: {
    headers: Record<string, string>
    cookies: Record<string, string>
    ip?: string
  }
}

/**
 * Unified WebSocket Event Handlers mapping to native callbacks
 */
export interface WebSocketHandlers<
  WS = any,
  Params = Record<string, string>,
  Relics = Record<string, any>,
> {
  open?(ws: WS, sCtx: SocketCtx<Params, Relics>): void | Promise<void>
  message?(ws: WS, message: any, sCtx: SocketCtx<Params, Relics>): void | Promise<void>
  close?(ws: WS, sCtx: SocketCtx<Params, Relics>): void | Promise<void>
  drain?(ws: WS, sCtx: SocketCtx<Params, Relics>): void | Promise<void>
  error?(ws: WS, error: any, sCtx: SocketCtx<Params, Relics>): void | Promise<void>
}

/**
 * Special response object returned by Tomoe routers to initiate a native connection upgrade.
 */
export class UpgradeResponse extends Response {
  readonly isUpgrade = true

  constructor(
    public readonly socketHandlers: WebSocketHandlers<any, any, any>,
    public readonly socketCtx: SocketCtx<any, any>,
    init?: ResponseInit
  ) {
    super(null, { status: 200, ...init })
  }
}
