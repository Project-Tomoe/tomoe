/**
 * Result - Lightweight error signaling for Relics
 * 
 * Only errors need explicit marking. Happy path just returns the value.
 *
 * @example
 * const authRelic = relic(UserCtx, async (ctx) => {
 *   const user = await db.users.verify(ctx.req.headers.get("authorization"))
 *   if (!user) return err(Unauthorized)    // explicit error
 *   return user                            // just return — no ok() needed
 * })
 */

import {HttpError} from "./error";

const ERR_BRAND = Symbol("tomoe.err");

export interface Err {
    readonly [ERR_BRAND]: true 
    readonly error: HttpError
}

/**
 * Mark a return value as an error.
 * The framework intercepts this and responds automatically.
 *
 * @example
 * if (!user) return err(Unauthorized)
 * if (!org)  return err(Forbidden)
 */
export function err(error: HttpError): Err {
  return { [ERR_BRAND]: true, error }
}


/**
 * Type guard — check if a relic return value is an error.
 * Used internally by the executor.
 */
export function isErr(value: unknown): value is Err {
  return (
    typeof value === "object" &&
    value !== null &&
    ERR_BRAND in value &&
    (value as any)[ERR_BRAND] === true
  )
}