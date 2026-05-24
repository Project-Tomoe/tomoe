import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Tomoe } from "../../../src/tomoe";
import { relic } from "../../../src/relic/relic";
import { unite } from "../../../src/relic/unite";
import { createClient } from "../../../src/client";
import { z } from "zod";
import { Type } from "@sinclair/typebox";

describe("Schema Validation Relics & Client SDK", () => {
  let app: Tomoe;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    app = new Tomoe();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should validate JSON body using Zod", async () => {
    const userSchema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
    });

    app.post("/user", relic.body(userSchema), (ctx) => {
      // Direct property access: ctx.body should be fully typed and populated!
      return ctx.json({
        ok: true,
        user: ctx.body,
      });
    });

    // 1. Success request
    const successRes = await app.fetch(
      new Request("http://localhost/user", {
        method: "POST",
        body: JSON.stringify({ username: "saif", email: "saif@gmail.com" }),
      })
    );
    expect(successRes.status).toBe(200);
    const successData = await successRes.json();
    expect(successData).toEqual({
      ok: true,
      user: { username: "saif", email: "saif@gmail.com" },
    });

    // 2. Failure request (bad username)
    const failRes = await app.fetch(
      new Request("http://localhost/user", {
        method: "POST",
        body: JSON.stringify({ username: "sa", email: "saif@gmail.com" }),
      })
    );
    expect(failRes.status).toBe(400);
    const failData = await failRes.json();
    expect(failData.error).toContain("Validation Failed");
    expect(failData.issues).toBeDefined();

    // 3. Failure request (bad JSON)
    const badJsonRes = await app.fetch(
      new Request("http://localhost/user", {
        method: "POST",
        body: "{invalid-json}",
      })
    );
    expect(badJsonRes.status).toBe(400);
  });

  it("should validate JSON body using TypeBox", async () => {
    const userSchema = Type.Object({
      username: Type.String({ minLength: 3 }),
      email: Type.String(),
    });

    app.post("/user-tb", relic.body(userSchema), (ctx) => {
      return ctx.json({
        ok: true,
        user: ctx.body,
      });
    });

    // 1. Success request
    const successRes = await app.fetch(
      new Request("http://localhost/user-tb", {
        method: "POST",
        body: JSON.stringify({ username: "saif", email: "saif@gmail.com" }),
      })
    );
    expect(successRes.status).toBe(200);
    const successData = await successRes.json();
    expect(successData).toEqual({
      ok: true,
      user: { username: "saif", email: "saif@gmail.com" },
    });

    // 2. Failure request
    const failRes = await app.fetch(
      new Request("http://localhost/user-tb", {
        method: "POST",
        body: JSON.stringify({ username: "sa", email: "saif@gmail.com" }),
      })
    );
    expect(failRes.status).toBe(400);
  });

  it("should validate and shadow query parameters", async () => {
    const querySchema = z.object({
      page: z.string().transform(Number),
      limit: z.string().transform(Number),
    });

    app.get("/items", relic.query(querySchema), (ctx) => {
      // ctx.query should be shadowed by parsed, validated object (with transformed numbers!)
      return ctx.json({
        page: ctx.query.page,
        limit: ctx.query.limit,
        pageType: typeof ctx.query.page,
      });
    });

    const res = await app.fetch(
      new Request("http://localhost/items?page=2&limit=20")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      page: 2,
      limit: 20,
      pageType: "number",
    });
  });

  it("should validate and shadow path parameters", async () => {
    const paramsSchema = z.object({
      id: z.string().transform((v) => parseInt(v, 10)),
    });

    app.get("/item/:id", relic.params(paramsSchema), (ctx) => {
      // ctx.params should be shadowed and typed as number
      return ctx.json({
        id: ctx.params.id,
        idType: typeof ctx.params.id,
      });
    });

    const res = await app.fetch(new Request("http://localhost/item/42"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      id: 42,
      idType: "number",
    });
  });

  it("should validate headers", async () => {
    const headersSchema = z.object({
      "x-version": z.string(),
    });

    app.get("/version", relic.headers(headersSchema), (ctx) => {
      return ctx.json({
        version: ctx.headers["x-version"],
      });
    });

    const failRes = await app.fetch(new Request("http://localhost/version"));
    expect(failRes.status).toBe(400);

    const successRes = await app.fetch(
      new Request("http://localhost/version", {
        headers: { "x-version": "1.0.0" },
      })
    );
    expect(successRes.status).toBe(200);
    const data = await successRes.json();
    expect(data).toEqual({ version: "1.0.0" });
  });

  it("should perform E2E validation-relic client calls", async () => {
    const schema = z.object({ name: z.string() });
    const query = z.object({ sort: z.enum(["asc", "desc"]) });

    const testApp = new Tomoe()
      .post(
        "/api/create/:type",
        unite(relic.body(schema), relic.query(query)),
        (ctx) => {
          return ctx.json({
            ok: true,
            type: ctx.param("type"), // raw param from Context
            sort: ctx.query.sort,    // validated query
            body: ctx.body,          // validated body
          });
        }
      );

    // Mock global fetch to dispatch using testApp
    globalThis.fetch = async (url, init) => {
      const req = new Request(url.toString(), init);
      return testApp.fetch(req);
    };

    // Create client typed with testApp
    const client = createClient<typeof testApp>("http://localhost");

    const res = await client("/api/create/:type").post({
      params: { type: "admin" },
      query: { sort: "desc" },
      body: { name: "saif" },
    });

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: true,
      type: "admin",
      sort: "desc",
      body: { name: "saif" },
    });
    expect(res.error).toBeNull();
  });

  it("should handle functional err() returns from handler", async () => {
    const { err } = await import("../../../src/relic/result");
    const { NotFound } = await import("../../../src/relic/error");

    app.get("/find-user/:id", (ctx) => {
      if (ctx.params.id !== "1") {
        return err(NotFound); // Return functional Err instead of throwing!
      }
      return ctx.json({ id: "1", name: "saif" });
    });

    const resFail = await app.fetch(new Request("http://localhost/find-user/2"));
    expect(resFail.status).toBe(404);
    const failData = await resFail.json();
    expect(failData).toEqual({ error: "Not Found" });

    const resSuccess = await app.fetch(new Request("http://localhost/find-user/1"));
    expect(resSuccess.status).toBe(200);
    const successData = await resSuccess.json();
    expect(successData).toEqual({ id: "1", name: "saif" });
  });

  it("should handle thrown HttpErrors inside handler and trigger local onError handlers", async () => {
    const { Unauthorized } = await import("../../../src/relic/error");

    app.scope("/web-secure", unite(), (r) => {
      r.onError(401, (ctx) => ctx.redirect("/login-page"));
      r.get("/dashboard", () => {
        throw Unauthorized; // Throw HttpError inside handler!
      });
    });

    const res = await app.fetch(new Request("http://localhost/web-secure/dashboard"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login-page");
  });

  it("should handle functional err() returns inside handler and trigger local onError handlers", async () => {
    const { err } = await import("../../../src/relic/result");
    const { Unauthorized } = await import("../../../src/relic/error");

    app.scope("/web-secure-func", unite(), (r) => {
      r.onError(401, (ctx) => ctx.redirect("/login-page-func"));
      r.get("/dashboard", () => {
        return err(Unauthorized); // Return functional Err inside handler!
      });
    });

    const res = await app.fetch(new Request("http://localhost/web-secure-func/dashboard"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login-page-func");
  });
});
