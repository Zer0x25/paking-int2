# Implementation Plan: Acceso protegido y actualizaciones por cambio

**Branch**: `011-secure-event-driven-updates` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-secure-event-driven-updates/spec.md`

## Summary

Require JWT authentication and facility scope for application data, enforce administrator permissions for facility configuration writes, and replace periodic reads with active-view loading plus authenticated change notifications. Cloudflare Durable Objects WebSocket Hibernation will coordinate one room per facility; notifications contain only an invalidation marker, and clients read current authorized data from the existing Worker/D1 routes. IndexedDB and the offline outbox remain the local operation store.

## Technical Context

**Language/Version**: TypeScript 5.7, strict mode, ESM

**Primary Dependencies**: Cloudflare Workers, Hono 4, Durable Objects, React 18, Vite 6, Zod 3, Vitest 4, `@cloudflare/vitest-plugin`

**Storage**: D1 remains authoritative for synchronized application data; IndexedDB remains local for offline data and pending mutations. The notification Durable Object uses SQLite-backed class configuration required by Workers Free, without persisting business data.

**Testing**: Vitest unit tests and Workers runtime integration tests, including D1 route authorization, Durable Object WebSocket fan-out, reconnect behavior, and view-scoped client reads. Maintain the constitution's 85% coverage gate and verify in a real local browser.

**Target Platform**: Local Wrangler development and Cloudflare Workers Free; remote resource creation and deployment are excluded.

**Project Type**: React/Vite offline-first PWA plus Hono Worker API and D1.

**Performance Goals**: Zero data reads before authentication; zero time-driven polling; a connected peer refreshes its visible view within 2 seconds after a committed mutation; reconnect refresh completes within 3 seconds in local validation.

**Constraints**: All data reads and writes remain scoped to the authenticated user's facility. Configuration writes remain administrator-only. Push messages are invalidation-only. Failed notification delivery must not roll back a mutation already committed to D1; reconnect and view activation repair missed notifications. Preserve the offline outbox and audit behavior, move private offline reads to facility-scoped IndexedDB, and prevent the shared service-worker cache from serving API responses.

**Scale/Scope**: One Durable Object room per facility, one WebSocket per authenticated browser tab, and the existing single-facility user model. No business-state table or D1 migration is needed.

## Constitution Check

### Before Phase 0

- **Architecture and specification**: PASS. This feature is specified, clarified, and will be analyzed before implementation. Domain rules remain in `src/core`.
- **Offline-first**: PASS. IndexedDB and its outbox remain the local source for pending operations. Real-time messages refresh server-owned data and do not replace local offline state.
- **Test-first**: PASS. Worker and client tests are authored and run red before corresponding production edits, then rerun green. Browser verification is included.
- **Security and strict input**: PASS. JWT, role, and facility scope are checked before data routes; event payloads and subprotocol fields are validated; event payloads contain no operation details.
- **Cloudflare Free Tier**: PASS. No recurring polling is retained. Durable Object requests are made only to connect clients or broadcast committed changes; the class uses hibernatable WebSockets and no stored business state.
- **ADR**: PASS. The cross-device event channel and its alternatives are recorded in ADR-017.
- **Definition of Done**: PASS after implementation only when typecheck, lint, tests and coverage, npm audit, and local browser scenarios pass.

### Post-Design Check

- **Architecture and offline-first**: PASS. D1 remains the central source of truth and offline mutations remain queued in IndexedDB.
- **Security**: PASS. Every resource route is protected except health and login; WebSocket upgrade authenticates separately because browser WebSocket clients cannot set arbitrary authorization headers. API responses are no-store and the service worker has no API caching route.
- **Free Tier awareness**: PASS with operational limits documented in ADR-017; no remote limits are tested or consumed by local verification.

## Project Structure

```text
src/
├── client/
│   ├── api/                         # Authenticated API helper and per-tab client identity
│   ├── hooks/                       # Authenticated facility event connection
│   ├── db/indexed-db.ts             # Facility-scoped offline catalog snapshots
│   ├── App.tsx                      # Load data only for authenticated active view
│   └── components/                  # Existing views; remove interval polling
├── server/
│   ├── middleware/auth.ts           # JWT auth and facility-scope enforcement
│   ├── routes/realtime.ts           # Authenticated WebSocket upgrade
│   ├── services/facility-event-hub.ts # Per-facility hibernatable WebSocket room
│   └── index.ts                     # Route guards and change notifications
└── core/                            # Existing pure business rules and schemas

tests/
├── unit/client/                     # Authenticated active-view reads and no polling
├── unit/server/                     # Route guards and authentication helpers
└── workers/                         # D1 auth/scope and WebSocket event integration

specs/011-secure-event-driven-updates/
├── contracts/
├── checklists/
├── data-model.md
├── quickstart.md
└── research.md
```

**Structure Decision**: Keep the existing single-project layout. The Durable Object is a Worker adapter under `src/server/services`; auth and change notifications stay outside `src/core`, while client events only invalidate view-specific cache/state.

## Complexity Tracking

No constitution exceptions. Durable Objects add a coordination adapter required for cross-device change notifications without polling; the implementation uses one named room per facility and stores no business data.
