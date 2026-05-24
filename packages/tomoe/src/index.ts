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

export type { Handler, Middleware, HTTPMethod, RouteOptions } from "./router/router"
export { ScopedRouter } from "./router/router"

export { Context, type TypedResponse } from "./context"
export type { Env, ExecutionContext } from "./context"
export { createClient } from "./client"
export type { Client } from "./client"


// Relic definition
export { relic, guard } from "./relic/relic"
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
export {
  HttpError,
  httpError,
  BadRequest,
  Unauthorized,
  PaymentRequired,
  Forbidden,
  NotFound,
  MethodNotAllowed,
  NotAcceptable,
  RequestTimeout,
  Conflict,
  Gone,
  PayloadTooLarge,
  UnsupportedMediaType,
  UnprocessableEntity,
  TooManyRequests,
  ServerError,
  NotImplemented,
  BadGateway,
  ServiceUnavailable,
  GatewayTimeout,
} from "./relic/error"

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
export const VERSION = "1.0.0-rc.1"

// Context types
export type { CookieOptions } from "./context"

// Middlewares
export { cors } from "./middleware/cors"
export type { CorsOptions } from "./middleware/cors"
export { logger } from "./middleware/logger"
export { csrf } from "./middleware/csrf"
export type { CsrfOptions } from "./middleware/csrf"
export { rateLimit } from "./middleware/rate-limit"
export type { RateLimitOptions } from "./middleware/rate-limit"

// Node Server Adapter
export { createServer } from "./node"

// Swagger / OpenAPI
export { swagger, generateOpenApiDoc, schemaToJsonSchema } from "./swagger"
export type { SwaggerOptions } from "./swagger"