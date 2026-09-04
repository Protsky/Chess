/*
 * ricostruzione.js — la posizione per cinque secondi, poi rimettila tu.
 *
 * È l'esperimento con cui è cominciata tutta la psicologia degli scacchi
 * (Chase & Simon 1973), ed è anche il motivo per cui vale la pena averlo in
 * un'app: nei principianti l'accuratezza nel ricostruire una posizione vera
 * vista per cinque secondi correla con la forza (rho ≈ 0,5), e cresce con lo
 * studio. È la misura più diretta che esista dell'unica cosa che il livello 0
 * dice di allenare — che la scacchiera si veda a pezzi interi invece che a
 * pezzi singoli.
 *
 * La parte che rende il numero onesto è il **confronto**: accanto alle
 * posizioni vere si mescolano posizioni con gli stessi pezzi messi a caso.
 * Sulle casuali nessuno migliora, perché non ci sono configurazioni da
 * riconoscere; il vantaggio sulle vere è la parte che l'esperienza costruisce.
 * Un punteggio da solo non direbbe niente: due punteggi sì.
 */

import { fromFen, fen as fenDi, nameOf, colorOf } from './chess.js';
import { PUZZLES } from './puzzles.js';

export const AXIS = 'ricostruzione';
export const PREFIX = 'r:';

/** Quanto resta visibile la posizione. Cinque secondi, come nell'esperimento. */
export const SECONDI = 5;

/** Posizioni con questo numero di pezzi: sotto è banale, sopra è memoria pura. */
export const PEZZI = { min: 8, max: 20 };

export const SESSION_SIZE = 6;

/**
 * Le posizioni vere: si prendono dal corpus, che viene da partite giocate.
 * Deterministico, così una prova si può rifare identica.
 */
export function reali(pool = PUZZLES, { min = PEZZI.min, max = PEZZI.max } = {}) {
  return pool.filter((p) => {
    const pezzi = p.f.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
    return pezzi >= min && pezzi <= max;
  });
}

/**
 * La stessa posizione con gli stessi pezzi, ma sistemati a caso: il controllo.
 *
 * I due re non si toccano (una posizione dove sono adiacenti non è una
 * posizione di scacchi e si vedrebbe subito), e i pedoni non finiscono sulla
 * prima o sull'ultima traversa. Per il resto è disordine, ed è voluto.
 */
export function rimescola(fenTesto, seed = 1) {
  const stato = fromFen(fenTesto);
  const pezzi = [];
  for (let i = 0; i < 64; i++) if (stato.board[i]) pezzi.push(stato.board[i]);

  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };

  for (let tentativo = 0; tentativo < 200; tentativo++) {
    const board = new Array(64).fill(null);
    const libere = [...Array(64).keys()];
    for (let i = libere.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [libere[i], libere[j]] = [libere[j], libere[i]];
    }
    let ok = true;
    const re = {};
    for (const pezzo of pezzi) {
      const tipo = pezzo.toUpperCase();
      const idx = libere.findIndex((casa) => {
        if (board[casa]) return false;
        const riga = casa >> 3;
        if (tipo === 'P' && (riga === 0 || riga === 7)) return false;
        return true;
      });
      if (idx === -1) { ok = false; break; }
      const casa = libere.splice(idx, 1)[0];
      board[casa] = pezzo;
      if (tipo === 'K') re[colorOf(pezzo)] = casa;
    }
    if (!ok || re.w === undefined || re.b === undefined) continue;
    const dr = Math.abs((re.w >> 3) - (re.b >> 3));
    const dc = Math.abs((re.w & 7) - (re.b & 7));
    if (dr <= 1 && dc <= 1) continue;
    return fenDi({ ...stato, board, ep: null, castling: { K: false, Q: false, k: false, q: false } });
  }
  return fenTesto;
}

/** Una sessione: metà posizioni vere, metà casuali, mescolate. */
export function costruisci({ pool = PUZZLES, size = SESSION_SIZE, seed = 1 } = {}) {
  const disponibili = reali(pool);
  const items = [];
  for (let i = 0; i < size; i++) {
    const scelta = disponibili[(seed * 2654435761 + i * 40503) % disponibili.length];
    const vera = i % 2 === 0;
    items.push({
      id: `${PREFIX}${vera ? 'v' : 'c'}:${scelta.id}`,
      fen: vera ? scelta.f : rimescola(scelta.f, seed + i),
      vera,
      secondi: SECONDI,
    });
  }
  return items;
}

/**
 * Il punteggio: quanti pezzi sono finiti sulla casa giusta. Non una
 * percentuale di somiglianza — i pezzi al posto giusto si contano, e basta.
 */
export function punteggio(fenVero, fenRicostruito) {
  const vero = fromFen(fenVero).board;
  const mio = fromFen(fenRicostruito).board;
  let giusti = 0;
  let totali = 0;
  const mancanti = [];
  for (let i = 0; i < 64; i++) {
    if (vero[i]) {
      totali += 1;
      if (mio[i] === vero[i]) giusti += 1;
      else mancanti.push({ casa: nameOf(i), pezzo: vero[i] });
    }
  }
  const intrusi = [];
  for (let i = 0; i < 64; i++) if (mio[i] && mio[i] !== vero[i]) intrusi.push({ casa: nameOf(i), pezzo: mio[i] });
  return { giusti, totali, mancanti, intrusi, quota: totali ? giusti / totali : 0 };
}

/**
 * Il confronto vere/casuali sul registro. Si dichiara solo quando ci sono
 * abbastanza prove di entrambi i tipi: sotto, il divario è rumore.
 */
export const MIN_PER_TIPO = 5;

export function divario(log) {
  const vere = log.filter((e) => e.axis === AXIS && e.vera);
  const casuali = log.filter((e) => e.axis === AXIS && e.vera === false);
  if (vere.length < MIN_PER_TIPO || casuali.length < MIN_PER_TIPO) {
    return { pronto: false, vere: vere.length, casuali: casuali.length };
  }
  const media = (xs) => xs.reduce((s, e) => s + (e.quota ?? 0), 0) / xs.length;
  const v = media(vere);
  const c = media(casuali);
  return { pronto: true, vere: v, casuali: c, divario: v - c, n: { vere: vere.length, casuali: casuali.length } };
}
