import * as reminderService from '../services/reminderService.js';

export async function list(req, res) {
  const status = req.query.status || 'all';
  const items = await reminderService.list({ status });
  return res.json(items);
}

export async function create(req, res) {
  const item = await reminderService.create(req.body, req.user);
  return res.status(201).json(item);
}

export async function updateStatus(req, res) {
  const { status } = req.body;
  const item = await reminderService.updateStatus(req.params.id, status, req.user);
  return res.json(item);
}

export async function deleteReminder(req, res) {
  try {
    await reminderService.deleteReminder(req.params.id, req.user);
    return res.json({ ok: true });
  } catch (e) {
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    return res.status(400).json({ error: e.message });
  }
}

export async function clearDone(req, res) {
  try {
    const result = await reminderService.clearDone(req.user);
    return res.json(result);
  } catch (e) {
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    return res.status(400).json({ error: e.message });
  }
}
