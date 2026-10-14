const CACHE_NAME = 'pari-tech-cache-v1';
const ASSETS_TO_CACHE = [
  '/frontend/tech/index.html',
  '/frontend/tech/tech.css?v=1.3',
  '/frontend/tech/tech.js?v=1.4',
  '/frontend/tech/assets/pari_logo.png',
  '/frontend/tech/assets/hero_technician.png',
  '/frontend/tech/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          return caches.match('/frontend/tech/index.html');
        })
      );
    })
  );
});
