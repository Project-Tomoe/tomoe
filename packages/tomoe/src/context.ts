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

import type { ProvidingRelic } from "./relic/relic"
import type { Prettify } from "./types/utils"

export interface TypedResponse<T = any> extends Response {
  readonly __type?: T
}

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
export class Context<
  E extends Env = {},
  P extends Record<string, string> = {},
  R extends Record<string, any> = {},
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
  private _relicStore: Map<symbol, any>

  /**
   * Relic store by name — populated by executor for named relics.
   */
  private _relicStoreByName: Map<string, any>

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
    this._env = { ...env }
    this._relicStore = new Map()
    this._relicStoreByName = new Map()

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
   * Get request header (case-insensitive).
   */
  header(name: string): string | null {
    return this.req.headers.get(name)
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
    this._relicStore.set(id, value)
  }

  /**
   * Internal: store a relic-provided value by relic name.
   */
  _setRelicByName(name: string, value: any): void {
    this._relicStoreByName.set(name, value)
  }

  /**
   * Internal: retrieve a relic-provided value by relic name.
   */
  _getRelicByName(name: string): any {
    return this._relicStoreByName.get(name)
  }

  /**
   * Internal: retrieve a relic-provided value by relic symbol id.
   * Called by the relic executor.
   */
  _getRelic(id: symbol): any {
    return this._relicStore.get(id)
  }

  /**
   * Get a relic value by its typed relic reference.
   * This is the typed, user-facing relic accessor for anonymous relics.
   *
   * @example
   * const user = ctx.relic(auth)  // typed as User
   */
  relic<T>(targetRelic: ProvidingRelic<any, T>): T {
    const value = this._relicStore.get(targetRelic._id)

    if (value === undefined) {
      throw new Error(
        `ctx.relic(${targetRelic.name || "anonymous"}): value not found. Make sure this route is inside a scope with a relic that provides it.`
      )
    }

    return value as T
  }

  private _injectHeaders(init?: ResponseInit): Headers {
    const headers = new Headers(init?.headers)
    for (const cookie of this._cookiesToSet) {
      headers.append("Set-Cookie", serializeCookie(cookie.name, cookie.value, cookie.options))
    }
    return headers
  }

  /**
   * JSON response.
   * Sets Content-Type: application/json automatically.
   */
  json<T = any>(data: T, init?: ResponseInit): TypedResponse<T> {
    const headers = this._injectHeaders(init)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json; charset=utf-8")
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      ...init,
      headers,
    }) as TypedResponse<T>
  }

  /**
   * Plain text response.
   */
  text(text: string, init?: ResponseInit): Response {
    const headers = this._injectHeaders(init)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "text/plain; charset=utf-8")
    }
    return new Response(text, {
      status: 200,
      ...init,
      headers,
    })
  }

  /**
   * HTML response.
   *
   * Security: does not sanitize HTML.
   * Escape user data before passing to this method.
   */
  html(html: string, init?: ResponseInit): Response {
    const headers = this._injectHeaders(init)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "text/html; charset=utf-8")
    }
    return new Response(html, {
      status: 200,
      ...init,
      headers,
    })
  }

  /**
   * Redirect response.
   * Default: 302 (temporary). Pass 301 for permanent.
   */
  redirect(url: string, status: 301 | 302 = 302): Response {
    const headers = this._injectHeaders()
    headers.set("Location", url)
    return new Response(null, {
      status,
      headers,
    })
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
