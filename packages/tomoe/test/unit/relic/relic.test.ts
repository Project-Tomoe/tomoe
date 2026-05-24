/**
 * Relic System Test Suite (Boilerplate-Free)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { relic, guard } from "../../../src/relic/relic";
import { unite } from "../../../src/relic/unite";
import { err, isErr } from "../../../src/relic/result";
import { HttpError, httpError, Unauthorized, Forbidden } from "../../../src/relic/error";
import { executeRelics } from "../../../src/relic/executor";
import { Router } from "../../../src/router/router";
import { Context } from "../../../src/context";

// Helpers
function makeCtx(headers: Record<string, string> = {}): Context {
  const req = new Request("http://localhost/test", { headers });
  return new Context(req);
}

// err() / isErr()
describe("err() / isErr()", () => {
  it("should create an Err marker", () => {
    const e = err(Unauthorized);
    expect(isErr(e)).toBe(true);
  });

  it("should not flag plain objects as Err", () => {
    expect(isErr({})).toBe(false);
    expect(isErr(null)).toBe(false);
    expect(isErr("error")).toBe(false);
  });

  it("should preserve the HttpError", () => {
    const e = err(Forbidden);
    expect(isErr(e) && e.error.status).toBe(403);
  });
});

// HttpError
describe("HttpError", () => {
  it("should carry status code", () => {
    const e = httpError(401);
    expect(e.status).toBe(401);
  });

  it("should use default message", () => {
    expect(httpError(401).message).toBe("Unauthorized");
  });

  it("toResponse() should produce correct Response", async () => {
    const res = httpError(401).toResponse();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});

// relic() and guard() definitions
describe("relic() and guard()", () => {
  it("should create an anonymous providing relic", () => {
    const r = relic(async () => ({ id: "1" }));
    expect(r._kind).toBe("providing");
    expect(r.name).toBe("");
  });

  it("should create a named providing relic", () => {
    const r = relic("user", async () => ({ id: "1" }));
    expect(r._kind).toBe("providing");
    expect(r.name).toBe("user");
  });

  it("should create a guard relic", () => {
    const g = guard(async () => {});
    expect(g._kind).toBe("guard");
  });
});

// unite()
describe("unite()", () => {
  const auth  = relic("user", async () => ({ id: "u1" }));
  const org   = relic("org", async () => ({ orgId: "o1" }));
  const check = guard(async () => {});

  it("should produce a RelicGroup", () => {
    const group = unite(auth, org);
    expect(group._kind).toBe("group");
  });

  it("should preserve relic order", () => {
    const group = unite(auth, org, check);
    expect(group.relics[0]).toBe(auth);
    expect(group.relics[1]).toBe(org);
    expect(group.relics[2]).toBe(check);
  });
});

// executeRelics()
describe("executeRelics()", () => {
  it("should execute providing relic and store value", async () => {
    const auth = relic("user", async () => ({ id: "u1" }));
    const ctx = makeCtx();

    const result = await executeRelics([auth], ctx);
    expect(result).toBeNull();
    expect(ctx._getRelic(auth._id)).toEqual({ id: "u1" });
    expect(ctx._getRelicByName("user")).toEqual({ id: "u1" });
  });

  it("should return HttpError if relic returns err()", async () => {
    const auth = relic(async () => err(Unauthorized));
    const ctx = makeCtx();

    const result = await executeRelics([auth], ctx);
    expect(result?.status).toBe(401);
  });

  it("should resolve dependencies via use()", async () => {
    const auth = relic(async () => ({ id: "u1" }));
    const org  = relic(async (_ctx, use) => {
      const user = use(auth);
      return { orgId: `org-of-${user.id}` };
    });

    const ctx = makeCtx();
    await executeRelics([auth, org], ctx);
    expect(ctx._getRelic(org._id)).toEqual({ orgId: "org-of-u1" });
  });

  it("should throw if use() called for unprovided relic", async () => {
    const auth = relic(async () => ({ id: "u1" }));
    const org = relic(async (_ctx, use) => {
      use(auth); // auth not in chain — should throw
      return { orgId: "o1" };
    });

    const ctx = makeCtx();
    await expect(executeRelics([org], ctx)).rejects.toThrow();
  });

  it("should handle guard — pass", async () => {
    const check = guard(async () => {});
    const ctx = makeCtx();
    const result = await executeRelics([check], ctx);
    expect(result).toBeNull();
  });

  it("should handle guard — block", async () => {
    const check = guard(async () => err(Forbidden));
    const ctx = makeCtx();
    const result = await executeRelics([check], ctx);
    expect(result?.status).toBe(403);
  });
});

// ctx.relic() and Proxy direct properties
describe("Context property and relic access", () => {
  it("should return stored relic value via ctx.relic()", () => {
    const auth = relic(async () => ({ id: "u1" }));
    const ctx = makeCtx();
    ctx._setRelic(auth._id, { id: "u1" });
    expect(ctx.relic(auth)).toEqual({ id: "u1" });
  });

  it("should throw if relic value not found", () => {
    const auth = relic(async () => ({ id: "u1" }));
    const ctx = makeCtx();
    expect(() => ctx.relic(auth)).toThrow();
  });
});

// Router.scope() integration
describe("Router.scope() integration", () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it("should execute relics and expose named values via direct property access", async () => {
    const auth = relic("user", async () => ({ id: "u1" }));

    router.scope("/user", auth, (r) => {
      r.get("/me", (ctx: any) => ctx.json(ctx.user));
    });

    const res = await router.fetch(new Request("http://localhost/user/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "u1" });
  });

  it("should expose anonymous relics via ctx.relic()", async () => {
    const auth = relic(async () => ({ id: "u1" }));

    router.scope("/user", auth, (r) => {
      r.get("/me", (ctx) => ctx.json(ctx.relic(auth)));
    });

    const res = await router.fetch(new Request("http://localhost/user/me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "u1" });
  });

  it("should run custom error handlers", async () => {
    const auth = relic(async () => err(Unauthorized));

    router.scope("/web", auth, (r) => {
      r.onError(401, (ctx) => ctx.redirect("/login"));
      r.get("/home", (ctx) => ctx.json({ ok: true }));
    });

    const res = await router.fetch(new Request("http://localhost/web/home"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("should chain multiple relics via unite()", async () => {
    const auth = relic("user", async () => ({ id: "u1" }));
    const org  = relic("org", async (_ctx, use) => {
      const user = use(auth);
      return { orgId: `org-${user.id}` };
    });

    router.scope("/admin", unite(auth, org), (r) => {
      r.get("/dashboard", (ctx: any) => ctx.json({
        user: ctx.user,
        org: ctx.org,
      }));
    });

    const res = await router.fetch(new Request("http://localhost/admin/dashboard"));
    expect(res.status).toBe(200)
    const body = await res.json();
    expect(body.user).toEqual({ id: "u1" });
    expect(body.org).toEqual({ orgId: "org-u1" });
  });

  it("should throw at scope definition if relic chain is invalid (duplicate name)", () => {
    const auth1 = relic("user", async () => ({ id: "u1" }));
    const auth2 = relic("user", async () => ({ id: "u2" }));

    expect(() => {
      router.scope("/dup", unite(auth1, auth2), (r) => {
        r.get("/", (ctx) => ctx.text("ok"));
      });
    }).toThrow();
  });
});