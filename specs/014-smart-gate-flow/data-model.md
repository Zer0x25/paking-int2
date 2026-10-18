# Data Model: Flujo inteligente de patente en Garita

## Persisted entities

No entity, table, IndexedDB store, or API payload changes are required.

## Existing data used

### ParkingSession

The existing active session is the source for a vehicle already in the facility. The client uses its `id`, `facilityId`, `licensePlate`, `status`, `businessUnitId`, `spaceCategoryId`, `parkingAreaId`, `entryTime`, and `version` fields as available. The current facility's existing session list is already reconciled with IndexedDB.

### BusinessUnit, SpaceCategory, ParkingArea

Existing facility-scoped catalogs provide suggestion context. Missing catalog entries use the existing fallback labels; they do not prevent a valid active session from being identified.

## Ephemeral gate search state

This state exists only in the React panel and is not persisted:

| State | Source | Behavior |
|---|---|---|
| Plate query | Operator input, formatted by existing input helper | Normalized for comparison; displayed in `XX-XX-XX` format |
| Active matches | Current facility's loaded active-session collection | Prefix-filtered, sorted in existing list order, limited to five |
| Exact active match | First active session whose normalized plate equals the complete valid query | Shows vehicle context and only the explicit exit action |
| No active match | Valid complete query with active-list loading finished | Shows only the entry action, which opens destination confirmation |
| Loading | Existing initial active-list loading state | Announces that active vehicles are being checked and hides suggestions/actions |
| Active suggestion index | Local keyboard-navigation state | Controls `aria-activedescendant`; reset when query/results change or list closes |

## State transitions

1. Panel opens → active-session list loads from the existing online/local source.
2. Operator types → normalize the query; once the list is available, show up to five active prefix matches.
3. Operator selects a suggestion → fill the formatted plate; derive exact session; show explicit exit action.
4. Operator types a complete active plate → derive the same exact-session state without requiring a suggestion click.
5. Operator types a complete non-active plate → show entry action; operator opens the existing unit/space/area confirmation.
6. Existing handler saves entry/exit → refresh/reconcile sessions and return to the plate state.
7. Existing handler reports conflict or failure → retain query and permit correction/retry.
