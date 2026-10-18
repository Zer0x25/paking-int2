# Research: Acceso protegido y actualizaciones por cambio

## Decisions

### 1. Broadcast invalidation events through a Durable Object room per facility

- **Decision**: Use a named Durable Object per facility with Cloudflare's WebSocket Hibernation API. A successful data mutation sends one event to the room. The event contains only its schema version, facility identifier, change identifier, and originating browser-tab identifier. Clients re-read the authorized endpoint for the currently visible view.
- **Rationale**: Connected browsers on separate devices need server-mediated fan-out. A browser-local channel cannot reach another machine, while periodic polling recreates the request load the user asked to remove. The Durable Object coordinates connected clients and hibernates while idle.
- **Free-plan fit**: Current Cloudflare docs make SQLite-backed Durable Objects available on Workers Free. The included allowance is 100,000 Durable Object requests/day and 13,000 GB-s/day; a WebSocket connect and an RPC publish count as requests, while outgoing WebSocket messages are not charged as requests. Hibernation avoids duration charges while idle. The application should monitor those limits at pilot scale.
- **References**: [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSocket best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [WebSocket Hibernation example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/).

### 2. Protect API routes centrally, then enforce facility scope and role

- **Decision**: Apply JWT authentication to `/api/*`, excluding only health and login. The realtime WebSocket route verifies the signed JWT supplied in a negotiated subprotocol, checks the user's facility, strips credentials before forwarding internally, and accepts only the public event protocol. Resource scope checks the facility path, query, or request body against the authenticated identity. Configuration writes remain administrator-only.
- **Rationale**: A central default-deny guard covers existing and future data routes. Route-specific role rules preserve the operator's gate workflow while closing anonymous configuration and dashboard reads.
- **References**: Existing Hono/JWT middleware and Cloudflare's WebSocket Hibernation API; the browser WebSocket constructor does not support arbitrary request headers, so the token stays out of URL query strings and is not forwarded to clients.

### 3. Read only the authenticated active view and recover on reconnect

- **Decision**: After login, Garita loads catalogs and active sessions. Dashboard metrics load only when Dashboard is visible. Configuration data loads only when an administrator opens Configuration. After a facility event, refetch only the currently visible view. Reconnection and view activation perform a fresh read; no timer-based API polling remains.
- **Rationale**: This meets the request-triggered update preference and reduces D1 reads. A reconnect read repairs events missed while offline without replaying business data through the notification channel.
- **References**: Existing `App.tsx` and `VehicleGatePanel.tsx`; existing D1 repositories remain the source for reads.

### 4. Keep private offline reads in facility-scoped IndexedDB, not the shared service-worker API cache

- **Decision**: Remove runtime caching for `/api/*`. Save the facility catalog and area snapshots in IndexedDB with facility-qualified keys, and read those snapshots only after a valid user session is established. Continue using the existing local session store and outbox for offline gate operations.
- **Rationale**: The current `NetworkFirst` URL-only API cache can return a previously cached private response when the current token is expired, absent, or belongs to another user. The shared cache cannot safely enforce the application's role and facility scope. IndexedDB already supports facility-scoped sessions and a catalog store.
- **Alternative considered**: Add `Vary: Authorization` and keep the shared cache; rejected because cached private responses remain bound to bearer credentials and a URL-keyed fallback risks exposing stale data offline. API caching is removed while explicit local snapshots remain available after authentication.

## Alternatives Considered

- **Keep six-second polling**: Rejected because it produces requests while screens are idle or hidden and sends recurring reads regardless of whether data changed.
- **Use only `BroadcastChannel`**: Rejected because it coordinates tabs in one browser profile, not independent gate devices.
- **Use an in-memory Worker connection registry**: Rejected because Workers are stateless across requests and isolates; it cannot reliably enumerate sockets across instances or eviction.
- **Send the changed record in a broadcast**: Rejected because events should not carry license plates or business data. Clients fetch through the normal authorization and facility-scope checks.
- **Persist notifications in D1**: Rejected for this scope. The channel only delivers invalidation; D1 already stores durable business changes and reconnect fetches the latest view.
