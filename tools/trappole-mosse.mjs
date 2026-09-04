/*
 * trappole-mosse.mjs — primo dei due passi che costruiscono le trappole.
 *
 *   node tools/trappole-mosse.mjs
 *
 * Qui si risponde a una domanda che il motore di casa sa risolvere da solo:
 * **in questa posizione, quali mosse perdono materiale?** Il criterio è quello
 * di `forzante.js`, lo stesso che dichiara quiete le posizioni senza tattica.
 *
 * Il secondo passo (`trappole-maia.py`) chiede a Maia-2 quanto spesso un umano
 * di una certa fascia gioca proprio quelle mosse. Le due cose stanno separate
 * di proposito: la prima è un fatto di scacchi e si verifica sul motore, la
 * seconda è una previsione di comportamento umano e viene da un modello. Non
 * vanno mescolate, e nemmeno confuse quando poi si scrive il numero nell'app.
 *
 * Le posizioni sono quelle che chi studia vede davvero:
 *   - dei puzzle, la posizione **dopo** la mossa dell'avversario;
 *   - delle quiete, la posizione così com'è.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const qui = dirname(fileURLToPath(import.meta.url));
const { PUZZLES } = await import('../assets/js/puzzles.js');
const { QUIETE } = await import('../assets/js/quiete.js');
const { fromFen, fen, playUci, legalMoves, nameOf } = await import('../assets/js/chess.js');
const { mossePerdenti } = await import('../assets/js/forzante.js');

const uci = (m) => nameOf(m.from) + nameOf(m.to) + (m.promo ? m.promo.toLowerCase() : '');

const out = [];
let saltate = 0;

function aggiungi(id, stato, extra) {
  const legali = legalMoves(stato);
  /*
   * Con due o tre mosse legali non esiste una trappola: non c'è niente da
   * scegliere, e la probabilità d'errore misurerebbe solo la costrizione.
   */
  if (legali.length < 6) { saltate += 1; return; }

  const perdenti = mossePerdenti(stato).map(uci);
  /* Nemmeno dove non si può sbagliare, ovviamente. */
  if (!perdenti.length) { saltate += 1; return; }

  out.push({
    id,
    f: fen(stato),
    legali: legali.length,
    perdenti,
    ...extra,
  });
}

for (const p of PUZZLES) {
  const start = fromFen(p.f);
  if (!start) { saltate += 1; continue; }
  const linea = playUci([p.m.split(' ')[0]], start);
  if (!linea || !linea.states[1]) { saltate += 1; continue; }
  aggiungi(p.id, linea.states[1], { r: p.r, t: p.t, fonte: 'puzzle' });
}

for (const q of QUIETE) {
  const stato = fromFen(q.f);
  if (!stato) { saltate += 1; continue; }
  aggiungi(q.id, stato, { r: q.r, t: 'quieta', fonte: 'quieta' });
}

writeFileSync(join(qui, 'trappole-mosse.json'), JSON.stringify(out));

const mediaPerdenti = out.reduce((s, x) => s + x.perdenti.length, 0) / out.length;
const mediaLegali = out.reduce((s, x) => s + x.legali, 0) / out.length;
console.log(`Posizioni con almeno una mossa perdente: ${out.length}`);
console.log(`  scartate (poche mosse legali, o nessuna mossa perdente): ${saltate}`);
console.log(`  in media ${mediaPerdenti.toFixed(1)} mosse perdenti su ${mediaLegali.toFixed(1)} legali`);
console.log('\nScritto tools/trappole-mosse.json. Adesso:');
console.log('  venv-maia/Scripts/python tools/trappole-maia.py');
