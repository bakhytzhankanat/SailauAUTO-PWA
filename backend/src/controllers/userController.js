import * as userService from '../services/userService.js';

export async function list(req, res) {
  const staff = await userService.listStaff();
  return res.json(staff);
}

export async function listWorkers(req, res) {
  const workers = await userService.listWorkers();
  return res.json(workers);
}

export async function create(req, res) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json(user);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body);
  return res.json(user);
}
