/**
 * Type inference tests
 *
 * These tests verify Typescript's type inference works correctly.
 * They use `expectTypeOf` from Vitest to assert types at compile-time.
 */

import { describe, expectTypeOf, it } from "vitest"
import { relic, unite } from "../../../src"
import type { ExtractParams, HasWildcard, IsStaticPath, ParamsObject } from "../../../src"
import type { GroupContext } from "../../../src/relic/unite"

describe("ExtractParams", () => {
  it("should extract no params from static path ", () => {
    type Result = ExtractParams<"/tomoe">
    expectTypeOf<Result>().toEqualTypeOf<never>()
  })

  it("should extract single param", () => {
    type Result = ExtractParams<"/isekai/:isekaiName">
    expectTypeOf<Result>().toEqualTypeOf<"isekaiName">()
  })

  it("should extract multiple params", () => {
    type Result = ExtractParams<"/isekai/:isekaiName/heroes/:heroName">
    expectTypeOf<Result>().toEqualTypeOf<"isekaiName" | "heroName">()
  })

  it("should extract param at start", () => {
    type Result = ExtractParams<"/:heroName">
    expectTypeOf<Result>().toEqualTypeOf<"heroName">()
  })

  it("should extract param at end without trailing slash", () => {
    type Result = ExtractParams<"/heroes/:heroName">
    expectTypeOf<Result>().toEqualTypeOf<"heroName">
  })

  it("should handle param with trailing slash", () => {
    type Result = ExtractParams<"/stats/:statsId/">
    expectTypeOf<Result>().toEqualTypeOf<"statsId">()
  })

  it("should handle complex path and extract params", () => {
    type Result = ExtractParams<"api/v1/isekai/:isekaiName/heroes/:heroName/stats/:statsId">

    expectTypeOf<Result>().toEqualTypeOf<"isekaiName" | "heroName" | "statsId">()
  })
})

describe("ParamsObject", () => {
  it("should return empty object for static path", () => {
    type Result = ParamsObject<"/tomoe">
    expectTypeOf<Result>().toEqualTypeOf<Record<never, never>>()
  })

  it("should create object with single param", () => {
    type Result = ParamsObject<"isekai/:isekaiName">
    expectTypeOf<Result>().toEqualTypeOf<{ isekaiName: string }>()
  })

  it("should create object with multiple params", () => {
    type Result = ParamsObject<"heroes/:heroName/stats/:statsId">
    expectTypeOf<Result>().toEqualTypeOf<{
      heroName: string
      statsId: string
    }>()
  })

  it("should handle complex nested path", () => {
    type Result = ParamsObject<"api/v1/isekai/:isekaiName/heroes/:heroName/stats/:statsId">
    expectTypeOf<Result>().toEqualTypeOf<{
      isekaiName: string
      heroName: string
      statsId: string
    }>()
  })
})

describe("IsStaticPath", () => {
  it("should return true for static path", () => {
    type Result = IsStaticPath<"/tomoe">
    expectTypeOf<Result>().toEqualTypeOf<true>()
  })

  it("should return false for dynamic path (path with param)", () => {
    type Result = IsStaticPath<"/isekai/:isekaiName">
    expectTypeOf<Result>().toEqualTypeOf<false>()
  })

  it("should return false for wildcard path", () => {
    type Result = IsStaticPath<"/anime/*">
    expectTypeOf<Result>().toEqualTypeOf<false>()
  })
})

describe("HasWildcard", () => {
  it("should return true for path with wildcard", () => {
    type Result = HasWildcard<"/anime/*">
    expectTypeOf<Result>().toEqualTypeOf<true>()
  })

  it("should return true for path with wildcard in the middle", () => {
    type Result = HasWildcard<"/anime/*/download">
    expectTypeOf<Result>().toEqualTypeOf<true>()
  })

  it("should return false for path without wildcard", () => {
    type Result = HasWildcard<"/stats/:statsId">
    expectTypeOf<Result>().toEqualTypeOf<false>()
  })
})

describe("Nested unite() inference", () => {
  it("should merge context from nested relic groups", () => {
    const authRelic = relic("user", async () => ({ id: "u1" }))
    const dbRelic = relic("db", async () => ({ connected: true }))
    const queryRelic = relic("query", async () => ({ genre: "sci-fi" }))

    const memberAccess = unite(authRelic, dbRelic)
    const routeAccess = unite(memberAccess, queryRelic)

    expectTypeOf<GroupContext<typeof routeAccess>>().toEqualTypeOf<{
      user: { id: string }
      db: { connected: boolean }
      query: { genre: string }
    }>()
  })
})
