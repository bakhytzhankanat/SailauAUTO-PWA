import * as bookingService from '../services/bookingService.js';
import * as executionService from '../services/executionService.js';

export async function list(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const { date, box_id } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date қажет' });
  }
  const list = await bookingService.listByDate(date, box_id ? parseInt(box_id, 10) : null, serviceId);
  return res.json(list);
}

export async function getById(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  const booking = await bookingService.getById(req.params.id, serviceId);
  if (!booking) {
    return res.status(404).json({ error: 'Жазба табылмады' });
  }
  return res.json(booking);
}

export async function create(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const booking = await bookingService.create(serviceId, req.body);
    return res.status(201).json(booking);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function update(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const booking = await bookingService.updateStructure(req.params.id, serviceId, req.body);
    if (!booking) {
      return res.status(404).json({ error: 'Жазба табылмады' });
    }
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function start(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const assignedMasterId = req.body?.assigned_master_id || req.user?.id;
    const booking = await executionService.startBooking(req.params.id, serviceId, assignedMasterId);
    if (!booking) {
      return res.status(404).json({ error: 'Жазба табылмады' });
    }
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function complete(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const payload = req.body || {};
    const allowed = [
      'service_payment_amount',
      'payment_type',
      'material_expense',
      'kaspi_tax_amount',
      'part_sales',
      'warranty_service_ids',
      'master_user_ids',
    ];
    const filtered = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) filtered[key] = payload[key];
    }
    const booking = await executionService.completeBooking(req.params.id, serviceId, filtered);
    if (!booking) {
      return res.status(404).json({ error: 'Жазба табылмады' });
    }
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function updateCompletion(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) return res.status(403).json({ error: 'Рұқсат жоқ' });
  try {
    const payload = req.body || {};
    const allowed = ['service_payment_amount', 'payment_type', 'material_expense', 'part_sales'];
    const filtered = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) filtered[key] = payload[key];
    }
    const booking = await executionService.updateCompletion(req.params.id, serviceId, filtered);
    if (!booking) {
      return res.status(404).json({ error: 'Жазба табылмады' });
    }
    return res.json(booking);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
