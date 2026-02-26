import * as inventoryItemService from '../services/inventoryItemService.js';

export async function list(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const name = req.query.name || null;
  const items = await inventoryItemService.list(serviceId, name);
  return res.json(items);
}
