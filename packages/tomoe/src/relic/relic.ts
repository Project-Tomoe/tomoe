/**
 * Relic - Typed precondition with optional value provision
 *
 * Two forms:
 *
 * 1. Providing relic — runs logic, provides a typed value via token
 *    const authRelic = relic(UserCtx, async (ctx) => {
 *      const user = await db.verify(ctx.req.headers.get("authorization"))
 *      if (!user) return err(Unauthorized)
 *      return user   // bound to UserCtx token
 *    })
 *
 * 2. Guard relic — validates a condition, provides nothing
 *    const adminRelic = relic(async (ctx, use) => {
 *      const user = use(UserCtx)   // resolves from already-run relic
 *      if (!user.isAdmin) return err(Forbidden)
 *    })
 *
 * Dependencies are declared by calling use(Token) inside the function.
 * The framework resolves them from the current scope's relic chain.
 */
import type { Token } from "./token";
import type { Err } from "./result";

/**
 * The `use` resolver passed into relic functions.
 * Calling use(Token) declares a dependency and resolves the value
 * from the relic that provided it earlier in the chain.
 */
export type UseResolver = <T>(token: Token<T>) => T

/**
 * Base context available inside every relic function.
 * Relics receive the raw request context — they don't have
 * access to handler-level typed ctx yet (that's built by unite).
 */
export interface RelicBaseCtx {
  req: Request
}
 

/**
 * The function signature for a providing relic.
 * Returns T (success) or Err (failure).
 */
export type ProvidingRelicFn<T> = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => T | Err | Promise<T | Err>

/**
 * The function signature for a guard relic.
 * Returns void (pass) or Err (block).
 */
export type GuardRelicFn = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => void | Err | Promise<void | Err>


export interface ProvidingRelic<T> {
  readonly _kind: "providing"
  readonly token: Token<T>
  readonly fn: ProvidingRelicFn<T>
  readonly _name: string
}
 
export interface GuardRelic {
  readonly _kind: "guard"
  readonly fn: GuardRelicFn
  readonly _name: string
}
 
export type AnyRelic = ProvidingRelic<any> | GuardRelic

/**
 * Create a providing relic — runs fn, binds return value to token.
 */
export function relic<T>(
  token: Token<T>,
  fn: ProvidingRelicFn<T>
): ProvidingRelic<T>
 
/**
 * Create a guard relic — validates condition, provides nothing.
 */
export function relic(fn: GuardRelicFn): GuardRelic
 
export function relic(
  tokenOrFn: Token<any> | GuardRelicFn,
  fn?: ProvidingRelicFn<any>
): AnyRelic {
  if (typeof tokenOrFn === "function") {
    return {
      _kind: "guard",
      fn: tokenOrFn,
      _name: tokenOrFn.name || "anonymous guard",
    }
  }
 
  if (!fn) {
    throw new Error(
      `relic(token, fn): fn is required when token is provided. Token: ${tokenOrFn._name}`
    )
  }
 
  return {
    _kind: "providing",
    token: tokenOrFn,
    fn,
    _name: tokenOrFn._name,
  }
}
 
 
/** Extract the token type from a ProvidingRelic */
export type RelicProvides<R extends AnyRelic> =
  R extends ProvidingRelic<infer T> ? T : never
 
/** Check if a relic provides a specific token */
export type RelicProvidesToken<R extends AnyRelic, Tok extends Token<any>> =
  R extends ProvidingRelic<any>
    ? R["token"] extends Tok
      ? true
      : false
    : false