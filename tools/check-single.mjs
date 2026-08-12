/*
 * Verifica la versione a file singolo aprendola da disco (file://), senza
 * server: è il modo in cui la userà chi riceve il file.
 *
 *   node tools/build-single.mjs && node tools/check-single.mjs
 */
import { chromium, devices } from 'playwright';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const square = (name) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) console.log(`  ok   ${label}`);
  else {
    console.error(`  FAIL ${label} ${detail}`);
    failures.push(label);
  }
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['iPhone 14'], hasTouch: true })).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(`file://${join(ROOT, 'dist', 'aperture-scacchi.html')}`);
await page.waitForSelector('.level-card');
check('home disegnata', (await page.locator('.level-card').count()) === 3);

await page.evaluate(() => { location.hash = '#/apertura/italiana/allena'; });
await page.waitForSelector('.board .sq');
check('scacchiera completa', (await page.locator('.sq').count()) === 64);
check('pezzi in posizione', (await page.locator('.piece--w, .piece--b').count()) === 32);

await page.click(`.sq[data-i="${square('e2')}"]`);
await page.waitForTimeout(120);
check('mosse legali evidenziate', (await page.locator('.sq--dest').count()) === 2);

await page.click(`.sq[data-i="${square('e4')}"]`);
await page.waitForTimeout(200);
check('mossa riconosciuta', (await page.textContent('#prompt')).includes('esatto'));

await page.waitForSelector('.board:not(.board--locked)', { timeout: 4000 });
check('risposta avversaria giocata', (await page.locator('.piece--b').count()) === 16);

await page.evaluate(() => { location.hash = '#/'; });
await page.waitForTimeout(200);
check('progressi salvati anche da file://', (await page.locator('[data-go="#/apertura/italiana"]').count()) > 0);

await page.screenshot({ path: join(ROOT, 'tools', 'screenshots', '9-file-singolo.png') });
check('nessun errore JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${failures.length ? `${failures.length} controllo/i fallito/i` : 'File singolo funzionante'}`);
process.exit(failures.length ? 1 : 0);
