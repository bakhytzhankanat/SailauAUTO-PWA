import * as warrantyService from '../services/warrantyService.js';

export async function listExpiring(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const days = req.query.days ? parseInt(req.query.days, 10) : 7;
  const list = await warrantyService.listExpiring(serviceId, { days });
  return res.json(list);
}
