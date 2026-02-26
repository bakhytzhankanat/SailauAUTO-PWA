# Деплой SailauAUTO PWA на Render

Фронт и бэк — только на Render. Один репозиторий → два сервиса: **Backend** (Web Service) и **Frontend** (Static Site).

---

## 1. Репозиторий на GitHub

Подключи свой репозиторий (тот, что сделал под Render). Из папки проекта:

```bash
cd "c:\Users\kanazxz\Desktop\SailauAUTO PWA"
git remote add render https://github.com/ТВОЙ_ЛОГИН/ИМЯ_РЕПО.git
git push render main
```

Дальше в Render подключаешь этот репо к обоим сервисам.

---

## 2. Backend (API) на Render

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
2. **Connect a repository** → выбери свой репозиторий.
3. Настрой:
   - **Name:** `sailau-auto-pwa-backend`
   - **Region:** любой (например Frankfurt).
   - **Branch:** `main`
   - **Root Directory:** **`backend`** (обязательно).
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment Variables:**
   - `NODE_VERSION` = `20` (или 18)
   - `DB_URL` = connection string Supabase (PostgreSQL).
   - `JWT_SECRET` = длинная случайная строка (минимум 32 символа).
   - `CORS_ORIGIN` = URL фронта (заполнишь после деплоя фронта, например `https://sailau-auto-pwa-frontend.onrender.com`).
5. **Create Web Service**.

Проверка: открой `https://твой-бэкенд.onrender.com/api/health` — должен быть `{"ok":true}`.

---

## 3. Frontend (PWA) на Render

1. В Render: **New +** → **Static Site**.
2. Подключи **тот же** репозиторий.
3. Настрой:
   - **Name:** `sailau-auto-pwa-frontend`
   - **Branch:** `main`
   - **Root Directory:** **`frontend`**
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Environment Variables:**
   - **Key:** `VITE_API_URL`
   - **Value:** URL бэкенда **без** слэша, например: `https://sailau-auto-pwa-backend.onrender.com`
5. **Create Static Site**.

### Если стили не грузятся (MIME type / 404)

В Render открой свой **Static Site** → **Settings** (или вкладка с правилами):

**Redirects / Rewrites:** добавь правило (для SPA и маршрутов вроде `/login`):
- **Source:** `/*`
- **Destination:** `/index.html`
- **Action:** **Rewrite**

**Headers:** добавь заголовки, чтобы CSS/JS отдавались с правильным типом:
- Путь: `/**/*.css` → Header: `Content-Type`, Value: `text/css`
- Путь: `/**/*.js` → Header: `Content-Type`, Value: `application/javascript`

Сохрани и сделай **Manual Deploy** (или дождись следующего деплоя).

---

## 4. CORS

Когда фронт задеплоится, в Render → **sailau-auto-pwa-backend** → **Environment** задай:

- **CORS_ORIGIN** = `https://sailau-auto-pwa-frontend.onrender.com` (твой URL Static Site).

Сохрани — бэкенд перезапустится, логин с фронта будет работать.

---

## Кратко

| Сервис         | Root Directory | Start / Publish   |
|----------------|----------------|-------------------|
| Backend (API)  | `backend`      | `npm start`       |
| Frontend (PWA) | `frontend`     | Publish: `dist`   |

Локально: `npm run dev` в папках backend и frontend. Деплой: пушишь в репо → Render пересобирает.
