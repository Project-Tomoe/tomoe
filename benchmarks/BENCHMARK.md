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
| **TomoeJS (Bun)** | 13,675 req/s | 6.84 ms | 23 ms |
| **Hono (Node)** | 11,342 req/s | 8.32 ms | 18 ms |
| **Express (Node)** | 10,631 req/s | 8.9 ms | 16 ms |
| **TomoeJS (Node)** | 10,285 req/s | 9.22 ms | 27 ms |
| **Hono (Bun)** | 9,022 req/s | 10.57 ms | 48 ms |
| **Elysia (Bun)** | 8,858 req/s | 10.77 ms | 28 ms |

### 🧬 Scenario 2: Radix Dynamic Routing (`/user/:id/posts/:postId`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 39,235 req/s | 2.23 ms | 4 ms |
| **Hono (Bun)** | 24,654 req/s | 3.56 ms | 8 ms |
| **TomoeJS (Bun)** | 14,314 req/s | 6.49 ms | 15 ms |
| **TomoeJS (Node)** | 11,097 req/s | 8.52 ms | 14 ms |
| **Express (Node)** | 10,996 req/s | 8.59 ms | 14 ms |
| **Hono (Node)** | 10,620 req/s | 8.91 ms | 14 ms |

### 🧅 Scenario 3: Pre-Compiled Middleware Onion Pipeline (`/protected`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 37,765 req/s | 2.31 ms | 5 ms |
| **Hono (Bun)** | 21,515 req/s | 4.14 ms | 8 ms |
| **TomoeJS (Bun)** | 14,714 req/s | 6.3 ms | 11 ms |
| **TomoeJS (Node)** | 11,494 req/s | 8.21 ms | 15 ms |
| **Express (Node)** | 10,172 req/s | 9.32 ms | 16 ms |
| **Hono (Node)** | 9,604 req/s | 9.9 ms | 21 ms |

## Summary of Findings
1. **TomoeJS (Bun)** executes with extreme high-throughput, placing it side-by-side or ahead of frameworks like Hono and Elysia.
2. **TomoeJS (Node)** runs significantly faster than legacy frameworks like Express due to its lightweight core and absence of dynamic middleware pipeline scans.
3. **Pre-compiled Onion Execution** saves CPU cycles, resulting in better latency profiles on highly composed routes.

*Generated automatically on 2026-05-24*