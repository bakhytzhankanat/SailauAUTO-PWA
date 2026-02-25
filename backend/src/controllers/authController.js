import * as authService from '../services/authService.js';

export async function login(req, res) {
  const { phone, password } = req.body || {};
  const result = await authService.login(phone, password);
  if (result.error) {
    return res.status(401).json({ error: result.error });
  }
  return res.json(result);
}

export async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'Кіру қажет' });
  }
  return res.json({ user });
}
