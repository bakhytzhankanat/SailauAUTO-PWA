-- "Другое" vehicle: a real catalog row instead of silently saving the first model (Honda Elysion),
-- plus a free make/model name on the booking (e.g. "Toyota Camry").
ALTER TABLE vehicle_catalog ADD COLUMN IF NOT EXISTS is_other BOOLEAN NOT NULL DEFAULT false;

INSERT INTO vehicle_catalog (id, name, body_type, year, body_options, is_other)
VALUES ('c0000000-0000-0000-0000-0000000000ff', 'Басқа көлік', 'Другое', NULL, NULL, true)
ON CONFLICT (id) DO UPDATE SET is_other = true;

ALTER TABLE booking ADD COLUMN IF NOT EXISTS vehicle_custom_name VARCHAR(120);

-- Bookings created with "Другое" were saved as Honda Elysion with body_type 'Другое' (Elysion has no such body).
UPDATE booking
SET vehicle_catalog_id = 'c0000000-0000-0000-0000-0000000000ff'
WHERE vehicle_catalog_id = 'c0000000-0000-0000-0000-000000000007' AND body_type = 'Другое';

UPDATE client
SET last_vehicle_name = 'Басқа көлік'
WHERE last_vehicle_name = 'Honda Elysion' AND last_body_type = 'Другое';
