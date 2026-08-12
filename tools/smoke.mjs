/*
 * Prova end-to-end su viewport iPhone: naviga le schermate, gioca un
 * allenamento completo e salva gli screenshot in tools/screenshots/.
 *
 *   node tools/smoke.mjs                              server locale
 *   node tools/smoke.mjs https://esempio.github.io/   sito pubblicato
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = join(ROOT, 'tools', 'screenshots');
const PORT = 8099;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    console.error(`  FAIL ${label} ${detail}`);
    failures.push(label);
  }
};

// Indice della casa: 0 = a8 ... 63 = h1
const square = (name) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

const BASE = process.argv[2] || `http://localhost:${PORT}/`;
if (!process.argv[2]) await new Promise((resolve) => server.listen(PORT, resolve));
else console.log(`Verifica del sito pubblicato: ${BASE}`);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], hasTouch: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const tap = async (selector) => { await page.click(selector); await page.waitForTimeout(120); };

/** Attende che l'app restituisca il turno al giocatore (scacchiera sbloccata). */
const waitForTurn = () => page.waitForSelector('.board:not(.board--locked)', { timeout: 5000 });

/** Gioca una mossa e restituisce il testo del riscontro immediato. */
const move = async (from, to) => {
  await tap(`.sq[data-i="${square(from)}"]`);
  await page.click(`.sq[data-i="${square(to)}"]`);
  await page.waitForTimeout(150);
  return page.textContent('#prompt');
};

console.log('\n▸ Home');
await page.goto(BASE, { waitUntil: 'networkidle' });
check('titolo presente', (await page.textContent('.hero h1')).includes('Impara le aperture'));
check('tre livelli elencati', (await page.locator('#levels .level-card').count()) === 3);
await page.screenshot({ path: join(SHOTS, '1-home.png') });

console.log('\n▸ Elenco livello 1');
await tap('[data-go="#/livello/1"]');
const cards = await page.locator('#list .opening-card').count();
check('aperture del livello elencate', cards === 11, `(trovate ${cards})`);
await page.screenshot({ path: join(SHOTS, '2-livello.png') });

console.log('\n▸ Modalità Impara');
await tap('[data-go="#/apertura/italiana"]');
await page.waitForSelector('.board .sq');
check('64 case disegnate', (await page.locator('.sq').count()) === 64);
check('32 pezzi in posizione iniziale', (await page.locator('.piece--w, .piece--b').count()) === 32);
check('idea mostrata', (await page.textContent('#note')).includes('L’idea'));
await tap('#next');
await tap('#next');
check('due semimosse giocate', (await page.locator('.move-chip--current').textContent()).includes('e5'));
check('notazione italiana attiva', (await page.textContent('#moves')).includes('C'));
await page.screenshot({ path: join(SHOTS, '3-impara.png') });

console.log('\n▸ Allenamento (mosse corrette)');
await tap('[data-go="#/apertura/italiana/allena"]');
await page.waitForSelector('#prompt');
check('invito alla mossa 1', (await page.textContent('#prompt')).includes('mossa 1'));

check('prima mossa accettata', (await move('e2', 'e4')).includes('esatto'));
await waitForTurn();

// Mossa sbagliata volontaria: legale, ma non è la mossa della variante
const wrong = await move('b1', 'c3');
check('mossa fuori variante rifiutata', wrong.includes('Non è la mossa'), wrong);
check('cavallo rimasto in b1', (await page.locator(`.sq[data-i="${square('b1')}"] .piece--w`).count()) === 1);
await page.screenshot({ path: join(SHOTS, '4-errore.png') });

// Secondo tentativo sbagliato: l'app suggerisce il pezzo giusto
const second = await move('d2', 'd4');
check('secondo errore mostra l’aiuto', second.includes('cavallo') && second.includes('g1'), second);

for (const [from, to] of [['g1', 'f3'], ['f1', 'c4'], ['c2', 'c3'], ['d2', 'd3'], ['e1', 'g1']]) {
  await waitForTurn();
  const feedback = await move(from, to);
  check(`mossa ${from}→${to} accettata`, feedback.includes('esatto'), feedback);
}

console.log('\n▸ Risultato');
await page.waitForSelector('.result', { timeout: 4000 });
const result = await page.textContent('.result');
check('schermata risultato mostrata', result.includes('%'));
check('stelle assegnate', (await page.locator('.result__stars .star--on').count()) >= 2);
await page.screenshot({ path: join(SHOTS, '5-risultato.png') });

console.log('\n▸ Persistenza');
await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(200);
const stars = Number(await page.locator('.stat__value--gold').textContent());
check('stelle salvate in home', stars >= 2, `(lette ${stars})`);
await page.reload({ waitUntil: 'networkidle' });
check('progressi ancora presenti dopo il reload', Number(await page.locator('.stat__value--gold').textContent()) === stars);
check('scorciatoia "Riprendi" mostrata', (await page.locator('[data-go="#/apertura/italiana"]').count()) > 0);
await page.screenshot({ path: join(SHOTS, '6-home-progressi.png') });

console.log('\n▸ Impostazioni');
await tap('#bar-action');
await tap('#notation');
check('notazione commutata', (await page.getAttribute('#notation', 'aria-checked')) === 'false');
await tap('#notation');
await page.screenshot({ path: join(SHOTS, '7-impostazioni.png') });

console.log('\n▸ Allenamento di livello');
await page.evaluate(() => { location.hash = '#/livello/3'; });
await page.waitForTimeout(200);
await tap('[data-go="#/allenamento/3"]');
await page.waitForSelector('.progress-line span');
check('coda di allenamento avviata', (await page.textContent('#head')).includes('Apertura 1 di'));
await page.screenshot({ path: join(SHOTS, '8-allenamento-livello.png') });

check('nessun errore JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

console.log(`\n${failures.length ? `${failures.length} controllo/i fallito/i` : 'Tutti i controlli superati'} — screenshot in tools/screenshots/`);
process.exit(failures.length ? 1 : 0);
