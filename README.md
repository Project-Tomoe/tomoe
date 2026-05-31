<p align="center">
  <img src="https://raw.githubusercontent.com/Project-Tomoe/tomoe/refs/heads/main/logo.png" width="320" alt="Tomoe Logo"/>
</p>

<p align="center">
  <strong>TomoeJS — The Art of Perfect Balance.</strong>
</p>

<p align="center">
  <a href="https://github.com/Project-Tomoe/tomoe"><img src="https://img.shields.io/github/stars/Project-Tomoe/tomoe?style=flat-square&color=FF69B4" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/tomoejs"><img src="https://img.shields.io/npm/v/tomoejs?style=flat-square&color=3399FF" alt="NPM Version"/></a>
  <a href="https://github.com/Project-Tomoe/tomoe/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License"/></a>
  <img src="https://img.shields.io/badge/Bun-%3E%3D1.0-blue?style=flat-square" alt="Bun Support"/>
  <img src="https://img.shields.io/badge/Web%20Standards-100%25-brightgreen?style=flat-square" alt="Web Standards"/>
</p>

<p align="center">
  <strong>Ultra-Fast · Contract-Driven · Compile-Time Type Safety · Universal Web Standards Core</strong>
</p>

---

## 🌸 What is Tomoe?

**Tomoe (巴)** is a next-generation, high-performance web framework designed with a single goal: **bridging the gap between strict backend correctness and supreme developer experience.**

Embracing native **Web Standard APIs** (`Request`, `Response`, `Headers`, `Cookies`), TomoeJS is universally portable across **Bun, Cloudflare Workers, Node.js, Deno, and Vercel**. It eliminates the single largest flaw in modern web frameworks: **unsafe, untyped middleware side-effects.**

> [!IMPORTANT]
> TomoeJS is currently a release candidate. Review the [production readiness checklist](docs/production-readiness.md), [deployment guide](docs/deployment.md), [release checklist](docs/release-checklist.md), and [security policy](SECURITY.md) before production use.

---

## ✨ Features at a Glance

* **🛡️ Contract-Driven Design:** The first framework introducing **Relics & Guards** to enforce typed preconditions at boot time instead of throwing unexpected runtime errors in production.
* **⚡ Supreme Performance:** Features a pre-compiled radix tree router and cached middleware onion runners to achieve maximum throughput.
* **🌐 Web Standards First:** Zero-dependency wrapper that interacts directly with native Web standard objects like `Request` and `Response`.
* **🔌 Native WebSockets:** Out-of-the-box WebSocket support with custom handshake header hooks and path parameter support.
* **🧰 End-to-End Type Safety:** Generate a fully typed client SDK directly from your server type signature without codegen or build scripts.
* **🔮 Graph Compilation & Validation:** Pre-compile routing tables, run validations, and audit middleware onion chains at startup.

---

## 📦 Installation

Install TomoeJS using your preferred package manager:

```bash
# npm
npm install tomoejs

# pnpm
pnpm add tomoejs

# bun
bun add tomoejs

# yarn
yarn add tomoejs
```

---

## 🚀 Quick Start in 60 Seconds

Create an `index.ts` file to see TomoeJS in action:

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()

// 1. Static response
app.get("/", (c) => c.text("Welcome to TomoeJS!"))

// 2. Dynamic path parameters (automatically URL-decoded)
app.get("/hello/:name", (c) => {
  const name = c.param("name") // Automatically handles URL decoding (e.g. "%20" to " ")
  return c.json({ message: `Hello, ${name}!` })
})

export default app
```

#### Run with Bun:
```bash
bun index.ts
```

#### Run with Node.js:
To use standard Node.js environments, use the built-in HTTP server adapter:
```ts
import { Tomoe, createServer } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Hello from Node.js!"))

const server = createServer(app)
server.listen(3000, () => {
  console.log("Server listening at http://localhost:3000")
})
```

---

## ⚔️ The Problem: Traditional Middleware vs. The Tomoe Way

In traditional frameworks (Express, Fastify, Hono, Elysia), middleware injects values into the request context implicitly, leaving route handlers to blindly assume the values exist:

```ts
// ❌ Traditional (Unsafe): Will compile, but throws runtime errors if the auth middleware is missed or ordered incorrectly!
app.use(authMiddleware)
app.get("/me", (c) => {
  const user = c.get("user") // Typeless! Could be undefined if middleware failed or was skipped.
  return c.json(user)
})
```

### The Tomoe Solution: Relics & Guards

TomoeJS replaces implicit context manipulation with **explicit dependency contracts** called **Relics & Guards**. If a route handler depends on state (like a database connection or verified user), that dependency must be declared.

```ts
// 👑 TomoeJS (Contract-Driven): Fully typed at compile time. 
// If authRelic isn't mounted, TS compiler blocks it, and app.compile() throws at startup.
app.get("/me", authRelic, (ctx) => {
  // ctx.user is fully typed and guaranteed to exist!
  return ctx.json(ctx.user)
})
```
By resolving dependencies before invoking the route handler, TomoeJS guarantees compile-time safety and prevents runtime crashes caused by misordered middleware.

---

## ⚡ Performance Benchmarks

Benchmarks are run using `Autocannon` with **100 concurrent connections** in an isolated environment. The socket ports and server processes are cleared programmatically between runs to ensure accuracy.

### Environment Details
* **Operating System**: Windows 11
* **Node.js version**: `v24.13.0` | **Bun version**: `v1.3.3`
* **Frameworks Tested**: TomoeJS `v1.0.0-rc.3`, Hono `v4.12.23`, Elysia `v1.4.28`

### 1. Static JSON Payload (`/json`)
| Framework | Requests / Sec (Throughput) | Avg Latency | P99 Latency |
|:---|:---:|:---:|:---:|
| **TomoeJS (Bun)** | 45,131 req/s | 1.58 ms | 5 ms |
| **Hono (Bun)** | 42,691 req/s | 1.91 ms | 4 ms |
| **Elysia (Bun)** | 41,987 req/s | 1.96 ms | 4 ms |
| **Hono (Node)** | 29,480 req/s | 2.92 ms | 7 ms |
| **TomoeJS (Node)** | 20,369 req/s | 4.41 ms | 11 ms |

### 2. Radix Dynamic Routing (`/user/:id/posts/:postId`)
| Framework | Requests / Sec (Throughput) | Avg Latency | P99 Latency |
|:---|:---:|:---:|:---:|
| **TomoeJS (Bun)** | 45,853 req/s | 1.54 ms | 4 ms |
| **Elysia (Bun)** | 39,043 req/s | 2.21 ms | 4 ms |
| **Hono (Bun)** | 36,856 req/s | 2.30 ms | 4 ms |
| **Hono (Node)** | 29,067 req/s | 3.00 ms | 6 ms |
| **TomoeJS (Node)** | 22,600 req/s | 3.95 ms | 8 ms |

### 3. Pre-Compiled Middleware Onion Pipeline (`/protected`)
| Framework | Requests / Sec (Throughput) | Avg Latency | P99 Latency |
|:---|:---:|:---:|:---:|
| **Elysia (Bun)** | 37,878 req/s | 2.29 ms | 4 ms |
| **TomoeJS (Bun)** | 33,573 req/s | 2.41 ms | 6 ms |
| **Hono (Bun)** | 31,886 req/s | 2.54 ms | 6 ms |
| **Hono (Node)** | 23,374 req/s | 3.76 ms | 8 ms |
| **TomoeJS (Node)** | 20,616 req/s | 4.37 ms | 9 ms |

### 4. WebSocket Echo Message Roundtrip (`/ws`)
| Framework | Messages / Sec (Throughput) | Avg Latency | P99 Latency |
|:---|:---:|:---:|:---:|
| **Elysia (Bun)** | 45,535 msg/s | 0.43 ms | N/A |
| 👑 **TomoeJS (Node)** | **45,448 msg/s** | **0.42 ms** | **N/A** |
| **Hono (Bun)** | 44,159 msg/s | 0.44 ms | N/A |
| **Hono (Node)** | 43,964 msg/s | 0.45 ms | N/A |
| **TomoeJS (Bun)** | 27,759 msg/s | 0.69 ms | N/A |


---

## 🛠️ API Reference & Documentation

### 🛣️ Routing & Scopes
1. [Radix Tree Routing & Parameters](#1-radix-tree-routing--parameters)
2. [Sub-routers & Prefix Scopes](#2-sub-routers--prefix-scopes)
3. [Custom & Built-in Middleware](#3-custom--built-in-middleware)

### 📥 Request & Response Management
4. [Context API & Cookies](#4-context-api--cookies)
5. [Request Body & Payload Parsing](#5-request-body--payload-parsing)

### 🛡️ Contracts & Validation
6. [Relics & Guards Contract System](#6-relics--guards-contract-system)
7. [Schema Validation Relics](#7-schema-validation-relics)

### ⚡ Real-Time, Tooling & Deployments
8. [Native WebSocket API](#8-native-websocket-api)
9. [End-to-End Type-Safe Client SDK](#9-end-to-end-type-safe-client-sdk)
10. [OpenAPI Specs & Swagger UI](#10-openapi-specs--swagger-ui)
11. [Graph Compilation & Inspection](#11-graph-compilation--inspection)
12. [Runtimes & Deployment Matrix](#12-runtimes--deployment-matrix)
13. [Error Handling (Functional & Thrown)](#13-error-handling-functional--thrown)

---

### 1. Radix Tree Routing & Parameters

TomoeJS implements a high-performance radix tree router featuring dynamic path parameters, wildcard support, and fast paths for static routes.

```ts
const app = new Tomoe()

// Static route
app.get("/api/v1/status", (ctx) => ctx.json({ ok: true }))

// Path parameters (inferred in types, URL-decoded automatically)
app.get("/api/users/:userId/posts/:postId", (ctx) => {
  const { userId, postId } = ctx.params
  return ctx.json({ userId, postId })
})

// Wildcard routes
app.get("/assets/*", (ctx) => {
  const filepath = ctx.param("*")
  return ctx.text(`Requested asset: ${filepath}`)
})
```

---

### 2. Sub-routers & Prefix Scopes

Organize large projects cleanly using either standalone sub-routers or inline protected scope routes.

#### Option A: Mounted Sub-Routers (`app.route`)
Perfect for separating business domains into modular files:
```ts
import { Tomoe } from "tomoejs"

const animeRouter = new Tomoe()
animeRouter.get("/list", (c) => c.json(["FMA", "Hunter x Hunter"]))
animeRouter.get("/:id", (c) => c.json({ id: c.param("id") }))

const app = new Tomoe()
app.route("/api/anime", animeRouter) // Mounted at `/api/anime/list` and `/api/anime/:id`
```

#### Option B: Inline Scope Groups (`app.scope`)
Enforce contract middleware on a group of nested routes:
```ts
app.scope("/admin", adminAccessRelics, (scoped) => {
  scoped.get("/dashboard", (ctx) => {
    // Access typed properties inherited from scope relics
    return ctx.json({ user: ctx.user, org: ctx.org })
  })
})
```

---

### 3. Custom & Built-in Middleware

Middlewares intercept incoming requests to manipulate context, handle telemetry, or manage CORS headers.

#### Custom Middleware Example
```ts
import type { Middleware } from "tomoejs"

const responseTime = (): Middleware => {
  return async (ctx, next) => {
    const start = performance.now()
    const response = await next()
    const duration = (performance.now() - start).toFixed(2)
    response.headers.set("X-Response-Time", `${duration}ms`)
    return response
  }
}

app.use(responseTime())
```

#### Built-in Production Middleware
```ts
import { cors, logger, csrf, rateLimit } from "tomoejs"

// Cross-Origin Resource Sharing
app.use(cors({ origin: ["https://example.com"] }))

// Console Request Logger
app.use(logger())

// Cross-Site Request Forgery Protection
app.use(csrf({ origin: ["https://trusted.com"] }))

// In-Memory Rate Limiting
app.use(rateLimit({ windowMs: 60000, max: 100 }))
```

---

### 4. Context API & Cookies

Handlers receive a unified `Context` object, providing helpers to parse inputs and construct Web Standard responses.

* `ctx.req`: The native Web `Request` instance.
* `ctx.query(key)`: Read a query string parameter.
* `ctx.queries`: Get all query parameters as a key-value object.
* `ctx.header(name)`: Read a request header (case-insensitive).
* `ctx.header(name, value)`: Queue a header to be written to the response.
* `ctx.json(data, init?)`: Return a JSON response with matching content-type.
* `ctx.text(body, init?)`: Return a plain text response.
* `ctx.html(markup, init?)`: Return an HTML response.
* `ctx.redirect(url, status?)`: Perform a redirection response.

#### Cookie Management
TomoeJS provides an RFC 6265 secure, lazy-parsed cookie API:
```ts
app.get("/auth", (ctx) => {
  // Read request cookie
  const token = ctx.cookie("session_token")
  
  // Queue response cookie
  ctx.setCookie("user_id", "12345", {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 3600
  })

  return ctx.json({ loggedIn: !!token })
})
```

---

### 5. Request Body & Payload Parsing

You can read payloads standardly or use Zod validations to safely parse incoming data.

#### Standard Parsing (Native Web APIs)
Ideal for stream-friendly handlers with zero allocations:
```ts
app.post("/upload", async (ctx) => {
  const jsonBody = await ctx.req.json()
  const textBody = await ctx.req.text()
  const formData = await ctx.req.formData() // parses multipart uploads
  const arrayBuffer = await ctx.req.arrayBuffer()
  return ctx.json({ received: true })
})
```

#### Contract-Driven Parsing (Relic-enforced)
Injects pre-validated bodies directly into `ctx.body`:
```ts
import { relic } from "tomoejs"
import { z } from "zod"

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email()
})

app.post("/register", relic.body(userSchema), (ctx) => {
  // Autocomplete-ready and validated at runtime
  const { username, email } = ctx.body
  return ctx.json({ status: "created", username })
})
```

---

### 6. Relics & Guards Contract System

Create modular, chainable components to manage authentication, session state, or database connections.

* **Relics (`relic`)**: Compute values asynchronously and inject them into `ctx`.
* **Guards (`guard`)**: Enforce security rules. Cannot inject variables but can depend on other relics.
* **Unite (`unite`)**: Merge multiple Relics and Guards into a single cohesive route contract.

```ts
import { relic, guard, err, Unauthorized, Forbidden, unite } from "tomoejs"

// 1. Create a relic that injects a verified 'user'
const authenticateUser = relic("user", async (ctx) => {
  const token = ctx.header("Authorization")
  if (!token) return err(Unauthorized) // Returns a structured functional error
  
  const user = await db.verifyToken(token)
  if (!user) return err(Unauthorized)
  return user
})

// 2. Create a guard that checks role requirements
const checkAdminRole = guard(async (ctx, use) => {
  const user = use(authenticateUser) // Resolve user dependency safely
  if (!user.isAdmin) return err(Forbidden)
})

// 3. Chain them using unite()
const adminAccess = unite(authenticateUser, checkAdminRole)

// 4. Protect a scoped routing path
app.scope("/admin", adminAccess, (router) => {
  router.get("/metrics", (ctx) => {
    // Both user validation and role authorization are guaranteed here
    return ctx.json({ activeUser: ctx.user.username, systemHealth: "ok" })
  })
})
```

---

### 7. Schema Validation Relics

TomoeJS supports schema validation out of the box using **Zod, Valibot, ArkType, or TypeBox**.

```ts
import { z } from "zod"
import { unite, relic } from "tomoejs"

const itemBody = z.object({ name: z.string() })
const queryPage = z.object({ page: z.coerce.number().default(1) })

app.post(
  "/items",
  unite(relic.body(itemBody), relic.query(queryPage)),
  (ctx) => {
    const { name } = ctx.body
    const { page } = ctx.query
    return ctx.json({ name, page })
  }
)
```

---

### 8. Native WebSocket API

Supported natively on Node.js (via the `createServer` adapter) and other runtimes. WebSocket handlers are integrated directly into the core router gateway, supporting relics and parameters.

```ts
import { Tomoe, createServer } from "tomoejs"

const app = new Tomoe()

app.ws("/chat/:roomId", {
  // Protocol Handshake Hook
  handshake(ctx) {
    const requestedProtocol = ctx.header("Sec-WebSocket-Protocol")
    if (requestedProtocol) {
      ctx.header("Sec-WebSocket-Protocol", requestedProtocol)
    }
  },

  // Connection opened
  open(ws, socketCtx) {
    console.log(`Connected to room: ${socketCtx.params.roomId}`)
    ws.send(JSON.stringify({ status: "connected" }))
  },

  // Message received
  message(ws, data, socketCtx) {
    ws.send(JSON.stringify({ echo: data }))
  },

  // Connection closed
  close(ws, socketCtx) {
    console.log(`Disconnected from room: ${socketCtx.params.roomId}`)
  }
})

// Secure WebSocket routes using Relics
app.ws("/secure-feed", authRelic, {
  open(ws, socketCtx) {
    const user = socketCtx.relics.user
    ws.send(`Hello secure user, ${user.name}!`)
  }
})

const server = createServer(app)
server.listen(3000)
```

---

### 9. End-to-End Type-Safe Client SDK

Share type definitions directly from your backend instance to your frontend to generate a type-safe client SDK without external code generation.

#### Server Setup (`server.ts`):
```ts
const app = new Tomoe().post("/posts", relic.body(postSchema), (ctx) => {
  return ctx.json({ id: "100" })
})

export type AppRouter = typeof app
```

#### Frontend Consumer (`client.ts`):
```ts
import { createClient } from "tomoejs"
import type { AppRouter } from "./server"

const client = createClient<AppRouter>("http://localhost:3000")

// Inputs (body, params, headers, query) are validated at compile-time!
const { data, error, status } = await client("/posts").post({
  body: { title: "Next-Gen Web Frameworks", content: "..." }
})
```

---

### 10. OpenAPI Specs & Swagger UI

TomoeJS automatically parses Zod/Valibot/TypeBox schema dependencies registered in route relics to generate full OpenAPI v3 specs and serve Swagger UI.

```ts
import { swagger } from "tomoejs"

const app = new Tomoe()

// Setup docs endpoint
swagger(app, {
  title: "TomoeJS Core Services",
  version: "1.0.0",
  path: "/docs",          // Swagger UI endpoint
  specPath: "/openapi.json" // OpenAPI Spec endpoint
})
```

---

### 11. Graph Compilation & Inspection

Compile the route radix tree, validate relic dependency chains, and cache middleware onion pipelines at startup to eliminate runtime cold starts.

```ts
const app = new Tomoe()

// Compiles the routing tree. Called automatically on first request.
app.compile()

// Audit the registered routing structure
const { routes, stats } = app.graph()
console.log(`Audit complete: registered ${routes.length} active endpoints.`)
```

---

### 12. Runtimes & Deployment Matrix

TomoeJS interacts with standard request/response models directly, making it universally compatible across JS runtimes.

#### Bun (Recommended for maximum speed)
```ts
export default app
```
Launch with `bun index.ts`.

#### Cloudflare Workers
```ts
export default {
  fetch: app.fetch
}
```

#### Deno
```ts
Deno.serve((req) => app.fetch(req))
```

#### Node.js
```ts
import { createServer } from "tomoejs"
const server = createServer(app)
server.listen(3000)
```

---

### 13. Error Handling (Functional & Thrown)

TomoeJS utilizes functional result mapping to minimize V8 call-stack serialization overhead, but fully supports standard throw-catch exceptions.

#### Standard Pre-built Errors
Includes `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `MethodNotAllowed`, `Conflict`, `TooManyRequests`, `ServerError`, and more.

#### Custom Errors
```ts
import { HttpError, httpError } from "tomoejs"

// Simple helper
const TeapotError = httpError(418, "I'm a teapot")

// Rich Custom Error Details
const paymentErr = new HttpError(402, "Payment Failed", { reason: "INSUFFICIENT_FUNDS" })
```

#### Scoped & Global Error Interceptors
```ts
// Local scope override
app.scope("/api", authRelic, (scoped) => {
  scoped.onError(401, (ctx) => {
    return ctx.json({ error: "Access Denied: Please authenticate" }, { status: 401 })
  })
})

// Global application fallback
app.onError((error, ctx) => {
  console.error("Critical Exception:", error)
  return ctx?.json({ error: "Internal Server Error" }, { status: 500 })
    ?? new Response("Internal Server Error", { status: 500 })
})
```

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built with 🌸 and perfect balance.
