/*
 * percorso.js — gli otto livelli, che cosa si fa oggi, e come si esce davvero.
 *
 * Tre cose che l'app deve saper dire appena si apre:
 *
 *  1. **Dove sei.** Il percorso è una scala con un criterio d'uscita misurato
 *     per ogni gradino, non un elenco di modalità.
 *  2. **Che cosa fai adesso.** Una sessione sola, già composta.
 *  3. **Che cosa hai dimostrato.** Ed è la parte che prima non c'era.
 *
 * Perché la terza è nuova, e perché conta più delle altre due: fino a ieri
 * l'uscita da un livello si misurava sulle ultime venti risposte del registro.
 * Ma quelle risposte sono ripassi che FSRS ha programmato **proprio perché**
 * stavano per essere ricordati, e per il livello 3 il criterio scritto («nessun
 * motivo sotto il 60%») non lo faceva rispettare nessuno: l'avanzamento usava
 * solo il punteggio. Si usciva da L3 con l'inchiodatura al trenta per cento,
 * purché il numero grosso fosse salito.
 *
 * Adesso un livello si supera in un modo solo: un **esame** su posizioni che
 * l'allenamento non ha mai toccato (`esame.js`), giudicato sul limite inferiore
 * dell'intervallo di confidenza (`stima.js`) e con un pavimento per ogni
 * motivo. E resta superato solo se regge a **sette e trenta giorni**: quello
 * che si sa fare oggi dopo dieci ripetizioni non è quello che si saprà fare fra
 * un mese, e un livello che nessuno riverifica è un'affermazione che nessuno ha
 * mai controllato.
 *
 * I livelli non ancora costruiti stanno qui lo stesso, marcati `in-arrivo`.
 */

import { PUZZLES } from './puzzles.js';
import * as Rating from './rating.js';
import * as Basics from './basics.js';
import * as Endgames from './endgames.js';
import * as Stats from './stats.js';
import * as Esame from './esame.js';
import * as Stima from './stima.js';
import * as Calcolo from './calcolo.js';
import * as Piani from './piani.js';
import * as Ricostruzione from './ricostruzione.js';
import { OPENINGS } from './openings.js';

/*
 * Il descrittore d'esame di ogni livello. Due forme sole, e sono diverse per
 * una ragione: dove gli item hanno una difficoltà misurata (il corpus di
 * Lichess ha il Glicko-2 calcolato su milioni di tentativi) si può stimare una
 * forza con un intervallo; dove gli item li genera l'app, una difficoltà in
 * punti non esiste e inventarla sarebbe peggio che contare. Allora si conta.
 *
 *   { tipo: 'stima', soglia }        il limite inferiore deve superare la soglia
 *   { tipo: 'conta', giuste, su }    servono tante risposte giuste su tante
 *
 * ACCESSO e ESAME sono due cose diverse, e per un po' sono state raccontate
 * come una sola.
 *
 * `accesso` è quello che `pronto()` guarda sul registro di **allenamento**:
 * serve solo a non far sprecare posizioni d'esame a chi è lontano. `exit` è
 * quello che `verdetto()` applica sulle posizioni **mai viste**, ed è l'unica
 * cosa che fa dire «superato». Dichiararne uno e misurare l'altro è lo stesso
 * difetto che questo file è nato per togliere — e ci era rientrato da solo:
 * L2 diceva «sei finali» mentre l'esame ne chiedeva tre, L6 diceva «la linea e
 * il piano» mentre l'esame era 7 su 8, e la mediana di L0 non la guardava
 * nessuno.
 */
export const LIVELLI = [
  {
    code: 'L0',
    name: 'Vista della scacchiera',
    line: 'Colore di una casa, salti del cavallo, chi attacca cosa. E la posizione rimessa a memoria dopo cinque secondi.',
    accesso: '17 giuste sulle ultime 20 di allenamento, con mediana sotto i 3 secondi',
    exit: '18 risposte giuste su 20 mai viste, e mediana sotto i 3 secondi anche lì',
    state: 'attivo',
    hash: '#/vista',
    action: 'Allenati',
    axis: Basics.VISTA,
    esame: { tipo: 'conta', giuste: 18, su: 20, medianaMax: Basics.USCITA[Basics.VISTA].mediana },
  },
  {
    code: 'L1',
    name: 'Non regalare pezzi',
    line: 'Che cosa resta in presa dopo la tua mossa. Il livello che rende di più a chi comincia.',
    accesso: '18 giuste sulle ultime 20 di allenamento',
    exit: '19 controlli di sicurezza su 20 mai visti',
    state: 'attivo',
    hash: '#/sicurezza',
    action: 'Allenati',
    axis: Basics.SICUREZZA,
    esame: { tipo: 'conta', giuste: 19, su: 20 },
  },
  {
    code: 'L2',
    name: 'I finali che si vincono a memoria',
    line: 'Re e Donna, Re e Torre: matto forzato, con la tavola dei finali a fare da giudice.',
    accesso: 'sei finali portati a casa senza mai perdere l’esito',
    exit: '3 finali di fila senza perdere l’esito, su posizioni della prova',
    state: 'attivo',
    hash: '#/finali',
    action: 'Allenati',
    axis: Endgames.AXIS,
    esame: { tipo: 'conta', giuste: 3, su: 3 },
  },
  {
    code: 'L3',
    name: 'I motivi tattici, mescolati',
    line: 'Trova la mossa: dodici motivi che non si annunciano mai prima, e un item su quattro dove non c’è niente.',
    accesso: 'il punteggio di allenamento arriva dove l’esame si supera una volta su due',
    exit: 'esame a 1400 sul limite inferiore dell’intervallo, e nessun motivo sotto il 60%',
    state: 'attivo',
    hash: '#/tattica',
    action: 'Allenati',
    axis: 'tattica',
    esame: { tipo: 'stima', soglia: 1400 },
  },
  {
    code: 'L4',
    name: 'Calcolo e visualizzazione',
    line: 'La posizione si guarda, poi si spegne. Le mosse si giocano a memoria.',
    accesso: '8 sequenze giuste su 10 in allenamento, a 4 semimosse',
    exit: 'le stesse 8 su 10, ma su posizioni mai viste',
    state: 'attivo',
    hash: '#/calcolo',
    action: 'Allenati',
    axis: Calcolo.AXIS,
    esame: { tipo: 'conta', giuste: Calcolo.USCITA.giuste, su: Calcolo.USCITA.su },
  },
  {
    code: 'L5',
    name: 'Posizione e piani',
    line: 'Colonne, avamposti, pedoni deboli, il pezzo peggiore. Scegliere fra mosse tutte plausibili.',
    exit: '70% su item posizionali del proprio livello',
    state: 'in-arrivo',
  },
  {
    code: 'L6',
    name: 'Le aperture',
    line: '33 varianti con idea, piano e commenti: la linea, e perché.',
    accesso: 'almeno otto linee portate a tre stelle',
    exit: '7 piani nominati su 8, su aperture della stessa famiglia',
    state: 'attivo',
    hash: '#/aperture',
    action: 'Studia',
    axis: Piani.AXIS,
    esame: { tipo: 'conta', giuste: 7, su: 8 },
  },
  {
    code: 'L7',
    name: 'Il materiale nelle tue partite',
    line: 'Incolli il PGN, l’app trova dove hai perso materiale e te lo rigioca.',
    accesso: 'nessuno: si apre appena hai un file di partite',
    exit: 'nessuno: è il regime di crociera, non un gradino da superare',
    state: 'attivo',
    hash: '#/partite',
    action: 'Importa',
    axis: 'partite',
    /*
     * L'unico livello **senza esame**, ed è una conseguenza di come è fatto, non
     * una dimenticanza: i suoi item non hanno una difficoltà misurata e sono
     * posizioni che hai già vissuto al tavolo. `calibrato.js` li respinge dalla
     * misura, quindi non possono certificare niente — e va detto invece di
     * lasciar credere che ci sia un gradino.
     */
    esame: null,
    senzaEsame: true,
  },
];

export const byCode = (code) => LIVELLI.find((l) => l.code === code) || null;

/** Il livello su cui si sta lavorando: il primo attivo non ancora superato. */
export function livelloCorrente(avanzamenti) {
  const attivi = LIVELLI.filter((l) => l.state === 'attivo');
  return attivi.find((l) => !['superato'].includes(avanzamenti[l.code]?.stato)) || attivi[attivi.length - 1];
}

/* ---------------------- la curva di questo esame -------------------------- */

/*
 * Il punto in cui l'esame si supera una volta su due. Si calcola sugli item che
 * l'esame userebbe davvero, quindi è un numero dei dati e non una convenzione —
 * ma costa qualcosa, e la home lo chiede a ogni disegno: si tiene da parte.
 */
const META_CACHE = new Map();

export function puntoMeta(soglia) {
  if (META_CACHE.has(soglia)) return META_CACHE.get(soglia);
  const items = Esame.componi({ pool: PUZZLES, soglia });
  const c = items.length ? Esame.curvaOperativa({ items, soglia }) : null;
  const meta = c && c.meta !== null ? c.meta : soglia;
  META_CACHE.set(soglia, meta);
  return meta;
}

/** La curva intera, per le schermate che la mostrano. */
export function curvaDi(code, { spesi = new Set() } = {}) {
  const livello = byCode(code);
  if (!livello?.esame) return null;
  if (livello.esame.tipo === 'conta') {
    return {
      tipo: 'conta',
      giuste: livello.esame.giuste,
      su: livello.esame.su,
      tasso50: Esame.tasso50(livello.esame),
    };
  }
  const items = Esame.componi({ pool: PUZZLES, soglia: livello.esame.soglia, spesi });
  if (!items.length) return null;
  return { tipo: 'stima', soglia: livello.esame.soglia, ...Esame.curvaOperativa({ items, soglia: livello.esame.soglia }) };
}

/* ---------------------- pronti per l'esame? ------------------------------ */

/**
 * I dati di allenamento dicono che vale la pena provare l'esame.
 *
 * È una soglia di **accesso**, non di superamento: serve solo a non far
 * sprecare posizioni d'esame a chi è palesemente lontano — ogni item d'esame si
 * spende una volta sola. Il giudizio vero lo dà l'esame.
 */
export function pronto(code, { log = [], rating = Rating.START_RATING, aperture = null } = {}) {
  const livello = byCode(code);
  if (!livello || livello.state !== 'attivo') return false;
  /* Un livello senza esame non e' mai "pronto per l'esame": non ce n'e' uno. */
  if (livello.senzaEsame) return false;

  if (code === 'L0' || code === 'L1') {
    const ultime = Stats.recentByAxis(log, livello.axis, 20);
    if (ultime.length < 20) return false;
    const giuste = ultime.filter((e) => e.correct).length;
    if (code === 'L0') {
      const mediana = Stats.medianMs(ultime);
      return giuste >= 17 && mediana !== null && mediana <= Basics.USCITA[Basics.VISTA].mediana;
    }
    return giuste >= 18;
  }
  if (code === 'L2') {
    return log.filter((e) => e.axis === Endgames.AXIS && e.correct).length >= Endgames.USCITA.puliti;
  }
  if (code === 'L3') {
    /*
     * La soglia d'accesso non è più un numero incollato.
     *
     * Era `rating >= 1350`, e a 1350 questo esame si supera il 0,5% delle volte:
     * si bruciavano ventiquattro delle poche posizioni d'esame rimaste per un
     * tentativo quasi certamente perso — l'esatto contrario di quello che il
     * commento qui sopra dichiara di fare. Adesso si apre dove l'esame si supera
     * **una volta su due**, e quel punto lo calcola la curva sugli item veri.
     */
    const attempts = log.filter((e) => e.axis === 'tattica').length;
    return attempts >= 60 && rating >= puntoMeta(livello.esame.soglia);
  }
  if (code === 'L4') {
    return Calcolo.uscita(log).giuste >= Calcolo.USCITA.giuste;
  }
  if (code === 'L6') {
    const u = Piani.uscita({ progressi: aperture || {} });
    return u.linea >= 8;
  }
  return false;
}

/* --------------------------- l'esame vero -------------------------------- */

/**
 * Il verdetto di un esame appena sostenuto.
 *
 *   risposte: [{ d?, ok, theme? }]  — `d` solo dove la difficoltà è misurata
 *
 * Per gli esami a conteggio non si stampa nessun punteggio: si dice quante ne
 * sono andate bene su quante, che è tutto quello che quei dati permettono.
 */
export function verdetto(code, risposte, { log = [] } = {}) {
  const livello = byCode(code);
  if (!livello?.esame) {
    return { passa: false, motivo: 'livello senza esame', tipo: 'nessuno', giuste: 0, su: 0, deboli: [] };
  }

  if (livello.esame.tipo === 'stima') {
    const out = Esame.esito({
      risposte,
      soglia: livello.esame.soglia,
      log,
      axis: livello.axis,
    });
    return {
      ...out,
      tipo: 'stima',
      testo: Stima.testo(out.stima),
      giuste: risposte.filter((r) => r.ok).length,
      su: risposte.length,
    };
  }

  const giuste = risposte.filter((r) => r.ok).length;
  const ora = Date.now();
  const deboli = Esame.motiviDeboli(
    [...log, ...risposte.map((r, i) => ({
      axis: livello.axis, theme: r.theme, correct: r.ok, t: ora + i,
    }))],
    { axis: livello.axis },
  );

  /*
   * La mediana, dove il criterio la dichiara.
   *
   * L0 dice «18 su 20, mediana sotto i 3 secondi» da sempre, ma il tempo lo
   * guardava solo `pronto()`, cioè la soglia d'accesso: nel verdetto non
   * entrava mai. Un criterio scritto e non applicato — proprio quello che
   * questo file esiste per togliere, rientrato dalla finestra.
   */
  const tempi = risposte.map((r) => r.ms).filter((x) => Number.isFinite(x));
  const mediana = tempi.length ? [...tempi].sort((a, b) => a - b)[Math.floor(tempi.length / 2)] : null;
  const chiedeMediana = Number.isFinite(livello.esame.medianaMax);
  const medianaOk = !chiedeMediana || (mediana !== null && mediana <= livello.esame.medianaMax);

  const abbastanza = giuste >= livello.esame.giuste;
  const pezzi = [`${giuste} su ${risposte.length} (ne servivano ${livello.esame.giuste})`];
  if (chiedeMediana && mediana !== null) {
    pezzi.push(`mediana ${(mediana / 1000).toFixed(1)} s (serve sotto ${(livello.esame.medianaMax / 1000).toFixed(1)})`);
  }

  return {
    tipo: 'conta',
    passa: abbastanza && medianaOk && deboli.length === 0,
    giuste,
    su: risposte.length,
    deboli,
    mediana,
    medianaOk,
    medianaMax: livello.esame.medianaMax ?? null,
    testo: pezzi.join(' · '),
  };
}

/* --------------------------- gli avanzamenti ----------------------------- */

/**
 * Avanzamento e stato di ogni livello, calcolati sui dati veri.
 *
 * Per i livelli non costruiti non si restituisce niente: una barra al 12% su un
 * livello che non si può allenare sarebbe un numero inventato.
 */
export function avanzamenti({ rating, aperture, log = [], livelli = {}, now = Date.now() }) {
  const out = {};

  for (const l of LIVELLI) {
    if (l.state !== 'attivo') continue;
    const record = livelli[l.code] || null;
    const pronti = pronto(l.code, { log, rating, aperture: aperture?.progress || aperture });
    const stato = Esame.statoLivello(record, { now, pronto: pronti });
    out[l.code] = { ...misura(l, { rating, aperture, log }), ...stato, record };
  }

  return out;
}

function misura(livello, { rating, aperture, log }) {
  switch (livello.code) {
    case 'L0': return uscitaBase(Basics.VISTA, log);
    case 'L1': return uscitaBase(Basics.SICUREZZA, log);
    case 'L2': return uscitaFinali(log);
    case 'L3': return uscitaTattica(rating);
    case 'L4': return Calcolo.uscita(log);
    case 'L6': return Piani.uscita({ progressi: aperture?.progress || {} });
    case 'L7': return uscitaPartite(log);
    default: return { percent: 0, label: '' };
  }
}

/**
 * Quanto manca a poter **provare** l'esame dei due livelli di base.
 *
 * Non si misura «quante ne hai fatte» ma «come stai andando sulle ultime
 * venti»: un criterio cumulativo lo si supera studiando a lungo anche
 * sbagliando, e qui il punto è proprio che certe cose diventino automatiche.
 */
function uscitaBase(axis, log) {
  const ultime = Stats.recentByAxis(log, axis, 20);
  const giuste = ultime.filter((e) => e.correct).length;
  const mediana = Stats.medianMs(ultime);

  if (axis === Basics.VISTA) {
    const soglia = Basics.USCITA[Basics.VISTA];
    const veloce = mediana !== null && mediana <= soglia.mediana;
    const percent = Math.min(100, Math.round((giuste / 17) * 100));
    return {
      percent: percent === 100 && !veloce ? 99 : percent,
      label: ultime.length
        ? `${giuste} giuste sulle ultime ${ultime.length}${mediana !== null ? `, mediana ${(mediana / 1000).toFixed(1)} s` : ''}`
        : 'Nessuna risposta ancora',
    };
  }

  const percent = Math.min(100, Math.round((giuste / 18) * 100));
  return {
    percent,
    label: ultime.length
      ? `${giuste} giuste sulle ultime ${ultime.length}`
      : 'Nessuna risposta ancora',
  };
}

function uscitaFinali(log) {
  const puliti = log.filter((e) => e.axis === Endgames.AXIS && e.correct).length;
  const soglia = Endgames.USCITA.puliti;
  return {
    percent: Math.min(100, Math.round((puliti / soglia) * 100)),
    label: puliti
      ? `${puliti} ${puliti === 1 ? 'finale portato a casa' : 'finali portati a casa'} su ${soglia}, senza mai perdere l’esito`
      : `Servono ${soglia} finali portati a casa senza mai perdere l’esito`,
  };
}

/**
 * L7 non ha una soglia: e' il regime di crociera. La barra mostra quante
 * posizioni delle proprie partite sono state rigiocate, che e' un conteggio e
 * non un avanzamento verso qualcosa.
 */
function uscitaPartite(log) {
  const fatte = log.filter((e) => e.axis === 'partite').length;
  const rette = log.filter((e) => e.axis === 'partite' && e.correct).length;
  return {
    percent: 0,
    senzaSoglia: true,
    label: fatte
      ? `${rette} posizioni su ${fatte} rigiocate senza perdere materiale`
      : 'Nessuna partita importata: si comincia incollando un PGN',
  };
}

function uscitaTattica(rating) {
  /*
   * La barra punta al punto in cui l'esame si supera una volta su due, non alla
   * soglia nominale: arrivare a 1400 di allenamento e trovarsi un esame che a
   * 1400 si supera il 3% delle volte e' esattamente il genere di numero che
   * questa app non stampa.
   */
  const da = Rating.START_RATING;
  const a = puntoMeta(1400);
  return {
    percent: Math.max(0, Math.min(100, Math.round(((rating - da) / (a - da)) * 100))),
    label: `punteggio di allenamento ${rating} di ${a}`,
  };
}

/* --------------------------- la sessione di oggi -------------------------- */

/**
 * La sessione di oggi, in numeri veri: quante carte scadute, quanto materiale
 * nuovo concede il tetto giornaliero, e quanto dura più o meno il tutto.
 *
 * `viste` sono le posizioni del corpus già diventate carte; il corpus
 * disponibile è **quello di allenamento**, cioè senza le posizioni d'esame:
 * dire «ne restano 3235» quando 247 non si vedranno mai in sessione sarebbe
 * uno dei numeri che questa app si è impegnata a non stampare.
 */
export function oggi({ due, introduced, settings, size, maxNew, viste = 0 }) {
  const totaleAllenabile = Esame.poolAllenamento(PUZZLES).length;
  const restanti = Math.max(0, totaleAllenabile - viste);
  const spazio = Math.max(0, settings.newPerDay - introduced);
  const nuove = Math.min(maxNew, spazio, Math.max(0, size - due), restanti);
  const ripassi = Math.min(due, size);
  const totale = ripassi + nuove;

  return {
    ripassi,
    nuove,
    totale,
    minuti: Math.max(1, Math.round((totale * 12) / 60)),
    tettoRaggiunto: spazio === 0,
    corpusFinito: restanti === 0,
    allenabili: totaleAllenabile,
  };
}

export { Ricostruzione, OPENINGS };
