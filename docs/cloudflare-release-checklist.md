# Cloudflare Release Readiness Checklist

**Current status: STAGING DEPLOYED; PRODUCTION NOT READY.** Staging is live on `workers.dev`; application smoke checks and the production account setup remain outstanding.

## Account and target setup

- [ ] Confirm the Cloudflare account owner and least-privilege access for the maintainer.
- [x] Create the staging D1 database `paking-db-staging`; its ID is configured in `wrangler.toml`.
- [ ] Create the production D1 database `paking-db-production` and record its ID in the matching `wrangler.toml` environment.
- [x] Create the staging Worker `paking-int2-worker-staging`.
- [ ] Create the production Worker `paking-int2-worker-production`.
- [x] Add the five required staging secrets from the private `.dev.vars.staging` file with the initial deployment. Values are excluded from Git and this checklist.
- [ ] Add the same five required secret names with production-specific values to the production Worker using the approved secret channel.
- [x] Use `workers.dev` as the initial staging hostname; it is enabled in `wrangler.toml`.
- [ ] Confirm the production hostname or configure its exact custom domain and zone before a production release.
- [x] Run `npm run worker:preflight:staging`; the local configuration check passed and made no Cloudflare API request.
- [ ] Run `npm run worker:preflight:production` after creating the production D1 and recording its ID.

## Release candidate and staging

- [ ] Record the release commit SHA and confirm CI passes tests and 85% coverage, types, lint, dependency audit, build, and Wrangler dry-run.
- [x] Apply `0001_initial_persistence.sql` only to the staging database.
- [ ] Review and apply `0002_facility_lifecycle.sql` to staging before releasing the facility lifecycle code.
- [x] Deploy staging from `.dev.vars.staging`; `/api/health` returned HTTP 200 with `Cache-Control: no-store`.
- [ ] Verify admin/operator login, facility scoping, gate entry/exit, configuration permissions, offline sync, and event invalidation.
- [ ] Verify private API responses use `Cache-Control: no-store`; review structured Logs, Traces, and source-mapped errors for sensitive data.
- [ ] Rehearse Worker rollback and D1 restore on staging. Confirm D1 `version: production`, retain a recovery point within the Workers Free 7-day window, and record the recovery outcome.

## Production release

- [ ] Review production IDs, secret names, hostname, migration SQL/state, compatibility date, and staging evidence independently from staging values.
- [ ] Confirm a tested Worker version and D1 recovery point are available and that the incident owner knows the separate rollback/restore procedures.
- [ ] Obtain explicit authorization for the production migration and deployment.
- [ ] Apply reviewed migrations to production, deploy only with `npm run worker:deploy:production`, and complete the production smoke checks.

The account owner and release operator must update this checklist with evidence after each item is completed. A successful local build or preflight does not satisfy a remote account, migration, staging, or smoke-check item.
