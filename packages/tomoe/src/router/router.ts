/**
 * Router - Core routing engine with middleware and relic scope support
 */

import { Context, type Env } from "../context"
import type { ParamsObject } from "../types/inference"
import type { RelicGroup } from "../relic/unite"
import type { AnyRelic } from "../relic/relic"
import { executeRelics, validateRelicChain } from "../relic/executor"
import { HttpError } from "../relic/error"
import { RadixTree } from "./radix"

//Handler & Middleware types

export type Handler<
  E extends Env = Env,
  P extends Record<string, string> = Record<string, never>,
  R extends Record<string, any> = {},
> = (c: Context<E, P, R>) => Response | Promise<Response>

export type Middleware<E extends Env = any> = (
  c: Context<E>,
  next: () => Promise<Response>,
) => Promise<Response>

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

// Middleware identity (for chain caching)

type AnyMiddleware = Middleware<any>

const mwIdMap = new WeakMap<AnyMiddleware, string>()
let mwCounter = 0

const getMwId = (fn: Middleware): string => {
  let id = mwIdMap.get(fn)
  if (!id) {
    id = `mw_${mwCounter++}`
    mwIdMap.set(fn, id)
  }
  return id
}

// ScopedRouter

/**
 * A router scoped to a path prefix and relic group.
 * Returned to the builder callback in app.scope().
 *
 * All routes registered here automatically run the scope's relics
 * before the handler executes.
 */
export class ScopedRouter<R extends Record<string, any> = {}> {
  #prefix: string
  #relics: AnyRelic[]
  #parent: Router<any>
  #errorHandlers: Map<number, (ctx: Context<any, any, R>) => Response | Promise<Response>>

  constructor(prefix: string, relics: AnyRelic[], parent: Router<any>) {
    this.#prefix = prefix
    this.#relics = relics
    this.#parent = parent
    this.#errorHandlers = new Map()
  }

  get #normalizedPrefix(): string {
    return this.#prefix.endsWith("/")
      ? this.#prefix.slice(0, -1)
      : this.#prefix
  }

  /**
   * Register GET route inside this scope.
   */
  get<Path extends string>(
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    return this.#register("GET", path, handler)
  }

  post<Path extends string>(
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    return this.#register("POST", path, handler)
  }

  put<Path extends string>(
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    return this.#register("PUT", path, handler)
  }

  delete<Path extends string>(
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    return this.#register("DELETE", path, handler)
  }

  patch<Path extends string>(
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    return this.#register("PATCH", path, handler)
  }

  /**
   * Register a custom error handler for a specific HTTP status.
   * Only needed when you want non-default behavior
   * (e.g. redirect to /login instead of returning 401 JSON).
   *
   * @example
   * r.onError(401, (ctx) => ctx.redirect('/login'))
   */
  onError(
    status: number,
    handler: (ctx: Context<any, any, R>) => Response | Promise<Response>,
  ): this {
    this.#errorHandlers.set(status, handler)
    return this
  }

  #register<Path extends string>(
    method: HTTPMethod,
    path: Path,
    handler: Handler<any, ParamsObject<Path>, R>,
  ): this {
    const fullPath = `${this.#normalizedPrefix}${path === "/" ? "" : path}`
    const relics = this.#relics
    const errorHandlers = this.#errorHandlers

    // Wrap handler with relic execution
    const relicHandler: Handler<any, any, any> = async (ctx) => {
      const relicError = await executeRelics(relics, ctx)

      if (relicError) {
        // Check for custom error handler first
        const customHandler = errorHandlers.get(relicError.status)
        if (customHandler) {
          return customHandler(ctx)
        }
        // Default: automatic response from error definition
        return relicError.toResponse()
      }

      return handler(ctx as Context<any, ParamsObject<Path>, R>)
    }

    this.#parent._registerRoute(method, fullPath, relicHandler as any)
    return this
  }
}

// Router

export class Router<E extends Env = Env> {
  /** The radix tree holds final optimized handler functions */
  #tree: RadixTree

  /** Staging: raw middlewares before compile */
  #middlewares: Array<{ path: string; handler: Middleware }>

  /** Staging: raw routes before compile */
  #routes: Array<{ method: HTTPMethod; path: string; handler: Handler }>

  /** Cache: shared middleware chains by signature */
  #chainCache: Map<string, (c: Context, final: Handler) => any>

  /** Compilation flag */
  #isCompiled = false

  #env: E

  /**
   * Global error handler — override for custom 500 behavior.
   * Default: returns generic 500 (does NOT leak error details).
   */
  #errorHandler: (err: unknown, ctx?: Context) => Response = () =>
    new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    )

  constructor(env: E = {} as E) {
    this.#tree = new RadixTree()
    this.#middlewares = []
    this.#routes = []
    this.#chainCache = new Map()
    this.#env = env
  }

  // HTTP method registration

  get<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#routes.push({ method: "GET", path, handler: handler as any })
    return this
  }

  post<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#routes.push({ method: "POST", path, handler: handler as any })
    return this
  }

  put<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#routes.push({ method: "PUT", path, handler: handler as any })
    return this
  }

  delete<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#routes.push({ method: "DELETE", path, handler: handler as any })
    return this
  }

  patch<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this {
    this.#routes.push({ method: "PATCH", path, handler: handler as any })
    return this
  }

  // Middleware 

  use(handler: Middleware<E>): this
  use(path: string, handler: Middleware<E>): this
  use(arg1: string | Middleware<E>, arg2?: Middleware<E>): this {
    let path = "*"
    let handler: Middleware<E>

    if (typeof arg1 === "string") {
      path = arg1
      if (!arg2) {
        throw new Error("Middleware must be provided when a path is specified.")
      }
      handler = arg2
    } else {
      handler = arg1
    }

    this.#middlewares.push({ path, handler })
    return this
  }

  // Scope 

  /**
   * Create a scoped route group with a relic group.
   *
   * All routes inside the scope:
   *  - Are prefixed with `path`
   *  - Run the relic chain before the handler
   *  - Have access to typed relic context via ctx.relic(Token)
   *
   * @example
   * const userAccess = unite(authRelic)
   *
   * app.scope('/user', userAccess, (r) => {
   *   r.get('/me', (ctx) => ctx.json(ctx.relic(UserCtx)))
   * })
   */
  scope<Relics extends AnyRelic[], Ctx extends Record<string, any>>(
    path: string,
    group: RelicGroup<Relics, Ctx>,
    builder: (r: ScopedRouter<Ctx>) => void,
  ): this {
    // Validate relic chain at scope definition time
    const validationErrors = validateRelicChain(group.relics, path)
    if (validationErrors.length > 0) {
      throw new Error(
        `TomoeJS: Invalid relic configuration:\n${validationErrors.join("\n")}`
      )
    }

    const scopedRouter = new ScopedRouter<Ctx>(path, group.relics, this)
    builder(scopedRouter)
    return this
  }

  // Error handler

  /**
   * Set a global error handler for unhandled exceptions.
   *
   * Default: returns { error: "Internal Server Error" } with 500.
   * In development, you can expose details:
   *
   * @example
   * app.onError((err, ctx) => {
   *   console.error(err)
   *   return ctx?.json({ error: String(err) }, { status: 500 })
   *     ?? new Response("Error", { status: 500 })
   * })
   */
  onError(handler: (err: unknown, ctx?: Context) => Response): this {
    this.#errorHandler = handler
    return this
  }

  // Internal: route registration from ScopedRouter 

  _registerRoute(method: HTTPMethod, path: string, handler: Handler): void {
    this.#routes.push({ method, path, handler })
  }

  // Compile 

  /**
   * Compile staging arrays into the radix tree.
   * Runs once at startup — subsequent calls are no-ops.
   */
  compile(): void {
    if (this.#isCompiled) return

    console.log(`🌸 Tomoe: Compiling ${this.#routes.length} routes...`)

    for (const route of this.#routes) {
      const stack = this.#findStack(route.path)

      if (stack.length === 0) {
        this.#tree.insert(route.method, route.path, route.handler as any)
        continue
      }

      const signature = stack.map(getMwId).join("|")
      let runner = this.#chainCache.get(signature)

      if (!runner) {
        runner = this.#createRunner(stack)
        this.#chainCache.set(signature, runner)
      }

      const optimizedHandler = (c: Context) => runner!(c, route.handler)
      this.#tree.insert(route.method, route.path, optimizedHandler)
    }

    this.#isCompiled = true
  }

  //  Fetch (entry point) 

  /**
   * The fetch handler. Accessing this triggers compilation if needed.
   */
  get fetch() {
    if (!this.#isCompiled) this.compile()
    return this.#dispatch.bind(this)
  }

  async #dispatch(request: Request, env?: any, ctx?: any): Promise<Response> {
    const url = new URL(request.url)
    const match = this.#tree.match(request.method, url.pathname)

    if (!match) {
      return new Response("Not Found", { status: 404 })
    }

    const context = new Context(request, match.params, env || this.#env)

    try {
      return await match.handler(context)
    } catch (err) {
      // HttpErrors thrown directly (not via err()) are handled here
      if (err instanceof HttpError) {
        return err.toResponse()
      }
      console.error(err)
      return this.#errorHandler(err, context)
    }
  }

  // Middleware chain helpers

  #findStack(routePath: string): Middleware[] {
    return this.#middlewares
      .filter((m) => {
        if (m.path === "*" || m.path === "/*") return true
        const prefix = m.path.replace(/\*$/, "")
        return (
          routePath === prefix ||
          routePath.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)
        )
      })
      .map((m) => m.handler)
  }

  #createRunner(stack: Middleware[]) {
    return (ctx: Context, finalHandler: Handler) => {
      let index = -1

      const dispatch = (i: number): any => {
        if (i <= index) throw new Error("next() called multiple times")
        index = i

        if (i === stack.length) {
          return finalHandler(ctx)
        }

        const mw = stack[i]
        if (!mw) throw new Error(`Middleware at index ${i} is undefined`)
        return mw(ctx, () => dispatch(i + 1))
      }

      return dispatch(0)
    }
  }

  // Debug helpers

  getRoutes() {
    return this.#tree.getRoutes()
  }

  getStats() {
    return this.#tree.getStats()
  }
}