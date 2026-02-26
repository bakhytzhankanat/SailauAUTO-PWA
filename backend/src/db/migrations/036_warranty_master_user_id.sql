-- Phase 17: Warranty — which master did the work
ALTER TABLE warranty ADD COLUMN IF NOT EXISTS master_user_id UUID NULL REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_warranty_master ON warranty(master_user_id);
