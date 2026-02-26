import { pool } from '../db/pool.js';

function normalizePhone(phone) {
  if (phone == null || typeof phone !== 'string') return '';
  return phone.replace(/\s/g, '').trim();
}

/**
 * Upsert by phone. No Client creation. serviceId optional (default: first service).
 */
export async function upsertInbound(data, serviceId = null) {
  const phone = normalizePhone(data.phone);
  if (!phone) throw new Error('phone қажет');

  let sid = serviceId;
  if (!sid) {
    const { rows } = await pool.query('SELECT id FROM service LIMIT 1');
    sid = rows[0]?.id;
  }
  if (!sid) throw new Error('service_id қажет');

  const name = data.name != null ? String(data.name).trim() || null : null;
  const last_message = data.last_message != null ? String(data.last_message).trim() || null : null;
  const last_message_at = data.last_message_at != null ? data.last_message_at : null;

  await pool.query(
    `INSERT INTO whatsapp_inbound (service_id, phone, name, last_message, last_message_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (service_id, phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, whatsapp_inbound.name),
       last_message = COALESCE(EXCLUDED.last_message, whatsapp_inbound.last_message),
       last_message_at = COALESCE(EXCLUDED.last_message_at, whatsapp_inbound.last_message_at),
       updated_at = now()`,
    [sid, phone, name, last_message, last_message_at]
  );
  return { ok: true };
}

/**
 * List for inbox. Scoped by service. Order by COALESCE(last_message_at, updated_at) DESC, limit 100.
 */
export async function listInbound(serviceId, opts = {}) {
  if (!serviceId) throw new Error('service_id қажет');
  const q = (opts.q || '').trim();
  let sql = `
    SELECT id, phone, name, last_message, last_message_at, created_at, updated_at
    FROM whatsapp_inbound
    WHERE service_id = $1
  `;
  const params = [serviceId];
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (phone LIKE $2 OR (name IS NOT NULL AND name ILIKE $2))`;
  }
  sql += ` ORDER BY COALESCE(last_message_at, updated_at) DESC NULLS LAST LIMIT 100`;
  const { rows } = await pool.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    name: r.name,
    last_message: r.last_message,
    last_message_at: r.last_message_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
