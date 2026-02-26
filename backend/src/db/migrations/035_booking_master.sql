-- Phase 16: Multiple masters per booking
CREATE TABLE IF NOT EXISTS booking_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  master_user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  UNIQUE(booking_id, master_user_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_master_booking ON booking_master(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_master_user ON booking_master(master_user_id);
