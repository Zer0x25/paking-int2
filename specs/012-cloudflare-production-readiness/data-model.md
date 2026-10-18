# Data Model: Cloudflare Production Readiness

This feature adds release metadata and documentation only. It does not add application tables or change D1 schema.

## Deployment environment

| Field | Type | Validation |
|---|---|---|
| name | `development \| staging \| production` | Exact supported target; deploy commands reject other values. |
| workerName | string | Distinct named Worker for staging and production; local name remains unchanged. |
| environmentValue | string | Must match the selected target. |
| d1Binding | string | `PARKING_DB` in every environment. |
| d1DatabaseName | string | Distinct name per remote target; local name remains `paking-db`. |
| d1DatabaseId | UUID string | Remote environments require a real Cloudflare D1 ID; local placeholder is forbidden remotely. |
| durableObjectBinding | string | `FACILITY_EVENTS` bound to exported class `FacilityEventHub` in each named environment. |
| staticAssetDirectory | path | Existing `./dist` Workers Static Assets directory and SPA fallback. |
| workersDevEnabled | boolean | `true` until an explicit custom hostname is selected and configured. |
| observability | `{ logs, traces, sampleRates }` | Enabled for staging and production; sample rates are in `[0,1]`. |
| requiredSecretNames | string list | Exact keys `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD`, `JWT_SECRET`; values never enter release metadata. |

## Release candidate

| Field | Type | Validation |
|---|---|---|
| sourceRevision | Git revision | Must be the checked-out commit/PR revision under review. |
| qualityGateResult | pass/fail per gate | Tests/coverage, typecheck, lint, npm audit, build, and Wrangler dry-run packaging. |
| target | deployment environment | Explicit target; no implicit production default for local development. |
| migrationState | pending/applied/verified | Read from the selected D1 environment before release; not inferred from a successful Worker build. |

## Recovery point

| Field | Type | Validation |
|---|---|---|
| workerVersion | deployed Worker version | Select a known-good version for code rollback. |
| d1Timestamp | Unix timestamp / recovery bookmark | Select independently from Worker version; restore is a separate D1 operation; on the target Free tier it must be within the last 7 days and the database must use Time Travel-supported production storage. |
| target | staging/production | Must match the affected deployment and D1 database. |

## Relationships and state transitions

- A release candidate targets exactly one deployment environment.
- Each remote environment binds exactly one isolated D1 database and one environment-specific Durable Object namespace.
- A deployment does not modify the D1 schema automatically; migrations are reviewed and applied as a separately named operation before application release.
- A Worker rollback restores code/version only. D1 recovery is separate, can overwrite later data, and requires its own selected recovery point.
- Required secret names are configuration metadata. Secret values belong to Cloudflare and are never represented in the repository model.
