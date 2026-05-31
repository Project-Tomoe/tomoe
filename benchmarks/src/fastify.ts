import fastifyWebsocket from "@fastify/websocket"
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify"

const app = Fastify({ logger: false })

// 1. Static JSON route
app.get("/json", async () => {
  return { hello: "world" }
})

// 2. Dynamic parameter route
app.get<{
  Params: { id: string; postId: string }
}>(
  "/user/:id/posts/:postId",
  async (request: FastifyRequest<{ Params: { id: string; postId: string } }>) => {
    const { id, postId } = request.params
    return { id, postId }
  }
)

// 3. Protected route with hooks
app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.routeOptions.url !== "/protected") return
  reply.header("x-request-id", "fastify-bench-123")
})

app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.routeOptions.url !== "/protected") return
  reply.header("access-control-allow-origin", "*")
})

app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.routeOptions.url !== "/protected") return
  if (!request.headers.authorization) {
    return reply.code(401).send({ error: "Unauthorized" })
  }
})

app.get("/protected", async () => {
  return { secret: "fastify-confidential-data" }
})

// WebSockets scenario
app.register(fastifyWebsocket)
app.after(() => {
  app.get("/ws", { websocket: true }, (connection: any) => {
    connection.socket.on("message", (message: any) => {
      connection.socket.send(message)
    })
  })
})

const port = Number.parseInt(process.env.PORT || "3000", 10)

await app.listen({ port, host: "127.0.0.1" })
console.log(`Fastify bench server listening on port ${port}`)
