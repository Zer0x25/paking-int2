# Data Model: Capacidad por Tipo de Espacio

## Facility

Existing physical facility. Its total remains the physical capacity limit.

| Field | Type | Constraint | Meaning |
|---|---|---|---|
| `totalCapacity` | integer | `> 0` | Total physical spaces |
| `standardCapacity` | integer, derived | `>= 0` | `totalCapacity - accessibleCapacity` |
| `accessibleCapacity` | integer, category allocation | `0..totalCapacity` | Spaces allocated to Accessible |

`standardCapacity + accessibleCapacity = totalCapacity`. Facility category rows `STD` and `ACC` store these two allocations. Other legacy category rows remain for historical references but are not available for new admissions. The migration keeps each facility's active ACC and non-ACC occupancy within its initial typed capacity.

## ParkingArea

Existing physical area. The aggregate capacity remains available to existing callers and is derived from the two type allocations.

| Field | Type | Constraint | Meaning |
|---|---|---|---|
| `standardCapacity` | integer | `>= active Standard occupancy` | Standard spaces assigned to this area |
| `accessibleCapacity` | integer | `>= active Accessible occupancy` | Accessible spaces assigned to this area |
| `allocatedCapacity` | integer, derived | sum of the two fields | Total spaces assigned to this area |

For each active area, `allocatedCapacity = standardCapacity + accessibleCapacity`. Migration preserves each area's existing aggregate capacity and assigns enough per-type capacity to fit its active sessions and keep the sum of Standard area assignments within the facility Standard pool.

Across active areas:

```text
sum(area.standardCapacity) <= facility.standardCapacity
sum(area.accessibleCapacity) <= facility.accessibleCapacity
```

Unassigned capacity is tracked separately by type:

```text
standardBuffer = facility.standardCapacity - sum(area.standardCapacity)
accessibleBuffer = facility.accessibleCapacity - sum(area.accessibleCapacity)
```

## SpaceCategory

Existing per-facility category with `code` in `STD`, `ACC`, `VIP`, or `OTHER`.

- New configuration and entry use only `STD` (General / Estándar) and `ACC` (Accesible).
- `allocatedSlots` for STD and ACC must sum to facility total capacity.
- Legacy VIP/OTHER rows remain for existing session references and have zero new capacity.
- Existing sessions with a non-ACC category are counted as Standard for capacity calculations; historical rows are not rewritten.

## ParkingSession

Existing session relationship remains unchanged: `spaceCategoryId` records the actual type assigned to the vehicle, and `parkingAreaId` identifies the area when assigned. Legacy VIP/OTHER sessions count as Standard occupancy; new sessions can use only STD or ACC.

## Validation and mutation rules

- Reject facility Accessible capacity outside `[0, totalCapacity]`.
- Recalculate Standard as `totalCapacity - accessibleCapacity` on every facility mutation.
- Reject facility changes if either category capacity would fall below its active occupancy or active-area assignments.
- Reject area changes if either type falls below occupancy in that area or causes its type's active-area total to exceed facility capacity.
- Apply category/area updates, facility version increment and audit record in the same existing D1 mutation batch.
- Preserve aggregate `allocatedCapacity` in API and dashboard responses for compatibility; derive it from the two category values.
- Initial migration counts active ACC sessions as Accessible and every other active category as Standard; no session is rewritten or closed.
