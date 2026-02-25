import * as whatsappInboundService from '../services/whatsappInboundService.js';

export async function list(req, res) {
  const q = req.query.q || '';
  const items = await whatsappInboundService.listInbound({ q });
  return res.json(items);
}
