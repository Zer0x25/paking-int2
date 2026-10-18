# Data Model: Acceso protegido y actualizaciones por cambio

## Existing authenticated identity

The existing JWT payload remains the authority for API access:

| Field | Type | Rule |
|---|---|---|
| `userId` | string | Required, signed claim |
| `username` | string | Required, signed claim |
| `role` | `admin` or `operator` | Required; configuration mutations require `admin` |
| `facilityId` | string or null | Required for facility data; request scope must match it |
| `exp` | Unix seconds | Token must not be expired |

No password or password hash is added to the token or the notification channel.

## Facility event room

One deterministic room is selected for each `facilityId`. The room stores no business data. Its live WebSocket connections are hibernatable and use serialized attachments only for connection routing metadata.

| Attachment field | Type | Rule |
|---|---|---|
| `facilityId` | string | Must match the room receiving the connection |
| `clientId` | string | Unique to the browser page instance; validated length/characters |

## Change notification

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | `1` for this contract |
| `type` | string | `facility.changed` |
| `facilityId` | string | Room scope; must match the authenticated client |
| `changeId` | UUID/string | Distinguishes delivery instances; never applies a mutation |
| `sourceClientId` | string | Lets the initiating browser page ignore its own notification |

Notification payloads MUST NOT include plate numbers, user identity, credentials, full records, or mutation bodies. Clients treat a message only as a request to reload the currently visible view from an authorized API route.

## Persistence and lifecycle

- D1 remains the durable store for facilities, catalogs, sessions, and audit records.
- IndexedDB remains the local store for offline operation and the outbox.
- Catalog and area snapshots use facility-qualified cache keys and are read only after the authenticated facility is known.
- The shared service-worker cache does not store API responses.
- No new D1 entity or business-data migration is introduced.
- A successful delta sync emits one facility notification when at least one mutation was applied.
- A failed persistence operation emits no notification.
- A notification delivery failure does not reverse a successful D1 commit; view activation and connection recovery fetch the current state.
