import type { Router, RouteRecord } from "./router/router";
import type { IsNever } from "./types/utils";

export type Client<Routes extends Record<string, Record<string, RouteRecord>>> = <
  Path extends keyof Routes & string
>(
  path: Path
) => {
  [Method in keyof Routes[Path] & string as Lowercase<Method>]: (
    options: {
      params?: Routes[Path][Method]["params"];
      query?: Routes[Path][Method]["query"];
      headers?: Routes[Path][Method]["headers"];
      body?: Routes[Path][Method]["body"];
    } & (IsNever<Routes[Path][Method]["body"]> extends true ? {} : { body: Routes[Path][Method]["body"] })
      & (IsNever<Routes[Path][Method]["params"]> extends true ? {} : { params: Routes[Path][Method]["params"] })
  ) => Promise<{
    data: Routes[Path][Method]["response"] extends { __type?: infer T }
      ? T
      : any;
    error: any;
    status: number;
  }>;
};

/**
 * Create an E2E type-safe client connected to your Tomoe server instance.
 *
 * @example
 * const client = createClient<AppRouter>("http://localhost:3000")
 * const { data } = await client("/user/:id").get({ params: { id: "1" } })
 */
export function createClient<R extends Router<any, any>>(
  baseUrl: string
): Client<R extends Router<any, infer Routes> ? Routes : {}> {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return ((path: string) => {
    return new Proxy(
      {},
      {
        get(_, method: string) {
          return async (options: any = {}) => {
            const httpMethod = method.toUpperCase();

            // Replace path parameters (e.g. "/user/:id" -> "/user/1")
            let urlPath = path;
            if (options.params) {
              for (const [key, value] of Object.entries(options.params)) {
                urlPath = urlPath.replace(`:${key}`, String(value));
              }
            }

            // Build query parameters
            let url = `${normalizedBase}${urlPath}`;
            if (options.query) {
              const searchParams = new URLSearchParams();
              for (const [key, value] of Object.entries(options.query)) {
                if (value !== undefined) {
                  if (Array.isArray(value)) {
                    for (const v of value) {
                      searchParams.append(key, String(v));
                    }
                  } else {
                    searchParams.append(key, String(value));
                  }
                }
              }
              const queryStr = searchParams.toString();
              if (queryStr) {
                url += `?${queryStr}`;
              }
            }

            // Build request headers & body
            const headers = new Headers(options.headers || {});
            let body: any = undefined;

            if (options.body) {
              body = JSON.stringify(options.body);
              headers.set("Content-Type", "application/json");
            }

            try {
              const res = await fetch(url, {
                method: httpMethod,
                headers,
                body,
              });

              let data: any = null;
              const contentType = res.headers.get("Content-Type");
              if (contentType && contentType.includes("application/json")) {
                data = await res.json();
              } else {
                data = await res.text();
              }

              if (!res.ok) {
                return {
                  data: null,
                  error: data || res.statusText,
                  status: res.status,
                };
              }

              return {
                data,
                error: null,
                status: res.status,
              };
            } catch (err: any) {
              return {
                data: null,
                error: err.message || err,
                status: 500,
              };
            }
          };
        },
      }
    );
  }) as any;
}
