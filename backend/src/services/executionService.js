import { pool } from '../db/pool.js';
import { getById } from './bookingService.js';

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
 * part_sales: [{ inventory_item_id, quantity, unit_price }], warranty_service_ids: [uuid].
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

  const {
    service_payment_amount,
    payment_type,
    material_expense,
    kaspi_tax_amount: payloadKaspiTax,
    part_sales = [],
    warranty_service_ids = [],
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
      await client.query(
        'UPDATE client SET last_vehicle_name = COALESCE($2, last_vehicle_name), last_plate_number = COALESCE($3, last_plate_number), updated_at = now() WHERE id = $1',
        [clientId, booking.vehicle_name || null, booking.plate_number || null]
      );
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

    const warrantyMasterId = booking.assigned_master_id || (booking.masters && booking.masters[0] && booking.masters[0].master_user_id) || null;
    if (clientId && warranty_service_ids.length > 0) {
      for (const serviceCatalogId of warranty_service_ids) {
        await client.query(
          `INSERT INTO warranty (client_id, booking_id, service_catalog_id, completed_at, expires_at, master_user_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (booking_id, service_catalog_id) DO UPDATE SET master_user_id = EXCLUDED.master_user_id`,
          [clientId, id, serviceCatalogId, completedAt, expiresAtDate, warrantyMasterId]
        );
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
        'SELECT id, sale_price_min, sale_price_max, quantity FROM inventory_item WHERE id = $1 AND service_id = $2 FOR UPDATE',
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
      await client.query(
        'UPDATE inventory_item SET quantity = quantity - $2, updated_at = now() WHERE id = $1',
        [inventory_item_id, qty]
      );
      await client.query(
        `INSERT INTO inventory_movement (item_id, type, quantity, amount, ref_type, ref_id)
         VALUES ($1, 'sale', $2, $3, 'booking_completion', $4)`,
        [inventory_item_id, qty, qty * unitPrice, id]
      );
    }

    await client.query('COMMIT');
    return getById(id, serviceId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
