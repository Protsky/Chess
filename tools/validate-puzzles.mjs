/*
 * validate-puzzles.mjs — il corpus tattico regge davvero?
 *
 *   node tools/validate-puzzles.mjs
 *
 * Non si fida del database: rigioca ogni posizione sul motore dell'app. Se una
 * soluzione contiene una mossa illegale, se il FEN non si legge, o se un matto
 * annunciato non è matto, qui si ferma — non davanti a chi sta studiando.
 */

import { fromFen, playUci, legalMoves, inCheck, fen as toFen, other } from '../assets/js/chess.js';
import { PUZZLES, THEMES } from '../assets/js/puzzles.js';

let checks = 0;
const errors = [];

const fail = (id, message) => errors.push(`${id}: ${message}`);
const check = (cond, id, message) => { checks += 1; if (!cond) fail(id, message); };

const seen = new Set();

for (const p of PUZZLES) {
  check(!seen.has(p.id), p.id, 'identificativo ripetuto');
  seen.add(p.id);

  const start = fromFen(p.f);
  check(!!start, p.id, `FEN non leggibile: ${p.f}`);
  if (!start) continue;

  check(toFen(start).split(' ').slice(0, 4).join(' ') === p.f.split(' ').slice(0, 4).join(' '),
    p.id, 'il FEN riletto non coincide con quello di partenza');

  const ucis = p.m.split(' ');
  check(ucis.length >= 2 && ucis.length % 2 === 0, p.id, `numero di semimosse dispari: ${ucis.length}`);

  let line;
  try {
    line = playUci(ucis, start);
  } catch (err) {
    fail(p.id, err.message);
    continue;
  }
  checks += 1;

  // Convenzione Lichess: la prima mossa è dell'avversario, poi tocca a chi risolve.
  const solver = other(start.turn);
  check(line.states[1].turn === solver, p.id, 'dopo la prima mossa non tocca a chi risolve');

  // Le mosse dispari (indice 1, 3, …) sono le sue: sono quelle che l'app chiede.
  const userMoves = line.moves.filter((_, i) => i % 2 === 1);
  check(userMoves.length === ucis.length / 2, p.id, 'conteggio delle mosse da trovare sbagliato');

  const end = line.states[line.states.length - 1];
  const mate = inCheck(end) && legalMoves(end).length === 0;
  if (p.t === 'mateIn1' || p.t === 'mateIn2' || p.t === 'backRankMate' || p.t === 'smotheredMate') {
    check(mate, p.id, `annunciato ${THEMES[p.t]}, ma la posizione finale non è matto`);
  }
  if (p.t === 'mateIn1') check(userMoves.length === 1, p.id, 'matto in uno con più di una mossa da trovare');

  check(!!THEMES[p.t], p.id, `motivo sconosciuto: ${p.t}`);
  check(p.r >= 400 && p.r < 2200, p.id, `punteggio fuori fascia: ${p.r}`);
}

/* Il corpus serve a un percorso: se una fascia è vuota, quel tratto non esiste. */
const bands = {};
for (const p of PUZZLES) {
  const b = Math.floor(p.r / 200) * 200;
  bands[b] = (bands[b] || 0) + 1;
}
const thin = Object.entries(bands).filter(([, n]) => n < 60);

console.log(`Posizioni: ${PUZZLES.length}`);
console.log(`Controlli: ${checks}`);
console.log(`Fasce da 200 punti: ${Object.keys(bands).length}${thin.length ? ` (magre: ${thin.map(([b, n]) => `${b}→${n}`).join(', ')})` : ''}`);

if (errors.length) {
  console.error(`\n${errors.length} problemi:`);
  errors.slice(0, 30).forEach((e) => console.error(`  ${e}`));
  if (errors.length > 30) console.error(`  … e altri ${errors.length - 30}`);
  process.exit(1);
}

console.log('\nTutto legale: ogni soluzione è stata rigiocata sul motore.');
