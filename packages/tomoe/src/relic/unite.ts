/**
 * unite() - Ordered, typed relic group
 *
 * Combines multiple relics into a named, reusable access policy.
 * Order matters — relics execute left to right.
 * Type system accumulates provided context across the chain.
 *
 * @example
 * // Define once
 * const userAccess  = unite(authRelic)
 * const adminAccess = unite(authRelic, orgRelic, adminGuard)
 *
 * // Reuse across scopes
 * app.scope('/user',  userAccess,  (r) => { ... })
 * app.scope('/admin', adminAccess, (r) => { ... })
 *
 * // Inside the scope, ctx is typed with all provided tokens:
 * r.get('/dashboard', (ctx) => {
 *   ctx.user  // User  — from authRelic
 *   ctx.org   // Org   — from orgRelic
 * })
 */

import type { AnyRelic, ProvidingRelic } from "./relic"
import type { Token, TokenType } from "./token"
import type { UnionToIntersection } from "../types/utils"

/**
 * Given a ProvidingRelic, extract the { key: value } pair it adds to context.
 * Uses the token's _name as the context key.
 *
 * ProvidingRelic<User> with token._name = 'user' → { user: User }
 */
type RelicContextEntry<R extends AnyRelic> =
  R extends ProvidingRelic<infer T>
    ? R["token"] extends Token<T>
      ? { [K in R["token"]["_name"]]: T }
      : never
    : never 

/**
 * Given a tuple of relics, produce the merged context object type.
 *
 * [authRelic, orgRelic] → { user: User } & { org: Org } → { user: User; org: Org }
 */
type UniteContext<Relics extends AnyRelic[]> = UnionToIntersection<
  {
    [K in keyof Relics]: RelicContextEntry<Relics[K]>
  }[number]
>

/**
 * A typed, ordered group of relics — the result of calling unite().
 *
 * Type parameters:
 *   Relics — the tuple of relics in execution order
 *   Ctx    — the merged context type all providing relics produce
 */
export interface RelicGroup<
  Relics extends AnyRelic[],
  Ctx = UniteContext<Relics>,
> {
  readonly _kind: "group"
  readonly relics: Relics
  /** Phantom type — never accessed at runtime, only used for TS inference */
  readonly _ctx: Ctx
}

/**
 * Combine relics into a reusable, typed group.
 * Relics execute in the order provided.
 *
 * @example
 * const adminAccess = unite(authRelic, orgRelic, adminGuard)
 *
 * // adminAccess._ctx is typed as { user: User; org: Org }
 * // adminGuard is a guard relic — contributes no context key
 */
export function unite<Relics extends AnyRelic[]>(
  ...relics: Relics
): RelicGroup<Relics> {
  return {
    _kind: "group",
    relics,
    _ctx: {} as UniteContext<Relics>,
  }
}

/**
 * Extract the context type from a RelicGroup.
 *
 * @example
 * const adminAccess = unite(authRelic, orgRelic)
 * type AdminCtx = GroupContext<typeof adminAccess>
 * // { user: User; org: Org }
 */
export type GroupContext<G extends RelicGroup<any, any>> =
  G extends RelicGroup<any, infer Ctx> ? Ctx : never