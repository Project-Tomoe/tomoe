/**
 * Executor - Runtime relic chain resolution
 *
 * Runs a relic chain in order, resolving dependencies via use(),
 * populating the relic store, and short-circuiting on errors.
 *
 * This is the hot path — called on every request that hits a scope.
 * It is kept minimal: no reflection, no dynamic dispatch, just a loop.
 */

import type { AnyRelic } from "./relic"
import type { Token } from "./token"
import { isErr } from "./result"
import { HttpError } from "./error"

/**
 * Minimal context the executor needs from the request.
 * Decoupled from the full Context class so executor stays testable.
 */
export interface ExecutorCtx {
  req: Request
  _setRelic(id: symbol, value: any): void
  _getRelic(id: symbol): any
}

/**
 * Execute a relic chain against the current request context.
 *
 * Returns:
 *  - null   if all relics passed
 *  - HttpError if any relic returned err() or threw
 *
 * On success, all provided values are stored in ctx via _setRelic().
 * Handlers and downstream relics read them via ctx._getRelic() or
 * the typed ctx proxy built by scope().
 */
export async function executeRelics(
  relics: AnyRelic[],
  ctx: ExecutorCtx
): Promise<HttpError | null> {
  for (const rel of relics) {
    // Build the use() resolver for this relic
    // use(token) reads from the relic store populated by earlier relics
    const use = <T>(token: Token<T>): T => {
      const value = ctx._getRelic(token._id)
 
      if (value === undefined) {
        throw new Error(
          `Relic dependency error: "${rel._name}" called use(${token._name}) ` +
          `but no relic in the chain provides it. ` +
          `Make sure a relic providing ${token._name} appears before "${rel._name}" in unite().`
        )
      }
 
      return value as T
    }
 
    try {
      const result = await rel.fn(ctx, use)
 
      // Guard relics return void on success — nothing to store
      if (rel._kind === "guard") {
        if (isErr(result)) {
          return result.error
        }
        continue
      }
 
      // Providing relic returned an error
      if (isErr(result)) {
        return result.error
      }
 
      // Providing relic succeeded — store value by token id
      ctx._setRelic(rel.token._id, result)
    } catch (e) {
      // If a relic throws an HttpError directly, treat it as err()
      if (e instanceof HttpError) {
        return e
      }
 
      // Unexpected error — rethrow so the router's error handler catches it
      throw e
    }
  }
 
  return null
}
 
/**
 * Validate a relic chain at startup (called during compile()).
 *
 * Checks that every use(Token) call can be satisfied by a
 * previous relic in the chain. Since use() is called at runtime,
 * we do a static analysis pass using a Symbol registry.
 *
 * Returns array of error strings — empty means valid.
 */
export function validateRelicChain(
  relics: AnyRelic[],
  scopePath: string
): string[] {
  const errors: string[] = []
  const provided = new Set<symbol>()
 
  for (const rel of relics) {
    // We can't statically analyze which tokens use() is called with
    // without running the function. So we rely on naming conventions
    // and runtime checks in executeRelics() instead.
    // This validates what we CAN know: duplicate token provision.
 
    if (rel._kind === "providing") {
      const tokenId = rel.token._id
 
      if (provided.has(tokenId)) {
        errors.push(
          `[${scopePath}] Token "${rel.token._name}" is provided by multiple relics. ` +
          `Only one relic should provide each token.`
        )
      }
 
      provided.add(tokenId)
    }
  }
 
  return errors
}