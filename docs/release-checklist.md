# Release Checklist

Use this checklist for every release candidate and stable release.

## Before Versioning

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm type-check`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:bun`
- [ ] `pnpm test:soak`
- [ ] `pnpm build`
- [ ] `pnpm audit --prod`
- [ ] Benchmark report regenerated when performance claims change.
- [ ] README performance section matches benchmark results.
- [ ] `CHANGELOG.md` documents user-visible changes.
- [ ] Migration notes are included for breaking changes.
- [ ] Supported runtime matrix is updated.

## Versioning

- [ ] Package versions updated.
- [ ] Git tag created.
- [ ] GitHub release created with changelog.
- [ ] npm package published with provenance when available.

## After Release

- [ ] Install the published package in a clean app.
- [ ] Run Node smoke test.
- [ ] Run Bun smoke test.
- [ ] Verify package exports and type declarations.
- [ ] Verify docs examples compile.
