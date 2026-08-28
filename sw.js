const CACHE = 'piecework-cache';
const PACKAGE_ASSET = './package.json';
const PACKAGE_URL = new URL(PACKAGE_ASSET, self.location.href).href;
const CORE = [
  './',
  './index.html',
  './app.js',
  './js/puzzle.js',
  './js/dom.js',
  './js/i18n.js',
  './js/state.js',
  './js/storage.js',
  './js/renderer.js',
  './js/game.js',
  './js/tray.js',
  './js/board-input.js',
  './js/ui.js',
  './styles/base.css',
  './styles/layout.css',
  './styles/game.css',
  './styles/components.css',
  './styles/responsive.css',
  './manifest.webmanifest',
  './package.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isPackageRequest = event.request.url === PACKAGE_URL;
  if (isPackageRequest) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) {
            return caches.match(PACKAGE_URL).then(cached => cached || response);
          }
          const cacheRequest = new Request(PACKAGE_URL);
          caches.open(CACHE)
            .then(cache => cache.put(cacheRequest, response.clone()))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match(PACKAGE_URL)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match('./index.html'))),
  );
});
