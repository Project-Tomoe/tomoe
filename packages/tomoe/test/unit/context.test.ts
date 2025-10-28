/**
 * Context class runtime test
 *
 * Tests Context all methods with Request/Response objects.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Context } from "../../src/context";

describe("Context", () => {
  let request: Request;
  let context: Context;

  beforeEach(() => {
    // Fresh Request for each test.
    request = new Request(
      "https://dummyjson.com/posts/24?title=moonlit&writer=tomoe",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-dungeon",
        },
      },
    );

    // Creating Conext class
    context = new Context(request, { id: "24" });
  });

  describe("constructor", () => {
    it("should store request", () => {
      expect(context.req).toBe(request);
    });

    it("should accept empty params", () => {
      const ctx = new Context(request);
      expect(ctx.params).toStrictEqual({});
    });

    it("should accept params", () => {
      const ctx = new Context(request, { id: "24", heroName: "mio" });
      expect(ctx.params).toStrictEqual({ id: "24", heroName: "mio" });
    });

    it("should accept environment", () => {
      const ctx = new Context(
        request,
        {},
        { hero: { heroName: "mio", statsId: 1 } },
      );

      expect(ctx.get("hero")).toEqual({ heroName: "mio", statsId: 1 });
    });
  });

  describe("param()", () => {
    it("should get param by key", () => {
      expect(context.param("id")).toEqual("24");
    });

    it("should return all params", () => {
      const ctx = new Context(request, { id: "24", heroName: "mio" });
      expect(ctx.params).toStrictEqual({ id: "24", heroName: "mio" });
    });
  });

  describe("query()", () => {
    it("should get query parameter", () => {
      expect(context.query("title")).toBe("moonlit");
      expect(context.query("writer")).toBe("tomoe");
    });

    it("should return undefine for missing query paramter", () => {
      expect(context.query("missing")).toBeUndefined();
    });

    it("should handle query paramter with special characters", () => {
      const req = new Request("https:moonlitfantasy?hero=Mokoto%20MISUMI");
      const ctx = new Context(req);
      expect(ctx.query("hero")).toBe("Mokoto MISUMI");
    });
  });

  describe("queries", () => {
    it("should get all query paramters as object", () => {
      expect(context.queries).toEqual({
        title: "moonlit",
        writer: "tomoe",
      });
    });

    it("should return empty object for no query params", () => {
      const req = new Request("https://example.com/path");
      const ctx = new Context(req);
      expect(ctx.queries).toEqual({});
    });

    it("should handle multi-value params (last value wins)", () => {
      const req = new Request("https://dummyjson.com?tag=a&tag=b&tag=c");
      const ctx = new Context(req);
      expect(ctx.queries).toEqual({ tag: "c" });
    });
  });

  describe("header()", () => {
    it("should get header (case-insensitive)", () => {
      expect(context.header("Content-Type")).toBe("application/json");
      expect(context.header("content-type")).toBe("application/json");
      expect(context.header("CONTENT-TYPE")).toBe("application/json");
    });

    it("should return null for missing header", () => {
      expect(context.header("X-Missing")).toBeNull();
    });

    it("should handle Authorization header", () => {
      expect(context.header("Authorization")).toBe("Bearer token-dungeon");
    });
  });

  describe("get() and set()", () => {
    it("should set and get environment variable", () => {
      context.set("heroes", { name: "Tomoe", id: 1 });
      expect(context.get("heroes")).toEqual({ name: "Tomoe", id: 1 });
    });

    it("should handle multiple environment variables", () => {
      context.set("user", { id: 1 });
      context.set("requestId", "abc-123");
      context.set("db", { connection: "active" });

      expect(context.get("user")).toEqual({ id: 1 });
      expect(context.get("requestId")).toBe("abc-123");
      expect(context.get("db")).toEqual({ connection: "active" });
    });

    it("should overwrite existing value", () => {
      context.set("counter", 1);
      context.set("counter", 2);
      expect(context.get("counter")).toBe(2);
    });

    it("should return all environment variables", () => {
      context.set("user", { id: 1 });
      context.set("requestId", "abc");

      expect(context.env).toEqual({
        user: { id: 1 },
        requestId: "abc",
      });
    });
  });

  describe("json()", () => {
    it("should create JSON response", () => {
      const response = context.json({ message: "Hello" });

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "application/json; charset=utf-8",
      );
    });

    it("should serialize data to JSON", async () => {
      const data = { users: ["Alice", "Bob"], count: 2 };
      const response = context.json(data);

      const body = await response.json();
      expect(body).toEqual(data);
    });

    it("should accept custom status", () => {
      const response = context.json({ error: "Not found" }, { status: 404 });
      expect(response.status).toBe(404);
    });

    it("should merge headers", () => {
      const response = context.json(
        { data: "test" },
        { headers: { "X-Custom": "value" } },
      );

      expect(response.headers.get("Content-Type")).toBe(
        "application/json; charset=utf-8",
      );
      expect(response.headers.get("X-Custom")).toBe("value");
    });

    it("should handle nested objects", async () => {
      const response = context.json({
        user: { id: 1, profile: { name: "Alice" } },
        meta: { page: 1 },
      });

      const body = await response.json();
      expect(body.user.profile.name).toBe("Alice");
    });
  });

  describe("text()", () => {
    it("should create text response", () => {
      const response = context.text("Hello, world!");

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toEqual(
        "text/plain; charset=utf-8",
      );
    });

    it("should return text body", async () => {
      const response = context.text("Hello, world!");
      const body = await response.text();
      expect(body).toBe("Hello, world!");
    });

    it("should accept custom status", () => {
      const response = context.text("Error occurred", { status: 500 });
      expect(response.status).toBe(500);
    });
  });

  describe("html()", () => {
    it("should create HTML response", () => {
      const response = context.html("<h1>Hello</h1>");

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/html; charset=utf-8",
      );
    });

    it("should return HTML body", async () => {
      const html = "<html><body><h1>Hello</h1></body></html>";
      const response = context.html(html);
      const body = await response.text();
      expect(body).toBe(html);
    });
  });

  describe("redirect()", () => {
    it("should create redirect response with 302 by default", () => {
      const response = context.redirect("/login");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should create permanent redirect with 301", () => {
      const response = context.redirect("/new-location", 301);

      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("/new-location");
    });

    it("should handle absolute URLs", () => {
      const response = context.redirect("https://example.com/page");
      expect(response.headers.get("Location")).toBe("https://example.com/page");
    });
  });

  describe("notFound()", () => {
    it("should create 404 response with default message", () => {
      const response = context.notFound();

      expect(response.status).toBe(404);
    });

    it("should accept custom message", async () => {
      const response = context.notFound("Page not found");
      const body = await response.text();

      expect(response.status).toBe(404);
      expect(body).toBe("Page not found");
    });
  });

  describe("executionCtx", () => {
    it("should return undefined when not provided", () => {
      expect(context.executionCtx).toBeUndefined();
    });

    it("should return executionCtx when provided", () => {
      const executionCtx = {
        waitUntil: (promise: Promise<any>) => {},
        passThroughOnException: () => {},
      };

      const ctx = new Context(request, {}, {}, executionCtx);
      expect(ctx.executionCtx).toBe(executionCtx);
    });
  });
});

describe("Context edge cases", () => {
  it("should handle empty URL", () => {
    const req = new Request("https://example.com");
    const ctx = new Context(req);

    expect(ctx.query("any")).toBeUndefined();
    expect(ctx.queries).toEqual({});
  });

  it("should handle URL with only search params", () => {
    const req = new Request("https://example.com?a=1&b=2");
    const ctx = new Context(req);

    expect(ctx.queries).toEqual({ a: "1", b: "2" });
  });

  it("should handle special characters in params", () => {
    const ctx = new Context(new Request("https://example.com"), {
      slug: "hello-world-123_test",
    });

    expect(ctx.param("slug")).toBe("hello-world-123_test");
  });

  it("should handle unicode in query params", () => {
    const req = new Request("https://example.com?name=かわいい");
    const ctx = new Context(req);

    expect(ctx.query("name")).toBe("かわいい");
  });
});
