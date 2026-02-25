import { pool } from '../db/pool.js';

/**
 * List inventory items (for payment screen part_sales dropdown). All authenticated can read.
 */
export async function list(nameFilter = null) {
  let query = 'SELECT id, name, sku, sale_price_min, sale_price_max, quantity, min_quantity, unit FROM inventory_item WHERE 1=1';
  const params = [];
  if (nameFilter && nameFilter.trim()) {
    params.push(`%${nameFilter.trim()}%`);
    query += ` AND name ILIKE $${params.length}`;
  }
  query += ' ORDER BY name';
  const { rows } = await pool.query(query, params);
  return rows;
}
