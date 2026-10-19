-- Which door(s) a booking service was done on, chosen when the job is completed (optional).
ALTER TABLE booking_service ADD COLUMN IF NOT EXISTS door_side VARCHAR(10);
ALTER TABLE booking_service DROP CONSTRAINT IF EXISTS booking_service_door_side_check;
ALTER TABLE booking_service ADD CONSTRAINT booking_service_door_side_check
  CHECK (door_side IS NULL OR door_side IN ('left', 'right', 'both'));
