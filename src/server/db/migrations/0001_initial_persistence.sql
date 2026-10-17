CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS space_categories (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL CHECK (code IN ('STD', 'ACC', 'VIP', 'OTHER')),
  allocated_slots INTEGER NOT NULL CHECK (allocated_slots >= 0),
  UNIQUE (facility_id, code),
  UNIQUE (facility_id, id)
);

CREATE TABLE IF NOT EXISTS business_units (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  priority_level INTEGER NOT NULL CHECK (priority_level BETWEEN 1 AND 5),
  quota_type TEXT NOT NULL CHECK (quota_type IN ('guaranteed', 'contractual', 'dynamic')),
  default_quota INTEGER NOT NULL DEFAULT 0 CHECK (default_quota >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (facility_id, code),
  UNIQUE (facility_id, id)
);

CREATE TABLE IF NOT EXISTS parking_areas (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  name TEXT NOT NULL CHECK (length(name) >= 2),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 1 AND 10),
  description TEXT NOT NULL DEFAULT '',
  allocated_capacity INTEGER NOT NULL DEFAULT 0 CHECK (allocated_capacity >= 0),
  business_unit_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (facility_id, code),
  UNIQUE (facility_id, id),
  FOREIGN KEY (facility_id, business_unit_id) REFERENCES business_units(facility_id, id)
);

CREATE TABLE IF NOT EXISTS event_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  business_unit_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  reserved_slots INTEGER NOT NULL CHECK (reserved_slots > 0),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL CHECK (end_time > start_time),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (facility_id, id),
  FOREIGN KEY (facility_id, business_unit_id) REFERENCES business_units(facility_id, id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  facility_id TEXT REFERENCES facilities(id),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_nocase ON users(username COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS parking_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  business_unit_id TEXT NOT NULL,
  space_category_id TEXT NOT NULL,
  parking_area_id TEXT,
  license_plate TEXT NOT NULL CHECK (length(license_plate) = 6 AND license_plate = upper(license_plate)),
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  operator_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (facility_id, business_unit_id) REFERENCES business_units(facility_id, id),
  FOREIGN KEY (facility_id, space_category_id) REFERENCES space_categories(facility_id, id),
  FOREIGN KEY (facility_id, parking_area_id) REFERENCES parking_areas(facility_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_facility_plate
  ON parking_sessions(facility_id, license_plate) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sessions_facility_status_entry
  ON parking_sessions(facility_id, status, entry_time);

CREATE INDEX IF NOT EXISTS idx_areas_facility_active
  ON parking_areas(facility_id, is_active);

CREATE INDEX IF NOT EXISTS idx_units_facility_active
  ON business_units(facility_id, is_active);

CREATE INDEX IF NOT EXISTS idx_events_facility_window_status
  ON event_bookings(facility_id, start_time, end_time, status);

CREATE TABLE IF NOT EXISTS sync_mutations (
  id TEXT NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  mutation_type TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (facility_id, id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  mutation_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (facility_id, mutation_id) REFERENCES sync_mutations(facility_id, id)
);

CREATE INDEX IF NOT EXISTS idx_audit_facility_entity_created
  ON audit_logs(facility_id, entity_type, entity_id, created_at);
