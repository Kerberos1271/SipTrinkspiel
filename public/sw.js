const VERSION = new URL(self.location.href).searchParams.get('v') || 'runtime';
const CACHE_NAME = `sip-static-${VERSION}`;
const APP_SHELL = ['/', '/install', '/manifest.webmanifest', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/pwa-192x192.png', '/pwa-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  const fetchAndCache = () => fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  });

  if (event.request.mode === 'navigate') {
    // Always try the newest app shell on reload; use the cached shell only offline.
    event.respondWith(fetchAndCache().catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
  } else {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache()));
  }
});
