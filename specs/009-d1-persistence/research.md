# Research: Persistencia Central de la Aplicación

**Feature**: [spec.md](spec.md)
**Date**: 2026-10-17

## Decision 1: Use the D1 binding already configured for the Worker

- **Decision**: Use the request's `PARKING_DB` D1 binding and the existing Drizzle ORM package. Construct the Drizzle adapter from the current request environment rather than a process-global object.
- **Rationale**: The repository already declares the D1 binding and its schema, and Drizzle documents first-class D1/Workers support. This closes the existing gap without changing hosting or adding a second database.
- **Alternatives considered**: A new SQL database client or direct SQL in every route. Rejected because it duplicates infrastructure or spreads persistence details into the route layer.
- **Sources**: [Drizzle D1 driver](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1), [Cloudflare D1 binding API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Decision 2: Versioned SQL migrations managed by Wrangler

- **Decision**: Keep migration files in the existing configured `src/server/db/migrations` directory and apply them only to local D1 during this feature.
- **Rationale**: Wrangler supports listing and applying D1 migrations against the local database. A SQL migration directory makes clean setup and replay explicit without adding Drizzle Kit, which is not currently installed.
- **Alternatives considered**: Drizzle Kit schema push and remote D1 provisioning. Rejected because the user asked to work locally, production resources are explicitly out of scope, and migrations are already configured in `wrangler.toml`.
- **Sources**: [Wrangler D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/).

## Decision 3: Batch domain write, audit write, and sync receipt

- **Decision**: Use D1 batch transactions for each write aggregate, with an optimistic facility-version compare-and-swap and conditional statements to ensure a failed guard does not apply later statements.
- **Rationale**: Cloudflare documents D1 batches as sequential transactions that roll back when a statement fails. Grouping the business mutation and audit receipt minimizes round trips and prevents a success response without its audit trail. A facility-scoped version guard protects aggregate invariants across areas, bookings, and active sessions.
- **Alternatives considered**: Independent writes or an in-memory mutex. Rejected because they can leave partial audit state, do not coordinate across Worker isolates, and can lose state on restart.
- **Sources**: [D1 batch semantics](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Decision 4: Test the Worker with a real local D1 binding

- **Decision**: Extend the repository's Workers Vitest project with D1 migrations and tests that invoke the Worker routes, assert persisted rows, retry sync mutations, and restart/rehydrate behavior.
- **Rationale**: The installed `@cloudflare/vitest-plugin` runs tests in the Workers runtime with local Miniflare bindings and isolated storage per test file. This exercises the D1 binding and Worker Web APIs rather than route-only in-memory mocks.
- **Alternatives considered**: Node-only tests with fake repositories. Rejected as the only integration layer because they cannot prove migration, D1 binding, transaction, or Worker behavior.
- **Sources**: [Cloudflare Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/), [Workers test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/).

## Decision 5: Use Istanbul instrumentation for Worker coverage

- **Decision**: Keep the existing V8 provider for Node unit tests and configure the Workers Vitest project to collect Istanbul-instrumented coverage with the same minimum thresholds.
- **Rationale**: Cloudflare documents that native V8 coverage is not supported in the Workers Vitest runtime and that coverage must use Istanbul instrumentation. Vitest provides an Istanbul coverage provider.
- **Alternatives considered**: Use V8 coverage in both projects. Rejected because Cloudflare documents it as unsupported in the Workers runtime.
- **Sources**: [Cloudflare Workers Vitest known issues](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/), [Vitest coverage providers](https://vitest.dev/guide/coverage.html).

## Decision 6: Validate local development credentials from `.dev.vars`

- **Decision**: Validate local development usernames/passwords against `.dev.vars`; persist the username, display identity, and role in D1, but no password or password hash. Production authentication is not decided by this local-only feature.
- **Rationale**: The user chose `.dev.vars` for local accounts. Cloudflare documents a 10 ms CPU limit per request on Workers Free, so this feature avoids selecting a password KDF whose production CPU cost cannot be proven by local tests. The existing admin/operator authorization still uses the identity/role record after validation.
- **Alternatives considered**: Persist Argon2id hashes now and claim Workers Free compatibility. Rejected because the account plan limits requests to 10 ms of CPU and the local Worker test runtime does not establish the production CPU budget. Use an external identity provider. Deferred because it expands scope beyond local D1 integration.
- **Sources**: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Decision 7: Keep development credentials local and never default JWT signing secrets

- **Decision**: Read `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD`, and `JWT_SECRET` from `.dev.vars`, ignore local `.dev.vars` variants in Git, and document only empty placeholders in `.dev.vars.example`. Remove visible password-prefill shortcuts from the login view. Do not continue with hard-coded fallback secrets.
- **Rationale**: The user selected `.dev.vars`; Cloudflare documents it for local secrets and says it must not be committed. The current code has a versioned default JWT secret and plaintext sample users, which must not survive a durable-user migration.
- **Alternatives considered**: Use Wrangler `[vars]`, a tracked seed SQL password, or keep login shortcuts that set passwords. Rejected because all expose credentials or signing material in the versioned app/bundle.
- **Sources**: [Cloudflare local secrets](https://developers.cloudflare.com/workers/local-development/environment-variables/).

## Decisions fully resolved

- All current server stores move together so sessions, catalog, allocation, audit, and auth share one durable source of truth.
- IndexedDB/outbox remains the local offline layer; successful sync operations receive a durable idempotency receipt.
- Development initialization seeds only an empty local catalog; it never overwrites existing local data.
- Production D1 creation, production data migration, production credentials, and deployment are excluded.
