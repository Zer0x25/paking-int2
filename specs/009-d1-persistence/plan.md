# Implementation Plan: Persistencia Central de la Aplicación

**Branch**: `009-d1-persistence` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-d1-persistence/spec.md`

## Summary

Replace every Worker-side in-memory store with Cloudflare D1 repositories using the existing Drizzle ORM dependency. Keep IndexedDB and its outbox as the offline client store, preserve existing HTTP payloads, and make successful offline retries idempotent. Apply schema changes through Wrangler local migrations; seed the current non-sensitive development catalog only into an empty local database. Load local account credentials and the JWT signing key from ignored `.dev.vars`; persist user identity and role, never passwords or password hashes. This is a local development authentication flow; production identity remains a separate decision. No production database, migration, or deployment is part of this feature.

## Technical Context

**Language/Version**: TypeScript 5.7, strict mode, ESM
**Primary Dependencies**: Cloudflare Workers, Hono, Drizzle ORM (already installed), Zod, Vitest
**Storage**: D1/SQLite for server-owned records; IndexedDB remains the PWA offline store and outbox
**Testing**: Vitest unit tests plus `@cloudflare/vitest-plugin` Worker tests with isolated D1 and applied local migrations; V8 coverage for Node tests and Istanbul-instrumented coverage for Worker tests; browser verification for the login, settings, gate, dashboard, and offline sync paths
**Target Platform**: Local Cloudflare Workers development backed by local D1; production binding and deployment excluded
**Project Type**: React/Vite PWA plus Hono Worker API
**Performance Goals**: No new network request per catalog row; read grouped catalog and dashboard data in bounded queries; login checks use local credentials and a D1 identity lookup
**Constraints**: Preserve public route shapes, roles, version checks, and IndexedDB outbox behavior. D1 writes for an operational change, its audit entry, and its idempotency receipt must commit together.
**Scale/Scope**: Current application entities and single-facility development fixture; no bulk import from an existing central database because none exists.

## Constitution Check

### Before Phase 0

- **I. Architecture and Offline-First**: PASS. Domain rules stay independent of Hono and D1; the Worker repositories become adapters. IndexedDB remains the client-side offline store and queues mutations for synchronization.
- **II. Test-First Rigorous**: PASS AS A GATE. Add failing Worker integration and repository tests before production changes; tests must use actual D1 bindings and local migrations. Use Istanbul instrumentation for Worker coverage because the Workers Vitest runtime does not support native V8 coverage; maintain the configured 85% coverage thresholds.
- **III. Security, Strict Schemas, and Free Tier**: PASS WITH DESIGN CONTROLS. Keep Zod validation; batch writes; add indexes for facility/state access; keep local credentials in ignored `.dev.vars`, persist no passwords in D1, preserve role checks and durable audit. Never silently fall back to memory. This local authentication choice does not define production identity.
- **IV. Definition of Done**: PASS AS A GATE. Typecheck, ESLint, Vitest coverage, build, `npm audit`, migration replay on a disposable local D1 store, and diff checks are required.
- **V. Convergence and E2E**: PASS AS A GATE. Run Spec Kit convergence and validate the visible flows in a real browser after implementation.
- **Architecture record**: Proposed [ADR-014](../../history/adr/ADR-014-d1-persistence-and-auth-bootstrap.md).
- **Session record**: This design and implementation are tracked in `history/prompts/PHR-012-d1-persistence.prompt.md`.

The test author operates in a separate context containing the specification, contracts, task, and test interfaces only. It must not inspect or receive production implementation files before delivering the failing tests; the implementation work starts after the red result is captured.

### After Phase 1 Design

- **I. Hexagonal and Offline-First**: PASS. `src/server/db/repositories/` contains the D1 adapters; `src/core/` remains framework and database independent; browser IndexedDB is unchanged.
- **II. TDD and Coverage**: PASS AS A RELEASE GATE. Test repositories and route behavior before replacing the stores. Browser checks cover persistence after restart and reconnection.
- **III. D1 Cost and Security**: PASS WITH A CONCURRENCY GUARD. Reads are scoped by facility and indexed; writes are batched and guarded by a facility version compare-and-swap. Local passwords are checked against `.dev.vars`, never persisted in D1; no secret defaults remain in tracked source. Production authentication remains out of scope.
- **IV/V. DoD and Convergence**: PASS AS RELEASE GATES. Migration, test, typecheck, lint, audit, build, convergence, and browser results will be recorded in the PHR before completion.

## Phase 0: Research Summary

See [research.md](research.md). The selected integration uses the already installed Drizzle D1 driver and Wrangler-managed SQL migrations. D1 batches execute statements sequentially as a transaction; a failed statement rolls back the batch. Worker tests already use Cloudflare's Vitest plugin. Its runtime needs Istanbul-instrumented coverage. The login change is limited to local `.dev.vars` credentials and D1 identity/role records, avoiding a production password-hashing choice in this local-only feature.

## Phase 1: Design and Contracts

See [data-model.md](data-model.md), [contracts/](contracts/), and [quickstart.md](quickstart.md).

### Data flow

1. Each authenticated Worker request receives the D1 binding through its request environment; the binding is validated at the boundary.
2. Routes validate request JSON with the current Zod schemas, load the minimal facility-scoped state needed by pure domain rules, and call repository operations.
3. A mutation reads the facility version, checks existing business rules, and then issues one ordered D1 batch. The first compare-and-swap includes the expected facility version and relevant entity/capacity/idempotency preconditions; later SQL statements are gated by the incremented version. Unique/check constraint errors roll the complete batch back. The batch writes the domain row, an audit record, and (for offline mutations) the idempotency receipt.
4. If the compare-and-swap or optimistic entity version fails, the API retains its existing conflict response shape and asks the caller to refresh or resolve the conflict. No route reports success for a no-op or partial write.
5. Sync records a successful mutation identifier and payload fingerprint with its result. Replaying the same ID and payload returns the stored success; reusing an ID for a different payload is a conflict.
6. On login, the Worker idempotently ensures the local identity/role records exist regardless of whether the catalog has already been seeded. Usernames, passwords, and the JWT signing secret come from `.dev.vars`; the password is checked there and is never written to D1. Missing required local variables fail closed. Production authentication is not selected by this feature.

### Repository boundaries

- `src/server/db/client.ts`: typed D1/Drizzle client creation per request.
- `src/server/db/repositories/catalog-repository.ts`: facility, category, area, business-unit, and event queries and writes.
- `src/server/db/repositories/session-repository.ts`: active/history session reads, entry/exit/plate updates, and facility concurrency guard.
- `src/server/db/repositories/user-repository.ts`: account lookup and idempotent development bootstrap.
- `src/server/db/repositories/audit-repository.ts`: generic audit writes/queries; writes are passed in the same batch as domain changes.
- `src/server/db/repositories/sync-repository.ts`: mutation receipt lookup and atomic successful receipt creation.
- `src/server/services/allocation-service.ts`: pure calculations receive data from repositories rather than reading module-level arrays.

### Local database lifecycle

- `src/server/db/migrations/0001_initial_persistence.sql` creates the normalized tables, indexes, uniqueness rules, and version columns.
- A local initialization command applies unapplied migrations and inserts the non-sensitive development fixture only when the catalog is empty. Seeded catalog changes are not overwritten on restart. On first login, local identity/role rows are inserted if absent even when the catalog already exists.
- `.dev.vars.example` documents `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD`, and `JWT_SECRET` with empty placeholders. `.dev.vars` and local variants are ignored by Git while the example template remains tracked. Do not output or print secret values.
- Existing `.wrangler` state is preserved; no reset or database deletion command is part of the workflow.

## Project Structure

### Documentation (this feature)

```text
specs/009-d1-persistence/
├── checklists/
│   ├── requirements.md
│   └── d1-persistence.md
├── contracts/
│   ├── api-compatibility.md
│   └── repository-boundaries.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code

```text
src/
├── client/components/LoginView.tsx        # Remove embedded demo passwords from quick-login controls
├── core/                                   # Keep domain rules and schemas independent of D1
└── server/
    ├── db/
    │   ├── client.ts
    │   ├── schema.ts
    │   ├── migrations/0001_initial_persistence.sql
    │   └── repositories/
    ├── middleware/auth.ts                  # Require configured JWT signing secret
    ├── routes/                             # Keep route payloads; replace memory reads/writes
    ├── services/allocation-service.ts      # Inject data instead of reading global stores
    └── types/app-environment.ts            # Type PARKING_DB and local secret bindings
tests/
├── unit/server/                            # Repository/service unit tests where appropriate
└── workers/                                # D1 route integration and restart/replay behavior
scripts/db/                                 # Safe local migration and seed helpers
```

**Structure Decision**: Keep the current single-project layout. Add persistence adapters beneath `src/server/db/`, and test them with the existing Worker Vitest configuration under `tests/workers/`.

## Complexity Tracking

| Violation or complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Facility-scoped compare-and-swap guard in D1 batches | Capacity validation reads several related records; concurrent changes need one serialized write boundary so two valid snapshots cannot jointly oversubscribe the facility. | Per-row versioning alone does not protect cross-row capacity and reservation totals. |
No constitutional exception is requested. The additional compare-and-swap detail protects cross-record concurrency. Production authentication remains an explicit follow-up decision because this feature only supplies local `.dev.vars` credentials.
