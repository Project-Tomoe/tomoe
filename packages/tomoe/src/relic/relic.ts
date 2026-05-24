import type { InferSchemaOutput, StandardSchemaV1 } from "../types/standard-schema"
import { HttpError } from "./error"
import type { Err } from "./result"
import { err } from "./result"

/**
 * The `use` resolver passed into relic and guard functions.
 * Calling use(Relic) resolves the value from that relic in the chain.
 */
export type UseResolver = <T>(relic: ProvidingRelic<any, T>) => T

/**
 * Base context available inside every relic and guard function.
 */
export interface RelicBaseCtx {
  req: Request
  /** Get request header (case-insensitive) */
  header(name: string): string | null
  /** Get a request cookie by name */
  cookie(name: string): string | undefined
  /** Get query parameter from URL */
  query(key: string): string | undefined
  /** Get all query parameters as an object */
  queries: Record<string, string>
}

/**
 * The function signature for a providing relic.
 */
export type ProvidingRelicFn<T> = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => T | Err | Promise<T | Err>

/**
 * The function signature for a guard relic.
 */
export type GuardRelicFn = (
  ctx: RelicBaseCtx,
  use: UseResolver
) => undefined | Err | Promise<undefined | Err>

export interface ProvidingRelic<Name extends string, T> {
  readonly _kind: "providing"
  readonly _id: symbol
  readonly name: Name
  readonly fn: ProvidingRelicFn<T>
}

export interface GuardRelic {
  readonly _kind: "guard"
  readonly _id: symbol
  readonly name: string
  readonly fn: GuardRelicFn
}

export type AnyRelic = ProvidingRelic<any, any> | GuardRelic

export interface RelicFactory {
  /** Create an anonymous providing relic — runs fn, provides value accessed via relic reference. */
  <T>(fn: ProvidingRelicFn<T>): ProvidingRelic<never, T>
  /** Create a named providing relic — runs fn, binds return value to a context property. */
  <Name extends string, T>(name: Name, fn: ProvidingRelicFn<T>): ProvidingRelic<Name, T>

  /** Validate JSON request body. Injects parsed value into ctx.body. */
  body<S extends StandardSchemaV1>(schema: S): ProvidingRelic<"body", InferSchemaOutput<S>>
  /** Validate URL query parameters. Injects parsed value into ctx.query. */
  query<S extends StandardSchemaV1>(schema: S): ProvidingRelic<"query", InferSchemaOutput<S>>
  /** Validate route path parameters. Injects parsed value into ctx.params. */
  params<S extends StandardSchemaV1>(schema: S): ProvidingRelic<"params", InferSchemaOutput<S>>
  /** Validate request headers. Injects parsed value into ctx.headers. */
  headers<S extends StandardSchemaV1>(schema: S): ProvidingRelic<"headers", InferSchemaOutput<S>>
}

const relicImpl = (<Name extends string, T>(
  nameOrFn: Name | ProvidingRelicFn<T>,
  fn?: ProvidingRelicFn<T>
): AnyRelic => {
  if (typeof nameOrFn === "function") {
    return {
      _kind: "providing",
      _id: Symbol("anonymous_relic"),
      name: "" as any,
      fn: nameOrFn,
    }
  }

  if (!fn) {
    throw new Error("relic(name, fn): fn is required when name is provided.")
  }

  return {
    _kind: "providing",
    _id: Symbol(nameOrFn),
    name: nameOrFn,
    fn,
  }
}) as any

async function validateSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
  source: string
) {
  if (schema && typeof schema === "object" && "~standard" in schema) {
    const result = await schema["~standard"].validate(value)
    if (result.issues && result.issues.length > 0) {
      return err(
        new HttpError(400, `Validation Failed (${source})`, {
          issues: result.issues.map((i) => ({
            message: i.message,
            path: i.path?.map((p) => (typeof p === "object" ? p.key : p)) || [],
          })),
        })
      )
    }
    return result.value
  }

  if (
    schema &&
    typeof schema === "object" &&
    "safeParse" in schema &&
    typeof (schema as any).safeParse === "function"
  ) {
    const result = await (schema as any).safeParse(value)
    if (!result.success) {
      return err(
        new HttpError(400, `Validation Failed (${source})`, {
          issues: result.error.issues.map((i: any) => ({
            message: i.message,
            path: i.path || [],
          })),
        })
      )
    }
    return result.data
  }

  // TypeBox raw schema fallback (check for TypeBox hints/keys)
  if (
    schema &&
    typeof schema === "object" &&
    ("type" in schema || Symbol.for("TypeBox.Kind") in schema)
  ) {
    try {
      const { Value } = await import("@sinclair/typebox/value")
      const errors = [...Value.Errors(schema, value)]
      if (errors.length > 0) {
        return err(
          new HttpError(400, `Validation Failed (${source})`, {
            issues: errors.map((e) => ({
              message: e.message,
              path: e.path ? e.path.split("/").filter(Boolean) : [],
            })),
          })
        )
      }
      return Value.Clean(schema, value)
    } catch (e) {
      // TypeBox not loaded or value module missing
    }
  }

  throw new Error(
    `Invalid schema passed to relic.${source}(). Must conform to Standard Schema or Zod interface.`
  )
}

function formDataToObject(formData: FormData): Record<string, any> {
  const obj: Record<string, any> = {}
  for (const [key, value] of formData.entries()) {
    if (key in obj) {
      const existing = obj[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        obj[key] = [existing, value]
      }
    } else {
      obj[key] = value
    }
  }
  return obj
}

export const relic: RelicFactory = Object.assign(relicImpl, {
  body<S extends StandardSchemaV1>(schema: S) {
    const rel = relicImpl("body", async (ctx: RelicBaseCtx) => {
      try {
        const contentType = ctx.req.headers.get("Content-Type") || ""
        let raw: unknown

        if (contentType.includes("application/json")) {
          raw = await ctx.req.clone().json()
        } else if (
          contentType.includes("multipart/form-data") ||
          contentType.includes("application/x-www-form-urlencoded")
        ) {
          const fd = await ctx.req.clone().formData()
          raw = formDataToObject(fd)
        } else {
          try {
            raw = await ctx.req.clone().json()
          } catch {
            raw = {}
          }
        }
        return validateSchema(schema, raw, "body")
      } catch (e) {
        return err(
          new HttpError(400, `Invalid body payload: ${e instanceof Error ? e.message : String(e)}`)
        )
      }
    })
    ;(rel as any).schema = schema
    return rel as any
  },
  query<S extends StandardSchemaV1>(schema: S) {
    const rel = relicImpl("query", async (ctx: RelicBaseCtx) => {
      const url = new URL(ctx.req.url)
      const raw: Record<string, string | string[]> = {}
      for (const [key, value] of url.searchParams.entries()) {
        if (key in raw) {
          const existing = raw[key]
          if (Array.isArray(existing)) {
            existing.push(value)
          } else {
            raw[key] = [existing as string, value]
          }
        } else {
          raw[key] = value
        }
      }
      return validateSchema(schema, raw, "query")
    })
    ;(rel as any).schema = schema
    return rel as any
  },
  params<S extends StandardSchemaV1>(schema: S) {
    const rel = relicImpl("params", async (ctx: RelicBaseCtx) => {
      const raw = (ctx as any).params || {}
      return validateSchema(schema, raw, "params")
    })
    ;(rel as any).schema = schema
    return rel as any
  },
  headers<S extends StandardSchemaV1>(schema: S) {
    const rel = relicImpl("headers", async (ctx: RelicBaseCtx) => {
      const raw: Record<string, string> = {}
      ctx.req.headers.forEach((value: string, key: string) => {
        raw[key] = value
      })
      return validateSchema(schema, raw, "headers")
    })
    ;(rel as any).schema = schema
    return rel as any
  },
})

/**
 * Create a guard relic — validates a condition, provides no value.
 */
export function guard(fn: GuardRelicFn): GuardRelic {
  return {
    _kind: "guard",
    _id: Symbol(fn.name || "anonymous_guard"),
    name: fn.name || "anonymous_guard",
    fn,
  }
}

/** Extract the type provided by a ProvidingRelic */
export type RelicProvides<R extends AnyRelic> = R extends ProvidingRelic<any, infer T> ? T : never
