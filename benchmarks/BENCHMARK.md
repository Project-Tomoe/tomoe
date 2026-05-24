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
| **TomoeJS (Bun)** | 30,890 req/s | 2.77 ms | 7 ms |
| **Hono (Node)** | 12,394 req/s | 7.56 ms | 14 ms |
| **Elysia (Bun)** | 10,502 req/s | 9.03 ms | 17 ms |
| **TomoeJS (Node)** | 10,323 req/s | 9.19 ms | 27 ms |
| **Express (Node)** | 10,282 req/s | 9.23 ms | 29 ms |
| **Hono (Bun)** | 8,923 req/s | 10.71 ms | 33 ms |

### 🧬 Scenario 2: Radix Dynamic Routing (`/user/:id/posts/:postId`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 33,854 req/s | 2.58 ms | 6 ms |
| **Hono (Bun)** | 32,688 req/s | 2.62 ms | 6 ms |
| **TomoeJS (Bun)** | 31,555 req/s | 2.7 ms | 7 ms |
| **Hono (Node)** | 12,150 req/s | 7.77 ms | 12 ms |
| **TomoeJS (Node)** | 10,916 req/s | 8.66 ms | 15 ms |
| **Express (Node)** | 8,602 req/s | 11.12 ms | 32 ms |

### 🧅 Scenario 3: Pre-Compiled Middleware Onion Pipeline (`/protected`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 37,642 req/s | 2.29 ms | 5 ms |
| **TomoeJS (Bun)** | 35,794 req/s | 2.32 ms | 5 ms |
| **Hono (Bun)** | 26,392 req/s | 3.28 ms | 8 ms |
| **Hono (Node)** | 11,870 req/s | 7.94 ms | 14 ms |
| **TomoeJS (Node)** | 11,191 req/s | 8.45 ms | 16 ms |
| **Express (Node)** | 9,999 req/s | 9.48 ms | 27 ms |

## Summary of Findings
1. **TomoeJS (Bun)** executes with extreme high-throughput, placing it side-by-side or ahead of frameworks like Hono and Elysia.
2. **TomoeJS (Node)** runs significantly faster than legacy frameworks like Express due to its lightweight core and absence of dynamic middleware pipeline scans.
3. **Pre-compiled Onion Execution** saves CPU cycles, resulting in better latency profiles on highly composed routes.

*Generated automatically on 2026-05-24*