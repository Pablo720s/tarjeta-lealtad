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
        const imageUrl = notif.image || null; // Captura la imagen dinámica si el trabajador la envió

        // Configuramos la estética base
        const options = {
          body: body,
          icon: '/icon-192.png',  // Reutilizamos la imagen de tu repositorio
          badge: '/badge.png',    // Esta imagen blanca/transparente es el "mata-Brave" para la barra superior
          vibrate: [200, 100, 200, 100, 200],
          requireInteraction: true // Evita que se borre de la pantalla hasta que el cliente la toque
        };

        // Si el trabajador pegó un link de imagen, se la inyectamos a la notificación
        if (imageUrl) {
          options.image = imageUrl;
        }

        return self.registration.showNotification(title, options);
      } catch (error) {
        // Fallback de emergencia
        return self.registration.showNotification("AURA Club", {
          body: "Abre la plataforma para ver tus novedades.",
          icon: '/icon-192.png',
          badge: '/badge.png'
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
