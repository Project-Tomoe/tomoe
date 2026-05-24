import type { Middleware } from "../router/router"

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean | Promise<boolean>)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

/**
 * Highly configurable CORS middleware.
 * Automatically handles OPTIONS preflight and adds CORS headers to responses.
 */
export function cors(options: CorsOptions = {}): Middleware {
  return async (c, next) => {
    const originHeader = c.req.headers.get("Origin")

    // Determine allowed origin
    let allowedOrigin = "*"
    if (options.origin) {
      if (typeof options.origin === "string") {
        allowedOrigin = options.origin
      } else if (Array.isArray(options.origin)) {
        if (originHeader && options.origin.includes(originHeader)) {
          allowedOrigin = originHeader
        } else {
          allowedOrigin = options.origin[0] || "*"
        }
      } else if (typeof options.origin === "function") {
        if (originHeader) {
          const ok = await options.origin(originHeader)
          if (ok) {
            allowedOrigin = originHeader
          } else {
            allowedOrigin = "null"
          }
        }
      }
    } else if (originHeader) {
      allowedOrigin = originHeader
    }

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": allowedOrigin,
    }

    if (options.credentials) {
      corsHeaders["Access-Control-Allow-Credentials"] = "true"
    }

    if (options.methods) {
      corsHeaders["Access-Control-Allow-Methods"] = options.methods.join(", ")
    } else {
      corsHeaders["Access-Control-Allow-Methods"] = "GET, HEAD, PUT, PATCH, POST, DELETE"
    }

    if (options.allowedHeaders) {
      corsHeaders["Access-Control-Allow-Headers"] = options.allowedHeaders.join(", ")
    } else {
      const requestedHeaders = c.req.headers.get("Access-Control-Request-Headers")
      if (requestedHeaders) {
        corsHeaders["Access-Control-Allow-Headers"] = requestedHeaders
      }
    }

    if (options.exposedHeaders) {
      corsHeaders["Access-Control-Expose-Headers"] = options.exposedHeaders.join(", ")
    }

    if (options.maxAge !== undefined) {
      corsHeaders["Access-Control-Max-Age"] = String(options.maxAge)
    }

    // Handle OPTIONS preflight request
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    // Run next middleware/handler
    const res = await next()

    // Copy CORS headers to the response
    const newHeaders = new Headers(res.headers)
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value)
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    })
  }
}
