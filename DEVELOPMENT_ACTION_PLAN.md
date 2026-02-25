# Sailau_avto PWA — Development Action Plan

**Single source of truth:** IMPLEMENTATION_PLAN.md (entity model, schema, financial engine, worker permissions, DayClose snapshots).

This document is the **step-by-step implementation roadmap** for Cursor: phases, modules, backend/frontend/database tasks, API endpoints, role guards, and the exact order to build so that MVP ships first with correct data integrity and financial logic.

---

## Principles (from IMPLEMENTATION_PLAN)

- **Booking** is the only execution entity; there is **no Job table**.
- **Worker** must NOT modify: time, services, vehicle, box, client name, phone, plate, or booking_service lines. Worker can only: change status, set started_at/completed_at, enter service_payment_amount, material_expense, payment_type, add PartSale entries, and trigger Client/Warranty creation on completion.
- **Client** is created **only** when a booking is completed (first completed visit).
- **DayClose** runs the financial engine **once** at close time and stores **snapshot** values; no dynamic recalculation later.
- **Part sales** are excluded from the salary pool and count only as owner dividend.
- **WhatsAppInbound** is used only to prefill Add Booking; no Client is created until a booking is completed.

---

## Part A — What to Implement First & Dependencies

### Order of implementation (high level)

1. **Foundation:** Database + Auth + Settings (defaults). Nothing else works without these.
2. **Catalogs:** Vehicle and service catalogs. Required before any booking can be created.
3. **Bookings (structure only):** Create/list/update booking + booking_service. Required before calendar and execution.
4. **Calendar:** Read-only view of bookings; depends on Bookings API.
5. **Booking execution:** Start → In progress → Payment → Complete. Depends on Bookings + InventoryItem (for PartSale). Client/Warranty created on completion.
6. **Inventory:** Full CRUD for Owner/Manager; PartSale already used in execution. Movement history optional for MVP.
7. **Day close:** Financial engine + snapshot persistence. Depends on Settings, completed Bookings, PartSales.
8. **Clients + Warranty:** Read APIs and optional profile UI; creation already in execution.
9. **Reminders:** Standalone; can be built after Auth.
10. **Analytics:** Read-only from DayClose + completed bookings.
11. **WhatsApp:** Webhook + list + prefill for Add Booking (no Client creation).
12. **Settings (full UI):** Owner-only; can be after Day close so all params are used.

### Backend-before-frontend rule

- **Phase 1:** Backend auth + user + role → then Login screen + shell.
- **Phase 2:** Backend settings + catalogs + booking CRUD + validation → then Calendar + Add Booking wizard.
- **Phase 3:** Backend execution PATCH + PartSale + Client/Warranty on complete → then Booking detail → Start → In progress → Payment → Success screens.
- **Phase 4:** Backend inventory_item CRUD + movement (manual) → then Inventory list + add/remove modals.
- **Phase 5:** Backend DayClose engine + persist → then Day close screen with date + expenses + masters toggles + submit.
- **Phase 6–9:** Backend read/APIs first; then bind Stitch screens or new UI.

---

## Part B — Phases, Modules, Tasks, APIs, Guards

### Phase 1 — Auth + Roles

**Module:** Auth & roles.

**Database tasks**

- Migration 001: Create `user` table (id, phone unique, password_hash, role enum, display_name, is_senior_worker, created_at, updated_at).
- Seed: one user with role=owner, phone and hashed password.

**Backend tasks**

- Project setup: repo, DB connection, env (DB_URL, JWT_SECRET), migration runner.
- Auth: register (optional for MVP), login (phone + password) → return JWT (include role, is_senior_worker in payload or from DB on each request).
- Middleware: verify JWT, attach user (id, role, is_senior_worker) to request; optional requireAuth, requireRole(['owner','manager']), requireOwner, requireSeniorWorkerOrOwner.

**API endpoints**

- `POST /api/auth/login` — body: { phone, password }; response: { token, user: { id, phone, display_name, role, is_senior_worker } }.
- `GET /api/auth/me` — optional; return current user (for refresh).

**Frontend tasks**

- Login screen: copy layout from **code reference/code.html** (phone, password, "Кіру"). On submit call POST /api/auth/login; store token (e.g. localStorage or memory + cookie); store role and is_senior_worker.
- App shell: bottom nav (Күнтізбе, Жазба қосу, Қойма, Ескертпелер, Баптаулар). Visibility: show "Жазба қосу" only if role in [owner, manager]; show "Баптаулар" for owner only (or restricted content). Redirect unauthenticated to /login.
- Route guard: if no token → redirect to /login.

**Role guards (Phase 1)**

- Unauthenticated: only /login.
- Authenticated: all app routes; nav items filtered by role (Worker does not see Add Booking; Worker sees Calendar, Inventory read, Reminders; Owner sees Settings; Day Close link visible only for is_senior_worker or owner — add in Phase 5).

**Deliverable:** User can log in, see role-based nav, and reach placeholder screens for Calendar, Add Booking (if Manager/Owner), Inventory, Reminders, Settings (if Owner).

---

### Phase 2 — Booking System (structure) + Calendar

**Modules:** Settings (defaults), Catalogs, Booking CRUD, Calendar (read).

**Database tasks**

- Migration 002: `settings` (key PK, value, updated_at). Seed default keys: working_hours_start (10:00), working_hours_end (18:00), box_count (2), manager_percent (8), masters_percent (60), owner_percent (40), kaspi_tax_percent (4), charity_percent (10), round_charity_to_nearest_1000 (1).
- Migration 003: `service_category` (id, name, sort_order, created_at, updated_at); `service_catalog` (id, category_id FK, name, created_at, updated_at); `vehicle_catalog` (id, name, body_type, year, created_at, updated_at). Seed at least one category and a few services/vehicles for dev.
- Migration 004: `client` (id, name, phone, source enum, created_at, updated_at).
- Migration 005: `booking` (all fields per IMPLEMENTATION_PLAN 2.4); `booking_service` (id, booking_id FK, service_catalog_id FK, quantity, created_at).

**Backend tasks**

- Settings: GET /api/settings (all or by key); PATCH/PUT for Owner only (Phase 9). For Phase 2 only read defaults for validation.
- Catalogs: GET /api/vehicle-catalog; GET /api/service-categories and /api/service-catalog (or nested); POST/PUT/DELETE for Owner only (Phase 9). For Phase 2 implement GET and minimal seed.
- Bookings:  
  - List: GET /api/bookings?date=YYYY-MM-DD&box_id=1|2 (optional). Response: bookings with booking_services, vehicle_catalog, assigned_master (display_name).  
  - Get one: GET /api/bookings/:id (same shape).  
  - Create: POST /api/bookings — body: client_id (optional), client_name, phone, source, vehicle_catalog_id, body_type, plate_number, box_id, date, start_time, end_time, note, services: [{ service_catalog_id, quantity }]. Validate: date within working hours; start_time/end_time within 10:00–18:00; no box overlap for same box_id and date.  
  - Update: PATCH /api/bookings/:id — same structure fields allowed; **restrict to Owner/Manager**; do not allow updating execution fields (started_at, completed_at, service_payment_amount, etc.) here (use execution endpoint in Phase 3).
- Validation helper: time window 10:00–18:00; check overlapping bookings for same box + date.

**API endpoints**

- `GET /api/settings` — return key-value or single config object.
- `GET /api/vehicle-catalog` — list vehicles.
- `GET /api/service-categories` — list categories with services or flat service_catalog.
- `GET /api/service-catalog` — list services (with category_id).
- `GET /api/bookings?date=&box_id=` — list for calendar.
- `GET /api/bookings/:id` — one booking with services and vehicle.
- `POST /api/bookings` — create (Owner/Manager only).
- `PATCH /api/bookings/:id` — update structure only (Owner/Manager only); reject if role=worker.

**Frontend tasks**

- Calendar day view: use **code reference/code(4).html** and **code(21).html**. Fetch GET /api/bookings?date=selectedDate. Render two columns (Бокс 1, Бокс 2); time grid 10:00–18:00 (60 min); booking cards with status color (planned=blue, arrived=orange, in_progress=yellow, completed=green, no_show=gray). Click card → navigate to /booking/:id.
- Add Booking wizard (Owner/Manager only; hide tab or route for Worker):
  - Step 1 – Client: **code(13).html** / **code(14).html**. Options: (1) Select from WhatsApp list (GET /api/whatsapp-inbound in Phase 8; until then "Барлық клиенттер" GET /api/clients and "Қолмен қосу" name+phone). Store client_name, phone, source (whatsapp | live). Do not create Client entity yet if new (client created only on booking completion).
  - Step 2 – Vehicle: **code(12).html**. GET /api/vehicle-catalog; select vehicle_catalog_id; body_type from catalog or separate body step **code(11).html**.
  - Step 3 – Plate: **code(10).html**. Free text plate_number.
  - Step 4 – Services & time: **code(8).html** / **code(9).html**. GET /api/service-catalog; select services with quantity 1 or 2; select box_id (1 or 2), date, start_time, duration → compute end_time. Call GET /api/bookings?date= to check conflict before submit.
  - Step 5 – Note: **code(6).html**. Optional note.
  - Step 6 – Summary: **code(7).html**. Show all; submit POST /api/bookings with body as above.
- After create success → redirect to calendar or booking detail.

**Role guards (Phase 2)**

- GET /api/bookings, GET /api/bookings/:id — all authenticated.
- POST /api/bookings, PATCH /api/bookings/:id (structure) — only Owner, Manager; return 403 for Worker.
- Frontend: do not show "Жазба қосу" for Worker; do not render Add Booking route for Worker.

**Deliverable:** Owner/Manager can create and edit bookings; everyone can see calendar and open booking detail. No execution yet.

---

### Phase 3 — Booking Execution (Worker flow)

**Module:** Booking execution (status, payment, PartSale, Client/Warranty on complete).

**Database tasks**

- Migration 006: `inventory_item` (id, name, sku, sale_price, quantity, min_quantity, unit, created_at, updated_at); `inventory_movement` (id, item_id FK, type enum(in,out,sale), quantity, amount, ref_type enum(booking_completion, manual), ref_id, created_at); `part_sale` (id, booking_id FK, inventory_item_id FK, quantity, unit_price, created_at).
- Migration 007: `warranty` (id, client_id FK, booking_id FK, service_catalog_id FK, completed_at, expires_at, created_at).
- Ensure booking table has execution columns (started_at, completed_at, service_payment_amount, payment_type, material_expense, kaspi_tax_amount) — already in Migration 005.

**Backend tasks**

- Execution PATCH: new endpoint or same PATCH with strict field allowlist for Worker:
  - **Worker-allowed fields only:** status, started_at, completed_at, service_payment_amount, payment_type, material_expense, kaspi_tax_amount.
  - If role=worker, reject any change to: client_name, phone, vehicle_catalog_id, body_type, plate_number, box_id, date, start_time, end_time, note, and do not allow create/update/delete of booking_service.
- Start job: PATCH /api/bookings/:id/start — set status=in_progress, started_at=now(), optionally assigned_master_id=current user. Allowed for Worker (and Owner).
- Complete job: POST /api/bookings/:id/complete (or PATCH with body) — body: service_payment_amount, payment_type (kaspipay|cash|mixed), material_expense, kaspi_tax_amount (compute 4% of Kaspi portion if not sent), part_sales: [{ inventory_item_id, quantity }], warranty_service_ids: [service_catalog_id] (which services get 3-month warranty).  
  - Validate: booking status is in_progress.  
  - Set booking: completed_at=now(), status=completed, service_payment_amount, payment_type, material_expense, kaspi_tax_amount.  
  - For each part_sale: get inventory_item.sale_price (unit_price), create part_sale row, decrement inventory_item.quantity, insert inventory_movement(type=sale, ref_type=booking_completion, ref_id=booking_id).  
  - Client: find client by phone (booking.phone); if not found create new client (name=booking.client_name, phone=booking.phone, source=booking.source). If found, optionally update name. Set booking.client_id = client.id.  
  - Warranty: for each warranty_service_id in booking’s booking_services, create warranty row: client_id, booking_id, service_catalog_id, completed_at=booking.completed_at, expires_at=completed_at + 3 months.
- Kaspi tax: when payment_type is kaspipay or mixed, compute 4% of the Kaspi portion (e.g. if mixed, client may send kaspi_amount; else infer). Store kaspi_tax_amount on booking.

**API endpoints**

- `PATCH /api/bookings/:id/start` — status=in_progress, started_at=now(). Allowed: Worker, Owner.
- `POST /api/bookings/:id/complete` — body: service_payment_amount, payment_type, material_expense, part_sales[], warranty_service_ids[]. Server computes kaspi_tax_amount. Allowed: Worker, Owner.

**Frontend tasks**

- Booking detail (read-only structure for Worker): **code(20).html**. GET /api/bookings/:id. Show client, vehicle, services, schedule. If status is planned or arrived, show button "Жұмысты бастау". On click → PATCH /api/bookings/:id/start → navigate to same detail or in-progress view.
- Work in progress: **code(19).html**. Same GET /api/bookings/:id; show timer from started_at; button "Жұмысты аяқтау" → navigate to /booking/:id/payment.
- Payment entry: **code(17).html**, **code(18).html**. Form: service_payment_amount, payment_type (KaspiPay / Қолма-қол / Аралас), material_expense. Section "Сатылған бөлшектер": GET /api/inventory-items (list for dropdown); add rows (inventory_item_id, quantity, unit_price from item); submit POST /api/bookings/:id/complete with part_sales and warranty_service_ids (checkboxes per booking_service). After success → navigate to **code(15).html** or **code(16).html** (success), then to calendar.
- Worker must never see or call POST /api/bookings or PATCH /api/bookings/:id (structure). Only start and complete.

**Role guards (Phase 3)**

- PATCH /api/bookings/:id/start, POST /api/bookings/:id/complete — Worker and Owner only (Manager may be excluded from execution if product says so; IMPLEMENTATION_PLAN says Worker and Owner).
- Backend: on PATCH /api/bookings/:id (general), if role=worker allow only execution fields; otherwise 403 or 400.

**Deliverable:** Worker can start job, see timer, finish with payment and parts; Client and Warranty created; inventory decremented and PartSale + movement written.

---

### Phase 4 — Inventory

**Module:** Inventory (Owner/Manager CRUD; movement history optional).

**Database tasks**

- Already done in Phase 3 (inventory_item, inventory_movement, part_sale). Optional: index on inventory_movement(item_id, created_at) for history.

**Backend tasks**

- GET /api/inventory-items — list (filter by name optional); include quantity, min_quantity, sale_price. Used by Payment screen (Phase 3) and Inventory screen.
- POST /api/inventory-items — create (Owner/Manager only). Body: name, sku, sale_price, quantity, min_quantity, unit.
- PATCH /api/inventory-items/:id — update (Owner/Manager only).
- Manual stock: POST /api/inventory-items/:id/movement — body: type (in|out), quantity. Insert inventory_movement(ref_type=manual); update inventory_item.quantity. Owner/Manager only.
- GET /api/inventory-items/:id/movements — optional; for "Қозғалыс тарихы" modal.

**API endpoints**

- `GET /api/inventory-items` — list.
- `POST /api/inventory-items` — create (Owner/Manager).
- `PATCH /api/inventory-items/:id` — update (Owner/Manager).
- `POST /api/inventory-items/:id/movement` — manual in/out (Owner/Manager).
- `GET /api/inventory-items/:id/movements` — optional.

**Frontend tasks**

- Inventory list: **code(5).html**. GET /api/inventory-items; show name, sku, sale_price, quantity, min_quantity; highlight "Аз қалды" when quantity < min_quantity. Buttons: "Қосу" (add stock) → open modal with quantity → POST movement type=in; "Шығару" (or long-press for bulk) → modal quantity → POST movement type=out.
- Modals: "Қоймаға қосу" (add quantity) and "Бірнешеуін шығару" from code(5); "Қозғалыс тарихы" from code(5) using GET movements if implemented.

**Role guards (Phase 4)**

- Create/update/movement: Owner, Manager only. Worker can only use inventory in Payment (PartSale) via completion endpoint.

**Deliverable:** Owner/Manager manage stock; Worker already uses inventory only inside completion flow.

---

### Phase 5 — Day Close Engine

**Module:** Day close (financial engine + snapshot persistence).

**Database tasks**

- Migration 008: `day_close` (all snapshot fields per IMPLEMENTATION_PLAN 2.12); unique on date.
- Migration 009: `day_close_master` (id, day_close_id FK, user_id FK, share_amount_snapshot, created_at).

**Backend tasks**

- Financial engine (single function or service): inputs — date, lunch_expense, transport_expense, rent_expense, present_master_user_ids[].
  - From DB: completed bookings for date (service_payment_amount, material_expense, kaspi_tax_amount); part_sales for that date (sum quantity*unit_price); settings (manager_percent, masters_percent, owner_percent, kaspi_tax_percent, charity_percent, round_charity_to_nearest_1000).
  - Steps exactly as IMPLEMENTATION_PLAN STEP 6.2: service_income_snapshot, part_sales_snapshot, material_expense_snapshot, opex sum, net_service, kaspi_tax_snapshot, net_after_tax, charity rounded to 1000, distributable, manager_amount_snapshot, remainder, masters_total split equally among present_master_user_ids, owner_amount_snapshot, part_sales_owner_snapshot.
  - Return computed object (no DB write inside engine).
- POST /api/day-close — body: date, lunch_expense, transport_expense, rent_expense, present_master_user_ids[]. Guard: only is_senior_worker or role=owner. Run financial engine; INSERT day_close with all snapshot fields; INSERT day_close_master for each present master with share_amount_snapshot. Return saved day_close + masters.
- GET /api/day-close?date= — return existing day_close for date (if any) with day_close_masters. Used by UI to show "already closed" or to prefill for edit (if product allows edit: re-run engine and overwrite).
- GET /api/day-close/preview?date= — run engine and return computed snapshot only (no save). Used by UI to show numbers before "Ауысымды жабу".

**API endpoints**

- `GET /api/day-close/preview?date=` — compute and return snapshot (Senior Worker / Owner).
- `POST /api/day-close` — run engine, persist snapshot (Senior Worker / Owner).
- `GET /api/day-close?date=` — get saved day_close for date.

**Frontend tasks**

- Day close screen: **code(1).html**. Date picker (default today or last open day). On date change: call GET /api/day-close/preview?date= with manual expenses (lunch, transport, rent) — either send in query or separate endpoint that accepts body; simpler: GET preview returns from DB only; frontend sends expenses in POST. So: form with date, lunch, transport, rent; "Ауысымда кім болды" = list of workers (GET /api/users?role=worker) with toggles (present_master_user_ids). On load date: GET /api/day-close?date=; if exists show saved snapshot; else GET /api/day-close/preview?date= (and optionally pass expenses) to show computed values. Submit: POST /api/day-close with date, expenses, present_master_user_ids. Show snapshot: КІРІСТЕР, ТӨЛЕМ ТҮРІ (Kaspi/Қолма-қол from bookings), ОПЕРАЦИЯЛЫҚ ШЫҒЫН, ҚАЙЫРЫМДЫЛЫҚ, БӨЛІНЕТІН ТАБЫС, ЖАЛАҚЫ БӨЛУ (table), АУЫСЫМДА КІМ БОЛДЫ (toggles), ҚОРЫТЫНДЫ. Button "Ауысымды жабу".
- Nav: show "Ауысымды жабу" or link from Settings only for Owner or is_senior_worker.

**Role guards (Phase 5)**

- All day-close endpoints: require (role=owner OR is_senior_worker); 403 otherwise.

**Deliverable:** Senior Worker or Owner can run Day Close for a date; financial engine runs once; snapshot stored; part sales excluded from salary pool and stored as part_sales_owner_snapshot.

---

### Phase 6 — Clients + Warranty

**Module:** Clients (read), Warranty (read; creation already in Phase 3).

**Database tasks**

- None (client, warranty tables exist).

**Backend tasks**

- GET /api/clients — list (for Add Booking "Барлық клиенттер" and future client list). Owner/Manager.
- GET /api/clients/:id — one client with bookings (visit history) and warranties. Optional for MVP.
- GET /api/warranties?client_id= or ?booking_id= — list. Optional.

**API endpoints**

- `GET /api/clients` — list (Owner/Manager for Add Booking step).
- `GET /api/clients/:id` — detail with history (optional).
- `GET /api/warranties` — query by client_id or booking_id (optional).

**Frontend tasks**

- Add Booking step 1: when "Барлық клиенттер" is chosen, call GET /api/clients and show list; on select fill client_name, phone, source.
- Optional: Client profile page (visits, services, warranties). No Stitch reference; simple list/detail.

**Role guards (Phase 6)**

- GET /api/clients: Owner, Manager (for booking wizard); Worker may be denied or read-only by product.

**Deliverable:** Client list usable in Add Booking; optional profile and warranty read.

---

### Phase 7 — Analytics

**Module:** Analytics (read-only from DayClose + completed bookings).

**Database tasks**

- None.

**Backend tasks**

- GET /api/analytics?period=day|week|month&date= or &from=&to= — aggregate from day_close rows and completed bookings in range. Return: service_income, part_sales, material_expense, net, avg_check, avg_daily, vehicle_count, salary breakdown (from day_close), owner_dividends. No raw recalculation; sum day_close snapshots and booking totals.

**API endpoints**

- `GET /api/analytics?period=&date=` or `from=&to=` — Owner only.

**Frontend tasks**

- Analytics screen (no Stitch reference): period selector (Күн / Апта / Ай); cards: Қызмет түсімі, Запчасть сатылымы, Материал шығыны, Таза табыс, Орташа чек, Орташа күндік түсім, Көлік саны, Еңбекақы есебі, Иесі дивидендтері. Simple Kazakh labels.

**Role guards (Phase 7)**

- GET /api/analytics: Owner only; 403 for Manager/Worker.

**Deliverable:** Owner sees analytics from snapshots only.

---

### Phase 8 — WhatsApp Integration

**Module:** WhatsApp inbound (webhook + list + prefill; no Client creation).

**Database tasks**

- Migration 010: `whatsapp_inbound` (id, phone, name, last_message, last_message_at, created_at, updated_at). Unique on phone or upsert by phone.

**Backend tasks**

- POST /api/webhooks/whatsapp — receive Chatflow payload; normalize phone; upsert whatsapp_inbound (phone, name, last_message, last_message_at). Do not create or update client. Return 200.
- GET /api/whatsapp-inbound — list (Owner/Manager); sort by last_message_at desc.

**API endpoints**

- `POST /api/webhooks/whatsapp` — public or with secret header; upsert whatsapp_inbound.
- `GET /api/whatsapp-inbound` — list (Owner/Manager).

**Frontend tasks**

- WhatsApp list screen (no Stitch reference): list from GET /api/whatsapp-inbound; each row: phone, name, last_message, last_message_at; button "Жазба қосу" → navigate to /booking/add?phone=...&name=... (or store in app state). Add Booking step 1 (Client): when opened with phone/name query, prefill and set source=whatsapp; do not create Client; Client is created only when booking is completed.

**Role guards (Phase 8)**

- GET /api/whatsapp-inbound: Owner, Manager. Webhook is server-to-server.

**Deliverable:** Webhook updates whatsapp_inbound; PWA shows list and prefill for Add Booking without creating Client.

---

### Phase 9 — Settings (full)

**Module:** Settings (Owner-only; catalogs + users + financial params).

**Database tasks**

- None (settings, catalogs, user already exist).

**Backend tasks**

- PATCH /api/settings — body: key-value or full config object. Owner only.
- Already have catalog CRUD (vehicle, service_category, service_catalog); restrict to Owner.
- GET /api/users — list users (for "Ауысымда кім болды" and masters list). Owner only for editing.
- PATCH /api/users/:id — set is_senior_worker, role (Owner only). Optional.

**API endpoints**

- `PATCH /api/settings` — Owner only.
- Catalog POST/PATCH/DELETE — Owner only (if not already).
- `GET /api/users` — list (Owner for Settings).
- `PATCH /api/users/:id` — update role, is_senior_worker (Owner only).

**Frontend tasks**

- Settings screen: **code(2).html**. Sections: Қызметкерлер және Рөлдер (manager %, masters %, owner %); Ауысым (Смена) — list workers with toggle (for Day Close "present" default or just display); Жұмыс уақыты (start/end); Қаржылық параметрлер (Kaspi %, charity %, round 1000); Қызметтер анықтамалығы (link or list service_catalog); Көлік каталогы (vehicle_catalog). Save → PATCH /api/settings and catalog endpoints.

**Role guards (Phase 9)**

- All settings and user update: Owner only.

**Deliverable:** Owner configures all params; Day Close and validation use these values.

---

## Part C — Stitch Screens to Real Data (Summary)

| Stitch file | Screen | Data binding |
|-------------|--------|--------------|
| code.html | Login | POST /api/auth/login; store token, role |
| code(4), code(21) | Calendar day | GET /api/bookings?date=; status colors |
| code(13), code(14) | Add Booking – Client | GET whatsapp-inbound (Phase 8), GET clients; prefill from query (WhatsApp); no Client create |
| code(12) | Add Booking – Car | GET /api/vehicle-catalog |
| code(11) | Add Booking – Body | body_type from vehicle or list |
| code(10) | Add Booking – Plate | plate_number free text |
| code(8), code(9) | Add Booking – Service & time | GET service_catalog; box, date, time; conflict check |
| code(6) | Add Booking – Note | note |
| code(7) | Booking summary | POST /api/bookings |
| code(20) | Booking detail | GET /api/bookings/:id; "Жұмысты бастау" → PATCH start |
| code(19) | Work in progress | Same GET; timer from started_at; "Жұмысты аяқтау" → /payment |
| code(17), code(18) | Payment entry | GET inventory-items; POST /api/bookings/:id/complete |
| code(15), code(16) | Job completed | Success; go to calendar |
| code(1) | Day close | GET preview, GET by date; POST /api/day-close |
| code(5) | Inventory | GET inventory-items; POST movement (add/remove) |
| code(3) | Reminders | GET/POST reminder; filter status |
| code(2) | Settings | GET/PATCH settings; GET/PATCH catalogs; GET users |

---

## Part D — Worker Permission Enforcement (Summary)

1. **Backend**
   - POST /api/bookings, PATCH /api/bookings/:id (structure): reject with 403 if role=worker.
   - PATCH /api/bookings/:id/start, POST /api/bookings/:id/complete: allow Worker and Owner.
   - For any PATCH /api/bookings/:id (generic), if role=worker then accept only: status, started_at, completed_at, service_payment_amount, payment_type, material_expense, kaspi_tax_amount; ignore or reject other fields.
   - Inventory create/update/movement: 403 for Worker. PartSale only via completion endpoint.

2. **Frontend**
   - Worker: hide "Жазба қосу" tab/route; hide Settings (or show read-only); hide Analytics; hide WhatsApp list (or show read-only). Show Calendar (optionally filter by box), Booking detail (read-only structure + Start/Finish), Payment screen, Inventory list (read-only), Reminders. Day Close: hide unless is_senior_worker or owner.

3. **Data**
   - Do not send structure fields from Worker UI when completing; only send execution payload (amounts, payment_type, part_sales, warranty_service_ids).

---

## Part E — DayClose Snapshot Engine: Trigger and Persist

1. **Trigger:** User (Senior Worker or Owner) opens Day Close screen, selects date, optionally fills lunch/transport/rent, selects "Ауысымда кім болды" (present masters), and clicks "Ауысымды жабу".
2. **Request:** POST /api/day-close with { date, lunch_expense, transport_expense, rent_expense, present_master_user_ids[] }.
3. **Server:** Load settings; load completed bookings for date; load part_sales for those bookings; run financial engine (STEP 6.2 of IMPLEMENTATION_PLAN); get snapshot object; in one transaction: INSERT day_close (all *_snapshot fields), INSERT day_close_master for each present master.
4. **No recalculation later:** Analytics and reports read day_close and day_close_master rows only; they never recompute from raw bookings/part_sales.

---

## Part F — Inventory Movements and Part Sales ↔ Booking Completion

1. **PartSale:** When POST /api/bookings/:id/complete is called with part_sales: [{ inventory_item_id, quantity }]:
   - For each line: get inventory_item (sale_price as unit_price); create part_sale(booking_id, inventory_item_id, quantity, unit_price); decrement inventory_item.quantity; insert inventory_movement(item_id, type=sale, quantity, amount=quantity*unit_price, ref_type=booking_completion, ref_id=booking_id).
2. **Manual movement:** Only Owner/Manager via POST /api/inventory-items/:id/movement (type=in or out); ref_type=manual, ref_id=null.
3. **Low stock:** When quantity < min_quantity, frontend shows "Аз қалды" (code(5)); no extra backend logic.

---

## Part G — WhatsAppInbound → Add Booking Without Creating Client

1. Webhook only writes/updates whatsapp_inbound (phone, name, last_message, last_message_at). No client table write.
2. PWA WhatsApp list: "Жазба қосу" navigates to Add Booking with phone (and name) as query or state. Step 1 (Client) prefills client_name and phone, sets source=whatsapp. User completes wizard; POST /api/bookings with client_name, phone, source=whatsapp; client_id remains null.
3. When a Worker/Owner later completes that booking (POST /api/bookings/:id/complete), backend creates Client (by phone) and links booking.client_id. So Client is created only after first completed visit.

---

## Part H — Database Migrations Checklist (by phase)

- **Phase 1:** 001_user.
- **Phase 2:** 002_settings, 003_service_category + service_catalog + vehicle_catalog, 004_client, 005_booking + booking_service.
- **Phase 3:** 006_inventory_item + inventory_movement + part_sale, 007_warranty.
- **Phase 4:** (no new tables).
- **Phase 5:** 008_day_close, 009_day_close_master.
- **Phase 6:** (none).
- **Phase 7:** (none).
- **Phase 8:** 010_whatsapp_inbound.
- **Phase 9:** (none).

---

## Part I — Suggested Order of Work in Cursor

1. Create project (frontend + backend folders or monorepo), DB, env, migration runner.
2. Phase 1: migrations 001, auth API, login screen, app shell, role-based nav.
3. Phase 2: migrations 002–005, settings read, catalogs GET, booking CRUD + validation, calendar screen, Add Booking wizard (all steps), bind Stitch layout to API.
4. Phase 3: migrations 006–007, execution endpoints (start, complete), Client/Warranty logic, PartSale + inventory decrement + movement; Booking detail, In progress, Payment, Success screens.
5. Phase 4: inventory CRUD + movement API, Inventory list + modals (add/remove, history optional).
6. Phase 5: migrations 008–009, financial engine, day-close preview + POST, Day Close screen (code(1)).
7. Phase 6: clients list API, optional client profile; wire "Барлық клиенттер" in Add Booking.
8. Phase 7: analytics API (read day_close + completed bookings), Analytics screen.
9. Phase 8: migration 010, webhook endpoint, whatsapp_inbound GET, WhatsApp list screen, prefill Add Booking from query.
10. Phase 9: settings PATCH, catalog CRUD, users list/PATCH; full Settings screen (code(2)).
11. Reminders: migration for reminder table if not done; CRUD API; Reminders screen (code(3)) — can be done after Phase 2 or 3.

This order ensures: data integrity (Client only on completion, DayClose snapshots only), financial correctness (engine once, persist snapshot), role isolation (Worker cannot change structure), and MVP delivery (booking → execution → inventory → day close → rest) without overengineering.
