import * as authService from '../services/authService.js';

export async function login(req, res) {
  try {
    const { phone, password } = req.body || {};
    const result = await authService.login(phone, password);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
    return res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    const message = err.code === '28P01' ? 'Дерекқор қосылу қатесі. DB_URL тексеріңіз.' : (err.message || 'Сервер қатесі');
    return res.status(500).json({ error: message });
  }
}

export async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'Кіру қажет' });
  }
  return res.json({ user });
}
