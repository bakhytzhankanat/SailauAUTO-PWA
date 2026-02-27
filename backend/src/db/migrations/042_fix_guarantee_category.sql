-- FIX: Guarantee service MUST be in its own category, NOT in Қосымша қызметтер
-- Create category if not exists
INSERT INTO service_category (id, name, sort_order)
VALUES ('a0000000-0000-0000-0000-000000000004', 'Гарантия', 0)
ON CONFLICT (id) DO UPDATE SET name = 'Гарантия', sort_order = 0;

-- Force update the service to be in Guarantee category (not Қосымша)
UPDATE service_catalog
SET category_id = 'a0000000-0000-0000-0000-000000000004',
    applicable_to_vehicle_models = NULL,
    applicable_to_body_types = NULL
WHERE id = 'b0000000-0000-0000-0000-000000000099';

-- If service doesn't exist, create it
INSERT INTO service_catalog (id, category_id, name, subgroup)
VALUES ('b0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000004', 'Гарантия', NULL)
ON CONFLICT (id) DO NOTHING;
