/**
 * Router - Core routing engine with middleware and relic scope support
 */

import { Context, type Env } from "../context"
import type { ParamsObject } from "../types/inference"
import type { RelicGroup } from "../relic/unite"
import type { AnyRelic } from "../relic/relic"
import { executeRelics, validateRelicChain } from "../relic/executor"
import { HttpError } from "../relic/error"
import { unite } from "../relic/unite"
import { RadixTree } from "./radix"

// Handler & Middleware types 

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

// Relic input type

/**
 * Anything accepted as a relic argument:
 *   - Single relic       → app.get('/me', authRelic, handler)
 *   - Group from unite() → app.get('/me', unite(authRelic, orgRelic), handler)
 */
type RelicInput<Ctx extends Record<string, any> = any> =
  | AnyRelic
  | RelicGroup<AnyRelic[], Ctx>

/**
 * Normalize a RelicInput into a RelicGroup.
 * Single relic → wrapped in unite() internally — transparent to the user.
 */
function normalizeRelics<Ctx extends Record<string, any>>(
  input: RelicInput<Ctx>
): RelicGroup<AnyRelic[], Ctx> {
  if ("_kind" in input && input._kind === "group") {
    return input as RelicGroup<AnyRelic[], Ctx>
  }
  return unite(input as AnyRelic) as RelicGroup<AnyRelic[], Ctx>
}

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

// Shared relic-wrapped handler builder

/**
 * Wraps a handler with relic execution.
 * Single source of truth — used by both app.get/post/... and ScopedRouter.
 */
function wrapWithRelics<P extends Record<string, string>, R extends Record<string, any>>(
  relics: AnyRelic[],
  handler: Handler<any, P, R>,
  errorHandlers: Map<number, (ctx: Context<any, any, R>) => Response | Promise<Response>>,
): Handler<any, P, R> {
  return async (ctx) => {
    const relicError = await executeRelics(relics, ctx)

    if (relicError) {
      const customHandler = errorHandlers.get(relicError.status)
      if (customHandler) return customHandler(ctx)
      return relicError.toResponse()
    }

    return handler(ctx)
  }
}

// ScopedRouter

/**
 * A router scoped to a path prefix and relic group.
 * Returned to the builder callback in app.scope().
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

  get<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this {
    return this.#register("GET", path, handler)
  }

  post<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this {
    return this.#register("POST", path, handler)
  }

  put<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this {
    return this.#register("PUT", path, handler)
  }

  delete<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this {
    return this.#register("DELETE", path, handler)
  }

  patch<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this {
    return this.#register("PATCH", path, handler)
  }

  /**
   * Register a custom error handler for a specific HTTP status.
   * Only needed when you want non-default behavior.
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
    const wrapped = wrapWithRelics(this.#relics, handler, this.#errorHandlers)
    this.#parent._registerRoute(method, fullPath, wrapped as any)
    return this
  }
}

// Router

export class Router<E extends Env = Env> {
  #tree: RadixTree
  #middlewares: Array<{ path: string; handler: Middleware }>
  #routes: Array<{ method: HTTPMethod; path: string; handler: Handler }>
  #chainCache: Map<string, (c: Context, final: Handler) => any>
  #isCompiled = false
  #env: E

  /** Global error handler — safe 500 by default, no details leaked */
  #errorHandler: (err: unknown, ctx?: Context) => Response = () =>
    new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    )

  constructor(env: E = {} as E) {
    this.#tree = new RadixTree()
    this.#middlewares = []
    this.#routes = []
    this.#chainCache = new Map()
    this.#env = env
  }

  // HTTP methods
  //
  // Each method supports two call signatures:
  //
  //   app.get('/path', handler)
  //   app.get('/path', relicOrGroup, handler)
  //
  // The second form runs relics before the handler.
  // A single relic does NOT need unite() — pass it directly.

  get<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this
  get<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relics: RelicInput<Ctx>,
    handler: Handler<E, ParamsObject<Path>, Ctx>,
  ): this
  get<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    return this.#method("GET", path, relicsOrHandler, handler)
  }

  post<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this
  post<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relics: RelicInput<Ctx>,
    handler: Handler<E, ParamsObject<Path>, Ctx>,
  ): this
  post<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    return this.#method("POST", path, relicsOrHandler, handler)
  }

  put<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this
  put<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relics: RelicInput<Ctx>,
    handler: Handler<E, ParamsObject<Path>, Ctx>,
  ): this
  put<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    return this.#method("PUT", path, relicsOrHandler, handler)
  }

  delete<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this
  delete<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relics: RelicInput<Ctx>,
    handler: Handler<E, ParamsObject<Path>, Ctx>,
  ): this
  delete<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    return this.#method("DELETE", path, relicsOrHandler, handler)
  }

  patch<Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ): this
  patch<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relics: RelicInput<Ctx>,
    handler: Handler<E, ParamsObject<Path>, Ctx>,
  ): this
  patch<Path extends string, Ctx extends Record<string, any>>(
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    return this.#method("PATCH", path, relicsOrHandler, handler)
  }

  /**
   * Shared implementation for all HTTP method registrations.
   * Detects whether relics were passed and wraps handler accordingly.
   */
  #method<Path extends string, Ctx extends Record<string, any>>(
    method: HTTPMethod,
    path: Path,
    relicsOrHandler: RelicInput<Ctx> | Handler<E, ParamsObject<Path>>,
    handler?: Handler<E, ParamsObject<Path>, Ctx>,
  ): this {
    // Plain handler — no relics
    if (typeof relicsOrHandler === "function") {
      this.#routes.push({ method, path, handler: relicsOrHandler as any })
      return this
    }

    // Relics provided — normalize, validate, wrap
    if (!handler) {
      throw new Error(
        `app.${method.toLowerCase()}('${path}'): handler is required when relics are provided.`
      )
    }

    const group = normalizeRelics(relicsOrHandler)

    const errors = validateRelicChain(group.relics, path)
    if (errors.length > 0) {
      throw new Error(`TomoeJS: Invalid relic configuration:\n${errors.join("\n")}`)
    }

    // Inline routes have no scope-level onError — use empty map (default behavior)
    const emptyErrorHandlers = new Map<number, (ctx: Context<any, any, Ctx>) => Response>()
    const wrapped = wrapWithRelics(group.relics, handler, emptyErrorHandlers)
    this.#routes.push({ method, path, handler: wrapped as any })
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
      if (!arg2) throw new Error("Middleware must be provided when a path is specified.")
      handler = arg2
    } else {
      handler = arg1
    }

    this.#middlewares.push({ path, handler })
    return this
  }

  // Scope

  /**
   * Create a scoped route group protected by relics.
   *
   * Accepts a single relic OR a unite() group — no wrapping needed
   * for single relics:
   *
   * @example
   * // Single relic — pass directly
   * app.scope('/user', authRelic, (r) => {
   *   r.get('/me', (ctx) => ctx.json(ctx.relic(UserCtx)))
   * })
   *
   * // Multiple relics — use unite()
   * app.scope('/admin', unite(authRelic, orgRelic), (r) => {
   *   r.get('/dashboard', (ctx) => ctx.json({ ... }))
   * })
   */
  scope<Ctx extends Record<string, any>>(
    path: string,
    input: RelicInput<Ctx>,
    builder: (r: ScopedRouter<Ctx>) => void,
  ): this {
    const group = normalizeRelics(input)

    const errors = validateRelicChain(group.relics, path)
    if (errors.length > 0) {
      throw new Error(`TomoeJS: Invalid relic configuration:\n${errors.join("\n")}`)
    }

    const scopedRouter = new ScopedRouter<Ctx>(path, group.relics, this)
    builder(scopedRouter)
    return this
  }

  // Global error handler

  /**
   * Override the global error handler for uncaught exceptions.
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

  // Internal

  _registerRoute(method: HTTPMethod, path: string, handler: Handler): void {
    this.#routes.push({ method, path, handler })
  }

  // Compile

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

  //  Fetch

  get fetch() {
    if (!this.#isCompiled) this.compile()
    return this.#dispatch.bind(this)
  }

  async #dispatch(request: Request, env?: any): Promise<Response> {
    const url = new URL(request.url)
    const match = this.#tree.match(request.method, url.pathname)

    if (!match) {
      return new Response("Not Found", { status: 404 })
    }

    const context = new Context(request, match.params, env || this.#env)

    try {
      return await match.handler(context)
    } catch (err) {
      if (err instanceof HttpError) return err.toResponse()
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
        if (i === stack.length) return finalHandler(ctx)
        const mw = stack[i]
        if (!mw) throw new Error(`Middleware at index ${i} is undefined`)
        return mw(ctx, () => dispatch(i + 1))
      }

      return dispatch(0)
    }
  }

  // Debug

  getRoutes() { return this.#tree.getRoutes() }
  getStats()  { return this.#tree.getStats() }
}
