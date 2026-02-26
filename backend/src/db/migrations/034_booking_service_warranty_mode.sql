-- Phase 15: Per-booking-service warranty flag (price = 0 when true)
ALTER TABLE booking_service ADD COLUMN IF NOT EXISTS warranty_mode BOOLEAN NOT NULL DEFAULT false;
