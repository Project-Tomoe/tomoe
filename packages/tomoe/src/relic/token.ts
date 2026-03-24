
/**
 * Token - Typed contract identity for Relics
 * 
  * A Token is a unique symbol that carries a TypeScript type.
 * It serves as the "contract" between a relic that provides a value
 * and a handler/relic that consumes it.
 *
 * Tokens replace string-based keys entirely — no typos, no mismatches,
 * full autocomplete.
 *
 * @example
 * const UserCtx = token<{ id: string; isAdmin: boolean }>()
 * const authRelic = relic(UserCtx, async (ctx) => { ... })
 */

// Prevents Token<string> from being assignable to Token<number>
const TokenBrand = Symbol.for("tomoe.token");

export interface Token<T> {
    readonly [TokenBrand]: T 
    /** Unique symbol identity - used for mapping keys in relic store */
    readonly _id: symbol
    /** Debug name: shown in error messages and graph inspection */
    readonly _name: string
}

/**
 * Create a typed token.
 *
 * @param name - Optional debug name shown in error messages
 *
 * @example
 * const UserCtx = token<User>('user')
 * const OrgCtx  = token<Org>('org')
 */
export function token<T>(name?: string): Token<T> {
    const id = Symbol(name ?? "token");
    return {
        [TokenBrand]: undefined as any,
        _id: id,
        _name: name ?? id.toString()
    }
}

/**
 * Extract the value type carried by a Token.
 *
 * @example
 * const UserCtx = token<User>()
 * type UserType = TokenType<typeof UserCtx> // User
 */
export type TokenType<T extends Token<any>> = T extends Token<infer U> ? U:never;
