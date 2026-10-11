const CACHE_NAME = 'aura-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open('aura-config');
        const uidReq = await cache.match('/uid');
        let uid = '';
        if (uidReq) uid = await uidReq.text();

        let url = '/api/sync?action=GET_PENDING';
        if (uid) url += '&uid=' + uid;
        
        const res = await fetch(url);
        const notif = await res.json();

        const title = notif.title || "AURA Club";
        const body = notif.body || "¡Tienes una nueva actualización en tu tarjeta!";
        const imageUrl = notif.image || null;

        // Rutas absolutas forzadas para evitar el escudo del navegador
        const options = {
          body: body,
          icon: 'https://tarjeta-lealtad.fliik.link/icon-192.png',
          badge: 'https://tarjeta-lealtad.fliik.link/badge.png',
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true
        };

        if (imageUrl) {
          options.image = imageUrl;
        }

        return self.registration.showNotification(title, options);
      } catch (error) {
        return self.registration.showNotification("AURA Club", {
          body: "Abre la plataforma para ver tus novedades.",
          icon: 'https://tarjeta-lealtad.fliik.link/icon-192.png',
          badge: 'https://tarjeta-lealtad.fliik.link/badge.png'
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].focus();
      } else {
        clients.openWindow('https://tarjeta-lealtad.fliik.link/');
      }
    })
  );
});
