import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verify JWT and attach req.user = { id, phone, display_name, role, is_senior_worker }.
 * No 401 here; use requireAuth for that.
 */
export async function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, phone, display_name, role, is_senior_worker FROM "user" WHERE id = $1',
      [decoded.userId]
    );
    if (rows.length === 0) {
      req.user = null;
      return next();
    }
    req.user = rows[0];
    next();
  } catch {
    req.user = null;
    next();
  }
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

export { JWT_SECRET };
