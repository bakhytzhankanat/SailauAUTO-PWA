-- Phase 2: Service category and catalog, vehicle catalog
CREATE TABLE IF NOT EXISTS service_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES service_category(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  body_type VARCHAR(100) NOT NULL,
  year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed dev data (one category, a few services, a few vehicles)
INSERT INTO service_category (id, name, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Есік қызметтері', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Қосымша қызметтер', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_catalog (id, category_id, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Есік ремонты'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Актуаторды ауыстыру'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Май ауыстыру'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Диагностика')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_catalog (id, name, body_type, year) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Toyota Alphard', '20 кузов', 2005),
  ('c0000000-0000-0000-0000-000000000002', 'Toyota Estima', '20 кузов', 2006),
  ('c0000000-0000-0000-0000-000000000003', 'Toyota Camry 70', '70 кузов', 2012),
  ('c0000000-0000-0000-0000-000000000004', 'Honda Elysion', '20 кузов', 2004),
  ('c0000000-0000-0000-0000-000000000005', 'Nissan Elgrand', '20 кузов', 2002)
ON CONFLICT (id) DO NOTHING;