import * as whatsappInboundService from '../services/whatsappInboundService.js';

/**
 * Tolerant parsing: Option A { phone, name, message, timestamp } or Option B { from, profile_name, text, ts }.
 */
function parseWhatsAppBody(body) {
  if (!body || typeof body !== 'object') return null;
  const phone = body.phone ?? body.from ?? null;
  if (!phone) return null;
  const name = body.name ?? body.profile_name ?? null;
  const last_message = body.message ?? body.text ?? null;
  let last_message_at = body.timestamp ?? body.ts ?? null;
  if (typeof last_message_at === 'number') {
    last_message_at = new Date(last_message_at * 1000).toISOString();
  } else if (last_message_at != null && typeof last_message_at !== 'string') {
    last_message_at = null;
  }
  return { phone, name, last_message, last_message_at };
}

export async function whatsapp(req, res) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || '';
  const headerSecret = req.headers['x-webhook-secret'];
  if (secret && headerSecret !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = parseWhatsAppBody(req.body);
  if (!payload) {
    return res.status(400).json({ error: 'phone (or from) қажет' });
  }
  try {
    await whatsappInboundService.upsertInbound(payload);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Сәтсіз' });
  }
}
