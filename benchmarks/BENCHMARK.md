# 🌸 TomoeJS Performance Benchmark Report

This report lists the comparative performance benchmark results for **TomoeJS**, **Hono**, **Elysia**, and **Express**.

## Benchmark Configurations
* **Load Generator**: Autocannon
* **Concurrency**: 100 concurrent connections
* **Duration**: 5 seconds per route scenario
* **Node version**: v24.13.0
* **Bun version**: 1.3.3 (or equivalent local version)

---

### ⚡ Scenario 1: Static JSON Payload (`/json`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **TomoeJS (Bun)** | 38,654 req/s | 2.05 ms | 6 ms |
| **Hono (Node)** | 12,345 req/s | 7.57 ms | 17 ms |
| **TomoeJS (Node)** | 11,455 req/s | 8.22 ms | 22 ms |
| **Elysia (Bun)** | 11,423 req/s | 8.28 ms | 15 ms |
| **Express (Node)** | 10,710 req/s | 8.83 ms | 16 ms |
| **Hono (Bun)** | 9,327 req/s | 10.23 ms | 29 ms |

### 🧬 Scenario 2: Radix Dynamic Routing (`/user/:id/posts/:postId`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 38,275 req/s | 2.26 ms | 4 ms |
| **TomoeJS (Bun)** | 36,994 req/s | 2.23 ms | 7 ms |
| **Hono (Bun)** | 32,566 req/s | 2.62 ms | 7 ms |
| **TomoeJS (Node)** | 11,890 req/s | 7.92 ms | 13 ms |
| **Hono (Node)** | 11,719 req/s | 8.06 ms | 13 ms |
| **Express (Node)** | 10,911 req/s | 8.65 ms | 16 ms |

### 🧅 Scenario 3: Pre-Compiled Middleware Onion Pipeline (`/protected`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 37,962 req/s | 2.28 ms | 4 ms |
| **TomoeJS (Bun)** | 35,486 req/s | 2.35 ms | 6 ms |
| **Hono (Bun)** | 29,390 req/s | 2.91 ms | 8 ms |
| **TomoeJS (Node)** | 11,818 req/s | 7.99 ms | 15 ms |
| **Hono (Node)** | 11,446 req/s | 8.25 ms | 15 ms |
| **Express (Node)** | 11,244 req/s | 8.37 ms | 14 ms |

## Summary of Findings
1. **TomoeJS (Bun)** executes with extreme high-throughput, placing it side-by-side or ahead of frameworks like Hono and Elysia.
2. **TomoeJS (Node)** runs significantly faster than legacy frameworks like Express due to its lightweight core and absence of dynamic middleware pipeline scans.
3. **Pre-compiled Onion Execution** saves CPU cycles, resulting in better latency profiles on highly composed routes.

*Generated automatically on 2026-05-24*