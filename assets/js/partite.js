/*
 * partite.js — livello 7: il materiale nelle tue partite.
 *
 * Il nome è la prima cosa importante di questo file, e non è un dettaglio di
 * stile. Il piano diceva «le proprie partite: l'app trova i tuoi crolli e li
 * trasforma in carte». Ma a runtime l'app ha un solo motore, quello di casa:
 * sa contare i cambi su una casa e cercare le sequenze forzanti a tre
 * semimosse. Vede le sviste di materiale e i matti brevi. **Non vede** un piano
 * sbagliato, una struttura di pedoni rovinata, un'iniziativa regalata, un
 * finale a cinque pezzi giocato male.
 *
 * Un rilevatore incompleto vale come **veto**, mai come affermazione. Può dire
 * «qui hai perso un pezzo» e avere ragione; non può dire «qui hai giocato
 * bene», e nemmeno «nelle tue ultime dieci partite non c'erano errori». Per
 * questo il livello si chiama *Materiale nelle tue partite*: dice quello che
 * misura, e quello che non misura sta scritto nella stessa schermata.
 *
 * Nessun item di qui entra mai nella misura della forza: `calibrato.js` li
 * respinge per due ragioni indipendenti — non hanno una difficoltà misurata, e
 * sono posizioni che hai già vissuto al tavolo, quindi non sono «tenute fuori
 * dall'allenamento» e non si possono spendere una volta sola.
 */

import { applyMove, legalMoves, nameOf, toSan } from './chess.js';
import { perdente, guadagnoForzante, SOGLIA, PROFONDITA } from './forzante.js';
import { seeCattura, pendenti, mattoInUno } from './see.js';

export const AXIS = 'partite';
export const PREFIX = 'g:';

export const SESSION_SIZE = 10;

export const cardIdOf = (id) => PREFIX + id;

/**
 * Le categorie che il motore di casa sa decidere. Sono quattro, e l'app le
 * elenca all'utente esattamente così: quello che sta fuori da questo elenco è
 * fuori anche dalla misura.
 */
export const TROVA = [
  'un pezzo lasciato in presa (cambio statico negativo)',
  'una cattura che perde il cambio',
  'una sequenza forzante dell’avversario che guadagna materiale entro tre semimosse',
  'un matto in una concesso, o un matto in una mancato',
];

export const NON_TROVA = [
  'errori di piano e di struttura dei pedoni',
  'iniziativa e compenso posizionale',
  'finali oltre i tre pezzi, dove l’app non ha la tavola',
  'imprecisioni d’apertura che non perdono materiale',
  'qualunque errore che non si veda entro tre semimosse forzanti',
];

/**
 * Che cosa è successo a questa semimossa, dal punto di vista del materiale.
 *
 * Torna null quando non c'è niente da dire — che non vuol dire «andava bene»,
 * vuol dire «questo rilevatore non ha niente da dire». La differenza è tutto il
 * senso del file.
 */
export function esamina(passo) {
  const { stato, mossa } = passo;
  const mosse = legalMoves(stato);

  /* Con una mossa sola non c'è stata nessuna scelta: non è un errore. */
  if (mosse.length < 2) return null;

  const haPerso = perdente(stato, mossa);

  /* Il matto mancato: c'era, e non l'hai giocato. */
  const matto = mattoInUno(stato);
  const eraMatto = matto && matto.from === mossa.from && matto.to === mossa.to;
  if (matto && !eraMatto) {
    return {
      tipo: 'matto-mancato',
      testo: 'c’era matto in una, e la partita è continuata.',
      alternative: mosse.filter((m) => !perdente(stato, m)),
    };
  }

  if (!haPerso) return null;

  /*
   * Perde. Ma serve che ci fosse un'alternativa che non perdeva: in una
   * posizione dove tutte le mosse perdono, l'errore era prima — e prendersela
   * con questa semimossa sarebbe falso.
   */
  const reggono = mosse.filter((m) => !perdente(stato, m));
  if (!reggono.length) return null;

  const dopo = applyMove(stato, mossa);
  const quanto = guadagnoForzante(dopo, PROFONDITA);
  const inPresa = pendenti(dopo, stato.turn);
  const cattura = mossa.capture ? seeCattura(stato.board, mossa.from, mossa.to) : 0;

  let tipo = 'forzante';
  let testo = `dopo questa mossa l’avversario guadagna ${pedoni(quanto)} con una sequenza forzante.`;
  if (mossa.capture && cattura <= -SOGLIA) {
    tipo = 'cambio';
    testo = `la cattura perde il cambio: ${pedoni(-cattura)}.`;
  } else if (inPresa.length) {
    tipo = 'in-presa';
    testo = `resta in presa ${nameOf(inPresa[0].casa)}: ${pedoni(inPresa[0].perdita)}.`;
  }

  return { tipo, testo, perdita: quanto, alternative: reggono };
}

const pedoni = (n) => {
  if (n >= 1000) return 'il matto';
  const v = Math.round(n * 10) / 10;
  return v === 1 ? 'un pedone' : `${v} pedoni`;
};

/**
 * Passa in rassegna le partite lette e ne ricava gli item.
 *
 * `colore` dice quali semimosse sono tue: si guardano solo quelle, perché gli
 * errori dell'avversario non sono materiale di studio per te.
 */
export function estrai(partite, { nome = null, max = 200 } = {}) {
  const items = [];
  let semimosseTue = 0;
  let semimosseTotali = 0;
  let conScelta = 0;

  for (const p of partite) {
    const mio = nome
      ? ((p.tag.White || '').trim() === nome ? 'w' : ((p.tag.Black || '').trim() === nome ? 'b' : null))
      : 'w';
    if (!mio) continue;

    p.passi.forEach((passo, i) => {
      semimosseTotali += 1;
      if (passo.turno !== mio) return;
      semimosseTue += 1;
      if (legalMoves(passo.stato).length >= 2) conScelta += 1;

      const esito = esamina(passo);
      if (!esito) return;
      if (items.length >= max) return;

      items.push({
        id: `${p.tag.Site || p.tag.Event || 'partita'}-${i}`.replace(/[^\w-]/g, '').slice(-40) || `p${items.length}`,
        stato: passo.stato,
        mossaGiocata: passo.mossa,
        san: passo.san,
        semimossa: i + 1,
        mossa: Math.floor(i / 2) + 1,
        colore: mio,
        tag: p.tag,
        ...esito,
      });
    });
  }

  return {
    items,
    semimosseTue,
    semimosseTotali,
    conScelta,
    /*
     * La copertura: quante delle tue semimosse questo rilevatore era in grado
     * di giudicare. È una frazione dei **tuoi** dati, non una statistica presa
     * altrove — e non dice che le altre andassero bene.
     */
    copertura: semimosseTue ? conScelta / semimosseTue : 0,
  };
}

/** Sotto questo numero di partite non si mostra nessuna frazione: sarebbe rumore. */
export const MIN_PARTITE = 5;

/**
 * La sessione: gli item più costosi prima, perché sono quelli in cui c'è più da
 * guadagnare. A parità di perdita, i più recenti.
 */
export function costruisci(items, { size = SESSION_SIZE, viste = new Set() } = {}) {
  return items
    .filter((x) => !viste.has(cardIdOf(x.id)))
    .sort((a, b) => (b.perdita ?? 0) - (a.perdita ?? 0) || b.semimossa - a.semimossa)
    .slice(0, size);
}

export { toSan };
