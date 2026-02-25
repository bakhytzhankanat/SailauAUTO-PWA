-- Phase 7: Shared reminders / tasks (Ескертпелер)
CREATE TABLE IF NOT EXISTS reminder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_by_id UUID NULL REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  link_type VARCHAR(20) NULL CHECK (link_type IN ('inventory')),
  link_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_reminder_status ON reminder(status);
CREATE INDEX IF NOT EXISTS idx_reminder_created_at ON reminder(created_at);
