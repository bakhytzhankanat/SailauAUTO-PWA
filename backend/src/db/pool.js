import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DB_URL,
  // Close idle connections before the hosted database/pooler drops them silently.
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

// An idle client that the server disconnects emits 'error'; without a listener the process crashes.
pool.on('error', (err) => {
  console.error('Idle database client error:', err.message);
});
