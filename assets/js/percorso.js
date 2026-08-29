/*
 * percorso.js — gli otto livelli, e che cosa si fa oggi.
 *
 * Due cose che l'app deve saper dire appena si apre, e che finora non diceva:
 *
 *  1. **Dove sei.** Il percorso non è un elenco di modalità: è una scala con un
 *     criterio d'uscita misurato per ogni gradino. Chi apre l'app deve vedere
 *     su quale gradino sta, e quanto gli manca.
 *  2. **Che cosa fai adesso.** Non «scegli una modalità»: una sessione sola,
 *     già composta, con dentro le scadenze di oggi e il materiale nuovo che il
 *     tetto giornaliero concede.
 *
 * I livelli non ancora costruiti stanno qui lo stesso, marcati `in-arrivo`.
 * Mostrare un percorso monco è meglio che nasconderlo: chi studia deve sapere
 * dove porta la strada, e anche dove la strada per ora finisce.
 * Il piano per esteso, con le fonti, sta in ROADMAP.md.
 */

import { PUZZLES } from './puzzles.js';
import * as Rating from './rating.js';

export const LIVELLI = [
  {
    code: 'L0',
    name: 'Vista della scacchiera',
    line: 'Colore di una casa, salti del cavallo, chi attacca cosa. Da automatizzare.',
    exit: '18 risposte giuste su 20, mediana sotto i 3 secondi',
    state: 'in-arrivo',
  },
  {
    code: 'L1',
    name: 'Non regalare pezzi',
    line: 'Che cosa resta in presa dopo la tua mossa. Il livello che rende di più a chi comincia.',
    exit: 'punteggio 800 e non più di un errore su 20 controlli di sicurezza',
    state: 'in-arrivo',
  },
  {
    code: 'L2',
    name: 'I finali che si vincono a memoria',
    line: 'Re e Donna, Re e Torre, opposizione, quadrato del pedone, Lucena, Philidor.',
    exit: 'le sei tecniche portate a casa senza mai perdere l’esito',
    state: 'in-arrivo',
  },
  {
    code: 'L3',
    name: 'I motivi tattici, mescolati',
    line: 'Trova la mossa: dodici motivi che non si annunciano mai prima.',
    exit: 'punteggio 1400 stabile, nessun motivo sotto il 60%',
    state: 'attivo',
    hash: '#/tattica',
    action: 'Allenati',
  },
  {
    code: 'L4',
    name: 'Calcolo e visualizzazione',
    line: 'Mosse candidate, sequenze fino in fondo, posizioni tenute a mente.',
    exit: 'sequenze di 4 semimosse alla cieca, 8 su 10',
    state: 'in-arrivo',
  },
  {
    code: 'L5',
    name: 'Posizione e piani',
    line: 'Colonne, avamposti, pedoni deboli, il pezzo peggiore. Scegliere fra mosse tutte plausibili.',
    exit: '70% sugli item posizionali del proprio livello',
    state: 'in-arrivo',
  },
  {
    code: 'L6',
    name: 'Le aperture',
    line: '33 varianti con idea, piano e commenti: la linea, e perché.',
    exit: 'la linea a memoria e il piano nominato',
    state: 'attivo',
    hash: '#/aperture',
    action: 'Studia',
  },
  {
    code: 'L7',
    name: 'Le proprie partite',
    line: 'Importi il PGN, l’app trova i tuoi crolli e li trasforma in carte.',
    exit: 'nessuna: è il regime di crociera',
    state: 'in-arrivo',
  },
];

/** Il livello su cui si sta lavorando: il primo attivo non ancora superato. */
export function livelloCorrente(avanzamenti) {
  const attivi = LIVELLI.filter((l) => l.state === 'attivo');
  return attivi.find((l) => (avanzamenti[l.code]?.percent ?? 0) < 100) || attivi[attivi.length - 1];
}

/**
 * Avanzamento dei livelli che esistono davvero, calcolato sui dati veri.
 * Per quelli non costruiti non si restituisce niente: una barra al 12% su un
 * livello che non si può allenare sarebbe un numero inventato.
 */
export function avanzamenti({ rating, aperture }) {
  const out = {};

  // L3: dal punteggio di partenza alla soglia d'uscita.
  const da = Rating.START_RATING;
  const a = 1400;
  out.L3 = {
    percent: Math.max(0, Math.min(100, Math.round(((rating - da) / (a - da)) * 100))),
    label: `punteggio ${rating} di ${a}`,
  };

  // L6: le stelle delle aperture, che è la misura che quel livello ha già.
  out.L6 = {
    percent: aperture.percent,
    label: `${aperture.stars} stelle su ${aperture.max}`,
  };

  return out;
}

/**
 * La sessione di oggi, in numeri veri: quante carte scadute, quanto materiale
 * nuovo concede il tetto giornaliero, e quanto dura più o meno il tutto.
 *
 *   due:        carte tattiche scadute adesso
 *   introduced: posizioni nuove già introdotte oggi
 *   viste:      quante posizioni del corpus sono già diventate carte
 */
export function oggi({ due, introduced, settings, size, maxNew, viste = 0 }) {
  const restanti = Math.max(0, PUZZLES.length - viste);
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
  };
}
