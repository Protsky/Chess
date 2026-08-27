/*
 * stats.js — numeri onesti su come sta andando.
 *
 * La misura che conta davvero è la ritenzione reale: la percentuale di
 * ripassi indovinati fra quelli arrivati a scadenza. Se resta vicina alla
 * ritenzione richiesta nelle impostazioni, il modello sta calibrando bene;
 * se è molto più bassa, gli intervalli sono troppo lunghi (o le frasi troppo
 * difficili per il livello attuale).
 */

import { splitId } from './scheduler.js';
import { LEVELS } from './corpus.js';
import { dayKey } from './store.js';

const DAY = 86400000;

/** Ritenzione reale sugli ultimi `days` giorni, solo su carte già mature. */
export function trueRetention(log, days = 30) {
  const from = Date.now() - days * DAY;
  const rows = log.filter((e) => e.t >= from && e.wasReview);
  if (!rows.length) return null;
  const ok = rows.filter((e) => e.g > 1).length;
  return { rate: ok / rows.length, n: rows.length };
}

/** Ripassi per giorno negli ultimi `days` giorni, dal più vecchio. */
export function reviewsByDay(log, days = 14) {
  const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const counts = new Map();
  for (const e of log) {
    const key = dayKey(e.t);
    const row = counts.get(key) || { total: 0, again: 0, fresh: 0 };
    row.total += 1;
    if (e.g === 1) row.again += 1;
    if (e.isNew) row.fresh += 1;
    counts.set(key, row);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const at = Date.now() - i * DAY;
    const key = dayKey(at);
    const row = counts.get(key) || { total: 0, again: 0, fresh: 0 };
    out.push({
      key,
      label: key.slice(8),
      month: MONTHS[new Date(at).getMonth()],
      ...row,
      ok: row.total - row.again,
    });
  }
  return out;
}

/** Quanti ripassi cadranno nei prossimi giorni. */
export function forecast(cards, days = 14) {
  const out = Array.from({ length: days }, (_, i) => ({
    key: dayKey(Date.now() + i * DAY),
    label: i === 0 ? 'oggi' : `+${i}`,
    total: 0,
  }));
  const index = new Map(out.map((o, i) => [o.key, i]));
  for (const c of Object.values(cards)) {
    if (!c.due) continue;
    const i = index.get(dayKey(c.due));
    if (i !== undefined) out[i].total += 1;
    else if (c.due < Date.now()) out[0].total += 1;
  }
  return out;
}

/** Distribuzione delle carte per maturità (soglia classica: 21 giorni). */
export function stateCounts(cards) {
  const out = { learning: 0, young: 0, mature: 0, total: 0 };
  for (const c of Object.values(cards)) {
    out.total++;
    if (c.state === 'learning' || c.state === 'relearning') out.learning++;
    else if (c.ivl >= 21) out.mature++;
    else out.young++;
  }
  return out;
}

/** Avanzamento per punto grammaticale: quante frasi e quanto sono solide. */
export function grammarProgress(deck, lang) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const totals = new Map();
  for (const s of lang.sentences) {
    const row = totals.get(s.g) || { g: s.g, total: 0, seen: new Set(), stability: [] };
    row.total++;
    totals.set(s.g, row);
  }
  for (const [id, card] of Object.entries(deck.cards)) {
    const s = sentences.get(splitId(id).sid);
    if (!s) continue;
    const row = totals.get(s.g);
    row.seen.add(s.id);
    if (card.s > 0) row.stability.push(card.s);
  }
  return [...totals.values()]
    .map((r) => ({
      g: r.g,
      total: r.total,
      seen: r.seen.size,
      strength: r.stability.length
        ? r.stability.reduce((a, b) => a + b, 0) / r.stability.length
        : 0,
    }))
    .sort((a, b) => b.seen / b.total - a.seen / a.total || b.strength - a.strength);
}

/** Copertura del corpus livello per livello. */
export function levelCoverage(deck, lang) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const seen = new Set();
  for (const id of Object.keys(deck.cards)) {
    const s = sentences.get(splitId(id).sid);
    if (s) seen.add(s.id);
  }
  return LEVELS.map((lv) => {
    const total = lang.sentences.filter((s) => s.lv === lv).length;
    const done = lang.sentences.filter((s) => s.lv === lv && seen.has(s.id)).length;
    return { lv, total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  });
}

/** Frasi più ostiche: quelle con più errori accumulati. */
export function troubleSpots(deck, lang, limit = 8) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const rows = [];
  for (const [id, card] of Object.entries(deck.cards)) {
    if (!card.lapses) continue;
    const s = sentences.get(splitId(id).sid);
    if (s) rows.push({ sentence: s, card, type: splitId(id).type });
  }
  return rows.sort((a, b) => b.card.lapses - a.card.lapses || b.card.d - a.card.d).slice(0, limit);
}

/**
 * Parole diverse incontrate nel tempo.
 *
 * È la misura che conta per la comprensione: non quante frasi hai visto, ma
 * quanti tipi lessicali diversi ti sono passati davanti. La letteratura sulla
 * copertura del testo (Nation) mostra che la comprensione dipende dalla quota
 * di parole note in un testo, e quella quota si costruisce per tipi, non per
 * ripetizioni delle stesse.
 */
export function vocabulary(deck, lang) {
  const sentences = new Map(lang.sentences.map((s) => [s.id, s]));
  const firstSeen = new Map();
  for (const e of [...deck.log].sort((a, b) => a.t - b.t)) {
    const sid = splitId(e.id).sid;
    if (!firstSeen.has(sid)) firstSeen.set(sid, e.t);
  }
  const types = new Set();
  const points = [];
  const seenDays = new Map();
  for (const [sid, t] of [...firstSeen.entries()].sort((a, b) => a[1] - b[1])) {
    const s = sentences.get(sid);
    if (!s) continue;
    for (const w of s.text.toLowerCase().split(/\s+/)) {
      const clean = w.replace(/[.,!?¿¡;:"()…]/g, '');
      if (clean) types.add(clean);
    }
    seenDays.set(dayKey(t), types.size);
  }
  let i = 0;
  for (const [key, count] of seenDays) points.push({ x: i++, y: count, key });

  const all = new Set();
  for (const s of lang.sentences) {
    for (const w of s.text.toLowerCase().split(/\s+/)) {
      const clean = w.replace(/[.,!?¿¡;:"()…]/g, '');
      if (clean) all.add(clean);
    }
  }
  return { points, types: types.size, total: all.size, days: points.length };
}

/** Stabilità mediana delle carte già in ripasso: la carta "tipica" del mazzo. */
export function medianStability(cards) {
  const values = Object.values(cards).filter((c) => c.state === 'review' && c.s > 0).map((c) => c.s).sort((a, b) => a - b);
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/** Minuti stimati per la sessione: 9 secondi a carta è la media osservata. */
export const estimateMinutes = (cards) => Math.max(1, Math.round((cards * 9) / 60));
