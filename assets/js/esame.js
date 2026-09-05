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
import * as Calibrato from './calibrato.js';

/**
 * Quanta parte del corpus resta fuori: l'otto per cento, che su 3235 posizioni
 * fa **247**.
 *
 * La prima versione di questo commento diceva «~260, bastano per una decina di
 * esami». Il numero era arrotondato e il conto era sbagliato, perché ignorava
 * la finestra: un esame pesca attorno alla soglia, e attorno a 1400 le
 * posizioni tenute fuori sono 74 entro ±300 — cioè tre esami, quanti ne serve
 * **un solo percorso** di L3 (uscita, tenuta a 7 giorni, tenuta a 30), con zero
 * margine per la riapertura che `statoLivello` prevede come esito normale.
 * `magazzino()` qui sotto conta le scorte vere, e l'app le mostra.
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

/*
 * Nel pool d'esame entrano solo item con una difficoltà **misurata**: la
 * barriera di `calibrato.js` sta anche qui, a monte, così un esame non si
 * compone nemmeno con materiale che poi lo stimatore respingerebbe.
 */
export const poolEsame = (pool, quota = QUOTA) => pool.filter(
  (p) => inEsame(p.id, quota) && Calibrato.itemMisurabile(p),
);

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
/**
 * Quante posizioni d'esame restano davvero, e a che distanza dalla soglia.
 *
 * Serve perché il numero che l'app mostrava era `componi(...).length`, cioè
 * sempre 24: diceva quanto è lungo l'esame, non quanto ne resta. Le scorte sono
 * la risorsa che si consuma — ogni item si spende una volta sola — e vanno
 * contate nella finestra che conta, non in totale.
 */
export const FINESTRA_UTILE = 300;

export function magazzino({ pool, soglia, spesi = new Set(), finestra = FINESTRA_UTILE } = {}) {
  const liberi = poolEsame(pool).filter((p) => !spesi.has(p.id));
  const vicini = liberi.filter((p) => Math.abs(p.r - soglia) <= finestra);
  return {
    utili: vicini.length,
    totali: liberi.length,
    esamiRimasti: Math.floor(vicini.length / ITEM),
    finestra,
    /* Sotto un esame intero nella finestra utile non si comincia: si dice. */
    bastano: vicini.length >= ITEM,
  };
}

export function componi({ pool, soglia, n = ITEM, spesi = new Set(), finestra = 150 } = {}) {
  const disponibili = poolEsame(pool).filter((p) => !spesi.has(p.id));
  let scelti = [];
  let raggio = finestra;
  while (raggio <= FINESTRA_UTILE) {
    scelti = disponibili.filter((p) => Math.abs(p.r - soglia) <= raggio);
    if (scelti.length >= n) break;
    raggio += finestra;
  }
  /*
   * Oltre la finestra utile non si allarga più. Prima si arrivava a ±800: gli
   * item smettono di dire qualcosa sulla soglia (uno da 600 lo risolvono tutti,
   * uno da 2200 nessuno) e l'intervallo si allarga proprio quando servirebbe
   * stretto. Meglio un esame che non parte, dicendolo, di un esame che misura
   * male senza dirlo.
   */
  if (scelti.length < n) return [];

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

/**
 * Quante risposte guarda il pavimento, per motivo. È una **finestra**, e non
 * era così.
 *
 * Prima il conto girava su tutto il registro (fino a 3000 ripassi): un motivo
 * sbagliato nelle prime settimane restava nel denominatore per mesi, e il
 * pavimento non misurava come stai andando adesso ma la media della tua vita.
 * Un livello poteva restare chiuso su risposte date molto tempo prima, cioè
 * l'opposto di quello che il criterio dice di fare.
 */
export const FINESTRA_MOTIVO = 20;

export function motiviDeboli(log, {
  axis, min = MIN_PER_MOTIVO, soglia = PAVIMENTO, finestra = FINESTRA_MOTIVO,
} = {}) {
  /* In ordine di tempo: la finestra ha senso solo se «ultimi» vuol dire qualcosa. */
  const righe = log
    .filter((e) => (!axis || e.axis === axis) && e.theme)
    .slice()
    .sort((a, b) => (a.t || 0) - (b.t || 0));

  const per = new Map();
  for (const e of righe) {
    if (!per.has(e.theme)) per.set(e.theme, []);
    per.get(e.theme).push(e);
  }

  return [...per.entries()]
    .map(([theme, tutte]) => {
      const ultime = tutte.slice(-finestra);
      const ok = ultime.filter((e) => e.correct).length;
      return {
        theme,
        n: ultime.length,
        quota: ultime.length ? ok / ultime.length : 0,
        viste: tutte.length,
      };
    })
    .filter((x) => x.n >= min && x.quota < soglia)
    .sort((a, b) => a.quota - b.quota);
}

/* -------------------------- la curva dell'esame --------------------------- */

/*
 * Che cosa misura davvero questo esame.
 *
 * L'app dice «esame a 1400: il limite inferiore lo supera». È vero, ed è
 * calcolato sui dati veri — ma nomina una cosa diversa da quella che decide.
 * Con ventiquattro item l'errore standard vale ottanta punti abbondanti, e
 * 1,96 errori standard si sommano alla soglia: chi vale **esattamente** 1400
 * supera questo esame il 2,8% delle volte, e il cinquanta per cento si
 * raggiunge intorno a **1545**.
 *
 * Non è un difetto da correggere abbassando la soglia: è la prudenza che si è
 * scelta, e va bene. È un numero da **scrivere accanto**, perché un criterio
 * che non dice dove sta il proprio punto di mezzo è un criterio che chi studia
 * non può interpretare.
 *
 * Il conto è esatto, non simulato, e si può fare perché nel modello di Rasch il
 * punteggio dipende **solo dal numero** di risposte giuste (il conteggio è una
 * statistica sufficiente per la forza). Quindi la regola «il limite inferiore
 * supera la soglia» si riduce a «almeno k risposte giuste», e la probabilità di
 * arrivarci è quella di una Poisson-binomiale sui ventiquattro item veri.
 */

/** Il minimo numero di risposte giuste che fa passare la regola in vigore. */
export function conteggioMinimo(items, soglia) {
  for (let k = 0; k <= items.length; k++) {
    const risposte = items.map((p, i) => ({ d: p.r, ok: i < k }));
    if (Stima.superaSoglia(Stima.stima(risposte), soglia)) return k;
  }
  return null;         // nemmeno prendendole tutte: la soglia è fuori portata
}

/**
 * P(almeno k successi) con probabilità diverse per ogni prova. Programmazione
 * dinamica sulla distribuzione del numero di successi: esatta, e su
 * ventiquattro item costa nulla.
 */
function almeno(ps, k) {
  let dist = [1];
  for (const p of ps) {
    const next = new Array(dist.length + 1).fill(0);
    for (let i = 0; i < dist.length; i++) {
      next[i] += dist[i] * (1 - p);
      next[i + 1] += dist[i] * p;
    }
    dist = next;
  }
  return dist.slice(k).reduce((a, b) => a + b, 0);
}

/**
 * La curva operativa: per una griglia di forze vere, la probabilità che questo
 * esame dichiari «superato».
 *
 * Riguarda la sola regola sul punteggio. Il pavimento per motivo è una
 * condizione **in più**, che può solo abbassare questa curva: dipende da quali
 * motivi si sbagliano, non da quanti, e non si riduce a un conteggio.
 */
export function curvaOperativa({ items, soglia, da = soglia - 100, a = soglia + 400, passo = 50 } = {}) {
  const k = conteggioMinimo(items, soglia);
  if (k === null) return { k: null, punti: [], meta: null };

  const punti = [];
  for (let theta = da; theta <= a; theta += passo) {
    const ps = items.map((p) => Stima.probabilita(theta, p.r));
    punti.push({ forza: theta, p: almeno(ps, k) });
  }

  return { k, punti, meta: forza50(items, soglia, k), su: items.length };
}

/** La forza a cui questo esame si supera una volta su due, per bisezione. */
function forza50(items, soglia, k) {
  let lo = soglia - 400;
  let hi = soglia + 800;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = almeno(items.map((x) => Stima.probabilita(mid, x.r)), k);
    if (p < 0.5) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** La probabilità di superare, a una forza data: il numero da mostrare. */
export function probabilitaA(items, soglia, forza) {
  const k = conteggioMinimo(items, soglia);
  if (k === null) return 0;
  return almeno(items.map((x) => Stima.probabilita(forza, x.r)), k);
}

/**
 * La stessa domanda per gli esami a conteggio, dove la difficoltà degli item
 * non è misurata: lì la curva è una binomiale semplice sulla probabilità di
 * risposta giusta, ed è l'unica cosa onesta che si possa dire.
 */
export function curvaConteggio({ giuste, su, da = 0.5, a = 1, passo = 0.05 } = {}) {
  const punti = [];
  for (let p = da; p <= a + 1e-9; p += passo) {
    punti.push({ p: Math.min(1, p), passa: almeno(new Array(su).fill(Math.min(1, p)), giuste) });
  }
  return punti;
}

/** A quale tasso di risposta giusta un criterio a conteggio si supera a meta'. */
export function tasso50({ giuste, su }) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (almeno(new Array(su).fill(mid), giuste) < 0.5) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
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
