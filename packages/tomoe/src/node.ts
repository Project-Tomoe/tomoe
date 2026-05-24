import { createServer as httpCreateServer } from "node:http"
import { Readable } from "node:stream"
import type { Router } from "./router/router"

/**
 * Creates a standard Node.js HTTP server configured to run the Tomoe application.
 * Bridges Node.js Stream-based req/res to Web Standard Request/Response.
 *
 * @example
 * import { Tomoe } from "tomoejs"
 * import { createServer } from "tomoejs/node"
 *
 * const app = new Tomoe()
 * createServer(app).listen(3000)
 */
export function createServer(app: Router<any, any>) {
  return httpCreateServer(async (req, res) => {
    try {
      const method = req.method || "GET"
      const host = req.headers.host || "localhost"
      const protocol = (req.socket as any).encrypted ? "https" : "http"
      const url = `${protocol}://${host}${req.url}`

      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue
        if (Array.isArray(value)) {
          for (const v of value) {
            headers.append(key, v)
          }
        } else {
          headers.append(key, value)
        }
      }

      const hasBody = method !== "GET" && method !== "HEAD"

      const webReq = new Request(url, {
        method,
        headers,
        body: hasBody ? (Readable.toWeb(req) as any) : null,
        duplex: hasBody ? "half" : undefined,
      } as any)

      const webRes = await app.fetch(webReq)

      res.statusCode = webRes.status
      if (webRes.statusText) {
        res.statusMessage = webRes.statusText
      }

      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })

      if (webRes.body) {
        Readable.fromWeb(webRes.body as any).pipe(res)
      } else {
        res.end()
      }
    } catch (err) {
      console.error("[Tomoe Node Server Error]:", err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify({ error: "Internal Server Error" }))
      }
    }
  })
}
