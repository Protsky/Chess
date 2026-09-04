/*
 * build-quiete.mjs — le posizioni in cui la risposta giusta è «niente».
 *
 *   node tools/build-quiete.mjs
 *
 * La regola 4 del percorso dice che un item su quattro non deve avere nessuna
 * tattica. Il motivo è che «c'è sempre qualcosa» è l'indizio più forte del
 * gioco: chi si allena solo su posizioni che *hanno* una soluzione impara a
 * cercarla sempre, e al tavolo quell'indizio non esiste. La conseguenza si
 * misura: sotto i 1400 i blunder per partita sono all'incirca gli stessi da 400
 * a 1700, cambia solo quando arriva il primo.
 *
 * Il problema è dimostrare che una posizione è quieta. Qui non c'è Stockfish,
 * e va bene: non serve una valutazione, serve un fatto verificabile. La
 * definizione usata, e scritta anche nell'app, è questa:
 *
 *   nessuna sequenza di catture e scacchi entro tre semimosse guadagna almeno
 *   due pedoni, per nessuno dei due colori.
 *
 * È una ricerca esaustiva sulle mosse forzanti, non una stima: o esiste una
 * sequenza che guadagna, o non esiste. Ciò che questa definizione **non**
 * copre lo dichiara l'app: un piano lento che vince un pedone in sei mosse non
 * è una tattica, e per questo livello non conta.
 *
 * Le posizioni si prendono dalla fine delle soluzioni del corpus: sono
 * posizioni di partite vere (CC0, Lichess), e sono quelle in cui una tattica
 * è appena stata giocata — cioè, in genere, quelle in cui non ce n'è un'altra.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const { PUZZLES } = await import('../assets/js/puzzles.js');
const { fromFen, fen, legalMoves, applyMove, inCheck, playUci, other, colorOf } = await import('../assets/js/chess.js');
const { valoreDi } = await import('../assets/js/see.js');
const { guadagnoForzante, SOGLIA, PROFONDITA } = await import('../assets/js/forzante.js');

/*
 * Il conto delle sequenze forzanti sta in `forzante.js`: lo usa anche
 * `trappole-mosse.mjs` per dire quali mosse perdono, ed e' la stessa domanda
 * vista dalle due parti. Due copie che divergessero darebbero due verita'
 * diverse nella stessa app.
 */

/** Squilibrio massimo tollerato: una posizione gia' decisa non e' una decisione. */
const SQUILIBRIO = 3;

function materiale(board, colore) {
  let somma = 0;
  for (const pezzo of board) {
    if (!pezzo || colorOf(pezzo) !== colore) continue;
    somma += valoreDi(pezzo);
  }
  return somma;
}

function quieta(stato) {
  if (inCheck(stato, stato.turn)) return false;
  if (guadagnoForzante(stato, PROFONDITA) >= SOGLIA) return false;
  /* E nemmeno l'avversario deve avere una tattica pronta appena tocca a lui. */
  const passa = { ...stato, turn: other(stato.turn) };
  if (inCheck(passa, passa.turn)) return false;
  return guadagnoForzante(passa, PROFONDITA - 1) < SOGLIA;
}

/* ------------------------------- il giro --------------------------------- */

const out = [];
let esaminate = 0;
let scartate = { squilibrio: 0, tattica: 0, pochiPezzi: 0, illegale: 0 };

for (const p of PUZZLES) {
  const partenza = fromFen(p.f);
  if (!partenza) { scartate.illegale += 1; continue; }
  const linea = playUci(p.m.split(' '), partenza);
  if (!linea || !linea.states || !linea.states.length) { scartate.illegale += 1; continue; }
  const finale = linea.states[linea.states.length - 1];
  esaminate += 1;

  const pezzi = finale.board.filter(Boolean).length;
  if (pezzi < 10) { scartate.pochiPezzi += 1; continue; }

  const diff = materiale(finale.board, 'w') - materiale(finale.board, 'b');
  if (Math.abs(diff) > SQUILIBRIO) { scartate.squilibrio += 1; continue; }

  if (!quieta(finale)) { scartate.tattica += 1; continue; }

  out.push({ id: `q${p.id}`, f: fen(finale), da: p.id, r: p.r });
}

/* Ordine deterministico: il file rigenerato domani deve essere identico. */
out.sort((a, b) => (a.r - b.r) || (a.id < b.id ? -1 : 1));

const testo = `/*
 * quiete.js — GENERATO: non modificare a mano.
 *
 *   node tools/build-quiete.mjs
 *
 * ${out.length} posizioni in cui **non c'è niente da trovare**, ricavate dalla
 * fine delle soluzioni del corpus di Lichess (CC0) e verificate una per una:
 * nessuna sequenza di catture e scacchi entro ${PROFONDITA} semimosse guadagna
 * ${SOGLIA} pedoni, per nessuno dei due colori, e il materiale è pari entro
 * ${SQUILIBRIO} pedoni.
 *
 * Quello che questa verifica non copre, e che l'app dice: un piano lento che
 * vince un pedone in sei mosse non è una tattica, e qui non conta.
 *
 *   id  identificativo (q + quello della posizione da cui viene)
 *   f   FEN
 *   da  il puzzle di Lichess da cui deriva la partita
 *   r   punteggio del puzzle d'origine, come indicazione di fascia
 */

export const QUIETE = [
${out.map((q) => `  { id: '${q.id}', f: '${q.f}', da: '${q.da}', r: ${q.r} },`).join('\n')}
];

export const byId = (id) => QUIETE.find((q) => q.id === id) || null;
`;

writeFileSync(join(qui, '..', 'assets', 'js', 'quiete.js'), testo);

console.log(`Posizioni finali esaminate: ${esaminate}`);
console.log(`  scartate perché squilibrate (> ${SQUILIBRIO} pedoni): ${scartate.squilibrio}`);
console.log(`  scartate perché avevano ancora una tattica: ${scartate.tattica}`);
console.log(`  scartate perché troppo spoglie (< 10 pezzi): ${scartate.pochiPezzi}`);
console.log(`  linee non rigiocabili: ${scartate.illegale}`);
console.log(`Quiete tenute: ${out.length}`);
