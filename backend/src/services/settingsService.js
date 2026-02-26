import { pool } from '../db/pool.js';

const WHITELIST = new Set([
  'working_hours_start',
  'working_hours_end',
  'box_count',
  'manager_percent',
  'masters_percent',
  'owner_percent',
  'kaspi_tax_percent',
  'charity_percent',
  'round_charity_to_nearest_1000',
]);

const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function parseTime(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(TIME_REGEX);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Проверка: Шеберлер + Иесі = 100. Менеджер не входит в сумму.
 * @param mastersPercent - число 0..100
 * @param ownerPercent - число 0..100
 * @throws Error если mastersPercent + ownerPercent !== 100
 */
export function validateMastersOwnerSum(mastersPercent, ownerPercent) {
  const s = Number(mastersPercent);
  const o = Number(ownerPercent);
  const sum = s + o;
  if (!Number.isFinite(sum) || Math.abs(sum - 100) > 0.01) {
    throw new Error('Шеберлер + Иесі проценттерінің қосындысы 100 болуы керек');
  }
}

/**
 * Get all settings as key-value object for a service.
 */
export async function getAll(serviceId) {
  if (!serviceId) throw new Error('service_id қажет');
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE service_id = $1', [serviceId]);
  const obj = {};
  for (const r of rows) {
    obj[r.key] = r.value;
  }
  return obj;
}

/**
 * Update settings from keyValues. Owner only. Whitelist + validation.
 */
export async function updateKeyValues(serviceId, keyValues) {
  if (!serviceId) throw new Error('service_id қажет');
  if (!keyValues || typeof keyValues !== 'object') {
    throw new Error('keyValues объектісі қажет');
  }
  const updates = {};
  for (const [k, v] of Object.entries(keyValues)) {
    if (!WHITELIST.has(k)) continue;
    const val = v != null ? String(v).trim() : '';
    if (val === '') continue;
    updates[k] = val;
  }

  if (Object.keys(updates).length === 0) return getAll(serviceId);

  const start = updates.working_hours_start != null ? updates.working_hours_start : null;
  const end = updates.working_hours_end != null ? updates.working_hours_end : null;
  if (start !== null) {
    if (!TIME_REGEX.test(start)) throw new Error('Басталу уақыты HH:MM форматында болуы керек');
  }
  if (end !== null) {
    if (!TIME_REGEX.test(end)) throw new Error('Аяқталу уақыты HH:MM форматында болуы керек');
  }
  if (start !== null && end !== null) {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    if (startMin >= endMin) throw new Error('Басталу уақыты аяқталудан кіші болуы керек');
  }

  if (updates.box_count != null) {
    const n = parseInt(updates.box_count, 10);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('Бокс саны 1–5 аралығында бүтін сан болуы керек');
  }

  const percentKeys = ['manager_percent', 'masters_percent', 'owner_percent', 'kaspi_tax_percent', 'charity_percent'];
  for (const k of percentKeys) {
    if (updates[k] == null) continue;
    const n = parseFloat(updates[k]);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${k} 0–100 аралығында болуы керек`);
  }

  if (updates.masters_percent != null || updates.owner_percent != null) {
    const current = await getAll(serviceId);
    const s = parseFloat(updates.masters_percent ?? current.masters_percent ?? 0);
    const o = parseFloat(updates.owner_percent ?? current.owner_percent ?? 0);
    validateMastersOwnerSum(s, o);
  }

  if (updates.round_charity_to_nearest_1000 != null) {
    const v = (updates.round_charity_to_nearest_1000 || '').toLowerCase();
    if (v !== 'true' && v !== 'false' && v !== '1' && v !== '0') {
      throw new Error('round_charity_to_nearest_1000: true немесе false');
    }
    updates.round_charity_to_nearest_1000 = v === 'true' || v === '1' ? 'true' : 'false';
  }

  for (const [key, value] of Object.entries(updates)) {
    await pool.query(
      'INSERT INTO settings (service_id, key, value, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (service_id, key) DO UPDATE SET value = $3, updated_at = now()',
      [serviceId, key, value]
    );
  }
  return getAll(serviceId);
}
