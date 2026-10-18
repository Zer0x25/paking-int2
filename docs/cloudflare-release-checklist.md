# Cloudflare Release Readiness Checklist

**Current status: NOT READY FOR DEPLOYMENT.** The repository configuration and local gates can be prepared independently, but the account-specific and staging checks below are still outstanding.

## Account and target setup

- [ ] Confirm the Cloudflare account owner and least-privilege access for the maintainer.
- [ ] Create separate D1 databases for staging and production; record each returned ID in the matching `wrangler.toml` environment.
- [ ] Confirm the staging and production Worker names and create both Workers.
- [ ] Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD`, and `JWT_SECRET` to each matching Worker using the approved secret channel. Do not place values in Git, `vars`, command arguments, CI output, or this checklist.
- [ ] Confirm `workers.dev` is the initial hostname, or supply and configure the exact custom domain and zone for each target.
- [ ] Run both local environment preflights; confirm they identify the intended unique D1 and Worker targets.

## Release candidate and staging

- [ ] Record the release commit SHA and confirm CI passes tests and 85% coverage, types, lint, dependency audit, build, and Wrangler dry-run.
- [ ] Review pending staging D1 migrations and apply them only to the staging database.
- [ ] Deploy the staging target and verify `/api/health`, admin/operator login, facility scoping, gate entry/exit, configuration permissions, offline sync, and event invalidation.
- [ ] Verify private API responses use `Cache-Control: no-store`; review structured Logs, Traces, and source-mapped errors for sensitive data.
- [ ] Rehearse Worker rollback and D1 restore on staging. Confirm D1 `version: production`, retain a recovery point within the Workers Free 7-day window, and record the recovery outcome.

## Production release

- [ ] Review production IDs, secret names, hostname, migration SQL/state, compatibility date, and staging evidence independently from staging values.
- [ ] Confirm a tested Worker version and D1 recovery point are available and that the incident owner knows the separate rollback/restore procedures.
- [ ] Obtain explicit authorization for the production migration and deployment.
- [ ] Apply reviewed migrations to production, deploy only with `npm run worker:deploy:production`, and complete the production smoke checks.

The account owner and release operator must update this checklist with evidence after each item is completed. A successful local build or preflight does not satisfy a remote account, migration, staging, or smoke-check item.
