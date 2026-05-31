/**
 * Router - Core routing engine with middleware and relic scope support
 */

import {
  Context,
  type Env,
  type SocketCtx,
  type WebSocketHandlers,
  UpgradeResponse,
} from "../context"
import { HttpError } from "../relic/error"
import { executeRelics, validateRelicChain } from "../relic/executor"
import type { AnyRelic, ProvidingRelic } from "../relic/relic"
import { type Err, isErr } from "../relic/result"
import type { RelicGroup } from "../relic/unite"
import { unite } from "../relic/unite"
import type { ParamsObject } from "../types/inference"
import type { ExtractFromRelics } from "../types/standard-schema"
import { RadixTree } from "./radix"

// Handler & Middleware types

function getPathname(url: string): string {
  const protoIndex = url.indexOf("://")
  if (protoIndex === -1) {
    const qIndex = url.indexOf("?")
    return qIndex === -1 ? url : url.slice(0, qIndex)
  }
  const slashIndex = url.indexOf("/", protoIndex + 3)
  if (slashIndex === -1) return "/"
  const qIndex = url.indexOf("?", slashIndex)
  return qIndex === -1 ? url.slice(slashIndex) : url.slice(slashIndex, qIndex)
}

export type RouteRecord = {
  params: any
  query: any
  body: any
  headers: any
  response: any
}

export interface RouteOptions {
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
}

export type RelicContext<R> = R extends RelicGroup<any, infer Ctx>
  ? Ctx
  : R extends ProvidingRelic<infer Name, infer T>
    ? [Name] extends [never]
      ? Record<never, never>
      : { [K in Name]: T }
    : Record<never, never>

export type PrefixRoutes<
  Prefix extends string,
  Routes extends Record<string, Record<string, RouteRecord>>,
  RelicsInput = never,
> = {
  [K in keyof Routes as K extends string ? `${Prefix}${K extends "/" ? "" : K}` : never]: {
    [Method in keyof Routes[K]]: {
      params: Routes[K][Method]["params"]
      query: ExtractFromRelics<RelicsInput, "query"> extends never
        ? Routes[K][Method]["query"]
        : ExtractFromRelics<RelicsInput, "query">
      body: ExtractFromRelics<RelicsInput, "body"> extends never
        ? Routes[K][Method]["body"]
        : ExtractFromRelics<RelicsInput, "body">
      headers: ExtractFromRelics<RelicsInput, "headers"> extends never
        ? Routes[K][Method]["headers"]
        : ExtractFromRelics<RelicsInput, "headers">
      response: Routes[K][Method]["response"]
    }
  }
}

export type Handler<
  E extends Env = Env,
  P extends Record<string, string> = Record<never, never>,
  R extends Record<string, any> = Record<never, never>,
  Res = Response,
> = (c: Context<E, P, R> & R) => Res | Err | Promise<Res | Err>

export type Middleware<E extends Env = any> = (
  c: Context<E>,
  next: () => Promise<Response>
) => Promise<Response>

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

// Relic input type

/**
 * Anything accepted as a relic argument:
 *   - Single relic       → app.get('/me', authRelic, handler)
 *   - Group from unite() → app.get('/me', unite(authRelic, orgRelic), handler)
 */
type RelicInput<Ctx extends Record<string, any> = any> = AnyRelic | RelicGroup<AnyRelic[], Ctx>

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
  errorHandlers: Map<number, (ctx: Context<any, any, R>) => Response | Promise<Response>>
): Handler<any, P, R> {
  const providingRelics = relics.filter((r) => r._kind === "providing") as ProvidingRelic<
    any,
    any
  >[]

  return async (ctx) => {
    const relicError = await executeRelics(relics, ctx)

    if (relicError) {
      const customHandler = errorHandlers.get(relicError.status)
      if (customHandler) return customHandler(ctx)
      return relicError.toResponse()
    }

    const wrapCtx = Object.create(ctx)
    for (let i = 0; i < providingRelics.length; i++) {
      const rel = providingRelics[i]
      if (rel?.name) {
        Object.defineProperty(wrapCtx, rel.name, {
          value: ctx._getRelicByName(rel.name),
          writable: true,
          enumerable: true,
          configurable: true,
        })
      }
    }

    try {
      const result = await handler(wrapCtx)

      if (isErr(result)) {
        const customHandler = errorHandlers.get(result.error.status)
        if (customHandler) return customHandler(wrapCtx)
        return result.error.toResponse()
      }

      return result as any
    } catch (errVal) {
      if (errVal instanceof HttpError) {
        const customHandler = errorHandlers.get(errVal.status)
        if (customHandler) return customHandler(wrapCtx)
        return errVal.toResponse()
      }
      throw errVal
    }
  }
}

// ScopedRouter

/**
 * A router scoped to a path prefix and relic group.
 * Returned to the builder callback in app.scope().
 */
export class ScopedRouter<R extends Record<string, any> = Record<never, never>> {
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
    return this.#prefix.endsWith("/") ? this.#prefix.slice(0, -1) : this.#prefix
  }

  get<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this
  get<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  get(path: string, relicsOrHandler: any, handler?: any): this {
    return this.#register("GET", path, relicsOrHandler, handler)
  }

  post<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this
  post<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  post(path: string, relicsOrHandler: any, handler?: any): this {
    return this.#register("POST", path, relicsOrHandler, handler)
  }

  put<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this
  put<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  put(path: string, relicsOrHandler: any, handler?: any): this {
    return this.#register("PUT", path, relicsOrHandler, handler)
  }

  delete<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this
  delete<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  delete(path: string, relicsOrHandler: any, handler?: any): this {
    return this.#register("DELETE", path, relicsOrHandler, handler)
  }

  patch<Path extends string>(path: Path, handler: Handler<any, ParamsObject<Path>, R>): this
  patch<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  patch(path: string, relicsOrHandler: any, handler?: any): this {
    return this.#register("PATCH", path, relicsOrHandler, handler)
  }

  ws<Path extends string>(path: Path, handlers: WebSocketHandlers<any, ParamsObject<Path>, R>): this
  ws<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handlers: WebSocketHandlers<any, ParamsObject<Path>, R & RelicContext<RelicsInput>>
  ): this
  ws(path: string, relicsOrHandlers: any, handlers?: any): this {
    return this.#registerWS(path, relicsOrHandlers, handlers)
  }

  #registerWS(path: string, relicsOrHandlers: any, handlers?: any): this {
    let actualHandlers: any
    let combinedRelics = [...this.#relics]

    if (
      typeof relicsOrHandlers === "function" ||
      (relicsOrHandlers && !("_kind" in relicsOrHandlers))
    ) {
      actualHandlers = relicsOrHandlers
    } else {
      actualHandlers = handlers
      const localRelics = normalizeRelics(relicsOrHandlers).relics
      combinedRelics = [...combinedRelics, ...localRelics]
    }

    const fullPath = `${this.#normalizedPrefix}${path === "/" ? "" : path}`

    const rawHandler: Handler<any, any, any, any> = async (ctx) => {
      const url = new URL(ctx.req.url)
      const query: Record<string, string | string[]> = {}
      for (const [key, value] of url.searchParams.entries()) {
        if (key in query) {
          const existing = query[key]
          if (Array.isArray(existing)) {
            existing.push(value)
          } else {
            query[key] = [existing as string, value]
          }
        } else {
          query[key] = value
        }
      }

      const headers: Record<string, string> = {}
      ctx.req.headers.forEach((val: string, key: string) => {
        headers[key] = val
      })

      const cookies: Record<string, string> = {}
      const cookieHeader = ctx.req.headers.get("cookie")
      if (cookieHeader) {
        const parts = cookieHeader.split(";")
        for (const part of parts) {
          const [k, v] = part.split("=")
          if (k && v) {
            cookies[k.trim()] = decodeURIComponent(v.trim())
          }
        }
      }

      const sCtx: SocketCtx<any, any> = {
        params: ctx.params || {},
        query,
        relics: {},
        handshake: {
          headers,
          cookies,
        },
      }

      const providingRelics = combinedRelics.filter((r) => r._kind === "providing")
      for (const rel of providingRelics) {
        if (rel.name) {
          sCtx.relics[rel.name] = ctx._getRelicByName(rel.name)
        }
      }

      if (actualHandlers.handshake) {
        await actualHandlers.handshake(ctx)
      }

      return new UpgradeResponse(actualHandlers, sCtx, {
        headers: ctx._injectHeaders(),
      })
    }

    const wrapped = wrapWithRelics(combinedRelics, rawHandler, this.#errorHandlers)
    this.#parent._registerRoute("GET", fullPath, wrapped as any, combinedRelics, undefined, true)
    return this
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
    handler: (ctx: Context<any, any, R>) => Response | Promise<Response>
  ): this {
    this.#errorHandlers.set(status, handler)
    return this
  }

  #register(method: HTTPMethod, path: string, relicsOrHandler: any, handler?: any): this {
    let actualHandler: any
    let combinedRelics = [...this.#relics]

    if (typeof relicsOrHandler === "function") {
      actualHandler = relicsOrHandler
    } else {
      actualHandler = handler
      const localRelics = normalizeRelics(relicsOrHandler).relics
      combinedRelics = [...combinedRelics, ...localRelics]
    }

    const fullPath = `${this.#normalizedPrefix}${path === "/" ? "" : path}`
    const wrapped = wrapWithRelics(combinedRelics, actualHandler as any, this.#errorHandlers)
    this.#parent._registerRoute(method, fullPath, wrapped as any, combinedRelics)
    return this
  }
}

// Router

export class Router<
  E extends Env = Env,
  Routes extends Record<string, Record<string, RouteRecord>> = Record<never, never>,
> {
  #tree: RadixTree
  #middlewares: Array<{ path: string; handler: Middleware }>
  #routes: Array<{
    method: HTTPMethod
    path: string
    handler: Handler
    relics?: AnyRelic[]
    options?: RouteOptions | undefined
    isWebSocket?: boolean
  }>
  #chainCache: Map<string, (c: Context, final: Handler) => any>
  #isCompiled = false
  #env: E

  /** Global error handler — safe 500 by default, no details leaked */
  #errorHandler: (err: unknown, ctx?: Context) => Response = () =>
    new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })

  constructor(env: E = {} as E) {
    this.#tree = new RadixTree()
    this.#middlewares = []
    this.#routes = []
    this.#chainCache = new Map()
    this.#env = env
  }

  // Sibling access helpers (safe compiled getters)
  get _routes() {
    return this.#routes
  }
  get _middlewares() {
    return this.#middlewares
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

  get<Path extends string, Res = Response>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>, Record<never, never>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        GET: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Res
        }
      }
    }
  >
  get<Path extends string, RelicsInput extends RelicInput, Res = Response>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<E, ParamsObject<Path>, RelicContext<RelicsInput>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        GET: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Res
        }
      }
    }
  >
  get(path: string, relicsOrHandler: any, handler?: any, options?: RouteOptions): any {
    return this.#method("GET", path, relicsOrHandler, handler, options)
  }

  post<Path extends string, Res = Response>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>, Record<never, never>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        POST: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Res
        }
      }
    }
  >
  post<Path extends string, RelicsInput extends RelicInput, Res = Response>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<E, ParamsObject<Path>, RelicContext<RelicsInput>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        POST: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Res
        }
      }
    }
  >
  post(path: string, relicsOrHandler: any, handler?: any, options?: RouteOptions): any {
    return this.#method("POST", path, relicsOrHandler, handler, options)
  }

  put<Path extends string, Res = Response>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>, Record<never, never>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        PUT: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Res
        }
      }
    }
  >
  put<Path extends string, RelicsInput extends RelicInput, Res = Response>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<E, ParamsObject<Path>, RelicContext<RelicsInput>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        PUT: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Res
        }
      }
    }
  >
  put(path: string, relicsOrHandler: any, handler?: any, options?: RouteOptions): any {
    return this.#method("PUT", path, relicsOrHandler, handler, options)
  }

  delete<Path extends string, Res = Response>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>, Record<never, never>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        DELETE: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Res
        }
      }
    }
  >
  delete<Path extends string, RelicsInput extends RelicInput, Res = Response>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<E, ParamsObject<Path>, RelicContext<RelicsInput>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        DELETE: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Res
        }
      }
    }
  >
  delete(path: string, relicsOrHandler: any, handler?: any, options?: RouteOptions): any {
    return this.#method("DELETE", path, relicsOrHandler, handler, options)
  }

  patch<Path extends string, Res = Response>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>, Record<never, never>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        PATCH: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Res
        }
      }
    }
  >
  patch<Path extends string, RelicsInput extends RelicInput, Res = Response>(
    path: Path,
    relics: RelicsInput,
    handler: Handler<E, ParamsObject<Path>, RelicContext<RelicsInput>, Res>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        PATCH: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Res
        }
      }
    }
  >
  patch(path: string, relicsOrHandler: any, handler?: any, options?: RouteOptions): any {
    return this.#method("PATCH", path, relicsOrHandler, handler, options)
  }

  ws<Path extends string>(
    path: Path,
    handlers: WebSocketHandlers<any, ParamsObject<Path>, Record<never, never>>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        GET: {
          params: ParamsObject<P>
          query: never
          body: never
          headers: never
          response: Response
        }
      }
    }
  >
  ws<Path extends string, RelicsInput extends RelicInput>(
    path: Path,
    relics: RelicsInput,
    handlers: WebSocketHandlers<any, ParamsObject<Path>, RelicContext<RelicsInput>>,
    options?: RouteOptions
  ): Router<
    E,
    Routes & {
      [P in Path]: {
        GET: {
          params: ParamsObject<P>
          query: ExtractFromRelics<RelicsInput, "query">
          body: ExtractFromRelics<RelicsInput, "body">
          headers: ExtractFromRelics<RelicsInput, "headers">
          response: Response
        }
      }
    }
  >
  ws(path: string, relicsOrHandlers: any, handlers?: any, options?: RouteOptions): any {
    let actualHandlers: any
    let relicsList: AnyRelic[] = []
    let routeOptions = options

    if (
      typeof relicsOrHandlers === "function" ||
      (relicsOrHandlers && !("_kind" in relicsOrHandlers))
    ) {
      actualHandlers = relicsOrHandlers
      routeOptions = handlers
    } else {
      actualHandlers = handlers
      relicsList = normalizeRelics(relicsOrHandlers).relics

      const group = normalizeRelics(relicsOrHandlers)
      const errors = validateRelicChain(group.relics, path)
      if (errors.length > 0) {
        throw new Error(`TomoeJS: Invalid relic configuration:\n${errors.join("\n")}`)
      }
    }

    const rawHandler: Handler<any, any, any, any> = async (ctx) => {
      const url = new URL(ctx.req.url)
      const query: Record<string, string | string[]> = {}
      for (const [key, value] of url.searchParams.entries()) {
        if (key in query) {
          const existing = query[key]
          if (Array.isArray(existing)) {
            existing.push(value)
          } else {
            query[key] = [existing as string, value]
          }
        } else {
          query[key] = value
        }
      }

      const headers: Record<string, string> = {}
      ctx.req.headers.forEach((val: string, key: string) => {
        headers[key] = val
      })

      const cookies: Record<string, string> = {}
      const cookieHeader = ctx.req.headers.get("cookie")
      if (cookieHeader) {
        const parts = cookieHeader.split(";")
        for (const part of parts) {
          const [k, v] = part.split("=")
          if (k && v) {
            cookies[k.trim()] = decodeURIComponent(v.trim())
          }
        }
      }

      const sCtx: SocketCtx<any, any> = {
        params: ctx.params || {},
        query,
        relics: {},
        handshake: {
          headers,
          cookies,
        },
      }

      const providingRelics = relicsList.filter((r) => r._kind === "providing")
      for (const rel of providingRelics) {
        if (rel.name) {
          sCtx.relics[rel.name] = ctx._getRelicByName(rel.name)
        }
      }

      if (actualHandlers.handshake) {
        await actualHandlers.handshake(ctx)
      }

      return new UpgradeResponse(actualHandlers, sCtx, {
        headers: ctx._injectHeaders(),
      })
    }

    const emptyErrorHandlers = new Map<number, (ctx: Context<any, any, any>) => Response>()
    const wrapped = wrapWithRelics(relicsList, rawHandler, emptyErrorHandlers)
    this._registerRoute("GET", path, wrapped as any, relicsList, routeOptions, true)
    return this as any
  }

  /**
   * Shared implementation for all HTTP method registrations.
   * Detects whether relics were passed and wraps handler accordingly.
   */
  #method<Path extends string, Ctx extends Record<string, any>>(
    method: HTTPMethod,
    path: Path,
    relicsOrHandler: any,
    handler?: any,
    options?: RouteOptions
  ): any {
    let actualHandler: any
    let relicsList: AnyRelic[] = []
    let routeOptions: RouteOptions | undefined = undefined

    if (typeof relicsOrHandler === "function") {
      actualHandler = relicsOrHandler
      routeOptions = handler
    } else {
      actualHandler = handler
      routeOptions = options
      relicsList = normalizeRelics(relicsOrHandler).relics

      const group = normalizeRelics(relicsOrHandler)
      const errors = validateRelicChain(group.relics, path)
      if (errors.length > 0) {
        throw new Error(`TomoeJS: Invalid relic configuration:\n${errors.join("\n")}`)
      }
    }

    // Inline routes have no scope-level onError — use empty map (default behavior)
    const emptyErrorHandlers = new Map<number, (ctx: Context<any, any, Ctx>) => Response>()
    const wrapped = wrapWithRelics(relicsList, actualHandler as any, emptyErrorHandlers)
    this._registerRoute(method, path, wrapped as any, relicsList, routeOptions)
    return this as any
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

  // Sub-router mount (.route)

  /**
   * Mount a sub-router at a prefix path, optionally protecting all of its routes with relics.
   */
  route<Prefix extends string, SubRoutes extends Record<string, Record<string, RouteRecord>>>(
    path: Prefix,
    subRouter: Router<any, SubRoutes>
  ): Router<E, Routes & PrefixRoutes<Prefix, SubRoutes>>
  route<
    Prefix extends string,
    RelicsInput extends RelicInput,
    SubRoutes extends Record<string, Record<string, RouteRecord>>,
  >(
    path: Prefix,
    relics: RelicsInput,
    subRouter: Router<any, SubRoutes>
  ): Router<E, Routes & PrefixRoutes<Prefix, SubRoutes, RelicsInput>>
  route(path: string, relicsOrRouter: any, maybeRouter?: any): any {
    const hasRelics = maybeRouter !== undefined
    const prefix = path.endsWith("/") ? path.slice(0, -1) : path
    const subRouter = hasRelics ? maybeRouter : relicsOrRouter

    let wrappedRoutes = subRouter._routes
    if (hasRelics) {
      const group = normalizeRelics(relicsOrRouter)
      const errors = validateRelicChain(group.relics, path)
      if (errors.length > 0) {
        throw new Error(
          `TomoeJS: Invalid relic configuration during route mount:\n${errors.join("\n")}`
        )
      }

      wrappedRoutes = subRouter._routes.map((route: any) => {
        const emptyErrorHandlers = new Map<number, (ctx: Context) => Response>()
        const wrapped = wrapWithRelics(group.relics, route.handler, emptyErrorHandlers)
        const combinedRelics = [...group.relics, ...(route.relics || [])]
        return {
          ...route,
          handler: wrapped,
          relics: combinedRelics,
          isWebSocket: route.isWebSocket,
        }
      })
    }

    for (const route of wrappedRoutes) {
      const fullPath = `${prefix}${route.path === "/" ? "" : route.path}`
      const combinedRelics = route.relics || []
      this._registerRoute(
        route.method,
        fullPath,
        route.handler,
        combinedRelics,
        route.options,
        route.isWebSocket
      )
    }

    for (const mw of subRouter._middlewares) {
      const fullPath =
        mw.path === "*" || mw.path === "/*"
          ? `${prefix}/*`
          : `${prefix}${mw.path === "/" ? "" : mw.path}`
      this.use(fullPath, mw.handler)
    }

    return this as any
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
    builder: (r: ScopedRouter<Ctx>) => void
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

  _registerRoute(
    method: HTTPMethod,
    path: string,
    handler: Handler,
    relics: AnyRelic[] = [],
    options?: RouteOptions | undefined,
    isWebSocket = false
  ): void {
    this.#routes.push({ method, path, handler, relics, options, isWebSocket })
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

      const optimizedHandler = (c: Context) => runner?.(c, route.handler)
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
    const requestMethod = request.method.toUpperCase()
    const pathname = getPathname(request.url)
    let match = this.#tree.match(requestMethod, pathname)
    let shouldDropBody = false

    if (!match && requestMethod === "HEAD") {
      match = this.#tree.match("GET", pathname)
      shouldDropBody = Boolean(match)
    }

    if (!match && requestMethod === "OPTIONS") {
      const methods: HTTPMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]
      for (const m of methods) {
        match = this.#tree.match(m, pathname)
        if (match) break
      }
    }

    if (!match) {
      const allowed = this.#allowedMethods(pathname)
      if (allowed.length > 0) {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: allowed.join(", ") },
        })
      }
      return new Response("Not Found", { status: 404 })
    }

    const context = new Context(request, match.params, env || this.#env)

    try {
      const response = await match.handler(context)
      if (shouldDropBody) {
        return new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }
      return response
    } catch (err) {
      if (err instanceof HttpError) return err.toResponse()
      console.error(err)
      return this.#errorHandler(err, context)
    }
  }

  #allowedMethods(pathname: string): string[] {
    const allowed = new Set<string>()
    const methods: HTTPMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

    for (const method of methods) {
      if (this.#tree.match(method, pathname)) {
        allowed.add(method)
        if (method === "GET") allowed.add("HEAD")
      }
    }

    if (allowed.size > 0) allowed.add("OPTIONS")
    return [...allowed]
  }

  // Middleware chain helpers

  #findStack(routePath: string): Middleware[] {
    return this.#middlewares
      .filter((m) => {
        if (m.path === "*" || m.path === "/*") return true
        const prefix = m.path.replace(/\*$/, "")
        const cleanPrefix = prefix.endsWith("/") && prefix !== "/" ? prefix.slice(0, -1) : prefix
        const cleanRoute =
          routePath.endsWith("/") && routePath !== "/" ? routePath.slice(0, -1) : routePath
        return cleanRoute === cleanPrefix || cleanRoute.startsWith(`${cleanPrefix}/`)
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

  getRoutes() {
    return this.#tree.getRoutes()
  }
  getStats() {
    return this.#tree.getStats()
  }
}
