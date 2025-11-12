/**
 * Router - Main routing class for Tomoe
 *
 * Provides user-facing API for route registration and request handling.
 * Wraps RadixTree for efficient route matching.
 *
 * Features:
 *  - Type-safe route params (inferred from path)
 *  - Middleware support with type accumulation
 *  - Chainable API
 *  - Multi-method support (GET, POST, PUT, DELETE, PATCH)
 *  - Native Web Standards
 */

import { Context, type Env } from "../context";
import type { ParamsObject } from "../types/inference";
import { RadixTree } from "./radix";

/**
 * Handler Fn signature
 *
 * @param c - Context with environment E and params P
 * @return Response or Promise<Response>
 *
 * Type paramters:
 *  - E: Environment object (from Middleware)
 *  - P - Route paramters (from path string)
 */
export type Handler<
  E extends Env = {},
  P extends Record<string, string> = {},
> = (c: Context<E, P>) => Response | Promise<Response>;

/**
 * Middleware Fn signature
 *
 * Middleware can:
 *  - Modify request/response
 *  - Add properties to context (via c.set())
 *  - Short-circuit (return response without calling next)
 *  - Continue to next middleware/handler (call next())
 *
 * @param c - Context with current environment
 * @param next - Fn to call next Middleware/handler
 * @returns Response | Promise<Response>
 *
 * Type paramters:
 *  - EnvIn: Input environment (what middleware receives)
 *  - EnvOut: Output environment (what middleware adds)
 */
export type Middleware<EnvIn extends Env = {}, EnvOut extends Env = {}> = (
  c: Context,
  next: () => Promise<Response>,
) => Promise<Response>;

/**
 * HTTP Methods supported by Tomoe
 */

export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTION"
  | "HEAD";

/**
 * Router class
 *
 * Main class for building Tomoe application.
 *
 * Type paramter:
 *  - E: Environment object (accumulated through middleware)
 */

export class Router<E extends Env = {}> {
  /**
   * RadixTree for route storage and matching
   */
  #tree: RadixTree;

  /**
   * Middleware stack (Applied in order before route handler)
   */
  #middleware: Middleware<any, any>[];

  /**
   * Base environment object
   * Set during route creation, passed to all handlers
   */
  #env: E;

  constructor(env: E = {} as E) {
    this.#tree = new RadixTree();
    this.#middleware = [];
    this.#env = env;
  }

  /**
   * Register route (GET, POST, PUT, POST, PATCH, DELETE)
   *
   * @param path - Route path (e.g., "/anime")
   * @param handler - handler function
   * @returns this (for chaining)
   *
   * Type inference:
   *  - Path string literal - ParamsObject<Path>
   *  - Handler receives Context<E, ParamsObject<Path>>
   */

  get<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#tree.insert("GET", path, handler as any);
    return this;
  }

  post<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#tree.insert("POST", path, handler as any);
    return this;
  }

  put<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#tree.insert("PUT", path, handler as any);
    return this;
  }

  patch<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#tree.insert("PATCH", path, handler as any);
    return this;
  }

  delete<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#tree.insert("DELETE", path, handler as any);
    return this;
  }

  /**
   * Register middleware
   *
   * Middleware runs before route handlers in registration order.
   * Can add properties to context via c.set()
   *
   * @param middleware - Middleware function
   * @returns Router with updated environment type
   */

  use<NewEnv extends Env>(
    middleware: Middleware<E, NewEnv>,
  ): Router<E & NewEnv> {
    this.#middleware.push(middleware as any);
    return this as any;
  }

  /**
   * Handle incoming request
   *
   * This is the main entry point for request processing.
   * Called by runtime adapters (Node.js, Bun, Deno, CF Workers, etc.)
   *
   * @param request - Native Web Request
   * @param executionCtx - Execution context (CF)
   * @returns Native Web Response
   */

  async fetch(request: Request, executionCtx?: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    const match = this.#tree.match(method as HTTPMethod, path);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    const { handler, params } = match;

    const context = new Context(request, params, this.#env, executionCtx);

    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= this.#middleware.length) {
        return await handler(context as any);
      }

      const middleware = this.#middleware[index++];

      // @ts-ignore
      return await middleware(context as any, next);
    };

    try {
      return await next();
    } catch (error) {
      console.error("Handle error:", error);

      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : String(error),
        }),

        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  /**
   * Get all registered routes (for debugging)
   *
   * @returns Array of route info
   */
  getRoutes(): Array<{ method: string; path: string }> {
    return this.#tree.getRoutes();
  }

  /**
   * Get router statistics (for profiling)
   *
   * @returns Router stats
   */
  getStats() {
    return this.#tree.getStats();
  }
}
