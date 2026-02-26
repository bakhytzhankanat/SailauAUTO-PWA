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
export async function getSummary(serviceId, period, date) {
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
    const { rows: dcRows } = await pool.query('SELECT * FROM day_close WHERE service_id = $1 AND date = $2', [serviceId, d]);
    if (dcRows.length > 0) {
      const dc = dcRows[0];
      const svc = num(dc.service_income_total);
      const parts = num(dc.part_sales_total);
      const mat = num(dc.material_expense_total);
      const net = num(dc.net_before_charity) - num(dc.charity_rounded);
      service_income_total += svc;
      part_sales_total += parts;
      material_expense_total += mat;
      net_total += net;
      charity_total_raw += num(dc.charity_raw);
      charity_total_rounded += num(dc.charity_rounded);
      kaspi_tax_total += num(dc.kaspi_tax_amount);
      owner_dividend_total += num(dc.owner_service_dividend) + num(dc.owner_parts_dividend);
      manager_total += num(dc.manager_amount);

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
        service_income_total: svc,
        part_sales_total: parts,
        net_before_charity: num(dc.net_before_charity),
        day_closed: true,
      });

      dailyRows.push({
        date: d,
        service_income: svc,
        part_sales: parts,
        net: num(dc.net_before_charity) - num(dc.charity_rounded),
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

  const days_count = dates.length;
  const avg_check = unique_clients_count > 0 ? service_income_total / unique_clients_count : 0;
  const avg_daily_income = days_count > 0 ? service_income_total / days_count : 0;

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

  return {
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
      avg_check: Math.round(avg_check * 100) / 100,
      avg_daily_income: Math.round(avg_daily_income * 100) / 100,
      owner_dividend_total,
      wages_breakdown,
      opex_totals,
    },
    daily_rows: dailyRows,
    day_close_list: dayCloseList.sort((a, b) => {
      const toStr = (d) => (d == null ? '' : typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
      return toStr(a.date).localeCompare(toStr(b.date));
    }),
  };
}
