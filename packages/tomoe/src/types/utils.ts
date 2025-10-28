/**
 * Type Utilities for Tomoe
 *
 * These utitilies improve Typescript's type display and manipulation.
 * All types are runtime only
 */

/**
 * Prettify - Flatten intersection types for better IDE tooltips
 *
 * Example:
 *    type NotPretty = {a: string} & {b: string} & {c: string}
 *    // Hover shows : {a: string} & {b: string} & {c: string}
 *
 *    type Pretty = Prettify<NotPretty>
 *    // Hover shows: {a: string; b: string; c: string}
 */

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * UnionToIntersection - converts union type to intersection.
 *
 * Example:
 *    type Union = {a: string} | {b: string} | {c: string}
 *    type Intersect = UnionToIntersection<Union>
 *    // Result : {a: string} & {b: string} & {c: string}
 */

export type UnionToIntersection<T> = (
  T extends any ? (x: T) => void : never
) extends (x: infer U) => void
  ? U
  : never;

/**
 * Simplify - Remove never types from object.
 *
 * Example:
 *    type WithNever = {a: string; b: string; c: never}
 *    type Clean = Simplify<WithNever>
 *      // Result : { a: string; b: string}
 */

export type Simplify<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

/**
 * Merge - Deep Merge two object types.
 *
 * Example:
 *    type A = {a: string; b: string;}
 *    type B = {c: string; d: string;}
 *
 *    type C = Merge<A, B>
 *      // Result : { a: string; b: string; c: string; d: string;}
 */

export type Merge<T, U> = Prettify<T & U>;

/**
 * IsNever - check if type is never.
 *
 * Example:
 *    type A = IsNever<never> // true
 *    type A = IsNever<string> // false
 */

export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * IsAny - Check if type is any
 *
 * How it works:
 * - `0 extends 1 & T` is only true when T is any
 * - This exploits how `any` breaks type system rules
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;
