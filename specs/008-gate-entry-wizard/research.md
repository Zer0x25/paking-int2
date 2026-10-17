# Research: Flujo guiado de garita

## Decisions

### Keep the wizard state inside the existing gate panel

- **Decision**: Model `plate`, `movement` and `entry-details` as local UI steps in `VehicleGatePanel`.
- **Rationale**: The component already owns plate validation, entry/exit handlers, offline fallback, active-session refresh and the active vehicle list. Local view state does not need persistence.
- **Alternatives considered**: Split the wizard into new standalone form components or add a persisted operation entity. Rejected because this flow is local to one card and no data exists until an operation is confirmed.

### Reuse existing operation handlers and contracts

- **Decision**: Keep the current entry and manual-exit handlers as the only writers; invoke exit with the plate retained by the wizard and invoke entry only from the final confirmation.
- **Rationale**: This preserves API payloads, local validation, IndexedDB, outbox sync, tickets and session refresh behavior.
- **Alternatives considered**: Add a new endpoint or duplicate online/offline logic for each wizard step. Rejected because neither adds product value and both could diverge from existing lifecycle rules.

### Keep selected destination values while navigating backwards

- **Decision**: Back actions preserve plate, unit, space type and area/sector. A successful operation resets the wizard; a failed one keeps the appropriate step and values.
- **Rationale**: Operators can correct a wrong selection without re-entering data, while the explicit final confirmation prevents premature entry creation.
- **Alternatives considered**: Reset each step on back or auto-submit upon choosing Entrada. Rejected because they either increase rework or remove the requested review barrier.

### Generate UUIDs without requiring `crypto.randomUUID()`

- **Decision**: Centralize UUID creation in the shared core utility. Prefer `crypto.randomUUID()` and otherwise construct UUID v4 from `crypto.getRandomValues()` bytes.
- **Rationale**: Some mobile/browser runtimes expose secure Web Crypto randomness without the newer `randomUUID()` convenience method. Entry must not fail before its request or offline fallback starts.
- **Alternatives considered**: Use `Math.random()` or a timestamp-based ID. Rejected because those identifiers are not cryptographically secure and can collide across offline terminals.

## No New Dependencies

The existing React state, plate helpers, network requests and IndexedDB functions support this flow. No new packages, endpoints or tables are required.
