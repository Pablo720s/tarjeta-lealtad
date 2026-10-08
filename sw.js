​importScripts("[https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js](https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js)");


self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Receptor nativo de notificaciones push en el sistema operativo
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const options = {
      body: event.data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'aura-notification'
    };
    self.registration.showNotification(event.data.title, options);
  }
});
