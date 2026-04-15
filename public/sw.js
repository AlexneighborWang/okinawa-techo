self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('okinawa-v1').then((cache) => {
      return cache.addAll([
        '/okinawa-techo/',
        '/okinawa-techo/index.html',
        '/okinawa-techo/manifest.webmanifest'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
