/**
 * Edge Middleware: respond to OPTIONS (CORS preflight) with 200 + headers
 * before the request hits the Node.js serverless function.
 */
import { next } from '@vercel/functions';

const CORS_ORIGIN = 'https://sailau-auto-pwa-frontend.vercel.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request) {
  if ((request.method || '').toUpperCase() === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
  return next();
}
