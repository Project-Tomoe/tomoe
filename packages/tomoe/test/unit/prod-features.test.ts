import { describe, it, expect, beforeEach } from "vitest";
import { Tomoe } from "../../src/tomoe";
import { csrf } from "../../src/middleware/csrf";
import { rateLimit } from "../../src/middleware/rate-limit";
import { swagger } from "../../src/swagger";

describe("Cookies, CSRF, Rate Limiting, and Swagger Customization", () => {
  let app: Tomoe;

  beforeEach(() => {
    app = new Tomoe();
  });

  describe("Cookie Management", () => {
    it("should parse request cookies and set response cookies", async () => {
      app.get("/cookie", (c) => {
        const token = c.cookie("session_token");
        c.setCookie("response_cookie", "hello", { httpOnly: true, secure: true });
        return c.json({ token });
      });

      const res = await app.fetch(
        new Request("http://localhost/cookie", {
          headers: {
            "Cookie": "session_token=abc-123; user=saif",
          },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBe("abc-123");

      // Verify Set-Cookie header
      const setCookie = res.headers.get("Set-Cookie");
      expect(setCookie).toBe("response_cookie=hello; HttpOnly; Secure");
    });

    it("should return 500 status on invalid cookie names in setCookie", async () => {
      app.get("/invalid-cookie", (c) => {
        c.setCookie("bad=cookie;name", "value");
        return c.text("ok");
      });

      const res = await app.fetch(new Request("http://localhost/invalid-cookie"));
      expect(res.status).toBe(500);
    });
  });

  describe("CSRF Protection Middleware", () => {
    it("should allow safe methods without validation", async () => {
      app.use(csrf());
      app.get("/safe", (c) => c.text("ok"));

      const res = await app.fetch(new Request("http://localhost/safe"));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should block POST requests with missing Origin/Referer", async () => {
      app.use(csrf());
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", { method: "POST" })
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CSRF check failed (Missing Origin/Referer)");
    });

    it("should block POST requests with malicious Origin", async () => {
      app.use(csrf());
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", {
          method: "POST",
          headers: {
            "Origin": "http://malicious.com",
            "Host": "localhost:3000",
          },
        })
      );
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CSRF check failed (Invalid Origin)");
    });

    it("should allow POST requests with matching Host", async () => {
      app.use(csrf());
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", {
          method: "POST",
          headers: {
            "Origin": "http://localhost",
            "Host": "localhost",
          },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should allow custom origins configuration", async () => {
      app.use(csrf({ origin: "http://trusted-partner.com" }));
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", {
          method: "POST",
          headers: {
            "Origin": "http://trusted-partner.com",
            "Host": "localhost",
          },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should allow POST requests with matching X-Forwarded-Host", async () => {
      app.use(csrf());
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", {
          method: "POST",
          headers: {
            "Origin": "http://my-domain.com",
            "X-Forwarded-Host": "my-domain.com",
          },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });

    it("should match custom origins regardless of leading protocols or ports", async () => {
      app.use(csrf({ origin: "https://my-partner.com:8443" }));
      app.post("/unsafe", (c) => c.text("ok"));

      const res = await app.fetch(
        new Request("http://localhost/unsafe", {
          method: "POST",
          headers: {
            "Origin": "http://my-partner.com:3000",
            "Host": "localhost",
          },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });
  });

  describe("Rate Limiting Middleware", () => {
    it("should block requests exceeding limit in window and set Retry-After", async () => {
      app.use(rateLimit({ windowMs: 2000, max: 2 }));
      app.get("/rate-limited", (c) => c.text("ok"));

      // Request 1: Allow
      const res1 = await app.fetch(new Request("http://localhost/rate-limited"));
      expect(res1.status).toBe(200);
      expect(res1.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(res1.headers.get("X-RateLimit-Remaining")).toBe("1");

      // Request 2: Allow
      const res2 = await app.fetch(new Request("http://localhost/rate-limited"));
      expect(res2.status).toBe(200);
      expect(res2.headers.get("X-RateLimit-Remaining")).toBe("0");

      // Request 3: Block (429)
      const res3 = await app.fetch(new Request("http://localhost/rate-limited"));
      expect(res3.status).toBe(429);
      const data = await res3.json();
      expect(data.error).toBe("Too Many Requests");
      expect(res3.headers.get("Retry-After")).toBeDefined();
    });

    it("should evict rate limiter keys when Map size exceeds 10000", async () => {
      const middleware = rateLimit({ windowMs: 10000, max: 2 });
      const next = () => Promise.resolve(new Response("ok"));

      // Request 1 & 2 for 1.2.3.0 -> reaches limit
      const mockCtx0 = {
        header: (name: string) => name === "X-Forwarded-For" ? "1.2.3.0" : null,
        req: { method: "GET", url: "http://localhost/" }
      } as any;
      await middleware(mockCtx0, next);
      await middleware(mockCtx0, next);

      // Now fill map with 10005 other keys to trigger capacity eviction
      for (let i = 1; i <= 10005; i++) {
        const mockCtx = {
          header: (name: string) => name === "X-Forwarded-For" ? `1.2.3.${i}` : null,
          req: { method: "GET", url: "http://localhost/" }
        } as any;
        await middleware(mockCtx, next);
      }

      // Request 3 for 1.2.3.0 -> if evicted, returns 200. If not, returns 429.
      const res = await middleware(mockCtx0, next);
      expect(res.status).toBe(200);
    });
  });

  describe("Swagger / OpenAPI Route Customization", () => {
    it("should correctly compile custom route options into JSON spec", async () => {
      app.get("/custom-route", (c) => c.text("custom"), {
        summary: "This is a custom route summary",
        description: "A detailed description explaining what this route does",
        tags: ["custom", "test"],
        deprecated: true,
      });

      swagger(app);

      const res = await app.fetch(new Request("http://localhost/swagger.json"));
      expect(res.status).toBe(200);
      
      const doc = await res.json();
      const endpoint = doc.paths["/custom-route"].get;
      
      expect(endpoint.summary).toBe("This is a custom route summary");
      expect(endpoint.description).toBe("A detailed description explaining what this route does");
      expect(endpoint.tags).toEqual(["custom", "test"]);
      expect(endpoint.deprecated).toBe(true);
    });

    it("should handle circular/recursive schemas without infinite recursion", async () => {
      const { z } = await import("zod");
      
      const baseCategorySchema = z.object({
        name: z.string(),
      });
      
      type Category = z.infer<typeof baseCategorySchema> & {
        subcategories?: Category[];
      };
      
      const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
        subcategories: z.lazy(() => categorySchema.array()).optional(),
      });

      const { schemaToJsonSchema } = await import("../../src/swagger");
      const jsonSchema = schemaToJsonSchema(categorySchema);
      
      expect(jsonSchema.type).toBe("object");
      expect(jsonSchema.properties.subcategories).toBeDefined();
      expect(jsonSchema.properties.subcategories.type).toBe("array");
      expect(jsonSchema.properties.subcategories.items).toEqual({
        type: "object",
        description: "Circular reference",
      });
    });
  });

  describe("Radix Parameter Decoding", () => {
    it("should decode URL-encoded parameter segments in the radix tree", async () => {
      app.get("/hello/:name", (c) => {
        return c.json({ name: c.param("name") });
      });

      const res = await app.fetch(new Request("http://localhost/hello/Saif%20Rehman"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("Saif Rehman");
    });
  });
});
