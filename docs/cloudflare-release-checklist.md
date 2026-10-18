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
- [x] Apply `0002_facility_lifecycle.sql`, `0003_default_space_category.sql`, and `0004_space_category_capacity.sql` to the staging D1 database before releasing the facility lifecycle and typed capacity code.
- [x] Deploy staging from `.dev.vars.staging`; `/api/health` returned HTTP 200 with `Cache-Control: no-store`.
- [ ] Verify admin/operator login, facility scoping, gate entry/exit, configuration permissions, offline sync, and event invalidation.
- [ ] Verify private API responses use `Cache-Control: no-store`; review structured Logs, Traces, and source-mapped errors for sensitive data.
- [ ] Rehearse Worker rollback and D1 restore on staging. Confirm D1 `version: production`, retain a recovery point within the Workers Free 7-day window, and record the recovery outcome.

### Staging release evidence — 2026-10-18

- Code commit: `8658af11610eeec81171ae44dc04534d5455bbef` on `013-accessible-space-allocation`, pushed to `origin`.
- D1 target: `paking-db-staging` (`33b5b562-ebef-4bd6-aff9-c0026d4dc03c`); migrations `0002`, `0003`, and `0004` applied. Wrangler reports no migrations pending.
- Worker: `paking-int2-worker-staging`, version `cfc76add-fe33-4cd0-a0ff-c72cafea023e`, at `https://paking-int2-worker-staging.jmella-hs.workers.dev`.
- Checks: staging preflight, build, Wrangler dry-run, `/api/health` HTTP 200 (`no-store`), static app HTTP 200, and presence of `standard_capacity` and `accessible_capacity` in `parking_areas`.
- The push gate passed 225 unit tests and 41 Worker tests. Authenticated admin/operator workflows and the remaining staging smoke checks are still outstanding.

### Staging follow-up release — 2026-10-18

- Code commit: `5330aea3f114efd06ac5252439dd4d49b198edd8` (`feat(gate): infer movement from active plate`).
- D1 target: `paking-db-staging`; Wrangler reported `No migrations to apply`.
- Worker: `paking-int2-worker-staging`, active version `34c12096-dd51-4e8b-8b35-5899820ded66` at 100%, deployed at `2026-10-18T21:52:30Z`.
- Local release gates passed: preflight, frontend and Worker coverage (93.92% / 91.09% statements), typecheck, lint, `npm audit` (0 vulnerabilities), production build, and Wrangler staging dry-run.
- Smoke checks passed: root and `/dashboard` loaded the SPA in a real browser; generated JS asset returned HTTP 200; `/api/health` returned HTTP 200 with `no-store`; anonymous session reads returned HTTP 401 with `no-store`; admin/operator login and role restrictions worked; admin catalog and operator active-session reads worked; synthetic gate entry appeared in the active list, exit completed it, and the vehicle was absent from the active list afterward.
- Two synthetic gate test sessions were entered and exited in staging with device ID `codex-staging-smoke`; they remain in session history/audit and are no longer active. Test plates: `ZD-PY-GF` and `HS-EW-75`.
- Still outstanding: facility-scope isolation, offline IndexedDB sync/outbox, cross-device event invalidation, full configuration mutation review, structured Logs/Traces and source-map review, and rollback/D1 restore rehearsal. These checks are not covered by this release evidence.

## Production release

- [ ] Review production IDs, secret names, hostname, migration SQL/state, compatibility date, and staging evidence independently from staging values.
- [ ] Confirm a tested Worker version and D1 recovery point are available and that the incident owner knows the separate rollback/restore procedures.
- [ ] Obtain explicit authorization for the production migration and deployment.
- [ ] Apply reviewed migrations to production, deploy only with `npm run worker:deploy:production`, and complete the production smoke checks.

The account owner and release operator must update this checklist with evidence after each item is completed. A successful local build or preflight does not satisfy a remote account, migration, staging, or smoke-check item.
