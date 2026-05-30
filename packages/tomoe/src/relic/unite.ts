import type { UnionToIntersection } from "../types/utils"
import type { AnyRelic, ProvidingRelic } from "./relic"

type RelicInput = AnyRelic | RelicGroup<any, any>

type RelicContextEntry<R extends RelicInput> = R extends RelicGroup<any, infer Ctx>
  ? Ctx
  : R extends ProvidingRelic<infer Name, infer T>
    ? [Name] extends [never]
      ? Record<never, never>
      : { [K in Name]: T }
    : Record<never, never>

type FlattenRelicInputs<Inputs extends readonly RelicInput[]> = Inputs extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends RelicGroup<infer Relics, any>
    ? Tail extends readonly RelicInput[]
      ? [...Relics, ...FlattenRelicInputs<Tail>]
      : [...Relics]
    : Head extends AnyRelic
      ? Tail extends readonly RelicInput[]
        ? [Head, ...FlattenRelicInputs<Tail>]
        : [Head]
      : []
  : []

type UniteContext<Relics extends readonly RelicInput[]> = UnionToIntersection<
  {
    [K in keyof Relics]: RelicContextEntry<Relics[K]>
  }[number]
>

export interface RelicGroup<Relics extends AnyRelic[], Ctx = UniteContext<Relics>> {
  readonly _kind: "group"
  readonly relics: Relics
  /** Phantom type — never accessed at runtime, only used for TS inference */
  readonly _ctx: Ctx
}

function isRelicGroup(input: RelicInput): input is RelicGroup<any, any> {
  return "_kind" in input && input._kind === "group"
}

function flattenRelics(inputs: readonly RelicInput[]): AnyRelic[] {
  const flattened: AnyRelic[] = []

  for (const input of inputs) {
    if (isRelicGroup(input)) {
      flattened.push(...flattenRelics(input.relics as RelicInput[]))
    } else {
      flattened.push(input)
    }
  }

  return flattened
}

export function unite<Inputs extends RelicInput[]>(
  ...relics: Inputs
): RelicGroup<FlattenRelicInputs<Inputs>, UniteContext<Inputs>> {
  return {
    _kind: "group",
    relics: flattenRelics(relics) as FlattenRelicInputs<Inputs>,
    _ctx: {} as UniteContext<Inputs>,
  }
}

export type GroupContext<G extends RelicGroup<any, any>> = G extends RelicGroup<any, infer Ctx>
  ? Ctx
  : never
