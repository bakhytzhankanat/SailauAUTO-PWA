import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const DEFAULT_OWNER_PHONE = process.env.SEED_OWNER_PHONE || '+77001234567';
const DEFAULT_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'owner123';

async function seed() {
  const hash = await bcrypt.hash(DEFAULT_OWNER_PASSWORD, 10);
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO "user" (phone, password_hash, role, display_name, is_senior_worker)
       VALUES ($1, $2, 'owner', 'Иесі', true)
       ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [DEFAULT_OWNER_PHONE, hash]
    );
    console.log('Seed: owner user created/updated. Phone:', DEFAULT_OWNER_PHONE);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
