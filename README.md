<p align="center">
  <img src="https://i.ibb.co/TxJjb0Y5/226421950.png" width="280" alt="Tomoe Logo"/>
</p>

<p align="center">
  <strong>The art of perfect balance</strong>
</p>

<p align="center">
  Lightweight · Type-Safe · Web Standards · Bun
</p>

---

## 🌸 The Philosophy of Tomoe

Tomoe is built on four core principles:

1. **Correctness by Construction**: Backend stability shouldn't rely on developer memory. If a route handler depends on something (like a verified database user), that precondition must be declared as a contract. If a contract isn't satisfied at startup, your application fails immediately rather than throwing runtime errors in production.
2. **Minimal Abstraction**: We do not invent custom wrappers around request or response objects. Tomoe runs directly on native Web Standard APIs (`Request` and `Response`), making it lightweight and natively portable across Bun, Cloudflare Workers, Node, and Deno.
3. **Developer Delight (Zero-Boilerplate Type Safety)**: TypeScript shouldn't require you to write verbose generics on every route. By using return-type inference and JavaScript Proxies, Tomoe automatically propagates typed parameters from your data providers directly onto the context object (e.g. `ctx.user`) with zero configuration.
4. **The Balance (巴)**: Tomoe represents the harmony between execution performance, strict type safety, and developer convenience.

---

## Stop trusting middleware

Most backend bugs come from one assumption:

> “this will be there when I need it”

Middleware makes that assumption easy — and wrong.

* You forget to register it
* You register it in the wrong order
* You access something that was never set

Everything compiles.
Everything deploys.
Then it breaks at runtime.

---

## Tomoe

Tomoe removes that assumption entirely.

If a route depends on something, it must be declared.
If it’s declared, it must be satisfied.
If it’s not satisfied, your app doesn’t start.

---

## Quick start

```bash
bun init
bun add tomoejs
```

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()

app.get("/", (c) => c.text("Hello Tomoe"))

export default app
```

```bash
bun run index.ts
```

---

## The shift

Instead of *hoping* something exists:

```ts
// ❌ Dangerous: 'user' might be undefined if middleware is misconfigured
app.use(authMiddleware)
app.get("/me", (c) => c.json(c.get("user")))
```

You define a contract:

```ts
import { relic, guard, err, Unauthorized, Forbidden } from "tomoejs"

// 1. Define a providing relic (infers return type as User)
const auth = relic("user", async (ctx) => {
  const user = await db.verify(ctx.req.headers.get("authorization"))
  if (!user) return err(Unauthorized)
  return user
})

// 2. Define a guard relic (validates a condition without providing values)
const adminOnly = guard(async (ctx, use) => {
  const user = use(auth) // Resolves auth relic dependency
  if (!user.isAdmin) return err(Forbidden)
})

// 3. Mount and consume (ctx.user is fully typed and guaranteed to exist!)
app.get("/me", auth, (ctx) => {
  return ctx.json(ctx.user) 
})
```

No guessing.
No undefined variables.
No ordering bugs.

---

## 🛠️ Built-in Schema Validation & Type-Safe Client

Tomoe has first-class support for **Standard Schema (Zod, ArkType, Valibot, etc.)** and **TypeBox**. When you validate inputs via schema relics, they are automatically typed in the handler and propagated to the E2E client.

```ts
import { relic } from "tomoejs"
import { z } from "zod"

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

// Validate request body
const validateBody = relic.body(userSchema)

const app = new Tomoe()
  .post("/users", validateBody, (ctx) => {
    // ctx.body is fully typed to userSchema's output!
    return ctx.json({ status: "created", user: ctx.body })
  })

export type AppRouter = typeof app
```

### E2E Type-Safe Client SDK
Connect your frontend directly with complete static type safety:

```ts
import { createClient } from "tomoejs"
import type { AppRouter } from "./server"

const client = createClient<AppRouter>("http://localhost:3000")

// Fully typed response, query, params, headers, and request body!
const { data, error } = await client("/users").post({
  body: { name: "Killua", email: "killua@zoldyck.com" }
})
```

---

## Execution model

```
Middleware ➡️ Relics ➡️ Handler
```

* Middleware controls request flow (CORS, logging)
* Relics define required state (auth, db queries, schema validation)
* Handlers stay pure

Relics are validated and optimized at startup.

---

## What you get

* Typed routing and parameters
* Native Web API request/response
* Composable middleware
* Contract-based data flow (Relics & Guards)
* Startup-time validation
* Backtracking radix router
* First-class Standard Schema & TypeBox validation relics
* E2E type-safe path-based Client SDK
* Scope-aware unified error pipeline & functional error returns (`err(...)`)

---

## Documentation

[Read Package Documentation ➡️](https://github.com/Project-Tomoe/tomoe/tree/main/packages/tomoe/README.md)

---

<p align="center">MIT License · Built with 🌸</p>
