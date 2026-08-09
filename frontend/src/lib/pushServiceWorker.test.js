import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const workerSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');

function createWorker(clients) {
  const listeners = {};
  const self = {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    registration: { showNotification: async (...args) => clients.notifications.push(args) },
    location: { origin: 'https://sailau.example' },
  };
  vm.runInNewContext(workerSource, { self, clients, URL });
  return listeners;
}

test('service worker displays the safe push payload', async () => {
  const clients = { notifications: [] };
  const listeners = createWorker(clients);
  let completion;
  listeners.push({
    data: { json: () => ({ title: 'Жаңа жазылу', body: 'Toyota • 14:00', url: '/booking/42' }) },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.equal(clients.notifications[0][0], 'Жаңа жазылу');
  assert.equal(clients.notifications[0][1].body, 'Toyota • 14:00');
  assert.equal(clients.notifications[0][1].data.url, '/booking/42');
});

test('notification click routes an existing app window to the requested internal page', async () => {
  const calls = [];
  const windowClient = {
    url: 'https://sailau.example/',
    navigate: async (url) => calls.push(['navigate', url]),
    focus: async () => calls.push(['focus']),
  };
  const clients = {
    notifications: [],
    matchAll: async () => [windowClient],
    openWindow: async (url) => calls.push(['open', url]),
  };
  const listeners = createWorker(clients);
  let completion;
  listeners.notificationclick({
    notification: { close: () => calls.push(['close']), data: { url: '/day-close?date=2026-08-09' } },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(calls, [
    ['close'],
    ['navigate', 'https://sailau.example/day-close?date=2026-08-09'],
    ['focus'],
  ]);
});
