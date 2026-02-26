import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import catalogsRoutes from './routes/catalogs.js';
import clientsRoutes from './routes/clients.js';
import bookingsRoutes from './routes/bookings.js';
import inventoryItemsRoutes from './routes/inventoryItems.js';
import inventoryRoutes from './routes/inventory.js';
import dayCloseRoutes from './routes/dayClose.js';
import warrantiesRoutes from './routes/warranties.js';
import remindersRoutes from './routes/reminders.js';
import webhooksRoutes from './routes/webhooks.js';
import whatsappInboundRoutes from './routes/whatsappInbound.js';
import usersRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';

const app = express();

// CORS: allow frontend origin, handle preflight (must run before routes)
const allowOrigin = process.env.CORS_ORIGIN || true;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', allowOrigin === true ? origin : allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(cors({ origin: allowOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', catalogsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/inventory-items', inventoryItemsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/day-close', dayCloseRoutes);
app.use('/api/warranties', warrantiesRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/whatsapp-inbound', whatsappInboundRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
