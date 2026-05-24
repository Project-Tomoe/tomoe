import type { AnyRelic, ProvidingRelic } from "./relic";
import { isErr } from "./result";
import { HttpError } from "./error";

/**
 * Minimal context the executor needs from the request.
 * Decoupled from the full Context class so executor stays testable.
 */
export interface ExecutorCtx {
  req: Request;
  _setRelic(id: symbol, value: any): void;
  _setRelicByName(name: string, value: any): void;
  _getRelic(id: symbol): any;
}

/**
 * Execute a relic chain against the current request context.
 *
 * Returns:
 *  - null   if all relics passed
 *  - HttpError if any relic returned err() or threw
 *
 * On success, all provided values are stored in ctx via _setRelic() and _setRelicByName().
 */
export async function executeRelics(
  relics: AnyRelic[],
  ctx: ExecutorCtx
): Promise<HttpError | null> {
  for (const rel of relics) {
    // Build the use() resolver for this relic
    const use = <T>(targetRelic: ProvidingRelic<any, T>): T => {
      const value = ctx._getRelic(targetRelic._id);

      if (value === undefined) {
        throw new Error(
          `Relic dependency error: "${rel.name || "anonymous"}" called use() on relic ` +
          `"${targetRelic.name || "anonymous"}" but no relic in the chain provides it. ` +
          `Make sure that relic appears before "${rel.name || "anonymous"}" in the chain.`
        );
      }

      return value as T;
    };

    try {
      const result = await rel.fn(ctx as any, use);

      // Guard relics return void on success — nothing to store
      if (rel._kind === "guard") {
        if (isErr(result)) {
          return result.error;
        }
        continue;
      }

      // Providing relic returned an error
      if (isErr(result)) {
        return result.error;
      }

      // Providing relic succeeded — store value by relic id and name
      ctx._setRelic(rel._id, result);
      if (rel.name) {
        ctx._setRelicByName(rel.name, result);
      }
    } catch (e) {
      // If a relic throws an HttpError directly, treat it as err()
      if (e instanceof HttpError) {
        return e;
      }

      // Unexpected error — rethrow so the router's error handler catches it
      throw e;
    }
  }

  return null;
}

/**
 * Validate a relic chain at startup (called during compile()).
 * Checks for duplicate name/identity provision.
 *
 * Returns array of error strings — empty means valid.
 */
export function validateRelicChain(
  relics: AnyRelic[],
  scopePath: string
): string[] {
  const errors: string[] = [];
  const provided = new Set<symbol>();
  const names = new Set<string>();

  for (const rel of relics) {
    if (rel._kind === "providing") {
      const relicId = rel._id;

      if (provided.has(relicId)) {
        errors.push(
          `[${scopePath}] Relic with same identity is declared multiple times.`
        );
      }
      provided.add(relicId);

      if (rel.name) {
        if (names.has(rel.name)) {
          errors.push(
            `[${scopePath}] Property name "${rel.name}" is provided by multiple relics. ` +
            `Each name must be uniquely provided.`
          );
        }
        names.add(rel.name);
      }
    }
  }

  return errors;
}