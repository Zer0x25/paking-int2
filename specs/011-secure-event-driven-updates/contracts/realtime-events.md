# Realtime Events Contract

## Connection

`GET /api/events/:facilityId` upgrades to WebSocket.

The browser offers subprotocols in this order:

1. `parking-events-v1`
2. The current signed JWT
3. A page-instance client identifier matching `[A-Za-z0-9._-]{1,80}`

The Worker verifies the token signature and expiry, checks that its `facilityId` equals the URL facility, strips the JWT and client identifier from the forwarded handshake, and proxies the upgraded connection to the facility's event room. The server selects only `parking-events-v1`; credentials are never placed in the URL or echoed as the selected subprotocol.

| Condition | Response |
|---|---:|
| Valid upgrade and identity | `101` with `parking-events-v1` |
| Missing/invalid/expired token | `401` |
| Facility mismatch or invalid client identifier | `403` |
| Request lacks `Upgrade: websocket` | `426` |
| Event binding unavailable | `503` |

## Message

```json
{
  "schemaVersion": 2,
  "type": "facility.changed",
  "facilityId": "fac-default-01",
  "scope": "parking",
  "changeId": "uuid",
  "sourceClientId": "page-instance-id"
}
```

`scope` is one of `parking` or `configuration`. Messages carry no record data and do not authorize reads. Clients ignore messages with an unsupported schema version, unknown scope, or another facility identifier. Version 2 adds the scope and requires clients to validate it before refreshing. During rollout, the server also sends the original version 1 invalidation shape so an already-open older tab continues to refresh its active view; version 2 clients ignore that compatibility message and handle the scoped version 2 message.

## Refresh behavior

- Garita: a `parking` change refreshes the active-session list; a `configuration` change refreshes catalogs.
- Dashboard: either change scope refreshes metrics.
- Configuration: only a `configuration` change refreshes configuration data.
- A hidden view does not issue reads when an event arrives; it reads when opened.
- Initial view activation performs its normal read; a connection restored after an interruption refreshes all data required by the active view once.
- Multiple scopes received together are coalesced and each target is refreshed at most once.
- The client reconnects with bounded exponential backoff while authenticated and online. There is no timer-based data polling.
