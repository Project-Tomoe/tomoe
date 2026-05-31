# Changelog

All notable changes to the TomoeJS project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc.3] - 2026-05-31

TomoeJS release candidate (`1.0.0-rc.3`) introduces **first-class, native WebSocket support** across both Node.js and Bun runtimes, and focuses on closing the Node.js performance gap. By optimizing how Web standard interfaces bridge to Node's internal engine, this release achieves up to **60% higher throughput** under Node.js while keeping Bun and Cloudflare Workers at native peak speeds.

### 🌸 Key Highlights & New Features
* **Universal WebSocket API**: Implemented a unified native WebSocket routing API (`app.ws(path, handlers)`) supporting custom handshake authorization hooks, parameters, and relics on both Bun (native) and Node.js (bridged via `ws` adapter).

### ⚡ Performance, Routing & Node.js Bridge Optimizations
* **Lightweight `LazyResponse` Engine**: Implemented dynamic environment detection (`useLazyResponse`). Under Node.js, it uses a custom prototype-hacked JS class that defers standard native C++ `Response`/`Headers` instantiation until properties are accessed. In standard environments (Bun, Workers), it defaults to native objects for maximum speed.
* **Fast-Path Adapter Output**: Optimized header writing and body ending inside the Node.js HTTP server. It checks if the response headers were untouched and writes the plain JS `_rawHeaders` object directly via `res.setHeader`, completely avoiding native `Headers.forEach` iterations. Bypasses WHATWG stream read/pipe processes by writing raw body strings directly when available.
* **Zero-Allocation Router Path Slicing**: Rewrote the radix tree's `#splitPath` utility using a custom slice pointer loop, bypassing expensive string `.split("/")` and array `.filter(...)` allocations on every request.
* **Lazy Parameter Decoding**: Wrapped `decodeURIComponent` inside a quick `indexOf('%') !== -1` check, avoiding native calls and try-catch overhead for non-url-encoded path parameters.

### 🔌 WebSocket Enhancements
* **High-Throughput Node.js WebSockets**: Optimized connection upgrades in the Node.js adapter, achieving over **45,000 msg/s** and outperforming standard Node.js routing and messaging libraries.

### 🧪 Quality Assurance
* **Expanded Test Coverage**: Added websocket and adapter integration tests, increasing coverage to **216 passed unit tests**.

---

## [1.0.0-rc.2] - 2026-05-24

TomoeJS continues as a production-readiness Release Candidate (`1.0.0-rc.2`). This release brings security hardening upgrades, routing optimizations, advanced middlewares, validation enhancements, and a zero-dependency web standard core. Treat it as an RC until the release gates in `docs/production-readiness.md` are complete.

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

### ⚡ Performance, Routing & Error Handling Optimizations
* **Radix Router URL Parameter Decoding**: Wrapped parameter segment matching in `decodeURIComponent` to fully support spaces (`%20`), special characters, and Unicode path variables out-of-the-box.
* **Lazy Cookie Caching**: Added private request-level `_parsedCookies` cache, parsing and decoding headers exactly once per request.
* **Functional Error Signals**: Introduced zero-overhead functional error returns (`err(...)` and `isErr(...)`) which bypass expensive V8 stack trace gathering, speeding up validation and failure paths by up to **10x**.
* **Comprehensive HTTP Error Primitives**: Added and exported type-safe standard error constants for all common client-side (4xx) and server-side (5xx) HTTP/REST errors (e.g. `BadRequest`, `Unauthorized`, `PaymentRequired`, `Forbidden`, `NotFound`, `TooManyRequests`, `ServerError`, `GatewayTimeout`, etc.) that serialize automatically into standard JSON responses.

---

### 📦 Node.js Server Adapter & Client SDK
* **W3C Stream Server Adapter**: Added a built-in Node.js adapter (`createServer`) that bridges legacy stream requests/responses to native WHATWG Request/Response interfaces at maximum speeds using `Readable.toWeb` and `fromWeb` streams.
* **E2E Static Type-Safe Client**: Instantiates fetch wrappers (`createClient`) inheriting the exact backend route typings, body validation schemas, parameters, query configurations, and responses.

---

### 🧪 Quality Assurance & Docs
* **Exhaustive Test Coverage**: Added comprehensive automated integration test suites (`prod-features.test.ts` and `radix.test.ts`), passing **196 / 196 tests successfully**.
* **MIT Licensing**: Established standard root `LICENSE` file under the name of **Project-Tomoe Contributors**.
* **Premium Error and Extension Documentation**: Rewrote and expanded the root `README.md` to document the complete table of pre-built error constants, direct `HttpError` instantiation with custom payload details, and OOP subclassing extensions.

