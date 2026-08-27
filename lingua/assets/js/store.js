/*
 * store.js — tutto lo stato dell'app in localStorage.
 *
 * Un mazzo per lingua: profilo (θ del test), carte, registro dei ripassi,
 * conteggi del giorno e serie di giorni consecutivi. Il registro serve alle
 * statistiche (ritenzione reale, carico futuro) ed è tenuto a un tetto per
 * non riempire lo spazio disponibile.
 */

const KEY = 'frasi/v1';
const LOG_MAX = 6000;

const DEFAULTS = {
  v: 1,
  lang: null,
  settings: {
    newPerDay: 8,
    maxReviews: 120,
    retention: 0.9,
    tts: true,
    ttsRate: 0.85,
    ttsPitch: 1,
    dailyGoal: 120,   // punti al giorno
    sounds: true,
    match: true,      // apre la sessione con un abbinamento a coppie
    criterion: 1,     // richiami corretti richiesti dentro la stessa sessione
    autoGrade: true,
    autoNext: true,   // se indovini, la carta successiva arriva da sola
    speechInput: true,
    voices: {},       // lingua -> voce scelta a mano fra quelle del dispositivo
    online: { ru: true },  // lingua -> voce online invece di quella del telefono
    direction: 'produce',   // 'produce' = dall'italiano alla lingua; 'understand' = il contrario
    w: null,          // pesi FSRS tarati sui propri ripassi, se calcolati
    domains: [],
  },
  decks: {},
};

const EMPTY_DECK = {
  profile: { theta: null, se: null, cefr: null, at: null, history: [] },
  cards: {},
  log: [],
  daily: { day: null, introduced: 0, reviewed: 0, xp: 0, cleared: false },
  streak: { count: 0, last: null },
};

/** Chiave del giorno in ora locale: le giornate di studio non seguono UTC. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      decks: parsed.decks || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* spazio esaurito o navigazione privata: si continua senza salvare */
  }
  return state;
}

/** Legge, lascia modificare, salva. Restituisce il valore ritornato da fn. */
export function update(fn) {
  const state = read();
  const out = fn(state);
  write(state);
  return out;
}

export const getState = () => read();

export const getSettings = () => read().settings;

export function setSetting(key, value) {
  return update((s) => {
    s.settings[key] = value;
    return s.settings;
  });
}

export const getLang = () => read().lang;

export function setLang(code) {
  return update((s) => {
    s.lang = code;
    if (!s.decks[code]) s.decks[code] = structuredClone(EMPTY_DECK);
    return code;
  });
}

function ensure(state, code) {
  if (!state.decks[code]) state.decks[code] = structuredClone(EMPTY_DECK);
  const deck = state.decks[code];
  deck.profile = { ...structuredClone(EMPTY_DECK.profile), ...(deck.profile || {}) };
  deck.cards = deck.cards || {};
  deck.log = deck.log || [];
  deck.daily = deck.daily || structuredClone(EMPTY_DECK.daily);
  deck.streak = deck.streak || structuredClone(EMPTY_DECK.streak);
  return deck;
}

export function getDeck(code = read().lang) {
  if (!code) return structuredClone(EMPTY_DECK);
  // ensure() lavora sulla copia appena letta: leggere non deve scrivere
  return structuredClone(ensure(read(), code));
}

export function withDeck(fn, code = read().lang) {
  return update((s) => fn(ensure(s, code), s));
}

/* ------------------------------ profilo ------------------------------ */

export function saveProfile(code, profile) {
  return withDeck((deck) => {
    deck.profile = {
      ...deck.profile,
      ...profile,
      at: Date.now(),
      history: [...(deck.profile.history || []), { at: Date.now(), theta: profile.theta, cefr: profile.cefr }].slice(-24),
    };
    return deck.profile;
  }, code);
}

/* ------------------------------- carte ------------------------------- */

export function saveCard(card, code = read().lang) {
  return withDeck((deck) => {
    deck.cards[card.id] = card;
    return card;
  }, code);
}

/** Registra la risposta e aggiorna conteggi giornalieri e serie. */
export function logReview(entry, code = read().lang) {
  return withDeck((deck) => {
    deck.log.push(entry);
    if (deck.log.length > LOG_MAX) deck.log.splice(0, deck.log.length - LOG_MAX);
    rollDay(deck, entry.t);
    deck.daily.reviewed += 1;
    deck.daily.xp = (deck.daily.xp || 0) + (entry.xp || 0);
    if (entry.isNew) deck.daily.introduced += 1;
    bumpStreak(deck, entry.t);
    return deck.daily;
  }, code);
}

function rollDay(deck, ts) {
  const today = dayKey(ts);
  if (deck.daily.day !== today) deck.daily = { day: today, introduced: 0, reviewed: 0, xp: 0, cleared: false };
}

function bumpStreak(deck, ts) {
  const today = dayKey(ts);
  if (deck.streak.last === today) return;
  const yesterday = dayKey(ts - 86400000);
  deck.streak.count = deck.streak.last === yesterday ? deck.streak.count + 1 : 1;
  deck.streak.last = today;
}

/** Conteggi di oggi: se il giorno è cambiato ripartono da zero. */
export function today(code = read().lang) {
  const { daily } = getDeck(code);
  const key = dayKey();
  return daily.day === key
    ? { xp: 0, cleared: false, ...daily }
    : { day: key, introduced: 0, reviewed: 0, xp: 0, cleared: false };
}

/** Segna che oggi la coda è stata svuotata, e assegna il premio una sola volta. */
export function markCleared(bonus, code = read().lang) {
  return withDeck((deck) => {
    rollDay(deck, Date.now());
    if (deck.daily.cleared) return false;
    deck.daily.cleared = true;
    deck.daily.xp = (deck.daily.xp || 0) + bonus;
    return true;
  }, code);
}

export function streak(code = read().lang) {
  const deck = getDeck(code);
  if (!deck.streak.last) return 0;
  const t = dayKey();
  const y = dayKey(Date.now() - 86400000);
  return deck.streak.last === t || deck.streak.last === y ? deck.streak.count : 0;
}

/* ------------------------- esporta e importa ------------------------- */

export function exportJson() {
  return JSON.stringify({ ...read(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.decks) throw new Error('File non riconosciuto');
  write({
    ...structuredClone(DEFAULTS),
    ...parsed,
    settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
  });
  return true;
}

export function resetDeck(code) {
  update((s) => {
    s.decks[code] = structuredClone(EMPTY_DECK);
  });
}

export function resetAll() {
  update((s) => {
    s.lang = null;
    s.decks = {};
  });
}
