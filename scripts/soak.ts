import {
  Forbidden,
  Tomoe,
  cors,
  createServer,
  err,
  guard,
  rateLimit,
  relic,
  unite,
} from "../packages/tomoe/src/index"

const TOTAL_REQUESTS = Number.parseInt(process.env.TOMOE_SOAK_REQUESTS ?? "1000", 10)
const CONCURRENCY = Number.parseInt(process.env.TOMOE_SOAK_CONCURRENCY ?? "50", 10)

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index] ?? 0
}

function createSoakApp() {
  const app = new Tomoe()

  app.use(cors({ origin: "*", methods: ["GET", "POST"] }))
  app.use(rateLimit({ windowMs: 60_000, max: TOTAL_REQUESTS + 100 }))

  const userRelic = relic("user", (ctx) => ({
    id: ctx.header("x-user-id") ?? "anonymous",
    role: ctx.header("x-role") ?? "member",
  }))

  const dbRelic = relic("db", () => ({
    books: {
      findById: (id: string) => ({ id, title: `Book ${id}` }),
    },
  }))

  const adminGuard = guard((_ctx, use) => {
    const user = use(userRelic)
    if (user.role !== "admin") return err(Forbidden)
  })

  const memberAccess = unite(userRelic, dbRelic)
  const adminAccess = unite(memberAccess, adminGuard)

  app.get("/json", (ctx) => ctx.json({ ok: true }))

  app.get("/books/:id", memberAccess, (ctx) => {
    return ctx.json({
      user: ctx.user,
      book: ctx.db.books.findById(ctx.param("id")),
    })
  })

  app.post("/admin/books/:id", adminAccess, async (ctx) => {
    return ctx.json({
      user: ctx.user,
      book: ctx.db.books.findById(ctx.param("id")),
      body: await ctx.req.json(),
    })
  })

  app.compile()
  return app
}

async function listen(app: Tomoe) {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address")
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function close(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}

async function runRequest(baseUrl: string, index: number) {
  const start = performance.now()
  let res: Response

  if (index % 10 === 0) {
    res = await fetch(`${baseUrl}/admin/books/${index}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": `admin-${index}`,
        "X-Role": "admin",
      },
      body: JSON.stringify({ request: index }),
    })
  } else if (index % 2 === 0) {
    res = await fetch(`${baseUrl}/books/${index}`, {
      headers: { "X-User-Id": `member-${index}` },
    })
  } else {
    res = await fetch(`${baseUrl}/json`)
  }

  const body = await res.text()
  const duration = performance.now() - start

  if (!res.ok) {
    throw new Error(`Request ${index} failed with ${res.status}: ${body}`)
  }

  return duration
}

async function runSoak() {
  const app = createSoakApp()
  const { server, baseUrl } = await listen(app)
  const latencies: number[] = []
  const startedAt = performance.now()

  try {
    let nextIndex = 0

    async function worker() {
      while (nextIndex < TOTAL_REQUESTS) {
        const current = nextIndex++
        latencies.push(await runRequest(baseUrl, current))
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  } finally {
    await close(server)
  }

  const totalMs = performance.now() - startedAt
  const summary = {
    requests: TOTAL_REQUESTS,
    concurrency: CONCURRENCY,
    totalMs: Math.round(totalMs),
    requestsPerSecond: Math.round((TOTAL_REQUESTS / totalMs) * 1000),
    p50Ms: Math.round(percentile(latencies, 50) * 100) / 100,
    p95Ms: Math.round(percentile(latencies, 95) * 100) / 100,
    p99Ms: Math.round(percentile(latencies, 99) * 100) / 100,
  }

  console.log(JSON.stringify(summary, null, 2))
}

runSoak().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
