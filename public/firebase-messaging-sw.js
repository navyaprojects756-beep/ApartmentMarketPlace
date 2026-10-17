self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { notification: { body: event.data?.text?.() || '' } }; }
  const notification = payload.notification || payload.data || {};
  event.waitUntil(self.registration.showNotification(notification.title || 'GatedCart update', {
    body: notification.body || '',
    data: payload.data || {},
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    return existing ? existing.focus() : clients.openWindow('/');
  }));
});
