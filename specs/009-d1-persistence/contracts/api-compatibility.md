# API Compatibility Contract

## Scope

The client remains on the current HTTP API and IndexedDB outbox. This feature changes the Worker persistence behind these routes, not their URL, method, request fields, success response shape, or authentication role.

## Existing endpoints

- `POST /api/auth/login`: accepts `{ username, password }`; returns `{ token, user }` on success. Local credentials and `JWT_SECRET` come from `.dev.vars`; only identity/role are looked up in D1. Passwords are not stored in D1. Missing local credentials or `JWT_SECRET` fail closed and never reveal configured values.
- `GET/POST /api/facilities`, `PUT /api/facilities/:id`: facility records are read/written durably.
- `GET/POST /api/facilities/:id/areas`, `PUT /api/facilities/:id/areas/:areaId`, area capacity/status patches: preserve validation, version conflict, and capacity errors.
- `/api/facilities/:id/business-units` and `/events` CRUD/status routes: preserve existing admin-role restrictions, status lifecycle, response envelopes, and version conflicts.
- `GET /api/facilities/:id/catalogs`: returns catalog records from persisted data.
- `GET /api/facilities/:id/dashboard`: derives occupancy and availability from persisted sessions and configuration.
- `/api/parking-sessions/active`, entry, exit, exit-by-session, and plate correction: preserve the current session and ticket response shapes.
- `POST /api/sync/delta`: accepts the current mutation envelope and responds with `processed`, `succeeded`, and `conflicts`. A repeated successful mutation ID with identical payload returns the same success; ID reuse with different content returns a conflict.

## Failure behavior

- Invalid request data remains a 400 response; missing records remain 404; duplicate active plate, stale version, or capacity conflicts remain 409.
- A missing D1 binding or failed write returns an explicit server error. No handler may read or write a module-level memory store as fallback.
- An operation response is successful only after its domain row, required audit row, and required sync receipt are committed together.
