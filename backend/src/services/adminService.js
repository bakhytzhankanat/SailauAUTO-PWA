import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

/**
 * List all owners (владельцы сервисов). Super_admin only.
 */
export async function listOwners() {
  const { rows } = await pool.query(
    `SELECT u.id, u.phone, u.display_name, u.role, u.is_active, u.created_at, u.service_id,
            s.name AS service_name
     FROM "user" u
     LEFT JOIN service s ON s.id = u.service_id
     WHERE u.role = 'owner'
     ORDER BY u.created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    display_name: r.display_name,
    role: r.role,
    is_active: r.is_active !== false,
    created_at: r.created_at,
    service_id: r.service_id,
    service_name: r.service_name || null,
  }));
}

/**
 * Create new service + owner account. Super_admin only.
 * Payload: phone, display_name, password, service_name (optional).
 */
export async function createOwner(data) {
  const { phone, display_name, password, service_name } = data;
  const name = (display_name || '').trim();
  if (name.length < 1 || name.length > 60) throw new Error('display_name 1–60 таңба');
  const normalized = (phone || '').replace(/\s/g, '').trim();
  if (!normalized) throw new Error('Телефон толтырылуы керек');
  const pwd = String(password || '').trim();
  if (pwd.length < 6) throw new Error('Құпия сөз кем дегенде 6 таңба');

  const { rows: existing } = await pool.query('SELECT id FROM "user" WHERE phone = $1', [normalized]);
  if (existing.length > 0) throw new Error('Бұл телефон тіркелген');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: serviceRows } = await client.query(
      'INSERT INTO service (name) VALUES ($1) RETURNING id',
      [(service_name || '').trim() || null]
    );
    const serviceId = serviceRows[0].id;

    const password_hash = await bcrypt.hash(pwd, 10);
    const { rows: userRows } = await client.query(
      `INSERT INTO "user" (phone, password_hash, role, display_name, service_id)
       VALUES ($1, $2, 'owner', $3, $4)
       RETURNING id, phone, display_name, role, is_active, created_at, service_id`,
      [normalized, password_hash, name, serviceId]
    );
    const user = userRows[0];

    // Copy default settings from one existing service to new service
    const { rows: settingsRows } = await client.query(
      'SELECT key, value FROM settings WHERE service_id = (SELECT id FROM service WHERE id != $1 ORDER BY created_at ASC LIMIT 1)',
      [serviceId]
    );
    for (const r of settingsRows) {
      await client.query(
        'INSERT INTO settings (service_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (service_id, key) DO NOTHING',
        [serviceId, r.key, r.value]
      );
    }

    await client.query('COMMIT');
    return {
      id: user.id,
      phone: user.phone,
      display_name: user.display_name,
      role: user.role,
      is_active: user.is_active !== false,
      created_at: user.created_at,
      service_id: user.service_id,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
