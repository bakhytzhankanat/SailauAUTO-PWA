import { pool } from '../db/pool.js';

/**
 * List warranties for a client with service name, completed_at, expires_at, status (active/expired).
 */
export async function listByClient(clientId) {
  const { rows } = await pool.query(
    `SELECT w.id, w.completed_at, w.expires_at, s.name AS service_name
     FROM warranty w
     JOIN service_catalog s ON s.id = w.service_catalog_id
     WHERE w.client_id = $1
     ORDER BY w.expires_at DESC`,
    [clientId]
  );
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return rows.map((r) => {
    const expiresAt = r.expires_at ? String(r.expires_at).slice(0, 10) : null;
    const active = expiresAt && expiresAt >= today;
    return {
      id: r.id,
      service_name: r.service_name,
      completed_at: r.completed_at,
      expires_at: expiresAt,
      status: active ? 'active' : 'expired',
    };
  });
}

/**
 * List warranties expiring within the next N days. Owner/Manager only.
 */
export async function listExpiring(opts = {}) {
  const days = Math.max(0, parseInt(opts.days, 10) || 7);
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + days);
  const to = toDate.toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT w.id, w.client_id, w.expires_at, s.name AS service_name, c.name AS client_name, c.phone
     FROM warranty w
     JOIN service_catalog s ON s.id = w.service_catalog_id
     JOIN client c ON c.id = w.client_id
     WHERE w.expires_at >= $1 AND w.expires_at <= $2
     ORDER BY w.expires_at ASC`,
    [from, to]
  );
  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: r.client_name,
    phone: r.phone,
    service_name: r.service_name,
    expires_at: String(r.expires_at).slice(0, 10),
  }));
}
