-- Full service categories and catalog per spec. Preserve existing category/service IDs where used.

-- Categories (3): Есік қызметтері, Қосымша қызметтер, Пеш қызметтері
INSERT INTO service_category (id, name, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Есік қызметтері', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Қосымша қызметтер', 2),
  ('a0000000-0000-0000-0000-000000000003', 'Пеш қызметтері', 3)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Есік: Ауыстыру
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Актуаторды ауыстыру', 'Ауыстыру'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Подшипникті ауыстыру', 'Ауыстыру'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Тросты ауыстыру', 'Ауыстыру'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Құлыптағышты ауыстыру', 'Ауыстыру')
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Есік: Орнату
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Батырма орнату', 'Орнату'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Тұтқа сенсорын орнату', 'Орнату'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Дайын тросты орнату', 'Орнату'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Толық есікті орнату', 'Орнату')
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Есік: Жөндеу
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Ілгішті (присоска) жөндеу', 'Жөндеу'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Ішкі механизмді жөндеу', 'Жөндеу'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Сыртқы тұтқаны жөндеу', 'Жөндеу')
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Есік: Профилактика
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Реттеу (регулировка) және майлау', 'Профилактика'),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Майлау', 'Профилактика')
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Қосымша қызметтер
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', 'Артқы жарық шамдарын орнату', NULL),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002', 'Орындық сықырын кетіру', NULL),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000002', 'Рельс бітегулерін орнату', NULL)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;

-- Пеш қызметтері
INSERT INTO service_catalog (id, category_id, name, subgroup) VALUES
  ('b0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000003', 'Радиатор ауыстыру (алды)', NULL),
  ('b0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000003', 'Радиатор ауыстыру (арты)', NULL),
  ('b0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000003', 'Сервожетек жөндеу ', NULL),
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'Сервожетек жөндеу ', NULL)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, subgroup = EXCLUDED.subgroup;
