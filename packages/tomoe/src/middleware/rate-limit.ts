import type { Middleware } from "../router/router";
import type { Context } from "../context";

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds (default: 1 min)
  max?: number;      // Max requests per window (default: 60)
  keyGenerator?: (c: Context) => string;
}

/**
 * Sliding-window in-memory Rate Limiting middleware.
 * Exposes standard rate-limiting headers and responds with 429 on limit breaches.
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 60;
  const keyGenerator = options.keyGenerator || ((c) => {
    return c.header("CF-Connecting-IP") ||
           c.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
           c.header("X-Real-IP") ||
           "global";
  });

  const hits = new Map<string, number[]>();

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let timestamps = hits.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - timestamps[0]!)) / 1000);
      return new Response(
        JSON.stringify({ error: "Too Many Requests" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    timestamps.push(now);
    hits.set(key, timestamps);

    const res = await next();

    res.headers.set("X-RateLimit-Limit", String(max));
    res.headers.set("X-RateLimit-Remaining", String(max - timestamps.length));

    return res;
  };
}
