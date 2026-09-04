/*
 * stima.js — un punteggio con un'incertezza attaccata.
 *
 * Il punteggio alla Elo di `rating.js` serve a scegliere il materiale: si muove
 * a ogni risposta, ed è giusto così. Ma per **decidere se un livello è
 * superato** non basta un numero che oscilla: con ventiquattro risposte
 * l'intervallo attorno alla stima è largo un centinaio di punti, e "1400"
 * raggiunto per fortuna in una sessione buona non è 1400.
 *
 * Qui la forza si stima invece per massima verosimiglianza sulle risposte date
 * a item di difficoltà nota (il modello è quello di Rasch, che ha la stessa
 * forma dell'Elo — Pelánek 2016), e l'incertezza esce dall'informazione di
 * Fisher. Il criterio d'uscita guarda **il limite inferiore** dell'intervallo:
 * si passa quando è improbabile di essere sotto la soglia, non quando la stima
 * migliore ci arriva.
 *
 * Le due code hanno una risposta onesta: chi le risolve tutte non ha un
 * punteggio, ha un limite inferiore ("almeno tanto"), e lo si scrive così.
 */

/** Da punti Elo a logit e ritorno: 400 punti = un fattore 10 di probabilità. */
const SCALA = 400 / Math.LN10;

export const probabilita = (theta, difficolta) => 1 / (1 + Math.exp((difficolta - theta) / SCALA));

/** Con meno di questo non si dichiara niente: si dice che i dati non bastano. */
export const MIN_RISPOSTE = 12;

/** 95%: il valore che moltiplica l'errore standard. */
const Z = 1.96;

/*
 * Fuori da questa finestra la verosimiglianza è piatta e la stima non significa
 * più niente: si dichiara saturata invece di stampare un numero inventato.
 */
const MIN = 300;
const MAX = 2800;

/**
 * Stima la forza dalle risposte date.
 *
 *   risposte: [{ d: difficoltà dell'item, ok: true/false }]
 *
 * Torna { rating, lo, hi, se, n, giuste, saturo }.
 * `saturo` vale 'alto' se le ha prese tutte, 'basso' se nessuna: in quei due
 * casi `rating` è il bordo della finestra e va letto come "almeno"/"al più".
 */
export function stima(risposte) {
  const dati = risposte.filter((r) => Number.isFinite(r.d));
  const n = dati.length;
  const giuste = dati.filter((r) => r.ok).length;

  if (!n) return { rating: null, lo: null, hi: null, se: null, n: 0, giuste: 0, saturo: null };
  if (giuste === n) return bordo(dati, MAX, 'alto');
  if (giuste === 0) return bordo(dati, MIN, 'basso');

  /*
   * La derivata della log-verosimiglianza è proporzionale a (giuste − attese),
   * che cresce con theta: una bisezione la azzera senza derivate seconde né
   * casi patologici.
   */
  let lo = MIN;
  let hi = MAX;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const attese = dati.reduce((s, r) => s + probabilita(mid, r.d), 0);
    if (attese < giuste) lo = mid; else hi = mid;
  }
  const rating = (lo + hi) / 2;
  const se = errore(dati, rating);

  return {
    rating: Math.round(rating),
    lo: Math.round(rating - Z * se),
    hi: Math.round(rating + Z * se),
    se: Math.round(se),
    n,
    giuste,
    saturo: null,
  };
}

/** Errore standard dall'informazione di Fisher, riportato in punti. */
function errore(dati, theta) {
  const info = dati.reduce((s, r) => {
    const p = probabilita(theta, r.d);
    return s + p * (1 - p);
  }, 0);
  return info > 0 ? SCALA / Math.sqrt(info) : Infinity;
}

function bordo(dati, valore, saturo) {
  /*
   * Tutte giuste (o tutte sbagliate): la verosimiglianza non ha massimo interno.
   * Si riporta il bordo dell'intervallo esatto — la forza alla quale un
   * risultato così sarebbe già improbabile (5%) — così il limite che si mostra
   * è comunque una conseguenza dei dati e non un numero di comodo.
   *
   * Ventiquattro posizioni da 1700 risolte tutte non vogliono dire «vali 1700»:
   * vogliono dire che a 2050 un risultato del genere avrebbe ancora il 5% di
   * probabilità, e sotto sarebbe più raro di così. Il limite va quindi **sopra**
   * la difficoltà media, non sotto — nella prima versione il segno era rovesciato
   * e un esame perfetto non superava la propria soglia.
   */
  const media = dati.reduce((s, r) => s + r.d, 0) / dati.length;
  const spinta = -SCALA * Math.log(Math.pow(0.05, -1 / dati.length) - 1);
  const stimato = saturo === 'alto' ? media + spinta : media - spinta;
  const clamp = Math.max(MIN, Math.min(MAX, Math.round(stimato)));
  return {
    rating: clamp,
    lo: saturo === 'alto' ? clamp : MIN,
    hi: saturo === 'alto' ? MAX : clamp,
    se: null,
    n: dati.length,
    giuste: saturo === 'alto' ? dati.length : 0,
    saturo,
  };
}

/**
 * Il criterio d'uscita: **il limite inferiore** supera la soglia. Serve anche
 * un numero minimo di risposte, altrimenti un intervallo larghissimo con una
 * stima altissima passerebbe per caso.
 */
export function superaSoglia(s, soglia) {
  if (!s || s.n < MIN_RISPOSTE || s.lo === null) return false;
  return s.lo >= soglia;
}

/** Quanto manca, in percentuale, detto sul limite inferiore e non sulla stima. */
export function avanzamento(s, da, a) {
  if (!s || s.lo === null) return 0;
  return Math.max(0, Math.min(100, Math.round(((s.lo - da) / (a - da)) * 100)));
}

/** Come si scrive un intervallo saturato senza mentire. */
export function testo(s) {
  if (!s || !s.n) return 'nessuna risposta';
  if (s.saturo === 'alto') return `almeno ${s.rating} (${s.giuste} su ${s.n}, nessun errore)`;
  if (s.saturo === 'basso') return `sotto ${s.rating} (nessuna giusta su ${s.n})`;
  return `${s.rating} (fra ${s.lo} e ${s.hi}, su ${s.n} risposte)`;
}
