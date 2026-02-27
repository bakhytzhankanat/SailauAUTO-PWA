-- Категория "Гарантия" первой в списке (не среди дополнительных)
UPDATE service_category SET sort_order = 0 WHERE id = 'a0000000-0000-0000-0000-000000000004';
-- Сдвинуть остальные, чтобы порядок был: Гарантия 0, Есік 1, Қосымша 2, Пеш 3
UPDATE service_category SET sort_order = 1 WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE service_category SET sort_order = 2 WHERE id = 'a0000000-0000-0000-0000-000000000002';
UPDATE service_category SET sort_order = 3 WHERE id = 'a0000000-0000-0000-0000-000000000003';
