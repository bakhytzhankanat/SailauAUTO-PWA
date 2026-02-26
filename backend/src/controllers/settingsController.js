import * as settingsService from '../services/settingsService.js';

export async function getAll(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const settings = await settingsService.getAll(serviceId);
  return res.json(settings);
}

export async function update(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const settings = await settingsService.updateKeyValues(serviceId, req.body.keyValues || {});
    return res.json(settings);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
