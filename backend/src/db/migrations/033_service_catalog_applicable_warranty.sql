-- Phase 15: Service catalog — applicable to vehicle models/body types, warranty_mode flag
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS applicable_to_vehicle_models UUID[];
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS applicable_to_body_types TEXT[];
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS warranty_mode BOOLEAN NOT NULL DEFAULT false;
