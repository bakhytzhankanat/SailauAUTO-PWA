import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { JWT_SECRET } from '../middleware/auth.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Normalize phone for lookup (strip spaces, keep digits and +).
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\s/g, '').trim();
}

/**
 * Login: phone + password -> { token, user }.
 * user: { id, phone, display_name, role, is_senior_worker }
 */
export async function login(phone, password) {
  const normalized = normalizePhone(phone);
  if (!normalized || !password) {
    return { error: 'Телефон және құпия сөз толтырылуы керек' };
  }
  const { rows } = await pool.query(
    'SELECT id, phone, display_name, role, is_senior_worker, service_id, password_hash, is_active FROM "user" WHERE phone = $1',
    [normalized]
  );
  if (rows.length === 0) {
    return { error: 'Телефон немесе құпия сөз дұрыс емес' };
  }
  const user = rows[0];
  if (user.is_active === false) {
    return { error: 'Аккаунт өшірілген' };
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return { error: 'Телефон немесе құпия сөз дұрыс емес' };
  }
  const token = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const { password_hash, ...safe } = user;
  return {
    token,
    user: {
      id: safe.id,
      phone: safe.phone,
      display_name: safe.display_name,
      role: safe.role,
      is_senior_worker: safe.is_senior_worker,
      service_id: safe.service_id ?? null,
    },
  };
}

/**
 * Get current user by id (for GET /api/auth/me).
 */
export async function getMe(userId) {
  const { rows } = await pool.query(
    'SELECT id, phone, display_name, role, is_senior_worker, service_id FROM "user" WHERE id = $1',
    [userId]
  );
  if (rows.length === 0) return null;
  const u = rows[0];
  return { ...u, service_id: u.service_id ?? null };
}
