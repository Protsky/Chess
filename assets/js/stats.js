/*
 * stats.js — numeri onesti su come sta andando.
 *
 * La misura che conta è la **ritenzione vera**: la percentuale di ripassi
 * indovinati fra quelli arrivati a scadenza. Se resta vicina alla ritenzione
 * richiesta nelle impostazioni, il modello sta calibrando bene; se è molto più
 * bassa, gli intervalli sono troppo lunghi. È anche l'unico modo per accorgersi
 * che lo scheduler sta mentendo, e va guardata prima di credere a qualunque
 * altro numero di questa pagina.
 *
 * Tutto qui dentro è calcolato sul registro dei ripassi e sulle carte vere:
 * niente stime, niente medie inventate quando i dati non ci sono (in quel caso
 * si restituisce `null`, e l'interfaccia deve dirlo).
 */

import { dayKey } from './store.js';

const DAY = 86400000;

/** Ritenzione vera negli ultimi `days` giorni, solo sui ripassi di carte mature. */
export function trueRetention(log, days = 30) {
  const from = Date.now() - days * DAY;
  const rows = log.filter((e) => e.t >= from && e.wasReview);
  if (!rows.length) return null;
  const ok = rows.filter((e) => e.g > 1).length;
  return { rate: ok / rows.length, n: rows.length };
}

/** Risposte per giorno negli ultimi `days` giorni, dalla più vecchia. */
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
    out.push({ key, label: key.slice(8), month: MONTHS[new Date(at).getMonth()], ...row, ok: row.total - row.again });
  }
  return out;
}

/** Quante carte cadranno in scadenza nei prossimi giorni. */
export function forecast(cards, days = 14) {
  const out = Array.from({ length: days }, (_, i) => ({
    key: dayKey(Date.now() + i * DAY),
    label: i === 0 ? 'oggi' : `+${i}`,
    total: 0,
  }));
  const index = new Map(out.map((o, i) => [o.key, i]));
  for (const c of cards) {
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
  for (const c of cards) {
    out.total += 1;
    if (c.state === 'learning' || c.state === 'relearning') out.learning += 1;
    else if ((c.ivl || 0) >= 21) out.mature += 1;
    else out.young += 1;
  }
  return out;
}

/** Stabilità mediana in giorni: quanto regge in media una posizione. */
export function medianStability(cards) {
  const values = cards.filter((c) => c.s > 0).map((c) => c.s).sort((a, b) => a - b);
  if (!values.length) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/**
 * Per motivo tattico: quante ne hai viste e quante risolte pulite.
 * Serve a rispondere alla domanda che il mescolamento rende difficile da
 * vedere a occhio — *quale* motivo continua a scapparti.
 */
export function byTheme(log, min = 3) {
  const rows = new Map();
  for (const e of log) {
    if (!e.theme) continue;
    const row = rows.get(e.theme) || { theme: e.theme, n: 0, ok: 0 };
    row.n += 1;
    if (e.correct) row.ok += 1;
    rows.set(e.theme, row);
  }
  return [...rows.values()]
    .filter((r) => r.n >= min)
    .map((r) => ({ ...r, rate: r.ok / r.n }))
    .sort((a, b) => a.rate - b.rate);
}

/**
 * Le ultime `n` risposte di un asse, dalla più vecchia. Serve ai criteri
 * d'uscita dei primi livelli, che non parlano di totali ma di **come stai
 * andando adesso**: diciotto giuste sulle ultime venti, non sulle ultime mille.
 */
export function recentByAxis(log, axis, n = 20) {
  return log.filter((e) => e.axis === axis).slice(-n);
}

/** Mediana dei tempi di risposta (ms), o null se non ce ne sono. */
export function medianMs(entries) {
  const valori = entries.map((e) => e.ms).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!valori.length) return null;
  const mid = Math.floor(valori.length / 2);
  return valori.length % 2 ? valori[mid] : Math.round((valori[mid - 1] + valori[mid]) / 2);
}

/** Andamento del punteggio: l'ultimo valore di ogni giornata. */
export function ratingTrend(log, days = 30) {
  const from = Date.now() - days * DAY;
  const byDay = new Map();
  for (const e of log) {
    if (e.t < from || !Number.isFinite(e.rating)) continue;
    byDay.set(dayKey(e.t), e.rating);
  }
  return [...byDay.entries()].map(([key, rating]) => ({ key, label: key.slice(5), rating }));
}

/** Quanto dura una sessione, in minuti: nove secondi a posizione, misurati alla larga. */
export const estimateMinutes = (cards) => Math.max(1, Math.round((cards * 12) / 60));
