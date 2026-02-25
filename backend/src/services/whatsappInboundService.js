import { pool } from '../db/pool.js';

function normalizePhone(phone) {
  if (phone == null || typeof phone !== 'string') return '';
  return phone.replace(/\s/g, '').trim();
}

/**
 * Upsert by phone. No Client creation.
 */
export async function upsertInbound(data) {
  const phone = normalizePhone(data.phone);
  if (!phone) throw new Error('phone қажет');

  const name = data.name != null ? String(data.name).trim() || null : null;
  const last_message = data.last_message != null ? String(data.last_message).trim() || null : null;
  const last_message_at = data.last_message_at != null ? data.last_message_at : null;

  await pool.query(
    `INSERT INTO whatsapp_inbound (phone, name, last_message, last_message_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, whatsapp_inbound.name),
       last_message = COALESCE(EXCLUDED.last_message, whatsapp_inbound.last_message),
       last_message_at = COALESCE(EXCLUDED.last_message_at, whatsapp_inbound.last_message_at),
       updated_at = now()`,
    [phone, name, last_message, last_message_at]
  );
  return { ok: true };
}

/**
 * List for inbox. Order by COALESCE(last_message_at, updated_at) DESC, limit 100.
 */
export async function listInbound(opts = {}) {
  const q = (opts.q || '').trim();
  let sql = `
    SELECT id, phone, name, last_message, last_message_at, created_at, updated_at
    FROM whatsapp_inbound
  `;
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    sql += ` WHERE phone LIKE $1 OR (name IS NOT NULL AND name ILIKE $1)`;
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
