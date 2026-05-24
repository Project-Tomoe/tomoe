import {
  Forbidden,
  NotFound,
  Tomoe,
  Unauthorized,
  err,
  guard,
  relic,
  swagger,
  unite,
} from "tomoejs"
import { z } from "zod"

// -----------------------------------------------------------------------------
// 💾 Mock Database
// -----------------------------------------------------------------------------
interface Anime {
  id: string
  title: string
  genres: string[]
  rating: number
  episodes: number
  synopsis: string
}

class InMemoryDb {
  private store: Map<string, Anime> = new Map()

  constructor() {
    this.seed()
  }

  private seed() {
    this.store.set("fmab", {
      id: "fmab",
      title: "Fullmetal Alchemist: Brotherhood",
      genres: ["Action", "Adventure", "Fantasy", "Drama"],
      rating: 9.1,
      episodes: 64,
      synopsis: "Two brothers search for the Philosopher's Stone to restore their bodies.",
    })
    this.store.set("aot", {
      id: "aot",
      title: "Attack on Titan",
      genres: ["Action", "Drama", "Fantasy", "Mystery"],
      rating: 9.0,
      episodes: 87,
      synopsis: "Humanity fights for survival against man-eating giants called Titans.",
    })
    this.store.set("hxh", {
      id: "hxh",
      title: "Hunter x Hunter",
      genres: ["Action", "Adventure", "Fantasy"],
      rating: 9.0,
      episodes: 148,
      synopsis: "Gon Freecss seeks to become a legendary Hunter and find his father.",
    })
    this.store.set("steins-gate", {
      id: "steins-gate",
      title: "Steins;Gate",
      genres: ["Sci-Fi", "Thriller", "Drama"],
      rating: 8.9,
      episodes: 24,
      synopsis: "A self-proclaimed mad scientist accidentally invents a time machine.",
    })
  }

  list(): Anime[] {
    return Array.from(this.store.values())
  }

  get(id: string): Anime | undefined {
    return this.store.get(id)
  }

  create(anime: Omit<Anime, "id">): Anime {
    const id = anime.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    const newAnime = { id, ...anime }
    this.store.set(id, newAnime)
    return newAnime
  }

  delete(id: string): boolean {
    return this.store.delete(id)
  }
}

// Global DB instance
const db = new InMemoryDb()

// -----------------------------------------------------------------------------
// 🌸 Relics & Guards (Contract Architecture)
// -----------------------------------------------------------------------------

// 1. Database Relic: injects our mock database context into routes
const dbRelic = relic("db", async () => {
  return db
})

// 2. API Key Guard: asserts client is authorized before executing mutations
const apiKeyGuard = guard(async (ctx) => {
  const authHeader = ctx.header("authorization")

  if (!authHeader) {
    return err(Unauthorized) // Emits 401
  }

  const token = authHeader.replace(/^Bearer\s+/, "")
  if (token !== "tomoe-secret-key") {
    return err(Forbidden) // Emits 403
  }
})

// -----------------------------------------------------------------------------
// 📦 Zod Schema Input Validation Relics
// -----------------------------------------------------------------------------

// Anime Creation Body Schema
const createAnimeSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters long"),
  genres: z.array(z.string()).min(1, "Specify at least 1 genre"),
  rating: z.number().min(0).max(10, "Rating must be between 0 and 10"),
  episodes: z.number().int().min(1, "Episodes must be at least 1"),
  synopsis: z.string().default("No synopsis available."),
})

// List Query Parameters Schema
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(10),
  genre: z.string().optional(),
})

// -----------------------------------------------------------------------------
// 🚀 Application Routing & Scopes
// -----------------------------------------------------------------------------
const app = new Tomoe()

// Serve interactive API docs on /docs
swagger(app, {
  title: "🌸 TomoeJS Anime API Examples",
  version: "1.0.0",
  path: "/docs",
  specPath: "/swagger.json",
})

// Global logging middleware
app.use("*", async (ctx, next) => {
  const start = performance.now()
  const response = await next()
  const duration = (performance.now() - start).toFixed(2)
  console.log(`[${ctx.req.method}] ${ctx.req.url} - ${response.status} (${duration}ms)`)
  return response
})

// --- PUBLIC ROUTE PREFIX ---
app.scope("/api", dbRelic, (r) => {
  // 1. Get List (with Zod query validation)
  r.get("/anime", relic.query(listQuerySchema), (ctx) => {
    // Both 'ctx.db' and 'ctx.query' are fully typed and contract-injected!
    const { limit, genre } = ctx.query
    let results = ctx.db.list()

    if (genre) {
      results = results.filter((a) => a.genres.some((g) => g.toLowerCase() === genre.toLowerCase()))
    }

    return ctx.json(results.slice(0, limit))
  })

  // 2. Get Single by ID
  r.get("/anime/:id", (ctx) => {
    const id = ctx.param("id")
    const anime = ctx.db.get(id)

    if (!anime) {
      return err(NotFound) // Emits 404
    }

    return ctx.json(anime)
  })
})

// --- PROTECTED MUTATION ROUTE PREFIX ---
// Groups endpoints that require both Db access AND API Authorization
const authenticatedMutation = unite(dbRelic, apiKeyGuard)

app.scope("/api", authenticatedMutation, (r) => {
  // Custom scope-level error overrides
  r.onError(401, (ctx) => {
    return ctx.json(
      {
        error: "Authentication Required",
        message: "Please pass 'Authorization: Bearer tomoe-secret-key' header.",
      },
      { status: 401 }
    )
  })

  r.onError(403, (ctx) => {
    return ctx.json(
      {
        error: "Access Forbidden",
        message: "The provided Bearer token is invalid.",
      },
      { status: 403 }
    )
  })

  // 3. Create Anime (with Zod body validation & authorization guard)
  r.post("/anime", relic.body(createAnimeSchema), (ctx) => {
    // 'ctx.body' is dynamically typed and guaranteed to be valid!
    const newAnime = ctx.db.create(ctx.body)
    return ctx.json(
      {
        success: true,
        message: "Anime cataloged successfully!",
        data: newAnime,
      },
      { status: 201 }
    )
  })

  // 4. Delete Anime (requires authorization guard)
  r.delete("/anime/:id", (ctx) => {
    const id = ctx.param("id")
    const deleted = ctx.db.delete(id)

    if (!deleted) {
      return err(NotFound)
    }

    return ctx.json({
      success: true,
      message: `Anime '${id}' has been permanently deleted.`,
    })
  })
})

// Compile radix tree routes and validation graph at startup
app.compile()

const PORT = 3000
console.log("\n🌸 TomoeJS Premium Anime API example running!")
console.log(`👉 Swagger UI Docs: http://localhost:${PORT}/docs`)
console.log(`👉 Public GET List: http://localhost:${PORT}/api/anime`)
console.log(`👉 Auth GET Secret: http://localhost:${PORT}/api/anime/fmab\n`)

export default {
  port: PORT,
  fetch: (req: Request) => app.fetch(req),
}
