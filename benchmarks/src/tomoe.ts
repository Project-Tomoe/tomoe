import { Tomoe, Unauthorized, createServer, err, relic } from "tomoejs"

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

app.compile()

const port = Number.parseInt(process.env.PORT || "3000", 10)

if (typeof Bun !== "undefined") {
  // Native Bun.serve entry path for extreme Bun speed
  Bun.serve({
    port,
    fetch: (req) => app.fetch(req),
  })
  console.log(`TomoeJS native Bun server listening on port ${port}`)
} else {
  // Legacy Node.js adapter
  const server = createServer(app)
  server.listen(port, () => {
    console.log(`TomoeJS Node adapter bench server listening on port ${port}`)
  })
}
