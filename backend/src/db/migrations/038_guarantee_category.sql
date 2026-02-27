-- Add "Гарантия" as a separate service category with one service "Гарантия"
INSERT INTO service_category (id, name, sort_order)
VALUES ('a0000000-0000-0000-0000-000000000004', 'Гарантия', 4)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO service_catalog (id, category_id, name, subgroup)
VALUES ('b0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000004', 'Гарантия', NULL)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;
