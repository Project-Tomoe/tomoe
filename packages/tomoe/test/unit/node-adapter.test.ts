import { request as httpRequest } from "node:http"
import { ReadableStream } from "node:stream/web"
import { describe, expect, it } from "vitest"
import type { Context } from "../../src/context"
import { createServer } from "../../src/node"
import { Tomoe } from "../../src/tomoe"

async function withServer<T>(app: Tomoe, fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

  try {
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP server address")
    }
    return await fn(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

async function rawRequest(
  url: URL,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
  } = {}
): Promise<{
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      {
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        let body = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          body += chunk
        })
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
          })
        })
      }
    )

    req.on("error", reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

describe("Node adapter", () => {
  it("should stream response bodies through Node without buffering into a string first", async () => {
    const app = new Tomoe()
    app.get("/stream", () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("hello "))
          controller.enqueue(encoder.encode("from "))
          controller.enqueue(encoder.encode("stream"))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    })

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/stream`)

      expect(res.status).toBe(200)
      expect(await res.text()).toBe("hello from stream")
    })
  })

  it("should forward large request bodies through the Web Request bridge", async () => {
    const app = new Tomoe()
    app.post("/bytes", async (ctx) => {
      const body = await ctx.req.text()
      return ctx.json({
        length: body.length,
        first: body.slice(0, 8),
        last: body.slice(-8),
      })
    })

    const payload = `${"a".repeat(128 * 1024)}tail-end`

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/bytes`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: payload,
      })

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        length: payload.length,
        first: "aaaaaaaa",
        last: "tail-end",
      })
    })
  })

  it("should preserve multiple Set-Cookie headers on Node responses", async () => {
    const app = new Tomoe()
    app.get("/cookies", (ctx) => {
      ctx.setCookie("session", "abc", { httpOnly: true })
      ctx.setCookie("theme", "dark", { sameSite: "Lax" })
      return ctx.text("ok")
    })

    await withServer(app, async (baseUrl) => {
      const res = await rawRequest(new URL(`${baseUrl}/cookies`))

      expect(res.status).toBe(200)
      expect(res.headers["set-cookie"]).toEqual([
        "session=abc; HttpOnly",
        "theme=dark; SameSite=Lax",
      ])
    })
  })

  it("should support HEAD fallback for GET routes through Node", async () => {
    const app = new Tomoe()
    app.get("/resource", (ctx) => ctx.text("body should not be sent"))

    await withServer(app, async (baseUrl) => {
      const res = await rawRequest(new URL(`${baseUrl}/resource`), { method: "HEAD" })

      expect(res.status).toBe(200)
      expect(res.headers["content-type"]).toBe("text/plain; charset=utf-8")
      expect(res.body).toBe("")
    })
  })

  it("should recover after an aborted client upload", async () => {
    const app = new Tomoe()
    app.post("/upload", async (ctx) => {
      const body = await ctx.req.text()
      return ctx.json({ length: body.length })
    })
    app.get("/health", (ctx) => ctx.json({ ok: true }))

    await withServer(app, async (baseUrl) => {
      const uploadUrl = new URL(`${baseUrl}/upload`)

      await new Promise<void>((resolve) => {
        const req = httpRequest(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": "1048576",
          },
        })
        req.on("error", () => resolve())
        req.write("partial body")
        req.destroy()
        resolve()
      })

      const res = await fetch(`${baseUrl}/health`)
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ ok: true })
    })
  })

  it("should expose the original request URL and headers to handlers", async () => {
    const app = new Tomoe()
    app.get("/inspect", (ctx: Context) => {
      return ctx.json({
        url: ctx.req.url,
        forwardedFor: ctx.header("x-forwarded-for"),
      })
    })

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/inspect?debug=true`, {
        headers: { "X-Forwarded-For": "203.0.113.9" },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.url).toContain("/inspect?debug=true")
      expect(data.forwardedFor).toBe("203.0.113.9")
    })
  })
})
