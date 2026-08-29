/*
 * store.js — progressi e impostazioni salvati sul dispositivo (localStorage).
 *
 * Versione 2. La v1 teneva solo stelle e record delle aperture; qui accanto
 * vivono le **carte**: ogni posizione tattica ha uno stato di memoria FSRS
 * (stabilità, difficoltà, scadenza) e l'app ha una coda governata dalle
 * scadenze invece di un elenco da scorrere.
 *
 * I dati della v1 non si buttano: alla prima apertura si migrano.
 */

const KEY = 'aperture-scacchi/v2';
const KEY_V1 = 'aperture-scacchi/v1';

const DEFAULTS = {
  version: 2,
  progress: {},       // id apertura -> { stars, best, attempts, lastAt }
  cards: {},          // id carta -> stato FSRS (vedi fsrs.js)
  rating: {},         // asse -> { rating, attempts }
  counts: {},         // asse -> { done, correct }
  settings: { notation: 'it', sounds: true, showMoves: true },
  lastOpening: null,
  trainings: 0,
};

const EMPTY_PROGRESS = { stars: 0, best: 0, attempts: 0, lastAt: null };

/** Prefissi degli identificativi di carta: la coda si filtra per famiglia. */
export const TACTIC = 't:';
export const OPENING = 'a:';

function migrate(parsed) {
  if (!parsed) return null;
  if (parsed.version === 2) return parsed;
  // v1: stesse chiavi per aperture e impostazioni, nessuna carta.
  return {
    ...structuredClone(DEFAULTS),
    progress: parsed.progress || {},
    settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
    lastOpening: parsed.lastOpening ?? null,
    trainings: parsed.trainings || 0,
  };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(KEY_V1);
    if (!raw) return structuredClone(DEFAULTS);
    const state = migrate(JSON.parse(raw));
    return {
      ...structuredClone(DEFAULTS),
      ...state,
      settings: { ...DEFAULTS.settings, ...(state.settings || {}) },
      progress: state.progress || {},
      cards: state.cards || {},
      rating: state.rating || {},
      counts: state.counts || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: 2 }));
  } catch {
    /* memoria piena o modalità privata: si continua senza salvare */
  }
  return state;
}

/** Legge, modifica e riscrive in un colpo solo. */
function edit(fn) {
  const state = read();
  const out = fn(state);
  write(state);
  return out;
}

/* ------------------------------ impostazioni ----------------------------- */

export function getSettings() {
  return read().settings;
}

export function setSetting(key, value) {
  return edit((state) => {
    state.settings[key] = value;
    return state.settings;
  });
}

/* -------------------------------- aperture ------------------------------- */

export function getProgress(id) {
  return { ...EMPTY_PROGRESS, ...(read().progress[id] || {}) };
}

export function allProgress() {
  return read().progress;
}

export function getLastOpening() {
  return read().lastOpening;
}

export function setLastOpening(id) {
  edit((state) => { state.lastOpening = id; });
}

/** Registra il risultato di un allenamento tenendo il migliore. */
export function saveResult(id, { stars, accuracy }) {
  return edit((state) => {
    const prev = { ...EMPTY_PROGRESS, ...(state.progress[id] || {}) };
    state.progress[id] = {
      stars: Math.max(prev.stars, stars),
      best: Math.max(prev.best, accuracy),
      attempts: prev.attempts + 1,
      lastAt: Date.now(),
    };
    state.trainings += 1;
    state.lastOpening = id;
    return state.progress[id];
  });
}

/** Statistiche aggregate su un elenco di aperture. */
export function summarize(openings) {
  const progress = read().progress;
  const stars = openings.reduce((sum, o) => sum + (progress[o.id]?.stars || 0), 0);
  const started = openings.filter((o) => progress[o.id]?.attempts).length;
  const mastered = openings.filter((o) => (progress[o.id]?.stars || 0) === 3).length;
  const max = openings.length * 3;
  return {
    stars,
    max,
    started,
    mastered,
    total: openings.length,
    percent: max ? Math.round((stars / max) * 100) : 0,
  };
}

export function totalTrainings() {
  return read().trainings;
}

/* --------------------------------- carte --------------------------------- */

export function getCard(id) {
  return read().cards[id] || null;
}

export function saveCard(card) {
  edit((state) => { state.cards[card.id] = card; });
  return card;
}

export function allCards(prefix = '') {
  const cards = read().cards;
  return Object.values(cards).filter((c) => c.id.startsWith(prefix));
}

/** Le carte scadute, dalla più in ritardo. */
export function dueCards(prefix = '', now = Date.now()) {
  return allCards(prefix)
    .filter((c) => (c.due || 0) <= now)
    .sort((a, b) => (a.due || 0) - (b.due || 0));
}

/** Quante carte ci sono, quante scadute, quante consolidate. */
export function cardStats(prefix = '', now = Date.now()) {
  const cards = allCards(prefix);
  const due = cards.filter((c) => (c.due || 0) <= now).length;
  const solid = cards.filter((c) => (c.s || 0) >= 21).length;
  return { total: cards.length, due, solid };
}

/* -------------------------------- punteggi ------------------------------- */

export function getRating(axis) {
  return read().rating[axis] || null;
}

export function setRating(axis, value) {
  edit((state) => { state.rating[axis] = value; });
  return value;
}

/** Conteggi veri di un asse: quante risposte, quante giuste. Nessuna stima. */
export function getCounts(axis) {
  return read().counts[axis] || { done: 0, correct: 0 };
}

export function addCount(axis, correct) {
  return edit((state) => {
    const c = state.counts[axis] || { done: 0, correct: 0 };
    c.done += 1;
    if (correct) c.correct += 1;
    state.counts[axis] = c;
    return c;
  });
}

/* --------------------------------- azzera -------------------------------- */

export function reset() {
  const state = read();
  write({ ...structuredClone(DEFAULTS), settings: state.settings });
}

/** Azzera solo una famiglia di carte, lasciando il resto in piedi. */
export function resetCards(prefix, axis = null) {
  edit((state) => {
    for (const id of Object.keys(state.cards)) if (id.startsWith(prefix)) delete state.cards[id];
    if (axis) { delete state.rating[axis]; delete state.counts[axis]; }
  });
}
