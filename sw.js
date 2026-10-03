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
      // Eerst proberen zonder herladen.
      let focused = client;
      try { focused = await client.focus() || client; } catch (e) {}

      let acked = false;
      try {
        const channel = new MessageChannel();
        const ackPromise = new Promise(resolve => {
          let done = false;
          const finish = value => {
            if(done) return;
            done = true;
            resolve(value);
          };
          channel.port1.onmessage = () => finish(true);
          setTimeout(() => finish(false), 2200);
        });
        focused.postMessage(payload, [channel.port2]);
        acked = await ackPromise;
        try{channel.port1.close();}catch(e){}
      } catch (e) {}

      if (acked) {
        // Launcher heeft de klik ontvangen; geen reload nodig.
        return;
      }

      // Fallback: als de achtergrond-app de postMessage niet heeft ontvangen,
      // navigeer dezelfde PWA pas dan met de pushgegevens in de URL.
      if ('navigate' in focused) {
        try {
          const navigated = await focused.navigate(targetUrl);
          if (navigated && 'focus' in navigated) await navigated.focus();
          return;
        } catch (e) {}
      }

      // Laatste redmiddel.
      try { await self.clients.openWindow(targetUrl); } catch (e) {}
      return;
    }

    // App echt gesloten: normaal opnieuw openen.
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
