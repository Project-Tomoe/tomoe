/**
 * TomoeJS — The art of perfect balance
 *
 * Built on web standards for universal runtime support.
 *
 * @example
 * ```ts
 * import { Tomoe, relic, token, unite } from 'tomoejs'
 *
 * const UserCtx = token<User>('user')
 *
 * const authRelic = relic(UserCtx, async (ctx) => {
 *   const user = await db.verify(ctx.req.headers.get('authorization'))
 *   if (!user) return err(Unauthorized)
 *   return user
 * })
 *
 * const userAccess = unite(authRelic)
 *
 * const app = new Tomoe()
 *
 * app.scope('/user', userAccess, (r) => {
 *   r.get('/me', (ctx) => ctx.json(ctx.relic(UserCtx)))
 * })
 *
 * export default app
 * ```
 */

export { Tomoe, Router } from "./tomoe"

export type { Handler, Middleware, HTTPMethod } from "./router/router"
export { ScopedRouter } from "./router/router"

export { Context } from "./context"
export type { Env, ExecutionContext } from "./context"


// Tokens
export { token } from "./relic/token"
export type { Token, TokenType } from "./relic/token"

// Relic definition
export { relic } from "./relic/relic"
export type {
  AnyRelic,
  ProvidingRelic,
  GuardRelic,
  ProvidingRelicFn,
  GuardRelicFn,
  UseResolver,
} from "./relic/relic"

// unite()
export { unite } from "./relic/unite"
export type { RelicGroup, GroupContext } from "./relic/unite"

// Error primitives
export { HttpError, httpError, Unauthorized, Forbidden, NotFound, BadRequest, Conflict, ServerError } from "./relic/error"

// Result signaling
export { err, isErr } from "./relic/result"
export type { Err } from "./relic/result"

export type {
  Prettify,
  Merge,
  Simplify,
  UnionToIntersection,
  IsNever,
  IsAny,
} from "./types/utils"

export type {
  ExtractParams,
  ParamsObject,
  HasWildcard,
  IsStaticPath,
} from "./types/inference"

//  Version 
export const VERSION = "0.0.3"