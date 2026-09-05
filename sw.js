/* Service worker: rende l'app utilizzabile offline dopo la prima visita. */
const CACHE = 'aperture-scacchi-v14';

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
  'assets/js/endgames.js',
  'assets/js/sync.js',
  'assets/js/trasloco.js',
  'assets/js/endgames-data.js',
  'assets/js/fsrs.js',
  'assets/js/stats.js',
  'assets/js/chart.js',
  'assets/js/optimizer.js',
  'assets/js/store.js',
  'assets/js/mirror.js',
  'assets/js/see.js',
  'assets/js/esame.js',
  'assets/js/stima.js',
  'assets/js/calcolo.js',
  'assets/js/ricostruzione.js',
  'assets/js/piani.js',
  'assets/js/regime.js',
  'assets/js/quiete.js',
  'assets/js/trappole.js',
  'assets/js/trappola.js',
  'assets/js/forzante.js',
  'assets/js/calibrato.js',
  'assets/js/pgn.js',
  'assets/js/partite.js',
  'assets/js/manifesto.js',
  'assets/icons/icon-180.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

/*
 * In installazione i file si scaricano con `cache: 'reload'`, cioè **saltando la
 * cache HTTP del browser**. Senza, succede questo: GitHub Pages manda
 * `max-age=600`, e per dieci minuti dopo una pubblicazione il telefono che ha già
 * visitato l'app continua a ricevere i file vecchi — che il service worker poi
 * congela nella sua cache, facendoli durare molto più di dieci minuti.
 * (Visto succedere: due volte di fila, sul sito vero.)
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
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
  const indirizzo = new URL(request.url);
  if (request.method !== 'GET' || indirizzo.origin !== self.location.origin) return;

  // Il deposito dei progressi non si mette MAI in cache: una risposta vecchia
  // qui vorrebbe dire riprendere da carte che non sono piu' quelle.
  if (indirizzo.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      // Anche a regime si chiede al server la versione fresca, scavalcando la
      // cache HTTP: la risposta serve solo ad aggiornare la copia per la
      // prossima apertura, quindi il ritardo non lo vede nessuno.
      const network = fetch(new Request(request, { cache: 'no-cache' }))
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
