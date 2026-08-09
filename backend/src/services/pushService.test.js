import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUSH_RECIPIENTS,
  buildDayClosePayload,
  buildPaymentPayload,
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

test('role routing follows the existing owner, manager, worker and senior-worker model', () => {
  assert.deepEqual(PUSH_RECIPIENTS.newBooking.roles, ['owner', 'manager', 'worker']);
  assert.deepEqual(PUSH_RECIPIENTS.bookingReminder.roles, ['manager', 'worker']);
  assert.equal(PUSH_RECIPIENTS.workStarted.includeSeniorWorkers, true);
  assert.deepEqual(PUSH_RECIPIENTS.payment.roles, ['owner', 'manager']);
  assert.equal(PUSH_RECIPIENTS.lowStock.includeSeniorWorkers, true);
  assert.equal(PUSH_RECIPIENTS.dayCloseOpen.includeSeniorWorkers, true);
  assert.deepEqual(PUSH_RECIPIENTS.dayClose.roles, ['owner']);
});

test('payment payload uses the stored total and does not invent a mixed-payment split', () => {
  const payload = buildPaymentPayload({
    id: 'booking-1',
    service_payment_amount: 30000,
    payment_type: 'mixed',
    part_sales: [{ quantity: 2, unit_price: 9000 }],
  });
  assert.equal(payload.title, 'Төлем қабылданды');
  assert.match(payload.body, /48/);
  assert.match(payload.body, /Аралас төлем/);
  assert.doesNotMatch(payload.body, /Kaspi 30/);
  assert.equal(payload.url, '/booking/booking-1');
});

test('day-close payload uses the saved snapshot fields and targets its report', () => {
  const payload = buildDayClosePayload({
    date: '2026-08-09',
    shift_index: 2,
    service_income_total: 400000,
    part_sales_total: 86000,
    material_expense_total: 30000,
    opex_lunch: 12000,
    opex_transport: 10000,
    opex_rent: 18000,
    kaspi_tax_amount: 2000,
    owner_service_dividend: 100000,
    owner_parts_dividend: 18600,
  });
  assert.equal(payload.title, 'Ауысым жабылды');
  assert.match(payload.body, /486/);
  assert.match(payload.body, /72/);
  assert.match(payload.body, /118/);
  assert.equal(payload.url, '/day-close?date=2026-08-09&shift_index=2');
});

test('low stock fires only when quantity crosses its configured threshold', () => {
  assert.equal(isLowStockThresholdCrossing(4, 1, 1), true);
  assert.equal(isLowStockThresholdCrossing(1, 0, 1), false);
  assert.equal(isLowStockThresholdCrossing(4, 2, null), false);
});

test('a dead subscription is deactivated while other devices still receive the notification', async () => {
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
