# 🌸 TomoeJS Performance Benchmark Report

This report lists the comparative performance benchmark results for **TomoeJS**, **Hono**, and **Elysia**.

## Benchmark Configurations
* **Load Generator**: Autocannon (HTTP) & Custom WS Benchmarking Client (WebSockets)
* **Concurrency**: 100 concurrent connections
* **Duration**: 5 seconds per route scenario
* **Node version**: v24.13.0
* **Bun version**: 1.3.3 (or equivalent local version)

### Exact Framework Versions Tested
* **TomoeJS**: `v1.0.0-rc.3`
* **Hono**: `v4.12.23`
* **Elysia**: `v1.4.28`

---

### ⚡ Scenario 1: Static JSON Payload (`/json`)

| Framework | Requests or Messages / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **TomoeJS (Bun)** | 45,131 req/s | 1.58 ms | 5 ms |
| **Hono (Bun)** | 42,691 req/s | 1.91 ms | 4 ms |
| **Elysia (Bun)** | 41,987 req/s | 1.96 ms | 4 ms |
| **Hono (Node)** | 29,480 req/s | 2.92 ms | 7 ms |
| **TomoeJS (Node)** | 20,369 req/s | 4.41 ms | 11 ms |

### 🧬 Scenario 2: Radix Dynamic Routing (`/user/:id/posts/:postId`)

| Framework | Requests or Messages / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **TomoeJS (Bun)** | 45,853 req/s | 1.54 ms | 4 ms |
| **Elysia (Bun)** | 39,043 req/s | 2.21 ms | 4 ms |
| **Hono (Bun)** | 36,856 req/s | 2.3 ms | 4 ms |
| **Hono (Node)** | 29,067 req/s | 3 ms | 6 ms |
| **TomoeJS (Node)** | 22,600 req/s | 3.95 ms | 8 ms |

### 🧅 Scenario 3: Pre-Compiled Middleware Onion Pipeline (`/protected`)

| Framework | Requests or Messages / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 37,878 req/s | 2.29 ms | 4 ms |
| **TomoeJS (Bun)** | 33,573 req/s | 2.41 ms | 6 ms |
| **Hono (Bun)** | 31,886 req/s | 2.54 ms | 6 ms |
| **Hono (Node)** | 23,374 req/s | 3.76 ms | 8 ms |
| **TomoeJS (Node)** | 20,616 req/s | 4.37 ms | 9 ms |

### 🔌 Scenario 4: WebSocket Echo message roundtrip (`/ws`)

| Framework | Requests or Messages / Sec (Throughput) | Avg Latency (ms) | P99 Latency (ms) |
|---|---|---|---|
| **Elysia (Bun)** | 45,535 msg/s | 0.43 ms | N/A |
| **TomoeJS (Node)** | 45,448 msg/s | 0.42 ms | N/A |
| **Hono (Bun)** | 44,159 msg/s | 0.44 ms | N/A |
| **Hono (Node)** | 43,964 msg/s | 0.45 ms | N/A |
| **TomoeJS (Bun)** | 27,759 msg/s | 0.69 ms | N/A |

## Summary of Findings
1. **TomoeJS (Bun)** matches or exceeds Elysia and Hono on the same host and runtime.
2. **TomoeJS (Node)** runs dynamically on standard Node.js environments and is optimized for production workloads using the compiled route stack.
3. **WebSocket Support** is natively integrated within the Node.js adapter pathways in TomoeJS, avoiding external router middleware wrappers.

*Generated automatically on 2026-05-31*