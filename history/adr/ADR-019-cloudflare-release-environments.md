# ADR-019: Cloudflare Release Environments and Guarded Deployment

- **Status**: Accepted
- **Date**: 2026-10-18
- **Feature**: [012-cloudflare-production-readiness](../../specs/012-cloudflare-production-readiness/spec.md)
- **Supersedes**: None

## Context

The existing Wrangler configuration exposes only local development values and a local D1 placeholder, while the deploy script runs `wrangler deploy` without selecting an environment. Cloudflare named environments do not inherit vars or service bindings. The application also needs a distinct D1 database and Durable Object namespace for each remote environment. The Cloudflare account's D1 IDs, secret values, and custom domain are not available in this repository session.

## Decision

Keep the existing `wrangler.toml`; its top-level target remains local development, with shared entrypoint, Static Assets, runtime flags, and migration metadata. Add explicit `staging` and `production` Wrangler environments with separate Worker identity, D1, Durable Object binding/migration, environment value, and required secret names. Use placeholder D1 IDs until account provisioning supplies real values.

Expose local-only preflight commands and explicit target-specific deployment scripts. Static configuration is validated before network access; the release script checks remote secret names without reading their values, then deploys only the requested `--env`. CI runs verification and a local dry-run packaging check but does not deploy. No remote resources, secrets, migrations, routes, or deployments are created by this decision.

## Consequences

- Ordinary local development and D1 initialization continue to select local resources.
- A release cannot accidentally publish the top-level development configuration through the old generic deploy command.
- Account-specific D1 IDs must be added to the target environment before local preflight passes.
- Required secret names must exist on the selected remote Worker before its release command proceeds.
- Staging and production Durable Object namespaces are distinct unless an explicit `script_name` intentionally shares one; no sharing is intended here.
- The initial hostname may be the generated workers.dev hostname. A custom domain is a separate account decision and configuration change.
- Code rollback and D1 point-in-time recovery remain separate operations.

## Alternatives considered

1. Keep the top-level-only config and manually remember a deploy flag — rejected because it preserves the current unsafe default.
2. Maintain a separate TOML file per environment — rejected because it duplicates shared Worker, Assets, and migration configuration.
3. Let CI deploy production on every main push — rejected because there are no account IDs, secrets, selected domain, or explicit deployment authorization in this feature.
4. Provision resources automatically — rejected because it would mutate an account without account-specific identifiers and separate authorization.

## Implementation status

- The local Wrangler target remains the default; staging and production have separate Worker names, D1 IDs, Durable Object migrations, required secret names, Static Assets, Logs, Traces, and source-map upload settings.
- Local preflight rejects placeholder IDs before network access. Explicit release scripts validate the target and required secret names before deploying only the named environment.
- CI runs repository gates and a dry-run explicitly targeting the root environment; it has no Cloudflare credentials and does not deploy.
- The API now returns generic unexpected-error responses and emits structured, redacted request/error logs. Expected 4xx business and authorization responses remain readable.
- Local verification passed, including coverage, type checking, lint, dependency audit, build, and Wrangler dry-run. Real account IDs/secrets and the staging rehearsal remain prerequisites; no remote Cloudflare operation was run.

## References

- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Durable Objects environments](https://developers.cloudflare.com/durable-objects/reference/environments/)
- [Cloudflare Workers CI/CD](https://developers.cloudflare.com/workers/ci-cd/)
