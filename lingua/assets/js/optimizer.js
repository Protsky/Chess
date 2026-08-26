/*
 * optimizer.js — tarare FSRS sui tuoi ripassi, invece che su quelli di tutti.
 *
 * I 19 pesi di default della versione 5 vengono da centinaia di milioni di
 * ripetizioni di altre persone: sono un ottimo punto di partenza e un pessimo
 * punto d'arrivo. Il senso dichiarato di FSRS (Ye et al., 2022-2024) è proprio
 * che quei pesi si rifanno sui dati di chi studia.
 *
 * Come si fa, in concreto:
 *
 *  1. si ricostruisce la storia di ogni carta dal registro dei ripassi;
 *  2. per una certa scelta di pesi si rigioca la storia in avanti, e per ogni
 *     ripasso si confronta la probabilità di ricordare che il modello aveva
 *     previsto con quello che è successo davvero;
 *  3. la misura è la log-loss (la stessa che si usa per valutare qualunque
 *     previsione probabilistica), affiancata dall'RMSE di calibrazione, che
 *     dice quanto le previsioni sono oneste e non solo ordinate bene;
 *  4. si scende a coordinate: un peso alla volta, si prova a spostarlo su e
 *     giù e si tiene lo spostamento che abbassa la log-loss. Poche passate
 *     bastano, e girano in un browser in meno di un secondo.
 *
 * Vale la pena dire cosa NON è: con poche centinaia di ripassi la stima è
 * rumorosa e i pesi ottenuti valgono poco più dei default. L'app lo dice
 * apertamente invece di far finta di niente.
 */

import { BOUNDS, DEFAULT_W, memoryStep, retrievability, intervalFor } from './fsrs.js';

const DAY = 86400000;

/** Sotto questa soglia l'ottimizzazione è rumore: si può fare, non conviene. */
export const MIN_REVIEWS = 120;
/** Sopra questa, i pesi cominciano a dire qualcosa di stabile. */
export const GOOD_REVIEWS = 400;

/**
 * Dal registro alle storie delle carte: una sequenza ordinata di
 * (voto, giorni dall'ultimo ripasso) per ogni carta di cui si conosce l'inizio.
 */
export function replay(log) {
  const byCard = new Map();
  for (const e of [...log].sort((a, b) => a.t - b.t)) {
    if (!byCard.has(e.id)) byCard.set(e.id, []);
    byCard.get(e.id).push(e);
  }
  const out = [];
  for (const entries of byCard.values()) {
    // senza il primo ripasso non si sa da dove parte la memoria: si scarta
    if (!entries[0].isNew) continue;
    const steps = entries.map((e, i) => ({
      grade: e.g,
      elapsed: i === 0 ? 0 : (e.t - entries[i - 1].t) / DAY,
    }));
    if (steps.length > 1) out.push(steps);
  }
  return out;
}

const EPS = 1e-6;
const clampP = (p) => Math.min(1 - EPS, Math.max(EPS, p));

/**
 * Rigioca tutte le storie con certi pesi e restituisce le previsioni.
 * Si valutano solo i ripassi a distanza di almeno un giorno: quelli dentro la
 * stessa sessione seguono un'altra formula e non dicono niente sull'oblio.
 */
export function predictions(sequences, w) {
  const rows = [];
  for (const steps of sequences) {
    let state = null;
    for (const step of steps) {
      if (state && step.elapsed >= 1) {
        rows.push({ p: clampP(retrievability(step.elapsed, state.s)), hit: step.grade > 1 ? 1 : 0 });
      }
      state = memoryStep(w, state, step.grade, step.elapsed);
    }
  }
  return rows;
}

/** Quanto le previsioni erano sbagliate: più basso, meglio. */
export function logLoss(rows) {
  if (!rows.length) return Infinity;
  let sum = 0;
  for (const { p, hit } of rows) sum -= hit ? Math.log(p) : Math.log(1 - p);
  return sum / rows.length;
}

/**
 * Curva di calibrazione: le previsioni raggruppate per fascia, con accanto
 * quello che è successo davvero. Una previsione dell'85% dovrebbe azzeccarci
 * l'85% delle volte: è questo che il grafico mostra.
 */
export function calibration(rows, bins = 10) {
  const out = Array.from({ length: bins }, (_, i) => ({
    from: i / bins,
    to: (i + 1) / bins,
    n: 0,
    predicted: 0,
    observed: 0,
  }));
  for (const { p, hit } of rows) {
    const b = Math.min(bins - 1, Math.floor(p * bins));
    out[b].n += 1;
    out[b].predicted += p;
    out[b].observed += hit;
  }
  for (const bin of out) {
    if (!bin.n) continue;
    bin.predicted /= bin.n;
    bin.observed /= bin.n;
  }
  return out.filter((b) => b.n > 0);
}

/** RMSE di calibrazione, pesato sul numero di ripassi in ogni fascia. */
export function calibrationRmse(rows, bins = 10) {
  const groups = calibration(rows, bins);
  const total = groups.reduce((a, b) => a + b.n, 0);
  if (!total) return null;
  let sum = 0;
  for (const g of groups) sum += g.n * (g.predicted - g.observed) ** 2;
  return Math.sqrt(sum / total);
}

/** Qualità complessiva di una scelta di pesi sui dati veri. */
export function score(sequences, w) {
  const rows = predictions(sequences, w);
  return { n: rows.length, logLoss: logLoss(rows), rmse: calibrationRmse(rows), rows };
}

const clampTo = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));

/**
 * Discesa a coordinate: un peso alla volta, passi via via più piccoli.
 * Semplice di proposito — deve girare su un telefono senza librerie.
 */
export function optimize(sequences, { start = DEFAULT_W, passes = 4, onProgress } = {}) {
  let best = start.slice();
  let bestLoss = logLoss(predictions(sequences, best));
  const initial = bestLoss;

  for (let pass = 0; pass < passes; pass++) {
    const scale = 0.35 / (pass + 1);
    for (let i = 0; i < best.length; i++) {
      const [lo, hi] = BOUNDS[i];
      const span = Math.min(hi - lo, Math.abs(best[i]) + 0.1);
      for (const delta of [span * scale, -span * scale, span * scale * 0.3, -span * scale * 0.3]) {
        const candidate = best.slice();
        candidate[i] = clampTo(best[i] + delta, BOUNDS[i]);
        if (candidate[i] === best[i]) continue;
        const loss = logLoss(predictions(sequences, candidate));
        if (loss < bestLoss - 1e-9) {
          best = candidate;
          bestLoss = loss;
        }
      }
    }
    onProgress?.((pass + 1) / passes, bestLoss);
  }

  return { w: best, logLoss: bestLoss, improvement: initial - bestLoss, initialLogLoss: initial };
}

/* ------------------------- ritenzione conveniente ------------------------ */

/** Recuperabilità media lungo un intervallo: quanto la frase è "viva" nel frattempo. */
function averageR(stability, days) {
  if (days <= 0) return 1;
  const F = 19 / 81;
  return (2 * stability / (F * days)) * (Math.sqrt(1 + (F * days) / stability) - 1);
}

/** Secondi per ripasso quando non si hanno ancora misure proprie. */
export const DEFAULT_COST = { pass: 9, fail: 22 };

/**
 * Quanto costa e quanto rende una certa ritenzione richiesta.
 *
 * Si simula una popolazione di carte per un anno: a ogni scadenza il ripasso
 * va bene con probabilità pari alla ritenzione richiesta (è la definizione) e
 * male nel resto dei casi. Si sommano i secondi spesi e si misura quanto la
 * memoria è stata alta nel frattempo.
 *
 * Il punto sta nel costo: sbagliare non costa come indovinare. Una carta
 * sbagliata torna più volte nella stessa sessione e riparte da una stabilità
 * più bassa. Se si contassero i ripassi e basta, la risposta sarebbe sempre
 * "allunga gli intervalli"; contando i secondi, l'ottimo si sposta dentro
 * l'intervallo utile. I secondi si misurano sui tuoi ripassi, quando ce ne
 * sono abbastanza, altrimenti si usano quelli di partenza.
 *
 * Resta una simulazione, con le sue ipotesi: va letta come un'indicazione.
 */
export function workload(w, retention, { days = 365, cards = 120, seed = 7, cost = DEFAULT_COST } = {}) {
  let rnd = seed;
  const next = () => {
    rnd = (rnd * 1103515245 + 12345) % 2147483648;
    return rnd / 2147483648;
  };

  let reviews = 0;
  let seconds = 0;
  let knowledge = 0;
  for (let c = 0; c < cards; c++) {
    let state = memoryStep(w, null, 3, 0);
    reviews += 1;
    seconds += cost.pass;
    let t = 0;
    while (t < days) {
      const interval = Math.max(1, Math.round(intervalFor(state.s, retention)));
      const span = Math.min(interval, days - t);
      knowledge += averageR(state.s, span) * span;
      t += interval;
      if (t >= days) break;
      const grade = next() < retention ? 3 : 1;
      state = memoryStep(w, state, grade, interval);
      reviews += 1;
      seconds += grade === 1 ? cost.fail : cost.pass;
    }
  }
  const totalDays = cards * days;
  const memory = knowledge / totalDays;
  const minutes = seconds / cards / 60;
  return {
    retention,
    reviews: reviews / cards,
    minutes,
    knowledge: memory,
    perMinute: memory / minutes,
  };
}

/**
 * Il costo di ogni ritenzione richiesta, da 80% a 95%.
 *
 * Non c'è un numero "giusto" da consigliare, e chi lo consiglia sta nascondendo
 * delle ipotesi: quale sia il punto migliore dipende da quanto tempo hai e da
 * quanto ti serve ricordare adesso invece che fra un anno. Quello che si può
 * dire senza barare è quanto costa ogni scelta, ed è quello che questa curva
 * mostra: ripassi all'anno, minuti all'anno e memoria media, per carta.
 *
 * Le medie sono su più popolazioni simulate, altrimenti il rumore della
 * simulazione si vede più della differenza fra una ritenzione e l'altra.
 */
export function retentionCurve(w, options = {}) {
  const seeds = [7, 19, 41, 83];
  const out = [];
  for (let step = 80; step <= 95; step += 1) {
    const retention = step / 100;
    const runs = seeds.map((seed) => workload(w, retention, { cards: 300, ...options, seed }));
    const avg = (pick) => runs.reduce((a, r) => a + pick(r), 0) / runs.length;
    out.push({
      retention,
      reviews: avg((r) => r.reviews),
      minutes: avg((r) => r.minutes),
      knowledge: avg((r) => r.knowledge),
    });
  }
  return out;
}

/**
 * Secondi per ripasso misurati sul registro: quanto costa davvero indovinare
 * e quanto costa sbagliare. Le risposte lunghissime si scartano, perché quasi
 * sempre vuol dire che il telefono è finito in tasca.
 */
export function measuredCost(log, fallback = DEFAULT_COST) {
  const clean = log.filter((e) => e.ms > 500 && e.ms < 120000);
  const pass = clean.filter((e) => e.g > 1).map((e) => e.ms / 1000);
  const fail = clean.filter((e) => e.g === 1).map((e) => e.ms / 1000);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    pass: pass.length >= 20 ? mean(pass) : fallback.pass,
    fail: fail.length >= 10 ? mean(fail) : fallback.fail,
    measured: pass.length >= 20 && fail.length >= 10,
    samples: clean.length,
  };
}
