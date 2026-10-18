-- Non-sensitive development catalog. INSERT OR IGNORE preserves edited local rows.
CREATE TABLE IF NOT EXISTS __local_catalog_seed (id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO __local_catalog_seed (id)
SELECT 'base-v1' WHERE NOT EXISTS (SELECT 1 FROM facilities);

INSERT OR IGNORE INTO facilities (id, name, address, total_capacity, version, created_at, updated_at)
SELECT 'fac-default-01', 'Centro de Convenciones & Hotel Grand', 'Av. Costanera 1000', 100, 1,
  '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1')
  AND NOT EXISTS (SELECT 1 FROM facilities);

INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-std', 'fac-default-01', 'General / Estándar', 'STD', 90
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-acc', 'fac-default-01', 'Accesible', 'ACC', 10
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-vip', 'fac-default-01', 'Preferencial / VIP', 'VIP', 10
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
UPDATE space_categories SET allocated_slots = 0
WHERE facility_id = 'fac-default-01' AND code = 'VIP'
  AND EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');

INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version)
SELECT 'bu-hotel-01', 'fac-default-01', 'Hotel', 'HOTEL', 1, 'guaranteed', 40, 1, 1
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version)
SELECT 'bu-events-01', 'fac-default-01', 'Eventos', 'EVENT', 2, 'contractual', 0, 1, 1
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version)
SELECT 'bu-restaurant-01', 'fac-default-01', 'Restaurante', 'REST', 3, 'dynamic', 0, 1, 1
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version)
SELECT 'bu-gym-01', 'fac-default-01', 'Gimnasio', 'GYM', 3, 'dynamic', 0, 1, 1
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');

INSERT OR IGNORE INTO parking_areas (id, facility_id, name, code, description, allocated_capacity, standard_capacity, accessible_capacity, business_unit_id, is_active, version, created_at, updated_at)
SELECT 'area-default-01', 'fac-default-01', 'Subsuelo Techado (Nivel -1)', 'SUB-1', 'Estacionamiento techado principal', 50, 50, 0, NULL, 1, 1,
  '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');
INSERT OR IGNORE INTO parking_areas (id, facility_id, name, code, description, allocated_capacity, standard_capacity, accessible_capacity, business_unit_id, is_active, version, created_at, updated_at)
SELECT 'area-default-02', 'fac-default-01', 'Sector Preferencial Hotel', 'HOTEL-P1', 'Acceso directo a lobby hotel', 30, 30, 0, 'bu-hotel-01', 1, 1,
  '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');

INSERT OR IGNORE INTO event_bookings (id, facility_id, business_unit_id, title, reserved_slots, start_time, end_time, status, version)
SELECT 'ev-summit-01', 'fac-default-01', 'bu-events-01', 'Cumbre de Negocios 2026', 25,
  '2026-10-15T08:00:00.000Z', '2026-10-16T22:00:00.000Z', 'active', 1
WHERE EXISTS (SELECT 1 FROM __local_catalog_seed WHERE id = 'base-v1');

DELETE FROM __local_catalog_seed WHERE id = 'base-v1';
