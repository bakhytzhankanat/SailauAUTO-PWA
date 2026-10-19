import { pool } from '../db/pool.js';
import { getById } from './bookingService.js';
import { isLowStockThresholdCrossing, queuePush } from './pushService.js';
import { dispatchPushEvent, PUSH_EVENT_TYPES } from './notificationEventService.js';

const DOOR_SIDES = ['left', 'right', 'both'];

/** 'left' | 'right' | 'both' | null (anything else clears the choice). */
export function normalizeDoorSide(value) {
  return DOOR_SIDES.includes(value) ? value : null;
}

/**
 * Save door choices for booking services: [{ booking_service_id, door_side }].
 * Runs in a savepoint so a database without migration 048 still completes the booking.
 */
async function saveServiceDoors(client, bookingId, serviceDoors) {
  const entries = (Array.isArray(serviceDoors) ? serviceDoors : []).filter((d) => d && d.booking_service_id);
  if (entries.length === 0) return;
  await client.query('SAVEPOINT sp_doors');
  try {
    for (const d of entries) {
      await client.query(
        'UPDATE booking_service SET door_side = $3 WHERE id = $1 AND booking_id = $2',
        [d.booking_service_id, bookingId, normalizeDoorSide(d.door_side)]
      );
    }
    await client.query('RELEASE SAVEPOINT sp_doors');
  } catch (err) {
    console.warn('Saving door sides skipped:', err.message);
    await client.query('ROLLBACK TO SAVEPOINT sp_doors');
  }
}

/**
 * Start job: status planned|arrived → in_progress, started_at = now().
 * Allowed: worker, owner.
 */
export async function startBooking(id, serviceId, assignedMasterId = null) {
  const booking = await getById(id, serviceId);
  if (!booking) return null;
  if (booking.status !== 'planned' && booking.status !== 'arrived') {
    throw new Error('Жазбаны тек жоспарланған немесе келді күйінде бастауға болады');
  }
  await pool.query(
    `UPDATE booking SET status = 'in_progress', started_at = now(), updated_at = now(),
     assigned_master_id = COALESCE($2, assigned_master_id) WHERE id = $1 AND service_id = $3`,
    [id, assignedMasterId, serviceId]
  );
  return getById(id, serviceId);
}

/**
 * Complete booking: in_progress → completed.
 * Payload: service_payment_amount, payment_type, material_expense, kaspi_tax_amount (optional),
 * part_sales: [{ inventory_item_id, quantity, unit_price }], warranty_service_ids: [uuid],
 * service_doors: [{ booking_service_id, door_side: 'left'|'right'|'both'|null }] (optional).
 * unit_price required; must be in [sale_price_min, sale_price_max].
 * Creates client if booking.client_id is null; creates warranty rows; creates part_sale + decrements inventory + movement.
 */
export async function completeBooking(id, serviceId, payload) {
  const booking = await getById(id, serviceId);
  if (!booking) return null;
  if (booking.status !== 'in_progress') {
    throw new Error('Тек жұмыс үстіндегі жазбаны аяқтауға болады');
  }
  if (!booking.started_at) {
    throw new Error('Жазбаны басталмаған күйде аяқтауға болмайды. Алдымен жұмысты бастаңыз.');
  }
  const sid = booking.service_id || serviceId;
  const lowStockItems = [];

  const {
    service_payment_amount,
    payment_type,
    material_expense,
    kaspi_tax_amount: payloadKaspiTax,
    part_sales = [],
    warranty_service_ids = [],
    master_user_ids = [],
    service_doors = [],
  } = payload;

  let kaspi_tax_amount = payloadKaspiTax != null ? Number(payloadKaspiTax) : null;
  if (payment_type === 'kaspipay' && service_payment_amount != null && (kaspi_tax_amount == null || kaspi_tax_amount === '')) {
    kaspi_tax_amount = Math.round(Number(service_payment_amount) * 0.04 * 100) / 100;
  }
  if (payment_type === 'cash' || payment_type !== 'kaspipay') {
    kaspi_tax_amount = kaspi_tax_amount ?? 0;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let clientId = booking.client_id;
    if (!clientId && booking.client_name && booking.phone) {
      const { rows: existing } = await client.query(
        'SELECT id FROM client WHERE service_id = $1 AND phone = $2',
        [sid, booking.phone.trim()]
      );
      if (existing.length > 0) {
        clientId = existing[0].id;
        await client.query(
          'UPDATE client SET name = $2, updated_at = now() WHERE id = $1',
          [clientId, booking.client_name.trim()]
        );
      } else {
        const { rows: [newClient] } = await client.query(
          `INSERT INTO client (service_id, name, phone, source) VALUES ($1, $2, $3, $4) RETURNING id`,
          [sid, booking.client_name.trim(), booking.phone.trim(), booking.source]
        );
        clientId = newClient.id;
      }
      await client.query(
        'UPDATE booking SET client_id = $2, updated_at = now() WHERE id = $1',
        [id, clientId]
      );
    }
    if (clientId && (booking.vehicle_name != null || booking.plate_number != null)) {
      await client.query('SAVEPOINT sp_client_body');
      try {
        await client.query(
          'UPDATE client SET last_vehicle_name = COALESCE($2, last_vehicle_name), last_plate_number = COALESCE($3, last_plate_number), last_body_type = COALESCE($4, last_body_type), updated_at = now() WHERE id = $1',
          [clientId, booking.vehicle_name || null, booking.plate_number || null, booking.body_type || null]
        );
        await client.query('RELEASE SAVEPOINT sp_client_body');
      } catch (_) {
        await client.query('ROLLBACK TO SAVEPOINT sp_client_body');
        await client.query(
          'UPDATE client SET last_vehicle_name = COALESCE($2, last_vehicle_name), last_plate_number = COALESCE($3, last_plate_number), updated_at = now() WHERE id = $1',
          [clientId, booking.vehicle_name || null, booking.plate_number || null]
        );
      }
    }

    const completedAt = new Date();
    const startedAt = new Date(booking.started_at);
    const durationMinutes = Math.max(0, Math.floor((completedAt - startedAt) / 60000));
    const expiresAt = new Date(completedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 3);
    const expiresAtDate = expiresAt.toISOString().slice(0, 10);

    await client.query(
      `UPDATE booking SET
        status = 'completed', completed_at = $2, duration_minutes = $3, updated_at = now(),
        service_payment_amount = $4, payment_type = $5, material_expense = $6, kaspi_tax_amount = $7
       WHERE id = $1 AND service_id = $8`,
      [
        id,
        completedAt,
        durationMinutes,
        service_payment_amount != null ? Number(service_payment_amount) : null,
        payment_type || null,
        material_expense != null ? Number(material_expense) : null,
        kaspi_tax_amount != null ? Number(kaspi_tax_amount) : null,
        sid,
      ]
    );

    await saveServiceDoors(client, id, service_doors);

    if (clientId && warranty_service_ids.length > 0) {
      const warrantyMasterId = booking.assigned_master_id || (booking.masters && booking.masters[0] && booking.masters[0].master_user_id) || null;
      for (const serviceCatalogId of warranty_service_ids) {
        await client.query('SAVEPOINT sp_warranty');
        try {
          await client.query(
            `INSERT INTO warranty (client_id, booking_id, service_catalog_id, completed_at, expires_at, master_user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (booking_id, service_catalog_id) DO UPDATE SET master_user_id = EXCLUDED.master_user_id`,
            [clientId, id, serviceCatalogId, completedAt, expiresAtDate, warrantyMasterId]
          );
          await client.query('RELEASE SAVEPOINT sp_warranty');
        } catch (_) {
          await client.query('ROLLBACK TO SAVEPOINT sp_warranty');
          await client.query(
            `INSERT INTO warranty (client_id, booking_id, service_catalog_id, completed_at, expires_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (booking_id, service_catalog_id) DO NOTHING`,
            [clientId, id, serviceCatalogId, completedAt, expiresAtDate]
          );
        }
      }
    }

    for (const line of part_sales) {
      const { inventory_item_id, quantity, unit_price: payloadUnitPrice } = line;
      const qty = Math.max(1, parseInt(quantity, 10) || 1);
      if (payloadUnitPrice == null || payloadUnitPrice === '') {
        throw new Error('Бөлшек үшін сату бағасы (unit_price) көрсетілуі керек');
      }
      const unitPrice = Number(payloadUnitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error('Сату бағасы жарамды сан болуы керек');
      }
      const { rows: items } = await client.query(
        'SELECT id, name, sale_price_min, sale_price_max, quantity, min_quantity, unit FROM inventory_item WHERE id = $1 AND service_id = $2 FOR UPDATE',
        [inventory_item_id, sid]
      );
      if (items.length === 0) throw new Error(`Бөлшек табылмады: ${inventory_item_id}`);
      const item = items[0];
      const minP = Number(item.sale_price_min);
      const maxP = Number(item.sale_price_max);
      if (unitPrice < minP || unitPrice > maxP) {
        throw new Error(`Сату бағасы ${minP}–${maxP} аралығында болуы керек`);
      }
      if (item.quantity < qty) throw new Error(`Қоймада жеткіліксіз: ${item.quantity} < ${qty}`);
      await client.query(
        'INSERT INTO part_sale (booking_id, inventory_item_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [id, inventory_item_id, qty, unitPrice]
      );
      const nextQuantity = Number(item.quantity) - qty;
      await client.query(
        'UPDATE inventory_item SET quantity = $2, updated_at = now() WHERE id = $1',
        [inventory_item_id, nextQuantity]
      );
      const movement = await client.query(
        `INSERT INTO inventory_movement (item_id, type, quantity, amount, ref_type, ref_id)
         VALUES ($1, 'sale', $2, $3, 'booking_completion', $4)
         RETURNING id`,
        [inventory_item_id, qty, qty * unitPrice, id]
      );
      if (isLowStockThresholdCrossing(item.quantity, nextQuantity, item.min_quantity)) {
        lowStockItems.push({ id: item.id, name: item.name, quantity: nextQuantity, unit: item.unit, movement_id: movement.rows[0].id });
      }
    }

    const mids = Array.isArray(master_user_ids) ? master_user_ids.filter(Boolean) : [];
    if (mids.length > 0) {
      await client.query('SAVEPOINT sp_masters');
      try {
        await client.query('DELETE FROM booking_master WHERE booking_id = $1', [id]);
        for (const mid of mids) {
          await client.query(
            'INSERT INTO booking_master (booking_id, master_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, mid]
          );
        }
        await client.query(
          'UPDATE booking SET assigned_master_id = $2, updated_at = now() WHERE id = $1',
          [id, mids[0]]
        );
        await client.query('RELEASE SAVEPOINT sp_masters');
      } catch (_) {
        await client.query('ROLLBACK TO SAVEPOINT sp_masters');
      }
    }

    await client.query('COMMIT');
    const completedBooking = await getById(id, serviceId);
    for (const item of lowStockItems) {
      queuePush(() => dispatchPushEvent({ serviceId: sid, type: PUSH_EVENT_TYPES.INVENTORY_LOW, entity: item }), 'low stock');
    }
    return completedBooking;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Update completion data of an already completed booking (price, payment type, material expense, part sales).
 * Owner/Manager only. Reverts old part_sales to inventory, then applies new part_sales.
 */
export async function updateCompletion(id, serviceId, payload) {
  const booking = await getById(id, serviceId);
  if (!booking) return null;
  if (booking.status !== 'completed') {
    throw new Error('Тек аяқталған жазбаның төлем мәліметін өзгертуге болады');
  }
  const sid = booking.service_id || serviceId;
  const lowStockItems = [];
  const originalInventoryQuantities = new Map();
  const touchedInventoryItems = new Map();
  const {
    service_payment_amount,
    payment_type,
    material_expense,
    part_sales = undefined,
    services: servicesPayload = undefined,
  } = payload;

  const finalAmount = service_payment_amount !== undefined
    ? (service_payment_amount != null && service_payment_amount !== '' ? Number(service_payment_amount) : null)
    : booking.service_payment_amount;
  const finalPayType = payment_type !== undefined ? (payment_type || null) : booking.payment_type;
  const finalMaterial = material_expense !== undefined
    ? (material_expense != null && material_expense !== '' ? Number(material_expense) : null)
    : booking.material_expense;

  let kaspi_tax_amount = 0;
  if (finalPayType === 'kaspipay' && finalAmount != null) {
    kaspi_tax_amount = Math.round(finalAmount * 0.04 * 100) / 100;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (part_sales !== undefined) {
      const { rows: oldPartSales } = await client.query(
        'SELECT inventory_item_id, quantity FROM part_sale WHERE booking_id = $1',
        [id]
      );
      for (const ps of oldPartSales) {
        const { rows: existingItems } = await client.query(
          'SELECT id, quantity FROM inventory_item WHERE id = $1 AND service_id = $2 FOR UPDATE',
          [ps.inventory_item_id, sid]
        );
        if (existingItems.length === 0) throw new Error('Бөлшек табылмады');
        if (!originalInventoryQuantities.has(ps.inventory_item_id)) {
          originalInventoryQuantities.set(ps.inventory_item_id, Number(existingItems[0].quantity));
        }
        await client.query(
          'UPDATE inventory_item SET quantity = quantity + $2, updated_at = now() WHERE id = $1',
          [ps.inventory_item_id, Number(ps.quantity)]
        );
      }
      await client.query('DELETE FROM part_sale WHERE booking_id = $1', [id]);

      const newPartSales = Array.isArray(part_sales) ? part_sales : [];
      for (const line of newPartSales) {
        const { inventory_item_id, quantity, unit_price: payloadUnitPrice } = line;
        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        if (payloadUnitPrice == null || payloadUnitPrice === '') {
          throw new Error('Бөлшек үшін сату бағасы (unit_price) көрсетілуі керек');
        }
        const unitPrice = Number(payloadUnitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error('Сату бағасы жарамды сан болуы керек');
        }
        const { rows: items } = await client.query(
          'SELECT id, name, sale_price_min, sale_price_max, quantity, min_quantity, unit FROM inventory_item WHERE id = $1 AND service_id = $2 FOR UPDATE',
          [inventory_item_id, sid]
        );
        if (items.length === 0) throw new Error(`Бөлшек табылмады: ${inventory_item_id}`);
        const item = items[0];
        if (!originalInventoryQuantities.has(item.id)) {
          originalInventoryQuantities.set(item.id, Number(item.quantity));
        }
        const minP = Number(item.sale_price_min);
        const maxP = Number(item.sale_price_max);
        if (unitPrice < minP || unitPrice > maxP) {
          throw new Error(`Сату бағасы ${minP}–${maxP} аралығында болуы керек`);
        }
        if (item.quantity < qty) throw new Error(`Қоймада жеткіліксіз: ${item.quantity} < ${qty}`);
        await client.query(
          'INSERT INTO part_sale (booking_id, inventory_item_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [id, inventory_item_id, qty, unitPrice]
        );
        const nextQuantity = Number(item.quantity) - qty;
        await client.query(
          'UPDATE inventory_item SET quantity = $2, updated_at = now() WHERE id = $1',
          [inventory_item_id, nextQuantity]
        );
        const movement = await client.query(
          `INSERT INTO inventory_movement (item_id, type, quantity, amount, ref_type, ref_id)
           VALUES ($1, 'sale', $2, $3, 'booking_completion', $4)
           RETURNING id`,
          [inventory_item_id, qty, qty * unitPrice, id]
        );
        touchedInventoryItems.set(item.id, {
          id: item.id,
          name: item.name,
          quantity: nextQuantity,
          min_quantity: item.min_quantity,
          unit: item.unit,
          movement_id: movement.rows[0].id,
        });
      }
      for (const item of touchedInventoryItems.values()) {
        if (isLowStockThresholdCrossing(originalInventoryQuantities.get(item.id), item.quantity, item.min_quantity)) {
          lowStockItems.push(item);
        }
      }
    }

    if (servicesPayload !== undefined && Array.isArray(servicesPayload)) {
      await client.query('DELETE FROM booking_service WHERE booking_id = $1', [id]);
      const warrantyServiceIds = [];
      for (const s of servicesPayload) {
        const catalogId = s.service_catalog_id;
        const qty = Math.max(1, parseInt(s.quantity, 10) || 1);
        const warrantyMode = s.warranty_mode === true || s.warranty_mode === 'true';
        if (catalogId) {
          const { rows: [inserted] } = await client.query(
            'INSERT INTO booking_service (booking_id, service_catalog_id, quantity, warranty_mode) VALUES ($1, $2, $3, $4) RETURNING id',
            [id, catalogId, qty, warrantyMode]
          );
          if (normalizeDoorSide(s.door_side)) {
            await saveServiceDoors(client, id, [{ booking_service_id: inserted.id, door_side: s.door_side }]);
          }
          if (warrantyMode) warrantyServiceIds.push(catalogId);
        }
      }
      if (booking.client_id) {
        const completedAt = booking.completed_at ? new Date(booking.completed_at) : new Date();
        const expiresAt = new Date(completedAt);
        expiresAt.setMonth(expiresAt.getMonth() + 3);
        const expiresAtDate = expiresAt.toISOString().slice(0, 10);
        const warrantyMasterId = booking.assigned_master_id || (booking.masters && booking.masters[0] && booking.masters[0].master_user_id) || null;
        await client.query(
          'DELETE FROM warranty WHERE booking_id = $1',
          [id]
        );
        for (const serviceCatalogId of warrantyServiceIds) {
          await client.query('SAVEPOINT sp_warranty_edit');
          try {
            await client.query(
              `INSERT INTO warranty (client_id, booking_id, service_catalog_id, completed_at, expires_at, master_user_id)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [booking.client_id, id, serviceCatalogId, completedAt, expiresAtDate, warrantyMasterId]
            );
            await client.query('RELEASE SAVEPOINT sp_warranty_edit');
          } catch (_) {
            await client.query('ROLLBACK TO SAVEPOINT sp_warranty_edit');
            await client.query(
              `INSERT INTO warranty (client_id, booking_id, service_catalog_id, completed_at, expires_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [booking.client_id, id, serviceCatalogId, completedAt, expiresAtDate]
            );
          }
        }
      }
    }

    await client.query(
      `UPDATE booking SET
        service_payment_amount = $2,
        payment_type = $3,
        material_expense = $4,
        kaspi_tax_amount = $5,
        updated_at = now()
       WHERE id = $1 AND service_id = $6`,
      [id, finalAmount, finalPayType, finalMaterial, kaspi_tax_amount, sid]
    );

    await client.query('COMMIT');
    const updatedBooking = await getById(id, serviceId);
    for (const item of lowStockItems) {
      queuePush(() => dispatchPushEvent({ serviceId: sid, type: PUSH_EVENT_TYPES.INVENTORY_LOW, entity: item }), 'low stock');
    }
    return updatedBooking;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
