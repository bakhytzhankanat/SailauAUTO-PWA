import * as clientService from '../services/clientService.js';
import * as warrantyService from '../services/warrantyService.js';

export async function list(req, res) {
  const q = req.query.q || '';
  const clients = await clientService.search({ q });
  return res.json(clients);
}

export async function getById(req, res) {
  const data = await clientService.getById(req.params.id);
  if (!data) return res.status(404).json({ error: 'Клиент табылмады' });
  return res.json(data);
}

export async function listVisits(req, res) {
  const visits = await clientService.listVisits(req.params.id);
  return res.json(visits);
}

export async function listWarranties(req, res) {
  const warranties = await warrantyService.listByClient(req.params.id);
  return res.json(warranties);
}
