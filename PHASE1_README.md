# Phase 1 — Auth + Roles

## Run instructions

### 1. Database (PostgreSQL)

Create a database:

```bash
createdb sailau_avto
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DB_URL and JWT_SECRET
npm install
npm run migrate
npm run seed
npm run dev
```

Default seed owner: phone `+77001234567`, password `owner123`. Override with `SEED_OWNER_PHONE` and `SEED_OWNER_PASSWORD`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Log in with the seed owner. You should see the bottom nav (Күнтізбе, Жазба қосу, Қойма, Ескертпелер, Баптаулар). As owner you see all five; Worker would see only Күнтізбе, Қойма, Ескертпелер.

## Deliverable

- User can log in (POST /api/auth/login).
- Token and user (role, is_senior_worker) stored; GET /api/auth/me for refresh.
- Unauthenticated users are redirected to /login.
- Role-based nav: Add Booking and Settings only for allowed roles (owner/manager and owner respectively).
- Placeholder screens for Calendar, Add Booking, Inventory, Reminders, Settings.
