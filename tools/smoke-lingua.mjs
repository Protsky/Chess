/*
 * Prova end-to-end dell'app "Frasi" su viewport iPhone: onboarding, test di
 * livello, una sessione di studio completa, statistiche e persistenza.
 *
 *   node tools/smoke-lingua.mjs                              server locale
 *   node tools/smoke-lingua.mjs https://esempio.github.io/   sito pubblicato
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = join(ROOT, 'tools', 'screenshots');
const PORT = 8098;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, normalize(path.endsWith('/') ? `${path}index.html` : path));
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

const BASE = process.argv[2] || `http://localhost:${PORT}/`;
if (!process.argv[2]) await new Promise((resolve) => server.listen(PORT, resolve));
else console.log(`Verifica del sito pubblicato: ${BASE}`);
mkdirSync(SHOTS, { recursive: true });

// CHROMIUM_PATH torna utile dove il browser scaricato da Playwright non c'è
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({ ...devices['iPhone 14'], hasTouch: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const tap = async (selector) => { await page.click(selector); await page.waitForTimeout(140); };
const shot = (name) => page.screenshot({ path: join(SHOTS, `lingua-${name}.png`) });

console.log('\n▸ Benvenuto');
await page.goto(new URL('lingua/', BASE).href, { waitUntil: 'networkidle' });
check('titolo presente', (await page.textContent('.hero__title')).includes('Impara per frasi'));
await shot('1-benvenuto');

console.log('\n▸ Scelta della lingua');
await tap('[data-act="start"]');
check('due lingue disponibili', (await page.locator('[data-lang]').count()) === 2);
await tap('[data-lang="en"]');

console.log('\n▸ Test di livello');
await page.waitForSelector('.prompt');
check('prima domanda mostrata', (await page.textContent('.pill')).includes('Domanda 1'));
check('quattro opzioni', (await page.locator('[data-i]').count()) === 4);
await shot('2-test');

let asked = 0;
while (await page.locator('.prompt').count()) {
  await page.click('[data-i="0"]');
  await page.waitForTimeout(700);
  asked++;
  if (asked > 20) break;
}
check('il test si ferma da solo', asked >= 8 && asked <= 16, `(${asked} domande)`);
await page.waitForSelector('.result__level');
const level = await page.textContent('.result__level');
check('livello assegnato', /^(A1|A2|B1|B2|C1|C2)$/.test(level.trim()), level);
const detail = await page.textContent('.card--flat');
check('stima e incertezza riportate', detail.includes('θ') && detail.includes('errore standard'), detail);
await shot('3-livello');

console.log('\n▸ Settore');
await tap('[data-act="next"]');
check('sei settori proposti', (await page.locator('[data-dom]').count()) === 6);
await tap('[data-dom="lavoro"]');
check('settore selezionato', (await page.locator('.chip-card--on').count()) === 1);
await tap('[data-act="done"]');
await shot('4-settore');

console.log('\n▸ Home');
await page.waitForSelector('[data-act="study"]');
const queueText = await page.textContent('.queue');
check('coda del giorno mostrata', queueText.includes('frasi nuove'));
check('livello in evidenza', (await page.textContent('.stat')).includes(level.trim()));
check('copertura del corpus mostrata', (await page.locator('.levels__row').count()) === 6);
await shot('5-home');

console.log('\n▸ Sessione di studio');
await tap('[data-act="study"]');
await page.waitForSelector('.study');
check('prima carta è una comprensione', (await page.textContent('.pill--comp')).includes('Comprendi'));
check('frase mostrata in grande', (await page.locator('.target').count()) === 1);
await shot('6-studio');

let answered = 0;
while (answered < 40 && (await page.locator('.study').count())) {
  if (await page.locator('.input').count()) await page.fill('.input', 'test');
  if (await page.locator('[data-act="reveal"]').count()) {
    await tap('[data-act="reveal"]');
    if (answered === 0) {
      check('la nota grammaticale compare dopo la risposta', (await page.locator('.note').count()) === 1);
      check('quattro voti disponibili', (await page.locator('[data-grade]').count()) === 4);
      check('intervalli stimati mostrati', (await page.textContent('.grade__i')).length > 0);
      await shot('7-risposta');
    }
  }
  await tap('[data-grade="3"]');
  answered++;
}
check('sessione completata', (await page.locator('.done').count()) === 1, `(${answered} risposte)`);
check('riepilogo con precisione', (await page.textContent('.done')).includes('%'));
await shot('8-fine');

console.log('\n▸ Progressi');
await tap('[data-act="stats"]');
await page.waitForSelector('.chart');
check('due grafici disegnati', (await page.locator('.chart').count()) === 2);
check('composizione del mazzo mostrata', (await page.locator('.split__seg').count()) === 3);
check('grammatica coperta elencata', (await page.locator('.levels__lv--wide').count()) > 0);
await shot('9-progressi');

console.log('\n▸ Esplora');
await tap('[data-go="explore"]');
await page.waitForSelector('#q');
const before = await page.locator('.row-item').count();
await page.fill('#q', 'present perfect');
await page.waitForTimeout(250);
const after = await page.locator('.row-item').count();
check('la ricerca filtra', after > 0 && after < before, `(${before} → ${after})`);
await tap('[data-lv="C1"]');
check('filtro per livello attivo', (await page.locator('.chip--on').count()) >= 1);
await shot('10-esplora');

console.log('\n▸ Impostazioni');
await tap('[data-go="settings"]');
await page.waitForSelector('[data-set="newPerDay"]');
await page.locator('[data-set="newPerDay"]').fill('12');
await page.waitForTimeout(150);
check('frasi nuove al giorno aggiornate', (await page.textContent('.val')).includes('12'));
check('backup esportabile', (await page.locator('[data-act="export"]').count()) === 1);
await shot('11-impostazioni');

console.log('\n▸ Persistenza');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.stat');
check('si riapre sulla home', (await page.locator('[data-go="home"]').count()) === 1);
check('livello ancora salvato', (await page.textContent('.stat')).includes(level.trim()));
const seen = await page.locator('.stat').nth(2).textContent();
check('frasi viste memorizzate', Number(seen.replace(/\D+/g, '')) > 0, seen);
await shot('12-ritorno');

console.log('\n▸ Cloze e produzione');
// Si forza uno stato in cui la comprensione è già matura: così il passaggio
// successivo (il cloze) risulta sbloccato senza aspettare giorni veri.
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('frasi/v1'));
  const id = 'en-a1-01|comp';
  state.settings.newPerDay = 1;
  state.settings.typing = true;
  state.decks.en.cards = {
    [id]: {
      id, sid: 'en-a1-01', type: 'comp', state: 'review',
      s: 12, d: 5, due: Date.now() + 6 * 86400000, last: Date.now() - 86400000,
      reps: 2, lapses: 0, ivl: 12, step: 0,
    },
  };
  state.decks.en.daily = { day: null, introduced: 0, reviewed: 0 };
  localStorage.setItem('frasi/v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
await tap('[data-act="study"]');
await page.waitForSelector('.study');
check('il passaggio successivo è il cloze', (await page.locator('.pill--cloze').count()) === 1);
check('la frase è mostrata con il buco', (await page.textContent('.target')).includes('____'));
check('la traduzione fa da appoggio', (await page.textContent('.hint')).includes('Di dove sei'));
await page.fill('.input', 'are');
await tap('[data-act="reveal"]');
check('risposta giusta riconosciuta', (await page.locator('.check--ok').count()) === 1);
check('parola confermata', (await page.locator('.w--ok').count()) === 1);
check('voto suggerito su Bene', (await page.locator('.grade--3.grade--hint').count()) === 1);
await shot('13-cloze');

await tap('[data-grade="3"]');
check('la carta torna nella sessione finché non è imparata', (await page.locator('.study').count()) === 1);
await page.fill('.input', 'are');
await tap('[data-act="reveal"]');
await tap('[data-grade="3"]');
check('sessione conclusa', (await page.locator('.done').count()) === 1);
await shot('14-cloze-fine');

check('nessun errore JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

console.log(`\n${failures.length ? `${failures.length} controllo/i fallito/i` : 'Tutti i controlli superati'} — screenshot in tools/screenshots/`);
process.exit(failures.length ? 1 : 0);
