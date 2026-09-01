const VERSION = new URL(self.location.href).searchParams.get('v') || 'runtime';
const STATIC_CACHE_NAME = `sip-static-${VERSION}`;
const API_CACHE_NAME = 'sip-api-v1';
const APP_SHELL = ['/', '/index.html', '/install', '/manifest.webmanifest', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/pwa-192x192.png', '/pwa-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('sip-static-') && key !== STATIC_CACHE_NAME)
      .map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

function fetchWithTimeout(request, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cacheKey = new Request(new URL('/api/game', request.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);

  try {
    const response = await fetchWithTimeout(request);
    if (response.status === 200 && await isValidGameResponse(response)) {
      try { await cache.put(cacheKey, response.clone()); } catch { /* Keep the previous API response if storage fails. */ }
      return response;
    }
    return cached ? markAsCacheFallback(cached) : response;
  } catch {
    return cached ? markAsCacheFallback(cached) : new Response(JSON.stringify({ error: 'Offline und keine gespeicherten Spieldaten vorhanden.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function isValidGameResponse(response) {
  const data = await response.clone().json().catch(() => null);
  return Boolean(data
    && Array.isArray(data.categories)
    && data.categories.every((category) => category && typeof category.id === 'number' && typeof category.name === 'string')
    && Array.isArray(data.cards)
    && data.cards.every((card) => card && typeof card.id === 'number' && typeof card.text === 'string' && typeof card.category_id === 'number'));
}

function markAsCacheFallback(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Sip-Cache-Fallback', '1');
  return new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Only public game data is cached. Admin/auth responses must never enter
  // the offline cache because they may contain private information.
  if (url.origin === self.location.origin && url.pathname === '/api/game') {
    event.respondWith(networkFirstApi(event.request));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  const fetchAndCache = () => fetchWithTimeout(event.request).then((response) => {
    if (!response.ok && response.type !== 'opaque') return response;
    return caches.open(STATIC_CACHE_NAME)
      .then((cache) => cache.put(event.request, response.clone()))
      .catch(() => undefined)
      .then(() => response);
  });

  if (event.request.mode === 'navigate') {
    // Always try the newest app shell on reload; use the cached shell only offline.
    event.respondWith(fetchAndCache().catch(() => caches.open(STATIC_CACHE_NAME).then((cache) => cache.match(event.request).then((cached) => cached || cache.match('/')))));
  } else {
    event.respondWith(caches.open(STATIC_CACHE_NAME).then((cache) => cache.match(event.request).then((cached) => cached || fetchAndCache())));
  }
});
