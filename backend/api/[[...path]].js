import app from '../src/app.js';

const CORS_ORIGIN = 'https://sailau-auto-pwa-frontend.vercel.app';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  // Vercel may pass path without /api prefix; Express expects /api/...
  const path = req.url?.split('?')[0] || '/';
  if (!path.startsWith('/api')) {
    req.url = '/api' + (path.startsWith('/') ? path : '/' + path) + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
  }
  return app(req, res);
}
