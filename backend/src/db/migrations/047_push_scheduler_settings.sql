-- Scheduler-ready defaults. No scheduler is started by this migration or the web process.
INSERT INTO settings (service_id, key, value)
SELECT id, 'push_timezone', 'Asia/Qyzylorda' FROM service
ON CONFLICT (service_id, key) DO NOTHING;

INSERT INTO settings (service_id, key, value)
SELECT id, 'push_booking_reminder_minutes', '30' FROM service
ON CONFLICT (service_id, key) DO NOTHING;

INSERT INTO settings (service_id, key, value)
SELECT id, 'push_day_close_reminder_enabled', 'true' FROM service
ON CONFLICT (service_id, key) DO NOTHING;

INSERT INTO settings (service_id, key, value)
SELECT id, 'push_day_close_reminder_time', '21:30' FROM service
ON CONFLICT (service_id, key) DO NOTHING;
