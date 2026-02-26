import * as inventoryService from '../services/inventoryService.js';

export async function list(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const name = req.query.name || null;
  const items = await inventoryService.list(serviceId, name);
  return res.json(items);
}

export async function create(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const item = await inventoryService.createItem(serviceId, req.body);
  return res.status(201).json(item);
}

export async function createMovement(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const result = await inventoryService.createMovement(serviceId, req.body);
  return res.status(201).json(result);
}

export async function remove(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    await inventoryService.deleteItem(serviceId, req.params.id);
    return res.status(204).send();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
