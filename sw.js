self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = (event.notification && event.notification.data) || {};
  let targetUrl = data.url || './';
  const pushId = String(data.pushId || '').trim();

  if (pushId) {
    try {
      const u = new URL(targetUrl, self.location.origin);
      u.searchParams.set('pushOpen', pushId);
      if (String(data.title || '')) u.searchParams.set('pushTitle', String(data.title || ''));
      if (String(data.body || '')) u.searchParams.set('pushBody', String(data.body || ''));
      if (String(data.day || '')) u.searchParams.set('pushDay', String(data.day || ''));
      targetUrl = u.href;
    } catch (e) {}
  }

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('navigate' in client) {
        // Betrouwbare route: geef pushgegevens via de launcher-URL door.
        // De launcher zet ze in localStorage en vervolgens ook in de iframe-URL.
        try {
          const navigated = await client.navigate(targetUrl);
          if (navigated && 'focus' in navigated) await navigated.focus();
          else if ('focus' in client) await client.focus();
        } catch (e) {
          if ('focus' in client) {
            try { await client.focus(); } catch (_) {}
          }
        }
        return;
      }
      if ('focus' in client) {
        try { await client.focus(); } catch (e) {}
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'SCHOONMAAK_SHOW_NOTIFICATION') return;

  const title = String(data.title || 'Schoonmaakrooster');
  const options = {
    body: String(data.body || ''),
    icon: './app_icon_192.png',
    badge: './app_icon_192.png',
    tag: String(data.tag || 'schoonmaakrooster'),
    renotify: true,
    data: data.data || { url: './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
