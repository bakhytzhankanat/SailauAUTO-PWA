-- Phase 12: Client — last vehicle and plate for autofill on new booking
ALTER TABLE client ADD COLUMN IF NOT EXISTS last_vehicle_name VARCHAR(255);
ALTER TABLE client ADD COLUMN IF NOT EXISTS last_plate_number VARCHAR(50);
