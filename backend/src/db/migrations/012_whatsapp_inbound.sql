-- Phase 8: WhatsApp inbound (webhook only; no Client creation)
CREATE TABLE IF NOT EXISTS whatsapp_inbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_last_message_at ON whatsapp_inbound (last_message_at DESC NULLS LAST);
