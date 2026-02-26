-- Phase 11: Time tracking — store duration in minutes (computed on complete)
ALTER TABLE booking ADD COLUMN IF NOT EXISTS duration_minutes INT NULL;
