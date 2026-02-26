import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const DEFAULT_OWNER_PHONE = process.env.SEED_OWNER_PHONE || '+77001234567';
const DEFAULT_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'owner123';
const SUPER_ADMIN_PHONE = process.env.SEED_SUPER_ADMIN_PHONE || '';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || '';

async function seed() {
  const client = await pool.connect();
  try {
    const { rows: serviceRows } = await client.query('SELECT id FROM service LIMIT 1');
    const serviceId = serviceRows[0]?.id || null;

    if (serviceId) {
      const ownerHash = await bcrypt.hash(DEFAULT_OWNER_PASSWORD, 10);
      await client.query(
        `INSERT INTO "user" (phone, password_hash, role, display_name, is_senior_worker, service_id)
         VALUES ($1, $2, 'owner', 'Иесі', true, $3)
         ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, service_id = EXCLUDED.service_id`,
        [DEFAULT_OWNER_PHONE, ownerHash, serviceId]
      );
      console.log('Seed: owner user created/updated. Phone:', DEFAULT_OWNER_PHONE);
    }

    if (SUPER_ADMIN_PHONE && SUPER_ADMIN_PASSWORD.length >= 6) {
      const superHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
      await client.query(
        `INSERT INTO "user" (phone, password_hash, role, display_name, service_id)
         VALUES ($1, $2, 'super_admin', 'Платформа админі', NULL)
         ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin', service_id = NULL`,
        [SUPER_ADMIN_PHONE.replace(/\s/g, '').trim(), superHash]
      );
      console.log('Seed: super_admin user created/updated. Phone:', SUPER_ADMIN_PHONE);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
