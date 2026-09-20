/* Imposter service worker: keeps the app playable offline after the first visit.
   - The app shell (/, index.html, manifest, icons) is cached on install.
   - Hashed build assets under /assets/ never change, so they are cache-first.
   - Everything else is network-first with the cache as a fallback, so a new
     deploy is picked up on the next online load. */

const CACHE = 'imposter-v3';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/fonts/playfair-700.woff2',
  '/fonts/playfair-900.woff2',
  '/fonts/playfair-700i.woff2',
  '/fonts/imfell-400.woff2',
  '/fonts/imfell-400i.woff2',
  '/fonts/imfell-sc.woff2',
  '/textures/leather.jpg',
  '/textures/paper.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('/index.html') : undefined)),
      ),
  );
});
