# Quickstart: Acceso protegido y actualizaciones por cambio

## Prerequisites

- Node dependencies installed.
- Local `.dev.vars` configured as documented in the repository quickstart.
- Local D1 initialized.

## Start the integrated local app

1. Terminal A: `npm run db:local:init`
2. Terminal A or B: `npm run worker:dev` (Worker at port 8787).
3. Terminal B if needed: `npm run dev` (Vite at port 5173; its `/api` proxy must support WebSocket upgrades).
4. Open `http://localhost:5173/` in two browser tabs (each page creates its own client ID) and sign in with configured local users.

## Browser scenarios

1. While signed out, inspect Network: only health/login/static resources may be requested; there must be no catalogs, dashboard, sessions, sync, or event connection.
2. Sign in and stay in Garita: catalogs, active sessions, and the authenticated event socket load; dashboard metrics are not requested and session reads do not repeat on a timer.
3. In the second browser context, confirm a vehicle entry. The first Garita view should reload only active sessions within 2 seconds; its catalog request must not repeat and the event frame must not contain the plate.
4. Change an area, unit, or event in the second context. The first Garita view should reload catalogs only; active sessions must not be queried again.
5. Change the first context to Dashboard. Confirm the metrics request occurs on view activation and subsequent parking or configuration changes refresh metrics only when Dashboard is visible.
6. As an operator, try a configuration mutation; it must return 403 and make no D1 change. Repeat an authorized Garita mutation; it must succeed.
7. Disconnect one context, make a change from the other, reconnect, and verify that the disconnected context reloads its visible view within 3 seconds.
8. Sign out while offline and verify that no prior private API response is replayed; after authenticating for the same facility, the local facility-scoped catalog may support offline gate operation.

## Automated checks

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run test:coverage`
- `npm audit`
- `npm run build`
- `npx wrangler deploy --dry-run`

These checks do not create remote Cloudflare resources or deploy the Worker.

## Validation record (2026-10-17)

Automated checks completed locally:

| Command | Result |
|---|---|
| `npm run test:coverage` | Passed: 174 unit tests across 31 files and 33 Worker tests across 9 files. Unit coverage: 92.22% statements, 87.26% branches, 90.29% functions, 95.08% lines. Worker coverage: 89.14% statements, 85.00% branches, 89.15% functions, 92.78% lines. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm audit` | 0 vulnerabilities. |
| `npm run build` | Passed. |
| `npx wrangler deploy --dry-run` | Passed; packaged 14 assets. Dry-run only; no remote deployment. |

Browser smoke test used a temporary local Worker on port `8790`, an isolated local D1 database, dummy test credentials, and two in-app browser tabs. Both pages authenticated; an entry recorded in one tab appeared in the other tab's active-session list after the facility invalidation. Worker logs showed both WebSocket handshakes accepted (`101`) and the resulting scoped reads. Automated Worker tests verify that invalidations contain no plate/record data and that at least 95 of 100 committed changes are delivered within 2 seconds. The manual smoke test used two tabs in one browser profile; separate physical devices/profiles and mobile hardware were not tested. The temporary Worker and database were stopped and removed after the check.

The suite also covers anonymous route denial, role/facility scope, no-store responses, active-view reads, idle behavior without polling, and reconnect refresh. The browser smoke test did not exercise every view or a physical offline/reconnect workflow.

## Post-metric refinement (2026-10-18)

- The catalogs endpoint batches five catalog queries and does not query `parking_sessions`.
- A parking invalidation in Garita refreshes only active sessions; a configuration invalidation refreshes only catalogs. Dashboard refreshes its metrics once for either scope, and Configuration ignores parking-only changes.
- Durable Object messages use the scoped version 2 contract. A privacy-safe version 1 compatibility invalidation is also sent to already-open older tabs.
- See [ADR-018](../../history/adr/ADR-018-scoped-facility-invalidations.md) and the real-time event contract for the scope matrix.

### Verification record

- `npm test`: passed, 181 unit tests and 33 Worker tests.
- `npm run test:coverage`: passed; unit coverage was 92.28% statements, 87.87% branches, 90.37% functions, and 95.01% lines. Worker coverage was 89.25% statements, 85.06% branches, 89.34% functions, and 92.86% lines.
- `npm run typecheck`, `npm run lint`, `npm audit`, `npm run build`, and `npx wrangler deploy --dry-run`: passed; audit reported zero vulnerabilities and dry-run packaged 14 assets without deploying.
- Browser verification used two tabs and an isolated temporary D1. A vehicle entry updated the peer through `/api/parking-sessions/active` without reloading catalogs. Creating an area reloaded catalogs in the peer without querying active sessions; the new area appeared in the next entry wizard. The test vehicle was exited, the temporary D1 was removed, and the original local D1 still showed its seven pre-existing active sessions.
