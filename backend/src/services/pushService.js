import webpush from 'web-push';
import { pool } from '../db/pool.js';

const DEAD_SUBSCRIPTION_STATUS_CODES = new Set([404, 410]);
let configuredSignature = null;

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
  return '(u.is_active IS NULL OR u.is_active = true)';
}

function safeErrorLabel(error) {
  if (error?.statusCode) return `HTTP ${error.statusCode}`;
  return 'delivery failed';
}

function asArray(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).filter(Boolean))];
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

async function sendToSubscriptions(serviceId, subscriptions, payload, delivery = {}) {
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
    }, serializedPayload, {
      TTL: delivery.ttl ?? 60 * 60,
      ...(delivery.urgency ? { urgency: delivery.urgency } : {}),
    }),
    deactivate: (subscription, scopedServiceId) => pool.query(
      'UPDATE push_subscription SET is_active = false, updated_at = now() WHERE id = $1 AND service_id = $2',
      [subscription.id, scopedServiceId]
    ),
  });
}

export async function sendToUsers(serviceId, userIds, payload, delivery) {
  const subscriptions = await activeSubscriptionsForUsers(serviceId, userIds);
  return sendToSubscriptions(serviceId, subscriptions, payload, delivery);
}

export async function sendToUser(serviceId, userId, payload, delivery) {
  return sendToUsers(serviceId, [userId], payload, delivery);
}

export function queuePush(task, label) {
  Promise.resolve().then(task).catch((error) => {
    console.warn(`Push ${label || 'notification'} ${safeErrorLabel(error)}`);
  });
}

export async function sendTestNotification(serviceId, userId, payload) {
  return sendToUser(serviceId, userId, payload, { urgency: 'normal' });
}
