-- body_options: array of body variants for this model. NULL or empty = no body step (single body or N/A).
ALTER TABLE vehicle_catalog ADD COLUMN IF NOT EXISTS body_options JSONB;
