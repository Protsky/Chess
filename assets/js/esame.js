/*
 * esame.js — le posizioni che l'allenamento non tocca mai.
 *
 * Il difetto che questo file esiste per togliere: finora l'app misurava
 * l'uscita da un livello sulle ultime venti risposte del registro, cioè su
 * carte che FSRS aveva programmato **proprio perché stavano per essere
 * ricordate**. Misurare lì dentro misura il ripasso, non la forza.
 *
 * Quindi una parte del corpus viene tenuta fuori: mai proposta in sessione,
 * mai trasformata in carta, mai vista finché non serve. Si usa solo per gli
 * esami, e ogni item d'esame si spende una volta sola.
 *
 * Tre esami, tutti sulle stesse regole:
 *
 *   uscita     quando i dati di allenamento dicono che il livello è pronto
 *   tenuta 7   una settimana dopo averlo superato
 *   tenuta 30  un mese dopo
 *
 * Le prove di tenuta non sono un vezzo: quello che si sa fare oggi dopo dieci
 * ripetizioni non è quello che si saprà fare fra un mese (Soderstrom & Bjork
 * 2015), e un livello «superato» che nessuno riverifica è un'affermazione che
 * nessuno ha mai controllato. Se la tenuta non regge, il livello si riapre.
 */

import * as Stima from './stima.js';

/**
 * Quanta parte del corpus resta fuori. Otto per cento di 3235 sono ~260
 * posizioni: bastano per una decina di esami da ventiquattro senza mai
 * ripetersi, e tolgono all'allenamento meno di quanto si perda in una settimana.
 */
export const QUOTA = 0.08;

/** Quante posizioni in un esame. */
export const ITEM = 24;

/*
 * La divisione è una funzione dell'identificativo, non un sorteggio: due
 * dispositivi che si sincronizzano devono tenere fuori le stesse posizioni, e
 * un corpus rigenerato domani deve dare la stessa divisione di oggi. (È anche
 * il motivo per cui non c'è un elenco salvato: non c'è niente da salvare.)
 */
function hash(testo) {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export const inEsame = (id, quota = QUOTA) => hash(`esame:${id}`) < quota;

export const poolAllenamento = (pool, quota = QUOTA) => pool.filter((p) => !inEsame(p.id, quota));
export const poolEsame = (pool, quota = QUOTA) => pool.filter((p) => inEsame(p.id, quota));

/*
 * I livelli di base non pescano da un corpus ma da un generatore: le posizioni
 * sono tante quante servono, quindi tenerne fuori una su quattro non toglie
 * niente all'allenamento e dà esami abbastanza lunghi.
 */
export const QUOTA_GENERATI = 0.25;

/**
 * Compone un esame attorno alla soglia da dimostrare.
 *
 * Gli item più informativi su «sei sopra 1400?» sono quelli da 1400: è lì che
 * una risposta giusta e una sbagliata dicono cose diverse. Quindi si pesca in
 * una finestra stretta attorno alla soglia, si allarga solo se non basta, e si
 * mescolano i motivi come in sessione — un esame a blocchi misurerebbe una
 * cosa diversa dall'allenamento.
 */
export function componi({ pool, soglia, n = ITEM, spesi = new Set(), finestra = 150 } = {}) {
  const disponibili = poolEsame(pool).filter((p) => !spesi.has(p.id));
  let scelti = [];
  let raggio = finestra;
  while (raggio <= 800) {
    scelti = disponibili.filter((p) => Math.abs(p.r - soglia) <= raggio);
    if (scelti.length >= n) break;
    raggio += finestra;
  }
  if (scelti.length < n) scelti = disponibili.slice();

  const ordinati = scelti
    .map((p) => ({ p, d: Math.abs(p.r - soglia), h: hash(`ordine:${p.id}`) }))
    .sort((a, b) => a.d - b.d || a.h - b.h)
    .slice(0, n)
    .map((x) => x.p);

  return mescolaMotivi(ordinati);
}

/** Due motivi uguali non si toccano, come in sessione. */
export function mescolaMotivi(items) {
  const resto = items.slice().sort((a, b) => hash(`mix:${a.id}`) - hash(`mix:${b.id}`));
  const out = [];
  let ultimo = null;
  while (resto.length) {
    let i = resto.findIndex((x) => x.t !== ultimo);
    if (i === -1) i = 0;
    const [next] = resto.splice(i, 1);
    out.push(next);
    ultimo = next.t;
  }
  return out;
}

/* ---------------------------- il pavimento ------------------------------- */

/**
 * Il criterio d'uscita del livello 3 diceva «nessun motivo sotto il 60%» e
 * nessuno lo faceva rispettare: l'avanzamento era calcolato solo sul punteggio.
 * Qui il pavimento esiste davvero.
 *
 * Si guardano solo i motivi visti abbastanza volte da dire qualcosa: sotto le
 * otto risposte una percentuale è rumore, e bloccare un livello su un rumore è
 * peggio che non bloccarlo.
 */
export const MIN_PER_MOTIVO = 8;
export const PAVIMENTO = 0.6;

export function motiviDeboli(log, { axis, min = MIN_PER_MOTIVO, soglia = PAVIMENTO } = {}) {
  const per = new Map();
  for (const e of log) {
    if (axis && e.axis !== axis) continue;
    if (!e.theme) continue;
    const v = per.get(e.theme) || { n: 0, ok: 0 };
    v.n += 1;
    if (e.correct) v.ok += 1;
    per.set(e.theme, v);
  }
  return [...per.entries()]
    .filter(([, v]) => v.n >= min && v.ok / v.n < soglia)
    .map(([theme, v]) => ({ theme, n: v.n, quota: v.ok / v.n }))
    .sort((a, b) => a.quota - b.quota);
}

/* --------------------------- stato dei livelli ---------------------------- */

const GIORNO = 86400000;

/** Dopo quanti giorni si riverifica un livello superato. */
export const TENUTE = [
  { tipo: 'tenuta7', giorni: 7 },
  { tipo: 'tenuta30', giorni: 30 },
];

/**
 * Che cosa fare adesso con un livello, dato quello che è successo finora.
 *
 *   record: { superatoIl, tenute: { tenuta7, tenuta30 }, riaperto }
 *
 * Stati possibili:
 *   'in-corso'        non ancora superato
 *   'esame-pronto'    i dati di allenamento dicono che si può provare
 *   'superato'        superato, e le verifiche dovute sono state fatte
 *   'da-riverificare' è ora di una prova di tenuta
 *   'riaperto'        una prova di tenuta è andata male
 */
export function statoLivello(record, { now = Date.now(), pronto = false } = {}) {
  if (!record || !record.superatoIl) {
    return { stato: pronto ? 'esame-pronto' : 'in-corso', prossima: null, scadutaDa: 0 };
  }
  if (record.riaperto) {
    return { stato: pronto ? 'esame-pronto' : 'riaperto', prossima: null, scadutaDa: 0 };
  }
  const fatte = record.tenute || {};
  for (const t of TENUTE) {
    if (fatte[t.tipo]) continue;
    const quando = record.superatoIl + t.giorni * GIORNO;
    if (now >= quando) return { stato: 'da-riverificare', prossima: t, scadutaDa: now - quando };
    return { stato: 'superato', prossima: t, scadutaDa: 0 };
  }
  return { stato: 'superato', prossima: null, scadutaDa: 0 };
}

/**
 * L'esito di un esame: si passa se il limite inferiore dell'intervallo supera
 * la soglia e nessun motivo visto abbastanza sta sotto il pavimento. Due
 * condizioni, entrambe necessarie: un punteggio alto con l'inchiodatura al
 * trenta per cento non è un livello superato, è una media che nasconde un buco.
 */
export function esito({ risposte, soglia, log = [], axis = null }) {
  const s = Stima.stima(risposte.map((r) => ({ d: r.d, ok: r.ok })));
  const insieme = [...log, ...risposte.map((r) => ({ axis, theme: r.theme, correct: r.ok }))];
  const deboli = motiviDeboli(insieme, { axis });
  return { passa: Stima.superaSoglia(s, soglia) && deboli.length === 0, stima: s, deboli, soglia };
}
