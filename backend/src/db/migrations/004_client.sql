-- Phase 2: Client (created only after booking completion; table needed for FK and GET list)
CREATE TABLE IF NOT EXISTS client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('whatsapp', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_phone ON client(phone);
