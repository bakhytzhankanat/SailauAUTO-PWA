-- Add "Гарантия" as a single service type (warranty_mode = true)
INSERT INTO service_catalog (id, category_id, name, subgroup)
VALUES ('b0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000002', 'Гарантия', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Set warranty_mode if column exists (migration 033)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_catalog' AND column_name = 'warranty_mode') THEN
    UPDATE service_catalog SET warranty_mode = true WHERE id = 'b0000000-0000-0000-0000-000000000099';
  END IF;
END $$;
