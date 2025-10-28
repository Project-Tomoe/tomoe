/**
 * Context - Request context for handlers
 *
 * The context object is passed to every handler and middleware.
 * It wraps the native Web Request and provides convenience methods for creating responses.
 *
 * What it does:
 *  1. Store native Request directly (not wrapped).
 *  2. Response helpers return native responses.
 *  3. Generic Env Type for runtime-specific bindings (CF workers, etc)
 *  4. Params type for route paramters (inferred from Path)
 */

import type { Prettify } from "./types/utils";

/**
 * Environment bindings type
 *
 * Extended by middleware to add properties like:
 *  - user (from auth middleware)
 *  - requestId (from loggin middleware)
 *  - db (from database middleware )
 *  - and many more
 */
export type Env = Record<string, any>;

/**
 * Context class
 *
 * Type Paramters:
 *  - E: Environment Object (from middleware)
 *  - P: Route Paramters (from Path)
 */
export class Context<
  E extends Env = {},
  P extends Record<string, string> = {},
> {
  /**
   * Native Web Request object
   * Direct access - no wrapper overhead
   */
  req: Request;

  /**
   * Environment bindings from middleware
   * Stored in WeakMap for memory efficiency.
   */
  #env: Map<string, any>;

  /**
   * Route paramters extracted from path
   */
  #params: P;

  /**
   * Execution context (for async tracking for some runtimes)
   * Used by Cloudflare Workers for waitUnitil()
   */
  #executionCtx?: ExecutionContext;

  constructor(
    req: Request,
    params: P = {} as P,
    env: E = {} as E,
    executionCtx?: ExecutionContext,
  ) {
    this.req = req;
    this.#params = params;
    this.#env = new Map(Object.entries(env));
    if (executionCtx) {
      this.#executionCtx = executionCtx;
    }
  }

  /**
   * Get route parameter by name
   *
   * Type-safe: Paramter names inferred from route path
   *
   * Performance: O(1) object property access
   */

  param<K extends keyof P>(key: K): P[K] {
    return this.#params[key];
  }

  /**
   * Get all route parameters
   *
   * Returns: Object with all extracted paramters
   */
  get params(): Prettify<P> {
    return this.#params as Prettify<P>;
  }

  /**
   * Get query paramter from URL
   *
   * Performance:
   *  First Call: Parses URL and creates URLSearchParams
   *  Cached for subsequent calls
   *
   * TODO: Add type inference for query params from schema
   */

  query(key: string): string | undefined {
    const url = new URL(this.req.url);
    return url.searchParams.get(key) ?? undefined;
  }

  /**
   * Get all query paramters
   *
   * Returns: Object with all query string paramters
   * Multi-value params: Last value wins (URLSearchParams behaviour)
   *
   */
  get queries(): Record<string, string> {
    const url = new URL(this.req.url);
    const res: Record<string, string> = {};

    for (const [key, value] of url.searchParams) {
      res[key] = value;
    }

    return res;
  }

  /**
   * Get request headers (case-insensitive)
   *
   * Example:
   *  c.header("Content-Type") // "application/json"
   *  c.header("content-type") // "application/json"
   */

  header(name: string): string | null {
    return this.req.headers.get(name);
  }

  /**
   * Set Environment variable (from middleware)
   *
   * Used by middleware to add properties to context.
   */

  set<K extends keyof E>(key: K, value: E[K]) {
    this.#env.set(key as string, value);
  }

  /**
   * Get Environment variable
   *
   *
   * Type-safe: Returns correct type based on middleware
   */

  get<K extends keyof E>(key: K): E[K] {
    return this.#env.get(key as string);
  }

  /**
   * Get all Environment variables
   */
  get env(): E {
    return Object.fromEntries(this.#env) as E;
  }

  /**
   * JSON response helper
   *
   * Creates native Response with:
   *  - JSON.stringify(data)
   *  - Content-Type: application/json
   *  - Status code (default 200)
   *
   *  Security note:
   *  - Automatically escape specially characters
   *  - Safe from XSS in JSON context
   */

  json<T = any>(data: T, init?: ResponseInit): Response {
    return new Response(JSON.stringify(data), {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...init?.headers,
      },
    });
  }

  /**
   * Text response helper
   *
   * Creates native Response with plain text
   */

  text(text: string, init?: ResponseInit): Response {
    return new Response(text, {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...init?.headers,
      },
    });
  }

  /**
   * HTML response helper
   *
   * Creates native Response with HTML content
   *
   * Security warnings:
   *  - Does not sanitize html content
   *  - User must escape data to prevent XSS
   *  - Consider using template engine for auo-escaping
   */

  html(html: string, init?: ResponseInit): Response {
    return new Response(html, {
      status: 200,
      ...init,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...init?.headers,
      },
    });
  }

  /**
   * Redirect response helper
   *
   * Creates 302 (temporary) or 301 (permanent) redirect
   */
  redirect(url: string, status: 301 | 302 = 302): Response {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }

  /**
   * Not Found response helper
   *
   * return 404 status with message
   */
  notFound(message = "Not Found"): Response {
    return this.text(message, { status: 404 });
  }

  /**
   * Get execution context (Cloudflare workers specific)
   *
   * Used for ctx.waitUntil() for background tasks
   */
  get executionCtx(): ExecutionContext | undefined {
    return this.#executionCtx;
  }
}

/**
 * Cloudflare Workers ExecutionContext interface
 * (For type safety - only available for CF Workers runtime)
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
