import type { Err } from "./result";

/**
 * The `use` resolver passed into relic and guard functions.
 * Calling use(Relic) resolves the value from that relic in the chain.
 */
export type UseResolver = <T>(relic: ProvidingRelic<any, T>) => T;

/**
 * Base context available inside every relic and guard function.
 */
export interface RelicBaseCtx {
  req: Request;
}

/**
 * The function signature for a providing relic.
 */
export type ProvidingRelicFn<T> = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => T | Err | Promise<T | Err>;

/**
 * The function signature for a guard relic.
 */
export type GuardRelicFn = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => void | Err | Promise<void | Err>;

export interface ProvidingRelic<Name extends string, T> {
  readonly _kind: "providing";
  readonly _id: symbol;
  readonly name: Name;
  readonly fn: ProvidingRelicFn<T>;
}

export interface GuardRelic {
  readonly _kind: "guard";
  readonly _id: symbol;
  readonly name: string;
  readonly fn: GuardRelicFn;
}

export type AnyRelic = ProvidingRelic<any, any> | GuardRelic;

/**
 * Create an anonymous providing relic — runs fn, provides value accessed via relic reference.
 */
export function relic<T>(
  fn: ProvidingRelicFn<T>
): ProvidingRelic<never, T>;

/**
 * Create a named providing relic — runs fn, binds return value to a context property.
 */
export function relic<Name extends string, T>(
  name: Name,
  fn: ProvidingRelicFn<T>
): ProvidingRelic<Name, T>;

export function relic<Name extends string, T>(
  nameOrFn: Name | ProvidingRelicFn<T>,
  fn?: ProvidingRelicFn<T>
): AnyRelic {
  if (typeof nameOrFn === "function") {
    return {
      _kind: "providing",
      _id: Symbol("anonymous_relic"),
      name: "" as any,
      fn: nameOrFn,
    };
  }

  if (!fn) {
    throw new Error(
      `relic(name, fn): fn is required when name is provided.`
    );
  }

  return {
    _kind: "providing",
    _id: Symbol(nameOrFn),
    name: nameOrFn,
    fn,
  };
}

/**
 * Create a guard relic — validates a condition, provides no value.
 */
export function guard(fn: GuardRelicFn): GuardRelic {
  return {
    _kind: "guard",
    _id: Symbol(fn.name || "anonymous_guard"),
    name: fn.name || "anonymous_guard",
    fn,
  };
}

/** Extract the type provided by a ProvidingRelic */
export type RelicProvides<R extends AnyRelic> =
  R extends ProvidingRelic<any, infer T> ? T : never;