import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUSH_EVENT_DEFINITIONS,
  PUSH_EVENT_TYPES,
  PUSH_PREFERENCE_KEYS,
  allowedPushPreferenceKeysForUser,
  buildPushEvent,
  dispatchPushEvent,
  processDayCloseReminders,
  processUpcomingBookingNotifications,
} from './notificationEventService.js';

const booking = {
  id: 'booking-1', vehicle_name: 'Toyota Camry', start_time: '14:00:00', box_id: 2,
  service_payment_amount: 30000, payment_type: 'mixed', completed_at: '2026-08-09T10:00:00.000Z',
  part_sales: [{ quantity: 2, unit_price: 9000 }],
};

test('the event model is the one source of truth for the role matrix', () => {
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.BOOKING_CREATED.recipients.roles, ['owner', 'manager', 'worker']);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.BOOKING_UPCOMING.recipients.roles, ['manager']);
  assert.equal(PUSH_EVENT_DEFINITIONS.BOOKING_UPCOMING.recipients.includeAssignedMasters, true);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.WORK_STARTED.recipients.roles, ['manager']);
  assert.equal(PUSH_EVENT_DEFINITIONS.WORK_STARTED.recipients.includeSeniorWorkers, true);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.WORK_COMPLETED.recipients.roles, ['owner', 'manager']);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.PAYMENT_RECEIVED.recipients.roles, ['owner', 'manager']);
  assert.equal(PUSH_EVENT_DEFINITIONS.INVENTORY_LOW.recipients.includeSeniorWorkers, true);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.DAY_CLOSE_REMINDER.recipients.roles, ['owner']);
  assert.deepEqual(PUSH_EVENT_DEFINITIONS.DAY_CLOSED.recipients.roles, ['owner']);
});

test('event payloads use Kazakh templates, safe destinations, tags and saved financial values', () => {
  const payment = buildPushEvent({ serviceId: 'service-1', type: PUSH_EVENT_TYPES.PAYMENT_RECEIVED, entity: booking });
  assert.equal(payment.payload.title, 'Төлем қабылданды');
  assert.match(payment.payload.body, /48/);
  assert.match(payment.payload.body, /Аралас төлем/);
  assert.equal(payment.payload.url, '/booking/booking-1');
  assert.match(payment.payload.tag, /^payment:booking-1:/);

  const dayClose = buildPushEvent({
    serviceId: 'service-1',
    type: PUSH_EVENT_TYPES.DAY_CLOSED,
    entity: {
      id: 'close-1', date: '2026-08-09', shift_index: 2,
      service_income_total: 400000, part_sales_total: 86000, material_expense_total: 30000,
      opex_lunch: 12000, opex_transport: 10000, opex_rent: 18000, kaspi_tax_amount: 2000,
      owner_service_dividend: 100000, owner_parts_dividend: 18600,
    },
  });
  assert.equal(dayClose.payload.title, 'Ауысым жабылды');
  assert.match(dayClose.payload.body, /486/);
  assert.match(dayClose.payload.body, /72/);
  assert.match(dayClose.payload.body, /118/);
  assert.equal(dayClose.payload.url, '/day-close?date=2026-08-09&shift_index=2');
});

test('one persisted event key sends once even when the side effect is invoked twice', async () => {
  const keys = new Set();
  const sends = [];
  const adapters = {
    createEvent: async (_serviceId, event) => {
      if (keys.has(event.eventKey)) return { created: false, id: null };
      keys.add(event.eventKey);
      return { created: true, id: 'event-1' };
    },
    resolveRecipients: async () => ['user-a', 'user-b'],
    filterRecipients: async (_serviceId, recipients) => recipients,
    send: async (_serviceId, recipients) => { sends.push(recipients); return { sent: 2, failed: 0, deactivated: 0, skipped: 0 }; },
    recordDelivery: async () => {},
  };
  const first = await dispatchPushEvent({ serviceId: 'service-1', type: PUSH_EVENT_TYPES.WORK_COMPLETED, entity: booking }, adapters);
  const second = await dispatchPushEvent({ serviceId: 'service-1', type: PUSH_EVENT_TYPES.WORK_COMPLETED, entity: booking }, adapters);
  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true);
  assert.deepEqual(sends, [['user-a', 'user-b']]);
});

test('disabled preferences are filtered before multi-device delivery', async () => {
  let sentRecipients = null;
  await dispatchPushEvent({ serviceId: 'service-a', type: PUSH_EVENT_TYPES.PAYMENT_RECEIVED, entity: booking }, {
    createEvent: async () => ({ created: true, id: 'event-2' }),
    resolveRecipients: async (serviceId) => serviceId === 'service-a' ? ['owner-a', 'manager-a'] : ['other-service-user'],
    filterRecipients: async (_serviceId, recipients, key) => {
      assert.equal(key, PUSH_PREFERENCE_KEYS.PAYMENTS);
      return recipients.filter((id) => id !== 'manager-a');
    },
    send: async (_serviceId, recipients) => { sentRecipients = recipients; return { sent: 2, failed: 0, deactivated: 0, skipped: 0 }; },
    recordDelivery: async () => {},
  });
  assert.deepEqual(sentRecipients, ['owner-a']);
});

test('preference choices expose only categories the current role can actually receive', () => {
  assert.deepEqual(allowedPushPreferenceKeysForUser({ role: 'worker', is_senior_worker: false }), ['bookings', 'work']);
  assert.deepEqual(allowedPushPreferenceKeysForUser({ role: 'worker', is_senior_worker: true }), ['bookings', 'work', 'inventory', 'day_close']);
  assert.deepEqual(allowedPushPreferenceKeysForUser({ role: 'manager' }), ['bookings', 'work', 'payments', 'inventory']);
});

test('scheduler-ready handlers are explicit-now, tenant-scoped and repeat-safe through event keys', async () => {
  const seen = new Set();
  const delivered = [];
  const dispatchEvent = async (input) => {
    const key = buildPushEvent(input).eventKey;
    if (!seen.has(key)) {
      seen.add(key);
      delivered.push({ ...input, key });
    }
  };
  const services = [{
    service_id: 'service-a', push_timezone: 'Asia/Qyzylorda', push_booking_reminder_minutes: '30',
    push_day_close_reminder_enabled: 'true', push_day_close_reminder_time: '21:30',
  }];
  const upcomingAdapters = {
    listServices: async () => services,
    findUpcomingBookings: async (serviceId) => serviceId === 'service-a' ? [booking] : [],
    dispatchEvent,
  };
  await processUpcomingBookingNotifications('2026-08-09T15:00:00.000Z', upcomingAdapters);
  await processUpcomingBookingNotifications('2026-08-09T15:00:00.000Z', upcomingAdapters);

  const dayCloseAdapters = {
    listServices: async () => services,
    dayCloseExists: async (serviceId) => serviceId !== 'service-a',
    dispatchEvent,
  };
  await processDayCloseReminders('2026-08-09T17:00:00.000Z', dayCloseAdapters);
  await processDayCloseReminders('2026-08-09T17:00:00.000Z', dayCloseAdapters);

  assert.equal(delivered.filter((event) => event.type === PUSH_EVENT_TYPES.BOOKING_UPCOMING).length, 1);
  assert.equal(delivered.filter((event) => event.type === PUSH_EVENT_TYPES.DAY_CLOSE_REMINDER).length, 1);
  assert.ok(delivered.every((event) => event.serviceId === 'service-a'));
});
