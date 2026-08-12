/*
 * store.js — progressi e impostazioni salvati sul dispositivo (localStorage).
 */

const KEY = 'aperture-scacchi/v1';

const DEFAULTS = {
  progress: {},       // id apertura -> { stars, best, attempts, lastAt }
  settings: { notation: 'it', sounds: true, showMoves: true },
  lastOpening: null,
  trainings: 0,
};

const EMPTY_PROGRESS = { stars: 0, best: 0, attempts: 0, lastAt: null };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      progress: parsed.progress || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* memoria piena o modalità privata: si continua senza salvare */
  }
  return state;
}

export function getSettings() {
  return read().settings;
}

export function setSetting(key, value) {
  const state = read();
  state.settings[key] = value;
  write(state);
  return state.settings;
}

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
  const state = read();
  state.lastOpening = id;
  write(state);
}

/** Registra il risultato di un allenamento tenendo il migliore. */
export function saveResult(id, { stars, accuracy }) {
  const state = read();
  const prev = { ...EMPTY_PROGRESS, ...(state.progress[id] || {}) };
  state.progress[id] = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, accuracy),
    attempts: prev.attempts + 1,
    lastAt: Date.now(),
  };
  state.trainings += 1;
  state.lastOpening = id;
  write(state);
  return state.progress[id];
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

export function reset() {
  const state = read();
  write({ ...structuredClone(DEFAULTS), settings: state.settings });
}
