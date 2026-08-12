/*
 * Costruisce una versione dell'app in un file solo: CSS e moduli JavaScript
 * vengono incorporati nella pagina, così il file funziona anche aperto
 * direttamente da disco o inviato a qualcuno.
 *
 *   node tools/build-single.mjs
 *
 * Produce:
 *   dist/aperture-scacchi.html   documento completo, autonomo
 *   dist/fragment.html           solo contenuto (per host che forniscono <head>)
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Rimuove import/export per concatenare i moduli in un unico script. */
function flatten(source) {
  return source
    .split('\n')
    .filter((l) => !/^import[\s.{*]/.test(l) && !/^export\s*\{/.test(l))
    .map((l) => l.replace(/^export\s+/, ''))
    .join('\n')
    .trim();
}

// store.js viene usato come namespace (`Store.getSettings()`): lo si ricrea a mano.
const STORE_NAMESPACE = `
const Store = {
  getSettings, setSetting, getProgress, allProgress, getLastOpening,
  setLastOpening, saveResult, summarize, totalTrainings, reset,
};`;

const app = flatten(read('assets/js/app.js'))
  .replace(/if \('serviceWorker' in navigator\)[\s\S]*$/, '')
  .trim();

const script = [
  '/* motore */', flatten(read('assets/js/chess.js')),
  '/* repertorio */', flatten(read('assets/js/openings.js')),
  '/* progressi */', flatten(read('assets/js/store.js')), STORE_NAMESPACE,
  '/* scacchiera */', flatten(read('assets/js/board.js')),
  '/* applicazione */', app,
].join('\n\n');

const BODY = `<style>
${read('assets/css/app.css').trim()}
</style>

<header class="app-bar">
  <button class="icon-btn icon-btn--ghost" id="bar-back" hidden aria-label="Indietro">‹ Indietro</button>
  <h1 class="app-bar__title" id="bar-title">Aperture di Scacchi</h1>
  <button class="icon-btn icon-btn--ghost" id="bar-action" hidden></button>
</header>

<main class="view" id="view"></main>

<script>
// Alcuni host forniscono il proprio <head>: ci si assicura che il viewport
// sia impostato prima di disegnare la scacchiera.
if (!document.querySelector('meta[name="viewport"]')) {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  document.head.appendChild(meta);
}
</script>

<script type="module">
${script}
</script>`;

const DOCUMENT = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<title>Aperture di Scacchi</title>
<meta name="description" content="Gioco per memorizzare le aperture di scacchi più importanti, divise per livello.">
<meta name="theme-color" content="#0f1219">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Aperture">
</head>
<body>
${BODY}
</body>
</html>
`;

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist', 'aperture-scacchi.html'), DOCUMENT);
writeFileSync(join(ROOT, 'dist', 'fragment.html'), `<title>Aperture di Scacchi</title>\n${BODY}\n`);

const kb = (s) => `${Math.round(s.length / 1024)} KB`;
console.log(`dist/aperture-scacchi.html  ${kb(DOCUMENT)}`);
console.log(`dist/fragment.html          ${kb(BODY)}`);
