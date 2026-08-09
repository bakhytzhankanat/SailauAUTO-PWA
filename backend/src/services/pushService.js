import webpush from 'web-push';
import { pool } from '../db/pool.js';

const DEAD_SUBSCRIPTION_STATUS_CODES = new Set([404, 410]);
let configuredSignature = null;

export const PUSH_RECIPIENTS = Object.freeze({
  newBooking: { roles: ['owner', 'manager', 'worker'] },
  bookingReminder: { roles: ['manager', 'worker'] },
  workStarted: { roles: ['manager'], includeSeniorWorkers: true, includeAssignedMasters: true },
  workCompleted: { roles: ['owner', 'manager'] },
  payment: { roles: ['owner', 'manager'] },
  lowStock: { roles: ['owner', 'manager'], includeSeniorWorkers: true },
  dayCloseOpen: { roles: ['owner'], includeSeniorWorkers: true },
  dayClose: { roles: ['owner'] },
});

export function isValidVapidSubject(subject) {
  if (!subject || typeof subject !== 'string') return false;
  try {
    const url = new URL(subject.trim());
    if (url.protocol === 'https:') return true;
    return url.protocol === 'mailto:' && url.pathname.includes('@');
  } catch {
    return false;
  }
}

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  return {
    publicKey,
    privateKey,
    subject,
    enabled: Boolean(publicKey && privateKey && isValidVapidSubject(subject)),
  };
}

function configureWebPush() {
  const config = vapidConfig();
  if (!config.enabled) return false;
  const signature = `${config.subject}:${config.publicKey}:${config.privateKey}`;
  if (signature !== configuredSignature) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredSignature = signature;
  }
  return true;
}

function activeUserSql() {
  return "(u.is_active IS NULL OR u.is_active = true)";
}

function safeErrorLabel(error) {
  if (error?.statusCode) return `HTTP ${error.statusCode}`;
  return 'delivery failed';
}

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

export function isLowStockThresholdCrossing(previousQuantity, nextQuantity, minimumQuantity) {
  const previous = Number(previousQuantity);
  const next = Number(nextQuantity);
  const minimum = Number(minimumQuantity);
  return Number.isFinite(previous)
    && Number.isFinite(next)
    && Number.isFinite(minimum)
    && previous > minimum
    && next <= minimum;
}

export function isDeadSubscriptionResponse(error) {
  return DEAD_SUBSCRIPTION_STATUS_CODES.has(error?.statusCode);
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

export function buildNewBookingPayload(booking) {
  return {
    title: 'Жаңа жазылу',
    body: bookingSummary(booking, true),
    url: bookingUrl(booking),
  };
}

export function buildBookingReminderPayload(booking) {
  return {
    title: '30 минуттан кейін клиент келеді',
    body: bookingSummary(booking, true),
    url: bookingUrl(booking),
  };
}

export function buildWorkStartedPayload(booking) {
  return {
    title: 'Жұмыс басталды',
    body: bookingSummary(booking),
    url: bookingUrl(booking),
  };
}

export function buildWorkCompletedPayload(booking) {
  const amount = booking?.service_payment_amount;
  return {
    title: 'Жұмыс аяқталды',
    body: amount == null || amount === '' ? bookingSummary(booking) : `${bookingSummary(booking)} • ${formatTenge(amount)}`,
    url: bookingUrl(booking),
  };
}

export function buildPaymentPayload(booking) {
  const partSalesTotal = (booking?.part_sales || []).reduce(
    (total, line) => total + numberOrZero(line.quantity) * numberOrZero(line.unit_price),
    0
  );
  return {
    title: 'Төлем қабылданды',
    body: `${formatTenge(numberOrZero(booking?.service_payment_amount) + partSalesTotal)} • ${paymentLabel(booking?.payment_type)}`,
    url: bookingUrl(booking),
  };
}

export function buildLowStockPayload(item) {
  const unit = item?.unit ? ` ${item.unit}` : ' дана';
  return {
    title: 'Қоймадағы қалдық азайды',
    body: `${item?.name || 'Тауар'} • ${numberOrZero(item?.quantity)}${unit} қалды`,
    url: '/inventory',
  };
}

export function buildDayClosePayload(dayClose) {
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
}

export function buildDayCloseOpenPayload() {
  return {
    title: 'Ауысым әлі жабылған жоқ',
    body: 'Бүгінгі ауысымды жабуды ұмытпаңыз',
    url: '/day-close',
  };
}

export function getPublicPushConfig() {
  const config = vapidConfig();
  return { enabled: config.enabled, publicKey: config.enabled ? config.publicKey : null };
}

export async function upsertSubscription({ serviceId, userId, endpoint, p256dh, auth, userAgent }) {
  const { rows } = await pool.query(
    `INSERT INTO push_subscription (service_id, user_id, endpoint, p256dh, auth, user_agent, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT (endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           is_active = true,
           updated_at = now()
       WHERE push_subscription.service_id = EXCLUDED.service_id
         AND push_subscription.user_id = EXCLUDED.user_id
     RETURNING id, is_active`,
    [serviceId, userId, endpoint, p256dh, auth, userAgent || null]
  );
  if (rows.length === 0) {
    const error = new Error('Бұл құрылғы басқа пайдаланушыға тіркелген');
    error.code = 'SUBSCRIPTION_OWNED_BY_ANOTHER_USER';
    throw error;
  }
  return { active: Boolean(rows[0].is_active) };
}

export async function deactivateSubscription(serviceId, userId, endpoint) {
  const { rowCount } = await pool.query(
    `UPDATE push_subscription
     SET is_active = false, updated_at = now()
     WHERE service_id = $1 AND user_id = $2 AND endpoint = $3 AND is_active = true`,
    [serviceId, userId, endpoint]
  );
  return { deactivated: rowCount > 0 };
}

export async function getSubscriptionStatus(serviceId, userId, endpoint = null) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE is_active) AS active_count,
            BOOL_OR(is_active) FILTER (WHERE endpoint = $3) AS endpoint_active
     FROM push_subscription
     WHERE service_id = $1 AND user_id = $2`,
    [serviceId, userId, endpoint]
  );
  return {
    activeCount: Number(rows[0]?.active_count || 0),
    endpointActive: Boolean(rows[0]?.endpoint_active),
  };
}

export async function resolveRecipientUserIds(serviceId, { roles = [], includeSeniorWorkers = false } = {}) {
  const normalizedRoles = asArray(roles);
  if (normalizedRoles.length === 0 && !includeSeniorWorkers) return [];
  const { rows } = await pool.query(
    `SELECT id
     FROM "user" u
     WHERE u.service_id = $1
       AND ${activeUserSql()}
       AND (u.role = ANY($2::varchar[]) OR ($3::boolean AND u.role = 'worker' AND u.is_senior_worker = true))`,
    [serviceId, normalizedRoles, includeSeniorWorkers]
  );
  return rows.map((row) => row.id);
}

async function activeSubscriptionsForUsers(serviceId, userIds) {
  const ids = asArray(userIds);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscription ps
     JOIN "user" u ON u.id = ps.user_id
     WHERE ps.service_id = $1
       AND ps.user_id = ANY($2::uuid[])
       AND ps.is_active = true
       AND u.service_id = $1
       AND ${activeUserSql()}`,
    [serviceId, ids]
  );
  return rows;
}

export async function deliverPushSubscriptions({ serviceId, subscriptions, payload, sendNotification, deactivate }) {
  const serializedPayload = JSON.stringify(payload);
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await sendNotification(subscription, serializedPayload);
      return { sent: true, deactivated: false };
    } catch (error) {
      const dead = isDeadSubscriptionResponse(error);
      if (dead) {
        try {
          await deactivate(subscription, serviceId);
        } catch (deactivationError) {
          console.warn(`Push deactivation ${safeErrorLabel(deactivationError)}`);
        }
      }
      console.warn(`Push notification ${safeErrorLabel(error)}`);
      return { sent: false, deactivated: dead };
    }
  }));
  return results.reduce((stats, result) => ({
    sent: stats.sent + (result.sent ? 1 : 0),
    failed: stats.failed + (result.sent ? 0 : 1),
    deactivated: stats.deactivated + (result.deactivated ? 1 : 0),
    skipped: 0,
  }), { sent: 0, failed: 0, deactivated: 0, skipped: 0 });
}

async function sendToSubscriptions(serviceId, subscriptions, payload) {
  if (!configureWebPush() || subscriptions.length === 0) {
    return { sent: 0, failed: 0, deactivated: 0, skipped: subscriptions.length };
  }
  return deliverPushSubscriptions({
    serviceId,
    subscriptions,
    payload,
    sendNotification: (subscription, serializedPayload) => webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    }, serializedPayload, { TTL: 60 * 60 }),
    deactivate: (subscription, scopedServiceId) => pool.query(
      'UPDATE push_subscription SET is_active = false, updated_at = now() WHERE id = $1 AND service_id = $2',
      [subscription.id, scopedServiceId]
    ),
  });
}

export async function sendToUsers(serviceId, userIds, payload) {
  const subscriptions = await activeSubscriptionsForUsers(serviceId, userIds);
  return sendToSubscriptions(serviceId, subscriptions, payload);
}

export async function sendToUser(serviceId, userId, payload) {
  return sendToUsers(serviceId, [userId], payload);
}

export async function sendToRoles(serviceId, options, payload) {
  const userIds = await resolveRecipientUserIds(serviceId, options);
  return sendToUsers(serviceId, userIds, payload);
}

export function queuePush(task, label) {
  Promise.resolve().then(task).catch((error) => {
    console.warn(`Push ${label || 'notification'} ${safeErrorLabel(error)}`);
  });
}

export async function notifyNewBooking(serviceId, booking) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.newBooking, buildNewBookingPayload(booking));
}

export async function notifyBookingReminder(serviceId, booking) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.bookingReminder, buildBookingReminderPayload(booking));
}

export async function notifyWorkStarted(serviceId, booking) {
  const staffIds = await resolveRecipientUserIds(serviceId, PUSH_RECIPIENTS.workStarted);
  const masterIds = asArray([
    booking?.assigned_master_id,
    ...(booking?.masters || []).map((master) => master.master_user_id),
  ]);
  return sendToUsers(serviceId, [...staffIds, ...masterIds], buildWorkStartedPayload(booking));
}

export async function notifyWorkCompleted(serviceId, booking) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.workCompleted, buildWorkCompletedPayload(booking));
}

export async function notifyPayment(serviceId, booking) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.payment, buildPaymentPayload(booking));
}

export async function notifyLowStock(serviceId, item) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.lowStock, buildLowStockPayload(item));
}

export async function notifyDayClose(serviceId, dayClose) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.dayClose, buildDayClosePayload(dayClose));
}

export async function notifyDayCloseOpen(serviceId) {
  return sendToRoles(serviceId, PUSH_RECIPIENTS.dayCloseOpen, buildDayCloseOpenPayload());
}

export async function sendTestNotification(serviceId, userId) {
  return sendToUser(serviceId, userId, {
    title: 'Хабарландырулар қосылды',
    body: 'Бұл — сынақ хабарламасы',
    url: '/settings',
  });
}
