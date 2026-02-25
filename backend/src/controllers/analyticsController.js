import * as analyticsService from '../services/analyticsService.js';

export async function getSummary(req, res) {
  try {
    const { period = 'day', date } = req.query;
    const result = await analyticsService.getSummary(period, date);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Bad request' });
  }
}
