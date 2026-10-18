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
  "schemaVersion": 1,
  "type": "facility.changed",
  "facilityId": "fac-default-01",
  "changeId": "uuid",
  "sourceClientId": "page-instance-id"
}
```

Messages carry no record data and do not authorize reads. Clients ignore messages with an unsupported schema version or another facility identifier. The source page ignores its own `sourceClientId`; all other connected pages may refresh their active view.

## Refresh behavior

- Garita: refresh the facility catalogs and active-session list.
- Dashboard: refresh metrics.
- Configuration: refresh only configuration data required by the visible view.
- A hidden view does not issue reads when an event arrives; it reads when opened.
- Initial view activation performs its normal read; a connection restored after an interruption refreshes the active view once.
- The client reconnects with bounded exponential backoff while authenticated and online. There is no timer-based data polling.
