# Quickstart: Validate Cloudflare Release Readiness

## Prerequisites

- Node.js 22 and npm dependencies from `package-lock.json`.
- No Cloudflare credentials are needed for the local validation commands.
- The staging D1 has been provisioned and its UUID is configured in `wrangler.toml`; production D1 and all remote Worker secrets remain external prerequisites.

## Local development stays local

```sh
npm run db:local:init
npm run worker:dev
```

Expected: Wrangler reports local D1 and serves the Worker locally. Do not pass `--remote` to local D1 initialization.

## Run the repository release gates

```sh
npm run test:coverage
npm run typecheck
npm run lint
npm audit
npm run build
npm run worker:dry-run
```

Expected: both Vitest suites meet their configured 85% coverage thresholds; type checks, lint, audit, build, and local asset packaging exit 0. A local packaging result is not evidence that a remote binding exists.

## Check target configuration without Cloudflare access

```sh
npm run worker:preflight:staging
npm run worker:preflight:production
```

Expected for the current checkout: staging passes its local TOML checks; production fails on its placeholder D1 ID. Neither command authenticates or contacts Cloudflare. Never reuse the local D1 ID for a remote target.

## Current staging status and remaining checks

The staging D1 exists and `0001_initial_persistence.sql` is applied. The facility lifecycle and gate bootstrap changes add `0002_facility_lifecycle.sql` and `0003_default_space_category.sql`; they are pending in staging and must be reviewed/applied before releasing this code. The currently deployed Worker predates those migrations and the facility lifecycle changes. The initial Worker deployment used `npx wrangler deploy --env staging --secrets-file .dev.vars.staging` so code and staging secrets were published together. Wrangler confirmed all five secret names as `secret_text`; `/api/health` returned HTTP 200 with `Cache-Control: no-store`. For a later authorized staging release, run `npm run worker:deploy:staging`; it checks remote secret names without reading values before deploying.

Before any production release, complete staging smoke checks for login, facility scoping, gate entry/exit, configuration changes, offline sync, event invalidation, private API `no-store`, and logs/traces/source maps. Review pending production migrations separately. For the Workers Free target, verify D1 reports `version: production` and record a recovery point within the 7-day Time Travel window.

## Rollback

Rollback Worker code to a known-good version and D1 data to an independently selected recovery timestamp only when required. A Worker version rollback does not roll back D1 schema or records. Workers Free retains D1 Time Travel points for 7 days; confirm the database is on supported production storage and rehearse restore with staging before considering production ready.
