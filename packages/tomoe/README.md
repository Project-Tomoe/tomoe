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
- [Context](#context)
- [Middleware](#middleware)
- [Relics](#relics)
  - [Tokens](#tokens)
  - [Providing Relics](#providing-relics)
  - [Guard Relics](#guard-relics)
  - [unite()](#unite)
  - [Scopes](#scopes)
  - [Error Handling](#error-handling)
  - [Relic Dependencies](#relic-dependencies)
- [Compile](#compile)
- [Different Port](#different-port)

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

```ts
app.get("/anime/:name/character/:char", (c) => {
  const name = c.param("name")  // typed — TS knows "name" exists
  const char = c.param("char")  // typed — TS knows "char" exists
  return c.json({ name, char })
})
```

### Wildcard

```ts
app.get("/static/*", (c) => {
  // c.param("*") — the matched remainder
  return c.text("static file")
})
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
  c.get("user")                  // typed from middleware Env
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

// Wrap — run logic before AND after handler
app.use(async (c, next) => {
  const start = Date.now()
  const response = await next()
  console.log(`${Date.now() - start}ms`)
  return response
})

// Short-circuit — stop the request entirely
app.use(async (c, next) => {
  if (!c.header("X-Api-Key")) {
    return c.json({ error: "Missing API key" }, { status: 401 })
  }
  return next()
})
```

### Typed middleware

```ts
import type { Middleware } from "tomoejs"

const authMiddleware: Middleware<{ user: User }> = async (c, next) => {
  const user = await getUser(c.header("Authorization"))
  c.set("user", user)
  return next()
}

app.use(authMiddleware)

app.get("/me", (c) => {
  const user = c.get("user")  // typed as User
  return c.json(user)
})
```

---

## Relics

Relics are Tomoe's answer to a real problem: middleware can't guarantee that what it provides actually exists when a handler needs it. You can register middleware in the wrong order, forget it on a route, and find out at runtime.

Relics solve this with **explicit typed contracts**:
- A relic declares what it **provides** (a typed token)
- The framework validates the chain **at startup**
- Handlers only receive what their scope's relics guarantee

### Tokens

A token is a typed unique identity. It's the contract between a relic that provides a value and a handler that consumes it.

```ts
import { token } from "tomoejs"

const UserCtx = token<{ id: string; email: string; isAdmin: boolean }>("user")
const OrgCtx  = token<{ orgId: string; plan: "free" | "pro" }>("org")
```

Tokens replace string keys entirely. No typos. Full autocomplete. The name is only for debug messages.

---

### Providing Relics

A providing relic runs async logic and binds the return value to a token.

```ts
import { relic, err, Unauthorized } from "tomoejs"

const authRelic = relic(UserCtx, async (ctx) => {
  const token = ctx.req.headers.get("authorization")
  const user = await db.users.verify(token)

  if (!user) return err(Unauthorized)  // signals error — stops chain
  return user                           // success — bound to UserCtx
})
```

**No `ok()` wrapper needed.** Just return the value. Only errors need explicit marking with `err()`.

---

### Guard Relics

A guard relic validates a condition but provides no value. It's a pure precondition check.

```ts
import { relic, err, Forbidden } from "tomoejs"

const adminGuard = relic(async (ctx, use) => {
  const user = use(UserCtx)              // resolves from earlier relic in chain
  if (!user.isAdmin) return err(Forbidden)
  // return nothing — guards provide no value
})
```

---

### `unite()`

`unite()` combines relics into a named, reusable access policy. Relics execute left to right.

```ts
import { unite } from "tomoejs"

// Define once
const userAccess  = unite(authRelic)
const adminAccess = unite(authRelic, orgRelic, adminGuard)

// Reuse across as many scopes as needed
app.scope("/user",  userAccess,  (r) => { ... })
app.scope("/admin", adminAccess, (r) => { ... })
app.scope("/api",   userAccess,  (r) => { ... })
```

`adminAccess` is a first-class value — name it, export it, share it across files.

---

### Scopes

`app.scope()` creates a route group under a path prefix, protected by a relic group.

```ts
app.scope("/user", userAccess, (r) => {
  r.get("/me", (ctx) => {
    const user = ctx.relic(UserCtx)  // typed as User — guaranteed present
    return ctx.json(user)
  })

  r.post("/settings", async (ctx) => {
    const user = ctx.relic(UserCtx)
    const body = await ctx.req.json()
    await db.users.update(user.id, body)
    return ctx.json({ updated: true })
  })
})

app.scope("/admin", adminAccess, (r) => {
  r.get("/dashboard", (ctx) => {
    const user = ctx.relic(UserCtx)  // typed as User
    const org  = ctx.relic(OrgCtx)   // typed as Org
    return ctx.json({ user, org })
  })
})
```

Routes inside a scope are automatically prefixed. `/me` inside `/user` becomes `/user/me`.

Public routes outside scopes are unaffected:

```ts
app.get("/health", (c) => c.text("ok"))  // no relics — runs freely
app.scope("/private", userAccess, (r) => {
  r.get("/data", (ctx) => ctx.text("protected"))
})
```

---

### Error Handling

Errors carry their own HTTP semantics. Define once, use everywhere.

```ts
import { httpError, Unauthorized, Forbidden, NotFound } from "tomoejs"

// Pre-built errors
Unauthorized  // 401
Forbidden     // 403
NotFound      // 404
BadRequest    // 400
Conflict      // 409

// Custom errors
const RateLimited = httpError(429, "Slow down")
const Suspended   = httpError(403, "Account suspended")
```

When a relic returns `err(Unauthorized)`, the framework automatically responds with:

```json
{ "error": "Unauthorized" }
```

with status `401`. **No `onError()` needed** unless you want non-default behavior.

#### Custom error behavior

```ts
// Only write onError() when you want something different from the default JSON response
app.scope("/web", userAccess, (r) => {
  r.onError(401, (ctx) => ctx.redirect("/login"))  // redirect instead of JSON
  r.get("/home", (ctx) => ctx.html("<h1>Home</h1>"))
})
```

`onError()` only accepts status codes that the scope's relic chain can actually produce. If `401` isn't possible in this scope, it's a mistake — catch it in review, not production.

---

### Relic Dependencies

Relics can depend on each other using `use()` inside the function. Calling `use(Token)` resolves the value provided by an earlier relic in the chain.

```ts
const orgRelic = relic(OrgCtx, async (ctx, use) => {
  const user = use(UserCtx)            // UserCtx must be provided earlier in unite()
  const org  = await db.orgs.forUser(user.id)
  if (!org) return err(Forbidden)
  return org
})

// unite() order determines execution order
// authRelic runs first → provides UserCtx → orgRelic can use(UserCtx)
const adminAccess = unite(authRelic, orgRelic, adminGuard)
```

If you call `use(UserCtx)` but no relic in the chain provides `UserCtx`, the framework throws at startup — not at request time.

---

### Full Example

```ts
import {
  Tomoe,
  relic, token, unite,
  err, httpError,
  Unauthorized, Forbidden
} from "tomoejs"

// ── Tokens ──────────────────────────────────────────────────────
const UserCtx = token<{ id: string; email: string; isAdmin: boolean }>("user")
const OrgCtx  = token<{ orgId: string; plan: "free" | "pro" }>("org")

// ── Errors ──────────────────────────────────────────────────────
const Suspended = httpError(403, "Account suspended")

// ── Relics ──────────────────────────────────────────────────────
const authRelic = relic(UserCtx, async (ctx) => {
  const user = await db.users.verify(ctx.req.headers.get("authorization"))
  if (!user)           return err(Unauthorized)
  if (user.suspended)  return err(Suspended)
  return user
})

const orgRelic = relic(OrgCtx, async (ctx, use) => {
  const user = use(UserCtx)
  const org  = await db.orgs.forUser(user.id)
  if (!org) return err(Forbidden)
  return org
})

const adminGuard = relic(async (ctx, use) => {
  const user = use(UserCtx)
  if (!user.isAdmin) return err(Forbidden)
})

// ── Access policies ──────────────────────────────────────────────
const userAccess  = unite(authRelic)
const adminAccess = unite(authRelic, orgRelic, adminGuard)

// ── App ──────────────────────────────────────────────────────────
const app = new Tomoe()

// Global middleware
app.use(async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`)
  return next()
})

// Public routes — no relics
app.get("/health", (c) => c.text("ok"))
app.get("/", (c) => c.html("<h1>Welcome</h1>"))

// User routes — requires auth
app.scope("/user", userAccess, (r) => {
  r.get("/me", (ctx) => {
    return ctx.json(ctx.relic(UserCtx))
  })

  r.post("/settings", async (ctx) => {
    const user = ctx.relic(UserCtx)
    const body = await ctx.req.json()
    await db.users.update(user.id, body)
    return ctx.json({ updated: true })
  })
})

// Admin routes — requires auth + org + admin flag
app.scope("/admin", adminAccess, (r) => {
  r.get("/dashboard", (ctx) => {
    return ctx.json({
      user: ctx.relic(UserCtx),
      org:  ctx.relic(OrgCtx),
    })
  })
})

// Web routes — same auth, different error behavior
app.scope("/web", userAccess, (r) => {
  r.onError(401, (ctx) => ctx.redirect("/login"))
  r.get("/home", (ctx) => {
    const user = ctx.relic(UserCtx)
    return ctx.html(`<h1>Welcome, ${user.email}</h1>`)
  })
})

app.compile()
export default app
```

---

## Compile

```ts
app.compile()
```

Calling `compile()` builds the optimized radix tree and middleware chains at startup. If you skip it, Tomoe compiles automatically on the first request. Explicit compile is recommended for production — you want startup errors (like invalid relic chains) to surface before serving traffic.

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

By default, uncaught handler errors return `{ "error": "Internal Server Error" }` with status 500. No details leak to the client.

Override for development:

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