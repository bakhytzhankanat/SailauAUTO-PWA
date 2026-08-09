/* Push-only Service Worker. Offline caching is intentionally out of scope. */
function safeText(value, fallback, limit) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

function internalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const url = internalPath(payload.url);
  event.waitUntil(self.registration.showNotification(safeText(payload.title, 'Sailau Auto', 160), {
    body: safeText(payload.body, 'Жаңа хабарландыру бар', 512),
    icon: '/app-icon.png',
    badge: '/app-icon.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 255) : undefined,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(internalPath(event.notification.data?.url), self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if (typeof existing.navigate === 'function') await existing.navigate(targetUrl);
      return;
    }
    await clients.openWindow(targetUrl);
  })());
});
