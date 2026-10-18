# Tasks: Persistencia Central de la Aplicación

**Input**: Design documents from `specs/009-d1-persistence/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and `contracts/`
**Tests**: Required by the project Constitution; write each test before its production implementation and demonstrate the red result.

**Context boundary**: A separate test-author agent receives only this feature's specification, contracts, relevant task descriptions, and test interfaces. It must not read or receive production implementation files before delivering the failing tests.

## Format

Every task follows `- [ ] T### [P?] [US#?] Description with exact file path`.

## Approval Gate

- [x] T001 After explicit user approval, mark the feature specification approved and record the accepted local-only persistence/authentication decision in `history/adr/ADR-014-d1-persistence-and-auth-bootstrap.md` and `history/adr/README.md`. Confirm that no production database, migration, credential change, or deployment is included (FR-015). Complete this gate before any test-author task or source change.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare local D1 tooling and the Worker test fixture without changing production behavior.

- [x] T002 Add a Worker test helper that applies `src/server/db/migrations/` to an isolated D1 binding in `tests/workers/support/d1-fixture.ts`.
- [x] T003 Document required local variable names without values in `.dev.vars.example`; ignore `.dev.vars` and other local variants in `.gitignore` while explicitly allowing the example template.
- [ ] T004 Add a local-only initialization command that applies migrations and seeds non-sensitive base catalog data in `scripts/db/init-local.mjs` and `package.json`.
- [ ] T005 Document local initialization and separate Worker/PWA start commands in `specs/009-d1-persistence/quickstart.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the D1 schema, typed request client, and atomic write primitives used by all stories.

### Tests first

- [x] T006 [P] Add failing migration smoke tests for required tables, indexes, constraints, and repeatable local apply in `tests/workers/d1-foundation.worker.test.ts`.
- [x] T007 Add failing tests that protected routes fail explicitly when D1 is absent or a write fails, never return success/partial audit state, and never read a memory fallback in `tests/workers/d1-foundation.worker.test.ts`.
- [x] T008 Demonstrate the new foundation tests fail before production changes and record the red result in `history/prompts/PHR-012-d1-persistence.prompt.md`.

### Implementation

- [ ] T009 Create D1 tables, foreign keys, unique constraints, facility version, active-session plate index, and query indexes in `src/server/db/migrations/0001_initial_persistence.sql`.
- [ ] T010 Align the Drizzle schema with the migration, including `sync_mutations` and audit mutation identity, in `src/server/db/schema.ts`.
- [ ] T011 Create the typed per-request D1/Drizzle client and missing-binding error in `src/server/db/client.ts` and `src/server/types/app-environment.ts`.
- [ ] T012 Implement facility compare-and-swap plus conditional D1 batch helpers for domain, audit, and sync receipt writes in `src/server/db/repositories/write-transaction.ts`.
- [ ] T013 Implement idempotent local base catalog seeding without overwriting existing rows in `scripts/db/seed-local-catalog.mjs`.
- [ ] T014 Verify the foundation tests pass and D1 migration replay on a fresh isolated local database in `tests/workers/d1-foundation.worker.test.ts` and `specs/009-d1-persistence/quickstart.md`.

**Checkpoint**: Migrations run against isolated local D1, and all runtime routes can require a typed binding without falling back to module-level state.

---

## Phase 3: User Story 1 - Mantener la configuración del recinto (Priority: P1)

**Goal**: Persist facilities, areas, categories, business units, event bookings, and their audit history.

**Independent Test**: Create and edit each configuration record through the existing API, restart/recreate the Worker request context, and verify it remains unchanged; concurrent invalid capacity changes must be rejected.

### Tests for User Story 1

- [x] T015 [P] [US1] Add failing D1 integration tests for facility, category, area, business-unit, and event create/read/update/status flows across recreated app/request contexts in `tests/workers/configuration-persistence.worker.test.ts`.
- [x] T016 [US1] Add failing tests for duplicate codes, stale versions, capacity invariants, inactive history, and audit atomicity in `tests/workers/configuration-persistence.worker.test.ts`.
- [x] T017 [US1] Run the new configuration tests and record the red result in `history/prompts/PHR-012-d1-persistence.prompt.md`.

### Implementation for User Story 1

- [ ] T018 [US1] Implement facility, category, area, business-unit, and event queries and mutation methods in `src/server/db/repositories/catalog-repository.ts`.
- [ ] T019 [US1] Refactor allocation helpers to receive persisted facility, unit, event, area, and session records instead of module-level arrays in `src/server/services/allocation-service.ts`.
- [ ] T020 [US1] Replace facility, area, business-unit, and event in-memory reads/writes with repository calls while preserving route contracts in `src/server/routes/facilities.ts`.
- [ ] T021 [US1] Persist dashboard configuration reads and calculated availability from D1-backed records in `src/server/routes/dashboard.ts`.
- [ ] T022 [US1] Write configuration audit entries in the same D1 batch as their domain mutations through `src/server/db/repositories/audit-repository.ts`.
- [ ] T023 [US1] Pass the configuration integration tests, verify existing API compatibility, and assert catalog reads stay bounded as record counts grow in `tests/workers/configuration-persistence.worker.test.ts` and `tests/unit/server/`.

**Checkpoint**: Configuration and its audit history survive Worker restarts and preserve existing rules and response shapes.

---

## Phase 4: User Story 2 - Conservar la operación de garita y el dashboard (Priority: P1)

**Goal**: Persist entries, exits, active-session corrections, occupancy, and operator audit history.

**Independent Test**: Register entry, restart the Worker, verify the active session and dashboard occupancy, then correct the plate and exit the vehicle with one audit record per confirmed action.

### Tests for User Story 2

- [x] T024 [P] [US2] Add failing D1 integration tests for entry, active listing, exit, and plate correction persistence after restart in `tests/workers/session-persistence.worker.test.ts`.
- [x] T025 [US2] Add failing tests for duplicate active plates, capacity conflicts, stale versions, atomic audits, and dashboard counts in `tests/workers/session-persistence.worker.test.ts`.
- [x] T026 [US2] Run the new session tests and record the red result in `history/prompts/PHR-012-d1-persistence.prompt.md`.

### Implementation for User Story 2

- [ ] T027 [US2] Implement facility-scoped session queries and atomic entry, exit, and plate updates in `src/server/db/repositories/session-repository.ts`.
- [ ] T028 [US2] Replace `mockSessionsRepo` and session audit arrays with repository calls while preserving route validation and response shapes in `src/server/routes/parking.ts`.
- [ ] T029 [US2] Load sessions from D1 and pass them to pure availability calculations in `src/server/routes/dashboard.ts` and `src/server/routes/facilities.ts`.
- [ ] T030 [US2] Pass persistence and concurrency tests, assert dashboard reads stay bounded, and pass existing gate Worker tests in `tests/workers/session-persistence.worker.test.ts` and `tests/workers/parking-operations.worker.test.ts`.

**Checkpoint**: Garita and Dashboard show the durable state and never confirm a failed database write.

---

## Phase 5: User Story 3 - Sincronizar operaciones offline sin duplicarlas (Priority: P1)

**Goal**: Apply offline mutations durably, preserve version conflicts, and make successful retries idempotent.

**Independent Test**: Sync an entry/exit/correction, replay the same mutation ID and payload, and verify one session effect, one audit, and a stable success response; reusing the ID with a different payload must conflict.

### Tests for User Story 3

- [x] T031 [P] [US3] Add failing Worker integration tests for durable delta sync and repeat-safe successful mutation IDs in `tests/workers/sync-persistence.worker.test.ts`.
- [x] T032 [US3] Add failing tests for ID reuse with a different fingerprint, stale expected versions, business conflicts, and transaction rollback in `tests/workers/sync-persistence.worker.test.ts`.
- [x] T033 [US3] Run new offline tests and record the red result in `history/prompts/PHR-012-d1-persistence.prompt.md`.

### Implementation for User Story 3

- [ ] T034 [US3] Implement sync receipt lookup, fingerprint validation, and successful receipt insertion in `src/server/db/repositories/sync-repository.ts`.
- [ ] T035 [US3] Replace in-memory session access in delta sync with D1 repositories and batch each successful mutation with its audit and receipt in `src/server/routes/sync.ts`.
- [ ] T036 [US3] Preserve IndexedDB outbox behavior and existing conflict acknowledgement handling in `src/client/db/indexed-db.ts` and `src/client/db/outbox-sync.ts`.
- [ ] T037 [US3] Pass offline retry, conflict, and rollback tests plus existing outbox tests in `tests/workers/sync-persistence.worker.test.ts` and `tests/unit/client/test_outbox_sync.test.ts`.

**Checkpoint**: Repeated delivery of a successful client mutation does not duplicate an entry, exit, correction, or audit.

---

## Phase 6: User Story 4 - Iniciar sesión con usuarios persistidos de manera segura (Priority: P1)

**Goal**: Persist admin/operator accounts and authenticate without source-controlled credentials or default signing secrets.

**Independent Test**: Initialize local D1 from `.dev.vars`, sign in with both roles, restart the Worker, sign in again, and verify that D1 contains identity/role records but no password or password-hash field.

### Tests for User Story 4

- [x] T038 [P] [US4] Add failing tests for local bootstrap from secrets, idempotent identity/role initialization, wrong-password rejection, and absence of password/password-hash data in D1 in `tests/workers/auth-persistence.worker.test.ts`.
- [x] T039 [US4] Add failing tests for each missing local credential variable, missing JWT secret, missing D1, admin/operator authorization after restart, and indistinguishable invalid-login responses in `tests/workers/auth-persistence.worker.test.ts`.
- [x] T040 [US4] Run the auth tests and record the red result in `history/prompts/PHR-012-d1-persistence.prompt.md`.

### Implementation for User Story 4

- [ ] T041 [US4] Implement Zod validation of required `.dev.vars` variables and local credential checks in `src/server/services/local-credential-auth.ts`.
- [ ] T042 [US4] Implement user lookup and idempotent local identity/role bootstrap from `.dev.vars` in `src/server/db/repositories/user-repository.ts`.
- [ ] T043 [US4] Replace hard-coded `seedUsers`, plaintext comparison, and fallback JWT secrets with D1 lookup and required environment secrets in `src/server/routes/auth.ts`, `src/server/middleware/auth.ts`, and `wrangler.toml`.
- [ ] T044 [US4] Remove visible password-prefill controls from `src/client/components/LoginView.tsx` and add only placeholder variable names to `.dev.vars.example`.
- [ ] T045 [US4] Pass auth tests and verify login resolves persisted roles while passwords remain outside D1 in `tests/workers/auth-persistence.worker.test.ts`.

**Checkpoint**: Local identity/role records persist, authentication survives restart using `.dev.vars`, and no credential default or password data remains in tracked runtime code, D1, or visible login controls.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Close migration, security, offline, browser, and code-quality gates.

- [ ] T046 [P] Update `README.md` with local D1 initialization, `.dev.vars` setup, and worker/PWA start instructions.
- [ ] T047 Verify local catalog seeding is idempotent and preserves records already edited in D1 in `tests/workers/d1-foundation.worker.test.ts`.
- [ ] T048 Run unit coverage with the existing V8 provider and Worker coverage with Istanbul instrumentation; include the changed production modules and retain at least 85% lines, functions, branches, and statements in `vitest.config.ts`, `vitest.workers.config.ts`, and `package.json`.
- [ ] T049 Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit`; confirm no unresolved-work markers remain in production source and resolve any gate failures.
- [ ] T050 Verify Configuración, Garita, Dashboard, role restrictions, restart persistence, and offline sync in a real browser and record observed results in `history/prompts/PHR-012-d1-persistence.prompt.md`.
- [ ] T051 Run Spec Kit convergence against `specs/009-d1-persistence/spec.md`, `plan.md`, and `tasks.md`; append any uncovered work to `specs/009-d1-persistence/tasks.md`.
- [ ] T052 Record actual migration, test, coverage, typecheck, lint, build, audit, browser, and convergence results plus uncommitted status in `history/prompts/PHR-012-d1-persistence.prompt.md`.


---

## Dependencies & Execution Order

Explicit user approval is required before implementation. After approval, complete T001 first; only then begin the red test tasks and continue through the phases below.

### Phase Dependencies

- Setup (Phase 1) precedes the D1 foundation.
- Foundational (Phase 2) blocks all user stories.
- User Story 1 lands configuration before session flows depend on persisted catalog reads.
- User Story 2 lands durable sessions before offline sync integration.
- User Story 3 depends on the session repository from User Story 2.
- User Story 4 can be developed after the foundation, but must land before full browser verification because all routes are authenticated.
- Polish and cross-cutting verification depend on every story.

### Parallel Opportunities

- Each story's test file can be authored before its implementation tasks; tasks that share one test file execute sequentially under the same test-author context.
- No production implementation tasks are marked parallel where they touch the same route, schema, or repository boundary.

### MVP Strategy

There is no deployable partial slice because the purpose is to remove the split between in-memory server stores. Build the schema and common adapter first, then complete configuration, sessions, sync, and auth before demoing the persistence integration. Production deployment remains outside this feature.

## Phase 8: Convergence

- [ ] T053 Complete authenticated browser verification of administrator and operator login, Garita, Dashboard, Configuración, restart persistence, and offline sync after private `.dev.vars` values are configured per T050 (partial)

## Phase 9: Reliable Local Worker Startup

- [x] T054 [P] Write failing Vitest cases for identifying this checkout's Wrangler Worker, graceful replacement, stable port 8787, and refusing unrelated listeners in `tests/unit/scripts/test_dev_worker.test.ts`.
- [x] T055 Implement the safe Worker restart launcher and route `npm run worker:dev` through it in `scripts/dev-worker.mjs`, `scripts/worker-dev-lifecycle.mjs`, its declaration file, and `package.json`.
- [x] T056 Document the restart behavior and record the process-ownership decision in `specs/009-d1-persistence/quickstart.md` and `history/adr/ADR-015-local-worker-restart.md`.
- [x] T057 Verify repeated starts leave one Worker on 8787, check `/api/health`, and run the targeted Vitest, lint, and typecheck gates.
