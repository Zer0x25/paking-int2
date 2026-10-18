-- Ensure every active facility can register a vehicle from the gate on first use.
-- Existing categories are preserved; only facilities without an STD category are updated.
INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-default-std-' || facility.id,
       facility.id,
       'General / Estándar',
       'STD',
       facility.total_capacity
FROM facilities AS facility
WHERE facility.is_active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM space_categories AS category
    WHERE category.facility_id = facility.id
      AND category.code = 'STD'
  );
