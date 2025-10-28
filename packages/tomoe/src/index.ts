/**
 * Tomoe — The art of perfect balance
 *
 * Built on web standards for univeral runtime support
 *
 * @example
 * ```
 * import {Tomoe} from 'tomoe'
 *
 * const app = new Tomoe()
 *
 * app.get('/', (c) => c.text("Moonlit Fantasy"))
 *
 * export default app // for cloudflare workers
 *
 * ````
 */

// Core exports
export { Context } from "./context";
export type { Env, ExecutionContext } from "./context";

// Type utilities
export type {
  Prettify,
  Merge,
  Simplify,
  UnionToIntersection,
  IsNever,
  IsAny,
} from "./types/utils";

export type {
  ExtractParams,
  ParamsObject,
  HasWildcard,
  IsStaticPath,
} from "./types/inference";

// TODO: Export Tomoe class
// export { Tomoe } from "./tomoe"

// TODO: Export Router
// export { Router } from "./router"

// Package version (for debugging)
export const VERSION = "0.1.0";
