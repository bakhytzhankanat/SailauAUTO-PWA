import { pool } from '../db/pool.js';

/**
 * List inventory items for management. Any role. Scoped by service.
 */
export async function list(serviceId, nameFilter = null) {
  if (!serviceId) throw new Error('service_id қажет');
  let query = `
    SELECT id, name, sale_price_min, sale_price_max, quantity, min_quantity, unit
    FROM inventory_item
    WHERE service_id = $1
  `;
  const params = [serviceId];
  if (nameFilter && nameFilter.trim()) {
    params.push(`%${nameFilter.trim()}%`);
    query += ` AND name ILIKE $${params.length}`;
  }
  query += ' ORDER BY name';
  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    ...r,
    low_stock: r.min_quantity != null && Number(r.quantity) <= Number(r.min_quantity),
  }));
}

/**
 * Create inventory item. Owner/Manager only. Scoped by service.
 */
export async function createItem(serviceId, data) {
  if (!serviceId) throw new Error('service_id қажет');
  const { name, sale_price_min, sale_price_max, quantity, min_quantity, unit } = data;
  if (!name || name.trim() === '') throw new Error('Атауы болуы керек');
  const qty = quantity != null ? Number(quantity) : 0;
  const minP = sale_price_min != null && sale_price_min !== '' ? Number(sale_price_min) : 0;
  const maxP = sale_price_max != null && sale_price_max !== '' ? Number(sale_price_max) : 0;
  if (!Number.isInteger(minP) || minP <= 0) throw new Error('Сату бағасы (мин) 0-ден үлкен бүтін сан болуы керек');
  if (!Number.isInteger(maxP) || maxP < minP) throw new Error('Сату бағасы (макс) мин-ден кем болмауы керек');
  if (qty < 0) throw new Error('Саны теріс болмауы керек');
  const minQty = min_quantity != null && min_quantity !== '' ? Number(min_quantity) : null;
  if (minQty != null && minQty < 0) throw new Error('Минималды қалдық теріс болмауы керек');
  const { rows } = await pool.query(
    `INSERT INTO inventory_item (service_id, name, sale_price_min, sale_price_max, quantity, min_quantity, unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, sale_price_min, sale_price_max, quantity, min_quantity, unit`,
    [serviceId, name.trim(), minP, maxP, qty, minQty, unit && unit.trim() ? unit.trim() : null]
  );
  const r = rows[0];
  return {
    ...r,
    low_stock: r.min_quantity != null && Number(r.quantity) <= Number(r.min_quantity),
  };
}

/**
 * Manual movement: in or out. Owner/Manager only. Scoped by service.
 */
export async function createMovement(serviceId, data) {
  if (!serviceId) throw new Error('service_id қажет');
  const { inventory_item_id, type, quantity: qtyParam, note } = data;
  if (!inventory_item_id) throw new Error('Тауар таңдалуы керек');
  if (type !== 'in' && type !== 'out') throw new Error('Түрі: in немесе out');
  const qty = Number(qtyParam);
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Саны 0-ден үлкен бүтін сан болуы керек');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: items } = await client.query(
      'SELECT id, quantity FROM inventory_item WHERE id = $1 AND service_id = $2 FOR UPDATE',
      [inventory_item_id, serviceId]
    );
    if (items.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Тауар табылмады');
    }
    const current = Number(items[0].quantity);

    if (type === 'out') {
      if (current < qty) {
        await client.query('ROLLBACK');
        throw new Error('Қалдық жеткіліксіз. Қалдық: ' + current);
      }
    }

    const newQty = type === 'in' ? current + qty : current - qty;
    await client.query(
      'UPDATE inventory_item SET quantity = $2, updated_at = now() WHERE id = $1',
      [inventory_item_id, newQty]
    );
    const amount = null;
    await client.query(
      `INSERT INTO inventory_movement (item_id, type, quantity, amount, ref_type, ref_id, note)
       VALUES ($1, $2, $3, $4, 'manual', NULL, $5)`,
      [inventory_item_id, type, qty, amount, note && note.trim() ? note.trim() : null]
    );
    await client.query('COMMIT');
    return { ok: true, new_quantity: newQty };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
