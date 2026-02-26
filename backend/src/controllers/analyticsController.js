import * as analyticsService from '../services/analyticsService.js';

export async function getSummary(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const { period = 'day', date } = req.query;
    const result = await analyticsService.getSummary(serviceId, period, date);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Bad request' });
  }
}
