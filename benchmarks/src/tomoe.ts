import { Tomoe, Unauthorized, UpgradeResponse, createServer, err, relic } from "tomoejs"

const app = new Tomoe()

// 1. Static JSON route
app.get("/json", (ctx) => ctx.json({ hello: "world" }))

// 2. Dynamic parameter route
app.get("/user/:id/posts/:postId", (ctx) => {
  const { id, postId } = ctx.params
  return ctx.json({ id, postId })
})

// 3. Protected route with middlewares
// In Tomoe, middlewares execute in order. Let's register 3 middlewares for the protected path:
app.use("/protected", async (ctx, next) => {
  // Middleware 1: Request ID
  const response = await next()
  response.headers.set("x-request-id", "tomoe-bench-123")
  return response
})

app.use("/protected", async (ctx, next) => {
  // Middleware 2: CORS headers
  const response = await next()
  response.headers.set("access-control-allow-origin", "*")
  return response
})

app.use("/protected", async (ctx, next) => {
  // Middleware 3: Dummy authorization
  const auth = ctx.header("authorization")
  if (!auth) {
    return ctx.json({ error: "Unauthorized" }, { status: 401 })
  }
  return next()
})

app.get("/protected", (ctx) => {
  return ctx.json({ secret: "tomoe-confidential-data" })
})

app.ws("/ws", {
  message(ws, message) {
    ws.send(message)
  },
})

app.compile()

const port = Number.parseInt(process.env.PORT || "3000", 10)

if (typeof Bun !== "undefined") {
  // Native Bun.serve entry path for extreme Bun speed with full WebSocket support
  const server: any = (Bun as any).serve({
    port,
    async fetch(req: any) {
      const res = await app.fetch(req)
      if (res && (res as any).isUpgrade) {
        const success = server.upgrade(req, {
          data: {
            handlers: (res as any).socketHandlers,
            socketCtx: (res as any).socketCtx,
          },
        })
        if (success) return undefined
      }
      return res
    },
    websocket: {
      open(ws: any) {
        ws.data.handlers.open?.(ws, ws.data.socketCtx)
      },
      message(ws: any, data: any) {
        ws.data.handlers.message?.(ws, data, ws.data.socketCtx)
      },
      close(ws: any) {
        ws.data.handlers.close?.(ws, ws.data.socketCtx)
      },
      drain(ws: any) {
        ws.data.handlers.drain?.(ws, ws.data.socketCtx)
      },
    },
  })
  console.log(`TomoeJS native Bun server listening on port ${port}`)
} else {
  // Legacy Node.js adapter
  const server = createServer(app)
  server.listen(port, () => {
    console.log(`TomoeJS Node adapter bench server listening on port ${port}`)
  })
}
