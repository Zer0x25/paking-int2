# API Security Contract

## Authentication

All `/api/*` routes require `Authorization: Bearer <JWT>`, except:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/events/:facilityId`, which authenticates its WebSocket handshake as described in `realtime-events.md`.

Invalid, absent, malformed, or expired credentials return `401`. A valid user with the wrong role or facility receives `403`. CORS preflight requests remain handled before authentication.

## Facility scope

- `GET /api/facilities/:facilityId/*` and `PUT /api/facilities/:facilityId` must match the signed `facilityId` claim.
- `/api/parking-sessions/*` facility query/body fields must match the signed facility claim.
- `/api/sync/*` facility body fields must match the signed facility claim.
- A missing required facility identifier in a data request returns `400`; an authenticated token without an assigned facility or a request for a different facility returns `403`.
- The facility collection is limited to the authenticated identity's facility; creating or updating facility configuration requires role `admin`.
- Private API responses are not stored or replayed by a shared URL-only service-worker cache. Offline catalog snapshots are keyed by facility and only loaded after login establishes that facility.
- All `/api/*` responses, including login responses, are marked `Cache-Control: no-store`.

## Role permissions

- Both `admin` and `operator` may read the active-session list, gate catalogs, and dashboard within their facility.
- `operator` may perform the already-supported parking entry, exit, plate-correction, and offline-sync operations.
- `admin` is required for facility, parking-area, business-unit, and event-booking configuration changes.
- Existing route payloads and successful status codes stay unchanged.

## Change publication

- A notification is published only after the corresponding D1 change succeeded.
- WebSocket events carry invalidation metadata only; clients perform a new scoped read.
- Publication failure is logged and does not change the already-committed mutation response.
