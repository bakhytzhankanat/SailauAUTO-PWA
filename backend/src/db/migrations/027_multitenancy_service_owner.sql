-- Multi-tenancy: service table + service_id on user and all tenant-scoped data.
-- One "service" = one автосервис (one owner + their managers/workers and data).
-- super_admin has service_id NULL and can only manage owners via admin API.

CREATE TABLE IF NOT EXISTS service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  default_service_id UUID;
BEGIN
  INSERT INTO service (id, name) SELECT gen_random_uuid(), 'Default' WHERE NOT EXISTS (SELECT 1 FROM service);
  SELECT id INTO default_service_id FROM service LIMIT 1;

  -- user: add service_id, allow super_admin role
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'service_id') THEN
    ALTER TABLE "user" ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_role_check;
    ALTER TABLE "user" ADD CONSTRAINT user_role_check CHECK (role IN ('super_admin', 'owner', 'manager', 'worker'));
    UPDATE "user" SET service_id = default_service_id WHERE service_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_user_service_id ON "user"(service_id);
  END IF;

  -- settings: add service_id and new PK
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'service_id') THEN
    ALTER TABLE settings ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE settings SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE settings ALTER COLUMN service_id SET NOT NULL;
    ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
    ALTER TABLE settings ADD PRIMARY KEY (service_id, key);
    CREATE INDEX IF NOT EXISTS idx_settings_service_id ON settings(service_id);
  END IF;

  -- client
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client' AND column_name = 'service_id') THEN
    ALTER TABLE client ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE client SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE client ALTER COLUMN service_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_client_service_id ON client(service_id);
  END IF;

  -- booking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking' AND column_name = 'service_id') THEN
    ALTER TABLE booking ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE booking SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE booking ALTER COLUMN service_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_booking_service_id ON booking(service_id);
  END IF;

  -- day_close
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'day_close' AND column_name = 'service_id') THEN
    ALTER TABLE day_close ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE day_close SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE day_close ALTER COLUMN service_id SET NOT NULL;
    ALTER TABLE day_close DROP CONSTRAINT IF EXISTS day_close_date_key;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_day_close_service_date ON day_close(service_id, date);
    CREATE INDEX IF NOT EXISTS idx_day_close_service_id ON day_close(service_id);
  END IF;

  -- inventory_item
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_item' AND column_name = 'service_id') THEN
    ALTER TABLE inventory_item ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE inventory_item SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE inventory_item ALTER COLUMN service_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_item_service_id ON inventory_item(service_id);
  END IF;

  -- reminder
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminder' AND column_name = 'service_id') THEN
    ALTER TABLE reminder ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE reminder SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE reminder ALTER COLUMN service_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_reminder_service_id ON reminder(service_id);
  END IF;

  -- whatsapp_inbound
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_inbound' AND column_name = 'service_id') THEN
    ALTER TABLE whatsapp_inbound ADD COLUMN service_id UUID REFERENCES service(id) ON DELETE CASCADE;
    UPDATE whatsapp_inbound SET service_id = default_service_id WHERE service_id IS NULL;
    ALTER TABLE whatsapp_inbound ALTER COLUMN service_id SET NOT NULL;
    ALTER TABLE whatsapp_inbound DROP CONSTRAINT IF EXISTS whatsapp_inbound_phone_key;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_inbound_service_phone ON whatsapp_inbound(service_id, phone);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_service_id ON whatsapp_inbound(service_id);
  END IF;

END $$;
