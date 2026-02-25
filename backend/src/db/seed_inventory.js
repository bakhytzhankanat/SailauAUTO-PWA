/**
 * Seed inventory items with sale_price_min / sale_price_max.
 * - Single price: "35000" -> min = max = 35000
 * - Range: "35-45 000" or "10 000 – 15 000" -> min, max (spaces and – allowed)
 * Upsert by name: update sale_price_min, sale_price_max, unit, min_quantity; never touch quantity.
 * Run: node src/db/seed_inventory.js
 */
import { pool } from './pool.js';

function parsePrice(str) {
  if (!str || typeof str !== 'string') return { min: 1, max: 1 };
  const trimmed = str.trim();
  const parts = trimmed.split(/[\-–]/).map((p) => parseInt(p.replace(/\s/g, ''), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[0] > 0 && parts[1] >= parts[0]) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseInt(trimmed.replace(/\s/g, '').replace(/\D/g, ''), 10);
  if (!Number.isNaN(single) && single > 0) {
    return { min: single, max: single };
  }
  return { min: 1, max: 1 };
}

const ITEMS = [
  { name: 'Трос комплект сиенна', price: '35 000', unit: 'дана', min_quantity: 0 },
  { name: 'Ручка простой', price: '10 000', unit: 'дана', min_quantity: 0 },
  { name: 'Ручка полухром', price: '12 000', unit: 'дана', min_quantity: 0 },
  { name: 'Ручка кнопкамен', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Озу айнасы (обгоночное зеркало)', price: '14 000', unit: 'дана', min_quantity: 0 },
  { name: 'Лампочка үлкен', price: '500', unit: 'дана', min_quantity: 0 },
  { name: 'Лампочка кіші (груша)', price: '300', unit: 'дана', min_quantity: 0 },
  { name: 'Лампочка мини (селекторға)', price: '200', unit: 'дана', min_quantity: 0 },
  { name: '3 стоп комплект', price: '5 000', unit: 'дана', min_quantity: 0 },
  { name: 'Капот тіреуіш пластигі', price: '1000', unit: 'дана', min_quantity: 0 },
  { name: 'Стақан тігеріш', price: '3000', unit: 'дана', min_quantity: 0 },
  { name: 'Ванна для дворника', price: '30 000', unit: 'дана', min_quantity: 0 },
  { name: 'Моторчик дворника', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Тропеция дворника', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Щёткадержатель комплект', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Концевик', price: '3 000', unit: 'дана', min_quantity: 0 },
  { name: 'Трос крышкасы', price: '10 000', unit: 'дана', min_quantity: 0 },
  { name: 'Терезе заглушкасы', price: '5 000', unit: 'дана', min_quantity: 0 },
  { name: 'Комплект трос', price: '35 000 – 45 000', unit: 'дана', min_quantity: 0 },
  { name: 'Артқы топса', price: '12 000', unit: 'дана', min_quantity: 0 },
  { name: 'Төменгі ролик', price: '12 000', unit: 'дана', min_quantity: 0 },
  { name: 'Жанасу сенсоры', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Сыртқы тұтқа', price: '10 000 – 15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Ішкі тұтқа', price: '10 000', unit: 'дана', min_quantity: 0 },
  { name: 'Сорғыш (присоска)', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Шлейф', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Басқару блогы', price: '15 000', unit: 'дана', min_quantity: 0 },
  { name: 'Пеш радиаторы', price: '16 000', unit: 'дана', min_quantity: 0 },
  { name: 'Серво жетек', price: '15 000', unit: 'дана', min_quantity: 0 },
];

async function seedInventory() {
  const client = await pool.connect();
  const result = [];
  const names = ITEMS.map((r) => r.name.trim());
  try {
    await client.query('BEGIN');
    const { rows: toDelete } = await client.query(
      `SELECT id FROM inventory_item WHERE NOT (name = ANY($1::text[]))`,
      [names]
    );
    const idsToDelete = toDelete.map((r) => r.id);
    if (idsToDelete.length > 0) {
      await client.query('DELETE FROM part_sale WHERE inventory_item_id = ANY($1)', [idsToDelete]);
      await client.query('DELETE FROM inventory_movement WHERE item_id = ANY($1)', [idsToDelete]);
      await client.query('DELETE FROM inventory_item WHERE id = ANY($1)', [idsToDelete]);
      console.log('Removed', idsToDelete.length, 'old items not in list');
    }
    for (const row of ITEMS) {
      const { min, max } = parsePrice(row.price);
      const unit = row.unit && row.unit.trim() ? row.unit.trim() : null;
      const minQty = row.min_quantity != null ? Number(row.min_quantity) : null;

      const { rows: existing } = await client.query(
        'SELECT id, quantity FROM inventory_item WHERE name = $1',
        [row.name.trim()]
      );
      if (existing.length > 0) {
        await client.query(
          `UPDATE inventory_item SET sale_price_min = $2, sale_price_max = $3, unit = $4, min_quantity = $5, updated_at = now() WHERE id = $1`,
          [existing[0].id, min, max, unit, minQty]
        );
        result.push({ name: row.name, min, max, quantity: existing[0].quantity });
      } else {
        await client.query(
          `INSERT INTO inventory_item (name, sale_price_min, sale_price_max, quantity, min_quantity, unit)
           VALUES ($1, $2, $3, 0, $4, $5)`,
          [row.name.trim(), min, max, minQty, unit]
        );
        result.push({ name: row.name, min, max, quantity: 0 });
      }
    }
    await client.query('COMMIT');
    console.log('Seed inventory: upserted', result.length, 'items');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seedInventory().catch((err) => {
  console.error(err);
  process.exit(1);
});
