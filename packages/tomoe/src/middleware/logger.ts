import type { Middleware } from "../router/router"

/**
 * Clean terminal-colorized request logging middleware.
 * Measures and prints: [Tomoe] METHOD PATHNAME - STATUS (DURATIONms)
 */
export function logger(): Middleware {
  return async (c, next) => {
    const start = Date.now()
    const { method, url } = c.req

    let pathname = "/"
    try {
      pathname = new URL(url).pathname
    } catch (e) {
      // Fallback if URL parsing fails for relative/mock requests
    }

    try {
      const res = await next()
      const duration = Date.now() - start
      const status = res.status

      let statusColor = "\x1b[32m" // Green (2xx)
      if (status >= 500) {
        statusColor = "\x1b[31m" // Red (5xx)
      } else if (status >= 400) {
        statusColor = "\x1b[33m" // Yellow (4xx)
      } else if (status >= 300) {
        statusColor = "\x1b[36m" // Cyan (3xx)
      }

      console.log(
        `  \x1b[1;30m[Tomoe]\x1b[0m ${method} ${pathname} - ${statusColor}${status}\x1b[0m \x1b[90m(${duration}ms)\x1b[0m`
      )
      return res
    } catch (err) {
      const duration = Date.now() - start
      console.log(
        `  \x1b[1;30m[Tomoe]\x1b[0m ${method} ${pathname} - \x1b[31m500\x1b[0m \x1b[90m(${duration}ms - Thrown Error)\x1b[0m`
      )
      throw err
    }
  }
}
