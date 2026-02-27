import { pool } from '../db/pool.js';

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseBool(val) {
  if (val == null) return true;
  const s = String(val).toLowerCase();
  return s === 'true' || s === '1' || s === '1000' || s === 'yes';
}

/**
 * Load settings as key-value, return decimals for percents/amounts.
 */
async function getSettings(serviceId) {
  if (!serviceId) throw new Error('service_id қажет');
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE service_id = $1', [serviceId]);
  const o = {};
  for (const r of rows) o[r.key] = r.value;
  return {
    manager_percent: num(o.manager_percent),
    masters_percent: num(o.masters_percent),
    owner_percent: num(o.owner_percent),
    kaspi_tax_percent: num(o.kaspi_tax_percent),
    charity_percent: num(o.charity_percent),
    round_charity_to_nearest_1000: parseBool(o.round_charity_to_nearest_1000),
    manual_master_distribution: parseBool(o.manual_master_distribution),
  };
}

/**
 * 1) service_income_total for date, status=completed
 */
async function getServiceIncomeTotal(serviceId, date) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(service_payment_amount), 0) AS total
     FROM booking WHERE service_id = $1 AND date = $2 AND status = 'completed'`,
    [serviceId, date]
  );
  return num(rows[0]?.total);
}

/**
 * 2) material_expense_total for completed bookings on date
 */
async function getMaterialExpenseTotal(serviceId, date) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(material_expense), 0) AS total
     FROM booking WHERE service_id = $1 AND date = $2 AND status = 'completed'`,
    [serviceId, date]
  );
  return num(rows[0]?.total);
}

/**
 * 3) part_sales_total: SUM(quantity * unit_price) for part_sales linked to completed bookings on date
 */
async function getPartSalesTotal(serviceId, date) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(ps.quantity * ps.unit_price), 0) AS total
     FROM part_sale ps
     JOIN booking b ON b.id = ps.booking_id AND b.service_id = $1 AND b.date = $2 AND b.status = 'completed'`,
    [serviceId, date]
  );
  return num(rows[0]?.total);
}

/**
 * Create day close snapshot. Throws if date already closed.
 */
export async function createSnapshot(serviceId, payload, user) {
  if (!serviceId) throw new Error('service_id қажет');
  const date = payload.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Жарамды күн форматы: YYYY-MM-DD');
  }

  const settings = await getSettings(serviceId);
  const service_income_total = await getServiceIncomeTotal(serviceId, date);
  const material_expense_total = await getMaterialExpenseTotal(serviceId, date);
  const part_sales_total = await getPartSalesTotal(serviceId, date);

  const income_total = service_income_total + part_sales_total;
  let kaspi_amount = num(payload.kaspi_amount);
  let cash_amount = payload.cash_amount != null && payload.cash_amount !== '' ? num(payload.cash_amount) : null;

  if (kaspi_amount > income_total) {
    throw new Error('KaspiPay сомасы қызмет пен бөлшек кірісінен аспауы керек');
  }
  if (cash_amount === null) {
    cash_amount = Math.max(income_total - kaspi_amount, 0);
  } else if (cash_amount < 0) {
    throw new Error('Қолма-қол сома теріс болмауы керек');
  }
  if (kaspi_amount + cash_amount > income_total) {
    throw new Error('KaspiPay мен қолма-қол қызмет пен бөлшек кірісінен аспауы керек');
  }

  const opex_lunch = num(payload.opex_lunch);
  const opex_transport = num(payload.opex_transport);
  const opex_rent = num(payload.opex_rent);

  const kaspi_tax_amount = income_total * (settings.kaspi_tax_percent / 100);
  const net_before_charity =
    service_income_total - material_expense_total - opex_lunch - opex_transport - opex_rent - kaspi_tax_amount;

  let charity_raw = net_before_charity >= 10000 ? net_before_charity * (settings.charity_percent / 100) : 0;
  let charity_rounded = charity_raw;
  if (charity_raw > 0 && settings.round_charity_to_nearest_1000) {
    charity_rounded = Math.round(charity_raw / 1000) * 1000;
  }
  const distributable_after_charity = net_before_charity - charity_rounded;

  const manager_amount = distributable_after_charity * (settings.manager_percent / 100);
  const remainder_after_manager = distributable_after_charity - manager_amount;
  const masters_pool_amount = remainder_after_manager * (settings.masters_percent / 100);
  const owner_service_dividend = remainder_after_manager * (settings.owner_percent / 100);
  const owner_parts_dividend = part_sales_total;

  const present_master_user_ids = Array.isArray(payload.present_master_user_ids) ? payload.present_master_user_ids : [];
  const manual_distribution = payload.manual_master_distribution === true || payload.manual_master_distribution === 'true';
  const master_percents = Array.isArray(payload.master_percents) ? payload.master_percents : [];

  let masterEntries;
  if (manual_distribution && master_percents.length > 0) {
    const sumPct = master_percents.reduce((acc, p) => acc + num(p.percent), 0);
    if (Math.abs(sumPct - 100) > 0.01) {
      throw new Error('Мастерлер үлесінің қосындысы 100% болуы керек');
    }
    masterEntries = master_percents
      .filter((p) => p.master_user_id && num(p.percent) > 0)
      .map((p) => ({ master_user_id: p.master_user_id, percent: num(p.percent), amount: Math.round((masters_pool_amount * num(p.percent)) / 100 * 100) / 100 }));
  } else {
    const N = present_master_user_ids.length;
    const amountEach = N > 0 ? masters_pool_amount / N : 0;
    const pctEach = N > 0 ? 100 / N : 0;
    masterEntries = present_master_user_ids.map((mid) => ({ master_user_id: mid, percent: pctEach, amount: amountEach }));
  }

  const client = await pool.connect();
  try {
    const { rows: maxRow } = await client.query(
      'SELECT COALESCE(MAX(shift_index), -1) + 1 AS next_shift FROM day_close WHERE service_id = $1 AND date = $2',
      [serviceId, date]
    );
    const shift_index = Number(maxRow[0]?.next_shift ?? 0);

    const { rows: [dc] } = await client.query(
      `INSERT INTO day_close (
        service_id, date, shift_index, closed_by_id,
        service_income_total, part_sales_total, kaspi_amount, cash_amount,
        material_expense_total, opex_lunch, opex_transport, opex_rent,
        kaspi_tax_percent, kaspi_tax_amount,
        charity_percent, charity_raw, charity_rounded, round_charity_to_nearest_1000,
        net_before_charity, distributable_after_charity,
        manager_percent, manager_amount, remainder_after_manager,
        masters_percent, owner_percent, masters_pool_amount, owner_service_dividend, owner_parts_dividend
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23,
        $24, $25, $26, $27, $28
      ) RETURNING *`,
      [
        serviceId, date, shift_index, user.id,
        service_income_total, part_sales_total, kaspi_amount, cash_amount,
        material_expense_total, opex_lunch, opex_transport, opex_rent,
        settings.kaspi_tax_percent, kaspi_tax_amount,
        settings.charity_percent, charity_raw, charity_rounded, settings.round_charity_to_nearest_1000,
        net_before_charity, distributable_after_charity,
        settings.manager_percent, manager_amount, remainder_after_manager,
        settings.masters_percent, settings.owner_percent, masters_pool_amount, owner_service_dividend, owner_parts_dividend,
      ]
    );
    for (const entry of masterEntries) {
      await client.query(
        `INSERT INTO day_close_master (day_close_id, master_user_id, amount, percent) VALUES ($1, $2, $3, $4)`,
        [dc.id, entry.master_user_id, entry.amount, entry.percent]
      );
    }

    const { rows: masters } = await client.query(
      `SELECT dcm.*, u.display_name AS master_name
       FROM day_close_master dcm
       JOIN "user" u ON u.id = dcm.master_user_id
       WHERE dcm.day_close_id = $1 ORDER BY u.display_name`,
      [dc.id]
    );

    return {
      day_close: mapRow(dc),
      masters: masters.map((m) => ({ id: m.id, master_user_id: m.master_user_id, master_name: m.master_name, amount: Number(m.amount), percent: m.percent != null ? Number(m.percent) : null })),
      derived: { service_income_total, material_expense_total, part_sales_total },
    };
  } finally {
    client.release();
  }
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    shift_index: r.shift_index != null ? Number(r.shift_index) : 0,
    closed_by_id: r.closed_by_id,
    closed_at: r.closed_at,
    updated_at: r.updated_at,
    service_income_total: Number(r.service_income_total),
    part_sales_total: Number(r.part_sales_total),
    kaspi_amount: Number(r.kaspi_amount),
    cash_amount: Number(r.cash_amount),
    material_expense_total: Number(r.material_expense_total),
    opex_lunch: Number(r.opex_lunch),
    opex_transport: Number(r.opex_transport),
    opex_rent: Number(r.opex_rent),
    kaspi_tax_percent: Number(r.kaspi_tax_percent),
    kaspi_tax_amount: Number(r.kaspi_tax_amount),
    charity_percent: Number(r.charity_percent),
    charity_raw: Number(r.charity_raw),
    charity_rounded: Number(r.charity_rounded),
    round_charity_to_nearest_1000: Boolean(r.round_charity_to_nearest_1000),
    net_before_charity: Number(r.net_before_charity),
    distributable_after_charity: Number(r.distributable_after_charity),
    manager_percent: Number(r.manager_percent),
    manager_amount: Number(r.manager_amount),
    remainder_after_manager: Number(r.remainder_after_manager),
    masters_percent: Number(r.masters_percent),
    owner_percent: Number(r.owner_percent),
    masters_pool_amount: Number(r.masters_pool_amount),
    owner_service_dividend: Number(r.owner_service_dividend),
    owner_parts_dividend: Number(r.owner_parts_dividend),
    edit_reason: r.edit_reason,
  };
}

export async function getByDate(serviceId, date, shiftIndex = null) {
  if (!serviceId) throw new Error('service_id қажет');
  if (!date) {
    return { day_close: null, masters: [], derived: { service_income_total: 0, material_expense_total: 0, part_sales_total: 0 }, day_closes_for_date: [] };
  }
  const { rows: allRows } = await pool.query(
    'SELECT * FROM day_close WHERE service_id = $1 AND date = $2 ORDER BY shift_index',
    [serviceId, date]
  );
  const derived = {
    service_income_total: await getServiceIncomeTotal(serviceId, date),
    material_expense_total: await getMaterialExpenseTotal(serviceId, date),
    part_sales_total: await getPartSalesTotal(serviceId, date),
  };
  const day_closes_for_date = allRows.map((r) => ({ id: r.id, shift_index: Number(r.shift_index ?? 0) }));
  if (allRows.length === 0) {
    return { day_close: null, masters: [], derived, day_closes_for_date: [] };
  }
  const dc = shiftIndex != null
    ? (allRows.find((r) => Number(r.shift_index) === Number(shiftIndex)) ?? null)
    : allRows[0];
  if (!dc) {
    return {
      day_close: null,
      masters: [],
      derived,
      day_closes_for_date,
    };
  }
  const { rows: masters } = await pool.query(
    `SELECT dcm.*, u.display_name AS master_name
     FROM day_close_master dcm JOIN "user" u ON u.id = dcm.master_user_id
     WHERE dcm.day_close_id = $1 ORDER BY u.display_name`,
    [dc.id]
  );
  return {
    day_close: mapRow(dc),
    masters: masters.map((m) => ({ id: m.id, master_user_id: m.master_user_id, master_name: m.master_name, amount: Number(m.amount), percent: m.percent != null ? Number(m.percent) : null })),
    derived,
    day_closes_for_date,
  };
}

/**
 * PATCH: owner only. Editable: opex_lunch, opex_transport, opex_rent, kaspi_amount, cash_amount, present_master_user_ids, edit_reason.
 * Recompute snapshot and update.
 */
export async function updateSnapshot(id, serviceId, payload, user) {
  if (!serviceId) throw new Error('service_id қажет');
  const edit_reason = payload.edit_reason != null ? String(payload.edit_reason).trim() : null;
  if (!edit_reason) throw new Error('Түзету себебін кіргізу қажет');

  const { rows: existing } = await pool.query('SELECT * FROM day_close WHERE id = $1 AND service_id = $2', [id, serviceId]);
  if (existing.length === 0) throw new Error('Ауысым жабу жазбасы табылмады');
  const row = existing[0];
  const date = row.date;

  const settings = await getSettings(serviceId);
  const service_income_total = await getServiceIncomeTotal(serviceId, date);
  const material_expense_total = await getMaterialExpenseTotal(serviceId, date);
  const part_sales_total = await getPartSalesTotal(serviceId, date);

  const income_total = service_income_total + part_sales_total;
  let kaspi_amount = payload.kaspi_amount != null && payload.kaspi_amount !== '' ? num(payload.kaspi_amount) : Number(row.kaspi_amount);
  let cash_amount = payload.cash_amount != null && payload.cash_amount !== '' ? num(payload.cash_amount) : null;
  if (cash_amount === null) cash_amount = Math.max(income_total - kaspi_amount, 0);
  if (kaspi_amount > income_total) throw new Error('KaspiPay сомасы қызмет пен бөлшек кірісінен аспауы керек');
  if (cash_amount < 0) throw new Error('Қолма-қол сома теріс болмауы керек');
  if (kaspi_amount + cash_amount > income_total) throw new Error('KaspiPay мен қолма-қол қызмет пен бөлшек кірісінен аспауы керек');

  const opex_lunch = payload.opex_lunch != null && payload.opex_lunch !== '' ? num(payload.opex_lunch) : Number(row.opex_lunch);
  const opex_transport = payload.opex_transport != null && payload.opex_transport !== '' ? num(payload.opex_transport) : Number(row.opex_transport);
  const opex_rent = payload.opex_rent != null && payload.opex_rent !== '' ? num(payload.opex_rent) : Number(row.opex_rent);

  const kaspi_tax_amount = income_total * (settings.kaspi_tax_percent / 100);
  const net_before_charity =
    service_income_total - material_expense_total - opex_lunch - opex_transport - opex_rent - kaspi_tax_amount;
  let charity_raw = net_before_charity >= 10000 ? net_before_charity * (settings.charity_percent / 100) : 0;
  let charity_rounded = charity_raw;
  if (charity_raw > 0 && settings.round_charity_to_nearest_1000) charity_rounded = Math.round(charity_raw / 1000) * 1000;
  const distributable_after_charity = net_before_charity - charity_rounded;
  const manager_amount = distributable_after_charity * (settings.manager_percent / 100);
  const remainder_after_manager = distributable_after_charity - manager_amount;
  const masters_pool_amount = remainder_after_manager * (settings.masters_percent / 100);
  const owner_service_dividend = remainder_after_manager * (settings.owner_percent / 100);
  const owner_parts_dividend = part_sales_total;

  const present_master_user_ids = Array.isArray(payload.present_master_user_ids) ? payload.present_master_user_ids : [];
  const manual_distribution = payload.manual_master_distribution === true || payload.manual_master_distribution === 'true';
  const master_percents = Array.isArray(payload.master_percents) ? payload.master_percents : [];

  let masterEntries;
  if (manual_distribution && master_percents.length > 0) {
    const sumPct = master_percents.reduce((acc, p) => acc + num(p.percent), 0);
    if (Math.abs(sumPct - 100) > 0.01) {
      throw new Error('Мастерлер үлесінің қосындысы 100% болуы керек');
    }
    masterEntries = master_percents
      .filter((p) => p.master_user_id && num(p.percent) > 0)
      .map((p) => ({ master_user_id: p.master_user_id, percent: num(p.percent), amount: Math.round((masters_pool_amount * num(p.percent)) / 100 * 100) / 100 }));
  } else {
    const N = present_master_user_ids.length;
    const amountEach = N > 0 ? masters_pool_amount / N : 0;
    const pctEach = N > 0 ? 100 / N : 0;
    masterEntries = present_master_user_ids.map((mid) => ({ master_user_id: mid, percent: pctEach, amount: amountEach }));
  }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE day_close SET
        kaspi_amount = $2, cash_amount = $3,
        opex_lunch = $4, opex_transport = $5, opex_rent = $6,
        kaspi_tax_amount = $7, charity_raw = $8, charity_rounded = $9,
        net_before_charity = $10, distributable_after_charity = $11,
        manager_amount = $12, remainder_after_manager = $13,
        masters_pool_amount = $14, owner_service_dividend = $15, owner_parts_dividend = $16,
        edit_reason = $17, updated_at = now()
       WHERE id = $1`,
      [
        id, kaspi_amount, cash_amount,
        opex_lunch, opex_transport, opex_rent,
        kaspi_tax_amount, charity_raw, charity_rounded,
        net_before_charity, distributable_after_charity,
        manager_amount, remainder_after_manager,
        masters_pool_amount, owner_service_dividend, owner_parts_dividend,
        edit_reason,
      ]
    );
    await client.query('DELETE FROM day_close_master WHERE day_close_id = $1', [id]);
    for (const entry of masterEntries) {
      await client.query(
        'INSERT INTO day_close_master (day_close_id, master_user_id, amount, percent) VALUES ($1, $2, $3, $4)',
        [id, entry.master_user_id, entry.amount, entry.percent]
      );
    }
  } finally {
    client.release();
  }

  return getByDate(serviceId, date, row.shift_index);
}
