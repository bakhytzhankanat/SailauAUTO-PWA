import * as inventoryItemService from '../services/inventoryItemService.js';

export async function list(req, res) {
  const name = req.query.name || null;
  const items = await inventoryItemService.list(name);
  return res.json(items);
}
