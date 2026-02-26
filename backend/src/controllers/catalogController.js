import * as catalogService from '../services/catalogService.js';

export async function getVehicleCatalog(req, res) {
  const list = await catalogService.getVehicleCatalog();
  return res.json(list);
}

export async function getServiceCatalog(req, res) {
  const list = await catalogService.getServiceCatalog();
  return res.json(list);
}

export async function getServiceCategories(req, res) {
  const list = await catalogService.getServiceCategories();
  return res.json(list);
}

export async function getCategoriesWithServices(req, res) {
  const vehicleCatalogId = req.query.vehicle_catalog_id || null;
  const bodyType = req.query.body_type || null;
  const list = await catalogService.getCategoriesWithServices(vehicleCatalogId, bodyType);
  return res.json(list);
}
