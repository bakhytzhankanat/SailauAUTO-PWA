import * as adminService from '../services/adminService.js';

export async function listOwners(req, res) {
  const owners = await adminService.listOwners();
  return res.json(owners);
}

export async function createOwner(req, res) {
  try {
    const owner = await adminService.createOwner(req.body);
    return res.status(201).json(owner);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
