const CACHE = 'nes-cache-v4';

const PRECACHE_URLS = [
  '/',
  '/h5/',
  '/library/',
  '/css/common.css',
  '/css/pc.css',
  '/css/h5.css',
  '/css/library.css',
  '/css/game.css',
  '/js/core/emulator.js',
  '/js/core/rom-manager.js',
  '/js/core/save-manager.js',
  '/js/core/mapper4-fix.js',
  '/js/pc/pc-app.js',
  '/js/h5/h5-app.js',
  '/js/h5/virtual-gamepad.js',
  '/js/library/library-app.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

const API_ORIGIN = location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('SW pre-cache failed for some URLs:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.origin !== API_ORIGIN) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/css/')
  ) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (url.pathname.match(/\.(png|ico|json|svg|woff2?)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 408 });
  }
}
