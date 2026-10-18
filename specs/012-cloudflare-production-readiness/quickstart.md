# Quickstart: Validate Cloudflare Release Readiness

## Prerequisites

- Node.js 22 and npm dependencies from `package-lock.json`.
- No Cloudflare credentials are needed for the local validation commands.
- A real staging/production D1 ID and configured remote secret names are required only for the explicit remote release commands; neither is available in this feature branch.

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

Expected before account provisioning: both commands fail with the target's placeholder D1 ID. They do not authenticate or contact Cloudflare. After D1 creation, replace the placeholder with the real database ID and rerun; never reuse the local D1 ID.

## Remote stage release (not performed by this feature)

After the account owner creates a separate staging D1 and Worker, adds all required staging secrets, and confirms the selected hostname, run `npm run worker:deploy:staging`. The release script checks the target locally, builds, reads remote secret names without reading values, then deploys only `--env staging`.

Before any production release, complete staging smoke checks for login, facility scoping, gate entry/exit, configuration changes, offline sync, event invalidation, private API `no-store`, and logs/traces/source maps. Review pending production migrations separately. For the Workers Free target, verify D1 reports `version: production` and record a recovery point within the 7-day Time Travel window.

## Rollback

Rollback Worker code to a known-good version and D1 data to an independently selected recovery timestamp only when required. A Worker version rollback does not roll back D1 schema or records. Workers Free retains D1 Time Travel points for 7 days; confirm the database is on supported production storage and rehearse restore with staging before considering production ready.
