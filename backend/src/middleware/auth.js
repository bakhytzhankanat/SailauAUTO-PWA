import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const DEV_JWT_SECRET = 'dev-secret-change-in-production';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : DEV_JWT_SECRET);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
// Token older than this is re-issued on the next request (sliding session).
const TOKEN_REFRESH_AFTER_SECONDS = 6 * 60 * 60;
export const REFRESH_TOKEN_HEADER = 'X-Refresh-Token';

/**
 * Fail fast on startup: in production the server must not run with the public dev secret,
 * otherwise anyone could forge tokens.
 */
export function assertJwtSecretConfigured() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('JWT_SECRET is not set; using the insecure development secret.');
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function loadUser(userId) {
  try {
    return await pool.query(
      'SELECT id, phone, display_name, role, is_senior_worker, service_id, is_active FROM "user" WHERE id = $1',
      [userId]
    );
  } catch (err) {
    // A pooled connection may have been dropped while the app was idle; retry once on a fresh one.
    console.warn('Auth user lookup failed, retrying:', err.message);
    return pool.query(
      'SELECT id, phone, display_name, role, is_senior_worker, service_id, is_active FROM "user" WHERE id = $1',
      [userId]
    );
  }
}

/**
 * Verify JWT and attach req.user = { id, phone, display_name, role, is_senior_worker }.
 * No 401 here; use requireAuth for that.
 * Database errors answer 503 instead of logging the user out.
 * Tokens older than TOKEN_REFRESH_AFTER_SECONDS get a fresh one in the X-Refresh-Token header.
 */
export async function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  req.user = null;
  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return next();
  }

  let rows;
  try {
    ({ rows } = await loadUser(decoded.userId));
  } catch (err) {
    console.error('Auth user lookup failed:', err.message);
    return res.status(503).json({ error: 'Сервер уақытша қолжетімсіз. Қайталап көріңіз.' });
  }
  if (rows.length === 0 || rows[0].is_active === false) return next();

  const { is_active, ...user } = rows[0];
  req.user = { ...user, service_id: user.service_id ?? null };

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!decoded.iat || nowSeconds - decoded.iat > TOKEN_REFRESH_AFTER_SECONDS) {
    res.setHeader(REFRESH_TOKEN_HEADER, signToken(user.id));
  }
  next();
}

/**
 * Require authenticated user. 401 if no token or invalid.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Кіру қажет' });
  }
  next();
}

/**
 * Require role in allowed list. Use after requireAuth.
 * 403 if role not in allowed.
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Кіру қажет' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Рұқсат жоқ' });
    }
    next();
  };
}

/**
 * Require owner only. Use after requireAuth.
 */
export const requireOwner = requireRole(['owner']);

/**
 * Require owner or manager. Use after requireAuth.
 */
export const requireOwnerOrManager = requireRole(['owner', 'manager']);

/**
 * Require owner, manager, or senior worker (for creating/editing bookings). Use after requireAuth.
 */
export function requireOwnerOrManagerOrSeniorWorker(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Кіру қажет' });
  }
  if (req.user.role === 'owner' || req.user.role === 'manager' || req.user.is_senior_worker) {
    return next();
  }
  return res.status(403).json({ error: 'Рұқсат жоқ' });
}

/**
 * Require owner or is_senior_worker (for day close). Use after requireAuth.
 */
export function requireSeniorWorkerOrOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Кіру қажет' });
  }
  if (req.user.role === 'owner' || req.user.is_senior_worker) {
    return next();
  }
  return res.status(403).json({ error: 'Рұқсат жоқ' });
}

/**
 * Require worker or owner (for booking execution: start, complete). Use after requireAuth.
 */
export const requireWorkerOrOwner = requireRole(['worker', 'owner']);

/**
 * Require super_admin only (platform admin; manages owners). Use after requireAuth.
 */
export const requireSuperAdmin = requireRole(['super_admin']);

/**
 * Require user to belong to a service (owner/manager/worker). 403 if service_id is null (e.g. super_admin).
 * Use after requireAuth on tenant-scoped routes.
 */
export function requireService(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Кіру қажет' });
  if (!req.user.service_id) return res.status(403).json({ error: 'Рұқсат жоқ' });
  next();
}
