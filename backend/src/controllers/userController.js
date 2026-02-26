import * as userService from '../services/userService.js';

export async function list(req, res) {
  const serviceId = req.user.service_id;
  const staff = await userService.listStaff(serviceId);
  return res.json(staff);
}

export async function listWorkers(req, res) {
  const serviceId = req.user.service_id;
  const workers = await userService.listWorkers(serviceId);
  return res.json(workers);
}

export async function create(req, res) {
  const serviceId = req.user.service_id;
  try {
    const user = await userService.createUser(serviceId, req.body);
    return res.status(201).json(user);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function updateUser(req, res) {
  const serviceId = req.user.service_id;
  const user = await userService.updateUser(req.params.id, serviceId, req.body);
  return res.json(user);
}
