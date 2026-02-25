-- Phase 3: Warranty (IMPLEMENTATION_PLAN 2.8)
CREATE TABLE IF NOT EXISTS warranty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES client(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE RESTRICT,
  completed_at TIMESTAMPTZ NOT NULL,
  expires_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_client ON warranty(client_id);
CREATE INDEX IF NOT EXISTS idx_warranty_booking ON warranty(booking_id);
