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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          // Als de app al open staat: niet opnieuw navigeren/herladen.
          // Alleen focussen en de klik doorgeven, zodat het bericht direct
          // in de bestaande app kan worden geopend en bewaard.
          client.postMessage({
            type: 'SCHOONMAAK_NOTIFICATION_CLICK',
            data: data
          });
          return client.focus();
        }
      }
      // Alleen wanneer de app echt dicht is openen we een nieuw venster.
      // pushOpen zorgt dat de launcher de melding na het opstarten alsnog
      // aan de mobiele app doorgeeft.
      return self.clients.openWindow(targetUrl);
    })
  );
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
