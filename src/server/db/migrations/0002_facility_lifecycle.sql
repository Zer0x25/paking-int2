ALTER TABLE facilities
  ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_facilities_active
  ON facilities(is_active, created_at);
