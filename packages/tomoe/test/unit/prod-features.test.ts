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
  });
});
