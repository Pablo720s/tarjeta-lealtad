const CACHE_NAME = 'aura-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ESCUCHAMOS LA CHISPA (PUSH EVENT)
self.addEventListener('push', function(event) {
  event.waitUntil(
    (async () => {
      try {
        // 1. Buscamos el UID del cliente en nuestra memoria interna
        const cache = await caches.open('aura-config');
        const uidReq = await cache.match('/uid');
        let uid = '';
        if (uidReq) uid = await uidReq.text();

        // 2. Nos conectamos a la base de datos para ver qué mensaje nos mandaron
        let url = '/api/sync?action=GET_PENDING';
        if (uid) url += '&uid=' + uid;
        
        const res = await fetch(url);
        const notif = await res.json();

        // 3. Mostramos la notificación en la pantalla
        const title = notif.title || "AURA Club";
        const body = notif.body || "¡Tienes una nueva actualización en tu tarjeta!";

        return self.registration.showNotification(title, {
          body: body,
          icon: '/icon.png', // Pon el link a tu logo aquí si tienes uno
          badge: '/badge.png',
          vibrate: [200, 100, 200]
        });
      } catch (error) {
        // Fallback de seguridad si falla la red
        return self.registration.showNotification("AURA Club", {
          body: "Abre la plataforma para ver tus novedades."
        });
      }
    })()
  );
});

// CUANDO EL CLIENTE TOCA LA NOTIFICACIÓN
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});

