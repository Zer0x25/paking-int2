# Cloudflare Release Readiness Checklist

**Current status: PRODUCTION DEPLOYED; INITIAL PRODUCTION SMOKE PASSED.** Production is live at `https://parking.zer0x.org`. The second-facility isolation, physical second-device event, sampled source-mapped trace, and D1 restore rehearsal remain open; these are follow-up checks, not blockers for the operator's current single-facility workflow.

## Account and target setup

- [ ] Confirm the Cloudflare account owner and least-privilege access for the maintainer.
- [x] Create the staging D1 database `paking-db-staging`; its ID is configured in `wrangler.toml`.
- [x] Create the production D1 database `paking-db-production`; its ID is configured in `wrangler.toml`.
- [x] Create the staging Worker `paking-int2-worker-staging`.
- [x] Create the production Worker `paking-int2-worker-production`.
- [x] Add the five required staging secrets from the private `.dev.vars.staging` file with the initial deployment. Values are excluded from Git and this checklist.
- [x] Add the five required production secret names and values from the private `.dev.vars.production` file during the initial deployment. Values are excluded from Git and this checklist.
- [x] Use `workers.dev` as the initial staging hostname; it is enabled in `wrangler.toml`.
- [x] Configure the custom domain `parking.zer0x.org` in the active `zer0x.org` zone; production `workers.dev` access is disabled.
- [x] Run `npm run worker:preflight:staging`; the local configuration check passed and made no Cloudflare API request.
- [x] Run `npm run worker:preflight:production` after recording the production D1 ID.

## Release candidate and staging

- [x] Record release commit `5330aea3f114efd06ac5252439dd4d49b198edd8`; local push gate, coverage, types, lint, dependency audit, build, and Wrangler dry-run passed.
- [ ] Confirm the hosted CI result for the release commit.
- [x] Apply `0001_initial_persistence.sql` only to the staging database.
- [x] Apply `0002_facility_lifecycle.sql`, `0003_default_space_category.sql`, and `0004_space_category_capacity.sql` to the staging D1 database before releasing the facility lifecycle and typed capacity code.
- [x] Deploy staging from `.dev.vars.staging`; `/api/health` returned HTTP 200 with `Cache-Control: no-store`.
- [x] Verify admin/operator login, request scope rejection for a different facility ID, gate entry/exit, configuration permissions, offline sync/outbox, and event invalidation between browser clients.
- [ ] Verify isolation using two separately provisioned facilities and identities; a mismatched facility ID alone does not prove tenant-to-tenant isolation.
- [x] Verify private API responses use `Cache-Control: no-store`; inspect structured request/error logs and confirm generic 500 responses.
- [ ] Inspect an actual sampled trace and source-mapped exception stack; configuration and trace fields alone do not prove source-map remapping.
- [x] Rehearse Worker rollback on staging and restore the current version.
- [x] Confirm D1 Time Travel returned a bookmark for a point during the last 7 days.
- [ ] Rehearse D1 restore on an isolated staging copy; restoring the current database was not performed because it would replace current data.

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
- Superseded by the staging QA follow-up below.

### Staging QA follow-up — 2026-10-18

- Source commit under test: `5330aea3f114efd06ac5252439dd4d49b198edd8`. The Worker was active at version `34c12096-dd51-4e8b-8b35-5899820ded66` before the rollback drill and was restored to that version afterward.
- Scope and authorization checks: admin and operator logins succeeded; operator configuration access and writes returned 403; requests for a different facility ID returned 403; unauthenticated catalog access returned 401. Private responses included `Cache-Control: no-store`.
- Configuration mutation checks: the facility name was changed temporarily and restored; a synthetic contractual unit, area, and event were created and edited; an active dependency correctly blocked unit deactivation with 409; the event was cancelled and the area and unit were deactivated. The final read confirmed the facility name was restored, the synthetic records were inactive/cancelled, and the pre-test six active sessions remained.
- Offline and event checks: a real browser tab went offline, saved one synthetic vehicle entry locally, and showed one pending outbox change. Reconnection synchronized it; another browser tab received the active-list invalidation (six to seven vehicles). The test vehicle was then exited through the UI and the count returned to six. This used two browser tabs in one Chrome profile, not two physical devices.
- Logs: Cloudflare Observability showed `http.request` records and one controlled `server.error` record for an intentionally malformed JSON request. The response was a generic 500 with no stack/details. Trace identifier fields were present; an actual sampled trace with a remapped stack was not verified.
- Worker recovery: rollback to `cfc76add-fe33-4cd0-a0ff-c72cafea023e` succeeded. Health, admin login, catalog, and active-session reads returned 200 with six active sessions. The Worker was immediately restored to `34c12096-dd51-4e8b-8b35-5899820ded66` at 100% traffic. No D1 data was restored or overwritten.
- D1 recovery readiness: `wrangler d1 time-travel info` returned a bookmark for `2026-10-18T22:00:00Z`. A restore rehearsal still requires an isolated copy or separate authorization to replace staging data.
- Remaining staging checks: full tenant isolation with two distinct facilities/identities, actual two-device event invalidation, an observed sampled trace with a source-mapped stack, and D1 restore on an isolated database.

## Production release

- [x] Review production Worker/D1 IDs, secret names, custom hostname, migration SQL/state, compatibility date, and staging evidence independently from staging values.
- [ ] Rehearse D1 restore on an isolated production copy and document the incident owner's separate Worker rollback/D1 restore procedures.
- [x] Obtain explicit authorization for the production migration and deployment.
- [x] Apply the reviewed migrations to production, deploy with `npm run worker:deploy:production`, and complete the production smoke checks.

### Production release evidence — 2026-10-18

- Source commit: `2276b9273aedfe4cecd7c2eb21d30e687b302dea` on `main`. The production D1 ID, `workers.dev = false`, and custom-domain route are deployed from local `wrangler.toml` changes that remain uncommitted.
- D1: `paking-db-production` (`9b165ff1-4830-4206-a9f7-15dfd0ffd63d`); migrations `0001` through `0004` applied. Wrangler reports no pending migrations.
- Worker: `paking-int2-worker-production`, version `2b72c400-cc67-417f-9657-01958fb91136`, at `https://parking.zer0x.org`; custom-domain HTTPS and TLS verification passed. The generated `workers.dev` and Preview URLs are disabled.
- Secrets: all five required names are present as Cloudflare `secret_text`; values were uploaded from the local mode-`0600` file and were never printed.
- Checks: production preflight, TypeScript/Vite/PWA build, Wrangler dry-run before initial deploy, deployment release script, root SPA HTTP 200, `/api/health` HTTP 200 with `Cache-Control: no-store`, and admin login HTTP 200.
- Bootstrap: the first admin identity was initialized in production D1. It has no facility assigned yet, so the first login proceeds to the initial facility setup; no facility or sample business data was created.
- Remaining checks: separate second-facility tenant isolation is not currently available in the operator's workflow; physical-device event invalidation, sampled source-mapped trace review, and isolated D1 restore remain unverified.

The account owner and release operator must update this checklist with evidence after each item is completed. A successful local build or preflight does not satisfy a remote account, migration, staging, or smoke-check item.
