# Research: Flujo inteligente de patente en Garita

**Date**: 2026-10-18

## Decision 1: Search the already-loaded active sessions

- **Decision**: Derive exact matches and partial suggestions from the active-session collection already displayed by Garita. Filter by current facility, active status, and normalized plate prefix. Limit suggestions to five.
- **Rationale**: The panel already loads and reconciles remote sessions with IndexedDB, including offline fallback. Reusing that state avoids a new API path and avoids one D1-backed request for every character typed.
- **Alternatives considered**: Add a plate-search endpoint or query on each keystroke; rejected because the user needs a local, low-latency lookup and the existing active list already contains the required records.

## Decision 2: Reuse existing domain normalization and operation handlers

- **Decision**: Use the current license-plate normalization/validation functions and the existing entry and quick-exit handlers. A selected suggestion resolves to its active session record, so quick exit retains session ID/version conflict handling.
- **Rationale**: The behavior changes the choice presented by the UI, not the meaning of a session or the server operation. Reusing handlers retains online/offline behavior, reconciliation, and error messages.
- **Alternatives considered**: Add a new movement service or infer status from plate text alone; rejected because the session record is the source of truth and the existing operations already enforce concurrency.

## Decision 3: Keep movement selection explicit and remove the generic movement step

- **Decision**: Once the active list is ready, a valid active plate shows only “Registrar salida”; a valid plate without a match shows only “Registrar entrada”. The latter opens the existing destination confirmation. No active suggestion or key press records an exit automatically.
- **Rationale**: This combines the current plate and movement steps while preserving the explicit operator action and entry destination review approved by the user.
- **Alternatives considered**: Keep the generic Entrada/Salida buttons; rejected because they allow invalid choices. Auto-register an exit on selecting a suggestion; rejected because a selection can be accidental.

## Decision 4: Accessible combobox behavior

- **Decision**: Expose the plate field as a combobox controlling a listbox. Support Arrow Up/Down, Enter to select the active option, Escape to close, and an accessible active-descendant relationship. Keep a visible explicit action button after an exact active match is identified.
- **Rationale**: The field remains usable on mobile and supports keyboard and assistive technology users without changing data or navigation outside Garita.
- **Alternatives considered**: Mouse-only suggestion chips; rejected because they do not satisfy keyboard or screen-reader requirements.

## Architecture and ADR assessment

No API, storage, schema, dependency, or domain-rule decision is introduced. This is a UI refinement that builds on the behavior recorded in ADR-012; no new ADR is warranted. The interaction choice and approval are captured in the feature specification and PHR.
