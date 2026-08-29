/*
 * build-puzzles.mjs — estrae il corpus tattico dal database aperto di Lichess.
 *
 *   node tools/build-puzzles.mjs percorso/lichess_db_puzzle.csv.zst
 *
 * Il database completo (CC0, ~6 milioni di posizioni) non entra in un'app che
 * deve funzionare offline: qui se ne prende un sottoinsieme **stratificato per
 * fascia di punteggio e per motivo tattico**, così che a ogni livello di forza
 * corrispondano abbastanza posizioni di ogni tipo.
 *
 * La scelta è deterministica: stesso file in ingresso, stesso corpus in uscita.
 * Non si campiona a caso perché un corpus che cambia a ogni build renderebbe
 * impossibile dire se una differenza nei numeri viene dal codice o dai dati.
 *
 * Fonte: https://database.lichess.org/  (licenza CC0)
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/js/puzzles.js');

/* --------------------------- che cosa si tiene --------------------------- */

/** Fasce di punteggio: dal principiante assoluto al giocatore di club. */
const MIN_RATING = 400;
const MAX_RATING = 2200;
const BAND = 100;

/** Quanto materiale per fascia, e quanto per ogni motivo dentro la fascia. */
const PER_BAND = 190;
const PER_BAND_THEME = 14;

/** Qualità: posizioni giocate abbastanza da avere un punteggio che significa qualcosa. */
const MIN_PLAYS = 500;
const MIN_POPULARITY = 85;
const MAX_DEVIATION = 90;

/** Al massimo tre mosse da trovare: oltre, è calcolo lungo, non riconoscimento. */
const MAX_PLIES = 6;

/*
 * I motivi, in ordine di priorità: a ogni posizione si assegna il primo che ha.
 * Sono i dodici del livello 3 più le famiglie di matto; i temi "meta" di Lichess
 * (lunghezza, vantaggio, fase) non stanno qui — li teniamo a parte.
 */
const THEMES = [
  ['hangingPiece', 'Pezzo in presa'],
  ['mateIn1', 'Matto in uno'],
  ['fork', 'Forchetta'],
  ['pin', 'Inchiodatura'],
  ['skewer', 'Infilata'],
  ['discoveredAttack', 'Scoperta'],
  ['doubleCheck', 'Scacco doppio'],
  ['backRankMate', 'Matto del corridoio'],
  ['smotheredMate', 'Matto affogato'],
  ['deflection', 'Deviazione'],
  ['attraction', 'Attrazione'],
  ['clearance', 'Sgombero'],
  ['interference', 'Interferenza'],
  ['intermezzo', 'Mossa intermedia'],
  ['xRayAttack', 'Attacco a raggi X'],
  ['capturingDefender', 'Cattura del difensore'],
  ['trappedPiece', 'Pezzo intrappolato'],
  ['promotion', 'Promozione'],
  ['sacrifice', 'Sacrificio'],
  ['quietMove', 'Mossa quieta'],
  ['defensiveMove', 'Mossa difensiva'],
  ['mateIn2', 'Matto in due'],
];

const THEME_KEYS = THEMES.map(([k]) => k);
const PHASES = ['opening', 'middlegame', 'endgame'];

/* ------------------------------- estrazione ------------------------------ */

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error('Serve il database: node tools/build-puzzles.mjs <lichess_db_puzzle.csv.zst>');
  console.error('Si scarica da https://database.lichess.org/lichess_db_puzzle.csv.zst (CC0).');
  process.exit(2);
}

const bandOf = (rating) => Math.floor((rating - MIN_RATING) / BAND);
const bandCount = Math.ceil((MAX_RATING - MIN_RATING) / BAND);

const perBand = new Array(bandCount).fill(0);
const perBandTheme = new Map();
const picked = [];

let seen = 0;
let kept = 0;

/*
 * Il file di Lichess non è un solo blocco compresso: è un frame di metadati
 * "saltabile" seguito da una trentina di frame zstd indipendenti, concatenati.
 * L'utility `zstd` li attraversa da sola; il decompressore in streaming di node
 * no — finisce il primo frame e si ferma (o inciampa nel frame saltabile con
 * ZSTD_error_prefix_unknown). Leggendo un frame alla volta si legge tutto.
 *
 * I confini si trovano cercando il magic dei frame zstd. Se un magic capitasse
 * per caso dentro i dati compressi, quel pezzo non si decomprime: in quel caso
 * si riattacca al pezzo successivo e si riprova, invece di perdere righe.
 */
const FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

function* zstdRows(file) {
  const buf = fs.readFileSync(file);
  const plain = !file.endsWith('.zst');

  const starts = [];
  if (plain) starts.push(0);
  else {
    let at = 0;
    while ((at = buf.indexOf(FRAME_MAGIC, at)) !== -1) { starts.push(at); at += 4; }
  }
  starts.push(buf.length);

  let rest = '';
  for (let i = 0; i < starts.length - 1; i++) {
    let text;
    let end = i + 1;
    for (;;) {
      const slice = buf.subarray(starts[i], starts[end]);
      try {
        text = plain ? slice.toString('utf8') : zlib.zstdDecompressSync(slice).toString('utf8');
        break;
      } catch (err) {
        end += 1;                       // magic finto: il frame continua oltre
        if (end >= starts.length) throw err;
      }
    }
    i = end - 1;

    const lines = (rest + text).split('\n');
    rest = lines.pop() ?? '';
    for (const row of lines) yield row;
  }
  if (rest) yield rest;
}

console.log('Lettura del database…');

for (const raw of zstdRows(source)) {
  if (!raw || raw.startsWith('PuzzleId,')) continue;
  seen += 1;
  if (seen % 1000000 === 0) console.log(`  ${(seen / 1e6).toFixed(0)}M righe lette, ${kept} tenute`);

  const cols = raw.split(',');
  if (cols.length < 8) continue;
  const [id, fen, moves, ratingText, devText, popText, playsText, themesText] = cols;

  const rating = Number(ratingText);
  if (!(rating >= MIN_RATING && rating < MAX_RATING)) continue;
  if (Number(devText) > MAX_DEVIATION) continue;
  if (Number(popText) < MIN_POPULARITY) continue;
  if (Number(playsText) < MIN_PLAYS) continue;

  const plies = moves.split(' ');
  if (plies.length < 2 || plies.length > MAX_PLIES || plies.length % 2 !== 0) continue;

  const themes = themesText.split(' ');
  const motif = THEME_KEYS.find((k) => themes.includes(k));
  if (!motif) continue;

  const band = bandOf(rating);
  if (perBand[band] >= PER_BAND) continue;
  const key = `${band}|${motif}`;
  const n = perBandTheme.get(key) || 0;
  if (n >= PER_BAND_THEME) continue;

  perBand[band] += 1;
  perBandTheme.set(key, n + 1);
  kept += 1;

  picked.push({
    id,
    f: fen,
    m: moves,
    r: rating,
    t: motif,
    p: PHASES.find((x) => themes.includes(x)) || 'middlegame',
  });
}

/* -------------------------------- scrittura ------------------------------- */

picked.sort((a, b) => (a.r - b.r) || a.id.localeCompare(b.id));

const lines = picked.map((p) => `  { id: '${p.id}', f: '${p.f}', m: '${p.m}', r: ${p.r}, t: '${p.t}', p: '${p.p}' },`);

const body = `/*
 * puzzles.js — il corpus tattico. GENERATO: non modificare a mano.
 *
 *   node tools/build-puzzles.mjs <lichess_db_puzzle.csv.zst>
 *
 * ${picked.length} posizioni scelte dal database aperto di Lichess (licenza CC0,
 * https://database.lichess.org/), stratificate per fascia di punteggio e motivo
 * tattico. Ogni voce ha il punteggio Glicko-2 calcolato da Lichess su milioni di
 * tentativi reali: è la difficoltà misurata, non stimata da noi.
 *
 * Convenzione del database, importante: \`f\` è la posizione **prima** della mossa
 * sbagliata dell'avversario, e la prima mossa di \`m\` è quella dell'avversario.
 * Si gioca quindi la prima mossa, e solo dopo tocca a chi risolve.
 *
 *   id  identificativo Lichess (la posizione si rivede su lichess.org/training/id)
 *   f   FEN di partenza
 *   m   soluzione in UCI, mosse separate da spazio (la prima è dell'avversario)
 *   r   punteggio Glicko-2 della posizione
 *   t   motivo tattico principale
 *   p   fase di gioco
 */

/** I motivi tattici, con il nome italiano usato nell'app. */
export const THEMES = ${JSON.stringify(Object.fromEntries(THEMES), null, 2).replace(/"/g, "'")};

export const PUZZLES = [
${lines.join('\n')}
];

/** Posizioni entro una fascia di punteggio. */
export function byRating(min, max) {
  return PUZZLES.filter((p) => p.r >= min && p.r <= max);
}

/** Posizioni di un motivo. */
export function byTheme(theme) {
  return PUZZLES.filter((p) => p.t === theme);
}

export function puzzleById(id) {
  return PUZZLES.find((p) => p.id === id) || null;
}

/** Quante posizioni per fascia di 100 punti: serve a vedere i buchi del corpus. */
export function distribution() {
  const out = {};
  for (const p of PUZZLES) {
    const band = Math.floor(p.r / 100) * 100;
    out[band] = (out[band] || 0) + 1;
  }
  return out;
}
`;

fs.writeFileSync(OUT, body);

const themeTotals = {};
for (const p of picked) themeTotals[p.t] = (themeTotals[p.t] || 0) + 1;

console.log(`\nRighe lette: ${seen.toLocaleString('it-CH')}`);
console.log(`Posizioni tenute: ${picked.length}`);
console.log(`Scritte in ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)\n`);
console.log('Per fascia:');
perBand.forEach((n, i) => {
  const from = MIN_RATING + i * BAND;
  console.log(`  ${from}-${from + BAND - 1}  ${String(n).padStart(4)}${n < PER_BAND ? '  ← sotto la quota' : ''}`);
});
console.log('\nPer motivo:');
for (const [key, name] of THEMES) {
  const n = themeTotals[key] || 0;
  console.log(`  ${name.padEnd(24)} ${String(n).padStart(4)}${n === 0 ? '  ← assente' : ''}`);
}
