import app from '../src/app.js';

const CORS_ORIGIN = 'https://sailau-auto-pwa-frontend.vercel.app';

function setCorsHeaders(res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  } catch (_) {}
}

export default function handler(req, res) {
  setCorsHeaders(res);
  const method = (req.method || req.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json({ ok: true });
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify({ ok: true })),
    });
    return res.end(JSON.stringify({ ok: true }));
  }
  // Vercel may pass path without /api prefix; Express expects /api/...
  const path = req.url?.split('?')[0] || '/';
  if (!path.startsWith('/api')) {
    const qs = req.url?.includes('?') ? '?' + req.url.split('?')[1] : '';
    req.url = '/api' + (path.startsWith('/') ? path : '/' + path) + qs;
  }
  return app(req, res);
}
