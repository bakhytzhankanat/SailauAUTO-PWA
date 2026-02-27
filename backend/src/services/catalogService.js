import { pool } from '../db/pool.js';

/** ID услуги "Гарантия" — всегда показывать для всех машин */
const GUARANTEE_SERVICE_ID = 'b0000000-0000-0000-0000-000000000099';
/** ID категории "Гарантия" — всегда первой в списке (не среди дополнительных) */
const GUARANTEE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000004';

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
  let rows = [];
  try {
    const res = await pool.query(
      `SELECT id, category_id, name, subgroup,
              applicable_to_vehicle_models, applicable_to_body_types, warranty_mode
       FROM service_catalog ORDER BY category_id, subgroup NULLS LAST, name`
    );
    rows = (res.rows || []).map((r) => ({
      ...r,
      applicable_to_vehicle_models: r.applicable_to_vehicle_models ?? null,
      applicable_to_body_types: r.applicable_to_body_types ?? null,
      warranty_mode: Boolean(r.warranty_mode),
    }));
  } catch (_) {
    const res = await pool.query(
      `SELECT id, category_id, name, subgroup FROM service_catalog ORDER BY category_id, subgroup NULLS LAST, name`
    );
    rows = (res.rows || []).map((r) => ({
      ...r,
      applicable_to_vehicle_models: null,
      applicable_to_body_types: null,
      warranty_mode: false,
    }));
  }
  return rows;
}

/**
 * Filter services by vehicle: include if service has no restrictions, or vehicle_catalog_id/body_type matches.
 * Warranty (Guarantee) service is always visible for all vehicles (by ID and by warranty_mode).
 */
function serviceAppliesToVehicle(service, vehicleCatalogId, bodyType) {
  if (String(service.id) === GUARANTEE_SERVICE_ID || service.warranty_mode) return true;
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

export async function createService({ category_id, name, subgroup, applicable_to_vehicle_models, applicable_to_body_types }) {
  if (!category_id || !name) throw new Error('category_id және name міндетті');
  const vModels = Array.isArray(applicable_to_vehicle_models) && applicable_to_vehicle_models.length > 0
    ? applicable_to_vehicle_models : null;
  const bTypes = Array.isArray(applicable_to_body_types) && applicable_to_body_types.length > 0
    ? applicable_to_body_types : null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO service_catalog (category_id, name, subgroup, applicable_to_vehicle_models, applicable_to_body_types)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [category_id, name.trim(), subgroup || null, vModels, bTypes]
    );
    return rows[0];
  } catch (_) {
    const { rows } = await pool.query(
      `INSERT INTO service_catalog (category_id, name, subgroup) VALUES ($1, $2, $3) RETURNING *`,
      [category_id, name.trim(), subgroup || null]
    );
    return rows[0];
  }
}

export async function deleteService(id) {
  const { rowCount } = await pool.query('DELETE FROM service_catalog WHERE id = $1', [id]);
  return rowCount > 0;
}

/** Get categories with nested services for wizard; optional filter by vehicle. */
export async function getCategoriesWithServices(vehicleCatalogId = null, bodyType = null) {
  const categories = await getServiceCategories();
  const services = await getServiceCatalog();
  const filtered = vehicleCatalogId || bodyType
    ? services.filter((s) => serviceAppliesToVehicle(s, vehicleCatalogId, bodyType))
    : services;
  const guarantee = services.find((s) => String(s.id) === GUARANTEE_SERVICE_ID);
  const hasGuarantee = guarantee && filtered.some((s) => String(s.id) === GUARANTEE_SERVICE_ID);
  if (guarantee && !hasGuarantee) {
    filtered.push(guarantee);
  }
  const result = categories.map((cat) => ({
    ...cat,
    services: filtered.filter((s) => s.category_id === cat.id),
  }));
  result.sort((a, b) => {
    if (String(a.id) === GUARANTEE_CATEGORY_ID) return -1;
    if (String(b.id) === GUARANTEE_CATEGORY_ID) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return result;
}
