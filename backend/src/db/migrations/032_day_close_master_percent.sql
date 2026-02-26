-- Phase 14: Manual master % distribution — store percent per master when manual mode
ALTER TABLE day_close_master ADD COLUMN IF NOT EXISTS percent DECIMAL(5, 2) NULL;
