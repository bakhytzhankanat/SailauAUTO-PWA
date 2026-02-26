import * as reminderService from '../services/reminderService.js';

export async function list(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const status = req.query.status || 'all';
  const items = await reminderService.list(serviceId, { status });
  return res.json(items);
}

export async function create(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const item = await reminderService.create(serviceId, req.body, req.user);
  return res.status(201).json(item);
}

export async function updateStatus(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const { status } = req.body;
  const item = await reminderService.updateStatus(req.params.id, serviceId, status, req.user);
  return res.json(item);
}

export async function deleteReminder(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    await reminderService.deleteReminder(req.params.id, serviceId, req.user);
    return res.json({ ok: true });
  } catch (e) {
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    return res.status(400).json({ error: e.message });
  }
}

export async function clearDone(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const result = await reminderService.clearDone(serviceId, req.user);
    return res.json(result);
  } catch (e) {
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    return res.status(400).json({ error: e.message });
  }
}
