-- Phase 13: Multiple day_close per day (shift_index); date no longer unique per service
ALTER TABLE day_close ADD COLUMN IF NOT EXISTS shift_index INT NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS idx_day_close_service_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_close_service_date_shift ON day_close(service_id, date, shift_index);
