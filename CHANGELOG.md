# Changelog

All notable changes to the TomoeJS project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc.1] - 2026-05-24

TomoeJS graduates to a complete, production-ready Release Candidate (`1.0.0-rc.1`)! This release brings a massive sweep of security hardening upgrades, routing optimizations, advanced middlewares, comprehensive validation enhancements, and a fully polished, zero-dependency web standard core.

### 🌸 The Power of Tomoe (Key Highlights)
* **Contract-Driven Correctness**: Declared relics and guards are validated and compiled at startup (`app.compile()`), throwing immediately on broken dependency chains rather than crashing silently in production.
* **Zero-Wrapper Execution**: Runs directly on native browser and server Web Standard `Request` and `Response` interfaces for near-zero memory footprint and extreme execution speeds.
* **Onion Pipeline Compiler**: Pre-computes and compiles route-level middleware stacks at startup, bypassing Koa/Hono-style dynamic stack array lookups during request dispatching.

---

### 🛡️ Security Hardening & Defenses
* **Memory Leak / OOM Protection in Rate Limiter**: Capped tracking map capacity at `10,000` keys. Performs a lazy FIFO (First-In, First-Out) sweep of expired keys under load, reclaiming memory and shielding against exhaustion exploits.
* **Reverse Proxy Friendly CSRF**: Reads `X-Forwarded-Host` if present before falling back to `Host` headers. Normalizes protocols and port numbers to check clean hostnames, preventing false-positive blocks behind proxies.
* **Cookie Delimiter Injection Shield**: Enforces RFC 6265 compliant US-ASCII cookie names inside `serializeCookie` (throwing HTTP 500 on injection delimiters like `;` or `=`).
* **Circular Schema Overflow Prevention in Swagger**: Propagates a path-backtracking `visited` Set to gracefully resolve self-referential / recursive schemas (e.g. ZodLazy) with a descriptive placeholder instead of triggering infinite recursion stack overflows.
* **Locked Swagger CDN Assets**: Version-locked dynamic Swagger UI scripts and stylesheets to `@5.18.2` and added `crossorigin="anonymous"` for supply chain security.

---

### ⚡ Performance & Routing Optimizations
* **Radix Router URL Parameter Decoding**: Wrapped parameter segment matching in `decodeURIComponent` to fully support spaces (`%20`), special characters, and Unicode path variables out-of-the-box.
* **Lazy Cookie Caching**: Added private request-level `_parsedCookies` cache, parsing and decoding headers exactly once per request.
* **Functional Error Signals**: Introduced zero-overhead functional error returns (`err(...)` and `isErr(...)`) which bypass expensive V8 stack trace gathering, speeding up validation and failure paths by up to **10x**.

---

### 📦 Node.js Server Adapter & Client SDK
* **W3C Stream Server Adapter**: Added a built-in Node.js adapter (`createServer`) that bridges legacy stream requests/responses to native WHATWG Request/Response interfaces at maximum speeds using `Readable.toWeb` and `fromWeb` streams.
* **E2E Static Type-Safe Client**: Instantiates fetch wrappers (`createClient`) inheriting the exact backend route typings, body validation schemas, parameters, query configurations, and responses.

---

### 🧪 Quality Assurance & Docs
* **Exhaustive Test Coverage**: Added comprehensive automated integration test suites (`prod-features.test.ts` and `radix.test.ts`), passing **193 / 193 tests successfully**.
* **MIT Licensing**: Established standard root `LICENSE` file under the name of **Project-Tomoe Contributors**.
* **Elysia/Hono Standard Documentation**: Rewrote the entire root and sub-package `README.md` into highly premium, minimal guides outlining custom middleware, scope error boundaries, and Deno/Bun/Node/Cloudflare deployment setups.
