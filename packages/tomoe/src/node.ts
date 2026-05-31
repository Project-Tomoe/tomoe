import { createServer as httpCreateServer } from "node:http"
import { Readable } from "node:stream"
import type { Router } from "./router/router"

let cachedWebSocketServer: any = null

class NodeRequest {
  public method: string
  public url: string
  private _req: any
  private _headers: Headers | null = null
  private _rawReq: Request | null = null

  constructor(url: string, method: string, req: any) {
    this.url = url
    this.method = method
    this._req = req
  }

  get headers() {
    if (!this._headers) {
      this._headers = new Headers(this._req.headers as any)
    }
    return this._headers
  }

  clone() {
    return this.raw.clone()
  }

  get body() {
    return this.raw.body
  }

  get bodyUsed() {
    return this._rawReq ? this._rawReq.bodyUsed : false
  }

  get signal() {
    return this.raw.signal
  }

  json() {
    return this.raw.json()
  }

  text() {
    return this.raw.text()
  }

  arrayBuffer() {
    return this.raw.arrayBuffer()
  }

  formData() {
    return this.raw.formData()
  }

  blob() {
    return this.raw.blob()
  }

  get raw(): Request {
    if (!this._rawReq) {
      const hasBody = this.method !== "GET" && this.method !== "HEAD"
      this._rawReq = new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: hasBody ? (Readable.toWeb(this._req) as any) : null,
        duplex: hasBody ? "half" : undefined,
      } as any)
    }
    return this._rawReq
  }
}

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
  const server = httpCreateServer(async (req, res) => {
    try {
      const method = req.method || "GET"
      const host = req.headers.host || "localhost"
      const protocol = (req.socket as any).encrypted ? "https" : "http"
      const url = `${protocol}://${host}${req.url}`

      const webReq = new NodeRequest(url, method, req) as any

      const webRes = await app.fetch(webReq)

      res.statusCode = webRes.status
      if (webRes.statusText) {
        res.statusMessage = webRes.statusText
      }

      const rawHeaders = (webRes as any)._headers ? null : (webRes as any)._rawHeaders
      const setCookieHeaders = (webRes as any)._cookies || (
        typeof (webRes.headers as any).getSetCookie === "function"
          ? (webRes.headers as any).getSetCookie()
          : []
      )

      if (rawHeaders) {
        for (const key in rawHeaders) {
          if (key === "set-cookie") continue
          res.setHeader(key, rawHeaders[key])
        }
      } else {
        webRes.headers.forEach((value, key) => {
          if (key.toLowerCase() === "set-cookie" && setCookieHeaders.length > 0) return
          res.setHeader(key, value)
        })
      }

      if (setCookieHeaders.length > 0) {
        res.setHeader("Set-Cookie", setCookieHeaders)
      }

      const bodyStr = (webRes as any)._bodyStr
      if (typeof bodyStr === "string") {
        res.end(bodyStr)
      } else if (webRes.body) {
        const contentLengthStr = webRes.headers.get("content-length")
        const contentLength = contentLengthStr ? Number.parseInt(contentLengthStr, 10) : -1

        if (contentLength >= 0 && contentLength < 262144) {
          const arrayBuffer = await webRes.arrayBuffer()
          res.end(Buffer.from(arrayBuffer))
        } else {
          Readable.fromWeb(webRes.body as any).pipe(res)
        }
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

  // Hook into upgrade event to handle WebSockets in Node.js
  server.on("upgrade", async (req, socket, head) => {
    try {
      const method = req.method || "GET"
      const host = req.headers.host || "localhost"
      const protocol = (req.socket as any).encrypted ? "https" : "http"
      const url = `${protocol}://${host}${req.url}`

      const webReq = new NodeRequest(url, method, req) as any

      const webRes = await app.fetch(webReq)

      if (webRes && (webRes as any).isUpgrade) {
        const upgradeRes = webRes as any

        let WebSocketServer = cachedWebSocketServer
        if (!WebSocketServer) {
          try {
            const wsModule = await import("ws")
            WebSocketServer = wsModule.WebSocketServer
            cachedWebSocketServer = WebSocketServer
          } catch (e) {
            console.error(
              "[Tomoe Node WebSocket Error]: 'ws' package is required for Node.js WebSocket support. Please install it (npm install ws)."
            )
            socket.write("HTTP/1.1 501 Not Implemented\r\n\r\n")
            socket.destroy()
            return
          }
        }

        if (!(server as any)._wss) {
          const wss = new WebSocketServer({ noServer: true })
          wss.on("headers", (headersList: string[], request: any) => {
            const extraHeaders = request._wsHeaders
            if (extraHeaders) {
              extraHeaders.forEach((value: string, key: string) => {
                const lowerKey = key.toLowerCase()
                const index = headersList.findIndex((h) =>
                  h.toLowerCase().startsWith(`${lowerKey}:`)
                )
                if (index !== -1) {
                  headersList[index] = `${key}: ${value}`
                } else {
                  headersList.push(`${key}: ${value}`)
                }
              })
            }
          })
          ;(server as any)._wss = wss
        }
        const wss = (server as any)._wss

        // Attach custom response headers to the request object so the headers event can inject them
        ;(req as any)._wsHeaders = upgradeRes.headers

        wss.handleUpgrade(req, socket, head, (ws: any) => {
          const handlers = upgradeRes.socketHandlers
          const sCtx = upgradeRes.socketCtx

          const safeCall = (cb?: Function, ...args: any[]) => {
            if (!cb) return
            try {
              cb(...args)
            } catch (err) {
              if (handlers.error) {
                try {
                  handlers.error(ws, err, sCtx)
                } catch (e) {
                  console.error("[Tomoe WebSocket User Error Handler Crash]:", e)
                }
              } else {
                console.error("[Tomoe WebSocket Handler Error]:", err)
              }
            }
          }

          safeCall(handlers.open, ws, sCtx)

          ws.on("message", (data: any, isBinary: boolean) => {
            safeCall(handlers.message, ws, isBinary ? data : data.toString(), sCtx)
          })

          ws.on("close", () => {
            safeCall(handlers.close, ws, sCtx)
          })

          ws.on("drain", () => {
            safeCall(handlers.drain, ws, sCtx)
          })

          ws.on("error", (err: any) => {
            safeCall(handlers.error, ws, err, sCtx)
          })
        })
        return
      }

      // If it returned normal Response (e.g. 401 Unauthorized), return standard HTTP response on the raw TCP socket
      const body = (webRes as any)._bodyStr ?? (await webRes.text())
      const statusLine = `HTTP/1.1 ${webRes.status} ${webRes.statusText || "Unauthorized"}\r\n`
      let headersStr = ""
      const rawHeaders = (webRes as any)._headers ? null : (webRes as any)._rawHeaders
      if (rawHeaders) {
        for (const key in rawHeaders) {
          headersStr += `${key}: ${rawHeaders[key]}\r\n`
        }
      } else {
        webRes.headers.forEach((val, key) => {
          headersStr += `${key}: ${val}\r\n`
        })
      }
      socket.write(`${statusLine}${headersStr}\r\n${body}`)
      socket.destroy()
    } catch (err) {
      console.error("[Tomoe Node Server Upgrade Error]:", err)
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n")
      socket.destroy()
    }
  })

  return server
}
