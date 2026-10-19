import { pool } from '../db/pool.js';
import { resolveRecipientUserIds, sendToUsers } from './pushService.js';

export const PUSH_EVENT_TYPES = Object.freeze({
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_UPCOMING: 'BOOKING_UPCOMING',
  WORK_STARTED: 'WORK_STARTED',
  WORK_COMPLETED: 'WORK_COMPLETED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  INVENTORY_LOW: 'INVENTORY_LOW',
  DAY_CLOSE_REMINDER: 'DAY_CLOSE_REMINDER',
  DAY_CLOSED: 'DAY_CLOSED',
});

export const PUSH_PREFERENCE_KEYS = Object.freeze({
  BOOKINGS: 'bookings',
  WORK: 'work',
  PAYMENTS: 'payments',
  INVENTORY: 'inventory',
  DAY_CLOSE: 'day_close',
});

const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Qyzylorda';
const DEFAULT_DAY_CLOSE_REMINDER_TIME = '21:30';
const DEFAULT_BOOKING_REMINDER_MINUTES = 30;
const ALLOWED_BOOKING_REMINDER_MINUTES = new Set([0, 15, 30, 60]);

function asArray(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).filter(Boolean))];
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatTenge(value) {
  return `${Math.round(numberOrZero(value)).toLocaleString('kk-KZ')} ₸`;
}

function bookingSummary(booking, includeTime = false) {
  const details = [booking?.vehicle_name || 'Көлік'];
  if (includeTime && booking?.start_time) details.push(String(booking.start_time).slice(0, 5));
  if (booking?.box_id) details.push(`${booking.box_id}-бокс`);
  return details.join(' • ');
}

function bookingUrl(booking) {
  return booking?.id ? `/booking/${booking.id}` : '/';
}

function paymentLabel(paymentType) {
  if (paymentType === 'kaspipay') return 'Kaspi';
  if (paymentType === 'mixed') return 'Аралас төлем';
  return 'Қолма-қол';
}

function bookingId(booking) {
  if (!booking?.id) throw new Error('Push event үшін booking қажет');
  return booking.id;
}

function inventoryId(item) {
  if (!item?.id) throw new Error('Push event үшін inventory item қажет');
  return item.id;
}

function dayCloseId(dayClose) {
  if (!dayClose?.id) throw new Error('Push event үшін day close қажет');
  return dayClose.id;
}

function versionToken(value, fallback) {
  const token = value instanceof Date ? value.toISOString() : (value || fallback);
  return String(token).replace(/[^A-Za-z0-9_.:-]/g, '');
}

export const PUSH_EVENT_DEFINITIONS = Object.freeze({
  [PUSH_EVENT_TYPES.BOOKING_CREATED]: {
    recipients: { roles: ['owner', 'manager', 'worker'] },
    preferenceKey: PUSH_PREFERENCE_KEYS.BOOKINGS,
    priority: 'normal',
    relevance: 'booking',
    eventKey: ({ entity }) => `booking-created:${bookingId(entity)}`,
    payload: (booking) => ({
      title: 'Жаңа жазылу',
      body: bookingSummary(booking, true),
      url: bookingUrl(booking),
    }),
  },
  [PUSH_EVENT_TYPES.BOOKING_UPCOMING]: {
    recipients: {
      roles: ['manager'],
      includeSeniorWorkers: true,
      includeAssignedMasters: true,
      fallbackRoles: ['worker'],
    },
    preferenceKey: PUSH_PREFERENCE_KEYS.BOOKINGS,
    priority: 'high',
    relevance: 'time-sensitive',
    eventKey: ({ entity }) => `booking-upcoming:${bookingId(entity)}:${versionToken(entity?.date, 'date')}:${versionToken(entity?.start_time, 'time')}`,
    payload: (booking) => ({
      title: 'Клиент жақында келеді',
      body: bookingSummary(booking, true),
      url: bookingUrl(booking),
    }),
  },
  [PUSH_EVENT_TYPES.WORK_STARTED]: {
    recipients: { roles: ['manager'], includeSeniorWorkers: true, includeAssignedMasters: true },
    preferenceKey: PUSH_PREFERENCE_KEYS.WORK,
    priority: 'normal',
    relevance: 'operational',
    eventKey: ({ entity }) => `work-started:${bookingId(entity)}`,
    payload: (booking) => ({
      title: 'Жұмыс басталды',
      body: bookingSummary(booking),
      url: bookingUrl(booking),
    }),
  },
  [PUSH_EVENT_TYPES.WORK_COMPLETED]: {
    recipients: { roles: ['owner', 'manager'] },
    preferenceKey: PUSH_PREFERENCE_KEYS.WORK,
    priority: 'normal',
    relevance: 'operational',
    eventKey: ({ entity }) => `work-completed:${bookingId(entity)}`,
    payload: (booking) => {
      const amount = booking?.service_payment_amount;
      return {
        title: 'Жұмыс аяқталды',
        body: amount == null || amount === '' ? bookingSummary(booking) : `${bookingSummary(booking)} • ${formatTenge(amount)}`,
        url: bookingUrl(booking),
      };
    },
  },
  [PUSH_EVENT_TYPES.PAYMENT_RECEIVED]: {
    recipients: { roles: ['owner', 'manager'] },
    preferenceKey: PUSH_PREFERENCE_KEYS.PAYMENTS,
    priority: 'high',
    relevance: 'financial',
    eventKey: ({ entity }) => `payment:${bookingId(entity)}:${versionToken(entity?.completed_at || entity?.updated_at, 'completed')}`,
    payload: (booking) => {
      const partSalesTotal = (booking?.part_sales || []).reduce(
        (total, line) => total + numberOrZero(line.quantity) * numberOrZero(line.unit_price),
        0
      );
      return {
        title: 'Төлем қабылданды',
        body: `${formatTenge(numberOrZero(booking?.service_payment_amount) + partSalesTotal)} • ${paymentLabel(booking?.payment_type)}`,
        url: bookingUrl(booking),
      };
    },
  },
  [PUSH_EVENT_TYPES.INVENTORY_LOW]: {
    recipients: { roles: ['owner', 'manager'], includeSeniorWorkers: true },
    preferenceKey: PUSH_PREFERENCE_KEYS.INVENTORY,
    priority: 'normal',
    relevance: 'inventory',
    eventKey: ({ entity }) => `inventory-low:${inventoryId(entity)}:${versionToken(entity?.movement_id, entity?.updated_at || entity?.quantity)}`,
    payload: (item) => {
      const unit = item?.unit ? ` ${item.unit}` : ' дана';
      return {
        title: 'Қоймадағы қалдық азайды',
        body: `${item?.name || 'Тауар'} • ${numberOrZero(item?.quantity)}${unit} қалды`,
        url: '/inventory',
      };
    },
  },
  [PUSH_EVENT_TYPES.DAY_CLOSE_REMINDER]: {
    recipients: { roles: ['owner'], includeSeniorWorkers: true },
    preferenceKey: PUSH_PREFERENCE_KEYS.DAY_CLOSE,
    priority: 'high',
    relevance: 'time-sensitive',
    eventKey: ({ serviceId, entity }) => `day-close-reminder:${serviceId}:${entity?.businessDate || 'unknown'}`,
    payload: () => ({
      title: 'Ауысым әлі жабылған жоқ',
      body: 'Бүгінгі ауысымды жабуды ұмытпаңыз',
      url: '/day-close',
    }),
  },
  [PUSH_EVENT_TYPES.DAY_CLOSED]: {
    recipients: { roles: ['owner'] },
    preferenceKey: PUSH_PREFERENCE_KEYS.DAY_CLOSE,
    priority: 'high',
    relevance: 'financial',
    eventKey: ({ entity }) => `day-closed:${dayCloseId(entity)}`,
    payload: (dayClose) => {
      const revenue = numberOrZero(dayClose?.service_income_total) + numberOrZero(dayClose?.part_sales_total);
      const expenses = numberOrZero(dayClose?.material_expense_total)
        + numberOrZero(dayClose?.opex_lunch)
        + numberOrZero(dayClose?.opex_transport)
        + numberOrZero(dayClose?.opex_rent)
        + numberOrZero(dayClose?.kaspi_tax_amount);
      const ownerShare = numberOrZero(dayClose?.owner_service_dividend) + numberOrZero(dayClose?.owner_parts_dividend);
      const params = new URLSearchParams();
      if (dayClose?.date) params.set('date', dayClose.date);
      if (dayClose?.shift_index != null) params.set('shift_index', String(dayClose.shift_index));
      return {
        title: 'Ауысым жабылды',
        body: `Түсім ${formatTenge(revenue)} • шығыс ${formatTenge(expenses)} • иесіне ${formatTenge(ownerShare)}`,
        url: `/day-close${params.toString() ? `?${params}` : ''}`,
      };
    },
  },
});

export function buildPushEvent({ serviceId, type, entity }) {
  const definition = PUSH_EVENT_DEFINITIONS[type];
  if (!definition) throw new Error('Белгісіз push event');
  const basePayload = definition.payload(entity);
  const eventKey = definition.eventKey({ serviceId, entity });
  return {
    type,
    eventKey,
    preferenceKey: definition.preferenceKey,
    recipients: definition.recipients,
    delivery: { urgency: definition.priority, ttl: definition.relevance === 'time-sensitive' ? 15 * 60 : 60 * 60 },
    payload: { ...basePayload, tag: eventKey },
    references: {
      bookingId: [PUSH_EVENT_TYPES.BOOKING_CREATED, PUSH_EVENT_TYPES.BOOKING_UPCOMING, PUSH_EVENT_TYPES.WORK_STARTED, PUSH_EVENT_TYPES.WORK_COMPLETED, PUSH_EVENT_TYPES.PAYMENT_RECEIVED].includes(type) ? entity?.id || null : null,
      inventoryItemId: type === PUSH_EVENT_TYPES.INVENTORY_LOW ? entity?.id || null : null,
      dayCloseId: type === PUSH_EVENT_TYPES.DAY_CLOSED ? entity?.id || null : null,
    },
  };
}

export function testPushPayload() {
  return {
    title: 'Сынақ хабарламасы',
    body: 'Хабарландырулар дұрыс жұмыс істеп тұр',
    url: '/notifications',
    tag: 'push-test',
  };
}

function assignedMasterIds(booking) {
  return asArray([
    booking?.assigned_master_id,
    ...(booking?.masters || []).map((master) => master.master_user_id),
  ]);
}

async function activeAssignedWorkerIds(serviceId, userIds) {
  const ids = asArray(userIds);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id
     FROM "user"
     WHERE service_id = $1
       AND id = ANY($2::uuid[])
       AND role = 'worker'
       AND (is_active IS NULL OR is_active = true)`,
    [serviceId, ids]
  );
  return rows.map((row) => row.id);
}

export async function resolvePushEventRecipients(serviceId, type, entity) {
  const definition = PUSH_EVENT_DEFINITIONS[type];
  if (!definition) throw new Error('Белгісіз push event');
  const recipientRule = definition.recipients;
  const staffIds = await resolveRecipientUserIds(serviceId, recipientRule);
  if (!recipientRule.includeAssignedMasters) return asArray(staffIds);
  const assignedIds = await activeAssignedWorkerIds(serviceId, assignedMasterIds(entity));
  if (assignedIds.length > 0) return asArray([...staffIds, ...assignedIds]);
  if (!recipientRule.fallbackRoles) return asArray(staffIds);
  const fallbackIds = await resolveRecipientUserIds(serviceId, { roles: recipientRule.fallbackRoles });
  return asArray([...staffIds, ...fallbackIds]);
}

export function allowedPushPreferenceKeysForUser(user) {
  const keys = new Set();
  if (user?.role === 'owner') {
    keys.add(PUSH_PREFERENCE_KEYS.BOOKINGS);
    keys.add(PUSH_PREFERENCE_KEYS.WORK);
    keys.add(PUSH_PREFERENCE_KEYS.PAYMENTS);
    keys.add(PUSH_PREFERENCE_KEYS.INVENTORY);
    keys.add(PUSH_PREFERENCE_KEYS.DAY_CLOSE);
  }
  if (user?.role === 'manager') {
    keys.add(PUSH_PREFERENCE_KEYS.BOOKINGS);
    keys.add(PUSH_PREFERENCE_KEYS.WORK);
    keys.add(PUSH_PREFERENCE_KEYS.PAYMENTS);
    keys.add(PUSH_PREFERENCE_KEYS.INVENTORY);
  }
  if (user?.role === 'worker') {
    keys.add(PUSH_PREFERENCE_KEYS.BOOKINGS);
    keys.add(PUSH_PREFERENCE_KEYS.WORK);
    if (user.is_senior_worker) {
      keys.add(PUSH_PREFERENCE_KEYS.INVENTORY);
      keys.add(PUSH_PREFERENCE_KEYS.DAY_CLOSE);
    }
  }
  return [...keys];
}

async function loadUserProfile(serviceId, userId) {
  const { rows } = await pool.query(
    `SELECT id, role, is_senior_worker
     FROM "user"
     WHERE id = $1 AND service_id = $2 AND (is_active IS NULL OR is_active = true)`,
    [userId, serviceId]
  );
  return rows[0] || null;
}

export async function getPushPreferences(serviceId, userId) {
  const user = await loadUserProfile(serviceId, userId);
  if (!user) throw new Error('Рұқсат жоқ');
  const allowedKeys = allowedPushPreferenceKeysForUser(user);
  const { rows } = await pool.query(
    `SELECT preference_key, enabled
     FROM push_notification_preference
     WHERE service_id = $1 AND user_id = $2 AND preference_key = ANY($3::varchar[])`,
    [serviceId, userId, allowedKeys]
  );
  const values = new Map(rows.map((row) => [row.preference_key, Boolean(row.enabled)]));
  return {
    preferences: allowedKeys.map((key) => ({ key, enabled: values.get(key) ?? true })),
  };
}

export async function updatePushPreferences(serviceId, userId, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('Хабарландыру баптаулары жарамсыз');
  }
  const user = await loadUserProfile(serviceId, userId);
  if (!user) throw new Error('Рұқсат жоқ');
  const allowedKeys = new Set(allowedPushPreferenceKeysForUser(user));
  const entries = Object.entries(values);
  if (entries.length === 0) return getPushPreferences(serviceId, userId);
  for (const [key, enabled] of entries) {
    if (!allowedKeys.has(key) || typeof enabled !== 'boolean') {
      throw new Error('Хабарландыру баптауы жарамсыз');
    }
  }
  for (const [key, enabled] of entries) {
    await pool.query(
      `INSERT INTO push_notification_preference (service_id, user_id, preference_key, enabled, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (service_id, user_id, preference_key)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
      [serviceId, userId, key, enabled]
    );
  }
  return getPushPreferences(serviceId, userId);
}

export async function filterRecipientsByPreference(serviceId, userIds, preferenceKey) {
  const ids = asArray(userIds);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT user_id
     FROM push_notification_preference
     WHERE service_id = $1
       AND user_id = ANY($2::uuid[])
       AND preference_key = $3
       AND enabled = false`,
    [serviceId, ids, preferenceKey]
  );
  const disabled = new Set(rows.map((row) => row.user_id));
  return ids.filter((id) => !disabled.has(id));
}

async function createPushEventRecord(serviceId, event) {
  const { rows } = await pool.query(
    `INSERT INTO push_notification_event (
       service_id, event_type, event_key, preference_key, booking_id, inventory_item_id, day_close_id, title, body, destination
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (service_id, event_key) DO NOTHING
     RETURNING id`,
    [
      serviceId,
      event.type,
      event.eventKey,
      event.preferenceKey,
      event.references.bookingId,
      event.references.inventoryItemId,
      event.references.dayCloseId,
      event.payload.title,
      event.payload.body,
      event.payload.url,
    ]
  );
  return { created: Boolean(rows[0]?.id), id: rows[0]?.id || null };
}

async function recordPushEventDelivery(eventId, recipientCount, stats) {
  const subscriptionCount = stats.sent + stats.failed + stats.skipped;
  await pool.query(
    `UPDATE push_notification_event
     SET recipient_count = $2,
         subscription_count = $3,
         sent_count = $4,
         failed_count = $5,
         stale_subscription_count = $6,
         delivered_at = now()
     WHERE id = $1`,
    [eventId, recipientCount, subscriptionCount, stats.sent, stats.failed, stats.deactivated]
  );
}

const defaultDispatchAdapters = {
  createEvent: createPushEventRecord,
  recordDelivery: recordPushEventDelivery,
  resolveRecipients: resolvePushEventRecipients,
  filterRecipients: filterRecipientsByPreference,
  send: (serviceId, userIds, payload, delivery) => sendToUsers(serviceId, userIds, payload, delivery),
};

// The public interface is intentionally small: callers provide the persisted business entity.
// Optional adapters are an internal test seam, not a second production path.
export async function dispatchPushEvent({ serviceId, type, entity }, adapters = {}) {
  const event = buildPushEvent({ serviceId, type, entity });
  const dependencies = { ...defaultDispatchAdapters, ...adapters };
  const recipients = await dependencies.resolveRecipients(serviceId, type, entity);
  const enabledRecipients = await dependencies.filterRecipients(serviceId, recipients, event.preferenceKey);
  const created = await dependencies.createEvent(serviceId, event);
  if (!created.created) {
    console.info(`Push event=${type} service=${serviceId} deduped=true`);
    return { deduped: true, recipients: 0, sent: 0, failed: 0, deactivated: 0, skipped: 0 };
  }
  const stats = await dependencies.send(serviceId, enabledRecipients, event.payload, event.delivery);
  await dependencies.recordDelivery(created.id, enabledRecipients.length, stats);
  console.info(
    `Push event=${type} service=${serviceId} recipients=${enabledRecipients.length} subscriptions=${stats.sent + stats.failed + stats.skipped} sent=${stats.sent} failed=${stats.failed} stale=${stats.deactivated}`
  );
  return { deduped: false, recipients: enabledRecipients.length, ...stats };
}

function validTimeZone(value) {
  try {
    Intl.DateTimeFormat('en-CA', { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

function localDateTime(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function parseReminderMinutes(value) {
  const minutes = Number(value ?? DEFAULT_BOOKING_REMINDER_MINUTES);
  return ALLOWED_BOOKING_REMINDER_MINUTES.has(minutes) ? minutes : DEFAULT_BOOKING_REMINDER_MINUTES;
}

function parseReminderTime(value) {
  const time = String(value || DEFAULT_DAY_CLOSE_REMINDER_TIME).trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_DAY_CLOSE_REMINDER_TIME;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function toDate(now) {
  const value = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (Number.isNaN(value.getTime())) throw new Error('Scheduler үшін now жарамсыз');
  return value;
}

async function listSchedulerServices() {
  const { rows } = await pool.query(
    `SELECT s.id AS service_id,
            MAX(st.value) FILTER (WHERE st.key = 'push_timezone') AS push_timezone,
            MAX(st.value) FILTER (WHERE st.key = 'push_booking_reminder_minutes') AS push_booking_reminder_minutes,
            MAX(st.value) FILTER (WHERE st.key = 'push_day_close_reminder_enabled') AS push_day_close_reminder_enabled,
            MAX(st.value) FILTER (WHERE st.key = 'push_day_close_reminder_time') AS push_day_close_reminder_time
     FROM service s
     LEFT JOIN settings st ON st.service_id = s.id
     GROUP BY s.id`
  );
  return rows;
}

async function findUpcomingBookings(serviceId, date, time) {
  const { rows } = await pool.query(
    `SELECT b.*, COALESCE(NULLIF(to_jsonb(b)->>'vehicle_custom_name', ''), v.name) AS vehicle_name
     FROM booking b
     JOIN vehicle_catalog v ON v.id = b.vehicle_catalog_id
     WHERE b.service_id = $1
       AND b.date = $2
       AND b.start_time >= $3::time
       AND b.start_time < ($3::time + INTERVAL '1 minute')
       AND b.status IN ('planned', 'arrived')`,
    [serviceId, date, time]
  );
  if (rows.length === 0) return [];
  const { rows: masters } = await pool.query(
    `SELECT booking_id, master_user_id
     FROM booking_master
     WHERE booking_id = ANY($1::uuid[])`,
    [rows.map((row) => row.id)]
  );
  const byBooking = new Map();
  for (const master of masters) {
    const list = byBooking.get(master.booking_id) || [];
    list.push({ master_user_id: master.master_user_id });
    byBooking.set(master.booking_id, list);
  }
  return rows.map((booking) => ({ ...booking, masters: byBooking.get(booking.id) || [] }));
}

async function dayCloseExists(serviceId, date) {
  const { rows } = await pool.query(
    'SELECT 1 FROM day_close WHERE service_id = $1 AND date = $2 LIMIT 1',
    [serviceId, date]
  );
  return rows.length > 0;
}

export async function processUpcomingBookingNotifications(now, adapters = {}) {
  const current = toDate(now);
  const dependencies = {
    listServices: listSchedulerServices,
    findUpcomingBookings,
    dispatchEvent: dispatchPushEvent,
    ...adapters,
  };
  const result = { services: 0, events: 0, skipped: 0, failed: 0 };
  for (const service of await dependencies.listServices()) {
    result.services += 1;
    const minutes = parseReminderMinutes(service.push_booking_reminder_minutes);
    if (minutes === 0) {
      result.skipped += 1;
      continue;
    }
    const target = localDateTime(new Date(current.getTime() + minutes * 60 * 1000), service.push_timezone);
    const bookings = await dependencies.findUpcomingBookings(service.service_id, target.date, target.time);
    for (const booking of bookings) {
      try {
        await dependencies.dispatchEvent({ serviceId: service.service_id, type: PUSH_EVENT_TYPES.BOOKING_UPCOMING, entity: booking });
        result.events += 1;
      } catch {
        result.failed += 1;
        console.warn(`Push scheduler event=BOOKING_UPCOMING service=${service.service_id} failed`);
      }
    }
  }
  return result;
}

export async function processDayCloseReminders(now, adapters = {}) {
  const current = toDate(now);
  const dependencies = {
    listServices: listSchedulerServices,
    dayCloseExists,
    dispatchEvent: dispatchPushEvent,
    ...adapters,
  };
  const result = { services: 0, events: 0, skipped: 0, failed: 0 };
  for (const service of await dependencies.listServices()) {
    result.services += 1;
    const enabled = String(service.push_day_close_reminder_enabled ?? 'true').toLowerCase() !== 'false';
    const local = localDateTime(current, service.push_timezone);
    if (!enabled || timeToMinutes(local.time) < timeToMinutes(parseReminderTime(service.push_day_close_reminder_time))) {
      result.skipped += 1;
      continue;
    }
    if (await dependencies.dayCloseExists(service.service_id, local.date)) {
      result.skipped += 1;
      continue;
    }
    try {
      await dependencies.dispatchEvent({
        serviceId: service.service_id,
        type: PUSH_EVENT_TYPES.DAY_CLOSE_REMINDER,
        entity: { businessDate: local.date },
      });
      result.events += 1;
    } catch {
      result.failed += 1;
      console.warn(`Push scheduler event=DAY_CLOSE_REMINDER service=${service.service_id} failed`);
    }
  }
  return result;
}
