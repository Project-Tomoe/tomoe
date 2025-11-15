/**
 * Bun Server Adapter
 *
 * Thin wrapper around Bun.serve() for Tomoe application.
 */

import type { Router } from "tomoe";
import type { Server, TLSOptions } from "bun";

/** Serve options */
export interface ServeOptions {
  /**
   * Port to listen on
   * @default 3000
   */
  port?: number;

  /**
   * Hostname to bind to
   * @default 0.0.0.0
   */
  hostname?: string;

  /**
   * TLS configuration for HTTPS
   */
  tls?: TLSOptions;

  /**
   * Development mode (more verbose loggin)
   * @default false
   */
  development?: boolean;

  /**
   * Maximum body request size
   * @default undefined (no limit)
   */
  maxRequestBodySize?: number;
}

/**
 * Serve Tomoe application on Bun
 * @param app - Tomoe application instance
 * @param options - Server options
 * @returns Bun server instance
 */
export function serve(
  app: Router,
  options: ServeOptions = {},
): Server<undefined> {
  const {
    port = 3000,
    development = false,
    maxRequestBodySize,
    hostname = "0.0.0.0",
    tls,
  } = options ?? {};

  return Bun.serve({
    port,
    hostname,
    ...(tls && { tls }),
    development,
    ...(maxRequestBodySize !== undefined && { maxRequestBodySize }),
    async fetch(request: Request): Promise<Response> {
      return app.fetch(request);
    },
  });
}

/**
 * Stop Bun server
 *
 * @param server - Bun Server instance
 * @param force - Force immediate shutdown
 */
export async function stop(
  server: Server<undefined>,
  force = false,
): Promise<void> {
  server.stop(force);
}
