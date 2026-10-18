# Cloudflare Deployment and Recovery Runbook

This project targets Workers + Workers Static Assets with D1 and Durable Objects. The workflow below is intentionally manual. GitHub Actions validates code and packages a local dry run; it has no Cloudflare credentials and never deploys.

## Environment map

| Target | Worker | D1 | Secret source | Hostname mode |
|---|---|---|---|---|
| Local | `paking-int2-worker` | Local D1 `paking-db` | Ignored local `.dev.vars` | Local Wrangler URL |
| Staging | `paking-int2-worker-staging` | `paking-db-staging` | Cloudflare Worker secrets | `workers.dev` until a custom hostname is chosen |
| Production | `paking-int2-worker-production` | `paking-db-production` | Cloudflare Worker secrets | `workers.dev` until a custom hostname is chosen |

Named Wrangler environments do not inherit vars or service bindings. Keep the D1 IDs distinct and replace only the two matching placeholders in `wrangler.toml`. D1 IDs are account configuration, not credentials; API tokens and application secrets are credentials and must stay out of Git.

## Local development and repository gates

Local development continues to use only local D1 and `.dev.vars`:

```sh
npm run db:local:init
npm run worker:dev
```

Run local readiness checks without Cloudflare credentials:

```sh
npm run worker:preflight:staging
npm run worker:preflight:production
npm run test:coverage
npm run typecheck
npm run lint
npm audit
npm run worker:dry-run
```

Before remote provisioning, the two target preflights are expected to fail on the placeholder D1 IDs. They must not contact Cloudflare. `worker:dry-run` packages the top-level local environment only; it is not proof that remote bindings, secrets, DNS, or the application work in Cloudflare.

## One-time Cloudflare account setup

The account owner performs these steps in the intended Cloudflare account. Current staging provisioning evidence is recorded in the [release checklist](cloudflare-release-checklist.md); production provisioning remains outstanding.

1. Authenticate with the account owner’s Wrangler profile. For CI or service accounts, use a narrowly scoped API token stored in GitHub Secrets; do not paste it into chat or store it in the repository.
2. Create separate D1 databases, one for each remote environment:

   ```sh
   npx wrangler d1 create paking-db-staging
   npx wrangler d1 create paking-db-production
   ```

3. Copy each returned UUID into the matching `database_id` placeholder in `wrangler.toml`. Never use `local-d1-paking-db` for either remote target.
4. Create the two Workers with the names in the environment map. Use these names for each environment: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD`, and `JWT_SECRET`. Use unique credentials per environment and a strong signing secret. Do not put values in `vars`, command arguments, source code, or this runbook. For an initial deployment when the Worker does not exist yet, Wrangler can create it and upload the secrets in the same operation: `npx wrangler deploy --env staging --secrets-file .dev.vars.staging`. The file must contain only staging credentials and remain private (`0600`). For a later release, use `npm run worker:deploy:staging`, which checks the remote secret names before deploying. Production requires its own completed preflight and explicit deployment authorization; `.dev.vars.production` is a local-development file and does not upload secrets by itself. `wrangler secret put` creates and deploys a Worker version immediately.
5. Leave `workers_dev = true` for the initial deployment. Cloudflare supplies the account-specific workers.dev subdomain. If a custom domain is selected later, add the exact environment-specific route/domain to Wrangler configuration and disable workers.dev for that target; rerun preflight before release.
6. Verify the local target config:

   ```sh
   npm run worker:preflight:staging
   npm run worker:preflight:production
   ```

   Each must pass only after its matching D1 ID is a UUID, the worker/D1 names are unique, the expected bindings/migrations and required secret names are declared, the hostname mode is selected, and Logs/Traces/source-map configuration is enabled.

## Staging release

1. Confirm the `staging` D1 ID, Worker name, `ENVIRONMENT = "staging"`, workers.dev setting, and all five remote secret names.
2. Review migration state using the explicit staging target and remote database name:

   ```sh
   npx wrangler d1 info paking-db-staging --env staging
   npx wrangler d1 migrations list paking-db-staging --remote --env staging
   ```

3. Review the migration SQL in `src/server/db/migrations/`. If a migration is expected, apply it only to staging and review Wrangler’s confirmation and result:

   ```sh
   npx wrangler d1 migrations apply paking-db-staging --remote --env staging
   ```

   Wrangler records applied migrations and captures a D1 backup after applying. Do not use `--local` for a remote release.
   The facility lifecycle and initial space-category changes add `0002_facility_lifecycle.sql` and `0003_default_space_category.sql`; both are pending in the current staging D1 and must be reviewed before their code release.
4. After the initial Worker exists, run `npm run worker:deploy:staging` for later code releases. The release script validates local configuration, builds, reads only the remote secret names, and deploys only `--env staging`. Missing config or secret names stop before deployment.
5. Check the deployed Worker URL and Workers Logs/Traces. Confirm source-mapped stacks identify the original TypeScript source. Run the smoke checks below before accepting the staging release.

## Smoke checks before production

- `/api/health` returns healthy status.
- Admin and operator login work with the staging credentials; no credentials appear in logs or responses.
- Anonymous data reads are rejected; authenticated requests remain scoped to the assigned facility.
- Gate entry, active vehicle list, exit, and correction of an active plate work.
- Configuration mutations work for authorized admins and remain blocked for operators.
- Offline IndexedDB sync, outbox acknowledgments, and cross-device event invalidation work against staging.
- Private API responses include `Cache-Control: no-store`; Static Assets serve the SPA and nested routes.
- Induced internal errors return generic messages; authorized maintainers can find structured diagnostics and source-mapped stack traces without request bodies or vehicle records.
- Staging D1 migrations report no unexpected pending changes; Worker Logs and Traces appear for requests.

## Production release

Production follows the same sequence as staging with `production` in every target-specific command and `paking-db-production` as the D1 database. Do not promote staging IDs or secrets into production. Review all quality gates, staging results, compatibility-date changes, migration SQL, secret names, and hostname before executing `npm run worker:deploy:production`.

The release command is manual; CI does not deploy. The repository intentionally has no generic `worker:deploy` command that could select the top-level local configuration.

## Compatibility date

The current compatibility date is `2026-10-18`. Advance it intentionally after reviewing Cloudflare compatibility changes and running unit tests, Worker integration tests, local Worker packaging, and staging smoke checks for Durable Objects, D1, Static Assets, and WebSockets. Do not treat a successful package dry run as runtime verification.

## Rollback and D1 recovery

Worker code rollback and D1 data recovery are separate operations. Rolling back Worker code does not restore connected resources or database rows and may fail if a Durable Object class lifecycle changed. Confirm the exact target and known-good Worker version before running a rollback:

```sh
npx wrangler rollback <known-good-version-id> --env staging
```

Use `--env production` only for an explicitly approved production recovery. Do not paste version IDs or run the production command without confirming the affected target.

For the Workers Free target, D1 Time Travel retention is **7 days**. Before relying on it, check `npx wrangler d1 info <database> --env <target>` and confirm the storage version is `production`; legacy `alpha` databases use the older snapshot backup system. Restore overwrites the selected database in place and cancels in-flight queries. Rehearse this on staging first, confirm the database name and selected timestamp, and preserve the returned bookmark so a restore can be undone if necessary.

Staging example only:

```sh
npx wrangler d1 time-travel info paking-db-staging --timestamp="<RFC3339 timestamp within 7 days>" --env staging
npx wrangler d1 time-travel restore paking-db-staging --timestamp="<RFC3339 timestamp within 7 days>" --env staging
```

After recovery, re-check migration state and run the staging smoke checks. Restore production only under the account owner's incident procedure and after explicitly confirming the correct D1 name, target, storage support, and recovery timestamp.

## Inputs that still block deployment

- Cloudflare account authentication/ownership and least-privilege access.
- Real, separate staging and production D1 IDs.
- All required secret names and values on the matching target Workers.
- Confirmation of workers.dev as the initial hostname, or the exact custom domain/zone if that changes.
- Staging provisioning, migration rehearsal, smoke checks, source-map/log review, and recovery drill.
- Production migration review and explicit deployment authorization.

Track release-specific evidence in the [Cloudflare release checklist](cloudflare-release-checklist.md). Its current status is **not ready for deployment**.

## References

- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Traces](https://developers.cloudflare.com/workers/observability/traces/), and [source maps](https://developers.cloudflare.com/workers/observability/source-maps/)
