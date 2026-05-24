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

    // X-Forwarded-Host support for reverse proxies (like Cloudflare, ALB, Nginx)
    const forwardedHost = c.header("X-Forwarded-Host")?.split(",")[0]?.trim();
    const host = forwardedHost || c.header("Host") || new URL(c.req.url).host;

    let targetHost = "";
    if (origin) {
      try {
        targetHost = new URL(origin).hostname;
      } catch {
        targetHost = origin.replace(/^https?:\/\//i, "").split(":")[0] || "";
      }
    } else if (referer) {
      try {
        targetHost = new URL(referer).hostname;
      } catch {
        targetHost = referer.replace(/^https?:\/\//i, "").split(":")[0] || "";
      }
    }

    if (!targetHost) {
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
        if (o === "*") return true;
        let allowedHost = "";
        try {
          if (/^https?:\/\//i.test(o)) {
            allowedHost = new URL(o).hostname;
          } else {
            allowedHost = new URL(`http://${o}`).hostname;
          }
        } catch {
          allowedHost = o.replace(/^https?:\/\//i, "").split(":")[0] || "";
        }
        return allowedHost === targetHost;
      });
    } else {
      // Default: verify host
      try {
        let hostName = "";
        if (/^https?:\/\//i.test(host)) {
          hostName = new URL(host).hostname;
        } else {
          hostName = new URL(`http://${host}`).hostname;
        }
        allowed = hostName === targetHost;
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
