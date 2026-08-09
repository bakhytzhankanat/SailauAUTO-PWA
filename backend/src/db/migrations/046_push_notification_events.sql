-- Idempotent business-event ledger and user-scoped notification preferences.
-- This migration is additive: subscriptions from 045 remain device-scoped.
CREATE TABLE IF NOT EXISTS push_notification_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  preference_key VARCHAR(64) NOT NULL,
  booking_id UUID REFERENCES booking(id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES inventory_item(id) ON DELETE SET NULL,
  day_close_id UUID REFERENCES day_close(id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  destination TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  subscription_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  stale_subscription_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  UNIQUE(service_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_push_notification_event_service_created
  ON push_notification_event(service_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_notification_preference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  preference_key VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_push_notification_preference_user
  ON push_notification_preference(service_id, user_id);
