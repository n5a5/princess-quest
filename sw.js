// sw.js — cache-first with a versioned precache. Bump VERSION on every release.
const VERSION = 'arcade-v3.1.0';
const ASSETS = [
  '',
  'assets/audio/phonemes/a.ogg',
  'assets/audio/phonemes/ae.ogg',
  'assets/audio/phonemes/b.ogg',
  'assets/audio/phonemes/ch.ogg',
  'assets/audio/phonemes/d.ogg',
  'assets/audio/phonemes/e.ogg',
  'assets/audio/phonemes/ee.ogg',
  'assets/audio/phonemes/f.ogg',
  'assets/audio/phonemes/g.ogg',
  'assets/audio/phonemes/h.ogg',
  'assets/audio/phonemes/i.ogg',
  'assets/audio/phonemes/ie.ogg',
  'assets/audio/phonemes/j.ogg',
  'assets/audio/phonemes/k.ogg',
  'assets/audio/phonemes/l.ogg',
  'assets/audio/phonemes/m.ogg',
  'assets/audio/phonemes/n.ogg',
  'assets/audio/phonemes/ng.ogg',
  'assets/audio/phonemes/o.ogg',
  'assets/audio/phonemes/oe.ogg',
  'assets/audio/phonemes/p.ogg',
  'assets/audio/phonemes/qu.ogg',
  'assets/audio/phonemes/r.ogg',
  'assets/audio/phonemes/s.ogg',
  'assets/audio/phonemes/sh.ogg',
  'assets/audio/phonemes/t.ogg',
  'assets/audio/phonemes/th.ogg',
  'assets/audio/phonemes/u.ogg',
  'assets/audio/phonemes/ue.ogg',
  'assets/audio/phonemes/v.ogg',
  'assets/audio/phonemes/w.ogg',
  'assets/audio/phonemes/x.ogg',
  'assets/audio/phonemes/y.ogg',
  'assets/audio/phonemes/z.ogg',
  'content/audio-manifest.json',
  'content/phonics.json',
  'content/praise.json',
  'content/sounds.json',
  'content/standards.json',
  'games/princess-quest/try-it.js',
  'games/registry.js',
  'icon-192.png',
  'icon-512.png',
  'index.html',
  'manifest.json',
  'parent/index.html',
  'parent/parent.css',
  'parent/parent.js',
  'princess.png',
  'shared/adaptive.js',
  'shared/audio.js',
  'shared/audiostore.js',
  'shared/content.js',
  'shared/economy.js',
  'shared/session.js',
  'shared/speech.js',
  'shared/theme.css',
  'shared/ui.js',
  'shell.js'
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
