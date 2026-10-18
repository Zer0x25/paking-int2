# Implementation Plan: Cloudflare Production Readiness

**Branch**: `012-cloudflare-production-readiness` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

## Summary

Separate local, staging, and production Worker environments in the existing Wrangler TOML; make release commands fail closed on incomplete environment configuration or missing required secret names; keep ordinary development local-only. In parallel, close the 500-response information leak, add privacy-safe structured request/error logs and Cloudflare observability/source maps, then bring GitHub Actions up to the repository's release quality gates. Finish with an operator runbook for D1 migrations, smoke checks, Worker rollback, and D1 recovery. The deployment itself and all account mutations remain out of scope.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 22 for scripts and CI.
**Primary Dependencies**: Cloudflare Workers, Wrangler 4.151.1, Hono 4.6, Vite 6, React 18, D1, Durable Objects.
**Storage**: D1 SQLite per named remote environment; local D1 remains the development default; IndexedDB remains client-side operational storage.
**Testing**: Vitest unit suite and `@cloudflare/vitest-pool-workers` Worker integration suite; ESLint; TypeScript; npm audit; Vite build; Wrangler local dry-run packaging.
**Target Platform**: Cloudflare Workers + Workers Static Assets; GitHub Actions for validation; workers.dev as initial hostname option.
**Project Type**: Offline-first SPA and authenticated Worker API.
**Performance Goals**: No new polling, D1 query, or Worker request is introduced by release readiness changes. API failures remain bounded to existing response paths.
**Constraints**: Do not use production IDs or credentials that are unavailable; never run remote migrations or deploy; no secret values in source, logs, command arguments, or artifacts; preserve local-only D1 init/dev behavior; meet the repository coverage floor of 85%.
**Scale/Scope**: One Cloudflare account, one facility application, three isolated environments, two operator roles.

## Constitution Check (before design)

- **Spec first**: Pass. This plan follows `specs/012-cloudflare-production-readiness/spec.md`; clarify pass recorded before planning.
- **TDD**: Pass with gate. Write and demonstrate failing tests before implementation for deployment guards, generic errors, and observability-safe logs.
- **Cloudflare security/efficiency**: Pass. Keep secrets out of vars/config, preserve JWT/facility checks and private no-store responses, isolate D1/DO per environment, add no recurring queries.
- **DoD**: Pass with implementation tasks. CI will run unit/Worker coverage, `tsc --noEmit` (both existing typecheck projects), ESLint, `npm audit`, build, and a local Wrangler dry run.
- **External operations**: Pass. No Cloudflare login, resource creation, secret write, migration, DNS mutation, or deployment in this feature.
- **Architectural decisions**: Record the environment/release boundary in ADR-019.

## Phase 0: Research decisions

The full decision record and official Cloudflare references are in [research.md](./research.md).

1. Keep the existing `wrangler.toml`; no incidental format migration.
2. Use Wrangler named environments. Cloudflare does not inherit vars or bindings into named environments, so staging and production must repeat D1, Durable Object, `ENVIRONMENT`, and required-secret declarations.
3. Set staging/production D1 IDs to explicit nonfunctional placeholders until the account creates the databases. A Node preflight validates the target blocks locally before any Cloudflare request. The release runner checks only required secret names remotely, then deploys the selected environment.
4. Keep `worker:dev` and local D1 initialization unchanged. Replace the ambiguous top-level deploy script with named staging/production release commands.
5. Use generic client 500s plus structured server logs. Log method, path, duration, status, error class/message/stack only; never request bodies, authorization headers, passwords, tokens, or vehicle/session payloads.
6. Enable Workers Logs, Traces, and uploaded source maps for named environments; keep server source maps out of the public Vite `dist` assets.
7. Update the compatibility date to 2026-10-18 as a deliberate runtime change and run the full existing suite before considering it complete.

## Phase 1: Design and contracts

- [data-model.md](./data-model.md): release target, release candidate, secret-name set, migration, and recovery point.
- [contracts/release-cli.md](./contracts/release-cli.md): local preflight and explicit release command behavior.
- [contracts/api-errors.md](./contracts/api-errors.md): error response shape and logging privacy boundary.
- [quickstart.md](./quickstart.md): local checks and non-mutating release readiness validation.

### Constitution Check (post-design)

- Same layering and persistence architecture; no domain behavior changes: **pass**.
- Local development remains local and secrets remain in ignored `.dev.vars`: **pass**.
- Separate staging/production bindings and secret names; actual IDs/secret values remain account-owned inputs: **pass**.
- TDD artifacts precede implementation in tasks: **pass**.
- External provisioning/deployment explicitly excluded: **pass**.
- Compatibility date advances only with the test matrix; a failed runtime check blocks that task rather than being waived: **pass**.

## Implementation sequence

The actionable backlog is in [tasks.md](./tasks.md). The delivery order is: (1) lock the Wrangler environments and release preflight, (2) add CI quality gates and an operational release/recovery guide, and (3) close error disclosure and add safe telemetry. Each implementation slice starts with a failing test.

## Project Structure

```text
wrangler.toml
worker-configuration.d.ts
scripts/deploy/validate-environment.mjs
scripts/deploy/release.mjs
src/server/index.ts
src/server/routes/auth.ts
src/server/routes/http-errors.ts
src/server/middleware/request-logging.ts
tests/unit/config/worker-deployment.test.ts
tests/unit/server/test_generic_server_errors.test.ts
tests/unit/server/test_request_logging.test.ts
.github/workflows/agentic-factory-dod.yml
README.md
specs/012-cloudflare-production-readiness/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
history/adr/ADR-019-cloudflare-release-environments.md
history/prompts/PHR-016-cloudflare-production-readiness.prompt.md
```

**Structure Decision**: Keep the existing single application and Wrangler configuration. Add two small release scripts and targeted tests; no new runtime library or application layer is introduced.

## Complexity Tracking

No constitutional exception is proposed. Account identifiers and deployed secrets are operator inputs, and remote setup remains a later, explicitly authorized activity.
