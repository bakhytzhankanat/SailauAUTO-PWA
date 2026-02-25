-- Phase 2: Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('working_hours_start', '10:00'),
  ('working_hours_end', '18:00'),
  ('box_count', '2'),
  ('manager_percent', '8'),
  ('masters_percent', '60'),
  ('owner_percent', '40'),
  ('kaspi_tax_percent', '4'),
  ('charity_percent', '10'),
  ('round_charity_to_nearest_1000', '1000')
ON CONFLICT (key) DO NOTHING;
