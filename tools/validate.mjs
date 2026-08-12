/*
 * Verifica che ogni linea del repertorio sia una sequenza di mosse legali
 * e che la notazione generata dal motore coincida con quella scritta a mano.
 *
 *   node tools/validate.mjs
 */
import { newGame, fromSan, applyMove, toSan, legalMoves } from '../assets/js/chess.js';
import { OPENINGS, LEVELS, plies } from '../assets/js/openings.js';

let errors = 0;
let checkedPlies = 0;
const ids = new Set();

for (const opening of OPENINGS) {
  const prefix = `[${opening.id}] ${opening.name}`;

  if (ids.has(opening.id)) {
    console.error(`${prefix}: id duplicato`);
    errors++;
  }
  ids.add(opening.id);

  if (!LEVELS.some((l) => l.id === opening.level)) {
    console.error(`${prefix}: livello sconosciuto (${opening.level})`);
    errors++;
  }
  if (opening.side !== 'w' && opening.side !== 'b') {
    console.error(`${prefix}: lato non valido (${opening.side})`);
    errors++;
  }

  const sans = plies(opening);
  let state = newGame();
  let ok = true;

  sans.forEach((san, i) => {
    if (!ok) return;
    const move = fromSan(state, san);
    if (!move) {
      console.error(`${prefix}: semimossa ${i + 1} "${san}" illegale o ambigua`);
      errors++;
      ok = false;
      return;
    }
    const generated = toSan(state, move, legalMoves(state));
    if (generated !== san) {
      console.error(`${prefix}: semimossa ${i + 1} scritta "${san}", il motore genera "${generated}"`);
      errors++;
    }
    state = applyMove(state, move);
    checkedPlies++;
  });

  for (const key of Object.keys(opening.notes || {})) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 0 || n >= sans.length) {
      console.error(`${prefix}: nota fuori intervallo (semimossa ${key} su ${sans.length})`);
      errors++;
    }
  }

  const trained = sans.filter((_, i) => (i % 2 === 0 ? 'w' : 'b') === opening.side).length;
  if (trained < 3) {
    console.error(`${prefix}: solo ${trained} mosse da allenare, troppo poche`);
    errors++;
  }
}

for (const level of LEVELS) {
  const count = OPENINGS.filter((o) => o.level === level.id).length;
  console.log(`Livello ${level.id} (${level.name}): ${count} aperture`);
}

console.log(`\n${OPENINGS.length} aperture, ${checkedPlies} semimosse verificate.`);
if (errors) {
  console.error(`${errors} errore/i trovato/i.`);
  process.exit(1);
}
console.log('Tutte le linee sono legali.');
