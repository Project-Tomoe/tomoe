import type { AnyRelic, ProvidingRelic } from "./relic";
import type { UnionToIntersection } from "../types/utils";

type RelicContextEntry<R extends AnyRelic> =
  R extends ProvidingRelic<infer Name, infer T>
    ? [Name] extends [never]
      ? {}
      : { [K in Name]: T }
    : {};

type UniteContext<Relics extends AnyRelic[]> = UnionToIntersection<
  {
    [K in keyof Relics]: RelicContextEntry<Relics[K]>;
  }[number]
>;

export interface RelicGroup<
  Relics extends AnyRelic[],
  Ctx = UniteContext<Relics>,
> {
  readonly _kind: "group";
  readonly relics: Relics;
  /** Phantom type — never accessed at runtime, only used for TS inference */
  readonly _ctx: Ctx;
}

export function unite<Relics extends AnyRelic[]>(
  ...relics: Relics
): RelicGroup<Relics> {
  return {
    _kind: "group",
    relics,
    _ctx: {} as UniteContext<Relics>,
  };
}

export type GroupContext<G extends RelicGroup<any, any>> =
  G extends RelicGroup<any, infer Ctx> ? Ctx : never;