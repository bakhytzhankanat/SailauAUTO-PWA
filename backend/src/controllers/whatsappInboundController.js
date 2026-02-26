import * as whatsappInboundService from '../services/whatsappInboundService.js';

export async function list(req, res) {
  const q = req.query.q || '';
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const items = await whatsappInboundService.listInbound(serviceId, { q });
  return res.json(items);
}
