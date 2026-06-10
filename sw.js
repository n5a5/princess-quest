const CACHE_NAME = 'amelia-world-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './core.js',
  './letter-garden.js',
  './number-meadow.js',
  './castle.js',
  './parent.js',
  './manifest.json',
  './princess.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first with cache fallback: fresh when online, fully working offline.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
