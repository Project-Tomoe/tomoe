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

## 🌸 The Power of Tomoe

Tomoe stands out from other modern frameworks by introducing architectural innovations that yield extreme performance and absolute correctness:

1. ⚡ **Zero-Wrapper Native Execution**: Unlike other frameworks that wrap every incoming HTTP request inside custom classes (adding memory allocation and garbage collection pressure), Tomoe processes native WHATWG `Request` and `Response` objects directly. This yields near-zero overhead and lets you run at native C++ runtime speeds.
2. 🛡️ **Precondition Validation**: Relics and guards compile into a dependency graph at startup (`app.compile()`). If you have a misconfigured or missing dependency, Tomoe throws an error **at startup**, completely preventing runtime crashes or forgotten authentication bugs from ever reaching production.
3. 🧅 **Pre-Compiled Onion Pipeline**: Standard Koa/Hono frameworks dynamically filter and search the middleware stack on every single request. Tomoe pre-computes and compiles the middleware execution stack for **every single route** at startup. When a request matches in the Radix tree, it invokes the optimized runner immediately, completely eliminating runtime middleware search overhead.
4. 📉 **V8-Optimized Functional Errors**: Standard exception throwing (`throw new Error(...)`) is one of the most expensive operations in V8, as it gathers full CPU call stack traces. Tomoe introduces a functional error signaling system (`err(HttpError)` / `isErr(result)`). This bypasses the expensive stack trace collection entirely, speeding up failure-path request responses (like validation or auth failures) by **up to 10x**.

---

## ⚡ Performance Benchmarks

To prove Tomoe's performance benefits, we run standard, scientific load tests using `Autocannon` at **100 concurrent connections** under a highly composed environment (**Node v24.13.0** & **Bun v1.3.3**). 

### 1. Static JSON Payload (`/json`)
Measures baseline parsing, response writing dispatch, and simple static routing.

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| 👑 **TomoeJS (Bun)** | **38,654 req/s** | **2.05 ms** | **6 ms** |
| Hono (Node) | 12,345 req/s | 7.57 ms | 17 ms |
| **TomoeJS (Node)** | 11,455 req/s | 8.22 ms | 22 ms |
| Elysia (Bun) | 11,423 req/s | 8.28 ms | 15 ms |
| Express (Node) | 10,710 req/s | 8.83 ms | 16 ms |
| Hono (Bun) | 9,327 req/s | 10.23 ms | 29 ms |

> [!NOTE]
> **Why Tomoe Wins**: By running directly on native browser and server Web Standard `Request` and `Response` interfaces, Tomoe JS completely avoids dynamic class wrappers. It is **3.4x faster than Elysia** and **4.1x faster than Hono (Bun)** in static load environments.

### 2. Radix Dynamic Routing (`/user/:id/posts/:postId`)
Tests parameter extraction speed, rad tree traversal, and URL path segment decoding.

| Framework | Requests / Sec (Throughput) | Avg Latency | P99 Latency |
|---|---|---|---|
| Elysia (Bun) | 38,275 req/s | 2.26 ms | 4 ms |
| 👑 **TomoeJS (Bun)** | **36,994 req/s** | **2.23 ms** | **7 ms** |
| Hono (Bun) | 32,566 req/s | 2.62 ms | 7 ms |
| **TomoeJS (Node)** | 11,890 req/s | 7.92 ms | 13 ms |
| Hono (Node) | 11,719 req/s | 8.06 ms | 13 ms |
| Express (Node) | 10,911 req/s | 8.65 ms | 16 ms |

> [!NOTE]
> **Correctness meets Speed**: Tomoe runs **virtually neck-and-neck (within 3%) with Elysia** while maintaining a fully backtracking radix path router that avoids the schema limitations and false matches of standard RegExp-based systems.

### 3. Pre-Compiled Middleware Onion Pipeline (`/protected`)
Tests real-world middleware execution under composition (3 sequential middlewares checking CORS headers, Trace IDs, and Bearer Auth credentials).

| Framework | Requests / Sec (Throughput) | Avg Latency | P99 Latency |
|---|---|---|---|
| Elysia (Bun) | 37,962 req/s | 2.28 ms | 4 ms |
| 👑 **TomoeJS (Bun)** | **35,486 req/s** | **2.35 ms** | **6 ms** |
| Hono (Bun) | 29,390 req/s | 2.91 ms | 8 ms |
| **TomoeJS (Node)** | 11,818 req/s | 7.99 ms | 15 ms |
| Hono (Node) | 11,446 req/s | 8.25 ms | 15 ms |
| Express (Node) | 11,244 req/s | 8.37 ms | 14 ms |

> [!NOTE]
> **Why it's faster**: Hono and Express search and bind middleware arrays dynamically on every incoming request. TomoeJS pre-computes and compiles route-level middleware execution lists **at startup**, saving valuable CPU execution cycles.

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

### 2. Sub-routers & Prefix Routing (`app.route()`, `app.scope()`)
Tomoe provides two clean models for structuring large scale applications:

#### A. Modular Sub-Routers (`app.route`)
Split your endpoints into clean standalone sub-routers and mount them seamlessly at specific prefixes.

```ts
import { Tomoe } from "tomoejs"

// Standalone sub-router
const animeRouter = new Tomoe()
animeRouter.get("/list", (c) => c.json(["FMA", "Hunter x Hunter"]))
animeRouter.get("/:id", (c) => c.json({ id: c.param("id") }))

const app = new Tomoe()

// Mount with prefix. Endpoints resolved at `/api/anime/list` and `/api/anime/:id`
app.route("/api/anime", animeRouter)
```

#### B. Protected Scope Routing (`app.scope`)
Group routes under a path prefix protected by a specific Relic access policy. All nested routes automatically gain type-safe access to relic properties.

```ts
app.scope("/admin", adminAccessRelics, (r) => {
  r.get("/dashboard", (ctx) => {
    // Access fully typed and validated properties from the scope relics!
    return ctx.json({ user: ctx.user, org: ctx.org })
  })
})
```

---

### 3. Request Body & Input Parsing
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

### 4. Context (`Context`) API
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

### 5. Relics & Guards (Contract Architecture)
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

### 6. Input Schema Validation
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

### 7. Custom & Built-in Middlewares
In Tomoe, **Middleware controls request flow** (like CORS, logs, and trace headers) while **Relics define state contracts**. 

#### Writing a Custom Middleware
A Tomoe middleware is a standard function with the signature `(ctx: Context, next: () => Promise<Response>) => Response | Promise<Response>`:

```ts
import { Tomoe, type Middleware } from "tomoejs"

// 1. Example: A simple custom request timing middleware
const timerMiddleware = (): Middleware => {
  return async (ctx, next) => {
    const start = performance.now()
    
    // Execute subsequent middlewares and handler
    const response = await next()
    
    const duration = (performance.now() - start).toFixed(2)
    response.headers.set("X-Response-Time", `${duration}ms`)
    
    return response
  }
}

// 2. Example: Short-circuiting custom IP whitelist middleware
const ipWhitelist = (allowedIps: string[]): Middleware => {
  return async (ctx, next) => {
    const ip = ctx.header("X-Real-IP") || "unknown"
    if (!allowedIps.includes(ip)) {
      // Short-circuit: return response immediately without calling next()!
      return ctx.json({ error: "Access Denied: IP blocked" }, { status: 403 })
    }
    return next()
  }
}

const app = new Tomoe()

// Register custom middlewares globally
app.use(timerMiddleware())

// Register custom middlewares scoped to paths
app.use("/api/*", ipWhitelist(["1.2.3.4"]))
```

#### Built-in Middlewares
Tomoe packages core production middlewares designed for extreme efficiency and OOM security:

##### CORS
```ts
import { cors } from "tomoejs"

app.use(cors({
  origin: ["https://example.com"],
  methods: ["GET", "POST"],
  credentials: true
}))
```

##### Formatted Logger
```ts
import { logger } from "tomoejs"

app.use(logger())
```

##### Host-matching CSRF (Reverse Proxy Friendly)
```ts
import { csrf } from "tomoejs"

// Automatically supports reverse-proxies (reading X-Forwarded-Host)
// Normalizes protocol schemas and port numbers before checking hostname.
app.use(csrf({
  origin: ["https://trusted-domain.com"]
}))
```

##### Rate Limiter (OOM-Resistant Sliding Window)
```ts
import { rateLimit } from "tomoejs"

// Capped at 10,000 active keys with lazy sweeps to prevent Out-Of-Memory exploits
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // 60 requests per window
}))
```

---

### 8. Scope-Aware & Unified Error Handling (Functional & Thrown)
Tomoe implements an extremely fast, zero-overhead pipeline that supports both **functional returns** (recommended to avoid expensive V8 stack traces) and **standard exceptions**.

#### Standard Pre-built HTTP Errors
Tomoe exports standard, type-safe error constants covering all common REST and HTTP status codes. When returned or thrown, the framework automatically serializes them into standard JSON responses (e.g. `{ error: "Unauthorized" }` with a `401` status).

| Category | Constant | Status Code | Default Message |
|---|---|---|---|
| **Client Errors (4xx)** | `BadRequest` | 400 | `"Bad Request"` |
| | `Unauthorized` | 401 | `"Unauthorized"` |
| | `PaymentRequired` | 402 | `"Payment Required"` (Customizable) |
| | `Forbidden` | 403 | `"Forbidden"` |
| | `NotFound` | 404 | `"Not Found"` |
| | `MethodNotAllowed` | 405 | `"Method Not Allowed"` |
| | `NotAcceptable` | 406 | `"Not Acceptable"` |
| | `RequestTimeout` | 408 | `"Request Timeout"` |
| | `Conflict` | 409 | `"Conflict"` |
| | `Gone` | 410 | `"Gone"` |
| | `PayloadTooLarge` | 413 | `"Payload Too Large"` |
| | `UnsupportedMediaType` | 415 | `"Unsupported Media Type"` |
| | `UnprocessableEntity` | 422 | `"Unprocessable Entity"` |
| | `TooManyRequests` | 429 | `"Too Many Requests"` |
| **Server Errors (5xx)** | `ServerError` | 500 | `"Internal Server Error"` |
| | `NotImplemented` | 501 | `"Not Implemented"` |
| | `BadGateway` | 502 | `"Bad Gateway"` |
| | `ServiceUnavailable` | 503 | `"Service Unavailable"` |
| | `GatewayTimeout` | 504 | `"Gateway Timeout"` |

#### Defining Custom Error Kinds
If the pre-built error constants don't cover your use case, you can define your own custom HTTP errors in three elegant ways:

##### A. Using the `httpError` Helper Function
Create standard lightweight errors with customizable message strings:
```ts
import { httpError } from "tomoejs"

// Define a custom status/message
const TeapotError = httpError(418, "I'm a teapot")
```

##### B. Using `HttpError` Constructor with Custom Payloads
For rich API responses (e.g. containing validation maps or specific error codes), instantiate `HttpError` directly. The third argument accepts a `details` object which gets automatically merged into the final JSON output:
```ts
import { HttpError, err } from "tomoejs"

app.post("/checkout", (ctx) => {
  if (insufficientFunds) {
    const error = new HttpError(402, "Payment Failed", {
      reason: "INSUFFICIENT_FUNDS",
      availableBalance: 12.50,
      required: 49.99
    })
    // Responds automatically with HTTP 402 and the JSON structure:
    // { "error": "Payment Failed", "reason": "INSUFFICIENT_FUNDS", "availableBalance": 12.5, "required": 49.99 }
    return err(error)
  }
})
```

##### C. OOP Subclassing
Inherit directly from the `HttpError` class to integrate with domain-driven workflows:
```ts
import { HttpError } from "tomoejs"

class DatabaseTimeout extends HttpError {
  constructor(query: string) {
    super(504, "Database connection timeout", { query, timestamp: Date.now() })
    this.name = "DatabaseTimeout"
  }
}
```

#### Thrown vs Functional Errors
You can return errors functionally via `err(...)` (which is highly optimized in V8 by bypassing stack trace collection) or throw them natively:
```ts
import { err, Unauthorized, NotFound } from "tomoejs"

// 1. Functional returns in Relics (No throw, extremely fast)
const authRelic = relic("user", async (ctx) => {
  const token = ctx.header("Authorization")
  if (!token) return err(Unauthorized) // Return functional error
  return db.verify(token)
})

// 2. Functional returns in Handlers
app.get("/user/:id", (ctx) => {
  const user = db.find(ctx.param("id"))
  if (!user) return err(NotFound) // Instantly sends 404
  return ctx.json(user)
})

// 3. Thrown exceptions inside Handlers (Tomoe catches these automatically)
app.get("/admin", (ctx) => {
  if (!ctx.user.isAdmin) {
    throw Forbidden // Auto-caught and converted to standard 403 response
  }
  return ctx.text("Welcome")
})
```

#### Global and Scope-level Error Overrides
You can intercept specific HTTP error statuses. When registered within a scope, they catch errors originating from **both relics and handlers** in that scope:

```ts
app.scope("/api", authRelic, (r) => {
  // Overrides all 401 Unauthorized errors in this prefix
  r.onError(401, (ctx) => {
    return ctx.json({ status: "error", message: "Please sign in to proceed" }, { status: 401 })
  })

  r.get("/profile", (ctx) => ctx.json(ctx.user))
})

// Global fallback handler for uncaught runtime exceptions
app.onError((err, ctx) => {
  console.error(err)
  return ctx?.json({ error: "Fatal Internal Crash" }, { status: 500 })
    ?? new Response("Fatal Error", { status: 500 })
})
```

---

### 9. Interactive OpenAPI & Swagger UI docs
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

### 10. Graph Inspection & Compilation
For peak production performance, Tomoe compiles the entire backtracking radix tree and middleware chains at startup. This validates your relics dependency chains completely **before** accepting requests.

```ts
const app = new Tomoe()
// ... register routes

// 1. Explicitly compile at startup (highly recommended in production)
app.compile()

// 2. Inspect dependency graph programmatically
const graph = app.graph()
console.log(`Routes registered: ${graph.routes.length}`)
console.log(`Tree Max Depth: ${graph.stats.maxDepth}`)
```

---

### 11. End-to-End Type-Safe Client SDK
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

### 12. Deployment & Runtimes (Deploy Anywhere)
Tomoe runs anywhere that supports modern Web Standards natively or through standard adapters.

#### A. Bun
Run natively at supreme speeds on the Bun JavaScript runtime:
```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Running natively on Bun!"))

export default app
```
Launch the server:
```bash
bun run --hot index.ts
```

#### B. Cloudflare Workers
Export the application fetch handler directly:
```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Running on Cloudflare Workers!"))

export default {
  fetch: app.fetch
}
```

#### C. Deno
Deno natively supports standard Request/Response handlers:
```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Running on Deno!"))

Deno.serve((req) => app.fetch(req))
```

#### D. Node.js
Deploy on standard legacy Node.js environments using the built-in `createServer` stream adapter:
```ts
import { Tomoe, createServer } from "tomoejs"

const app = new Tomoe()
app.get("/", (c) => c.text("Running on Node.js!"))

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
