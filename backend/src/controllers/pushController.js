import * as pushService from '../services/pushService.js';
import {
  getPushPreferences,
  testPushPayload,
  updatePushPreferences,
} from '../services/notificationEventService.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/;

function currentServiceId(req, res) {
  const serviceId = req.user?.service_id;
  if (!serviceId) {
    res.status(403).json({ error: 'Рұқсат жоқ' });
    return null;
  }
  return serviceId;
}

function readSubscription(body) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth.trim() : '';
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    url = null;
  }
  if (!url || url.protocol !== 'https:' || endpoint.length > 4096 || !KEY_PATTERN.test(p256dh) || !KEY_PATTERN.test(auth)) {
    const error = new Error('Құрылғы хабарландыруы жарамсыз');
    error.statusCode = 400;
    throw error;
  }
  return { endpoint, p256dh, auth };
}

export function getPublicKey(req, res) {
  const config = pushService.getPublicPushConfig();
  if (!config.enabled) {
    return res.status(503).json({ error: 'Хабарландырулар әзірге қолжетімсіз' });
  }
  return res.json({ publicKey: config.publicKey });
}

export async function subscribe(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  try {
    const subscription = readSubscription(req.body);
    const result = await pushService.upsertSubscription({
      serviceId,
      userId: req.user.id,
      ...subscription,
      userAgent: req.get('user-agent')?.slice(0, 512),
    });
    return res.status(201).json({ subscribed: result.active });
  } catch (error) {
    return res.status(error.statusCode || (error.code ? 409 : 400)).json({ error: error.message || 'Жазылу сақталмады' });
  }
}

export async function unsubscribe(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.trim() : '';
  if (!endpoint || endpoint.length > 4096) {
    return res.status(400).json({ error: 'Құрылғы хабарландыруы жарамсыз' });
  }
  const result = await pushService.deactivateSubscription(serviceId, req.user.id, endpoint);
  return res.json(result);
}

export async function status(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint.slice(0, 4096) : null;
  const subscription = await pushService.getSubscriptionStatus(serviceId, req.user.id, endpoint);
  return res.json({
    configured: pushService.getPublicPushConfig().enabled,
    active_count: subscription.activeCount,
    endpoint_active: subscription.endpointActive,
  });
}

export async function sendTest(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  if (!pushService.getPublicPushConfig().enabled) {
    return res.status(503).json({ error: 'Хабарландырулар әзірге қолжетімсіз' });
  }
  const result = await pushService.sendTestNotification(serviceId, req.user.id, testPushPayload());
  return res.json({ sent: result.sent > 0 });
}

export async function preferences(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  try {
    return res.json(await getPushPreferences(serviceId, req.user.id));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Хабарландыру баптауларын оқу мүмкін болмады' });
  }
}

export async function updatePreferences(req, res) {
  const serviceId = currentServiceId(req, res);
  if (!serviceId) return;
  try {
    return res.json(await updatePushPreferences(serviceId, req.user.id, req.body?.preferences));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Хабарландыру баптауларын сақтау мүмкін болмады' });
  }
}
