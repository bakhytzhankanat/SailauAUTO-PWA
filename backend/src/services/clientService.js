import { pool } from '../db/pool.js';

function toDateStr(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : s;
}

// Cyrillic letters that look like Latin ones on Kazakhstan plates (А→A, В→B, ...).
const PLATE_CYRILLIC = 'АВЕКМНОРСТУХ';
const PLATE_LATIN = 'ABEKMHOPCTYX';

/**
 * Normalize a plate number for matching: uppercase, only letters/digits, Cyrillic look-alikes → Latin.
 * "123 abc 02", "123-АВС-02" and "123ABC02" all become "123ABC02".
 */
export function normalizePlate(value) {
  if (!value) return '';
  let out = '';
  for (const ch of String(value).toUpperCase()) {
    const i = PLATE_CYRILLIC.indexOf(ch);
    out += i >= 0 ? PLATE_LATIN[i] : ch;
  }
  return out.replace(/[^0-9A-ZА-ЯӘҒҚҢӨҰҮҺІЁ]/g, '');
}

/** SQL counterpart of normalizePlate for column `expr`. */
function plateSql(expr) {
  return `translate(regexp_replace(upper(COALESCE(${expr}, '')), '[^0-9A-ZА-ЯӘҒҚҢӨҰҮҺІЁ]', '', 'g'), '${PLATE_CYRILLIC}', '${PLATE_LATIN}')`;
}

/**
 * Search clients by phone (LIKE), name (ILIKE) or plate number (partial, e.g. first digits).
 * Plate matches the client's last plate or any plate from their bookings. Owner/Manager only.
 */
export async function search(serviceId, opts = {}) {
  if (!serviceId) throw new Error('service_id қажет');
  const q = (opts.q || '').trim();
  const plateQ = normalizePlate(q);

  const buildSql = (includeBody) => {
    const params = [serviceId];
    let matchedPlateSelect = '';
    let where = '';
    let order = 'c.name';
    if (q) {
      params.push(`%${q}%`);
      const conditions = ['c.phone LIKE $2', 'c.name ILIKE $2'];
      if (plateQ) {
        params.push(`%${plateQ}%`, `${plateQ}%`);
        conditions.push(
          `${plateSql('c.last_plate_number')} LIKE $3`,
          `EXISTS (SELECT 1 FROM booking pb WHERE pb.client_id = c.id AND ${plateSql('pb.plate_number')} LIKE $3)`
        );
        matchedPlateSelect = `,
             (SELECT pb.plate_number FROM booking pb
              WHERE pb.client_id = c.id AND ${plateSql('pb.plate_number')} LIKE $3
              ORDER BY pb.date DESC LIMIT 1) AS matched_plate`;
        // Plates that start with the typed characters come first.
        order = `(${plateSql('c.last_plate_number')} LIKE $4) DESC, c.name`;
      }
      where = ` AND (${conditions.join(' OR ')})`;
    }
    const sql = `
      SELECT c.id, c.name, c.phone, c.source, c.created_at, c.last_vehicle_name, c.last_plate_number${includeBody ? ', c.last_body_type' : ''},
             (SELECT MAX(b.date) FROM booking b WHERE b.client_id = c.id AND b.status = 'completed') AS last_visit_date${matchedPlateSelect}
      FROM client c
      WHERE c.service_id = $1${where}
      ORDER BY ${order}
    `;
    return { sql, params };
  };

  let rows;
  try {
    const { sql, params } = buildSql(true);
    const res = await pool.query(sql, params);
    rows = res.rows;
  } catch (_) {
    const { sql, params } = buildSql(false);
    const res = await pool.query(sql, params);
    rows = res.rows;
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    source: r.source,
    created_at: r.created_at,
    last_vehicle_name: r.last_vehicle_name ?? null,
    last_plate_number: r.last_plate_number ?? null,
    last_body_type: r.last_body_type ?? null,
    last_visit_date: toDateStr(r.last_visit_date),
    matched_plate: r.matched_plate ?? null,
  }));
}

/**
 * Get client by id with stats and optional vehicles. Owner/Manager only.
 */
export async function getById(id, serviceId) {
  if (!serviceId) throw new Error('service_id қажет');
  let clients;
  try {
    const res = await pool.query(
      'SELECT id, name, phone, source, created_at, last_vehicle_name, last_plate_number, last_body_type FROM client WHERE id = $1 AND service_id = $2',
      [id, serviceId]
    );
    clients = res.rows;
  } catch (_) {
    const res = await pool.query(
      'SELECT id, name, phone, source, created_at, last_vehicle_name, last_plate_number FROM client WHERE id = $1 AND service_id = $2',
      [id, serviceId]
    );
    clients = res.rows;
  }
  if (clients.length === 0) return null;
  const client = clients[0];

  const { rows: statsRows } = await pool.query(
    `SELECT COUNT(*) AS total_visits, MAX(date) AS last_visit_date
     FROM booking WHERE client_id = $1 AND status = 'completed'`,
    [id]
  );
  const total_visits = parseInt(statsRows[0]?.total_visits || '0', 10);
  const last_visit_date = toDateStr(statsRows[0]?.last_visit_date);

  const { rows: vehicles } = await pool.query(
    `SELECT DISTINCT ON (b.vehicle_catalog_id, COALESCE(b.plate_number, ''))
      v.name AS vehicle_name, v.body_type, v.year, b.plate_number
     FROM booking b
     JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
     WHERE b.client_id = $1
     ORDER BY b.vehicle_catalog_id, COALESCE(b.plate_number, ''), b.date DESC`,
    [id]
  );

  return {
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      source: client.source,
      created_at: client.created_at,
      last_vehicle_name: client.last_vehicle_name ?? null,
      last_plate_number: client.last_plate_number ?? null,
      last_body_type: client.last_body_type ?? null,
    },
    stats: { total_visits, last_visit_date },
    vehicles: (vehicles || []).map((v) => ({
      vehicle_name: v.vehicle_name,
      body_type: v.body_type,
      year: v.year,
      plate_number: v.plate_number,
    })),
  };
}

/**
 * List completed bookings (visits) for a client.
 */
export async function listVisits(clientId, serviceId) {
  if (!serviceId) throw new Error('service_id қажет');
  const { rows: bookings } = await pool.query(
    `SELECT b.id, b.date, b.start_time, b.end_time, b.service_payment_amount, b.payment_type, b.material_expense,
            v.name AS vehicle_name, v.body_type, v.year, b.plate_number
     FROM booking b
     JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
     WHERE b.client_id = $1 AND b.service_id = $2 AND b.status = 'completed'
     ORDER BY b.date DESC, b.start_time DESC`,
    [clientId, serviceId]
  );

  const result = [];
  for (const b of bookings) {
    let services;
    try {
      ({ rows: services } = await pool.query(
        `SELECT bs.quantity, bs.door_side, s.name AS service_name
         FROM booking_service bs
         JOIN service_catalog s ON s.id = bs.service_catalog_id
         WHERE bs.booking_id = $1`,
        [b.id]
      ));
    } catch (_) {
      ({ rows: services } = await pool.query(
        `SELECT bs.quantity, s.name AS service_name
         FROM booking_service bs
         JOIN service_catalog s ON s.id = bs.service_catalog_id
         WHERE bs.booking_id = $1`,
        [b.id]
      ));
    }
    const { rows: partRows } = await pool.query(
      'SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM part_sale WHERE booking_id = $1',
      [b.id]
    );
    const part_sales_total_for_booking = Number(partRows[0]?.total || 0);
    result.push({
      id: b.id,
      date: toDateStr(b.date),
      start_time: b.start_time,
      end_time: b.end_time,
      vehicle_name: b.vehicle_name,
      body_type: b.body_type,
      vehicle_year: b.year,
      plate_number: b.plate_number,
      services: services.map((s) => ({ service_name: s.service_name, quantity: s.quantity, door_side: s.door_side ?? null })),
      service_payment_amount: b.service_payment_amount != null ? Number(b.service_payment_amount) : null,
      payment_type: b.payment_type,
      material_expense: b.material_expense != null ? Number(b.material_expense) : null,
      part_sales_total_for_booking,
    });
  }
  return result;
}
