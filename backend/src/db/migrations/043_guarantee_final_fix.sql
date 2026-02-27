-- FINAL FIX: Create Guarantee category and move service there

-- 1. Delete any old guarantee service that might be in wrong category
DELETE FROM service_catalog WHERE name = 'Гарантия' AND id != 'b0000000-0000-0000-0000-000000000099';

-- 2. Create Guarantee category (force update if exists)
INSERT INTO service_category (id, name, sort_order)
VALUES ('a0000000-0000-0000-0000-000000000004', 'Гарантия', 0)
ON CONFLICT (id) DO UPDATE SET name = 'Гарантия', sort_order = 0;

-- 3. Create or update Guarantee service in correct category
INSERT INTO service_catalog (id, category_id, name, subgroup)
VALUES ('b0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000004', 'Гарантия', NULL)
ON CONFLICT (id) DO UPDATE 
SET category_id = 'a0000000-0000-0000-0000-000000000004',
    name = 'Гарантия',
    subgroup = NULL;

-- 4. Clear vehicle restrictions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_catalog' AND column_name = 'applicable_to_vehicle_models') THEN
    UPDATE service_catalog SET applicable_to_vehicle_models = NULL WHERE id = 'b0000000-0000-0000-0000-000000000099';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_catalog' AND column_name = 'applicable_to_body_types') THEN
    UPDATE service_catalog SET applicable_to_body_types = NULL WHERE id = 'b0000000-0000-0000-0000-000000000099';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_catalog' AND column_name = 'warranty_mode') THEN
    UPDATE service_catalog SET warranty_mode = true WHERE id = 'b0000000-0000-0000-0000-000000000099';
  END IF;
END $$;
