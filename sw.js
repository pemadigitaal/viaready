// ViaReady service worker: network first, cached copy when offline
const CACHE = 'viaready-v2';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;           // Supabase + CDN go straight to the network
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Later: push notifications ("Morgen les: start je voorbereiding")
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'ViaReady', body: 'Je volgende les komt eraan. Start je voorbereiding.' };
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: 'icons/icon-192.png' }));
});
