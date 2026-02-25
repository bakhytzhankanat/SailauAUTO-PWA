import * as settingsService from '../services/settingsService.js';

export async function getAll(req, res) {
  const settings = await settingsService.getAll();
  return res.json(settings);
}

export async function update(req, res) {
  try {
    const settings = await settingsService.updateKeyValues(req.body.keyValues || {});
    return res.json(settings);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
