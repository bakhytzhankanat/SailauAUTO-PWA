import app from '../src/app.js';

export default function handler(req, res) {
  // Vercel may pass path without /api prefix; Express expects /api/...
  const path = req.url?.split('?')[0] || '/';
  if (!path.startsWith('/api')) {
    req.url = '/api' + (path.startsWith('/') ? path : '/' + path) + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : '');
  }
  return app(req, res);
}
