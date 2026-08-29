/* Service worker: rende l'app utilizzabile offline dopo la prima visita. */
const CACHE = 'aperture-scacchi-v5';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/board.js',
  'assets/js/chess.js',
  'assets/js/openings.js',
  'assets/js/puzzles.js',
  'assets/js/tactics.js',
  'assets/js/rating.js',
  'assets/js/percorso.js',
  'assets/js/basics.js',
  'assets/js/fsrs.js',
  'assets/js/stats.js',
  'assets/js/chart.js',
  'assets/js/optimizer.js',
  'assets/js/store.js',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('index.html'));
      return cached || network;
    }),
  );
});
