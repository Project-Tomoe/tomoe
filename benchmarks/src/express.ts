import express from "express"

const app = express()

// 1. Static JSON route
app.get("/json", (req, res) => {
  res.json({ hello: "world" })
})

// 2. Dynamic parameter route
app.get("/user/:id/posts/:postId", (req, res) => {
  const { id, postId } = req.params
  res.json({ id, postId })
})

// 3. Protected route with middlewares
const requestIdMiddleware: express.RequestHandler = (req, res, next) => {
  res.setHeader("x-request-id", "express-bench-123")
  next()
}

const corsMiddleware: express.RequestHandler = (req, res, next) => {
  res.setHeader("access-control-allow-origin", "*")
  next()
}

const authMiddleware: express.RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  next()
}

app.get("/protected", requestIdMiddleware, corsMiddleware, authMiddleware, (req, res) => {
  res.json({ secret: "express-confidential-data" })
})

const port = Number.parseInt(process.env.PORT || "3000", 10)
app.listen(port, () => {
  console.log(`Express bench server listening on port ${port}`)
})
