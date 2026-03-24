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

import type { Prettify } from "./types/utils"
import type { Token, TokenType } from "./relic/token"

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
  #env: Map<string, any>

  /**
   * Route parameters extracted from path.
   */
  #params: P

  /**
   * Relic store — populated by the executor before the handler runs.
   * Keyed by Token._id (Symbol) for collision-free access.
   */
  #relicStore: Map<symbol, any>

  /**
   * Cached parsed URL — avoids repeated new URL() calls.
   */
  #url: URL | null = null

  /**
   * Execution context (Cloudflare Workers specific).
   */
  #executionCtx?: ExecutionContext

  constructor(
    req: Request,
    params: P = {} as P,
    env: E = {} as E,
    executionCtx?: ExecutionContext,
  ) {
    this.req = req
    this.#params = params
    this.#env = new Map(Object.entries(env))
    this.#relicStore = new Map()

    if (executionCtx) {
      this.#executionCtx = executionCtx
    }
  }


  get #parsedUrl(): URL {
    if (!this.#url) this.#url = new URL(this.req.url)
    return this.#url
  }

  /**
   * Get route parameter by name.
   * Type-safe: parameter names inferred from route path.
   */
  param<K extends keyof P>(key: K): P[K] {
    return this.#params[key]
  }

  /** Get all route parameters */
  get params(): Prettify<P> {
    return this.#params as Prettify<P>
  }

  /**
   * Get query parameter from URL.
   * URL is parsed once and cached.
   */
  query(key: string): string | undefined {
    return this.#parsedUrl.searchParams.get(key) ?? undefined
  }

  /** Get all query parameters as an object */
  get queries(): Record<string, string> {
    const res: Record<string, string> = {}
    for (const [key, value] of this.#parsedUrl.searchParams) {
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
    this.#env.set(key as string, value)
  }

  /**
   * Get a value from the middleware environment.
   * Type-safe: returns correct type based on Env generic.
   */
  get<K extends keyof E>(key: K): E[K] {
    return this.#env.get(key as string)
  }

  /** Get all environment variables */
  get env(): E {
    return Object.fromEntries(this.#env) as E
  }

  // Relic store (internal — used by executor and scope proxy)

  /**
   * Internal: store a relic-provided value by token id.
   * Called by the relic executor — not for user use.
   */
  _setRelic(id: symbol, value: any): void {
    this.#relicStore.set(id, value)
  }

  /**
   * Internal: retrieve a relic-provided value by token id.
   * Called by the relic executor and the typed scope proxy.
   */
  _getRelic(id: symbol): any {
    return this.#relicStore.get(id)
  }

  /**
   * Get a relic value by its typed token.
   * This is the typed, user-facing relic accessor.
   *
   * @example
   * const user = ctx.relic(UserCtx)  // typed as User
   */
  relic<T>(token: Token<T>): T {
    const value = this.#relicStore.get(token._id)

    if (value === undefined) {
      throw new Error(
        `ctx.relic(${token._name}): value not found. ` +
        `Make sure this route is inside a scope with a relic that provides ${token._name}.`
      )
    }

    return value as T
  }


  /**
   * JSON response.
   * Sets Content-Type: application/json automatically.
   */
  json<T = any>(data: T, init?: ResponseInit): Response {
    return new Response(JSON.stringify(data), {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...init?.headers,
      },
    })
  }

  /**
   * Plain text response.
   */
  text(text: string, init?: ResponseInit): Response {
    return new Response(text, {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...init?.headers,
      },
    })
  }

  /**
   * HTML response.
   *
   * Security: does not sanitize HTML.
   * Escape user data before passing to this method.
   */
  html(html: string, init?: ResponseInit): Response {
    return new Response(html, {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...init?.headers,
      },
    })
  }

  /**
   * Redirect response.
   * Default: 302 (temporary). Pass 301 for permanent.
   */
  redirect(url: string, status: 301 | 302 = 302): Response {
    return new Response(null, {
      status,
      headers: { Location: url },
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
    return this.#executionCtx
  }
}

/**
 * Cloudflare Workers ExecutionContext interface.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
}