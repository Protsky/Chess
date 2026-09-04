/*
 * regime.js — quando fermarsi, e dove sta rendendo il tempo.
 *
 * Tre misure che le app di scacchi di solito non fanno, o fanno con i numeri
 * di qualcun altro:
 *
 *  1. **La curva di fatica.** Dentro una sessione la resa cala, ma il punto in
 *     cui cala è tuo, non una regola generale. Qui si misura confrontando la
 *     quota di risposte giuste nelle prime posizioni con quella delle ultime, a
 *     parità di difficoltà del materiale — altrimenti si misurerebbe che la
 *     coda si fa più dura, non che la testa si stanca.
 *
 *  2. **Il freno.** Perdere abbassa la probabilità di vincere la successiva, e
 *     l'effetto si trascina per qualche partita (dati Lichess); ma è una cosa
 *     di *alcuni* giocatori: con un modello per giocatore l'effetto medio fra i
 *     1700 e i maestri è praticamente zero. Quindi qui non c'è nessuna soglia
 *     di popolazione: o l'effetto si vede nei tuoi dati, o non si dice niente.
 *
 *  3. **Dove rende il tempo.** L'app misura i minuti davvero spesi in ogni
 *     livello. Confrontarli con l'andamento del punteggio dà la sola risposta
 *     che conta per chi ha un'ora al giorno: quale ora ha reso di più.
 *
 * La regola che vale per tutte e tre: sotto il minimo di dati non si stampa un
 * numero, si dice quanti ne mancano. Un'app che riempie i buchi con le medie di
 * qualcun altro sta dicendo una cosa che non ha misurato.
 */

const MINUTO = 60000;

/* --------------------------- curva di fatica ----------------------------- */

/** Sotto queste sessioni complete il confronto testa/coda non si dichiara. */
export const MIN_SESSIONI = 6;

/**
 * Divide ogni sessione in prima e seconda metà e confronta la resa, tenendo
 * conto della difficoltà media dei due blocchi. Il risultato non è «sei
 * stanco»: è «da questa posizione in poi, nelle tue sessioni, la resa cala di
 * tanto», e quel numero viene dalle tue sessioni.
 */
export function fatica(log, { axis = null, minPerSessione = 8 } = {}) {
  const sessioni = raggruppaSessioni(log, { axis });
  const utili = sessioni.filter((s) => s.length >= minPerSessione);
  if (utili.length < MIN_SESSIONI) {
    return { pronto: false, sessioni: utili.length, servono: MIN_SESSIONI };
  }

  let testaOk = 0; let testaN = 0; let testaD = 0;
  let codaOk = 0; let codaN = 0; let codaD = 0;
  for (const s of utili) {
    const meta = Math.floor(s.length / 2);
    s.slice(0, meta).forEach((e) => { testaN += 1; testaD += e.rating ?? 0; if (e.correct) testaOk += 1; });
    s.slice(meta).forEach((e) => { codaN += 1; codaD += e.rating ?? 0; if (e.correct) codaOk += 1; });
  }
  const testa = testaOk / testaN;
  const coda = codaOk / codaN;
  return {
    pronto: true,
    sessioni: utili.length,
    testa,
    coda,
    calo: testa - coda,
    difficoltaSimile: Math.abs(testaD / testaN - codaD / codaN) < 60,
    posizioneMedia: Math.round(utili.reduce((s, x) => s + x.length, 0) / utili.length / 2),
  };
}

/**
 * Le sessioni, ricavate dai buchi nel registro: due risposte a più di venti
 * minuti di distanza sono due sessioni diverse. Non c'è un marcatore di
 * sessione salvato, e non serve: il tempo lo dice già.
 */
export function raggruppaSessioni(log, { axis = null, buco = 20 * MINUTO } = {}) {
  const righe = log.filter((e) => (!axis || e.axis === axis) && Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const out = [];
  let corrente = [];
  let ultimo = null;
  for (const e of righe) {
    if (ultimo !== null && e.t - ultimo > buco) { out.push(corrente); corrente = []; }
    corrente.push(e);
    ultimo = e.t;
  }
  if (corrente.length) out.push(corrente);
  return out;
}

/* -------------------------------- il freno -------------------------------- */

/** Quante sequenze servono prima di dire qualcosa sull'effetto delle sconfitte. */
export const MIN_SEQUENZE = 20;

/**
 * L'effetto delle sconfitte di fila sulla successiva, misurato sui propri
 * esiti (partite importate o sessioni). `esiti` è un elenco ordinato nel tempo
 * di booleani: true = andata bene.
 *
 * Torna la differenza fra la probabilità di riuscita dopo `k` insuccessi di
 * fila e quella complessiva. Se non si vede niente, lo dice: nessun freno.
 */
export function freno(esiti, { k = 3 } = {}) {
  if (esiti.length < MIN_SEQUENZE + k) {
    return { pronto: false, n: esiti.length, servono: MIN_SEQUENZE + k };
  }
  let dopoStrisce = 0; let dopoStricseOk = 0;
  for (let i = k; i < esiti.length; i++) {
    if (esiti.slice(i - k, i).every((x) => !x)) {
      dopoStrisce += 1;
      if (esiti[i]) dopoStricseOk += 1;
    }
  }
  const base = esiti.filter(Boolean).length / esiti.length;
  if (dopoStrisce < 5) return { pronto: false, strisce: dopoStrisce, servono: 5, base };
  const dopo = dopoStricseOk / dopoStrisce;
  return {
    pronto: true,
    k,
    base,
    dopo,
    effetto: dopo - base,
    strisce: dopoStrisce,
    consiglia: dopo + 0.05 < base,
  };
}

/* ------------------------ dove rende il tempo ---------------------------- */

/** Minuti spesi per asse, sommando i tempi di risposta veri del registro. */
export function minutiPerAsse(log, { da = 0 } = {}) {
  const out = {};
  for (const e of log) {
    if (!Number.isFinite(e.ms) || (e.t ?? 0) < da) continue;
    out[e.axis || 'altro'] = (out[e.axis || 'altro'] || 0) + e.ms;
  }
  return Object.fromEntries(Object.entries(out).map(([k, ms]) => [k, ms / MINUTO]));
}

/** Sotto questi minuti su un asse non si azzarda una resa oraria. */
export const MIN_MINUTI = 60;

/**
 * Punti guadagnati per ora su un asse, calcolati **solo** sui propri dati:
 * differenza fra il punteggio più recente e quello di partenza sull'asse,
 * divisa per le ore vere. Non si confronta con nessuna media di popolazione,
 * perché non ne abbiamo una misurata qui dentro.
 */
export function resaPerOra(log, axis) {
  const righe = log.filter((e) => e.axis === axis && Number.isFinite(e.rating)).sort((a, b) => a.t - b.t);
  const minuti = minutiPerAsse(log)[axis] || 0;
  if (righe.length < 30 || minuti < MIN_MINUTI) {
    return { pronto: false, minuti: Math.round(minuti), risposte: righe.length, servono: MIN_MINUTI };
  }
  const delta = righe[righe.length - 1].rating - righe[0].rating;
  return {
    pronto: true,
    delta,
    ore: minuti / 60,
    perOra: delta / (minuti / 60),
    risposte: righe.length,
  };
}

/** Il confronto fra assi, ordinato: la domanda vera è «quale ora ha reso di più». */
export function classifica(log, assi) {
  return assi
    .map((axis) => ({ axis, ...resaPerOra(log, axis) }))
    .sort((a, b) => (b.perOra ?? -Infinity) - (a.perOra ?? -Infinity));
}
