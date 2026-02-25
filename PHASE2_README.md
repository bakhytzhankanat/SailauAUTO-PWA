# Phase 2 — Booking System + Calendar

## What was added

- **DB:** `settings`, `service_category`, `service_catalog`, `vehicle_catalog`, `client`, `booking`, `booking_service` (migrations 002–005). Seed data for categories, services, and vehicles.
- **Backend:** GET settings, GET vehicle-catalog, GET service-catalog, GET service-categories-with-services, GET clients, GET/POST/PATCH bookings. Time validation 10:00–18:00 and box conflict check. POST/PATCH bookings require Owner or Manager (403 for Worker).
- **Frontend:** Calendar day view (date nav, Бокс 1/2, time grid 10–18, booking cards with status colors, click → booking detail). Add Booking wizard (Client → Vehicle → Plate → Services & time → Note → Summary). Booking detail (read-only). Role-based: Worker does not see “Жазба қосу” in nav (Phase 1); Worker can open calendar and booking detail.

## Run after Phase 1

1. **Migrations**
   ```bash
   cd backend && npm run migrate
   ```
   This runs 002_settings, 003_catalogs (with seed), 004_client, 005_booking.

2. **Backend** (if not already): `npm run dev`
3. **Frontend:** `cd frontend && npm run dev`

## Test

- Log in as owner. Create a booking via “Жазба қосу”: pick or enter client, vehicle, plate, services, box, date, time, duration, note; submit. See it on the calendar. Open the booking card → detail.
- Log in as worker (create one in DB if needed): no “Жазба қосу” in nav; calendar and booking detail are visible.
