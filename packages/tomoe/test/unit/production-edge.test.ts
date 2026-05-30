import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createServer } from "../../src/node"
import { relic } from "../../src/relic/relic"
import { Tomoe } from "../../src/tomoe"

describe("Production Edge Cases", () => {
  it("should return 405 for dynamic routes when the path matches but the method does not", async () => {
    const app = new Tomoe()
    app.get("/users/:id", (ctx) => ctx.json({ id: ctx.param("id") }))

    const res = await app.fetch(new Request("http://localhost/users/123", { method: "DELETE" }))

    expect(res.status).toBe(405)
    expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS")
  })

  it("should not crash on malformed URL-encoded path parameters", async () => {
    const app = new Tomoe()
    app.get("/files/:name", (ctx) => ctx.json({ name: ctx.param("name") }))

    const res = await app.fetch(new Request("http://localhost/files/%E0%A4%A"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ name: "%E0%A4%A" })
  })

  it("should preserve the original request body after relic body validation", async () => {
    const app = new Tomoe()
    const schema = z.object({ name: z.string() })

    app.post("/echo", relic.body(schema), async (ctx) => {
      return ctx.json({
        parsed: ctx.body,
        raw: await ctx.req.text(),
      })
    })

    const body = JSON.stringify({ name: "tomoe" })
    const res = await app.fetch(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      parsed: { name: "tomoe" },
      raw: body,
    })
  })

  it("should append multiple Set-Cookie values without overwriting earlier cookies", async () => {
    const app = new Tomoe()
    app.get("/cookies", (ctx) => {
      ctx.setCookie("session", "abc", { httpOnly: true })
      ctx.setCookie("theme", "dark", { sameSite: "Lax" })
      return ctx.text("ok")
    })

    const res = await app.fetch(new Request("http://localhost/cookies"))
    const setCookie = res.headers.get("Set-Cookie")

    expect(setCookie).toContain("session=abc; HttpOnly")
    expect(setCookie).toContain("theme=dark; SameSite=Lax")
  })

  it("should fail through the error handler when middleware calls next more than once", async () => {
    const app = new Tomoe()
    app.use(async (_ctx, next) => {
      await next()
      return next()
    })
    app.get("/double-next", (ctx) => ctx.text("ok"))

    const res = await app.fetch(new Request("http://localhost/double-next"))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "Internal Server Error" })
  })

  it("should serve requests through the Node adapter", async () => {
    const app = new Tomoe()
    app.post("/node/:id", async (ctx) => {
      return ctx.json({
        id: ctx.param("id"),
        body: await ctx.req.json(),
      })
    })

    const server = createServer(app)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))

    try {
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Expected TCP server address")
      }

      const res = await fetch(`http://127.0.0.1:${address.port}/node/42`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      })

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({
        id: "42",
        body: { ok: true },
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  })
})
