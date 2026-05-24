import type { Middleware } from "../router/router";

export interface CsrfOptions {
  origin?: string | string[];
}

/**
 * Host-matching CSRF protection middleware for state-changing requests.
 * Blocks POST, PUT, DELETE, PATCH requests if the Origin/Referer header does not match host or allowed origins.
 */
export function csrf(options: CsrfOptions = {}): Middleware {
  return async (c, next) => {
    const method = c.req.method;
    
    // GET, HEAD, OPTIONS are safe methods and do not require CSRF checks
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return next();
    }

    const origin = c.header("Origin");
    const referer = c.header("Referer");
    const host = c.header("Host") || new URL(c.req.url).host;

    let targetOrigin = origin;
    if (!targetOrigin && referer) {
      try {
        targetOrigin = new URL(referer).host;
      } catch (e) {
        // Fallback if referer parsing fails
      }
    }

    if (!targetOrigin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: CSRF check failed (Missing Origin/Referer)" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    let allowed = false;
    if (options.origin) {
      const allowedOrigins = Array.isArray(options.origin) ? options.origin : [options.origin];
      allowed = allowedOrigins.some((o) => {
        try {
          return new URL(o).host === targetOrigin || o === targetOrigin;
        } catch {
          return o === targetOrigin;
        }
      });
    } else {
      // Default: verify host
      try {
        const hostName = host.split(":")[0];
        const originName = targetOrigin.replace(/^https?:\/\//, "").split(":")[0];
        allowed = hostName === originName;
      } catch {
        allowed = false;
      }
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Forbidden: CSRF check failed (Invalid Origin)" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    return next();
  };
}
