import { Hono } from "hono"

async function start() {
  const app = new Hono()

  // 1. Static JSON route
  app.get("/json", (c) => c.json({ hello: "world" }))

  // 2. Dynamic parameter route
  app.get("/user/:id/posts/:postId", (c) => {
    const id = c.req.param("id")
    const postId = c.req.param("postId")
    return c.json({ id, postId })
  })

  // 3. Protected route with middlewares
  app.use("/protected", async (c, next) => {
    // Middleware 1: Request ID
    await next()
    c.res.headers.set("x-request-id", "hono-bench-123")
  })

  app.use("/protected", async (c, next) => {
    // Middleware 2: CORS headers
    await next()
    c.res.headers.set("access-control-allow-origin", "*")
  })

  app.use("/protected", async (c, next) => {
    // Middleware 3: Dummy authorization
    const auth = c.req.header("authorization")
    if (!auth) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    return next()
  })

  app.get("/protected", (c) => {
    return c.json({ secret: "hono-confidential-data" })
  })

  let upgradeWebSocket: any
  let wss: any
  let bunWebsocket: any

  if (typeof Bun !== "undefined") {
    const bunWS = await import("hono/bun")
    upgradeWebSocket = bunWS.upgradeWebSocket
    bunWebsocket = bunWS.websocket
  } else {
    const nodeWS = await import("@hono/node-server")
    upgradeWebSocket = nodeWS.upgradeWebSocket
    const { WebSocketServer } = await import("ws")
    wss = new WebSocketServer({ noServer: true })
  }

  app.get(
    "/ws",
    upgradeWebSocket((c: any) => ({
      onMessage(event: { data: any }, ws: any) {
        ws.send(event.data)
      },
    }))
  )

  const port = Number.parseInt(process.env.PORT || "3000", 10)

  if (typeof Bun !== "undefined") {
    // Native Bun.serve entry path for extreme Hono speed on Bun
    Bun.serve({
      port,
      fetch: app.fetch,
      websocket: bunWebsocket,
    })
    console.log(`Hono native Bun server listening on port ${port}`)
  } else {
    // Legacy Node.js server
    const { serve } = await import("@hono/node-server")
    serve(
      {
        fetch: app.fetch,
        port,
        websocket: { server: wss },
      },
      () => {
        console.log(`Hono Node adapter bench server listening on port ${port}`)
      }
    )
  }
}

start()
