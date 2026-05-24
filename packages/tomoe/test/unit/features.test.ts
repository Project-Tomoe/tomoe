import { Type } from "@sinclair/typebox"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { cors } from "../../src/middleware/cors"
import { logger } from "../../src/middleware/logger"
import { relic } from "../../src/relic/relic"
import { swagger } from "../../src/swagger"
import { Tomoe } from "../../src/tomoe"

describe("CORS, Logger, Form Data, and Swagger Features", () => {
  let app: Tomoe

  beforeEach(() => {
    app = new Tomoe()
  })

  describe("CORS Middleware", () => {
    it("should handle preflight OPTIONS requests", async () => {
      app.use(
        cors({
          origin: "https://example.com",
          methods: ["GET", "POST"],
          allowedHeaders: ["Content-Type", "Authorization"],
          credentials: true,
          maxAge: 86400,
        })
      )

      app.get("/test", (c) => c.text("ok"))

      const res = await app.fetch(
        new Request("http://localhost/test", {
          method: "OPTIONS",
          headers: {
            Origin: "https://example.com",
            "Access-Control-Request-Method": "POST",
          },
        })
      )

      expect(res.status).toBe(204)
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com")
      expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST")
      expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization")
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true")
      expect(res.headers.get("Access-Control-Max-Age")).toBe("86400")
    })

    it("should append CORS headers to normal requests", async () => {
      app.use(
        cors({
          origin: ["https://site-a.com", "https://site-b.com"],
        })
      )

      app.get("/data", (c) => c.json({ data: 42 }))

      const res = await app.fetch(
        new Request("http://localhost/data", {
          method: "GET",
          headers: {
            Origin: "https://site-b.com",
          },
        })
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://site-b.com")
    })

    it("should support origin check function", async () => {
      app.use(
        cors({
          origin: (origin) => origin.endsWith(".trusted.com"),
        })
      )

      app.get("/data", (c) => c.text("ok"))

      const resValid = await app.fetch(
        new Request("http://localhost/data", {
          method: "GET",
          headers: { Origin: "https://app.trusted.com" },
        })
      )
      expect(resValid.headers.get("Access-Control-Allow-Origin")).toBe("https://app.trusted.com")

      const resInvalid = await app.fetch(
        new Request("http://localhost/data", {
          method: "GET",
          headers: { Origin: "https://malicious.com" },
        })
      )
      expect(resInvalid.headers.get("Access-Control-Allow-Origin")).toBe("null")
    })
  })

  describe("Logger Middleware", () => {
    it("should log request details without breaking handler", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

      app.use(logger())
      app.get("/logged", (c) => c.text("hello log"))

      const res = await app.fetch(new Request("http://localhost/logged"))
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("hello log")
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe("Form Data Body Parsing", () => {
    const userSchema = z.object({
      username: z.string().min(3),
      age: z.string(), // Form entries are always strings in raw FormData
    })

    it("should parse and validate application/x-www-form-urlencoded body", async () => {
      app.post("/form", relic.body(userSchema), (c) => {
        return c.json({ parsed: c.body })
      })

      const body = new URLSearchParams()
      body.append("username", "gon_freecss")
      body.append("age", "12")

      const res = await app.fetch(
        new Request("http://localhost/form", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.parsed).toEqual({
        username: "gon_freecss",
        age: "12",
      })
    })

    it("should parse and validate multipart/form-data body", async () => {
      app.post("/multipart", relic.body(userSchema), (c) => {
        return c.json({ parsed: c.body })
      })

      const body = new FormData()
      body.append("username", "killua")
      body.append("age", "12")

      // Construct request (browser/runtime sets boundary automatically)
      const res = await app.fetch(
        new Request("http://localhost/multipart", {
          method: "POST",
          body,
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.parsed).toEqual({
        username: "killua",
        age: "12",
      })
    })
  })

  describe("OpenAPI / Swagger Generation", () => {
    it("should serve docs HTML and swagger JSON and correctly extract Zod/TypeBox schemas", async () => {
      const routeSchema = z.object({
        name: z.string(),
        role: z.enum(["admin", "user"]),
      })

      const querySchema = Type.Object({
        search: Type.String(),
        limit: Type.Optional(Type.Integer()),
      })

      app.post("/users", relic.body(routeSchema), (c) => c.text("ok"))
      app.get("/search", relic.query(querySchema), (c) => c.text("ok"))
      app.get("/user/:id", (c) => c.text("user")) // path param only

      // Register swagger endpoints
      swagger(app)

      // 1. Verify docs HTML path is registered
      const docsRes = await app.fetch(new Request("http://localhost/docs"))
      expect(docsRes.status).toBe(200)
      expect(docsRes.headers.get("Content-Type")).toContain("text/html")
      const htmlText = await docsRes.text()
      expect(htmlText).toContain("swagger-ui")

      // 2. Verify swagger JSON path serves correct schema
      const jsonRes = await app.fetch(new Request("http://localhost/swagger.json"))
      expect(jsonRes.status).toBe(200)
      expect(jsonRes.headers.get("Content-Type")).toContain("application/json")

      const doc = await jsonRes.json()
      expect(doc.openapi).toBe("3.0.0")
      expect(doc.info.title).toBe("Tomoe API Docs")

      // Check POST /users (Zod Schema Validation)
      expect(doc.paths["/users"]).toBeDefined()
      expect(doc.paths["/users"].post).toBeDefined()
      expect(doc.paths["/users"].post.requestBody).toBeDefined()
      expect(doc.paths["/users"].post.requestBody.content["application/json"].schema.type).toBe(
        "object"
      )
      expect(
        doc.paths["/users"].post.requestBody.content["application/json"].schema.properties.name.type
      ).toBe("string")
      expect(
        doc.paths["/users"].post.requestBody.content["application/json"].schema.properties.role.enum
      ).toEqual(["admin", "user"])

      // Check GET /search (TypeBox Schema Validation)
      expect(doc.paths["/search"]).toBeDefined()
      expect(doc.paths["/search"].get).toBeDefined()
      const params = doc.paths["/search"].get.parameters
      expect(params.length).toBe(2)
      expect(params.find((p: any) => p.name === "search").schema.type).toBe("string")
      expect(params.find((p: any) => p.name === "limit").schema.type).toBe("integer")

      // Check GET /user/:id (Fallback Path Parameter parsing)
      expect(doc.paths["/user/{id}"]).toBeDefined()
      expect(doc.paths["/user/{id}"].get.parameters[0].name).toBe("id")
      expect(doc.paths["/user/{id}"].get.parameters[0].in).toBe("path")
      expect(doc.paths["/user/{id}"].get.parameters[0].schema.type).toBe("string")
    })
  })
})
