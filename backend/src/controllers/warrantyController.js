import * as warrantyService from '../services/warrantyService.js';

export async function listExpiring(req, res) {
  const days = req.query.days ? parseInt(req.query.days, 10) : 7;
  const list = await warrantyService.listExpiring({ days });
  return res.json(list);
}
