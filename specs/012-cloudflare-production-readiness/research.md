# Research: Cloudflare Production Readiness

**Date**: 2026-10-18

## Decision 1: Keep one Wrangler TOML with isolated named environments

**Decision**: Preserve `wrangler.toml` and add explicit `staging` and `production` environments. Keep top-level `worker:dev` and local D1 behavior. Define D1, Durable Object binding, environment variable, observability settings, and required secret names in each named environment. Give each environment a distinct Worker name and D1 database name. Use obvious placeholder D1 IDs until Cloudflare creates the databases.

**Rationale**: Wrangler environments create separately named Workers, and vars and bindings are not inherited. Durable Object bindings are also non-inheritable; each named environment must declare the binding and its migration. One config file keeps the existing local workflow recognizable and makes the selected `--env` reviewable.

**Alternatives considered**:
- Separate Wrangler configs per environment: rejected because they duplicate the current entrypoint, assets, migrations, and runtime flags.
- Use production resources from local `wrangler dev`: rejected because local development must remain local-only.
- Use Cloudflare Workers Builds: deferred; the repo already uses GitHub Actions and can validate there without granting deployment credentials.

## Decision 2: Fail-closed release command with static and remote checks

**Decision**: Add a local-only configuration validator that checks an explicitly named environment, `ENVIRONMENT`, D1 binding/name/UUID, DO binding/class/migration, `workers.dev` readiness, required secret names, and observability/source-map configuration. A separate named release command runs build, performs the local validation, lists remote secret *names* for that Worker/environment, checks the required set, and only then runs `wrangler deploy --env <target>`. The existing ambiguous `worker:deploy` alias is removed or made explicitly production-targeted.

**Rationale**: Static omissions and placeholders can be rejected without network access. Remote secret names cannot be proven from local files, so they are checked read-only after local validation and before deployment. Secret values are never requested, printed, or passed as command-line arguments by the script. The script never creates D1, applies migrations, modifies DNS, or writes secrets.

**Alternatives considered**:
- Treat `wrangler deploy --dry-run` as the production preflight: rejected because it is a packaging check and does not confirm account resources or deployed secret names.
- Automatically create databases or write secrets: rejected because account IDs/credentials are unavailable and this feature must remain non-mutating remotely.

## Decision 3: Generic client errors and privacy-safe structured logs

**Decision**: Unexpected server errors return a stable generic 500 response. Known validation, authorization, conflict, and business-rule failures retain their current intentional status and message. Structured request logs include only method, path without query, status, and duration. Error logs include a request path, error class, and diagnostic message/stack, but never log request bodies, headers, tokens, passwords, or parking-session records.

**Rationale**: Current `app.onError`, login catch blocks, and shared route error helpers expose implementation exception messages. Hono route catches also need the same boundary; preserving known business errors avoids changing user-facing domain behavior.

**Alternatives considered**:
- Return raw exception text: rejected because D1/configuration details can be disclosed.
- Silence all server errors: rejected because operators would lose usable diagnostics.
- Log full request/response bodies: rejected because they can contain credentials and vehicle data.

## Decision 4: Enable Cloudflare observability and upload Worker source maps

**Decision**: Enable Workers Logs and Traces in staging and production, use bounded sampling values, and configure `upload_source_maps = true` for Wrangler's Worker bundle. Keep Worker maps outside the static Vite `dist` directory.

**Rationale**: Cloudflare recommends enabling logs/traces before production and uploading maps so stack traces point back to original TypeScript. Wrangler generates/uploads maps for its Worker bundle; this repo does not use the Cloudflare Vite plugin to build the Worker. Sampling is configurable for data volume.

**Alternatives considered**:
- Enable logs only: rejected because traces are separately enabled.
- Publish all maps with static assets: rejected because server source maps are intended for Worker error diagnosis, not public download.

## Decision 5: Advance compatibility date intentionally with runtime tests

**Decision**: Update the existing compatibility date from 2024-10-15 to 2026-10-18 in the isolated config change and run all unit and Cloudflare Worker tests plus package checks. Keep `nodejs_compat` and the existing Static Assets flag.

**Rationale**: Cloudflare recommends periodically advancing existing Worker compatibility dates. Cloudflare retains the behavior controlled by older dates, so the date is not an expiry; advancing it should remain a reviewed runtime change. The project already has Workers tests and a test explicitly freezing the old date, which will be changed to assert the intentional new value.

**Alternatives considered**:
- Keep the old date indefinitely: rejected because it leaves the app on a two-year-old runtime baseline and misses fixes/new behavior.
- Bump without tests: rejected because runtime behavior changes can affect Web APIs, D1, WebSockets, or Static Assets.

## Official Cloudflare references

- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/): compatibility dates, `nodejs_compat`, source maps, observability, JSON logs, and route/domain setup.
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/): environment naming, non-inherited vars/bindings, and environment-specific secrets.
- [Durable Objects environments](https://developers.cloudflare.com/durable-objects/reference/environments/): per-environment DO bindings/namespaces and migrations.
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/): required secret names and non-inheritance.
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/): secret storage and deployment validation.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) and [Traces](https://developers.cloudflare.com/workers/observability/traces/): request logs and trace configuration; traces are separate from logs.
- [Source maps](https://developers.cloudflare.com/workers/observability/source-maps/): upload source maps for original source stack traces; build tools must generate the maps and server maps should stay out of public assets.
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/): track and apply versioned database changes per selected target.
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): point-in-time recovery; available for supported production storage databases.
- [Workers CI/CD](https://developers.cloudflare.com/workers/ci-cd/): use an integrated or external pipeline; GitHub Actions is compatible with this repo.
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/): current SPA assets deployment path; the repo already uses the supported Assets configuration.

## Repository evidence

- `wrangler.toml` currently has only a development `ENVIRONMENT`, a local D1 placeholder ID, one DO binding/migration, and Static Assets SPA fallback.
- `package.json` currently sets `worker:deploy` to `wrangler deploy src/server/index.ts` without a named environment.
- `.github/workflows/agentic-factory-dod.yml` currently runs `npm test` if Node is detected, but omits coverage, typecheck, lint, audit, build, and Wrangler packaging.
- `src/server/index.ts` returns `err.message` to API clients; `src/server/routes/auth.ts` and `src/server/routes/http-errors.ts` also return internal messages on several 500 paths.
- The existing Static Assets fallback, no-store private API headers, JWT/facility scoping, event-driven updates, and DO WebSocket hibernation behavior are already implemented and will be preserved.

## Free-tier recovery limit

Cloudflare's current D1 Time Travel page says it can restore supported production-storage databases within 30 days on Workers Paid and 7 days on Workers Free. Older D1 `alpha` storage uses the legacy snapshot backup API, so the runbook must verify `wrangler d1 info <database>` reports `version: production` before presenting Time Travel as available. Time Travel restore overwrites the database and must be treated as destructive. The plan and recovery data model use the 7-day Free-tier window.
