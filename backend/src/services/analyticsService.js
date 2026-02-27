import { pool } from '../db/pool.js';

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getMonday(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(isoDate) {
  const monday = getMonday(isoDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getMonthDates(isoDate) {
  const [y, m] = isoDate.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0);
  const lastStr = last.toISOString().slice(0, 10);
  const dates = [];
  const cur = new Date(first + 'T12:00:00');
  const end = new Date(lastStr + 'T12:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function getServiceIncomeTotal(serviceId, date) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(service_payment_amount), 0) AS total
     FROM booking WHERE service_id = $1 AND date = $2 AND status = 'completed'`,
    [serviceId, date]
  );
  return num(rows[0]?.total);
}

async function getMaterialExpenseTotal(serviceId, date) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(material_expense), 0) AS total
     FROM booking WHERE service_id = $1 AND date = $2 AND status = 'completed'`,
    [serviceId, date]
  );
  return num(rows[0]?.total);
}

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
 * GET /api/analytics/summary?period=day|week|month&date=YYYY-MM-DD
 * Owner only. Returns period boundaries, aggregated metrics, daily rows, wages breakdown, day_close list.
 */
export async function getSummary(serviceId, period, date, opts = {}) {
  if (!serviceId) throw new Error('service_id қажет');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Жарамды күн форматы: YYYY-MM-DD');
  }
  const periodType = String(period || 'day').toLowerCase();
  let dates;
  if (periodType === 'day') {
    dates = [date];
  } else if (periodType === 'week') {
    dates = getWeekDates(date);
  } else if (periodType === 'month') {
    dates = getMonthDates(date);
  } else {
    throw new Error('period: day, week немесе month');
  }

  const start_date = dates[0];
  const end_date = dates[dates.length - 1];

  const dailyRows = [];
  let service_income_total = 0;
  let part_sales_total = 0;
  let material_expense_total = 0;
  let net_total = 0;
  let charity_total_raw = 0;
  let charity_total_rounded = 0;
  let kaspi_tax_total = 0;
  let owner_dividend_total = 0;
  let manager_total = 0;
  const masterTotalsByUser = {};
  const dayCloseList = [];

  for (const d of dates) {
    const { rows: dcRows } = await pool.query('SELECT * FROM day_close WHERE service_id = $1 AND date = $2 ORDER BY shift_index', [serviceId, d]);
    if (dcRows.length > 0) {
      let svc = 0;
      let parts = 0;
      let mat = 0;
      let netSum = 0;
      let charityRaw = 0;
      let charityRounded = 0;
      let kaspiTax = 0;
      let ownerDiv = 0;
      let managerAmt = 0;
      for (const dc of dcRows) {
        svc += num(dc.service_income_total);
        parts += num(dc.part_sales_total);
        mat += num(dc.material_expense_total);
        netSum += num(dc.net_before_charity) - num(dc.charity_rounded);
        charityRaw += num(dc.charity_raw);
        charityRounded += num(dc.charity_rounded);
        kaspiTax += num(dc.kaspi_tax_amount);
        ownerDiv += num(dc.owner_service_dividend) + num(dc.owner_parts_dividend);
        managerAmt += num(dc.manager_amount);

        const { rows: masters } = await pool.query(
          `SELECT dcm.master_user_id, u.display_name AS master_name, dcm.amount
           FROM day_close_master dcm JOIN "user" u ON u.id = dcm.master_user_id
           WHERE dcm.day_close_id = $1`,
          [dc.id]
        );
        for (const m of masters) {
          const uid = m.master_user_id;
          if (!masterTotalsByUser[uid]) masterTotalsByUser[uid] = { master_name: m.master_name, amount: 0 };
          masterTotalsByUser[uid].amount += num(m.amount);
        }

        dayCloseList.push({
          id: dc.id,
          date: d,
          shift_index: num(dc.shift_index),
          service_income_total: num(dc.service_income_total),
          part_sales_total: num(dc.part_sales_total),
          net_before_charity: num(dc.net_before_charity),
          day_closed: true,
        });
      }
      service_income_total += svc;
      part_sales_total += parts;
      material_expense_total += mat;
      net_total += netSum;
      charity_total_raw += charityRaw;
      charity_total_rounded += charityRounded;
      kaspi_tax_total += kaspiTax;
      owner_dividend_total += ownerDiv;
      manager_total += managerAmt;

      dailyRows.push({
        date: d,
        service_income: svc,
        part_sales: parts,
        net: netSum,
        day_closed: true,
      });
    } else {
      const svc = await getServiceIncomeTotal(serviceId, d);
      const mat = await getMaterialExpenseTotal(serviceId, d);
      const parts = await getPartSalesTotal(serviceId, d);
      const net = svc - mat;
      service_income_total += svc;
      part_sales_total += parts;
      material_expense_total += mat;
      net_total += net;

      dailyRows.push({
        date: d,
        service_income: svc,
        part_sales: parts,
        net,
        day_closed: false,
      });
    }
  }

  const { rows: carsRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM booking WHERE service_id = $1 AND date >= $2 AND date <= $3 AND status = 'completed'`,
    [serviceId, start_date, end_date]
  );
  const cars_count = Number(carsRows[0]?.cnt || 0);

  const { rows: clientsRows } = await pool.query(
    `SELECT COUNT(DISTINCT client_id) AS cnt FROM booking WHERE service_id = $1 AND date >= $2 AND date <= $3 AND status = 'completed' AND client_id IS NOT NULL`,
    [serviceId, start_date, end_date]
  );
  const unique_clients_count = Number(clientsRows[0]?.cnt || 0);

  const { rows: warrantyRows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM warranty w
     JOIN client c ON c.id = w.client_id AND c.service_id = $1
     WHERE w.completed_at >= $2::date AND w.completed_at::date <= $3`,
    [serviceId, start_date, end_date]
  );
  const warranty_jobs_count = Number(warrantyRows[0]?.cnt || 0);

  let warranty_used_count = 0;
  try {
    const { rows: warrantyUsedRows } = await pool.query(
      `SELECT COUNT(DISTINCT b.id) AS cnt
       FROM booking b
       JOIN booking_service bs ON bs.booking_id = b.id AND bs.warranty_mode = true
       WHERE b.service_id = $1 AND b.date >= $2 AND b.date <= $3 AND b.status = 'completed'`,
      [serviceId, start_date, end_date]
    );
    warranty_used_count = Number(warrantyUsedRows[0]?.cnt || 0);
  } catch (_) {
    warranty_used_count = 0;
  }

  let productivity = [];
  try {
    const { rows: productivityRows } = await pool.query(
      `SELECT bm.master_user_id, u.display_name AS master_name,
              COUNT(*) AS jobs_count,
              SUM(b.duration_minutes) AS sum_duration,
              AVG(b.duration_minutes) AS avg_duration,
              MIN(b.duration_minutes) AS min_duration,
              MAX(b.duration_minutes) AS max_duration
       FROM booking_master bm
       JOIN booking b ON b.id = bm.booking_id AND b.service_id = $1 AND b.status = 'completed' AND b.date >= $2 AND b.date <= $3
       JOIN "user" u ON u.id = bm.master_user_id
       GROUP BY bm.master_user_id, u.display_name
       ORDER BY sum_duration DESC NULLS LAST`,
      [serviceId, start_date, end_date]
    );
    productivity = (productivityRows || []).map((r) => ({
    master_user_id: r.master_user_id,
    master_name: r.master_name,
    jobs_count: Number(r.jobs_count || 0),
    sum_duration_minutes: r.sum_duration != null ? Number(r.sum_duration) : null,
    avg_duration_minutes: r.avg_duration != null ? Math.round(Number(r.avg_duration) * 10) / 10 : null,
    min_duration_minutes: r.min_duration != null ? Number(r.min_duration) : null,
    max_duration_minutes: r.max_duration != null ? Number(r.max_duration) : null,
  }));
  } catch (_) {
    productivity = [];
  }

  const days_count = dates.length;
  const avg_check = unique_clients_count > 0 ? service_income_total / unique_clients_count : 0;
  const avg_daily_income = days_count > 0 ? service_income_total / days_count : 0;

  let productivity_drill = null;
  if (opts.drill_master_user_id) {
    try {
      const { rows: drillRows } = await pool.query(
        `SELECT b.id, b.date, b.start_time, b.end_time, b.duration_minutes, b.service_payment_amount, v.name AS vehicle_name
         FROM booking_master bm
         JOIN booking b ON b.id = bm.booking_id AND b.service_id = $1 AND b.status = 'completed' AND b.date >= $2 AND b.date <= $3 AND bm.master_user_id = $4
         LEFT JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
         ORDER BY b.date DESC, b.completed_at DESC`,
        [serviceId, start_date, end_date, opts.drill_master_user_id]
      );
      productivity_drill = drillRows.map((r) => ({
        id: r.id,
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        start_time: r.start_time,
        end_time: r.end_time,
        duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
        service_payment_amount: r.service_payment_amount != null ? Number(r.service_payment_amount) : null,
        vehicle_name: r.vehicle_name,
      }));
    } catch (_) {
      productivity_drill = [];
    }
  }

  const wages_breakdown = {
    manager: manager_total,
    owner: owner_dividend_total,
    masters: Object.entries(masterTotalsByUser).map(([uid, o]) => ({
      master_user_id: uid,
      master_name: o.master_name,
      amount: o.amount,
    })),
  };

  const opex_totals = { lunch: 0, transport: 0, rent: 0 };
  const { rows: opexRows } = await pool.query(
    `SELECT COALESCE(SUM(opex_lunch), 0) AS lunch, COALESCE(SUM(opex_transport), 0) AS transport, COALESCE(SUM(opex_rent), 0) AS rent
     FROM day_close WHERE service_id = $1 AND date >= $2 AND date <= $3`,
    [serviceId, start_date, end_date]
  );
  if (opexRows[0]) {
    opex_totals.lunch = num(opexRows[0].lunch);
    opex_totals.transport = num(opexRows[0].transport);
    opex_totals.rent = num(opexRows[0].rent);
  }

  const result = {
    period: periodType,
    start_date,
    end_date,
    days_count,
    metrics: {
      service_income_total,
      part_sales_total,
      material_expense_total,
      net_total,
      charity_total_raw,
      charity_total_rounded,
      kaspi_tax_total,
      cars_count,
      unique_clients_count,
      warranty_jobs_count,
      warranty_used_count,
      avg_check: Math.round(avg_check * 100) / 100,
      avg_daily_income: Math.round(avg_daily_income * 100) / 100,
      owner_dividend_total,
      wages_breakdown,
      opex_totals,
      productivity,
    },
    daily_rows: dailyRows,
    day_close_list: dayCloseList.sort((a, b) => {
      const toStr = (d) => (d == null ? '' : typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
      return toStr(a.date).localeCompare(toStr(b.date));
    }),
  };
  if (productivity_drill !== null) result.productivity_drill = productivity_drill;
  return result;
}
