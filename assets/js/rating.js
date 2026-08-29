/*
 * rating.js — la forza di chi gioca e la difficoltà delle posizioni, sulla
 * stessa scala e aggiornate insieme a ogni risposta.
 *
 * L'idea è di Klinkenberg, Straatemeier & van der Maas (2011), "Computer
 * adaptive practice of maths ability using a new item response model for on the
 * fly ability and difficulty estimation": si usa il sistema di Elo come modello
 * a risposta graduata, e si pescano gli item intorno a una probabilità di
 * successo scelta — nel loro caso 0,75.
 *
 * Qui la scala è già in casa: le posizioni arrivano dal database di Lichess con
 * un punteggio Glicko-2 calcolato su milioni di tentativi reali. Quindi il
 * punteggio dell'item si muove pochissimo (K basso: sappiamo già quanto vale),
 * e quello di chi studia si muove tanto all'inizio e sempre meno dopo.
 *
 * Quello che NON si fa, e va detto: il tempo di risposta non entra nel
 * punteggio, mentre nella regola di Klinkenberg ci entra. Qui il tempo decide
 * solo il voto per lo scheduler (veloce e giusta ≠ lenta e giusta), che è una
 * cosa diversa e più modesta.
 */

/** Probabilità di successo a cui si vuole allenare: difficile ma non ostile. */
export const TARGET_SUCCESS = 0.75;

/** Distanza in punti che corrisponde al bersaglio: 400·log10(0,75/0,25) ≈ 191. */
export const TARGET_GAP = Math.round(400 * Math.log10(TARGET_SUCCESS / (1 - TARGET_SUCCESS)));

/** Punteggio di partenza di chi non ha ancora risposto a niente. */
export const START_RATING = 800;

/** Il punteggio dell'item si muove poco: la sua difficoltà è già misurata bene. */
const K_ITEM = 3;

/** Probabilità che chi ha `rating` risolva un item da `difficulty`. */
export function expected(rating, difficulty) {
  return 1 / (1 + Math.pow(10, (difficulty - rating) / 400));
}

/** Passo K di chi studia: grande finché il punteggio è provvisorio. */
export function stepFor(attempts) {
  if (attempts < 15) return 48;
  if (attempts < 60) return 32;
  if (attempts < 200) return 24;
  return 16;
}

/**
 * Aggiorna forza e difficoltà dopo una risposta.
 *
 *   state:   { rating, attempts }
 *   item:    { r }  punteggio della posizione
 *   correct: true se risolta senza errori né mosse svelate
 */
export function update(state, itemRating, correct) {
  const rating = Number.isFinite(state?.rating) ? state.rating : START_RATING;
  const attempts = state?.attempts || 0;
  const k = stepFor(attempts);
  const p = expected(rating, itemRating);
  const outcome = correct ? 1 : 0;

  return {
    rating: Math.round(rating + k * (outcome - p)),
    attempts: attempts + 1,
    item: Math.round(itemRating + K_ITEM * ((1 - outcome) - (1 - p))),
    expected: p,
    delta: Math.round(k * (outcome - p)),
  };
}

/** La difficoltà che centra il bersaglio per chi vale `rating`. */
export function targetDifficulty(rating) {
  return rating - TARGET_GAP;
}

/**
 * Sceglie fra le posizioni disponibili quelle vicine al bersaglio.
 * `spread` allarga la finestra finché non ci sono abbastanza candidati: meglio
 * un item un po' fuori misura che una coda vuota.
 */
export function pickByDifficulty(pool, rating, count, { spread = 80, max = 600 } = {}) {
  const target = targetDifficulty(rating);
  let window = spread;
  let inRange = [];
  while (window <= max) {
    inRange = pool.filter((p) => Math.abs(p.r - target) <= window);
    if (inRange.length >= count) break;
    window += spread;
  }
  if (inRange.length < count) inRange = pool.slice();
  return inRange
    .map((p) => ({ p, d: Math.abs(p.r - target) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(count, 0))
    .map((x) => x.p);
}
