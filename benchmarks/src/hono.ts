import { Hono } from "hono"
import { serve } from "@hono/node-server"

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

const port = parseInt(process.env.PORT || "3000", 10)
serve({
  fetch: app.fetch,
  port
}, () => {
  console.log(`Hono bench server listening on port ${port}`)
})
