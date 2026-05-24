<p align="center">
  <img src="https://raw.githubusercontent.com/Project-Tomoe/tomoe/refs/heads/main/logo.png" width="320" alt="Tomoe Logo"/>
</p>

<p align="center">
  <strong>TomoeJS — The art of perfect balance.</strong>
</p>

<p align="center">
  <a href="https://github.com/Project-Tomoe/tomoe"><img src="https://img.shields.io/github/stars/Project-Tomoe/tomoe?style=flat-square&color=FF69B4" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/tomoejs"><img src="https://img.shields.io/npm/v/tomoejs?style=flat-square&color=3399FF" alt="NPM Version"/></a>
  <a href="https://github.com/Project-Tomoe/tomoe/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License"/></a>
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0-blue?style=flat-square" alt="Bun Support"/>
  <img src="https://img.shields.io/badge/Web%20Standards-100%25-brightgreen?style=flat-square" alt="Web Standards"/>
</p>

<p align="center">
  <strong>Ultra-Fast · Contract-Driven · Compile-Time Type Safety · Zero-Dependency Web Standards Core</strong>
</p>

---

## 🌸 What is Tomoe?

**Tomoe (巴)** is a next-generation, high-performance web framework designed with a single goal: **bridging the gap between strict backend correctness and supreme developer experience.**

Inspired by the design of frameworks like **Hono** and **Elysia**, Tomoe embraces native **Web Standard APIs** (`Request`, `Response`, `Headers`, `Cookies`) making it universally portable across **Bun, Cloudflare Workers, Node.js, Deno, and Vercel**. 

However, Tomoe addresses the single largest flaw in modern web frameworks: **unsafe, untyped middleware side-effects.**

---

## 🚫 Stop Trusting Middleware

In traditional frameworks (Express, Fastify, Hono, Elysia), middlewares inject state into your request context behind the scenes (e.g. `req.user`, `c.set("user")`). 

This creates a **fragile runtime contract**:
```ts
// ❌ Dangerous: 'user' might be undefined if you forget the middleware or register it in the wrong order!
app.use(authMiddleware)
app.get("/me", (c) => c.json(c.get("user"))) 
```

Tomoe removes these assumptions entirely by introducing **Relics & Guards (Contract-Driven Architecture)**. If a route handler depends on something (like a verified database user), that precondition must be explicitly declared as a contract. **If a contract isn't satisfied at startup, your application fails immediately rather than throwing runtime errors in production.**

```ts
//   Context is fully typed, and ctx.user is guaranteed to exist at compile time and runtime!
app.get("/me", authRelic, (ctx) => {
  return ctx.json(ctx.user) 
})
```

---

## ✨ Core Features

* 🚀 **Universal Web Standard Core**: Zero dependencies, running natively on standard `Request` and `Response` interfaces.
* ⚡ **Backtracking Radix Router**: Dynamic segment routing (`:paramName`), wildcards (`*`), static-route fast paths, and automatic URL parameter segment decoding.
* 🛡️ **Contract-Driven Type Safety**: Declare requirements (Relics) and preconditions (Guards) at startup.
* 📦 **Standard Schema Validation**: Built-in, high-performance validation (`body`, `query`, `params`, `headers`) supporting any standard validator schema (Zod, Valibot, ArkType, etc.) and TypeBox.
* 🍪 **Robust Cookie API**: Lazy request cookie parsing cache and RFC 6265 cookie name validation shielding against injection attacks.
* 🛡️ **Production-Ready Middlewares**: Built-in OOM-proof Rate Limiter, Reverse-Proxy friendly Host-matching CSRF middleware, CORS, and formatted console Logger.
* 📝 **Auto-Generated OpenAPI & Swagger UI**: Serves interactive, self-documenting `/docs` with locked Swagger UI versions (`@5.18.2`) and CORS secure links.
* 🔌 **E2E Path-Based Client SDK**: Enjoy complete static type-safety across frontend and backend.

---

## 📦 Installation

Initialize your project and install `tomoejs` using Bun or your package manager of choice:

```bash
# Using Bun (Recommended)
bun init
bun add tomoejs

# Using npm / pnpm / yarn
npm install tomoejs
```

---

## 🚀 Quick Start

Build an ultra-fast REST API in seconds:

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()

// Basic routing
app.get("/", (c) => c.text("Welcome to TomoeJS!"))

// Path parameters (automatically decoded)
app.get("/hello/:name", (c) => {
  const name = c.param("name") // e.g. "Saif Rehman" from "/hello/Saif%20Rehman"
  return c.json({ message: `Hello, ${name}!` })
})

export default app
```

Launch with Bun:
```bash
bun run index.ts
```

---

## 📖 Complete Guide & API Reference

### 1. Radix Tree Routing & Parameters
Tomoe implements an optimized, backtracking Radix-Tree router. Routes can contain static paths, named parameters, and wildcard segments.

```ts
const app = new Tomoe()

// 1. Static route
app.get("/api/v1/status", (c) => c.json({ ok: true }))

// 2. Named path parameters (decoded automatically)
app.get("/api/users/:userId/posts/:postId", (ctx) => {
  const { userId, postId } = ctx.params
  return ctx.json({ userId, postId })
})

// 3. Wildcard routes
app.get("/static/*", (ctx) => {
  const filepath = ctx.param("*")
  return ctx.text(`Serving file: ${filepath}`)
})
```

---

### 2. Request Body & Input Parsing (All Options)
Unlike other frameworks that wrap request objects with custom classes, **Tomoe keeps the Request object 100% native** for maximum performance and zero-allocation overhead. You can parse incoming payloads using **Web Standard APIs (without Relics)** or **Contract-Driven Schema Validation (with Relics)**.

#### A. The Native Web-Standard Way (Without Relics)
Use native W3C Fetch stream-consumers directly on `ctx.req`. This is ideal when you don't need validation or want low-overhead streaming (e.g. file uploads):

```ts
app.post("/raw-payloads", async (ctx) => {
  // 1. Parse JSON body manually
  const jsonBody = await ctx.req.json()

  // 2. Read raw string payload (useful for custom text/xml parsing)
  const textBody = await ctx.req.text()

  // 3. Parse standard url-encoded forms or multipart uploads
  const formData = await ctx.req.formData()
  const username = formData.get("username")
  const avatar = formData.get("avatar") // File object

  // 4. Consume raw binary array buffers or file blobs (stream-friendly)
  const arrayBuffer = await ctx.req.arrayBuffer()
  const blob = await ctx.req.blob()

  return ctx.json({ ok: true })
})
```

#### B. The Contract-Driven Way (With Relics)
Mount schema relics to automatically parse, clean, and validate payloads at the gateway. **Whenever `ctx.body` exists in your handler, it is guaranteed to be statically typed and valid:**

```ts
import { relic } from "tomoejs"
import { z } from "zod"

const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
})

// Validation relics automatically inject 'ctx.body', 'ctx.query', 'ctx.params', or 'ctx.headers'
app.post("/register", relic.body(registerSchema), (ctx) => {
  // ctx.body is fully typed, autocomplete-ready, and 100% safe!
  const { username, email } = ctx.body
  return ctx.json({ status: "success", username })
})
```

#### Why Tomoe Does Not Use Custom Request Wrappers (like Hono's `c.req`):
1. **Zero Object Allocation**: Wrapping native requests on every call consumes unnecessary memory and puts garbage collection pressure on high-throughput servers. Tomoe executes at native C++ runtime speeds.
2. **No Stream Locking**: Native `Request` bodies can only be read once. If a framework automatically reads it internally to populate a global `ctx.body`, it locks the stream, blocking developers from forwarding raw file streams to storage buckets (like AWS S3 or Cloudflare R2).
3. **Graph Caching**: In Hono, wrappers cache parsed bodies because multiple middlewares run sequentially and might repeatedly read them. In Tomoe, relics compile into a dependency graph at startup. If multiple handlers or guards need the body, `relic.body()` resolves **exactly once**, caches it in the Relic store, and injects it—preventing locking without custom wrapper overhead.

---

### 3. Context (`Context`) API
Handlers receive a fully typed `Context` object wrapping the standard `Request` and providing clean response utilities.

* `ctx.req`: Standard `Request` object.
* `ctx.query(key)`: Retrieves a single URL query parameter.
* `ctx.queries`: Retrieves all URL query parameters as a key-value record.
* `ctx.header(name)`: Case-insensitive retrieval of a request header.
* `ctx.json(data, init?)`: Returns a JSON response with proper `application/json` headers.
* `ctx.text(body, init?)`: Returns a text response with proper `text/plain` headers.
* `ctx.html(html, init?)`: Returns an HTML response with `text/html` headers.
* `ctx.redirect(url, status?)`: Returns a redirection response (default: `302`).

#### Cookie Management
Tomoe provides lazy-loaded cookie management utilities and robust security defenses:

```ts
app.get("/cookies", (ctx) => {
  // 1. Read request cookie (lazy parsed and cached)
  const token = ctx.cookie("session_token")
  
  // 2. Set response cookies (RFC 6265 validated to prevent injection attacks)
  ctx.setCookie("user", "saif", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 3600
  })

  return ctx.json({ token })
})
```

---

### 4. Relics & Guards (Contract Architecture)
Instead of relying on standard unsafe middleware side-effects, declare explicit dependency chains.

* **Relics**: Generate values and inject them into handler contexts.
* **Guards**: Assert security policies or validation checks (cannot inject variables).

```ts
import { relic, guard, err, Unauthorized, Forbidden } from "tomoejs"

// 1. Define Providing Relic (injects typed "user" value)
const auth = relic("user", async (ctx) => {
  const authHeader = ctx.header("authorization")
  if (!authHeader) return err(Unauthorized) // Return functional error
  
  const user = await db.verify(authHeader)
  if (!user) return err(Unauthorized)
  
  return user
})

// 2. Define Guard (validates state using other relics)
const adminOnly = guard(async (ctx, use) => {
  const user = use(auth) // Resolves auth relic dependency
  if (!user.isAdmin) return err(Forbidden)
})

// 3. Mount single relics or group them together using unite()
import { unite } from "tomoejs"

const adminAccess = unite(auth, adminOnly)

app.scope("/admin", adminAccess, (router) => {
  // 'ctx.user' is fully typed as a User object, and guaranteed to be present!
  router.get("/dashboard", (ctx) => {
    return ctx.json({ secret: "admin_panel", activeUser: ctx.user })
  })
})
```

---

### 5. Input Schema Validation
Tomoe offers built-in schema validation relics supporting standard schema systems (Zod, Valibot, ArkType, TypeBox).

```ts
import { z } from "zod"

const createPostSchema = z.object({
  title: z.string().min(3),
  content: z.string()
})

const querySchema = z.object({
  limit: z.coerce.number().default(10)
})

// Mount standard body and query validation relics
app.post("/posts", unite(relic.body(createPostSchema), relic.query(querySchema)), (ctx) => {
  // ctx.body and ctx.query are fully typed and validated!
  const { title, content } = ctx.body
  const { limit } = ctx.query

  return ctx.json({ status: "created", post: { title, content }, limit })
})
```

---

### 6. Built-in Middlewares
Tomoe packages core production middlewares designed for extreme efficiency and OOM security:

#### CORS
```ts
import { cors } from "tomoejs"

app.use(cors({
  origin: ["https://example.com"],
  methods: ["GET", "POST"],
  credentials: true
}))
```

#### Formatted Logger
```ts
import { logger } from "tomoejs"

app.use(logger())
```

#### Host-matching CSRF (Reverse Proxy Friendly)
```ts
import { csrf } from "tomoejs"

// Automatically supports reverse-proxies (reading X-Forwarded-Host)
// Normalizes protocol schemas and port numbers before checking hostname.
app.use(csrf({
  origin: ["https://trusted-domain.com"]
}))
```

#### Rate Limiter (OOM-Resistant Sliding Window)
```ts
import { rateLimit } from "tomoejs"

// Capped at 10,000 active keys with lazy sweeps to prevent Out-Of-Memory exploits
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // 60 requests per window
}))
```

---

### 7. Interactive OpenAPI & Swagger UI docs
Tomoe automatically builds Swagger UI endpoints with support for circular schemas and Locked CDN resources.

```ts
import { swagger } from "tomoejs"

const app = new Tomoe()

// Serve Swagger UI on `/docs` and JSON spec on `/swagger.json`
swagger(app, {
  title: "Tomoe API Documentation",
  version: "1.0.0",
  path: "/docs",           // Swagger UI HTML endpoint
  specPath: "/swagger.json" // OpenAPI spec JSON endpoint
})
```

---

### 8. End-to-End Type-Safe Client SDK
Connect your frontend directly with complete static type safety:

```ts
// server.ts
const app = new Tomoe()
  .post("/posts", relic.body(createPostSchema), (ctx) => {
    return ctx.json({ status: "success", id: "123" })
  })

export type AppRouter = typeof app
```

```ts
// client.ts
import { createClient } from "tomoejs"
import type { AppRouter } from "./server"

const client = createClient<AppRouter>("http://localhost:3000")

// Type-safe variables, requests, headers, and responses!
const { data, error } = await client("/posts").post({
  body: { title: "Tomoe Guide", content: "..." }
})
```

---

### 9. Runtimes & Server Adapters

#### Bun / Cloudflare Workers
Export the application directly.
```ts
const app = new Tomoe()
app.get("/", (c) => c.text("Running natively!"))

export default app
```

#### Node.js Server Adapter
Use the built-in `createServer` adapter to deploy on standard Node.js runtimes:
```ts
import { Tomoe, createServer } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Node server running!"))

const server = createServer(app)
server.listen(3000, () => {
  console.log("Listening on http://localhost:3000")
})
```

---

## 🔗 GitHub Repository

The official repository for TomoeJS is located at [https://github.com/Project-Tomoe/tomoe](https://github.com/Project-Tomoe/tomoe). 

For issues, feature requests, and code contributions, feel free to open a Pull Request or create an Issue.

---

## 📄 License

This project is licensed under the [MIT License](https://github.com/Project-Tomoe/tomoe/blob/main/LICENSE). Built with 🌸 and perfect balance.
