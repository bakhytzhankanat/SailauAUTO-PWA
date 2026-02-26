import * as analyticsService from '../services/analyticsService.js';

export async function getSummary(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const { period = 'day', date, drill } = req.query;
    const opts = drill ? { drill_master_user_id: drill } : {};
    const result = await analyticsService.getSummary(serviceId, period, date, opts);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Bad request' });
  }
}
