import { describe, expect, it, vi } from "vitest"
import { Tomoe } from "../../src/tomoe"
import { relic } from "../../src/relic/relic"
import { UpgradeResponse } from "../../src/context"
import { createServer } from "../../src/node"
import { request as httpRequest } from "node:http"

describe("WebSocket Routing & Handshake", () => {
  it("should register and match ws routes returning UpgradeResponse", async () => {
    const app = new Tomoe()
    const openFn = vi.fn()

    app.ws("/chat/:room", {
      open: openFn,
    })

    const res = await app.fetch(
      new Request("http://localhost/chat/lobby?token=abc", {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          Cookie: "session=xyz",
          "X-Custom-Header": "hello",
        },
      })
    )

    expect(res).toBeInstanceOf(UpgradeResponse)
    const upgradeRes = res as UpgradeResponse
    expect(upgradeRes.isUpgrade).toBe(true)
    expect(upgradeRes.socketHandlers.open).toBe(openFn)

    // Check extracted lightweight context (SocketCtx)
    const sCtx = upgradeRes.socketCtx
    expect(sCtx.params).toEqual({ room: "lobby" })
    expect(sCtx.query).toEqual({ token: "abc" })
    expect(sCtx.handshake.headers["x-custom-header"]).toBe("hello")
    expect(sCtx.handshake.cookies["session"]).toBe("xyz")
  })

  it("should run relics before upgrading and reject on failure", async () => {
    const app = new Tomoe()

    const authRelic = relic("user", async (ctx) => {
      const auth = ctx.req.headers.get("Authorization")
      if (auth !== "Bearer secret") {
        throw new Error("Invalid token")
      }
      return { id: 1, name: "Alice" }
    })

    app.ws("/secure", authRelic, {
      open(ws, sCtx) {
        expect(sCtx.relics.user).toEqual({ id: 1, name: "Alice" })
      },
    })

    // 1. Rejected request
    const rejectedRes = await app.fetch(
      new Request("http://localhost/secure", {
        headers: { Upgrade: "websocket" },
      })
    )
    expect(rejectedRes.status).toBe(500) // Uncaught relic handler throw triggers global 500 error handler

    // 2. Successful request
    const successRes = await app.fetch(
      new Request("http://localhost/secure", {
        headers: {
          Upgrade: "websocket",
          Authorization: "Bearer secret",
        },
      })
    )
    expect(successRes).toBeInstanceOf(UpgradeResponse)
    const sCtx = (successRes as UpgradeResponse).socketCtx
    expect(sCtx.relics.user).toEqual({ id: 1, name: "Alice" })
  })

  it("should support custom handshake hook to modify response headers", async () => {
    const app = new Tomoe()

    app.ws("/custom-handshake", {
      handshake(ctx) {
        ctx.header("Sec-WebSocket-Protocol", "my-protocol")
      },
      open() {},
    })

    const res = await app.fetch(
      new Request("http://localhost/custom-handshake", {
        headers: { Upgrade: "websocket" },
      })
    )

    expect(res).toBeInstanceOf(UpgradeResponse)
    expect(res.headers.get("Sec-WebSocket-Protocol")).toBe("my-protocol")
  })
})

describe("Node Adapter Upgrade handling", () => {
  it("should correctly handle ws upgrades on createServer in Node.js", async () => {
    const app = new Tomoe()
    const openFn = vi.fn()

    app.ws("/ws-test", {
      open: openFn,
    })

    const server = createServer(app)
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address() as any

    try {
      // Send handshake request via node's http.request upgrade pathway
      const req = httpRequest({
        port: address.port,
        host: "127.0.0.1",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          "Sec-WebSocket-Version": "13",
        },
        path: "/ws-test",
      })

      const upgradePromise = new Promise<void>((resolve) => {
        req.on("upgrade", (res, socket) => {
          socket.destroy()
          resolve()
        })
      })

      req.end()
      await upgradePromise

      // Allow a brief moment for the connection callback to execute on the server
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify that upgrade listener exists on node server and open callback is called:
      expect(server.listeners("upgrade").length).toBe(1)
      expect(openFn).toHaveBeenCalled()
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
