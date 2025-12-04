/**
 * Type Inference Utilities for Path Parameters.
 *
 * These types extract paramters name from route path strings
 * Enabling full type safety without manual type annotation (at compile time)
 */

import type { Prettify } from "./utils";

/**
 * ExtractPathParam - Extract a single paramter name from path segment
 *
 * Handles three cases
 *  1. `:param/more` - Paramter followed by slash
 *  2. `:param` - Paramter at the end of path
 *  3. No paramter - Returns never
 */

type ExtractPathParam<Path extends string> =
  Path extends `${string}:${infer Param}/${string}`
    ? Param
    : Path extends `${string}:${infer Param}`
      ? Param
      : never;

/**
 * ExtractParams - Recursively extracts all paramters from path
 *
 * Uses tail recursion to process path segment from left-to-right
 *
 * Complexity: 0(n) where n = number of path segments.
 */

export type ExtractParams<
  Path extends string,
  Acc extends string = never,
> = Path extends `${infer Before}:${infer Param}/${infer After}`
  ? ExtractParams<After, Acc | Param>
  : Path extends `${string}:${infer Param}`
    ? Acc | Param
    : Acc;

/**
 * ParamObject - Comvert param union to object type.
 *
 * Transform: "id" | "userId" -> {id: string; userId: string}
 *
 * note: if no params, returns {} (empty object)
 */

export type ParamsObject<Path extends string> =
  ExtractParams<Path> extends never
    ? {}
    : Prettify<{
        [K in ExtractParams<Path>]: string;
      }>;

/**
 * ExtractWildcard - Check if path has wildcard (*) segment
 *
 * Returns true if path contains *, false otherwise.
 * Used for wildcard route matching (e.g., /static/*)
 */
export type HasWildcard<Path extends string> =
  Path extends `${string}*${string}` ? true : false;

/**
 * IsStaticPath - Check if path has no dynamic segments
 *
 * Returns true if path has no :params and no *.
 * Static paths can use fast hash-map lookup.
 */
export type IsStaticPath<Path extends string> =
  ExtractParams<Path> extends never
    ? HasWildcard<Path> extends false
      ? true
      : false
    : false;
