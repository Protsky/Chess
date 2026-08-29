/*
 * tactics.js — la coda delle posizioni tattiche e il voto di ogni risposta.
 *
 * Sta separato dall'interfaccia di proposito: qui non si tocca il DOM, così
 * `tools/validate-percorso.mjs` può far girare una sessione intera in node e
 * controllare che la coda sia quella promessa.
 *
 * Tre regole, e sono tutte scelte, non dettagli:
 *
 *  1. **Prima le scadenze.** Le carte scadute vengono prima del materiale nuovo.
 *     Il ripasso è ciò che tiene in piedi quello che si sa; il nuovo è ciò che
 *     lo allarga. Invertirli è il modo più veloce per accumulare roba dimenticata.
 *
 *  2. **I motivi si mescolano.** Due posizioni con lo stesso motivo non si
 *     toccano mai, se c'è modo di evitarlo. Studiare a blocchi dà la sensazione
 *     di imparare di più e produce meno (Kornell & Bjork 2008): in partita
 *     nessuno annuncia che c'è un'inchiodatura, e riconoscerlo è il passo
 *     difficile che il blocco toglie.
 *
 *  3. **Il tema non si mostra prima.** Si scopre dopo aver risposto. Dirlo prima
 *     è dare la risposta.
 */

import { PUZZLES, puzzleById, THEMES } from './puzzles.js';
import * as Rating from './rating.js';
import { AGAIN, HARD, GOOD, EASY } from './fsrs.js';

export const AXIS = 'tattica';
export const PREFIX = 't:';

export const cardIdOf = (puzzle) => PREFIX + puzzle.id;
export const puzzleOfCard = (card) => puzzleById(String(card.id).slice(PREFIX.length));

/** Quante posizioni in una sessione, e quanta parte al massimo può essere nuova. */
export const SESSION_SIZE = 12;
export const MAX_NEW = 8;

/**
 * Costruisce la coda della sessione.
 *
 *   due:     carte scadute (da Store.dueCards)
 *   known:   identificativi delle carte già esistenti (nuove ≠ già viste)
 *   rating:  forza attuale, per scegliere la difficoltà del materiale nuovo
 */
export function buildQueue({ due = [], known = new Set(), rating = Rating.START_RATING,
  size = SESSION_SIZE, maxNew = MAX_NEW, pool = PUZZLES } = {}) {
  const items = [];

  for (const card of due) {
    const puzzle = puzzleOfCard(card);
    if (puzzle) items.push({ puzzle, card, fresh: false });
    if (items.length >= size) break;
  }

  const room = Math.min(maxNew, size - items.length);
  if (room > 0) {
    const unseen = pool.filter((p) => !known.has(cardIdOf(p)));
    for (const puzzle of Rating.pickByDifficulty(unseen, rating, room)) {
      items.push({ puzzle, card: null, fresh: true });
    }
  }

  return interleave(items);
}

/**
 * Rimescola in modo che due motivi uguali non si tocchino, tenendo l'ordine
 * originale quando non serve intervenire (le scadenze restano davanti).
 */
export function interleave(items) {
  const rest = items.slice();
  const out = [];
  let last = null;
  while (rest.length) {
    let i = rest.findIndex((x) => x.puzzle.t !== last);
    if (i === -1) i = 0;                       // resta un solo motivo: pazienza
    const [next] = rest.splice(i, 1);
    out.push(next);
    last = next.puzzle.t;
  }
  return out;
}

/** Semimosse che deve trovare chi risolve: le dispari della soluzione. */
export function userPlyCount(puzzle) {
  return puzzle.m.split(' ').length / 2;
}

/**
 * Quanto è "veloce" una risposta per questa posizione: non un numero fisso,
 * ma il tempo che serve a chi la sta risolvendo davvero, mossa per mossa.
 */
export function paceFor(puzzle) {
  const moves = userPlyCount(puzzle);
  return { quick: 5 + 5 * moves, slow: 10 + 10 * moves };
}

/**
 * Il voto per lo scheduler, dedotto dall'esito — mai chiesto a chi studia.
 *
 *   errori 0, veloce      → Facile
 *   errori 0              → Bene
 *   un errore             → Difficile
 *   due errori o svelata  → Di nuovo
 *
 * `correct` è più severo del voto: conta per il punteggio solo la risposta
 * pulita al primo colpo, perché è quella che l'avversario ti concede in partita.
 */
export function gradeOf(puzzle, { errors = 0, revealed = false, seconds = 0 } = {}) {
  const pace = paceFor(puzzle);
  if (revealed || errors >= 2) return { grade: AGAIN, correct: false };
  if (errors === 1) return { grade: HARD, correct: false };
  if (seconds <= pace.quick) return { grade: EASY, correct: true };
  if (seconds >= pace.slow) return { grade: HARD, correct: true };
  return { grade: GOOD, correct: true };
}

/**
 * Una carta sbagliata torna dentro la stessa sessione: FSRS la rimette in coda
 * fra un minuto o dieci, e rimandarla a domani vorrebbe dire chiudere la
 * sessione sull'errore invece che sulla correzione. Al massimo due volte, però:
 * oltre, non è più ripasso, è accanimento su una posizione sola.
 */
export const MAX_REPEATS = 2;

/**
 * E comunque una sessione non cresce all'infinito: chi sbaglia tutto si
 * ritroverebbe con venticinque posizioni invece di dodici, e la sessione
 * diventerebbe una punizione. Oltre il tetto le carte restano scadute e
 * tornano alla prossima — che è il posto giusto per loro.
 */
export const SESSION_CAP = 20;

export function shouldRepeat(card, { repeats = 0, queued = 0, now = Date.now() } = {}) {
  if (repeats >= MAX_REPEATS || queued >= SESSION_CAP) return false;
  return (card.state === 'learning' || card.state === 'relearning') && (card.due || 0) <= now + 20 * 60000;
}

/** Nome italiano del motivo, per quando si può finalmente dire. */
export function themeName(puzzle) {
  return THEMES[puzzle.t] || puzzle.t;
}
