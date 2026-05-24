<p align="center">
  <img src="https://i.ibb.co/TxJjb0Y5/226421950.png" width="280" alt="Tomoe Logo"/>
</p>

<p align="center"><strong>The art of perfect balance</strong></p>

<p align="center">
  Lightweight · Type-Safe · Web Standards · Bun
</p>

---

Tomoe is a backend framework built on Web Standard APIs. It is fast by design and correct by construction — its **Relic system** makes invalid route configurations fail at startup, not in production.

---

## 🌸 The Philosophy of Tomoe

Tomoe is built on four core principles:

1. **Correctness by Construction**: Backend stability shouldn't rely on developer memory. If a route handler depends on something (like a verified database user), that precondition must be declared as a contract. If a contract isn't satisfied at startup, your application fails immediately rather than throwing runtime errors in production.
2. **Minimal Abstraction**: We do not invent custom wrappers around request or response objects. Tomoe runs directly on native Web Standard APIs (`Request` and `Response`), making it lightweight and natively portable across Bun, Cloudflare Workers, Node, and Deno.
3. **Developer Delight (Zero-Boilerplate Type Safety)**: TypeScript shouldn't require you to write verbose generics on every route. By using return-type inference and JavaScript Proxies, Tomoe automatically propagates typed parameters from your data providers directly onto the context object (e.g. `ctx.user`) with zero configuration.
4. **The Balance (巴)**: Tomoe represents the harmony between execution performance, strict type safety, and developer convenience.

---

## Installation

```bash
bun add tomoejs
```

---

## Quick Start

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()

app.get("/", (c) => c.text("Hello from Tomoe"))

export default app
```

---

## Table of Contents

- [Routing](#routing)
  - [Sub-routers & app.route()](#sub-routers--approute)
- [Context](#context)
- [Middleware](#middleware)
- [Relics](#relics)
  - [Named Relics](#named-relics)
  - [Anonymous Relics](#anonymous-relics)
  - [Guard Relics](#guard-relics)
  - [unite()](#unite)
  - [Schema Validation Relics](#schema-validation-relics)
  - [Scopes](#scopes)
  - [Error Handling](#error-handling)
  - [Relic Dependencies](#relic-dependencies)
- [E2E Client SDK](#e2e-client-sdk)
- [Compile](#compile)
- [Different Port](#different-port)
- [Global Error Handler](#global-error-handler)

---

## Routing

```ts
app.get("/anime", handler)
app.post("/anime", handler)
app.put("/anime/:id", handler)
app.patch("/anime/:id", handler)
app.delete("/anime/:id", handler)
```

### Path parameters

Path parameter names are automatically parsed from the route string at compile-time and are fully typed:

```ts
app.get("/anime/:name/character/:char", (c) => {
  const name = c.param("name")  // typed string — autocomplete supported
  const char = c.param("char")  // typed string — autocomplete supported
  return c.json({ name, char })
})
```

### Wildcards

```ts
app.get("/static/*", (c) => {
  const file = c.params["*"] // contains matched remainder
  return c.text(`static file: ${file}`)
})
```

### Sub-routers & `app.route()`

You can structure your application by splitting endpoints into sub-routers and mounting them using `app.route()`. Sub-routers inherit route prefixing and optional relic protection.

```ts
import { Tomoe, relic } from "tomoejs"

// Sub-router
const animeRouter = new Tomoe()
animeRouter.get("/list", (c) => c.json(["FMA", "Hunter x Hunter"]))
animeRouter.get("/:id", (c) => c.json({ id: c.param("id") }))

const app = new Tomoe()

// Mount with prefix. Accessible at `/api/anime/list` and `/api/anime/1`
app.route("/api/anime", animeRouter)

// Protect all sub-routes with a Relic during mount
app.route("/admin/anime", authRelic, animeRouter)
```

---

## Context

Every handler receives a `ctx` (or `c`) object. It wraps the native `Request` and provides response helpers.

```ts
app.get("/example/:id", (c) => {
  // Request
  c.req                          // native Request object
  c.req.method                   // "GET"
  c.req.url                      // full URL string

  // Path params
  c.param("id")                  // typed string

  // Query params
  c.query("page")                // string | undefined
  c.queries                      // Record<string, string>

  // Headers
  c.header("Authorization")      // string | null

  // Middleware env
  c.get("requestId")             // typed from middleware Env
  c.set("requestId", "abc-123")

  // Responses
  return c.json({ ok: true })
  return c.json({ ok: true }, { status: 201 })
  return c.text("Hello")
  return c.html("<h1>Hello</h1>")
  return c.redirect("/login")
  return c.redirect("/gone", 301)
  return c.notFound()
  return c.notFound("Custom 404 message")
})
```

---

## Middleware

Middleware handles the *flow* of the request — logging, compression, CORS, tracing. It runs before and after the handler.

```ts
// Global — runs on every route
app.use(async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`)
  return next()
})

// Scoped — runs only on routes under /anime
app.use("/anime/*", async (c, next) => {
  console.log("anime route hit")
  return next()
})
```

---

## Relics

Relics are Tomoe's answer to a real problem: traditional middleware cannot guarantee that what it provides actually exists when a handler runs. 

Relics solve this with **explicit, compile-time validated contracts**.

### Named Relics

A named relic executes async logic, binds the return value to a property key, and merges it directly into the context object (`ctx`).

```ts
import { relic, err, Unauthorized } from "tomoejs"

// 1. Define the relic (TypeScript infers the return type as User)
const auth = relic("user", async (ctx) => {
  const token = ctx.req.headers.get("authorization")
  const user = await db.users.verify(token)

  if (!user) return err(Unauthorized) // stops chain and responds
  return user
})

// 2. Consume it (ctx.user is fully typed and guaranteed to be present)
app.get("/me", auth, (ctx) => {
  return ctx.json(ctx.user)
})
```

No generic annotations or type casting. Type inference flows automatically from your return statement.

---

### Anonymous Relics

If you prefer to avoid strings or naming properties, you can define anonymous relics. They are consumed by referencing the relic object directly in the handler:

```ts
// 1. Define anonymous relic
const auth = relic(async (ctx) => {
  const user = await db.users.verify(ctx.req.headers.get("authorization"))
  if (!user) return err(Unauthorized)
  return user
})

// 2. Consume by reference
app.get("/me", auth, (ctx) => {
  const user = ctx.relic(auth) // Statically typed as User
  return ctx.json(user)
})
```

---

### Guard Relics

Guards validate a condition but provide no data. They are pure precondition checks.

```ts
import { guard, err, Forbidden } from "tomoejs"

// auth is a ProvidingRelic from above
const adminOnly = guard(async (ctx, use) => {
  const user = use(auth) // Resolves auth relic dependency
  if (!user.isAdmin) return err(Forbidden)
})
```

---

### `unite()`

`unite()` combines multiple relics into a reusable access policy. Relics execute left-to-right.

```ts
import { unite } from "tomoejs"

const userAccess  = unite(auth)
const adminAccess = unite(auth, orgRelic, adminOnly)

// Reuse across scopes
app.scope("/user",  userAccess,  (r) => { ... })
app.scope("/admin", adminAccess, (r) => { ... })
```

---

### Schema Validation Relics

Tomoe provides first-class schema validation relics out-of-the-box supporting any library conforming to the [Standard Schema v1 specification](https://github.com/standard-schema/standard-schema) (like Zod, ArkType, Valibot) as well as TypeBox.

These validation relics inject type-safe, parsed and cleaned inputs directly into context properties:
- `relic.body(schema)` injects into `ctx.body`
- `relic.query(schema)` injects into `ctx.query`
- `relic.params(schema)` injects into `ctx.params` (overriding route path param typings)
- `relic.headers(schema)` injects into `ctx.headers`

If validation fails, Tomoe automatically responds with a `400 Bad Request` and details containing the validation issues (no need to write boilerplate try-catch blocks in your route handlers).

#### Validation with Zod

```ts
import { relic } from "tomoejs"
import { z } from "zod"

const userSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  role: z.enum(["admin", "user"]).optional()
})

const validateBody = relic.body(userSchema)

app.post("/register", validateBody, (ctx) => {
  // ctx.body is fully typed as: { username: string; email: string; role?: "admin" | "user" }
  const { username, email } = ctx.body
  return ctx.json({ username, email })
})
```

#### Validation with TypeBox

For TypeBox, Tomoe natively cleans and validates TypeBox schemas automatically:

```ts
import { relic } from "tomoejs"
import { Type } from "@sinclair/typebox"

const querySchema = Type.Object({
  search: Type.String(),
  limit: Type.Optional(Type.Integer())
})

app.get("/search", relic.query(querySchema), (ctx) => {
  // ctx.query is typed with TypeBox schema properties
  const { search, limit } = ctx.query
  return ctx.json({ search, limit })
})
```

---

### Scopes

`app.scope()` creates a route group protected by a relic group. All routes inside are automatically prefixed and have type-safe access to the relic properties:

```ts
app.scope("/admin", adminAccess, (r) => {
  r.get("/dashboard", (ctx) => {
    // Both user and org properties are fully typed and accessible!
    return ctx.json({
      user: ctx.user,
      org:  ctx.org,
    })
  })
})
```

---

### Error Handling

Tomoe supports a **Unified Scope-Aware Error Pipeline** which allows handling errors cleanly through functional return styles or standard exceptions. 

#### Thrown vs Functional Errors
Throwing exceptions in JavaScript is expensive because V8 collects the entire call stack. For expected domain errors (like auth failures, validation errors, or resource not found), Tomoe provides a zero-overhead functional error return:

```ts
import { relic, err, httpError, Unauthorized, NotFound } from "tomoejs"

// 1. Defining custom errors with additional context
const RateLimited = httpError(429, "Too many requests")
const ValidationError = httpError(400, "Validation failed", { details: { reason: "Missing field" } })

// 2. Functional return inside a relic
const auth = relic("user", async (ctx) => {
  const user = await verifyToken(ctx.req.headers.get("Authorization"))
  if (!user) {
    // Returns an Err result without throwing! Extremely fast.
    return err(Unauthorized) 
  }
  return user
})

// 3. Functional return inside a route handler
app.get("/user/:id", (ctx) => {
  const user = db.find(ctx.param("id"))
  if (!user) {
    return err(NotFound) // Functional error return
  }
  return ctx.json(user)
})
```

#### Custom and Scope-Level Error Handlers
You can override default error responses for specific HTTP status codes by registering custom handlers. If you register them within a scope using `r.onError(...)`, they will catch errors originating from **both relics and route handlers** within that scope:

```ts
app.scope("/api/v1", authRelic, (r) => {
  // Catch any 401 Unauthorized within this scope (from authRelic or handlers)
  r.onError(401, (ctx) => {
    return ctx.json({ status: "error", message: "Please authenticate" }, { status: 401 })
  })

  r.get("/profile", (ctx) => {
    // If authRelic failed and returned err(Unauthorized), the onError(401) runs
    return ctx.json(ctx.user)
  })
})
```

---

### Relic Dependencies

Relics can depend on other relics by calling `use()` inside their handler.

```ts
const orgRelic = relic("org", async (ctx, use) => {
  const user = use(auth) // 'auth' must appear before 'orgRelic' in the route chain
  const org = await db.orgs.forUser(user.id)
  if (!org) return err(Forbidden)
  return org
})

// Correct unite order: auth provides context, orgRelic consumes it
const adminAccess = unite(auth, orgRelic, adminOnly)
```

If you call `use(auth)` but the route doesn't mount `auth` earlier in the chain, Tomoe will throw an error at **startup**, preventing buggy configurations from reaching production.

---

## E2E Client SDK

Tomoe comes with a built-in client fetch wrapper (`createClient`) that inherits the exact type signature of your backend application. It matches endpoint paths, HTTP methods, headers, query parameters, route parameters, request body schemas, and typed responses.

#### 1. Export your App Router type
On your server entrypoint:

```ts
import { Tomoe, relic } from "tomoejs"
import { z } from "zod"

const app = new Tomoe()
  .get("/posts/:id", (c) => {
    return c.json({ id: c.param("id"), title: "Tomoe is awesome" })
  })
  .post("/posts", relic.body(z.object({ title: z.string() })), (c) => {
    return c.json({ id: "123", title: c.body.title })
  })

export type AppRouter = typeof app
```

#### 2. Consume in client-side code
Import the type and instantiate the client:

```ts
import { createClient } from "tomoejs"
import type { AppRouter } from "./server"

const client = createClient<AppRouter>("https://api.my-app.com")

// GET request: route parameters are fully type-checked!
const { data: post, status } = await client("/posts/:id").get({
  params: { id: "123" }
})
console.log(post.title) // autocomplete and type validation works!

// POST request: body validation matched against backend Zod schema!
const { data: newPost, error } = await client("/posts").post({
  body: { title: "Super Fast Web Apps" } // type-safe body input
})
```

---

## Compile

```ts
app.compile()
```

`compile()` builds the backtracking radix tree and compiles middleware chains. If omitted, Tomoe compiles automatically on the first request. Explicit compilation is recommended in production so that configuration errors (such as invalid relic chains) throw immediately at startup.

---

## Different Port

```ts
// Default — Bun uses port 3000
export default app

// Custom port
export default {
  port: 4000,
  fetch: (req: Request) => app.fetch(req),
}
```

---

## Global Error Handler

By default, uncaught exceptions return `{ "error": "Internal Server Error" }` with a 500 status.

To customize this in development:

```ts
app.onError((err, ctx) => {
  console.error(err)
  return ctx?.json(
    { error: String(err) },
    { status: 500 }
  ) ?? new Response("Error", { status: 500 })
})
```

---

## License

MIT