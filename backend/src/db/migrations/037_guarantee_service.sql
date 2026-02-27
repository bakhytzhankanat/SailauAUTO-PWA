-- Ensure category exists before inserting service
INSERT INTO service_category (id, name, sort_order)
VALUES ('a0000000-0000-0000-0000-000000000004', 'Гарантия', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_catalog (id, category_id, name, subgroup)
VALUES ('b0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000004', 'Гарантия', NULL)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_catalog' AND column_name = 'warranty_mode') THEN
    UPDATE service_catalog SET warranty_mode = true WHERE id = 'b0000000-0000-0000-0000-000000000099';
  END IF;
END $$;
