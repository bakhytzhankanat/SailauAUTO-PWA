import { pool } from '../db/pool.js';

const WORK_START = '10:00';
const WORK_END = '18:00';

/**
 * Parse time string "HH:MM" to minutes since midnight for comparison.
 */
function timeToMinutes(t) {
  if (!t) return 0;
  const s = typeof t === 'string' ? t : String(t).slice(0, 5);
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Validate booking time window: 10:00-18:00 and no overlap for same box/date.
 */
export async function validateTimeSlot(date, boxId, startTime, endTime, excludeBookingId = null, serviceId = null) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const workStart = timeToMinutes(WORK_START);
  const workEnd = timeToMinutes(WORK_END);
  if (start < workStart || end > workEnd || start >= end) {
    return { valid: false, error: 'Уақыт 10:00–18:00 аралығында болуы керек' };
  }
  if (!serviceId) throw new Error('service_id қажет');
  const { rows } = await pool.query(
    `SELECT id, start_time, end_time FROM booking
     WHERE service_id = $1 AND date = $2 AND box_id = $3 AND id != COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid)`,
    [serviceId, date, boxId, excludeBookingId]
  );
  for (const b of rows) {
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    if (start < bEnd && end > bStart) {
      return { valid: false, error: 'Бокс сол уақытта бос емес' };
    }
  }
  return { valid: true };
}

export async function listByDate(date, boxId = null, serviceId = null) {
  if (!serviceId) throw new Error('service_id қажет');
  let query = `
    SELECT b.*,
           v.name AS vehicle_name, v.body_type AS vehicle_body_type,
           u.display_name AS assigned_master_name
    FROM booking b
    JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
    LEFT JOIN "user" u ON u.id = b.assigned_master_id
    WHERE b.service_id = $1 AND b.date = $2
  `;
  const params = [serviceId, date];
  if (boxId != null) {
    query += ' AND b.box_id = $3';
    params.push(boxId);
  }
  query += ' ORDER BY b.box_id, b.start_time';
  const { rows } = await pool.query(query, params);
  const bookingIds = rows.map((r) => r.id);
  if (bookingIds.length === 0) {
    return rows.map((r) => ({ ...r, services: [] }));
  }
  let byBooking = {};
  try {
    const { rows: serviceRows } = await pool.query(
      `SELECT bs.booking_id, bs.service_catalog_id, bs.quantity, bs.warranty_mode, s.name AS service_name
       FROM booking_service bs
       JOIN service_catalog s ON s.id = bs.service_catalog_id
       WHERE bs.booking_id = ANY($1)`,
      [bookingIds]
    );
    for (const s of serviceRows) {
      if (!byBooking[s.booking_id]) byBooking[s.booking_id] = [];
      byBooking[s.booking_id].push({ ...s, warranty_mode: Boolean(s.warranty_mode) });
    }
  } catch (_) {
    byBooking = {};
    const { rows: serviceRows } = await pool.query(
      `SELECT bs.booking_id, bs.service_catalog_id, bs.quantity, s.name AS service_name
       FROM booking_service bs
       JOIN service_catalog s ON s.id = bs.service_catalog_id
       WHERE bs.booking_id = ANY($1)`,
      [bookingIds]
    );
    for (const s of serviceRows) {
      if (!byBooking[s.booking_id]) byBooking[s.booking_id] = [];
      byBooking[s.booking_id].push({ ...s, warranty_mode: false });
    }
  }
  const bookingIdsList = rows.map((r) => r.id);
  let mastersByBooking = {};
  try {
    const { rows: masterRows } = await pool.query(
      `SELECT bm.booking_id, bm.master_user_id, u.display_name AS master_name
       FROM booking_master bm
       JOIN "user" u ON u.id = bm.master_user_id
       WHERE bm.booking_id = ANY($1)`,
      [bookingIdsList]
    );
    for (const m of masterRows) {
      if (!mastersByBooking[m.booking_id]) mastersByBooking[m.booking_id] = [];
      mastersByBooking[m.booking_id].push({ master_user_id: m.master_user_id, master_name: m.master_name });
    }
  } catch (_) {
    mastersByBooking = {};
  }
  return rows.map((r) => ({
    ...r,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    services: byBooking[r.id] || [],
    masters: mastersByBooking[r.id] || [],
  }));
}

export async function getById(id, serviceId = null) {
  if (!serviceId) throw new Error('service_id қажет');
  const { rows } = await pool.query(
    `SELECT b.*,
            v.name AS vehicle_name, v.body_type AS vehicle_body_type, v.year AS vehicle_year,
            u.display_name AS assigned_master_name
     FROM booking b
     JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
     LEFT JOIN "user" u ON u.id = b.assigned_master_id
     WHERE b.id = $1 AND b.service_id = $2`,
    [id, serviceId]
  );
  if (rows.length === 0) return null;
  const b = rows[0];
  let serviceRows = [];
  try {
    const res = await pool.query(
      `SELECT bs.id, bs.service_catalog_id, bs.quantity, bs.warranty_mode, s.name AS service_name
       FROM booking_service bs
       JOIN service_catalog s ON s.id = bs.service_catalog_id
       WHERE bs.booking_id = $1`,
      [id]
    );
    serviceRows = (res.rows || []).map((s) => ({ ...s, warranty_mode: Boolean(s.warranty_mode) }));
  } catch (_) {
    const res = await pool.query(
      `SELECT bs.id, bs.service_catalog_id, bs.quantity, s.name AS service_name
       FROM booking_service bs
       JOIN service_catalog s ON s.id = bs.service_catalog_id
       WHERE bs.booking_id = $1`,
      [id]
    );
    serviceRows = (res.rows || []).map((s) => ({ ...s, warranty_mode: false }));
  }
  let masterRows = [];
  try {
    const res = await pool.query(
      `SELECT bm.master_user_id, u.display_name AS master_name
       FROM booking_master bm
       JOIN "user" u ON u.id = bm.master_user_id
       WHERE bm.booking_id = $1 ORDER BY u.display_name`,
      [id]
    );
    masterRows = res.rows || [];
  } catch (_) {
    masterRows = [];
  }
  return {
    ...b,
    date: b.date instanceof Date ? b.date.toISOString().slice(0, 10) : b.date,
    services: serviceRows,
    masters: masterRows,
  };
}

/**
 * Create booking (structure only). Owner/Manager only.
 */
export async function create(serviceId, data) {
  if (!serviceId) throw new Error('service_id қажет');
  const {
    client_id,
    client_name,
    phone,
    source,
    vehicle_catalog_id,
    body_type,
    plate_number,
    box_id,
    date,
    start_time,
    end_time,
    note,
    services,
    master_user_ids,
    assigned_master_id,
  } = data;
  const valid = await validateTimeSlot(date, box_id, start_time, end_time, null, serviceId);
  if (!valid.valid) throw new Error(valid.error);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const masterId = assigned_master_id || (Array.isArray(master_user_ids) && master_user_ids[0]) || null;
    const { rows: [booking] } = await client.query(
      `INSERT INTO booking (
        service_id, client_id, client_name, phone, source, vehicle_catalog_id, body_type, plate_number,
        box_id, date, start_time, end_time, note, status, assigned_master_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'planned', $14)
      RETURNING *`,
      [
        serviceId,
        client_id || null,
        client_name,
        phone,
        source,
        vehicle_catalog_id,
        body_type,
        plate_number || null,
        box_id,
        date,
        start_time,
        end_time,
        note || null,
        masterId,
      ]
    );
    if (services && services.length > 0) {
      for (const s of services) {
        const warrantyMode = s.warranty_mode === true || s.warranty_mode === 'true';
        await client.query(
          'INSERT INTO booking_service (booking_id, service_catalog_id, quantity, warranty_mode) VALUES ($1, $2, $3, $4)',
          [booking.id, s.service_catalog_id, s.quantity, warrantyMode]
        );
      }
    }
    const mids = Array.isArray(master_user_ids) ? master_user_ids : (masterId ? [masterId] : []);
    for (const mid of mids) {
      if (mid) {
        await client.query(
          'INSERT INTO booking_master (booking_id, master_user_id) VALUES ($1, $2) ON CONFLICT (booking_id, master_user_id) DO NOTHING',
          [booking.id, mid]
        );
      }
    }
    await client.query('COMMIT');
    return getById(booking.id, serviceId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Update booking structure only. Owner/Manager only. Do not update execution fields.
 */
export async function updateStructure(id, serviceId, data) {
  if (!serviceId) throw new Error('service_id қажет');
  const existing = await getById(id, serviceId);
  if (!existing) return null;
  const {
    client_id,
    client_name,
    phone,
    source,
    vehicle_catalog_id,
    body_type,
    plate_number,
    box_id,
    date,
    start_time,
    end_time,
    note,
    services,
    master_user_ids,
    assigned_master_id,
  } = data;
  const valid = await validateTimeSlot(date, box_id, start_time, end_time, id, serviceId);
  if (!valid.valid) throw new Error(valid.error);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const masterId = assigned_master_id !== undefined ? assigned_master_id : (Array.isArray(master_user_ids) && master_user_ids[0]) || existing.assigned_master_id;
    await client.query(
      `UPDATE booking SET
        client_id = COALESCE($1, client_id),
        client_name = COALESCE($2, client_name),
        phone = COALESCE($3, phone),
        source = COALESCE($4, source),
        vehicle_catalog_id = COALESCE($5, vehicle_catalog_id),
        body_type = COALESCE($6, body_type),
        plate_number = COALESCE($7, plate_number),
        box_id = COALESCE($8, box_id),
        date = COALESCE($9, date),
        start_time = COALESCE($10, start_time),
        end_time = COALESCE($11, end_time),
        note = COALESCE($12, note),
        assigned_master_id = COALESCE($15, assigned_master_id),
        updated_at = now()
      WHERE id = $13 AND service_id = $14`,
      [
        client_id !== undefined ? client_id : existing.client_id,
        client_name ?? existing.client_name,
        phone ?? existing.phone,
        source ?? existing.source,
        vehicle_catalog_id ?? existing.vehicle_catalog_id,
        body_type ?? existing.body_type,
        plate_number !== undefined ? plate_number : existing.plate_number,
        box_id ?? existing.box_id,
        date ?? existing.date,
        start_time ?? existing.start_time,
        end_time ?? existing.end_time,
        note !== undefined ? note : existing.note,
        id,
        serviceId,
        masterId,
      ]
    );
    if (services !== undefined) {
      await client.query('DELETE FROM booking_service WHERE booking_id = $1', [id]);
      for (const s of services) {
        const warrantyMode = s.warranty_mode === true || s.warranty_mode === 'true';
        await client.query(
          'INSERT INTO booking_service (booking_id, service_catalog_id, quantity, warranty_mode) VALUES ($1, $2, $3, $4)',
          [id, s.service_catalog_id, s.quantity, warrantyMode]
        );
      }
    }
    if (master_user_ids !== undefined) {
      await client.query('DELETE FROM booking_master WHERE booking_id = $1', [id]);
      const mids = Array.isArray(master_user_ids) ? master_user_ids : [];
      for (const mid of mids) {
        if (mid) {
          await client.query(
            'INSERT INTO booking_master (booking_id, master_user_id) VALUES ($1, $2) ON CONFLICT (booking_id, master_user_id) DO NOTHING',
            [id, mid]
          );
        }
      }
    }
    await client.query('COMMIT');
    return getById(id, serviceId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
