-- Phase 4: Optional note for manual inventory movements
ALTER TABLE inventory_movement ADD COLUMN IF NOT EXISTS note TEXT;
