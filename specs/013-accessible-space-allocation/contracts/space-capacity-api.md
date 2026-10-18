# Space Capacity API Contract

All endpoints retain the existing authenticated facility scope and mutation audit behavior.

## Migration compatibility

The D1 migration preserves existing session rows and each area's current aggregate capacity. Active ACC sessions remain ACC; active sessions in STD, VIP or OTHER are counted as Standard. Initial per-type capacity must cover those active counts, and active-area Accessible assignments must leave the Standard area sum within the facility Standard pool. No migration closes or rewrites a session.

## Facility bootstrap

`POST /api/facilities`

Request adds optional `accessibleCapacity` (integer `0..totalCapacity`, default `0`) to the existing name, address and `totalCapacity` fields. The response returns the facility plus categories `STD` and `ACC`; their `allocatedSlots` values sum to `totalCapacity`.

## Facility update

`PUT /api/facilities/:facilityId`

Request may include `accessibleCapacity`. When absent, the existing Accessible count is preserved. When `totalCapacity` changes, Standard is recalculated from the resulting total and Accessible values. The server returns `409` if category occupancy or area assignments prevent the change.

## Area read/create/update

`GET /api/facilities/:facilityId/areas` returns each area with:

- `standardCapacity`, `standardOccupied`, `standardAvailable`
- `accessibleCapacity`, `accessibleOccupied`, `accessibleAvailable`
- `allocatedCapacity` as `standardCapacity + accessibleCapacity`
- existing identity, state, version and aggregate occupancy fields

`POST /api/facilities/:facilityId/areas` and `PUT /api/facilities/:facilityId/areas/:areaId` accept `standardCapacity` and `accessibleCapacity`; `allocatedCapacity` is derived. For backwards compatibility, requests with only `allocatedCapacity` are treated as all Standard and zero Accessible.

The server rejects requests that exceed the remaining buffer for either type or reduce a type below active occupancy.

## Vehicle entry

`POST /api/parking-sessions/entry` retains the existing `spaceCategoryId` and optional `parkingAreaId`. The server verifies the selected category belongs to the facility and is STD or ACC, then checks unit quota, facility category capacity and selected-area category capacity before persisting.

- A Standard entry consumes only Standard.
- An Accessible entry consumes Accessible.
- If Accessible is full, the endpoint returns a conflict directing the operator to use an available Standard category; the client must show the warning and require an explicit Standard selection before retrying.
- Capacity races return `409`; the rejected session is not persisted.

## Dashboard metrics

Facility and area occupancy metrics include capacity, occupied and available counts for both Standard and Accessible while retaining the existing aggregate values.
