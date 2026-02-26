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
    `SELECT id, category_id, name, subgroup,
            applicable_to_vehicle_models, applicable_to_body_types, warranty_mode
     FROM service_catalog ORDER BY category_id, subgroup NULLS LAST, name`
  );
  return rows.map((r) => ({
    ...r,
    applicable_to_vehicle_models: r.applicable_to_vehicle_models ?? null,
    applicable_to_body_types: r.applicable_to_body_types ?? null,
    warranty_mode: Boolean(r.warranty_mode),
  }));
}

/**
 * Filter services by vehicle: include if service has no restrictions, or vehicle_catalog_id/body_type matches.
 */
function serviceAppliesToVehicle(service, vehicleCatalogId, bodyType) {
  const vid = service.applicable_to_vehicle_models;
  const btypes = service.applicable_to_body_types;
  const noVehicleFilter = !vid || (Array.isArray(vid) && vid.length === 0);
  const noBodyFilter = !btypes || (Array.isArray(btypes) && btypes.length === 0);
  if (noVehicleFilter && noBodyFilter) return true;
  const vStr = vehicleCatalogId != null ? String(vehicleCatalogId) : '';
  const vehicleMatch = noVehicleFilter || (Array.isArray(vid) && vid.some((id) => String(id) === vStr));
  const bodyMatch = noBodyFilter || (bodyType && Array.isArray(btypes) && btypes.includes(String(bodyType)));
  return vehicleMatch || bodyMatch;
}

/** Get categories with nested services for wizard; optional filter by vehicle. */
export async function getCategoriesWithServices(vehicleCatalogId = null, bodyType = null) {
  const categories = await getServiceCategories();
  const services = await getServiceCatalog();
  const filtered = vehicleCatalogId || bodyType
    ? services.filter((s) => serviceAppliesToVehicle(s, vehicleCatalogId, bodyType))
    : services;
  return categories.map((cat) => ({
    ...cat,
    services: filtered.filter((s) => s.category_id === cat.id),
  }));
}
