# Production Readiness

This document tracks the work required before Tomoe should be called stable for production.

## Current Status

Tomoe is a release candidate. It has a real routing core, middleware pipeline, schema-validation relics, OpenAPI generation, a Node adapter, adapter edge coverage, and a repeatable Node soak harness. It still needs broader multi-runtime validation, release discipline, and external security review before a stable 1.0 label is credible.

## Release Gates

Tomoe should not publish a stable 1.0 release until these gates are complete:

- CI passes on supported Node versions.
- `pnpm test:bun` passes against the built package on Bun.
- Node adapter behavior is tested for streaming request bodies, streaming response bodies, aborted uploads, repeated `Set-Cookie` headers, and `HEAD` fallback.
- HEAD, OPTIONS, 404, and 405 behavior is covered.
- Cookie, header, CSRF, and malformed URL behavior is covered.
- Rate limiter memory behavior is covered.
- `pnpm test:soak` passes on Node 22 for representative middleware, guards, JSON bodies, params, and nested `unite()` route chains.
- Benchmark report includes Hono, Elysia, Fastify, Express, and Tomoe with exact versions.
- Benchmark methodology includes repeated runs, raw output, and environment details.
- Security policy is published.
- Release notes and migration notes are published.
- External security review is complete or explicitly deferred in release notes.

## Runtime Support Matrix

| Runtime | Status | Required Before Stable |
| --- | --- | --- |
| Bun | Primary target | CI smoke tests and benchmark runs |
| Node.js | Supported through adapter | Adapter load tests, stream tests, graceful shutdown docs |
| Cloudflare Workers | Intended | Worker smoke test and docs |
| Deno | Intended | Deno smoke test and docs |
| Vercel/serverless | Intended | Example deployment and cold-start notes |

## Operational Checklist For Apps

Applications using Tomoe in production should provide:

- Reverse proxy body-size limits.
- Request timeout and idle timeout settings.
- Structured logging with sensitive header redaction.
- Central error reporting.
- Health and readiness endpoints.
- Graceful shutdown for Node deployments.
- Distributed rate limiting when multiple processes or regions are used.
- Explicit CORS and CSRF policy.
- Integration tests for every route contract.

## Known Limitations

- The built-in rate limiter is in-memory and per process.
- The Node adapter converts Node streams to Web streams and should be measured on the target workload.
- OpenAPI generation covers common schemas but is not a full replacement for dedicated schema-to-OpenAPI tooling.
- Built-in middleware is intentionally small and does not replace application security policy.
