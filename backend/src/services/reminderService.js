import { pool } from '../db/pool.js';

const ROLE_LABEL = { owner: 'Иесі', manager: 'Менеджер', worker: 'Мастер' };

/**
 * List reminders. status filter: 'active' | 'done' | 'all' (default all).
 * Returns with creator display_name and role for badge.
 */
export async function list(opts = {}) {
  const status = opts.status === 'active' || opts.status === 'done' ? opts.status : null;
  let sql = `
    SELECT r.id, r.title, r.priority, r.status, r.created_by_id, r.created_at, r.updated_at, r.link_type, r.link_id,
           u.display_name AS created_by_name, u.role AS created_by_role
    FROM reminder r
    LEFT JOIN "user" u ON u.id = r.created_by_id
  `;
  const params = [];
  if (status) {
    params.push(status);
    sql += ` WHERE r.status = $1`;
  }
  sql += ' ORDER BY r.created_at DESC';
  const { rows } = await pool.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    status: r.status,
    created_by_id: r.created_by_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    link_type: r.link_type,
    link_id: r.link_id,
    created_by_name: r.created_by_name,
    created_by_role: r.created_by_role,
    role_label: ROLE_LABEL[r.created_by_role] || r.created_by_role,
  }));
}

/**
 * Create reminder. Any authenticated user.
 */
export async function create(data, user) {
  const title = (data.title || '').trim();
  if (title.length < 3 || title.length > 140) {
    throw new Error('Тақырып 3–140 таңбадан тұруы керек');
  }
  const priority = data.priority;
  if (!priority || !['high', 'medium', 'low'].includes(priority)) {
    throw new Error('Приоритет: high, medium немесе low');
  }
  let link_type = data.link_type || null;
  let link_id = data.link_id || null;
  if (link_type) {
    if (link_type !== 'inventory') throw new Error('link_type тек inventory болуы мүмкін');
    if (!link_id) throw new Error('Қойма сілтемесі үшін тауар таңдаңыз');
    const { rows } = await pool.query('SELECT id FROM inventory_item WHERE id = $1', [link_id]);
    if (rows.length === 0) throw new Error('Тауар табылмады');
  } else {
    link_id = null;
  }

  const { rows } = await pool.query(
    `INSERT INTO reminder (title, priority, status, created_by_id, link_type, link_id)
     VALUES ($1, $2, 'active', $3, $4, $5)
     RETURNING id, title, priority, status, created_by_id, created_at, link_type, link_id`,
    [title, priority, user.id, link_type, link_id]
  );
  const r = rows[0];
  const createdBy = user.id ? { display_name: user.display_name, role: user.role } : null;
  return {
    id: r.id,
    title: r.title,
    priority: r.priority,
    status: r.status,
    created_by_id: r.created_by_id,
    created_at: r.created_at,
    link_type: r.link_type,
    link_id: r.link_id,
    created_by_name: createdBy?.display_name,
    created_by_role: createdBy?.role,
    role_label: createdBy ? ROLE_LABEL[createdBy.role] : null,
  };
}

/**
 * Update status only. Any authenticated user.
 */
export async function updateStatus(id, status, user) {
  if (status !== 'active' && status !== 'done') throw new Error('status: active немесе done');
  const { rows } = await pool.query(
    'UPDATE reminder SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [id, status]
  );
  if (rows.length === 0) throw new Error('Ескертпе табылмады');
  const r = rows[0];
  const { rows: uRows } = await pool.query('SELECT display_name, role FROM "user" WHERE id = $1', [r.created_by_id]);
  const creator = uRows[0];
  return {
    id: r.id,
    title: r.title,
    priority: r.priority,
    status: r.status,
    created_by_id: r.created_by_id,
    created_at: r.created_at,
    link_type: r.link_type,
    link_id: r.link_id,
    created_by_name: creator?.display_name,
    created_by_role: creator?.role,
    role_label: creator ? ROLE_LABEL[creator.role] : null,
  };
}

/**
 * Delete. Owner/manager: any; worker: only own (created_by_id === user.id).
 */
export async function deleteReminder(id, user) {
  const { rows } = await pool.query('SELECT id, created_by_id FROM reminder WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error('Ескертпе табылмады');
  const reminder = rows[0];
  const isOwnerOrManager = user.role === 'owner' || user.role === 'manager';
  if (!isOwnerOrManager && reminder.created_by_id !== user.id) {
    const err = new Error('Тек өз ескертпеңізді жоя аласыз');
    err.statusCode = 403;
    throw err;
  }
  await pool.query('DELETE FROM reminder WHERE id = $1', [id]);
  return { ok: true };
}

/**
 * Delete all done. Owner/manager only.
 */
export async function clearDone(user) {
  if (user.role !== 'owner' && user.role !== 'manager') {
    const err = new Error('Рұқсат жоқ');
    err.statusCode = 403;
    throw err;
  }
  const { rowCount } = await pool.query("DELETE FROM reminder WHERE status = 'done'");
  return { deleted: rowCount };
}
