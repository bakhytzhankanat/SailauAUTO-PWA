import { pool } from '../db/pool.js';

/**
 * List inventory items (for payment screen part_sales dropdown). Scoped by service.
 */
export async function list(serviceId, nameFilter = null) {
  if (!serviceId) throw new Error('service_id қажет');
  let query = 'SELECT id, name, sku, sale_price_min, sale_price_max, quantity, min_quantity, unit FROM inventory_item WHERE service_id = $1';
  const params = [serviceId];
  if (nameFilter && nameFilter.trim()) {
    params.push(`%${nameFilter.trim()}%`);
    query += ` AND name ILIKE $${params.length}`;
  }
  query += ' ORDER BY name';
  const { rows } = await pool.query(query, params);
  return rows;
}
