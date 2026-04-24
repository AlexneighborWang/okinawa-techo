const CACHE_NAME = 'okinawa-v2'; // 更新版本號
const ASSETS_TO_CACHE = [
  '/okinawa-techo/',
  '/okinawa-techo/index.html',
  '/okinawa-techo/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // 強迫安裝中的 SW 立即進入 active 狀態
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('正在刪除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // 對於 HTML 請求使用 Network First (網路優先)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/okinawa-techo/index.html');
      })
    );
    return;
  }

  // 其他資源使用 Cache First，但如果網路有回來也會更新
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
