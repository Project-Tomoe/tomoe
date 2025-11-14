/**
 * Router Comprehensive Test Suite
 *
 * Test covers:
 *  - Route registration (all HTTP methods)
 *  - Request handling (fetch)
 *  - Middleware execution
 *  - Middleware ordering
 *  - Paramter extraction
 *  - Error handling
 *  - Integration Scenario
 */

import { describe, it, vi, beforeEach, expect } from "vitest";
import { type Handler, Middleware, Router } from "../../../src";

describe("Router", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  /**
   * Route Registration
   */

  describe("Route Registration", () => {
    it("should register GET route", () => {
      const handler: Handler = (c) => c.text("GET Response");
      router.get("/test", handler);

      const routes = router.getRoutes();
      expect(routes).toContainEqual({ method: "GET", path: "/test" });
    });

    it("should register POST route", () => {
      const handler: Handler = (c) => c.text("POST Response");
      router.post("/test", handler);

      const routes = router.getRoutes();
      expect(routes).toContainEqual({ method: "POST", path: "/test" });
    });

    it("should register PUT route", () => {
      const handler: Handler = (c) => c.text("PUT Response");
      router.put("/test", handler);

      const routes = router.getRoutes();
      expect(routes).toContainEqual({ method: "PUT", path: "/test" });
    });

    it("should register DELETE route", () => {
      const handler: Handler = (c) => c.text("DELETE Response");
      router.delete("/test", handler);

      const routes = router.getRoutes();
      expect(routes).toContainEqual({ method: "DELETE", path: "/test" });
    });

    it("should register PATCH route", () => {
      const handler: Handler = (c) => c.text("PATCH Response");
      router.patch("/test", handler);

      const routes = router.getRoutes();
      expect(routes).toContainEqual({ method: "PATCH", path: "/test" });
    });

    it("should support method chaining", () => {
      const result = router
        .get("/", (c) => c.text("GET Response"))
        .post("/anime", (c) => c.text("POST Response"))
        .put("/anime/:id", (c) => c.text("PUT Response"));

      expect(result).toBe(router);
    });

    it("should register multiple routes", () => {
      router.get("/", (c) => c.text("home"));
      router.get("/tomoe", (c) => c.text("Hello, Tomoe!"));
      router.post("/anime", (c) => c.text("anime"));

      const routes = router.getRoutes();
      expect(routes).toHaveLength(3);
    });
  });

  /**
   * Request Handling (fetch)
   */
  describe("Request Handling", () => {
    it("should handle GET request", async () => {
      router.get("/tomoe", (c) => c.text("Hello, Tomoe!"));

      const request = new Request("http://localhost/tomoe");
      const response = await router.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Hello, Tomoe!");
    });

    it("should handle POST request", async () => {
      router.post("/anime", (c) => c.json({ created: true }));

      const request = new Request("http://localhost/anime", {
        method: "POST",
      });
      const response = await router.fetch(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ created: true });
    });

    it("should return 404 for unmatched route", async () => {
      router.get("/exists", (c) => c.text("Found"));

      const request = new Request("http://localhost/notfound");
      const response = await router.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    });

    it("should return 404 for wrong method", async () => {
      router.get("/test", (c) => c.text("GET only"));

      const request = new Request("http://localhost/test", {
        method: "POST",
      });
      const response = await router.fetch(request);

      expect(response.status).toBe(404);
    });

    it("should handle root route", async () => {
      router.get("/", (c) => c.text("Home"));

      const request = new Request("http://localhost/");
      const response = await router.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Home");
    });

    it("should extract path parameters", async () => {
      router.get("/anime/:name", (c) => {
        const name = c.param("name");
        return c.json({ name });
      });

      const request = new Request("http://localhost/anime/bleach");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body).toEqual({ name: "bleach" });
    });

    it("should extract multiple path parameters", async () => {
      router.get("/anime/:name/heroes/:heroName", (c) => {
        return c.json({
          name: c.param("name"),
          heroName: c.param("heroName"),
        });
      });

      const request = new Request(
        "http://localhost/anime/naruto/heroes/itachi",
      );
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body).toEqual({ name: "naruto", heroName: "itachi" });
    });

    it("should handle async handler", async () => {
      router.get("/async", async (c) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return c.text("Async response");
      });

      const request = new Request("http://localhost/async");
      const response = await router.fetch(request);

      expect(await response.text()).toBe("Async response");
    });

    it("should access request URL", async () => {
      router.get("/anime", (c) => {
        return c.text(c.req.url);
      });

      const request = new Request("http://localhost/anime?name=inuyasha");
      const response = await router.fetch(request);

      expect(await response.text()).toBe(
        "http://localhost/anime?name=inuyasha",
      );
    });

    it("should access request headers", async () => {
      router.get("/login", (c) => {
        const auth = c.header("Authorization");
        return c.json({ auth });
      });

      const request = new Request("http://localhost/login", {
        headers: {
          Authorization: "Bearer i-am-weeb",
        },
      });

      const response = await router.fetch(request);

      const body = await response.json();

      expect(body).toEqual({ auth: "Bearer i-am-weeb" });
    });
  });

  /** Middleware Test */
  describe("Middleware", () => {
    it("should execute middleware before handler", async () => {
      const order: string[] = [];

      const middleware: Middleware = async (c, next) => {
        order.push("middleware");
        return next();
      };

      router.use(middleware);
      router.get("/anime", (c) => {
        order.push("handler");
        return c.text("GET Response");
      });

      const request = new Request("http://localhost/anime");

      await router.fetch(request);

      expect(order).toEqual(["middleware", "handler"]);
    });

    it("should execute multiple middleware in order", async () => {
      const order: string[] = [];

      const middleware1: Middleware = async (c, next) => {
        order.push("m1-before");
        const response = await next();
        order.push("m1-after");
        return response;
      };

      const middleware2: Middleware = async (c, next) => {
        order.push("m2-before");
        const response = await next();
        order.push("m2-after");
        return response;
      };

      router
        .use(middleware1)
        .use(middleware2)
        .get("/test", (c) => {
          order.push("handler");
          return c.text("OK");
        });

      const request = new Request("http://localhost/test");
      await router.fetch(request);

      expect(order).toEqual([
        "m1-before",
        "m2-before",
        "handler",
        "m2-after",
        "m1-after",
      ]);
    });

    it("should allow middleware to modify context", async () => {
      const middleware: Middleware<{}, { requestId: string }> = async (
        c,
        next,
      ) => {
        c.set("requestId", "test-123");
        return next();
      };

      router.use(middleware);
      router.get("/test", (c) => {
        const requestId = c.get("requestId");
        return c.json({ requestId });
      });

      const request = new Request("http://localhost/test");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body).toEqual({ requestId: "test-123" });
    });

    it("should allow middleware to short-circuit", async () => {
      let handlerCalled = false;

      const authMiddleware: Middleware = async (c, next) => {
        const token = c.header("Authorization");
        if (!token) {
          return c.json({ error: "Unauthorized" }, { status: 401 });
        }
        return next();
      };

      router.use(authMiddleware);
      router.get("/protected", (c) => {
        handlerCalled = true;
        return c.text("Protected resource");
      });

      const request = new Request("http://localhost/protected");
      const response = await router.fetch(request);

      expect(response.status).toBe(401);
      expect(handlerCalled).toBe(false);

      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("should allow middleware to modify response", async () => {
      const middleware: Middleware = async (c, next) => {
        const response = await next();
        response.headers.set("X-Custom-Header", "Tomoe");
        return response;
      };

      router.use(middleware);
      router.get("/tomoe", (c) => c.text("OK"));

      const request = new Request("http://localhost/tomoe");
      const response = await router.fetch(request);

      expect(response.headers.get("X-Custom-Header")).toBe("Tomoe");
    });

    it("should support async middleware", async () => {
      const middleware: Middleware = async (c, next) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        c.set("delayed", "true");
        return next();
      };

      router.use(middleware);
      router.get("/test", (c) => {
        return c.json({ delayed: c.get("delayed") });
      });

      const request = new Request("http://localhost/test");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body).toEqual({ delayed: "true" });
    });

    it("should pass through middleware even on 404", async () => {
      let middlewareCalled = false;

      const middleware: Middleware = async (c, next) => {
        middlewareCalled = true;
        return next();
      };

      router.use(middleware);

      const request = new Request("http://localhost/notfound");
      await router.fetch(request);

      expect(middlewareCalled).toBe(false);
    });

    it("should pass through middleware even on 404", async () => {
      let middlewareCalled = false;

      const middleware: Middleware = async (c, next) => {
        middlewareCalled = true;
        return next();
      };

      router.use(middleware);

      const request = new Request("http://localhost/notfound");
      await router.fetch(request);

      expect(middlewareCalled).toBe(false);
    });
  });

  /** Error Handling */
  describe("Error Handling", () => {
    it("should catch handler errors", async () => {
      router.get("/error", (c) => {
        throw new Error("Error");
      });

      const request = new Request("http://localhost/error");
      const response = await router.fetch(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty("error", "Internal Server Error");
      expect(body).toHaveProperty("message", "Error");
    });

    it("should catch middleware errors", async () => {
      const middleware: Middleware = (c, next) => {
        throw new Error("Middleware Error");
      };

      router.use(middleware);
      router.get("/tomoe", (c) => c.text("Hello, Tomoe!"));

      const request = new Request("http://localhost/tomoe");
      const response = await router.fetch(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toHaveProperty("message", "Middleware Error");
    });

    it("should catch async handler errors", async () => {
      router.get("/async-error", async (c) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        throw new Error("Async Error");
      });

      const request = new Request("http://localhost/async-error");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body).toHaveProperty("message", "Async Error");
    });
  });

  /** Integration Tests */
  describe("Integration", () => {
    it("should handle complete request flow", async () => {
      const requestLog: string[] = [];

      const logger: Middleware<{}, { requestId: string }> = async (c, next) => {
        const requestId = crypto.randomUUID();
        c.set("requestId", requestId);
        requestLog.push(`START ${requestId}`);
        const response = await next();
        requestLog.push(`END ${requestId}`);

        return response;
      };

      interface User {
        id: number;
        name: string;
      }

      const auth: Middleware<{}, { user: User }> = async (c, next) => {
        const token = c.header("Authorization")?.replace("Bearer ", "");
        if (token === "valid") {
          c.set("user", { id: 1, name: "Tomoe" });
          return next();
        }

        return c.json({ error: "Unauthorized" }, { status: 401 });
      };

      router
        .use(logger)
        .use(auth)
        .get("/profile", (c) => {
          const user = c.get("user");
          const requestId = c.get("requestId");

          return c.json({ user, requestId });
        });

      const request = new Request("http://localhost/profile", {
        headers: { Authorization: "Bearer valid" },
      });

      const response = await router.fetch(request);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.user).toEqual({ id: 1, name: "Tomoe" });
      expect(body.requestId).toBeDefined();
      expect(requestLog).toHaveLength(2);
    });

    it("should handle REST API scenario", async () => {
      // Simulated database
      const db = new Map<string, any>([
        ["1", { id: "1", name: "Moonlit Fantasy" }],
        ["2", { id: "2", name: "That Time I Got Reincarnated as a Slime" }],
      ]);

      router
        .get("/anime", (c) => {
          const users = Array.from(db.values());
          return c.json({ users });
        })
        .get("/anime/:id", (c) => {
          const id = c.param("id");
          const user = db.get(id);
          if (!user) {
            return c.notFound("Anime not found");
          }
          return c.json({ user });
        })
        .post("/anime", async (c) => {
          const body = await c.req.json();
          const id = String(db.size + 1);
          const user = { id, ...body };
          db.set(id, user);
          return c.json({ user }, { status: 201 });
        })
        .delete("/anime/:id", (c) => {
          const id = c.param("id");
          if (!db.has(id)) {
            return c.notFound("User not found");
          }
          db.delete(id);
          return c.json({ deleted: true });
        });

      let response = await router.fetch(new Request("http://localhost/anime"));
      let body = await response.json();
      expect(body.users).toHaveLength(2);

      // Test GET single use
      response = await router.fetch(new Request("http://localhost/anime/1"));
      body = await response.json();
      expect(body.user.name).toBe("Moonlit Fantasy");

      // Test POST create user
      response = await router.fetch(
        new Request("http://localhost/anime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "One Punch Man" }),
        }),
      );
      body = await response.json();
      expect(response.status).toBe(201);
      expect(body.user.name).toBe("One Punch Man");
      expect(db.size).toBe(3);

      // Test DELETE user
      response = await router.fetch(
        new Request("http://localhost/anime/1", {
          method: "DELETE",
        }),
      );
      body = await response.json();
      expect(body.deleted).toBe(true);
      expect(db.size).toBe(2);

      // Test 404
      response = await router.fetch(new Request("http://localhost/anime/1000"));
      expect(response.status).toBe(404);
    });

    it("should handle nested middleware scenario", async () => {
      const timeline: string[] = [];

      const m1: Middleware = async (c, next) => {
        timeline.push("m1-start");
        c.set("m1", "done");
        const response = await next();
        timeline.push("m1-end");
        return response;
      };

      const m2: Middleware = async (c, next) => {
        timeline.push("m2-start");
        c.set("m2", "done");
        const response = await next();
        timeline.push("m2-end");
        return response;
      };

      const m3: Middleware = async (c, next) => {
        timeline.push("m3-start");
        c.set("m3", "done");
        const response = await next();
        timeline.push("m3-end");
        return response;
      };

      router
        .use(m1)
        .use(m2)
        .use(m3)
        .get("/test", (c) => {
          timeline.push("handler");
          return c.json({
            m1: c.get("m1"),
            m2: c.get("m2"),
            m3: c.get("m3"),
          });
        });

      const request = new Request("http://localhost/test");
      const response = await router.fetch(request);

      // Verify onion-like execution
      expect(timeline).toEqual([
        "m1-start",
        "m2-start",
        "m3-start",
        "handler",
        "m3-end",
        "m2-end",
        "m1-end",
      ]);

      // Verify all middleware added to context
      const body = await response.json();
      expect(body).toEqual({ m1: "done", m2: "done", m3: "done" });
    });
  });

  /** Edge Cases */
  describe("Edge Cases", () => {
    it("should handle query parameter", async () => {
      router.get("/search", (c) => {
        const q = c.query("q");
        const page = c.query("page");

        return c.json({ q, page });
      });

      const request = new Request("http://localhost/search?q=tomoe&page=1");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body).toEqual({ q: "tomoe", page: "1" });
    });

    it("should handle request body", async () => {
      router.post("/body", async (c) => {
        const body = await c.req.json();

        return c.json({ body });
      });

      const request = new Request("http://localhost/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello, Tomoe!" }),
      });

      const response = await router.fetch(request);
      const body = await response.json();

      expect(body).toEqual({ body: { message: "Hello, Tomoe!" } });
    });

    it("should handle custom status codes", async () => {
      router.post("/create", (c) => {
        return c.json({ created: true }, { status: 201 });
      });

      const request = new Request("http://localhost/create", {
        method: "POST",
      });
      const response = await router.fetch(request);

      expect(response.status).toBe(201);
    });

    it("should handle empty middleware array", async () => {
      router.get("/test", (c) => c.text("OK"));

      const request = new Request("http://localhost/test");
      const response = await router.fetch(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
    });

    it("should handle very long path", async () => {
      const longPath = "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p";
      router.get(longPath, (c) => c.text("Found"));

      const request = new Request(`http://localhost${longPath}`);
      const response = await router.fetch(request);

      expect(response.status).toBe(200);
    });

    it("should handle unicode in URLs", async () => {
      router.get("/heroes/:name", (c) => {
        const name = decodeURIComponent(c.param("name"));
        return c.json({ name });
      });

      const request = new Request("http://localhost/heroes/ともえ");
      const response = await router.fetch(request);

      const body = await response.json();
      expect(body.name).toEqual("ともえ");
    });

    it("should handle redirect response", async () => {
      router.get("/old", (c) => c.redirect("/new", 301));

      const request = new Request("http://localhost/old");
      const response = await router.fetch(request);

      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("/new");
    });
  });
});
