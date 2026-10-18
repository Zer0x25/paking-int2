# Research: Capacidad por Tipo de Espacio

## Decisions

### 1. Keep business-unit quota separate from physical space type

- **Decision**: `guaranteed`, `contractual` and `dynamic` continue to govern business-unit eligibility. `STD` and `ACC` govern the physical category occupied by a vehicle. Admission must satisfy both dimensions.
- **Rationale**: These answer different questions and already exist as separate domain concepts. Combining them would make events, hotel guarantees and accessible capacity interfere with each other.
- **Alternatives considered**: Replace quota type with space type; rejected because a business quota is not a physical stall category.

### 2. Use the existing facility category catalog as the facility-level capacity source

- **Decision**: `space_categories.allocated_slots` remains the capacity count for each facility category. Only `STD` and `ACC` are exposed for new configuration and entry. `STD + ACC` must equal facility total capacity; legacy `VIP`/`OTHER` rows remain for referenced history but receive no new entries.
- **Rationale**: Sessions already reference a facility category ID, so this preserves the current session contract and avoids duplicating facility capacity in another table.
- **Alternatives considered**: Add duplicate category counts to the facility row; rejected because it would require keeping two sources of truth synchronized.

### 3. Store a two-category split directly on each parking area

- **Decision**: Add `standardCapacity` and `accessibleCapacity` to `ParkingArea`. Keep `allocatedCapacity` as their derived sum for existing area summaries and API consumers. Existing areas migrate as all Standard and zero Accessible.
- **Rationale**: This feature explicitly supports only two types. Two named fields keep area validation, forms and occupancy queries direct. If more types are introduced, revisit the model before adding them.
- **Alternatives considered**: Add a generic area-to-category allocation table; rejected for the current two-type scope because it adds joins and mutation paths without user value today.

### 4. Enforce category and area limits at the admission boundary

- **Decision**: The server verifies business quota, total capacity, selected category capacity and selected area's capacity before storing an entry. Standard never consumes Accessible. The gate suggests another area with Accessible space first; if no Accessible capacity remains anywhere, it requires an explicit Standard choice with a warning.
- **Rationale**: The gate is the authoritative boundary for both online and queued offline entries when they synchronize. UI-only validation could admit duplicate or stale capacity.
- **Alternatives considered**: Enforce only in the form; rejected because concurrent gates and offline synchronization could overbook.

### 5. Preserve legacy category references and active occupancy during migration

- **Decision**: Migration keeps existing category rows so sessions retain valid foreign keys and sets legacy category capacity to zero. It derives the initial Accessible capacity from the existing ACC allocation, while increasing or decreasing that allocation only as needed to cover active ACC and non-ACC occupancy within the unchanged facility total. Each active area keeps its prior aggregate capacity; the migration assigns enough Accessible capacity to cover active ACC sessions and to keep the sum of Standard area assignments within the facility Standard pool. All other area slots migrate as Standard. New entry controls show only Standard and Accessible.
- **Rationale**: This preserves active vehicles by type, the physical total, aggregate area assignments, and historical references. Any category capacity no longer needed under the two-category model becomes Standard, while unused ACC is reduced only if needed to protect current Standard occupancy.
- **Alternatives considered**: Delete legacy category rows or rewrite historical sessions; rejected because it could break references or alter history.

## Validation Notes

- The D1 catalog and session repositories load categories in the existing batched facility snapshot; the feature can enforce capacity without a new request round trip.
- Area creation, editing and facility bootstrap already write audit records and use optimistic facility versions; new capacity fields will follow those paths.
- The project already uses Zod domain schemas, pure allocation rules, React forms and Vitest unit/Worker suites; no external dependency is needed.
- The local demo has 100 total spaces split as 80 Standard, 10 Accessible and 10 legacy VIP. With no active sessions, the migration results in 90 Standard and 10 Accessible while preserving the total. Existing active ACC sessions and non-ACC sessions take precedence over unused category allocations.
