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

## Stop trusting middleware

Most backend bugs come from one assumption:

> “this will be there when I need it”

Middleware makes that assumption easy — and wrong.

* You forget to register it
* You register it in the wrong order
* You access something that was never set

Everything compiles.
Everything deploys.
Then it breaks.

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
app.use(authMiddleware)
app.get("/me", (c) => c.json(c.get("user"))) // maybe
```

You define a contract:

```ts
import { relic, token, unite, err, Unauthorized } from "tomoejs"

const UserCtx = token<{ id: string }>("user")

const authRelic = relic(UserCtx, async (ctx) => {
  const user = await db.verify(ctx.req.headers.get("authorization"))
  if (!user) return err(Unauthorized)
  return user
})


app.get("/me", authRelic, (ctx) => {
    return ctx.json(ctx.relic(UserCtx)) // guaranteed
  })
```

No guessing.
No undefined.
No order bugs.

---

## Execution model

```
Middleware → Relics → Handler
```

* Middleware controls flow
* Relics define required state
* Handlers stay pure

Relics are validated at startup.

---

## What you get

* Typed routing and params
* Native Web API request/response
* Composable middleware
* Contract-based data flow (Relics)
* Startup-time validation

---

## Documentation

[Read Documentation →](https://github.com/Project-Tomoe/tomoe/tree/main/packages/tomoe/README.md)

---

## Why "Tomoe"?

A *tomoe* (巴) represents balance — the same balance between:

* performance
* type safety
* developer experience

---

<p align="center">MIT License · Built with 🌸</p>
