/*
 * endgames.js — il livello 2, con la tavola dei finali in tasca.
 *
 * È l'unico posto del gioco dove la correzione non è un'opinione: con tre pezzi
 * il risultato con gioco perfetto si conosce per intero, quindi l'app può dire
 * «questa mossa butta via la vittoria» e avere ragione — non «questa non è la
 * mossa che preferirei».
 *
 * Da qui discendono tre scelte:
 *
 *  - **Si corregge per esito.** Qualunque mossa che mantiene il matto forzato è
 *    accettata, anche se non è la più rapida. Chi studia deve imparare la
 *    tecnica, non indovinare la variante scritta da qualcuno.
 *  - **La difesa è la migliore possibile.** Il Nero sceglie la mossa che allunga
 *    di più il matto: allenarsi contro una difesa sciocca insegna a vincere
 *    contro una difesa sciocca.
 *  - **Il finale si porta a casa davvero.** Non basta la prima mossa: si gioca
 *    fino al matto, che è la parte che di solito non si sa fare.
 *
 * La tavola arriva da `endgames-data.js`, generata con analisi retrograda da
 * `tools/build-endgames.mjs`. Qui dentro c'è solo la metà «Nero al tratto»: il
 * valore con il Bianco al tratto è il minimo dei valori dopo le sue mosse, più
 * uno, e si calcola al volo.
 */

import { TAVOLE, TRIANGOLO, PARTENZE, ILLEGALE, NON_VINTA } from './endgames-data.js';
import { fromFen, nameOf, legalMoves, applyMove, inCheck, FILES } from './chess.js';

export const AXIS = 'finali';
export const PREFIX = 'f:';
export { ILLEGALE, NON_VINTA };

/** Quanti finali in una sessione, e quanti se ne portano a casa per uscire. */
export const SESSION_SIZE = 3;
export const USCITA = { puliti: 6 };
export const START = 500;

/** Mosse massime concesse: oltre, non è più tecnica, è girare in tondo. */
export const MOSSE_MAX = 40;

const riga = (s) => s >> 3;
const col = (s) => s & 7;
const casa = (r, c) => r * 8 + c;

/* --------------------------- lettura della tavola ------------------------ */

const CORSA = 253;

function decomprimi(base64) {
  const binario = atob(base64);
  const out = new Uint8Array(10 * 64 * 64);
  let scritti = 0;
  for (let i = 0; i < binario.length;) {
    const b = binario.charCodeAt(i);
    if (b === CORSA) {
      const valore = binario.charCodeAt(i + 1);
      const n = binario.charCodeAt(i + 2) | (binario.charCodeAt(i + 3) << 8);
      out.fill(valore, scritti, scritti + n);
      scritti += n;
      i += 4;
    } else {
      out[scritti++] = b;
      i += 1;
    }
  }
  return out;
}

const tavole = {};
function tavola(tipo) {
  if (!tavole[tipo]) tavole[tipo] = decomprimi(TAVOLE[tipo]);
  return tavole[tipo];
}

/* ------------------------------- simmetrie ------------------------------- */

/** Le stesse otto della generazione: se divergono, la tavola dice il falso. */
const TRASFORMA = [
  (s) => s,
  (s) => casa(riga(s), 7 - col(s)),
  (s) => casa(7 - riga(s), col(s)),
  (s) => casa(7 - riga(s), 7 - col(s)),
  (s) => casa(col(s), riga(s)),
  (s) => casa(col(s), 7 - riga(s)),
  (s) => casa(7 - col(s), riga(s)),
  (s) => casa(7 - col(s), 7 - riga(s)),
];

const POSTO = (() => {
  const out = new Int8Array(64).fill(-1);
  TRIANGOLO.forEach((s, i) => { out[s] = i; });
  return out;
})();

export function canonica(wk, pezzo, bk) {
  let best = null;
  for (const f of TRASFORMA) {
    const a = f(wk);
    if (POSTO[a] < 0) continue;
    const b = f(pezzo);
    const c = f(bk);
    if (!best || a < best[0] || (a === best[0] && (b < best[1] || (b === best[1] && c < best[2])))) best = [a, b, c];
  }
  return best;
}

/**
 * Semimosse al matto con il **Nero al tratto**, o NON_VINTA / ILLEGALE.
 * È l'unico valore che arriva dalla tavola: tutto il resto si deriva da qui.
 */
export function valoreNero(tipo, wk, pezzo, bk) {
  const c = canonica(wk, pezzo, bk);
  if (!c) return ILLEGALE;
  return tavola(tipo)[(POSTO[c[0]] * 64 + c[1]) * 64 + c[2]];
}

/* --------------------------- posizioni e mosse --------------------------- */

/** Le tre case di una posizione, lette dalla scacchiera dell'app. */
export function pezziDi(state) {
  let wk = -1;
  let bk = -1;
  let pezzo = -1;
  let tipo = null;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    if (p === 'K') wk = i;
    else if (p === 'k') bk = i;
    else { pezzo = i; tipo = p.toUpperCase(); }
  }
  return { wk, bk, pezzo, tipo };
}

/**
 * Valore con il **Bianco al tratto**: il minimo dopo le sue mosse, più uno.
 * Se una mossa perde il pezzo o porta in una posizione non vinta, quella mossa
 * semplicemente non conta: conta la migliore.
 */
export function valoreBianco(state) {
  const mosse = legalMoves(state);
  let migliore = NON_VINTA;
  for (const m of mosse) {
    const dopo = applyMove(state, m);
    const v = valoreDopo(dopo);
    if (v === NON_VINTA || v === ILLEGALE) continue;
    if (migliore === NON_VINTA || v < migliore) migliore = v;
  }
  return migliore === NON_VINTA ? NON_VINTA : migliore + 1;
}

/** Valore di una posizione col Nero al tratto, letto dai pezzi che ci sono. */
export function valoreDopo(state) {
  const { wk, bk, pezzo, tipo } = pezziDi(state);
  if (pezzo < 0 || !TAVOLE[tipo]) return NON_VINTA;      // pezzo catturato: patta
  if (state.turn !== 'b') return NON_VINTA;
  return valoreNero(tipo, wk, pezzo, bk);
}

/** Matto? Con tre pezzi si controlla come sempre: sotto scacco e senza mosse. */
export function isMatto(state) {
  return inCheck(state) && legalMoves(state).length === 0;
}

export function isStallo(state) {
  return !inCheck(state) && legalMoves(state).length === 0;
}

/**
 * La difesa: il Nero sceglie la mossa che allunga di più il matto, e se può
 * pattare (catturando il pezzo o per stallo) la sceglie — è il suo mestiere.
 */
export function difesa(state) {
  const mosse = legalMoves(state);
  let scelta = null;
  let migliore = -1;
  for (const m of mosse) {
    const dopo = applyMove(state, m);
    const v = valoreBianco(dopo);
    if (v === NON_VINTA) return m;                       // patta: il Nero la prende
    if (v > migliore) { migliore = v; scelta = m; }
  }
  return scelta || mosse[0] || null;
}

/* ------------------------------ le posizioni ----------------------------- */

const FEN = (wk, pezzo, tipo, bk, turno) => {
  const board = new Array(64).fill(null);
  board[wk] = 'K';
  board[pezzo] = tipo;
  board[bk] = 'k';
  const righe = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    for (let c = 0; c < 8; c++) s += board[casa(r, c)] || '1';
    righe.push(s.replace(/1{2,}/g, (m) => String(m.length)));
  }
  return `${righe.join('/')} ${turno} - - 0 1`;
};

/**
 * Le posizioni di partenza arrivano dalla generazione, non da una scansione a
 * runtime: là la tavola intera c'è ancora, quindi il valore col Bianco al
 * tratto è una lettura e non un giro di mosse. Qui si filtra e basta.
 */
export function partenze(tipo, { limite = 40 } = {}) {
  return PARTENZE
    .filter((p) => p.tipo === tipo)
    .slice(0, limite)
    .map((p) => ({
      ...p,
      id: PREFIX + p.tipo + ':' + p.fen.split(' ')[0],
      difficulty: 500 + p.dtm * 8,
    }));
}

/** Le due tecniche che la tavola copre davvero. */
export const TECNICHE = [
  { tipo: 'Q', nome: 'Re e Donna', linea: 'Il matto più semplice: la Donna toglie case, il Re dà il colpo.' },
  { tipo: 'R', nome: 'Re e Torre', linea: 'Il matto che si sbaglia più spesso: serve il Re, non solo la Torre.' },
];

/** Una sessione: un finale per tecnica, a rotazione deterministica. */
export function buildQueue({ known = new Set(), giro = 0, size = SESSION_SIZE } = {}) {
  const out = [];
  for (let i = 0; i < size; i++) {
    const tecnica = TECNICHE[(giro + i) % TECNICHE.length];
    const pool = partenze(tecnica.tipo);
    const nuova = pool.find((p) => !known.has(p.id) && !out.some((x) => x.id === p.id));
    const scelta = nuova || pool[(giro + i) % pool.length];
    if (scelta) out.push({ ...scelta, nome: tecnica.nome });
  }
  return out;
}

export const nomeCasa = nameOf;
export const colonna = (s) => FILES[col(s)];
