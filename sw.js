// sw.js — cache-first with a versioned precache. Bump VERSION on every release.
const VERSION = 'arcade-v3.0.3';
const ASSETS = [
  '',
  'index.html',
  'shell.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'princess.png',
  'shared/theme.css',
  'shared/economy.js',
  'shared/adaptive.js',
  'shared/content.js',
  'shared/session.js',
  'shared/speech.js',
  'shared/ui.js',
  'games/registry.js',
  'games/princess-quest/try-it.js',
  'parent/index.html',
  'parent/parent.css',
  'parent/parent.js',
  'content/standards.json',
  'content/praise.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
  );
});
