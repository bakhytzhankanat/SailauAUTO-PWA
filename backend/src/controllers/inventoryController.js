import * as inventoryService from '../services/inventoryService.js';

export async function list(req, res) {
  const name = req.query.name || null;
  const items = await inventoryService.list(name);
  return res.json(items);
}

export async function create(req, res) {
  const item = await inventoryService.createItem(req.body);
  return res.status(201).json(item);
}

export async function createMovement(req, res) {
  const result = await inventoryService.createMovement(req.body);
  return res.status(201).json(result);
}
