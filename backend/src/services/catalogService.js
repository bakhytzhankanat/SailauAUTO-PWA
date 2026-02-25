import { pool } from '../db/pool.js';

export async function getVehicleCatalog() {
  const { rows } = await pool.query(
    `SELECT id, name, body_type, year, body_options FROM vehicle_catalog ORDER BY name`
  );
  return rows.map((r) => ({
    ...r,
    body_options: r.body_options != null && Array.isArray(r.body_options) ? r.body_options : null,
  }));
}

export async function getServiceCategories() {
  const { rows } = await pool.query(
    'SELECT id, name, sort_order FROM service_category ORDER BY sort_order, name'
  );
  return rows;
}

export async function getServiceCatalog() {
  const { rows } = await pool.query(
    `SELECT id, category_id, name, subgroup FROM service_catalog ORDER BY category_id, subgroup NULLS LAST, name`
  );
  return rows;
}

/** Get categories with nested services for wizard */
export async function getCategoriesWithServices() {
  const categories = await getServiceCategories();
  const services = await getServiceCatalog();
  return categories.map((cat) => ({
    ...cat,
    services: services.filter((s) => s.category_id === cat.id),
  }));
}
