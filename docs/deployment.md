# Deployment Guide

## Bun

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()
app.get("/health", (ctx) => ctx.json({ ok: true }))
app.compile()

Bun.serve({
  port: Number(process.env.PORT || 3000),
  fetch: (req) => app.fetch(req),
})
```

## Node.js

```ts
import { Tomoe, createServer } from "tomoejs"

const app = new Tomoe()
app.get("/health", (ctx) => ctx.json({ ok: true }))
app.compile()

const server = createServer(app)
const port = Number(process.env.PORT || 3000)

server.listen(port, () => {
  console.log(`Listening on http://127.0.0.1:${port}`)
})

const shutdown = () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
```

## Cloudflare Workers

```ts
import { Tomoe } from "tomoejs"

const app = new Tomoe()
app.get("/health", (ctx) => ctx.json({ ok: true }))
app.compile()

export default {
  fetch: app.fetch,
}
```

## Deno

```ts
import { Tomoe } from "npm:tomoejs"

const app = new Tomoe()
app.get("/health", (ctx) => ctx.json({ ok: true }))
app.compile()

Deno.serve((req) => app.fetch(req))
```

## Reverse Proxy Guidance

Set these at the proxy or platform layer:

- Maximum request body size.
- Request timeout and idle timeout.
- TLS termination.
- Trusted proxy headers.
- Access logs with sensitive header redaction.

For CSRF protection behind a proxy, pass the original host through `X-Forwarded-Host` and configure `csrf({ origin })` explicitly when requests can originate from multiple trusted hosts.
