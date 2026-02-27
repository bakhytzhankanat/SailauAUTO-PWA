-- Guarantee service must be visible for all vehicles (main services, not tied to specific models)
UPDATE service_catalog
SET applicable_to_vehicle_models = NULL, applicable_to_body_types = NULL
WHERE id = 'b0000000-0000-0000-0000-000000000099';
