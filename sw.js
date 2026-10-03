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
    const payload = { type: 'SCHOONMAAK_NOTIFICATION_CLICK', data: data };
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clients) {
      // App staat al open: NOOIT navigeren. Alleen naar voren halen en de
      // klik meerdere keren doorgeven. Zo blijft het huidige rooster intact.
      try { client.postMessage(payload); } catch (e) {}
      try {
        const channel = new BroadcastChannel('schoonmaak-push-open-v1');
        channel.postMessage(payload);
        channel.close();
      } catch (e) {}

      let focused = client;
      try { focused = await client.focus() || client; } catch (e) {}

      await new Promise(resolve => setTimeout(resolve, 180));
      try { focused.postMessage(payload); } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 550));
      try { focused.postMessage(payload); } catch (e) {}
      return;
    }

    // Alleen als er echt geen appvenster meer bestaat starten we de PWA opnieuw.
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
