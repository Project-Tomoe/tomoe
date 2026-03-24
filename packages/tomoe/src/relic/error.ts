/**
 * HttpError - First-class typed errors for Relics
 *
 * Errors are defined once and carry their own HTTP semantics.
 * The framework handles them automatically — you only write onError()
 * when you want non-default behavior (e.g. redirect instead of JSON).
 *
 * @example
 * const Unauthorized = httpError(401)
 * const Forbidden    = httpError(403)
 *
 * // In a relic:
 * if (!user) return err(Unauthorized)
 *
 * Framework automatically responds: { error: "Unauthorized" } with 401
 * No onError() needed unless you want custom behavior
 */

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message?: string) {
        super(message ?? defaultMessage(status));
        this.name = "HttpError";
        this.status = status;
    }

    toResponse(): Response {
        return new Response(
            JSON.stringify({ error: this.message }),
            {
                status: this.status,
                headers: { "Content-Type": "application/json; charset=utf-8" },
            }
        )    
    }
}

/**
 * Create an HttpError instance.
 *
 * @example
 * const Unauthorized = httpError(401)
 * const Forbidden    = httpError(403, "You are forbidden to enter here")
 */
export function httpError(status: number, message?: string): HttpError {
  return new HttpError(status, message)
}

/**
 * Common pre-built errors - import and use directly
 */
export const Unauthorized = httpError(401)
export const Forbidden    = httpError(403)
export const NotFound     = httpError(404)
export const BadRequest   = httpError(400)
export const Conflict     = httpError(409)
export const ServerError  = httpError(500)

function defaultMessage(status: number): string {
  const messages: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  }
  return messages[status] ?? `HTTP Error ${status}`
}