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
  // Build path: Vercel catch-all [[...path]] may put segments in req.query.path or pass full req.url
  const rawUrl = req.url || '';
  let path = rawUrl.split('?')[0].replace(/^\/+/, '') || '';
  const pathSegments = req.query && req.query.path;
  const segments = Array.isArray(pathSegments)
    ? pathSegments
    : pathSegments != null && pathSegments !== ''
      ? [String(pathSegments)]
      : null;
  if (segments && segments.length > 0) {
    path = '/api/' + segments.join('/');
  } else if (!path || path === '/') {
    path = '/api';
  } else if (!path.startsWith('api')) {
    path = '/api/' + path;
  } else {
    path = '/' + path;
  }
  const qs = rawUrl.includes('?') ? '?' + rawUrl.split('?').slice(1).join('?') : '';
  req.url = path.replace(/\/+/g, '/') + qs;
  return app(req, res);
}
