-- Phase 2: Booking and booking_service (IMPLEMENTATION_PLAN 2.4, 2.5)
CREATE TYPE booking_status AS ENUM ('planned', 'arrived', 'in_progress', 'completed', 'no_show');
CREATE TYPE booking_source AS ENUM ('whatsapp', 'live');

CREATE TABLE IF NOT EXISTS booking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES client(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  source booking_source NOT NULL,
  vehicle_catalog_id UUID NOT NULL REFERENCES vehicle_catalog(id) ON DELETE RESTRICT,
  body_type VARCHAR(100) NOT NULL,
  plate_number VARCHAR(50),
  box_id INT NOT NULL CHECK (box_id IN (1, 2)),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'planned',
  assigned_master_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  note TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  service_payment_amount DECIMAL(12, 2),
  payment_type VARCHAR(20) CHECK (payment_type IN ('kaspipay', 'cash', 'mixed')),
  material_expense DECIMAL(12, 2),
  kaspi_tax_amount DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_date ON booking(date);
CREATE INDEX IF NOT EXISTS idx_booking_date_box ON booking(date, box_id);
CREATE INDEX IF NOT EXISTS idx_booking_service_booking ON booking_service(booking_id);
