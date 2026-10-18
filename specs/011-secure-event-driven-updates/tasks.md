# Tasks: Acceso protegido y actualizaciones por cambio

**Input**: Design documents from `/specs/011-secure-event-driven-updates/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the project constitution. Add and run each relevant test before the production implementation; record the failing result before proceeding to the corresponding green task.

**Organization**: Tasks are grouped by user story and ordered by dependencies.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Reuse the existing Worker, Vite, and Vitest setup while enabling local WebSocket proxying.

- [x] T001 [P] Add failing config checks that require WebSocket upgrades through `/api` and prohibit shared runtime caching of private API responses in `tests/unit/config/workers-assets.test.ts`
- [x] T002 Enable WebSocket upgrades and remove `/api/*` runtime caching from the Vite PWA configuration in `vite.config.ts`; make `tests/unit/config/workers-assets.test.ts` pass

---

## Phase 2: User Story 1 - Consultar solo datos autorizados (Priority: P1) 🎯 MVP

**Goal**: Every data route requires a valid JWT, and role/facility checks reject unauthorized access before reading or changing data.

**Independent Test**: Anonymous data reads return 401; an authenticated user's own facility works; another facility and operator configuration writes return 403 with no data change.

### Tests for User Story 1

- [x] T003 [P] [US1] Add failing Worker integration tests for anonymous reads, wrong facility, admin-only configuration writes, public health/login exceptions, and `Cache-Control: no-store` in `tests/workers/security-routes.worker.test.ts`
- [x] T004 [P] [US1] Add failing client API tests for bearer headers, per-page client identifiers, and expired-session signaling in `tests/unit/client/test_api_client.test.ts`

### Implementation for User Story 1

- [x] T005 [US1] Add default-deny JWT and facility-scope middleware in `src/server/middleware/auth.ts` and apply it to `/api/*` in `src/server/index.ts`, leaving only health/login public, setting `Cache-Control: no-store`, and validating the WebSocket route separately
- [x] T006 [US1] Require administrator role for facility creation/update and area configuration writes in `src/server/routes/facilities.ts`, and return only the authenticated user's facility from the facility collection
- [x] T007 [US1] Add the authenticated `apiFetch` helper with a page-instance identifier and 401 event in `src/client/api/client.ts`; migrate authenticated requests in `src/client/App.tsx`, `src/client/components/FacilityConfigView.tsx`, `src/client/components/VehicleGatePanel.tsx`, `src/client/components/VehicleEntryForm.tsx`, `src/client/components/VehicleExitForm.tsx`, `src/client/components/BusinessUnitManager.tsx`, `src/client/components/EventBookingsManager.tsx`, and `src/client/db/outbox-sync.ts`

**Checkpoint**: All data routes fail closed for anonymous, wrong-role, and wrong-facility requests while authorized gate behavior still works.

---

## Phase 3: User Story 2 - Consultar los datos de la vista abierta (Priority: P1)

**Goal**: Only the authenticated user's visible view requests the data it needs, without repeated reads caused by elapsed time.

**Independent Test**: Log in and navigate Garita, Dashboard, and Configuración; verify each view's required reads, zero pre-login reads, and no periodic requests while idle.

### Tests for User Story 2

- [x] T008 [P] [US2] Add failing tests for no pre-login/data reads without a token, token expiry/401 logout, view-specific fetches, logout state clearing, and facility-scoped offline catalog fallback in `tests/unit/client/test_app_login.test.tsx`
- [x] T009 [P] [US2] Add a failing test proving Garita does not refresh active sessions on an interval in `tests/unit/client/test_vehicle_gate_panel.test.tsx`

### Implementation for User Story 2

- [x] T010 [US2] Load catalogs only after login and only when Garita or Configuración is active; cache them by facility in IndexedDB for authenticated offline use; load Dashboard metrics only while Dashboard is active; return to login and clear private view state on 401 or token expiry in `src/client/App.tsx`
- [x] T011 [US2] Remove six-second active-session polling from `src/client/components/VehicleGatePanel.tsx`; refresh only on mount, explicit operation, sync completion, visibility recovery, or facility event
- [x] T012 [US2] Add a refresh key for configuration data and facility-scoped offline area snapshots so a visible Configuración view can reload after an event or recover its local snapshot in `src/client/App.tsx` and `src/client/components/FacilityConfigView.tsx`

**Checkpoint**: A signed-out app has zero data reads; a visible view loads on activation and remains idle between events.

---

## Phase 4: User Story 3 - Recibir cambios de otros equipos (Priority: P1)

**Goal**: Authorized clients in the same facility receive privacy-safe invalidations and reload only their visible view after committed changes.

**Independent Test**: Connect two local authenticated browser clients, commit a change in one, and verify the other updates within 2 seconds; disconnect/reconnect and verify a fresh visible-view read.

### Tests for User Story 3

- [x] T013 [P] [US3] Add failing Worker tests for WebSocket authentication, facility isolation, privacy-safe fan-out, post-commit publication, no notification before an offline mutation is synchronized, and 100-change latency (at least 95 deliveries within 2 seconds) in `tests/workers/realtime-events.worker.test.ts`
- [x] T014 [P] [US3] Add failing client tests for event validation, source-page suppression, active-view-only refresh, and reconnect refresh in `tests/unit/client/test_facility_events.test.tsx`

### Implementation for User Story 3

- [x] T015 [US3] Add the SQLite-backed `FACILITY_EVENTS` binding/migration in `wrangler.toml`, export the class from `src/server/index.ts`, and type its binding in `src/server/types/app-environment.ts`
- [x] T016 [US3] Implement the hibernatable per-facility WebSocket room and invalidation-only `facility.changed` messages in `src/server/services/facility-event-hub.ts`
- [x] T017 [US3] Implement the authenticated WebSocket handshake in `src/server/routes/realtime.ts`, verifying JWT/facility/client ID, stripping credential subprotocols before forwarding, and selecting only `parking-events-v1`
- [x] T018 [US3] Publish one facility invalidation after successful configuration and parking writes and only when delta sync reports at least one applied mutation in `src/server/index.ts`; log notification failures without changing a committed operation response
- [x] T019 [US3] Implement authenticated event connection, bounded reconnect, connection-recovery refresh, and active-view invalidation handling in `src/client/hooks/useFacilityEvents.ts` and `src/client/App.tsx`

**Checkpoint**: Connected peers see committed changes within the target; notifications contain no business data; missed events recover on reconnect.

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Close documentation, browser behavior, and repository quality gates.

- [x] T020 [P] Update the local validation flow and real-time/security contracts in `specs/011-secure-event-driven-updates/quickstart.md`, `specs/011-secure-event-driven-updates/contracts/api-security.md`, and `specs/011-secure-event-driven-updates/contracts/realtime-events.md`
- [x] T021 Verify in two local browser tabs on an isolated D1 database that a change refreshes the peer's visible view; confirm invalidation privacy in Worker tests and record the scope in `specs/011-secure-event-driven-updates/quickstart.md`
- [x] T022 Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm audit`, `npm run build`, and `npx wrangler deploy --dry-run`; resolve failures and record actual results in `specs/011-secure-event-driven-updates/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Enables the Vite proxy required by local WebSocket verification.
- **User Story 1 (Phase 2)**: Security foundation; completes before active-view API work.
- **User Story 2 (Phase 3)**: Depends on the authenticated API client from US1.
- **User Story 3 (Phase 4)**: Depends on US1 route security and US2 active-view selection.
- **Polish (Phase 5)**: Depends on all three user stories.

### User Story Dependencies

- **US1 (P1)**: Independent core slice; authentication and facility scope are the prerequisite for further work.
- **US2 (P1)**: Depends on US1's API client so its view reads carry credentials.
- **US3 (P1)**: Depends on US1 auth/scope and US2 view-aware refresh routing.

### Within Each User Story

- Tests are written and run red before production code for that behavior.
- Middleware and route guards precede UI calls that rely on them.
- Durable Object configuration precedes running WebSocket Worker tests; the test itself is authored before configuration and class implementation.
- Client event handling follows the event contract and server publication.

### Parallel Opportunities

- T001 and T003/T004 touch separate test/config files and can be authored independently, though the actual implementation remains sequential after red checks.
- T008 and T009 are independent client test files.
- T013 and T014 are independent Worker and client test files after US1/US2 contracts are settled.

## Implementation Strategy

1. Complete US1 and validate the API denies anonymous and cross-facility access.
2. Complete US2 and validate zero data reads before login and zero interval polling.
3. Complete US3 and validate cross-device event delivery/recovery locally.
4. Run browser verification and repository gates. Do not deploy or mutate remote Cloudflare resources in this feature.
