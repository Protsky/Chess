/*
 * trappola.js — le posizioni in cui cade chi gioca come te.
 *
 * Che cosa rende questo esercizio diverso da un puzzle: qui non c'è niente da
 * *trovare*. C'è qualcosa da **non fare**. La domanda è «gioca una mossa che non
 * perde materiale», e le posizioni scelte sono quelle in cui i giocatori della
 * tua fascia una mossa che perde la giocano spesso — mentre più in alto no.
 *
 * I due numeri che stanno dietro vengono da posti diversi, e l'app non li
 * confonde mai:
 *
 *   - **quali mosse perdono** lo dice il motore di casa (`forzante.js`), con
 *     una ricerca esaustiva sulle mosse forzanti. È un fatto, e lo stesso conto
 *     giudica la mossa che giochi;
 *   - **quanto spesso vengono giocate** lo dice Maia-2, una rete addestrata su
 *     partite umane vere e condizionata sul rating di chi muove. È una
 *     previsione di comportamento, non una misura, e va detto.
 *
 * Il limite, che l'app scrive invece di nasconderlo: sopra i 1500 le trappole
 * si esauriscono. Non perché i forti non sbaglino, ma perché a quel punto Maia
 * distingue sempre meno fra una fascia e quella sopra, e senza divario non c'è
 * niente da chiamare «del tuo livello». Quando finiscono, si dice.
 */

import { TRAPPOLE, FASCE, SOGLIA_ALTA, SALTO, byId as trappolaById } from './trappole.js';
import { puzzleById, THEMES } from './puzzles.js';
import { byId as quietaById } from './quiete.js';
import { fromFen, playUci } from './chess.js';

export const AXIS = 'trappole';
export const PREFIX = 'x:';

export const SESSION_SIZE = 8;

export const cardIdOf = (id) => PREFIX + id;

/** La fascia di Maia più vicina al tuo punteggio: sotto la prima, la prima. */
export function fasciaDi(rating) {
  let scelta = FASCE[0];
  let minimo = Infinity;
  for (const f of FASCE) {
    const d = Math.abs(f - rating);
    if (d < minimo) { minimo = d; scelta = f; }
  }
  return scelta;
}

export const indiceDi = (fascia) => FASCE.indexOf(fascia);

/**
 * È una trappola per questa fascia?
 *
 * Due condizioni, e servono tutte e due: l'errore dev'essere frequente lì, e
 * dev'essere meno frequente in cima. Una posizione dove sbagliano tutti allo
 * stesso modo non è una trappola del tuo livello, è solo una posizione
 * difficile — e chiamarla trappola sarebbe una bugia comoda.
 */
export function eTrappola(riga, fascia) {
  const i = indiceDi(fascia);
  if (i < 0 || i >= FASCE.length - 1) return false;      // l'ultima fascia è il metro
  const alto = riga.e[riga.e.length - 1];
  return riga.e[i] >= SOGLIA_ALTA && riga.e[i] - alto >= SALTO;
}

/** Tutte le trappole di una fascia, dalla più insidiosa in giù. */
export function perFascia(fascia, { pool = TRAPPOLE } = {}) {
  const i = indiceDi(fascia);
  return pool
    .filter((t) => eTrappola(t, fascia))
    .sort((a, b) => (b.e[i] - b.e[b.e.length - 1]) - (a.e[i] - a.e[a.e.length - 1]));
}

/** Quante ce ne sono per ogni fascia: serve a dire la verità quando finiscono. */
export function disponibili() {
  return FASCE.slice(0, -1).map((f) => ({ fascia: f, quante: perFascia(f).length }));
}

/**
 * La posizione vera di una riga: dal puzzle si prende quella **dopo** la mossa
 * dell'avversario (è quella che si vede), dalla quieta la FEN così com'è.
 */
export function posizioneDi(riga) {
  const quieta = quietaById(riga.id);
  if (quieta) return { fen: quieta.f, tema: 'quieta', fonte: 'quieta' };

  const puzzle = puzzleById(riga.id);
  if (!puzzle) return null;
  const start = fromFen(puzzle.f);
  if (!start) return null;
  const linea = playUci([puzzle.m.split(' ')[0]], start);
  if (!linea || !linea.states[1]) return null;
  return {
    fen: null,
    stato: linea.states[1],
    ultima: linea.moves[0],
    tema: THEMES[puzzle.t] || puzzle.t,
    fonte: 'puzzle',
    puzzle,
  };
}

/**
 * La sessione: prima le carte scadute, poi le trappole nuove più insidiose.
 *
 * Non si pesca a caso fra tutte: si parte da quelle dove il divario con la
 * fascia alta è più largo, perché sono quelle in cui c'è più da guadagnare.
 */
export function costruisci({ rating = 1100, due = [], viste = new Set(), size = SESSION_SIZE } = {}) {
  const fascia = fasciaDi(rating);
  const tutte = perFascia(fascia);
  const items = [];

  for (const card of due) {
    const riga = trappolaById(String(card.id).slice(PREFIX.length));
    if (riga && eTrappola(riga, fascia)) items.push({ riga, card, fresh: false, fascia });
    if (items.length >= size) break;
  }

  for (const riga of tutte) {
    if (items.length >= size) break;
    if (viste.has(cardIdOf(riga.id))) continue;
    items.push({ riga, card: null, fresh: true, fascia });
  }

  return { fascia, items, totale: tutte.length, finite: items.length < size };
}

/**
 * Il numero da mostrare dopo la risposta, con la sua provenienza attaccata.
 * Mai un numero nudo: chi lo legge deve sapere che è una previsione.
 */
export function numeri(riga, fascia) {
  const i = indiceDi(fascia);
  const alto = FASCE[FASCE.length - 1];
  return {
    fascia,
    tuo: riga.e[i],
    alto: riga.e[riga.e.length - 1],
    fasciaAlta: alto,
    divario: riga.e[i] - riga.e[riga.e.length - 1],
  };
}
