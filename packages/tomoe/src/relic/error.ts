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

import { LazyResponse } from "../lazy-response"

export class HttpError extends Error {
  readonly status: number
  readonly details?: any

  constructor(status: number, message?: string, details?: any) {
    super(message ?? defaultMessage(status))
    this.name = "HttpError"
    this.status = status
    this.details = details
  }

  toResponse(): Response {
    const body = this.details ? { error: this.message, ...this.details } : { error: this.message }
    const bodyStr = JSON.stringify(body)
    const len = new TextEncoder().encode(bodyStr).length
    const useLazyResponse =
      typeof process !== "undefined" &&
      process.versions &&
      process.versions.node &&
      !(process.versions as any).bun

    let res: any
    if (useLazyResponse) {
      res = new LazyResponse(bodyStr, {
        status: this.status,
      })
      res._bodyStr = bodyStr
      res._rawHeaders = {
        "content-type": "application/json; charset=utf-8",
        "content-length": len.toString(),
      }
    } else {
      res = new Response(bodyStr, {
        status: this.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": len.toString(),
        },
      })
      res._bodyStr = bodyStr
    }
    return res
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
export const BadRequest = httpError(400)
export const Unauthorized = httpError(401)
export const PaymentRequired = httpError(402)
export const Forbidden = httpError(403)
export const NotFound = httpError(404)
export const MethodNotAllowed = httpError(405)
export const NotAcceptable = httpError(406)
export const RequestTimeout = httpError(408)
export const Conflict = httpError(409)
export const Gone = httpError(410)
export const PayloadTooLarge = httpError(413)
export const UnsupportedMediaType = httpError(415)
export const UnprocessableEntity = httpError(422)
export const TooManyRequests = httpError(429)
export const ServerError = httpError(500)
export const NotImplemented = httpError(501)
export const BadGateway = httpError(502)
export const ServiceUnavailable = httpError(503)
export const GatewayTimeout = httpError(504)

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
