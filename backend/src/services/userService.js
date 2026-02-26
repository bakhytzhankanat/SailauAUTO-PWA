import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

/**
 * List staff: managers + workers (exclude owner). Owner only. Includes inactive.
 */
export async function listStaff() {
  const { rows } = await pool.query(
    `SELECT id, phone, display_name, role, is_senior_worker, is_active, created_at
     FROM "user"
     WHERE role IN ('manager', 'worker')
     ORDER BY role, display_name`
  );
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    display_name: r.display_name,
    role: r.role,
    is_senior_worker: Boolean(r.is_senior_worker),
    is_active: r.is_active !== false,
    created_at: r.created_at,
  }));
}

/**
 * List workers (role=worker, active only). Owner only. For day close etc.
 */
export async function listWorkers() {
  const { rows } = await pool.query(
    `SELECT id, phone, display_name, is_senior_worker, created_at
     FROM "user"
     WHERE role = 'worker' AND (is_active IS NULL OR is_active = true)
     ORDER BY display_name`
  );
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    display_name: r.display_name,
    is_senior_worker: Boolean(r.is_senior_worker),
    created_at: r.created_at,
  }));
}

/**
 * Create user: manager or worker. Owner only. phone, display_name, password, role.
 */
export async function createUser(data) {
  const { phone, display_name, password, role } = data;
  if (!role || !['manager', 'worker'].includes(role)) throw new Error('role: manager немесе worker');
  const name = (display_name || '').trim();
  if (name.length < 1 || name.length > 60) throw new Error('display_name 1–60 таңба');
  const normalized = (phone || '').replace(/\s/g, '').trim();
  if (!normalized) throw new Error('Телефон толтырылуы керек');
  const pwd = String(password || '').trim();
  if (pwd.length < 6) throw new Error('Құпия сөз кем дегенде 6 таңба');

  const { rows: existing } = await pool.query('SELECT id FROM "user" WHERE phone = $1', [normalized]);
  if (existing.length > 0) throw new Error('Бұл телефон тіркелген');

  const password_hash = await bcrypt.hash(pwd, 10);
  const { rows } = await pool.query(
    `INSERT INTO "user" (phone, password_hash, role, display_name) VALUES ($1, $2, $3, $4)
     RETURNING id, phone, display_name, role, is_senior_worker, is_active, created_at`,
    [normalized, password_hash, role, name]
  );
  const r = rows[0];
  return {
    id: r.id,
    phone: r.phone,
    display_name: r.display_name,
    role: r.role,
    is_senior_worker: Boolean(r.is_senior_worker),
    is_active: r.is_active !== false,
    created_at: r.created_at,
  };
}

/**
 * Update user: display_name (1..60), is_senior_worker, is_active, new_password. Owner only.
 */
export async function updateUser(id, data) {
  const updates = [];
  const params = [];
  let idx = 1;

  if (data.display_name !== undefined) {
    const name = (data.display_name || '').trim();
    if (name.length < 1 || name.length > 60) throw new Error('display_name 1–60 таңба болуы керек');
    updates.push(`display_name = $${idx++}`);
    params.push(name);
  }
  if (data.is_senior_worker !== undefined) {
    updates.push(`is_senior_worker = $${idx++}`);
    params.push(Boolean(data.is_senior_worker));
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${idx++}`);
    params.push(Boolean(data.is_active));
  }
  if (data.new_password !== undefined && data.new_password !== '') {
    const pwd = String(data.new_password).trim();
    if (pwd.length < 6) throw new Error('Құпия сөз кем дегенде 6 таңба');
    const password_hash = await bcrypt.hash(pwd, 10);
    updates.push(`password_hash = $${idx++}`);
    params.push(password_hash);
  }
  if (updates.length === 0) {
    const { rows } = await pool.query(
      'SELECT id, phone, display_name, role, is_senior_worker, is_active, created_at FROM "user" WHERE id = $1',
      [id]
    );
    if (rows.length === 0) throw new Error('Пайдаланушы табылмады');
    const r = rows[0];
    return { id: r.id, phone: r.phone, display_name: r.display_name, role: r.role, is_senior_worker: Boolean(r.is_senior_worker), is_active: r.is_active !== false, created_at: r.created_at };
  }
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE "user" SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING id, phone, display_name, role, is_senior_worker, is_active, created_at`,
    params
  );
  if (rows.length === 0) throw new Error('Пайдаланушы табылмады');
  const r = rows[0];
  return { id: r.id, phone: r.phone, display_name: r.display_name, role: r.role, is_senior_worker: Boolean(r.is_senior_worker), is_active: r.is_active !== false, created_at: r.created_at };
}
