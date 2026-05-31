import { Elysia } from "elysia"

const app = new Elysia()

// 1. Static JSON route
app.get("/json", () => ({ hello: "world" }))

// 2. Dynamic parameter route
app.get("/user/:id/posts/:postId", (ctx) => {
  const { id, postId } = ctx.params
  return { id, postId }
})

// 3. Protected route with middlewares
app.get(
  "/protected",
  (ctx) => {
    return { secret: "elysia-confidential-data" }
  },
  {
    beforeHandle: [
      // Middleware 3: Dummy authorization
      (ctx) => {
        const auth = ctx.headers.authorization
        if (!auth) {
          ctx.set.status = 401
          return { error: "Unauthorized" }
        }
      },
    ],
    afterResponse: [
      // Middleware 1 & 2: Request ID & CORS (Simulated headers)
      (ctx) => {
        ctx.set.headers["x-request-id"] = "elysia-bench-123"
        ctx.set.headers["access-control-allow-origin"] = "*"
      },
    ],
  }
)

app.ws("/ws", {
  message(ws, message) {
    ws.send(message)
  },
})

const port = Number.parseInt(process.env.PORT || "3000", 10)
app.listen(port, () => {
  console.log(`Elysia bench server listening on port ${port}`)
})
