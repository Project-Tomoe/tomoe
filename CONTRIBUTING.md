# Contributing

## Development Setup

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

Use small pull requests with a clear reproduction or use case. For framework behavior changes, include tests that fail before the change.

## Compatibility Rules

Tomoe is still in release-candidate status, but public API changes should be handled deliberately.

- Avoid breaking route registration, middleware, relics, guards, context helpers, and adapters unless the change is required for correctness or security.
- Document breaking changes in `CHANGELOG.md`.
- Add migration notes for renamed APIs or changed runtime behavior.
- Prefer additive APIs over replacing existing behavior.

## Test Expectations

Production-facing changes should include tests for at least one of:

- Runtime behavior through `app.fetch`.
- Type inference when public types change.
- Adapter behavior for Node or Bun.
- Error handling and edge cases.
- Security-sensitive behavior such as headers, cookies, CSRF, validation, or body parsing.

## Benchmarks

Benchmarks are useful only when they are reproducible. Benchmark PRs should include:

- Runtime versions.
- Operating system and CPU.
- Exact command.
- Raw output or generated report.
- Multiple runs or a note that results are single-run only.

Do not update README performance claims without updating benchmark evidence.
