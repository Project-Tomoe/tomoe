import type { AnyRelic, ProvidingRelic } from "../relic/relic"
import type { RelicGroup } from "../relic/unite"

/**
 * Minimal Standard Schema interface based on standard-schema v1.
 * Allows validation-agnostic integration with Zod, Valibot, ArkType, TypeBox, etc.
 */
export interface StandardSchemaV1<TInput = any, TOutput = any> {
  readonly "~standard": {
    readonly version: number
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) => StandardSchemaV1.Result<TOutput> | Promise<StandardSchemaV1.Result<TOutput>>
    readonly types?: {
      readonly input: TInput
      readonly output: TOutput
    }
  }
}

export namespace StandardSchemaV1 {
  export interface SuccessResult<TOutput> {
    readonly value: TOutput
    readonly issues?: undefined
  }
  export interface FailureResult {
    readonly value?: undefined
    readonly issues: ReadonlyArray<Issue>
  }
  export type Result<TOutput> = SuccessResult<TOutput> | FailureResult
  export interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>
  }
}

/**
 * Infer the output type of a Standard Schema (Zod/TypeBox/Valibot compatible).
 */
export type InferSchemaOutput<S> = S extends StandardSchemaV1<any, infer TOutput>
  ? TOutput
  : S extends { _output: infer TOutput } // Zod compatibility fallback
    ? TOutput
    : any

// Helper to look up a relic by its string name name in a list
type FindInList<List extends any[], Name extends string> = List extends [infer Head, ...infer Tail]
  ? Head extends ProvidingRelic<Name, infer T>
    ? T
    : FindInList<Tail, Name>
  : never

/**
 * Extract the type of a specific named relic from single relic or relic group input.
 */
export type ExtractFromRelics<R, Name extends string> = R extends RelicGroup<infer RelicsList, any>
  ? FindInList<RelicsList, Name>
  : R extends ProvidingRelic<Name, infer T>
    ? T
    : never
