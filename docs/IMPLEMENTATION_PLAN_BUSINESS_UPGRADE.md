# IMPLEMENTATION PLAN: Business Logic Upgrade (Phase 11+)

## Что понято

1. **Услуги (Service):** Владелец добавляет услуги с категорией, опциональной подгруппой, привязкой к моделям авто и типам кузова. В AddBooking список услуг фильтруется по выбранной машине.
2. **Inventory:** Owner/Manager может удалять запчасть — нужен `DELETE /api/inventory/:id`.
3. **DayClose — пул мастеров:** По умолчанию деление поровну; Owner/Senior может включить ручное распределение %; UI: редактируемые проценты, сумма 100%, авто-пересчёт.
4. **Charity:** Если `net_before_charity < 10000` → `charity = 0`.
5. **DayClose:** Несколько отчётов за один день; `date` больше не уникален; добавить `day_close.shift_index`.
6. **Kaspi/Cash:** Kaspi + Cash ≤ service_income + part_sales_total; Kaspi_tax считается с (service_income + part_sales); part_sales не участвует в зарплате (уже: owner_parts_dividend отдельно, masters pool из remainder после manager — остаётся уточнить, что в distributable только service).
7. **Booking:** Сохранять `duration_minutes`.
8. **Booking:** Несколько мастеров на одну запись — `booking_master[]`.
9. **Warranty:** Добавить `master_user_id`.
10. **AddBooking:** Услуга может быть с `warranty_mode = true` → цена 0.
11. **Analytics:** Добавить `warranty_jobs_count`.
12. **Client:** Поиск; сохранять авто и номер; при новой записи — автозаполнение.
13. **Time tracking / Productivity:** started_at, completed_at, duration на экране Complete; backend считает duration_minutes при complete; аналитика «Өнімділік (Шеберлер)»: jobs_count, avg/sum duration, drill-down.

---

## Затрагиваемые модули

| Модуль | Затронуто |
|--------|-----------|
| **service_catalog** | category (есть), subgroup (есть 016), applicable_to_vehicle_models[], applicable_to_body_types[], warranty_mode |
| **booking** | duration_minutes, несколько мастеров (booking_master) |
| **booking_service** | warranty_mode (флаг «по гарантии» по строке) |
| **warranty** | master_user_id |
| **day_close** | shift_index, несколько смен в день; ручное распределение % мастеров |
| **day_close_master** | percent (при ручном режиме) |
| **settings** | manual_master_distribution (или в day_close) |
| **client** | поиск (name/phone), last_vehicle_name, last_plate_number (автозаполнение) |
| **inventory** | DELETE /api/inventory/:id (Owner/Manager) |
| **executionService** | startBooking/completeBooking: started_at, completed_at, duration_minutes; 400 если без старта |
| **dayCloseService** | charity = 0 при net_before_charity < 10000; Kaspi+Cash ≤ service_income+part_sales; kaspi_tax с (service_income+part_sales); part_sales не в зарплату; shift_index; ручные % мастеров |
| **analyticsService** | warranty_jobs_count; блок «Өнімділік» по мастерам (jobs_count, avg/sum duration, drill-down) |
| **Frontend: AddBooking** | фильтр услуг по машине; выбор warranty_mode по услуге (цена 0); несколько мастеров |
| **Frontend: PaymentEntry/Complete** | read-only блок время старта/финиша, duration |
| **Frontend: DayClose** | несколько смен за день; переключатель ручного %; проценты по мастерам, сумма 100% |
| **Frontend: Clients** | поиск; сохранение авто/номера; автозаполнение при новой записи |
| **Frontend: Inventory** | кнопка удаления запчасти (Owner/Manager) |
| **Frontend: Analytics** | warranty_jobs_count; блок «Өнімділік (Шеберлер)» |

---

## Новые таблицы и поля

### Таблицы
- **booking_master** — связь многие-ко-многим: booking_id, master_user_id (UNIQUE(booking_id, master_user_id)).

### Новые/изменённые поля
- **service_catalog:** `applicable_to_vehicle_models UUID[]` (или TEXT[] — id моделей из vehicle_catalog), `applicable_to_body_types TEXT[]`, `warranty_mode BOOLEAN DEFAULT false`.
- **booking:** `duration_minutes INT NULL`.
- **warranty:** `master_user_id UUID NULL REFERENCES "user"(id)`.
- **day_close:** `shift_index INT NOT NULL DEFAULT 0`. Уникальность: (service_id, date, shift_index).
- **day_close_master:** `percent DECIMAL(5,2) NULL` (при ручном распределении).
- **settings:** `manual_master_distribution BOOLEAN DEFAULT false` (или ключ в существующей key-value).
- **client:** `last_vehicle_name VARCHAR(255)`, `last_plate_number VARCHAR(50)` (для автозаполнения).
- **booking_service:** `warranty_mode BOOLEAN DEFAULT false` (по строке: эта услуга по гарантии → цена 0).

---

## Миграции (порядок)

1. **029_booking_duration_master_warranty_client**  
   - booking.duration_minutes INT NULL  
   - booking_master (booking_id, master_user_id), UNIQUE  
   - warranty.master_user_id UUID NULL  
   - client.last_vehicle_name, client.last_plate_number  

2. **030_day_close_shift_index**  
   - day_close.shift_index INT NOT NULL DEFAULT 0  
   - DROP unique(service_id, date), ADD UNIQUE(service_id, date, shift_index)  

3. **031_day_close_master_percent**  
   - day_close_master.percent DECIMAL(5,2) NULL  

4. **032_service_catalog_applicable_warranty**  
   - service_catalog.applicable_to_vehicle_models UUID[], applicable_to_body_types TEXT[], warranty_mode BOOLEAN DEFAULT false  

5. **033_booking_service_warranty_mode**  
   - booking_service.warranty_mode BOOLEAN DEFAULT false  

6. **034_settings_manual_master_distribution**  
   - settings: ключ manual_master_distribution (или отдельная колонка в другой таблице; у нас settings key-value — просто новый ключ)  

Миграции 034 не нужна отдельно — settings уже key-value, добавим ключ в сид или при первом использовании.

---

## Разбивка по фазам

### Phase 11 — Time tracking: duration_minutes, start/complete, UI (read-only блок)
- **DB:** Миграция: `booking.duration_minutes INT NULL`.
- **Backend:** В `completeBooking`: выставить `completed_at = now()`, `duration_minutes = floor((completed_at - started_at) / 60)`. Если `started_at` NULL → 400. Worker не может подменять duration.
- **API:** Без изменений контрактов; в ответе booking появятся `started_at`, `completed_at`, `duration_minutes`.
- **Frontend:** Экран PaymentEntry/Complete: read-only блок «started_at (HH:MM), completed_at (HH:MM), duration (X сағ Y мин)».
- **Analytics:** Пока без изменений.

---

### Phase 12 — Inventory DELETE + Client search & autofill
- **DB:** Без новых миграций (client поля в 029).
- **Backend:** `DELETE /api/inventory/:id` — право Owner/Manager; проверка service_id; каскад или запрет при наличии part_sale/inventory_movement (решить: мягкое удаление или запрет).
- **API:** DELETE /api/inventory/:id.
- **Frontend:** Кнопка удаления запчасти (Owner/Manager), подтверждение.
- **Client:** Backend: GET /api/clients?search= — поиск по name/phone; при создании/обновлении клиента или при завершении брони — сохранять last_vehicle_name, last_plate_number. Frontend: поиск в AddBooking; автозаполнение авто/номера из клиента.

---

### Phase 13 — DayClose: несколько смен (shift_index), charity < 10k, Kaspi/Cash правила
- **DB:** Миграция 030 (day_close.shift_index, unique(service_id, date, shift_index)).
- **Backend:**  
  - При создании DayClose: если смена за date уже есть, создавать с shift_index = next.  
  - Charity: если net_before_charity < 10000 → charity_rounded = 0, charity_raw = 0.  
  - Kaspi + Cash ≤ service_income_total + part_sales_total.  
  - Kaspi_tax считать с (service_income_total + part_sales_total).  
  - Part_sales не участвуют в зарплате (masters_pool и manager только от service; owner_parts_dividend уже отдельно).
- **API:** Создание/получение day_close по (date, shift_index) или по id.
- **Frontend:** Выбор смены за день или «вторая смена»; список отчётов за день.
- **Analytics:** Учёт нескольких day_close за один день при агрегации.

---

### Phase 14 — DayClose: ручное распределение % мастеров
- **DB:** Миграция 031 (day_close_master.percent).
- **Settings:** Ключ manual_master_distribution (true/false).
- **Backend:** При manual_master_distribution: payload содержит master_percents: [{ master_user_id, percent }], сумма = 100%; amount = masters_pool_amount * percent / 100. Иначе — поровну как сейчас.
- **API:** PATCH/POST day_close с master_percents при ручном режиме.
- **Frontend:** Переключатель «ручное распределение»; поля % по каждому мастеру; авто-пересчёт сумм; валидация суммы 100%.

---

### Phase 15 — Service catalog: applicable + warranty_mode; AddBooking фильтр и цена 0
- **DB:** Миграции 032, 033 (service_catalog applicable + warranty_mode; booking_service.warranty_mode).
- **Backend:** CRUD услуг с полями category, subgroup, applicable_to_vehicle_models, applicable_to_body_types, warranty_mode. При выдаче списка услуг для AddBooking — фильтр по vehicle_catalog_id/body_type. При расчёте суммы брони: строка с warranty_mode = true → 0.
- **API:** GET /api/catalogs/services?vehicle_catalog_id=… (или в теле брони); создание/редактирование услуг (Owner).
- **Frontend:** AddBooking: после выбора машины — фильтрованный список услуг; чекбокс «по гарантии» по услуге → цена 0.

---

### Phase 16 — Booking: несколько мастеров (booking_master)
- **DB:** Таблица booking_master (миграция 029).
- **Backend:** При создании/обновлении брони — сохранять список master_user_id в booking_master. assigned_master_id можно оставить для «основного» или убрать позже; в отчётах и аналитике учитывать всех из booking_master.
- **API:** Booking create/update: masters: [{ user_id }] или master_user_ids: [].
- **Frontend:** AddBooking / редактирование: мульти-выбор мастеров.
- **Analytics/DayClose:** При распределении пула мастеров учитывать booking_master (кто работал по каким бронированиям).

---

### Phase 17 — Warranty: master_user_id + Analytics warranty_jobs_count
- **DB:** warranty.master_user_id (миграция 029).
- **Backend:** При создании warranty (completeBooking) записывать master_user_id (из текущего мастера или из booking_master). GET warranty — возвращать master_user_id / master_name.
- **API:** Без ломающих изменений.
- **Frontend:** В карточке гарантии показывать мастера.
- **Analytics:** Добавить warranty_jobs_count в сводку; источник — warranty по периоду.

---

### Phase 18 — Productivity analytics «Өнімділік (Шеберлер)»
- **DB:** Уже есть booking.duration_minutes, booking_master.
- **Backend:** Новый блок в getSummary или отдельный endpoint: по периоду (day/week/month) для каждого master_user_id: jobs_count (completed bookings где мастер в booking_master), avg_duration_minutes, sum_duration_minutes, optional fastest_job, slowest_job. Drill-down: список завершённых работ по мастеру.
- **API:** В /api/analytics/summary добавить productivity: { masters: [{ master_user_id, master_name, jobs_count, avg_duration_minutes, sum_duration_minutes, … }] } + опция ?drill=master_user_id для списка работ.
- **Frontend:** Блок «Өнімділік (Шеберлер)»: таблица по мастерам; по клику — список завершённых работ.

---

## Ограничения (не делать)

- Не ломать существующую логику.
- Не пересчитывать DayClose задним числом.
- Не менять старые данные (новые поля — nullable или с default).

---

## Старт

После подтверждения плана начинается **Phase 11** (duration_minutes + логика start/complete + read-only блок времени на экране Complete).
