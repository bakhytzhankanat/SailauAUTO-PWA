# Деплой на Vercel

## 1. Бэкенд (API)

1. Зайди на [vercel.com](https://vercel.com), войди в аккаунт.
2. **Add New** → **Project** → импортируй репозиторий (или загрузи папку).
3. **Root Directory:** укажи **`backend`** (важно).
4. **Environment Variables** (настрой до деплоя):
   - `DB_URL` — твой connection string из Supabase (Session pooler, с подставленным паролем).
   - `JWT_SECRET` — любая длинная случайная строка (минимум 32 символа).
   - Остальное не обязательно для старта.
5. Нажми **Deploy**.
6. После деплоя скопируй URL проекта, например: `https://sailau-avto-api-xxx.vercel.app`. Проверь: открой в браузере `https://твой-url/api/health` — должен быть `{"ok":true}`.

---

## 2. Фронт (PWA)

1. В Vercel снова **Add New** → **Project** → тот же репозиторий (или отдельный репо с фронтом).
2. **Root Directory:** укажи **`frontend`**.
3. **Environment Variables:**
   - `VITE_API_URL` — URL бэкенда **без** слэша в конце, например: `https://sailau-avto-api-xxx.vercel.app`.
   - ⚠️ Если на телефоне при входе «Load failed» — проверь, что `VITE_API_URL` задан в проекте фронта и сделай **Redeploy** (переменные подставляются при сборке).
4. **Build Command:** `npm run build` (обычно подставляется автоматически).
5. **Output Directory:** `dist`.
6. Нажми **Deploy**.

После деплоя открой URL фронта — приложение должно ходить за данными на твой API.

---

## Если репо один (монорепо)

- Создаёшь **два** проекта в Vercel из одного репо: один с Root = `backend`, второй с Root = `frontend`. В первом задаёшь `DB_URL` и `JWT_SECRET`, во втором — `VITE_API_URL` = URL первого проекта.
