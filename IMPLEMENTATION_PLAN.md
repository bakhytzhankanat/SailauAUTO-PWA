# Sailau_avto PWA — Production-Ready Implementation Plan

Mobile-first PWA for auto service "Sailau_avto".  
This document: **Entity Model → Database Schema → System Modules → Backend → Frontend → Financial Engine → Webhook → Development Roadmap**.  
No code; architecture and plan only.

---

## STEP 1 — Production-Ready Entity Model (MVP)

Single source of truth: **Booking** is the only reservation + execution entity. No separate "Job" table. Worker cannot modify booking structure (time, services, vehicle); only status and payment/completion data.

### 1.1 Core entities (simplified)

| Entity | Purpose |
|--------|--------|
| **User** | Auth, role (owner \| manager \| worker), isSeniorWorker for day close. |
| **Client** | Created only after first completed booking. Name, phone, source. |
| **VehicleCatalog** | Car models (e.g. Toyota Alphard), body type, year. Owner-managed. |
| **Booking** | One entity: reservation + execution. Structure (client, vehicle, services, box, date, time) + execution (status, startedAt, completedAt, payment fields). Worker writes only execution. |
| **BookingService** | N:M booking ↔ service: bookingId, serviceCatalogId, quantity (1 or 2). Part of booking structure. |
| **ServiceCatalog** | Services (e.g. oil change). Category for Settings. Owner-managed. |
| **ServiceCategory** | Service groups (e.g. door, extra, oven). Owner-managed. |
| **Warranty** | One per performed service instance: clientId, bookingId, serviceCatalogId, expiresAt (3 months). Tied to actual completion. |
| **InventoryItem** | Part name, sale price, quantity, min quantity, unit. Owner/Manager add. |
| **InventoryMovement** | Stock in/out/sale; refType (booking_completion \| manual), refId. |
| **PartSale** | On job completion: bookingId, inventoryItemId, quantity, unitPrice. Deducts stock; not in salary pool. |
| **DayClose** | One per calendar day. All amounts SNAPSHOT (no live recalc). Includes part sales total and owner dividend from parts. |
| **DayCloseMaster** | Masters present that day: dayCloseId, userId, shareAmount (snapshot). |
| **Reminder** | Title, priority, status (active \| done), optional link to inventory. |
| **WhatsAppInbound** | Webhook-fed: phone, name?, lastMessage, lastMessageAt. No Client until serviced. |
| **Settings** | Key-value or single config: working hours, box count, manager/masters/owner %, Kaspi %, charity %, round charity to 1000. |

### 1.2 Relations (no duplication)

- **Booking** belongs to optional Client (if existing), references VehicleCatalog; has many BookingService; one execution (fields on Booking).
- **Client** created/updated after Booking status = completed; has visit history via Bookings.
- **Warranty** references Client, Booking, ServiceCatalog; one row per (booking, service) selected for warranty.
- **PartSale** references Booking, InventoryItem; creates InventoryMovement(s) and reduces InventoryItem.quantity.
- **DayClose** has many DayCloseMaster; amounts are stored numbers, not formulas.
- **Analytics** reads: completed Bookings + DayClose rows only (no raw recalculation).

### 1.3 What Worker cannot change

- Booking: date, startTime, endTime, boxId, clientName, phone, vehicleCatalogId, bodyType, plateNumber, BookingService lines.
- Worker can: set status (arrived → in_progress → completed \| no_show), startedAt, completedAt, servicePaymentAmount, paymentType, materialExpense, PartSales; trigger Client create/update and Warranty creation.

---

## STEP 2 — Database Schema V1

### 2.1 user

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| phone | string, unique | ✓ | Login |
| password_hash | string | ✓ | |
| role | enum(owner, manager, worker) | ✓ | |
| display_name | string | ✓ | |
| is_senior_worker | boolean | — | Default false; day close allowed |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

*Future: tenant_id.*

### 2.2 client

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| name | string | ✓ | |
| phone | string | ✓ | |
| source | enum(whatsapp, live) | ✓ | |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

*Created when first booking is completed.*

### 2.3 vehicle_catalog

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| name | string | ✓ | e.g. Toyota Alphard |
| body_type | string | ✓ | e.g. 20 кузов |
| year | int | — | Optional |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

### 2.4 booking

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| client_id | UUID/FK → client | — | Set when linking existing client |
| client_name | string | ✓ | Denormalized for display |
| phone | string | ✓ | |
| source | enum(whatsapp, live) | ✓ | |
| vehicle_catalog_id | UUID/FK | ✓ | |
| body_type | string | ✓ | |
| plate_number | string | — | Free text |
| box_id | int (1 or 2) | ✓ | |
| date | date | ✓ | |
| start_time | time | ✓ | |
| end_time | time | ✓ | 10:00–18:00 |
| status | enum(planned, arrived, in_progress, completed, no_show) | ✓ | |
| assigned_master_id | UUID/FK → user | — | |
| note | text | — | |
| started_at | timestamp | — | Set when Worker starts |
| completed_at | timestamp | — | Set when Worker finishes |
| service_payment_amount | decimal | — | Filled on completion |
| payment_type | enum(kaspipay, cash, mixed) | — | |
| material_expense | decimal | — | |
| kaspi_tax_amount | decimal | — | 4% of Kaspi part only |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

*Worker must not update: client_name, phone, vehicle_catalog_id, body_type, plate_number, box_id, date, start_time, end_time, or booking_service rows.*

### 2.5 booking_service

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| booking_id | UUID/FK → booking | ✓ | |
| service_catalog_id | UUID/FK | ✓ | |
| quantity | int (1 or 2) | ✓ | |
| created_at | timestamp | ✓ | |

### 2.6 service_category

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| name | string | ✓ | |
| sort_order | int | — | |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

### 2.7 service_catalog

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| category_id | UUID/FK → service_category | — | |
| name | string | ✓ | |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

### 2.8 warranty

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| client_id | UUID/FK → client | ✓ | |
| booking_id | UUID/FK → booking | ✓ | Performed instance |
| service_catalog_id | UUID/FK | ✓ | Which service |
| completed_at | timestamp | ✓ | From booking.completed_at |
| expires_at | date | ✓ | completed_at + 3 months |
| created_at | timestamp | ✓ | |

*One row per (booking, service) that gets warranty.*

### 2.9 inventory_item

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| name | string | ✓ | |
| sku | string | — | |
| sale_price | decimal | ✓ | |
| quantity | int | ✓ | |
| min_quantity | int | — | Low-stock alert |
| unit | string | — | e.g. дана |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

### 2.10 inventory_movement

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| item_id | UUID/FK → inventory_item | ✓ | |
| type | enum(in, out, sale) | ✓ | |
| quantity | int | ✓ | Positive for in, negative or stored as positive with type for out/sale |
| amount | decimal | — | For sale: total value |
| ref_type | enum(booking_completion, manual) | ✓ | |
| ref_id | UUID | — | booking_id or null |
| created_at | timestamp | ✓ | |

### 2.11 part_sale

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| booking_id | UUID/FK → booking | ✓ | |
| inventory_item_id | UUID/FK | ✓ | |
| quantity | int | ✓ | |
| unit_price | decimal | ✓ | From item at time of sale |
| created_at | timestamp | ✓ | |

*Creates inventory_movement (sale) and decrements inventory_item.quantity.*

### 2.12 day_close

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| date | date | ✓ | Unique per day |
| closed_by_id | UUID/FK → user | ✓ | |
| closed_at | timestamp | ✓ | |
| service_income_snapshot | decimal | ✓ | Sum of completed bookings’ service_payment_amount that day |
| part_sales_snapshot | decimal | ✓ | Sum of part_sale for that day (excluded from salary pool) |
| material_expense_snapshot | decimal | ✓ | Sum of booking material_expense that day |
| lunch_expense_snapshot | decimal | ✓ | Manual input |
| transport_expense_snapshot | decimal | ✓ | Manual input |
| rent_expense_snapshot | decimal | ✓ | Manual input |
| kaspi_tax_snapshot | decimal | ✓ | 4% of Kaspi portion only |
| charity_amount_snapshot | decimal | ✓ | 10% of (service_income - expenses), rounded to 1000 |
| distributable_amount_snapshot | decimal | ✓ | After charity |
| manager_amount_snapshot | decimal | ✓ | 8% of distributable |
| owner_amount_snapshot | decimal | ✓ | 40% of remainder; salary pool only |
| part_sales_owner_snapshot | decimal | ✓ | Part sales go to owner dividend only |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

*All amounts stored at close time. No live recalculation.*

### 2.13 day_close_master

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| day_close_id | UUID/FK → day_close | ✓ | |
| user_id | UUID/FK → user | ✓ | Master present |
| share_amount_snapshot | decimal | ✓ | Equal split of 60% among present masters |
| created_at | timestamp | ✓ | |

### 2.14 reminder

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| title | string | ✓ | |
| priority | enum(high, medium, low) | ✓ | |
| created_by_id | UUID/FK → user | — | |
| status | enum(active, done) | ✓ | |
| due_at | timestamp | — | |
| link_type | string | — | e.g. inventory |
| link_id | UUID | — | |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

### 2.15 whatsapp_inbound

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| id | UUID/PK | ✓ | |
| phone | string | ✓ | |
| name | string | — | |
| last_message | text | — | |
| last_message_at | timestamp | — | |
| created_at | timestamp | ✓ | |
| updated_at | timestamp | ✓ | |

*Upserted by webhook. No client_id; client created only after booking completed.*

### 2.16 settings

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| key | string/PK | ✓ | e.g. working_hours_start |
| value | text/json | ✓ | |
| updated_at | timestamp | ✓ | |

*Or single row with JSON config. Keys: working_hours_start, working_hours_end, box_count, manager_percent, masters_percent, owner_percent, kaspi_tax_percent, charity_percent, round_charity_to_nearest_1000.*

---

## STEP 3 — System Modules

| Module | Scope | Main entities | Owner role |
|--------|--------|----------------|------------|
| **Auth & roles** | Login, session, role guard, senior worker flag | user | — |
| **Calendar** | Day/week view, 2 boxes, 10:00–18:00, booking cards, filters | booking, booking_service, vehicle_catalog, user | View all; Worker can filter by box |
| **Booking (CRUD)** | Add/Edit booking wizard; structure only | booking, booking_service, client, vehicle_catalog, service_catalog | Owner, Manager create/edit; Worker no access |
| **Booking execution** | Start → In progress → Finish; payment entry; PartSale | booking, part_sale, inventory_item, inventory_movement | Worker (and Owner as backup) |
| **Clients** | Auto-create after completion; visit history; warranty selection | client, booking, warranty | Read all; create/update by system |
| **Warranty** | 3 months per service; tied to booking + service line | warranty, booking, booking_service | Worker chooses which services get warranty |
| **Inventory** | List, add/remove stock, low-stock; PartSale on completion | inventory_item, inventory_movement, part_sale | Owner/Manager add items and adjust stock; Worker only PartSale at completion |
| **Day close** | Snapshot income/expenses; run financial engine; store snapshot; masters present | day_close, day_close_master, settings | Senior Worker or Owner |
| **Reminders** | List, filter (all/active/done), create, complete, link to inventory | reminder | All roles |
| **Analytics** | Day/Week/Month from DayClose + completed bookings only | day_close, booking (completed) | Owner only |
| **WhatsApp** | Inbound list; "Жазба қосу" with prefill; no client until serviced | whatsapp_inbound, booking | Owner, Manager |
| **Settings** | Working hours, box count, %, catalogs (services, vehicles), masters list | settings, service_catalog, service_category, vehicle_catalog, user | Owner only |

---

## STEP 4 — Backend Implementation Plan (order)

1. **Project + DB**  
   - Repo structure, DB (e.g. PostgreSQL), migrations, env.  
   - Optional: tenant_id on all tables (constant for MVP).

2. **Auth & users**  
   - user table, password hash, JWT or session; middleware role + isSeniorWorker.  
   - Seed: one owner.

3. **Settings**  
   - settings table, CRUD by key; default config (10:00, 18:00, 2 boxes, 8/60/40, 4%, 10%, round 1000).  
   - Used by DayClose and validation.

4. **Catalogs**  
   - vehicle_catalog, service_category, service_catalog. CRUD (Owner only).  
   - Used by Booking wizard and completion.

5. **Bookings (structure)**  
   - booking + booking_service; validation (time 10:00–18:00, box conflict).  
   - API: list by date/box, get by id, create, update (Manager/Owner only).  
   - Worker: no create/update of structure; only execution endpoints.

6. **Booking execution**  
   - PATCH booking: status → arrived \| in_progress \| completed \| no_show; started_at, completed_at; service_payment_amount, payment_type, material_expense, kaspi_tax_amount.  
   - PartSale: create part_sale, decrement inventory_item, create inventory_movement.  
   - On status=completed: create/update Client; create Warranty rows for selected services (3 months).

7. **Clients**  
   - client: create when first booking completed; update name/phone from booking if needed.  
   - API: list, get by id, get history (bookings) — for future client profile screen.

8. **Warranty**  
   - warranty: create on completion per (booking_id, service_catalog_id) when Worker selects.  
   - API: list by client or by booking.

9. **Inventory**  
   - inventory_item: CRUD (Owner/Manager).  
   - inventory_movement: list by item; manual in/out.  
   - part_sale: created only from booking completion (see 6).

10. **Day close**  
    - Financial engine (see STEP 6): compute all amounts, then INSERT day_close + day_close_master with snapshot values.  
    - API: create DayClose (Senior Worker/Owner), get by date, list.

11. **Reminders**  
    - reminder: CRUD; filter by status.  
    - API: list (all/active/done), create, update status, optional link.

12. **Analytics**  
    - Read-only: aggregate from day_close + completed bookings for period (day/week/month).  
    - No write; no recalculation from raw transactions.

13. **WhatsApp webhook**  
    - POST endpoint: receive payload, upsert whatsapp_inbound (phone, name?, last_message, last_message_at).  
    - API: list inbound; "Жазба қосу" uses phone/name as prefill only (no client creation).

14. **PWA / static**  
    - Serve SPA, manifest, service worker.  
    - Optional: offline cache for calendar/inventory/reminders.

---

## STEP 5 — Frontend Integration Plan (screens ↔ entities/actions)

| Screen (code reference) | Route / area | Entities / API | Actions |
|-------------------------|--------------|----------------|---------|
| **Login** (code.html) | /login | user (auth) | POST login → token/session; store role, isSeniorWorker |
| **Calendar Day** (code(4), code(21)) | /calendar | booking, booking_service, vehicle_catalog, user | GET bookings by date; open booking detail; role-based nav |
| **Calendar Week** | /calendar?view=week | Same | GET bookings for week |
| **Add Booking – Client** (code(13), code(14)) | /booking/add | client?, whatsapp_inbound | List WhatsApp recent; list clients; or new (name, phone); source |
| **Add Booking – Car** (code(12)) | /booking/add | vehicle_catalog | List vehicles; select |
| **Add Booking – Body** (code(11)) | /booking/add | vehicle_catalog.body_type | Select body |
| **Add Booking – Plate** (code(10)) | /booking/add | — | Free text plate_number |
| **Add Booking – Service & time** (code(8), code(9)) | /booking/add | service_catalog, booking | Select services (qty 1/2), box, date, start_time, duration → end_time; validate 10–18, conflict |
| **Add Booking – Note** (code(6)) | /booking/add | booking.note | Optional note |
| **Booking summary** (code(7)) | /booking/add | booking, booking_service | Submit create booking |
| **Booking detail (start)** (code(20)) | /booking/:id | booking, booking_service, vehicle_catalog | Show structure; "Жұмысты бастау" → PATCH status=in_progress, started_at |
| **Work in progress** (code(19)) | /booking/:id | booking | Timer from started_at; "Жұмысты аяқтау" → go to payment |
| **Payment entry** (code(17), code(18)) | /booking/:id/payment | booking, inventory_item | Enter service amount, payment type (Kaspi/Cash/Mixed); material; add PartSales (select item, qty, price); submit → PATCH booking completion, create part_sale, client, warranty |
| **Job completed** (code(15), code(16)) | /booking/:id/done | — | Success screen; navigate to calendar |
| **Shift close** (code(1)) | /day-close | day_close, day_close_master, user, settings | Select date; load or compute snapshot (service income, parts, expenses, Kaspi tax, charity, split); "Ауысымда кім болды" toggles; submit → POST day_close (snapshot stored) |
| **Inventory list** (code(5)) | /inventory | inventory_item | List; filter/search; low-stock highlight |
| **Inventory add modal** (code(5), code(4) sheet) | /inventory | inventory_item, inventory_movement | Add quantity (modal); optional history (inventory_movement) |
| **Inventory remove** (code(5)) | /inventory | inventory_item, inventory_movement | Decrement; long-press bulk; movement type out |
| **Reminders** (code(3)) | /reminders | reminder | List; tabs All/Active/Done; create; mark done; "Қоймаға өту" link |
| **Settings** (code(2)) | /settings | user, settings, service_catalog, service_category, vehicle_catalog | Roles %; shift toggles (for Day Close); working hours; financial params; service catalog; vehicle catalog; masters (users with role worker) |
| **Analytics** | /analytics | day_close, booking (completed) | Period selector; cards: service income, part sales, material, net, avg check, avg daily, vehicle count, salary breakdown, owner dividends |
| **WhatsApp list** | /whatsapp | whatsapp_inbound | List; "Жазба қосу" → /booking/add?phone=…&name=… |

*Role guards: hide or disable Add Booking, Settings (full), Analytics, WhatsApp for Worker; disable Day Close for non–Senior Worker / non-Owner.*

---

## STEP 6 — Financial Engine Logic Plan (DayClose)

Runs once at "Ауысымды жабу"; all results stored as snapshot. No live recalculation from DayClose screen afterwards.

### 6.1 Inputs (for selected date)

- **From DB:**  
  - Bookings with status = completed and date = selected date: service_payment_amount, material_expense, payment_type, kaspi_tax_amount; PartSales for that day (sum by booking_id in part_sale where booking.date = date).  
- **From UI (manual):**  
  - Lunch, transport, rent (if not stored elsewhere).  
- **From Settings:**  
  - manager_percent, masters_percent, owner_percent, kaspi_tax_percent (4), charity_percent (10), round_charity_to_nearest_1000 (1000).  
- **From UI:**  
  - List of masters "present" (user ids) for that day.

### 6.2 Step-by-step calculation

1. **Service income (snapshot)**  
   Sum of `booking.service_payment_amount` for completed bookings on that date.

2. **Part sales (snapshot)**  
   Sum of `part_sale.quantity * part_sale.unit_price` for all part_sales whose booking has that date and status completed.  
   **Do not** add this to salary pool. Store separately for owner dividend.

3. **Material expense (snapshot)**  
   Sum of `booking.material_expense` for completed bookings on that date.

4. **Operational expenses (snapshot)**  
   Lunch + transport + rent (user input). Sum = total_opex.

5. **Net service income (for distribution)**  
   `net_service = service_income_snapshot - material_expense_snapshot - total_opex`.  
   (Part sales are not in this formula.)

6. **Kaspi tax (snapshot)**  
   Already stored per booking (4% of Kaspi portion). Sum for the day = `kaspi_tax_snapshot`.  
   Optional: subtract from net or from Kaspi portion before net—clarify with product; typically net is after tax, so: `net_after_tax = net_service - kaspi_tax_snapshot`.

7. **Charity (snapshot)**  
   `charity_raw = net_after_tax * (charity_percent / 100)`.  
   Round to nearest 1000 (math round: e.g. 6780 → 7000).  
   `charity_amount_snapshot = round(charity_raw / 1000) * 1000`.

8. **Distributable amount (snapshot)**  
   `distributable_amount_snapshot = net_after_tax - charity_amount_snapshot`.

9. **Manager (snapshot)**  
   `manager_amount_snapshot = distributable_amount_snapshot * (manager_percent / 100)`.

10. **Remainder after manager**  
    `remainder = distributable_amount_snapshot - manager_amount_snapshot`.

11. **Masters share (total)**  
    `masters_total = remainder * (masters_percent / 100)`.  
    Split **equally** among users marked "present" (day_close_master rows).  
    If N present: `share_amount_snapshot = masters_total / N` per master.

12. **Owner from salary pool (snapshot)**  
    `owner_amount_snapshot = remainder * (owner_percent / 100)`.

13. **Owner from part sales (snapshot)**  
    `part_sales_owner_snapshot = part_sales_snapshot` (all part sales for the day go to owner dividend only).

14. **Persist**  
    INSERT `day_close` with all *_snapshot fields; INSERT `day_close_master` for each present master with `share_amount_snapshot`.  
    Do not store formulas; only final numbers.

### 6.3 Edge cases

- No completed bookings: service_income_snapshot = 0; part_sales_snapshot can still be 0 or from any part_sale tied to that date if business rule allows.  
- No masters present: masters_total = 0; owner_amount_snapshot = remainder (100% of remainder after manager).  
- Editing day close: if allowed, treat as rare; reload snapshot from DB and show; any edit re-runs engine and overwrites snapshot.

---

## STEP 7 — Webhook Processing Plan (WhatsApp)

### 7.1 Endpoint

- **POST** `/api/webhooks/whatsapp` (or path agreed with Chatflow).  
- Verify secret/token if provided by Chatflow.  
- Idempotent: same phone + last_message_at can be deduplicated if needed.

### 7.2 Payload (assumed from Chatflow)

- At least: phone (normalized), optional name, last_message text, last_message_at (or timestamp).  
- Map to: phone, name, last_message, last_message_at.

### 7.3 Processing

1. Normalize phone (e.g. E.164).  
2. Upsert `whatsapp_inbound`: match by phone; update name, last_message, last_message_at, updated_at. If no row, INSERT.  
3. Do **not** create or update `client`. Client is created only when a booking is completed (first visit).  
4. Return 200 quickly; no heavy work.

### 7.4 PWA usage

- **WhatsApp list screen:** GET `/api/whatsapp-inbound` (or similar). Show phone, name, last_message, last_message_at.  
- **"Жазба қосу" on a row:** Open Add Booking wizard with phone (and name if any) prefilled; source = whatsapp. Still no client until booking is completed.

### 7.5 Future

- Multi-tenant: webhook may include tenant_id or channel id; store and scope whatsapp_inbound by tenant.

---

## STEP 8 — Development Roadmap (Phases)

### Phase 1 — Auth + Roles

- **Backend:** user table, register/login (phone + password), JWT or session; middleware auth + role (owner/manager/worker) + isSeniorWorker. Seed owner.  
- **Frontend:** Login screen (code.html); store token and role; redirect by role; bottom nav visibility by role.  
- **Logic:** Role guard helper; no Booking/Inventory edit for Worker.

**Deliverable:** Login, role-based shell, no booking/inventory/settings for Worker yet.

---

### Phase 2 — Booking System

- **Backend:** settings (defaults), vehicle_catalog, service_category, service_catalog CRUD; booking + booking_service create/update/list by date/box; validation 10:00–18:00 and box conflict.  
- **Frontend:** Add Booking wizard (code(13)→(14), code(12), code(11), code(10), code(8)/code(9), code(6), code(7)); Calendar day view (code(4)/code(21)) with booking cards; GET bookings for date.  
- **Logic:** Wizard state; submit booking with BookingService lines; only Owner/Manager can open wizard and edit.

**Deliverable:** Calendar with day view, Add Booking full flow, no execution yet.

---

### Phase 3 — Worker Execution

- **Backend:** PATCH booking (status, started_at, completed_at, service_payment_amount, payment_type, material_expense, kaspi_tax_amount); PartSale create + inventory decrement + inventory_movement; on completion create/update Client and Warranty rows.  
- **Frontend:** Booking detail (code(20)) → Start → Work in progress (code(19)) → Payment (code(17), code(18)) → Success (code(15)/code(16)). Worker-only execution UI; Worker cannot change time/services/vehicle.  
- **Logic:** Client create/update rules; warranty 3 months from completed_at per selected service.

**Deliverable:** Start job, in-progress timer, finish with payment and parts, client and warranty created.

---

### Phase 4 — Inventory

- **Backend:** inventory_item CRUD (Owner/Manager); inventory_movement for manual in/out; PartSale already in Phase 3.  
- **Frontend:** Inventory list (code(5)); add-stock modal; remove (and long-press bulk); movement history if needed.  
- **Logic:** Low-stock (quantity &lt; min_quantity); PartSale deducts quantity and writes movement.

**Deliverable:** Full inventory for Owner/Manager; Worker only uses inventory inside Payment screen.

---

### Phase 5 — Day Close Engine

- **Backend:** Financial engine (STEP 6) as service; INSERT day_close + day_close_master with snapshots; GET day_close by date; list.  
- **Frontend:** Day close screen (code(1)); date picker; load or compute snapshot; input expenses; "Ауысымда кім болды" toggles; submit.  
- **Logic:** All snapshot; no recalculation after save; Senior Worker or Owner only.

**Deliverable:** Close day with correct salary/distribution and part sales to owner only.

---

### Phase 6 — Clients + Warranty

- **Backend:** client API (list, get, history); warranty list by client or booking.  
- **Frontend:** Client profile screen (optional in MVP): visits, services, warranties. Warranty selection in Payment/Finish flow (which services get 3 months).  
- **Logic:** Client created in Phase 3; warranty tied to (booking_id, service_catalog_id); expiry = completed_at + 3 months.

**Deliverable:** Client and warranty data correct; optional profile UI.

---

### Phase 7 — Analytics

- **Backend:** Read-only analytics API: period (day/week/month); aggregate from day_close + completed bookings (service income, part sales, material, net, avg check, avg daily, vehicle count, salary from day_close, owner dividends).  
- **Frontend:** Analytics screen (no code reference): period selector, cards in simple Kazakh.  
- **Logic:** No raw recalculation; use day_close snapshots and completed booking totals only.

**Deliverable:** Owner analytics from snapshots only.

---

### Phase 8 — WhatsApp Integration

- **Backend:** Webhook endpoint (STEP 7); whatsapp_inbound upsert; GET list.  
- **Frontend:** WhatsApp list screen; "Жазба қосу" opens wizard with phone/name prefill.  
- **Logic:** No client creation from WhatsApp; client only after completed booking.

**Deliverable:** Inbound list and prefill for booking; webhook live.

---

### Phase 9 — Settings

- **Backend:** settings CRUD; vehicle_catalog, service_catalog, service_category CRUD; user list for masters (workers) and is_senior_worker.  
- **Frontend:** Full Settings screen (code(2)): roles %, shift toggles (for Day Close), working hours, financial params, service catalog, vehicle catalog, masters.  
- **Logic:** Defaults; validation (e.g. manager + masters + owner = 100%).

**Deliverable:** Owner can configure all operational and financial params.

---

## Summary

- **Entity model:** Single Booking entity (structure + execution); no Job table; Warranty per (booking, service); DayClose and DayCloseMaster with snapshot-only amounts; PartSale for inventory and owner dividend.  
- **Schema:** As in STEP 2; required fields and relations defined.  
- **Modules:** Auth, Calendar, Booking, Execution, Clients, Warranty, Inventory, Day Close, Reminders, Analytics, WhatsApp, Settings.  
- **Backend order:** Auth → Settings → Catalogs → Bookings → Execution → Clients/Warranty → Inventory → Day Close → Reminders → Analytics → Webhook → PWA serve.  
- **Frontend:** Each Stitch screen mapped to route, entities, and actions; role-based visibility.  
- **Financial engine:** Fixed step sequence; all results stored as snapshots in day_close and day_close_master.  
- **Webhook:** Upsert whatsapp_inbound only; no client until booking completed.  
- **Roadmap:** 9 phases from Auth through Settings; each with backend, frontend, and logic tasks.

After this plan is approved, implementation can proceed phase by phase without changing the high-level architecture.
