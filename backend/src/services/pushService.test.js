import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deliverPushSubscriptions,
  isLowStockThresholdCrossing,
  isValidVapidSubject,
} from './pushService.js';

test('VAPID subject is limited to a real mailto address or HTTPS URL', () => {
  assert.equal(isValidVapidSubject('mailto:ops@example.com'), true);
  assert.equal(isValidVapidSubject('https://example.com/push-contact'), true);
  assert.equal(isValidVapidSubject('owner@example.com'), false);
  assert.equal(isValidVapidSubject('http://example.com'), false);
});

test('low stock fires only on a threshold crossing and can fire after restock', () => {
  assert.equal(isLowStockThresholdCrossing(4, 1, 1), true);
  assert.equal(isLowStockThresholdCrossing(1, 0, 1), false);
  assert.equal(isLowStockThresholdCrossing(10, 2, 2), true);
  assert.equal(isLowStockThresholdCrossing(4, 2, null), false);
});

test('a dead subscription is deactivated while another device still receives the notification', async () => {
  const deactivated = [];
  const stats = await deliverPushSubscriptions({
    serviceId: 'service-1',
    subscriptions: [{ id: 'dead' }, { id: 'live' }],
    payload: { title: 'Тексеру' },
    sendNotification: async (subscription) => {
      if (subscription.id === 'dead') {
        const error = new Error('gone');
        error.statusCode = 410;
        throw error;
      }
    },
    deactivate: async (subscription, serviceId) => deactivated.push([subscription.id, serviceId]),
  });
  assert.deepEqual(deactivated, [['dead', 'service-1']]);
  assert.deepEqual(stats, { sent: 1, failed: 1, deactivated: 1, skipped: 0 });
});

test('two active device subscriptions each receive the same user event', async () => {
  const sentTo = [];
  const stats = await deliverPushSubscriptions({
    serviceId: 'service-1',
    subscriptions: [{ id: 'phone' }, { id: 'laptop' }],
    payload: { title: 'Тексеру' },
    sendNotification: async (subscription) => sentTo.push(subscription.id),
    deactivate: async () => {},
  });
  assert.deepEqual(sentTo.sort(), ['laptop', 'phone']);
  assert.deepEqual(stats, { sent: 2, failed: 0, deactivated: 0, skipped: 0 });
});

test('a transient provider failure keeps the subscription active', async () => {
  const deactivated = [];
  const stats = await deliverPushSubscriptions({
    serviceId: 'service-1',
    subscriptions: [{ id: 'temporary-error' }],
    payload: { title: 'Тексеру' },
    sendNotification: async () => {
      const error = new Error('timeout');
      error.statusCode = 503;
      throw error;
    },
    deactivate: async (subscription) => deactivated.push(subscription.id),
  });
  assert.deepEqual(deactivated, []);
  assert.deepEqual(stats, { sent: 0, failed: 1, deactivated: 0, skipped: 0 });
});
