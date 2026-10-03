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
      targetUrl = u.href;
    } catch (e) {}
  }

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        // Eerst naar voren halen en daarna de klik nogmaals doorgeven.
        // Op iOS/Android kan een pagina uit de achtergrond een vroege
        // postMessage missen; meerdere pogingen maken dit betrouwbaar.
        let focused = client;
        try { focused = await client.focus() || client; } catch (e) {}
        const payload = { type: 'SCHOONMAAK_NOTIFICATION_CLICK', data: data };
        try { focused.postMessage(payload); } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 180));
        try { focused.postMessage(payload); } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 650));
        try { focused.postMessage(payload); } catch (e) {}
        return;
      }
    }
    // Alleen wanneer de app echt dicht is openen we een nieuw venster.
    // pushOpen zorgt dat de launcher de melding na het opstarten alsnog
    // aan de mobiele app doorgeeft.
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
