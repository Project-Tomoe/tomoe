import Fastify from "fastify"

const app = Fastify({ logger: false })

// 1. Static JSON route
app.get("/json", async () => {
  return { hello: "world" }
})

// 2. Dynamic parameter route
app.get<{
  Params: { id: string; postId: string }
}>("/user/:id/posts/:postId", async (request) => {
  const { id, postId } = request.params
  return { id, postId }
})

// 3. Protected route with hooks
app.addHook("onRequest", async (request, reply) => {
  if (request.routeOptions.url !== "/protected") return
  reply.header("x-request-id", "fastify-bench-123")
})

app.addHook("onRequest", async (request, reply) => {
  if (request.routeOptions.url !== "/protected") return
  reply.header("access-control-allow-origin", "*")
})

app.addHook("onRequest", async (request, reply) => {
  if (request.routeOptions.url !== "/protected") return
  if (!request.headers.authorization) {
    return reply.code(401).send({ error: "Unauthorized" })
  }
})

app.get("/protected", async () => {
  return { secret: "fastify-confidential-data" }
})

const port = Number.parseInt(process.env.PORT || "3000", 10)

await app.listen({ port, host: "127.0.0.1" })
console.log(`Fastify bench server listening on port ${port}`)
