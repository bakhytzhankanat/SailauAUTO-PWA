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
  const list = await catalogService.getCategoriesWithServices();
  return res.json(list);
}
