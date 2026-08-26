/*
 * scheduler.js — che cosa studiare adesso, e in che ordine.
 *
 * Tre decisioni, tre riferimenti:
 *
 *  1. QUALI FRASI NUOVE — si preferiscono quelle appena sopra il livello
 *     stimato dal test (Krashen, input comprensibile "i+1"), pesate dal
 *     settore scelto e dalla grammatica non ancora incontrata.
 *  2. IN QUANTI MODI — ogni frase genera tre carte in ordine crescente di
 *     sforzo: riconoscere, completare, produrre. La produzione si sblocca solo
 *     quando il riconoscimento è consolidato (Nation, 2001: la conoscenza
 *     ricettiva precede quella produttiva).
 *  3. IN CHE ORDINE — i ripassi non vanno in blocchi per argomento ma
 *     mescolati (interleaving: Rohrer & Taylor 2007; Bjork, desirable
 *     difficulties): costa di più sul momento e rende di più a distanza.
 */

import { newCard, LEARNING, RELEARNING, REVIEW, NEW } from './fsrs.js';
import { LEVELS, levelIndex } from './corpus.js';
import { bandProgress, toCefr } from './irt.js';

/**
 * I quattro passaggi su una stessa frase, dal riconoscere al produrre.
 * Nessuno di questi si autovaluta: ognuno ha una risposta verificabile.
 */
export const TYPES = [
  { id: 'comp', label: 'Riconosci', short: 'Riconoscimento', icon: '👂', hint: 'Quale delle quattro traduzioni è la sua' },
  { id: 'build', label: 'Componi', short: 'Composizione', icon: '🧩', hint: 'Rimetti in fila le parole' },
  { id: 'cloze', label: 'Completa', short: 'Cloze', icon: '✏️', hint: 'Riempi i buchi, che aumentano col tempo' },
  { id: 'prod', label: 'Produci', short: 'Produzione', icon: '🗣️', hint: 'Scrivila o dettala per intero' },
];

const ORDER = TYPES.map((t) => t.id);

export const cardId = (sid, type) => `${sid}|${type}`;
export const splitId = (id) => {
  const [sid, type] = id.split('|');
  return { sid, type };
};

const LEARNING_WINDOW = 20 * 60000;

/* Quanto sopra il livello attuale conviene pescare, e con quanta tolleranza:
 * il picco poco sopra lo zero è l'"i+1", la coda larga tiene in circolo anche
 * il livello che si sta consolidando. */
const PEAK = 0.15;
const SPREAD = 0.9;

/** Un tipo è disponibile solo se il passaggio precedente è già maturo. */
export function unlocked(deck, sid, type) {
  const i = ORDER.indexOf(type);
  if (i <= 0) return i === 0;
  const c = deck.cards[cardId(sid, ORDER[i - 1])];
  return !!c && c.state === REVIEW && c.reps >= 1;
}

/** Livello attorno al quale escono le frasi nuove: serve solo a spiegarlo. */
export function targetLevel(theta) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.round(levelScore(theta) + PEAK)))];
}

/** Livello dell'utente come numero continuo (0 = A1, 5 = C2). */
export function levelScore(theta) {
  if (theta === null || theta === undefined) return levelIndex('A2');
  return levelIndex(toCefr(theta)) + bandProgress(theta);
}

/**
 * Punteggio "i+1": massimo poco sopra il livello attuale, in calo a scendere
 * e a salire. Una frase troppo facile non insegna, una troppo difficile non
 * si capisce.
 */
function fit(level, user) {
  const delta = levelIndex(level) - user;
  return Math.exp(-((delta - PEAK) ** 2) / (2 * SPREAD ** 2));
}

function domainBonus(sentence, domains) {
  if (!domains || !domains.length) return sentence.dom.includes('generale') ? 0.12 : 0.06;
  const hit = sentence.dom.some((d) => domains.includes(d));
  return hit ? 0.4 : sentence.dom.includes('generale') ? 0.08 : 0;
}

function grammarSets(deck, sentences) {
  const seen = new Set();
  for (const id of Object.keys(deck.cards)) {
    const { sid } = splitId(id);
    const s = sentences.get(sid);
    if (s) seen.add(s.g);
  }
  return seen;
}

/**
 * Estrazione casuale pesata, senza rimpiazzo: la probabilità è proporzionale
 * al punteggio elevato a potenza. Serve a non pescare ogni giorno le stesse
 * otto frasi dello stesso livello: la preferenza resta, la varietà pure.
 */
function weightedOrder(rows, random, sharpness = 3) {
  const pool = rows.map((r) => ({ ...r, w: Math.pow(Math.max(r.score, 0.0001), sharpness) }));
  const out = [];
  let total = pool.reduce((a, r) => a + r.w, 0);
  while (pool.length) {
    let x = random() * total;
    let i = 0;
    while (i < pool.length - 1 && (x -= pool[i].w) > 0) i++;
    total -= pool[i].w;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Ordina le frasi mai viste per quanto sono adatte adesso. */
export function rankNew(lang, deck, settings, theta, random = Math.random) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const introduced = new Set(Object.keys(deck.cards).map((id) => splitId(id).sid));
  const seenGrammar = grammarSets(deck, sentences);
  const user = levelScore(theta);

  const scored = lang.sentences
    .filter((s) => !introduced.has(s.id))
    .map((s) => ({
      s,
      score: fit(s.lv, user)
        + domainBonus(s, settings.domains)
        + (seenGrammar.has(s.g) ? 0 : 0.18),
    }));
  return weightedOrder(scored, random).map((x) => x.s);
}

/** Carte già introdotte il cui passaggio successivo si è appena sbloccato. */
export function pendingUnlocks(lang, deck) {
  const out = [];
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const sids = new Set(Object.keys(deck.cards).map((id) => splitId(id).sid));
  for (const sid of sids) {
    if (!sentences.has(sid)) continue;
    for (let i = 1; i < ORDER.length; i++) {
      const t = ORDER[i];
      if (deck.cards[cardId(sid, t)]) continue;
      if (!unlocked(deck, sid, t)) continue;
      out.push({ sid, type: t, strength: deck.cards[cardId(sid, ORDER[i - 1])].s });
      break; // un passaggio alla volta per frase
    }
  }
  return out.sort((a, b) => b.strength - a.strength);
}

/** Mescola i nuovi arrivi fra i ripassi invece di metterli tutti in testa. */
function interleave(reviews, fresh) {
  if (!fresh.length) return reviews;
  if (!reviews.length) return fresh;
  const out = [];
  const step = Math.max(1, Math.floor(reviews.length / fresh.length));
  let f = 0;
  reviews.forEach((card, i) => {
    out.push(card);
    if (f < fresh.length && (i + 1) % step === 0) out.push(fresh[f++]);
  });
  while (f < fresh.length) out.push(fresh[f++]);
  return out;
}

/**
 * Costruisce la coda della sessione.
 * Restituisce le carte da mostrare e i conteggi per la schermata iniziale.
 */
export function buildQueue({ lang, deck, settings, introducedToday = 0, now = Date.now(), random = Math.random }) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const all = Object.values(deck.cards).filter((c) => sentences.has(splitId(c.id).sid));

  const learning = all
    .filter((c) => (c.state === LEARNING || c.state === RELEARNING) && c.due <= now + LEARNING_WINDOW)
    .sort((a, b) => a.due - b.due);

  const due = all
    .filter((c) => c.state === REVIEW && c.due <= now)
    .sort((a, b) => a.due - b.due);

  const reviews = [...learning, ...due.slice(0, settings.maxReviews)];

  const budget = Math.max(0, settings.newPerDay - introducedToday);
  const busy = new Set(reviews.map((c) => splitId(c.id).sid));

  const unlocks = pendingUnlocks(lang, deck).filter((u) => !busy.has(u.sid));
  const deepSlots = Math.min(unlocks.length, Math.ceil(budget * 0.6));
  const fresh = [];

  for (const u of unlocks.slice(0, deepSlots)) {
    fresh.push(newCard(cardId(u.sid, u.type), { sid: u.sid, type: u.type }));
    busy.add(u.sid);
  }
  for (const s of rankNew(lang, deck, settings, deck.profile?.theta, random)) {
    if (fresh.length >= budget) break;
    if (busy.has(s.id)) continue;
    fresh.push(newCard(cardId(s.id, 'comp'), { sid: s.id, type: 'comp' }));
    busy.add(s.id);
  }
  for (const u of unlocks.slice(deepSlots)) {
    if (fresh.length >= budget) break;
    if (busy.has(u.sid)) continue;
    fresh.push(newCard(cardId(u.sid, u.type), { sid: u.sid, type: u.type }));
    busy.add(u.sid);
  }

  return {
    queue: interleave(reviews, fresh),
    counts: {
      learning: learning.length,
      due: due.length,
      shownDue: Math.min(due.length, settings.maxReviews),
      fresh: fresh.length,
      budget,
      total: reviews.length + fresh.length,
    },
  };
}

/** Prossima scadenza fra le carte non ancora dovute: per il messaggio "torna fra…". */
export function nextDue(deck, now = Date.now()) {
  let best = Infinity;
  for (const c of Object.values(deck.cards)) {
    if (c.state === NEW) continue;
    if (c.due > now && c.due < best) best = c.due;
  }
  return Number.isFinite(best) ? best : null;
}
