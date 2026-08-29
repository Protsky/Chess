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
  log: [],            // registro dei ripassi: senza, niente ritenzione vera né taratura
  daily: { day: null, introduced: 0, reviewed: 0 },
  streak: { count: 0, last: null },
  fsrs: { w: null, fittedAt: null, reviews: 0 },   // pesi tarati sui propri ripassi
  settings: {
    notation: 'it',
    sounds: true,
    showMoves: true,
    newPerDay: 8,     // quante posizioni nuove al giorno: il nuovo costa più del ripasso
    retention: 0.9,   // probabilità di ricordare a cui si punta quando arriva la scadenza
  },
  lastOpening: null,
  trainings: 0,
};

/*
 * Il registro non cresce all'infinito: tremila risposte bastano e avanzano per
 * misurare la ritenzione e rifare i pesi, e stanno larghe dentro localStorage.
 */
const LOG_MAX = 3000;

const DAY = 86400000;

/** Giorno locale in forma AAAA-MM-GG: le giornate contano dove sei tu, non a Greenwich. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
      log: state.log || [],
      daily: { ...DEFAULTS.daily, ...(state.daily || {}) },
      streak: { ...DEFAULTS.streak, ...(state.streak || {}) },
      fsrs: { ...DEFAULTS.fsrs, ...(state.fsrs || {}) },
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

/* ------------------------- registro dei ripassi -------------------------- */

/**
 * Registra una risposta. È la riga che permette poi di dire due cose che
 * altrimenti sarebbero opinioni: quanta parte dei ripassi arrivati a scadenza
 * è andata bene (la ritenzione vera), e quali pesi di FSRS spiegano meglio
 * *i tuoi* ripassi invece di quelli di tutti.
 *
 *   { id, t, g, isNew, wasReview, correct, ivl }
 */
export function logReview(entry) {
  return edit((state) => {
    state.log.push(entry);
    if (state.log.length > LOG_MAX) state.log.splice(0, state.log.length - LOG_MAX);

    const today = dayKey(entry.t);
    if (state.daily.day !== today) state.daily = { day: today, introduced: 0, reviewed: 0 };
    state.daily.reviewed += 1;
    if (entry.isNew) state.daily.introduced += 1;

    if (state.streak.last !== today) {
      const yesterday = dayKey(entry.t - DAY);
      state.streak.count = state.streak.last === yesterday ? state.streak.count + 1 : 1;
      state.streak.last = today;
    }
    return state.daily;
  });
}

export function getLog() {
  return read().log;
}

/** Conteggi di oggi: se il giorno è cambiato, sono zero. */
export function getDaily() {
  const state = read();
  const today = dayKey();
  return state.daily.day === today ? state.daily : { day: today, introduced: 0, reviewed: 0 };
}

/** Giorni di fila: vale oggi o ieri, altrimenti la serie è rotta. */
export function getStreak() {
  const { streak } = read();
  if (!streak.last) return 0;
  const today = dayKey();
  return streak.last === today || streak.last === dayKey(Date.now() - DAY) ? streak.count : 0;
}

/* ---------------------------- pesi tarati in casa ------------------------- */

export function getFsrs() {
  return read().fsrs;
}

/** Pesi da usare: i tuoi se sono stati tarati, altrimenti quelli di serie. */
export function getWeights() {
  const { fsrs } = read();
  return Array.isArray(fsrs.w) && fsrs.w.length === 19 ? fsrs.w : null;
}

export function setWeights(w, meta = {}) {
  return edit((state) => {
    state.fsrs = { w, fittedAt: Date.now(), ...meta };
    return state.fsrs;
  });
}

export function clearWeights() {
  edit((state) => { state.fsrs = { w: null, fittedAt: null, reviews: 0 }; });
}

/* --------------------------- backup: esporta e importa -------------------- */

/**
 * Tutto sta su questo telefono e basta. Il backup è l'unica cosa che sopravvive
 * a un telefono nuovo, alla cronologia cancellata o a Safari che libera spazio
 * (in iOS il deposito di un sito non usato per sette settimane può sparire).
 */
export function exportJson() {
  const state = read();
  return JSON.stringify({
    app: 'aperture-scacchi',
    version: 2,
    exportedAt: new Date().toISOString(),
    ...state,
  }, null, 2);
}

/** Che cosa c'è dentro un backup, senza importarlo: si guarda prima di sovrascrivere. */
export function inspectBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('non è un file JSON');
  if (parsed.app && parsed.app !== 'aperture-scacchi') throw new Error(`è il backup di un'altra app (${parsed.app})`);
  if (!parsed.cards && !parsed.progress) throw new Error('non contiene né carte né progressi');
  return {
    parsed,
    esportato: parsed.exportedAt || null,
    carte: Object.keys(parsed.cards || {}).length,
    aperture: Object.keys(parsed.progress || {}).length,
    ripassi: (parsed.log || []).length,
    punteggio: parsed.rating?.tattica?.rating ?? null,
  };
}

/** Sostituisce tutto con il backup. Chi chiama deve aver chiesto conferma. */
export function importJson(text) {
  const { parsed } = inspectBackup(text);
  const clean = { ...parsed };
  delete clean.app;
  delete clean.exportedAt;
  write({
    ...structuredClone(DEFAULTS),
    ...clean,
    version: 2,
    settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
    daily: { ...DEFAULTS.daily, ...(parsed.daily || {}) },
    streak: { ...DEFAULTS.streak, ...(parsed.streak || {}) },
    fsrs: { ...DEFAULTS.fsrs, ...(parsed.fsrs || {}) },
  });
  return inspectBackup(text);
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
