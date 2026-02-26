import * as clientService from '../services/clientService.js';
import * as warrantyService from '../services/warrantyService.js';

export async function list(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const q = req.query.q || '';
  const clients = await clientService.search(serviceId, { q });
  return res.json(clients);
}

export async function getById(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const data = await clientService.getById(req.params.id, serviceId);
  if (!data) return res.status(404).json({ error: 'Клиент табылмады' });
  return res.json(data);
}

export async function listVisits(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const visits = await clientService.listVisits(req.params.id, serviceId);
  return res.json(visits);
}

export async function listWarranties(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const warranties = await warrantyService.listByClient(req.params.id, serviceId);
  return res.json(warranties);
}
