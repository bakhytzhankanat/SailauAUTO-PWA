-- Phase 6: Warranty indexes + unique to avoid duplicate warranty rows per booking/service
CREATE UNIQUE INDEX IF NOT EXISTS idx_warranty_booking_service ON warranty(booking_id, service_catalog_id);
CREATE INDEX IF NOT EXISTS idx_warranty_expires ON warranty(expires_at);
