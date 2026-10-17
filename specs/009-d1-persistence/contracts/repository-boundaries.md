# Repository Boundaries Contract

## Domain boundary

- Pure rules in `src/core/rules/` and `src/core/models/` receive domain records and return decisions/updated records. They do not import Hono, D1, Drizzle, IndexedDB, or global request state.
- Worker routes validate input and obtain authenticated user context; they do not maintain arrays as a source of truth.

## Persistence boundary

- A repository is created with the request's `PARKING_DB` binding.
- Repository reads are facility-scoped and select only required columns/records.
- A write aggregate carries an expected facility version and, where applicable, entity version. The first statement checks all relevant expected versions and capacity/idempotency preconditions before advancing the facility version; following batch statements require that incremented version. Constraint failures roll back the transaction.
- Audit and sync-receipt inserts are part of the same committed batch as their mutation.
- Missing bindings and storage exceptions are surfaced as errors; there is no memory repository fallback in runtime code.

## Seed boundary

- Non-sensitive base catalog data is a reproducible development fixture, applied only to an empty local catalog.
- Passwords and JWT signing key are read from `.dev.vars`; no values are checked into Git or returned in logs/responses.
- Local account bootstrap is idempotent and stores only identity/role data. Password validation reads `.dev.vars`; no password or password hash is written to D1.
