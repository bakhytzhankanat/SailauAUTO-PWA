/**
 * Vercel serverless: /api/* requests go here. Forward to Express app.
 */
import app from '../src/app.js';

const CORS_ORIGIN = 'https://sailau-auto-pwa-frontend.vercel.app';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCors(res);
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }
  // Ensure path has /api prefix for Express routes (Vercel may pass path without it)
  let path = (req.url || '/').split('?')[0];
  if (!path.startsWith('/api')) {
    path = '/api' + (path.startsWith('/') ? path : '/' + path);
    const qs = (req.url || '').includes('?') ? '?' + (req.url || '').split('?')[1] : '';
    req.url = path + qs;
  }
  return app(req, res);
}
