-- Split physical capacity into Standard and Accessible without rewriting sessions.
ALTER TABLE parking_areas
  ADD COLUMN standard_capacity INTEGER NOT NULL DEFAULT 0 CHECK (standard_capacity >= 0);

ALTER TABLE parking_areas
  ADD COLUMN accessible_capacity INTEGER NOT NULL DEFAULT 0 CHECK (accessible_capacity >= 0);

-- Ensure both supported categories exist for every facility before calculating the split.
INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-default-std-' || facility.id, facility.id, 'General / Estándar', 'STD', facility.total_capacity
FROM facilities AS facility;

INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots)
SELECT 'cat-default-acc-' || facility.id, facility.id, 'Accesible', 'ACC', 0
FROM facilities AS facility;

-- Retain existing ACC capacity where it fits, but protect currently parked vehicles of both types.
UPDATE space_categories AS accessible
SET allocated_slots = MAX(
  (SELECT COUNT(*) FROM parking_sessions AS session
   WHERE session.facility_id = accessible.facility_id
     AND session.status = 'active'
     AND session.space_category_id = accessible.id),
  MIN(
    accessible.allocated_slots,
    (SELECT total_capacity FROM facilities WHERE id = accessible.facility_id)
      - (SELECT COUNT(*) FROM parking_sessions AS session
         JOIN space_categories AS category
           ON category.id = session.space_category_id AND category.facility_id = session.facility_id
         WHERE session.facility_id = accessible.facility_id
           AND session.status = 'active'
           AND category.code <> 'ACC')
  )
)
WHERE accessible.code = 'ACC';

-- All capacity not assigned to ACC becomes Standard; legacy categories remain for history only.
UPDATE space_categories AS standard
SET allocated_slots = (SELECT total_capacity FROM facilities WHERE id = standard.facility_id)
  - (SELECT allocated_slots FROM space_categories AS accessible
     WHERE accessible.facility_id = standard.facility_id AND accessible.code = 'ACC')
WHERE standard.code = 'STD';

UPDATE space_categories
SET allocated_slots = 0
WHERE code IN ('VIP', 'OTHER');

-- Begin with all historic area capacity as Standard. Reclassify only enough unoccupied capacity
-- as Accessible to preserve active ACC occupancy and keep active Standard assignments in budget.
UPDATE parking_areas
SET standard_capacity = allocated_capacity,
    accessible_capacity = 0;

WITH area_occupancy AS (
  SELECT area.id,
         area.facility_id,
         area.code,
         area.allocated_capacity,
         SUM(CASE WHEN session.status = 'active' AND category.code = 'ACC' THEN 1 ELSE 0 END) AS active_accessible,
         SUM(CASE WHEN session.status = 'active' AND category.code <> 'ACC' THEN 1 ELSE 0 END) AS active_standard
  FROM parking_areas AS area
  LEFT JOIN parking_sessions AS session
    ON session.facility_id = area.facility_id
   AND session.parking_area_id = area.id
   AND session.status = 'active'
  LEFT JOIN space_categories AS category
    ON category.facility_id = session.facility_id
   AND category.id = session.space_category_id
  WHERE area.is_active = 1
  GROUP BY area.id, area.facility_id, area.code, area.allocated_capacity
), area_totals AS (
  SELECT area_occupancy.*,
         SUM(allocated_capacity) OVER (PARTITION BY facility_id) AS total_assigned,
         SUM(active_accessible) OVER (PARTITION BY facility_id) AS total_active_accessible
  FROM area_occupancy
), extra_capacity AS (
  SELECT area_totals.*,
         MAX(0, total_assigned
           - (SELECT allocated_slots FROM space_categories AS standard
              WHERE standard.facility_id = area_totals.facility_id AND standard.code = 'STD')
           - total_active_accessible) AS accessible_area_capacity_needed,
         MAX(0, allocated_capacity - active_accessible - active_standard) AS free_area_capacity
  FROM area_totals
), ranked_capacity AS (
  SELECT extra_capacity.*,
         COALESCE(SUM(free_area_capacity) OVER (
           PARTITION BY facility_id ORDER BY code, id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ), 0) AS free_capacity_before
  FROM extra_capacity
), area_split AS (
  SELECT id,
         active_accessible + MAX(0, MIN(
           free_area_capacity,
           accessible_area_capacity_needed - free_capacity_before
         )) AS accessible_capacity
  FROM ranked_capacity
)
UPDATE parking_areas
SET accessible_capacity = (SELECT accessible_capacity FROM area_split WHERE area_split.id = parking_areas.id),
    standard_capacity = allocated_capacity
      - (SELECT accessible_capacity FROM area_split WHERE area_split.id = parking_areas.id)
WHERE is_active = 1;
