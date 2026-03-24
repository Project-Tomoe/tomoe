/**
 * Relic System Test Suite
 *
 * Covers:
 *  - token() identity and types
 *  - relic() providing and guard forms
 *  - err() / isErr() result signaling
 *  - unite() group composition
 *  - executeRelics() runtime chain
 *  - Router.scope() full integration
 */

import { describe, it, expect, beforeEach } from "vitest"
import { token } from "../../../src/relic/token"
import { relic } from "../../../src/relic/relic"
import { unite } from "../../../src/relic/unite"
import { err, isErr } from "../../../src/relic/result"
import { HttpError, httpError, Unauthorized, Forbidden } from "../../../src/relic/error"
import { executeRelics } from "../../../src/relic/executor"
import { Router } from "../../../src/router/router"
import { Context } from "../../../src/context"

// Helpers

function makeCtx(headers: Record<string, string> = {}): Context {
  const req = new Request("http://localhost/test", { headers })
  return new Context(req)
}

// token()

describe("token()", () => {
  it("should create tokens with unique identity", () => {
    const A = token<string>()
    const B = token<string>()
    expect(A._id).not.toBe(B._id)
  })

  it("should carry debug name", () => {
    const UserCtx = token<{ id: string }>("user")
    expect(UserCtx._name).toBe("user")
  })

  it("should default name to symbol description", () => {
    const t = token<number>()
    expect(t._name).toContain("token")
  })

  it("two tokens with same name should still have different identity", () => {
    const A = token<string>("user")
    const B = token<string>("user")
    expect(A._id).not.toBe(B._id)
  })
})

// err() / isErr()

describe("err() / isErr()", () => {
  it("should create an Err marker", () => {
    const e = err(Unauthorized)
    expect(isErr(e)).toBe(true)
  })

  it("should not flag plain objects as Err", () => {
    expect(isErr({})).toBe(false)
    expect(isErr(null)).toBe(false)
    expect(isErr("error")).toBe(false)
    expect(isErr(42)).toBe(false)
  })

  it("should preserve the HttpError", () => {
    const e = err(Forbidden)
    expect(isErr(e) && e.error.status).toBe(403)
  })
})

// HttpError 

describe("HttpError", () => {
  it("should carry status code", () => {
    const e = httpError(401)
    expect(e.status).toBe(401)
  })

  it("should use default message", () => {
    expect(httpError(401).message).toBe("Unauthorized")
    expect(httpError(403).message).toBe("Forbidden")
    expect(httpError(404).message).toBe("Not Found")
  })

  it("should accept custom message", () => {
    const e = httpError(403, "You shall not pass")
    expect(e.message).toBe("You shall not pass")
  })

  it("toResponse() should produce correct Response", async () => {
    const res = httpError(401).toResponse()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should be instanceof HttpError", () => {
    expect(Unauthorized).toBeInstanceOf(HttpError)
    expect(Forbidden).toBeInstanceOf(HttpError)
  })
})

// relic()

describe("relic()", () => {
  const UserCtx = token<{ id: string; isAdmin: boolean }>("user")

  it("should create a providing relic", () => {
    const r = relic(UserCtx, async () => ({ id: "1", isAdmin: false }))
    expect(r._kind).toBe("providing")
  })

  it("should create a guard relic", () => {
    const r = relic(async () => {})
    expect(r._kind).toBe("guard")
  })

  it("providing relic should carry token reference", () => {
    const r = relic(UserCtx, async () => ({ id: "1", isAdmin: false }))
    expect(r._kind === "providing" && r.token).toBe(UserCtx)
  })

  it("should throw if token given without fn", () => {
    expect(() => (relic as any)(UserCtx)).toThrow()
  })
})

// unite()

describe("unite()", () => {
  const UserCtx = token<{ id: string }>("user")
  const OrgCtx  = token<{ orgId: string }>("org")

  const authRelic  = relic(UserCtx, async () => ({ id: "u1" }))
  const orgRelic   = relic(OrgCtx, async () => ({ orgId: "o1" }))
  const adminGuard = relic(async () => {})

  it("should produce a RelicGroup", () => {
    const group = unite(authRelic, orgRelic)
    expect(group._kind).toBe("group")
  })

  it("should preserve relic order", () => {
    const group = unite(authRelic, orgRelic, adminGuard)
    expect(group.relics[0]).toBe(authRelic)
    expect(group.relics[1]).toBe(orgRelic)
    expect(group.relics[2]).toBe(adminGuard)
  })

  it("should accept a single relic", () => {
    const group = unite(authRelic)
    expect(group.relics).toHaveLength(1)
  })
})

// executeRelics()

describe("executeRelics()", () => {
  const UserCtx = token<{ id: string; isAdmin: boolean }>("user")
  const OrgCtx  = token<{ orgId: string }>("org")

  it("should execute providing relic and store value", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const ctx = makeCtx()

    const result = await executeRelics([authRelic], ctx)

    expect(result).toBeNull()
    expect(ctx._getRelic(UserCtx._id)).toEqual({ id: "u1", isAdmin: false })
  })

  it("should return HttpError if relic returns err()", async () => {
    const authRelic = relic(UserCtx, async () => err(Unauthorized))
    const ctx = makeCtx()

    const result = await executeRelics([authRelic], ctx)

    expect(result).toBeInstanceOf(HttpError)
    expect(result?.status).toBe(401)
  })

  it("should stop chain on first error", async () => {
    let secondRan = false

    const failRelic = relic(UserCtx, async () => err(Unauthorized))
    const orgRelic  = relic(OrgCtx, async () => {
      secondRan = true
      return { orgId: "o1" }
    })

    const ctx = makeCtx()
    await executeRelics([failRelic, orgRelic], ctx)

    expect(secondRan).toBe(false)
  })

  it("should resolve dependencies via use()", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: true }))
    const orgRelic  = relic(OrgCtx, async (_ctx, use) => {
      const user = use(UserCtx)
      return { orgId: `org-of-${user.id}` }
    })

    const ctx = makeCtx()
    await executeRelics([authRelic, orgRelic], ctx)

    expect(ctx._getRelic(OrgCtx._id)).toEqual({ orgId: "org-of-u1" })
  })

  it("should throw if use() called for unprovided token", async () => {
    const orgRelic = relic(OrgCtx, async (_ctx, use) => {
      use(UserCtx)   // UserCtx not in chain — should throw
      return { orgId: "o1" }
    })

    const ctx = makeCtx()
    await expect(executeRelics([orgRelic], ctx)).rejects.toThrow()
  })

  it("should handle guard relic — pass", async () => {
    const guard = relic(async () => {})
    const ctx = makeCtx()
    const result = await executeRelics([guard], ctx)
    expect(result).toBeNull()
  })

  it("should handle guard relic — block", async () => {
    const guard = relic(async () => err(Forbidden))
    const ctx = makeCtx()
    const result = await executeRelics([guard], ctx)
    expect(result?.status).toBe(403)
  })

  it("should catch thrown HttpError directly", async () => {
    const r = relic(UserCtx, async () => {
      throw new HttpError(403, "Threw directly")
    })
    const ctx = makeCtx()
    const result = await executeRelics([r], ctx)
    expect(result?.status).toBe(403)
  })

  it("should rethrow non-HttpError exceptions", async () => {
    const r = relic(UserCtx, async () => {
      throw new Error("Unexpected DB failure")
    })
    const ctx = makeCtx()
    await expect(executeRelics([r], ctx)).rejects.toThrow("Unexpected DB failure")
  })
})

// ctx.relic() 

describe("ctx.relic()", () => {
  const UserCtx = token<{ id: string }>("user")

  it("should return stored relic value", () => {
    const ctx = makeCtx()
    ctx._setRelic(UserCtx._id, { id: "u1" })
    expect(ctx.relic(UserCtx)).toEqual({ id: "u1" })
  })

  it("should throw if token not found", () => {
    const ctx = makeCtx()
    expect(() => ctx.relic(UserCtx)).toThrow()
  })
})

// Router.scope() integration

describe("Router.scope() integration", () => {
  const UserCtx = token<{ id: string; isAdmin: boolean }>("user")
  const OrgCtx  = token<{ orgId: string }>("org")

  let router: Router

  beforeEach(() => {
    router = new Router()
  })

  it("should execute relics and expose values to handler", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const userAccess = unite(authRelic)

    router.scope("/user", userAccess, (r) => {
      r.get("/me", (ctx) => ctx.json(ctx.relic(UserCtx)))
    })

    const res = await router.fetch(new Request("http://localhost/user/me"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ id: "u1", isAdmin: false })
  })

  it("should return automatic error response when relic fails", async () => {
    const authRelic = relic(UserCtx, async () => err(Unauthorized))
    const userAccess = unite(authRelic)

    router.scope("/user", userAccess, (r) => {
      r.get("/me", (ctx) => ctx.json(ctx.relic(UserCtx)))
    })

    const res = await router.fetch(new Request("http://localhost/user/me"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("should use custom onError handler when registered", async () => {
    const authRelic = relic(UserCtx, async () => err(Unauthorized))
    const userAccess = unite(authRelic)

    router.scope("/web", userAccess, (r) => {
      r.onError(401, (ctx) => ctx.redirect("/login"))
      r.get("/home", (ctx) => ctx.json(ctx.relic(UserCtx)))
    })

    const res = await router.fetch(new Request("http://localhost/web/home"))
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/login")
  })

  it("should scope routes under the prefix", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const userAccess = unite(authRelic)

    router.scope("/api", userAccess, (r) => {
      r.get("/profile", (ctx) => ctx.text("profile"))
    })

    const found = await router.fetch(new Request("http://localhost/api/profile"))
    const notFound = await router.fetch(new Request("http://localhost/profile"))

    expect(found.status).toBe(200)
    expect(notFound.status).toBe(404)
  })

  it("should chain multiple relics via unite()", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const orgRelic  = relic(OrgCtx, async (_ctx, use) => {
      const user = use(UserCtx)
      return { orgId: `org-${user.id}` }
    })

    const adminAccess = unite(authRelic, orgRelic)

    router.scope("/admin", adminAccess, (r) => {
      r.get("/dashboard", (ctx) => ctx.json({
        user: ctx.relic(UserCtx),
        org: ctx.relic(OrgCtx),
      }))
    })

    const res = await router.fetch(new Request("http://localhost/admin/dashboard"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toEqual({ id: "u1", isAdmin: false })
    expect(body.org).toEqual({ orgId: "org-u1" })
  })

  it("should allow multiple scopes on same router", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: true }))
    const userAccess = unite(authRelic)

    router.scope("/users", userAccess, (r) => {
      r.get("/me", (ctx) => ctx.text("user-me"))
    })

    router.scope("/admin", userAccess, (r) => {
      r.get("/dashboard", (ctx) => ctx.text("admin-dashboard"))
    })

    const r1 = await router.fetch(new Request("http://localhost/users/me"))
    const r2 = await router.fetch(new Request("http://localhost/admin/dashboard"))

    expect(await r1.text()).toBe("user-me")
    expect(await r2.text()).toBe("admin-dashboard")
  })

  it("should coexist with non-scoped routes", async () => {
    const authRelic = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const userAccess = unite(authRelic)

    router.get("/public", (ctx) => ctx.text("public"))
    router.scope("/private", userAccess, (r) => {
      r.get("/data", (ctx) => ctx.text("private"))
    })

    const pub = await router.fetch(new Request("http://localhost/public"))
    const priv = await router.fetch(new Request("http://localhost/private/data"))

    expect(await pub.text()).toBe("public")
    expect(await priv.text()).toBe("private")
  })

  it("should throw at scope definition if relic chain is invalid (duplicate token)", () => {
    const authRelic  = relic(UserCtx, async () => ({ id: "u1", isAdmin: false }))
    const authRelic2 = relic(UserCtx, async () => ({ id: "u2", isAdmin: true }))

    expect(() => {
      router.scope("/dup", unite(authRelic, authRelic2), (r) => {
        r.get("/", (ctx) => ctx.text("ok"))
      })
    }).toThrow()
  })
})