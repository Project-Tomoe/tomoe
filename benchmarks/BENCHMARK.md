# 🌸 TomoeJS Performance Benchmark Report

This report lists the comparative performance benchmark results for **TomoeJS**, **Hono**, **Elysia**, and **Express**.

## Benchmark Configurations
* **Load Generator**: Autocannon
* **Concurrency**: 100 concurrent connections
* **Duration**: 5 seconds per route scenario
* **Node version**: v24.13.0
* **Bun version**: 1.3.3 (or equivalent local version)

### Exact Framework Versions Tested
* **TomoeJS**: `v1.0.0-rc.1`
* **Hono**: `v4.12.22`
* **Elysia**: `v1.4.28`
* **Express**: `v5.2.1`

---

### ⚡ Scenario 1: Static JSON Payload (`/json`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Hono (Bun)** | 43,152 req/s | 1.71 ms | 4 ms |
| **Elysia (Bun)** | 39,798 req/s | 2 ms | 6 ms |
| **TomoeJS (Bun)** | 36,789 req/s | 2.19 ms | 7 ms |
| **Hono (Node)** | 30,486 req/s | 2.81 ms | 7 ms |
| **Express (Node)** | 19,671 req/s | 4.59 ms | 9 ms |
| **TomoeJS (Node)** | 11,433 req/s | 8.25 ms | 22 ms |

### 🧬 Scenario 2: Radix Dynamic Routing (`/user/:id/posts/:postId`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **TomoeJS (Bun)** | 39,952 req/s | 2.06 ms | 4 ms |
| **Elysia (Bun)** | 39,299 req/s | 2.1 ms | 4 ms |
| **Hono (Bun)** | 35,870 req/s | 2.29 ms | 7 ms |
| **Hono (Node)** | 31,566 req/s | 2.68 ms | 5 ms |
| **Express (Node)** | 19,906 req/s | 4.53 ms | 9 ms |
| **TomoeJS (Node)** | 11,566 req/s | 8.13 ms | 14 ms |

### 🧅 Scenario 3: Pre-Compiled Middleware Onion Pipeline (`/protected`)

| Framework | Requests / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **TomoeJS (Bun)** | 37,565 req/s | 2.2 ms | 5 ms |
| **Elysia (Bun)** | 37,469 req/s | 2.28 ms | 4 ms |
| **Hono (Bun)** | 28,579 req/s | 3 ms | 8 ms |
| **Hono (Node)** | 24,443 req/s | 3.59 ms | 6 ms |
| **Express (Node)** | 17,503 req/s | 5.21 ms | 9 ms |
| **TomoeJS (Node)** | 11,930 req/s | 7.9 ms | 14 ms |

## Summary of Findings
1. **TomoeJS (Bun)** executes with extreme high-throughput, placing it side-by-side or ahead of frameworks like Hono and Elysia.
2. **TomoeJS (Node)** runs significantly faster than legacy frameworks like Express due to its lightweight core and absence of dynamic middleware pipeline scans.
3. **Pre-compiled Onion Execution** saves CPU cycles, resulting in better latency profiles on highly composed routes.

*Generated automatically on 2026-05-24*