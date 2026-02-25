-- Full vehicle catalog. Update existing rows (keep FK for booking) and insert new.
UPDATE vehicle_catalog SET name = 'Toyota Alphard', body_type = '10', year = NULL, body_options = '["10", "20"]' WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE vehicle_catalog SET name = 'Toyota Estima', body_type = '30', year = NULL, body_options = '["30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "50", "51", "52", "53", "54", "55"]' WHERE id = 'c0000000-0000-0000-0000-000000000002';
UPDATE vehicle_catalog SET name = 'Toyota Sienna', body_type = '20', year = NULL, body_options = '["20", "30"]' WHERE id = 'c0000000-0000-0000-0000-000000000003';
UPDATE vehicle_catalog SET name = 'Toyota Voxy', body_type = 'Voxy', year = NULL, body_options = NULL WHERE id = 'c0000000-0000-0000-0000-000000000004';
UPDATE vehicle_catalog SET name = 'Nissan Serena', body_type = 'Serena', year = NULL, body_options = NULL WHERE id = 'c0000000-0000-0000-0000-000000000005';

INSERT INTO vehicle_catalog (id, name, body_type, year, body_options) VALUES
  ('c0000000-0000-0000-0000-000000000006', 'Honda Odyssey', '3', NULL, '["3", "4"]'),
  ('c0000000-0000-0000-0000-000000000007', 'Honda Elysion', 'Elysion', NULL, '["Elysion", "Elysion Prestige"]'),
  ('c0000000-0000-0000-0000-000000000008', 'Nissan Elgrand', 'Elgrand', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
