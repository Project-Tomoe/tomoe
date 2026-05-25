import { Forbidden, Tomoe, err, guard, relic, unite } from "../packages/tomoe/dist/index.js"

type BunServer = {
  port: number
  stop: () => void
}

const runtime = globalThis as typeof globalThis & {
  Bun?: {
    serve: (options: {
      port: number
      fetch: (request: Request) => Response | Promise<Response>
    }) => BunServer
  }
}

if (!runtime.Bun) {
  throw new Error("Bun runtime is required for this smoke test")
}

const app = new Tomoe()

const userRelic = relic("user", (ctx) => ({
  id: ctx.header("x-user-id") ?? "anonymous",
  role: ctx.header("x-role") ?? "member",
}))

const adminGuard = guard((_ctx, use) => {
  if (use(userRelic).role !== "admin") return err(Forbidden)
})

app.get("/health", (ctx) => ctx.json({ ok: true }))
app.get("/profile/:id", userRelic, (ctx) => ctx.json({ id: ctx.param("id"), user: ctx.user }))
app.post("/admin", unite(userRelic, adminGuard), async (ctx) => {
  return ctx.json({ user: ctx.user, body: await ctx.req.json() })
})

app.compile()

const server = runtime.Bun.serve({
  port: 0,
  fetch: (request) => app.fetch(request),
})

try {
  const baseUrl = `http://127.0.0.1:${server.port}`

  const health = await fetch(`${baseUrl}/health`)
  if (health.status !== 200 || !(await health.json()).ok) {
    throw new Error(`Unexpected health response: ${health.status}`)
  }

  const profile = await fetch(`${baseUrl}/profile/saif`, {
    headers: { "X-User-Id": "saif" },
  })
  const profileBody = await profile.json()
  if (profile.status !== 200 || profileBody.id !== "saif" || profileBody.user.id !== "saif") {
    throw new Error(`Unexpected profile response: ${profile.status} ${JSON.stringify(profileBody)}`)
  }

  const forbidden = await fetch(`${baseUrl}/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Role": "member" },
    body: JSON.stringify({ ok: true }),
  })
  if (forbidden.status !== 403) {
    throw new Error(`Expected forbidden admin response, got ${forbidden.status}`)
  }

  const admin = await fetch(`${baseUrl}/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Role": "admin",
      "X-User-Id": "root",
    },
    body: JSON.stringify({ ok: true }),
  })
  const adminBody = await admin.json()
  if (admin.status !== 200 || adminBody.user.role !== "admin" || adminBody.body.ok !== true) {
    throw new Error(`Unexpected admin response: ${admin.status} ${JSON.stringify(adminBody)}`)
  }

  console.log("Bun smoke passed")
} finally {
  server.stop()
}
