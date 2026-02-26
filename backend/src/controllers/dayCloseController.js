import * as dayCloseService from '../services/dayCloseService.js';

export async function create(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const result = await dayCloseService.createSnapshot(serviceId, req.body, req.user);
    return res.status(201).json(result);
  } catch (e) {
    if (e.statusCode === 409) return res.status(409).json({ error: e.message });
    return res.status(400).json({ error: e.message });
  }
}

export async function getByDate(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const date = req.query.date || null;
  const shift_index = req.query.shift_index != null ? parseInt(req.query.shift_index, 10) : null;
  const result = await dayCloseService.getByDate(serviceId, date, Number.isFinite(shift_index) ? shift_index : null);
  return res.json(result);
}

export async function update(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const result = await dayCloseService.updateSnapshot(req.params.id, serviceId, req.body, req.user);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
