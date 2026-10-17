# Data Model: Flujo guiado de garita

## Persisted Entities

There are no new persisted entities or schema changes in this feature.

## Existing Parking Session

The confirmed entry continues to create the existing `ParkingSession` with:

- `facilityId`
- normalized `licensePlate`
- `businessUnitId`
- `spaceCategoryId`
- `parkingAreaId` or `null` for automatic/floating assignment
- `entryTime`, operator and device identifiers
- current active status and version

Exit continues to complete the existing active session using its current online/offline behavior.

## Temporary Gate Operation State

The UI retains these values only while the operator moves through the wizard:

| Field | Meaning | Validation |
|---|---|---|
| `step` | `plate`, `movement` or `entry-details` | Transitions only through the corresponding actions |
| `plate` | Vehicle plate entered by the operator | Existing six-character alphanumeric format; normalized and displayed as `XX-XX-XX` |
| `movement` | `entry` or `exit` | Must be chosen after a valid plate |
| `businessUnitId` | Entry destination unit | Must identify an available business unit before entry confirmation |
| `spaceCategoryId` | Entry space type | Must identify an available space category before entry confirmation |
| `parkingAreaId` | Physical sector, or empty for floating assignment | Empty is a valid explicit automatic/floating selection |

This state is discarded after a successful operation and is not synchronized or persisted separately.
