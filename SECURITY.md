# Security Policy

## Supported Versions

Tomoe is currently in release-candidate status. Security fixes target the latest published release candidate unless the maintainers announce otherwise.

| Version | Supported |
| --- | --- |
| 1.0.0-rc.x | Yes |
| < 1.0.0-rc | No |

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability.

Email the maintainers or use GitHub private vulnerability reporting when enabled. Include:

- Affected Tomoe version.
- Runtime and version: Bun, Node.js, Deno, Cloudflare Workers, or another adapter.
- Minimal reproduction code.
- Expected and actual behavior.
- Impact assessment, including whether the issue enables data exposure, auth bypass, denial of service, request smuggling, header injection, or cross-site request forgery.

The project should acknowledge reports within 7 days and provide a fix, mitigation, or status update within 30 days for confirmed vulnerabilities.

## Security Boundaries

Tomoe provides routing, middleware execution, schema validation hooks, cookie serialization checks, CSRF middleware, and in-memory rate limiting. Applications remain responsible for:

- Authentication and authorization policy.
- Secret storage.
- Database query safety.
- Body-size limits at the reverse proxy, runtime, or adapter layer.
- TLS termination and proxy configuration.
- Persistent or distributed rate limiting.
- Escaping user-controlled HTML.
- Logging redaction for credentials, cookies, and personal data.

## External Review

Before a stable 1.0 release, the project should complete an external security review covering the router, Node adapter, middleware chain, schema validation, cookies, CSRF, OpenAPI generation, and denial-of-service behavior.
