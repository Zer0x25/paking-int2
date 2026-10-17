# Data Model: Persistencia Central de la Aplicación

All existing core records map to D1 tables. The client-side IndexedDB schema remains a distinct offline cache/outbox and is not replaced by this model.

## Tables

### `facilities`

- `id` TEXT primary key
- `name` TEXT required
- `address` TEXT required, defaults to empty string
- `total_capacity` INTEGER required, greater than zero
- `version` INTEGER required, starts at 1; compare-and-swap serialization token for facility-scoped invariants
- `created_at`, `updated_at` TEXT required ISO-8601 UTC

### `space_categories`

- `id` TEXT primary key; `facility_id` references `facilities.id`
- `name`, `code` TEXT required; code is one of `STD`, `ACC`, `VIP`, `OTHER`
- `allocated_slots` INTEGER required, non-negative
- Unique `(facility_id, code)`

### `business_units`

- `id` TEXT primary key; `facility_id` references `facilities.id`
- `name`, `code` TEXT required; code unique per facility
- `priority_level` INTEGER 1–5
- `quota_type` one of `guaranteed`, `contractual`, `dynamic`
- `default_quota` INTEGER non-negative; `is_active` boolean integer
- `version` INTEGER required, starts at 1
- Inactive rows remain available for historical references.

### `parking_areas`

- `id` TEXT primary key; `facility_id` references `facilities.id`
- `name` TEXT length at least 2; `code` TEXT length 1–10 and unique per facility
- `description` TEXT; `allocated_capacity` INTEGER non-negative
- nullable `business_unit_id` references `business_units.id`
- `is_active` boolean integer; `version` INTEGER starts at 1
- `created_at`, `updated_at` TEXT required ISO-8601 UTC
- Inactive rows remain for references and are excluded from active choices.

### `event_bookings`

- `id` TEXT primary key; `facility_id` and `business_unit_id` are required references
- `title` TEXT length 2–120
- `reserved_slots` INTEGER greater than zero
- `start_time`, `end_time` TEXT required ISO-8601 UTC; end is later than start
- `status` one of `scheduled`, `active`, `completed`, `cancelled`
- `version` INTEGER starts at 1
- Index `(facility_id, start_time, end_time, status)` supports allocation and active-list reads.

### `parking_sessions`

- `id` TEXT primary key; `facility_id`, `business_unit_id`, `space_category_id` required references
- nullable `parking_area_id` references `parking_areas.id`
- `license_plate` TEXT exactly six uppercase alphanumeric characters, stored compact without display separators
- `entry_time` TEXT ISO-8601 UTC; nullable `exit_time`
- `status` one of `active`, `completed`; nullable non-negative `duration_minutes`
- `operator_user_id`, `device_id` TEXT required; legacy/offline operator identifiers are retained without a hard user foreign key
- `version` INTEGER starts at 1 and increases on each change
- Index `(facility_id, status, entry_time)` supports active sessions and dashboard reads.
- Partial unique index on `(facility_id, license_plate)` where status is `active` prevents duplicate active vehicles.

### `users`

- `id` TEXT primary key; `username` TEXT unique and case-insensitive for lookup
- `full_name` TEXT required; `role` is `admin` or `operator`
- nullable `facility_id` references `facilities.id`; `created_at` TEXT ISO-8601 UTC
- No password or password-hash field is stored. Local password verification uses `.dev.vars`; production authentication remains out of scope.
- Existing role names and login response remain unchanged.

### `audit_logs`

- `id` TEXT primary key; `user_id` TEXT required, retained as historical text identity
- `facility_id` TEXT required, references `facilities.id` for tenant-scoped history reads
- `action`, `entity_type`, `entity_id`, `details_json` TEXT required
- nullable `mutation_id`; composite foreign key `(facility_id, mutation_id)` references the idempotent sync receipt when the audit came from offline sync
- `created_at` TEXT required ISO-8601 UTC
- Index `(facility_id, entity_type, entity_id, created_at)` supports facility-scoped history lookup.
- The audit row is written in the same batch as the operation it describes.

### `sync_mutations`

- `id` TEXT required: client mutation ID
- `facility_id` TEXT required; `mutation_type` TEXT required
- `payload_fingerprint` TEXT required to prevent reusing the same ID for a different operation
- `result_json` TEXT required; stores the successful response needed to acknowledge an idempotent replay
- `processed_at` TEXT required ISO-8601 UTC
- Composite primary key `(facility_id, id)` scopes uniqueness and replay lookup to a facility.
- Only successful mutations are recorded; business conflicts remain retryable and return the existing conflict shape.

## Relationships and transaction boundaries

- Facility owns categories, areas, units, events, sessions, and users.
- Event bookings and business units are soft-retired/cancelled where the existing lifecycle requires history retention; related history is not cascade-deleted.
- A facility `version` compare-and-swap gates writes that affect capacity, reservations, or occupancy. Its first SQL statement checks the expected facility version plus entity-version, capacity, and (for sync) receipt preconditions; following statements are gated by the incremented version. Constraint failures roll back the batch. The batch includes the domain row, audit, and (for sync) receipt rows.
- D1 migration creates all tables/indexes. Local seed inserts `fac-default-01`, its base categories, areas, business units, and current development event only when no facility exists. `.dev.vars` identities and roles are inserted only if absent; passwords are never persisted.
- Migration and seed are not destructive; no table drop, D1 reset, or existing local state cleanup is used.
