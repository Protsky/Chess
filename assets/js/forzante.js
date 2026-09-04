/*
 * forzante.js — quanto si guadagna con le mosse che l'avversario non può ignorare.
 *
 * Solo catture e scacchi, fino a una profondità data. È il criterio che l'app
 * usa in due posti diversi e che deve dire la stessa cosa in tutti e due:
 *
 *   - per dichiarare **quieta** una posizione (`tools/build-quiete.mjs`): nessuna
 *     sequenza forzante guadagna due pedoni, per nessuno dei due colori;
 *   - per dichiarare **perdente** una mossa: in preparazione del corpus
 *     (`tools/trappole-mosse.mjs`) per sapere quali mosse perdono, e **a
 *     runtime** per giudicare la mossa che hai appena giocato nelle trappole.
 *
 * Sta fra i file dell'app, non fra gli strumenti, proprio per l'ultima riga: il
 * giudizio che vedi sullo schermo e il numero calcolato in preparazione devono
 * venire dallo stesso conto, o l'app direbbe due cose diverse sulla stessa mossa.
 *
 * Sono la stessa domanda vista dalle due parti, quindi stanno in un file solo:
 * due copie che divergono darebbero due verità diverse nella stessa app.
 *
 * Che cosa non è: una valutazione. Non sa di iniziativa né di struttura, e un
 * piano lento che vince un pedone in sei mosse non lo vede. L'app lo dichiara
 * dove usa questi numeri, invece di lasciarli passare per un giudizio.
 *
 * `tools/validate-nuovo.mjs` ne tiene apposta una copia sua: un controllo che
 * usa lo stesso codice che deve controllare non controlla niente.
 */

import { legalMoves, applyMove, inCheck } from './chess.js';
import { seeCattura } from './see.js';

/** Matto: vale più di qualunque conto in pedoni, e si tratta come tale. */
export const MATTO = 1000;

/**
 * Il massimo che chi è di turno può guadagnare con mosse forzanti, in pedoni.
 *
 * Il `migliore = 0` di partenza è la mossa nulla: chi muove può sempre non
 * forzare niente, ed è quello che rende il conto quello di un giocatore
 * prudente invece di una ricerca ottimista.
 */
export function guadagnoForzante(stato, profondita) {
  if (profondita <= 0) return 0;
  const mosse = legalMoves(stato);
  if (!mosse.length) return inCheck(stato, stato.turn) ? -MATTO : 0;

  let migliore = 0;
  for (const m of mosse) {
    const dopo = applyMove(stato, m);
    const scacco = inCheck(dopo, dopo.turn);
    if (!m.capture && !scacco) continue;
    if (scacco && legalMoves(dopo).length === 0) return MATTO;

    const preso = m.capture ? seeCattura(stato.board, m.from, m.to) : 0;
    const risposta = guadagnoForzante(dopo, profondita - 1);
    const netto = m.capture ? preso - Math.max(0, risposta) : -risposta;
    if (netto > migliore) migliore = netto;
  }
  return migliore;
}

/** Quanti pedoni fanno dire «questa mossa perde». */
export const SOGLIA = 2;

/** Semimosse forzanti esaminate: tre bastano per forchette e infilate semplici. */
export const PROFONDITA = 3;

/**
 * La mossa perde materiale?
 *
 * Due modi, e sono diversi: o è una cattura che il cambio statico dice già in
 * perdita (hai preso una cosa difesa), oppure lascia all'avversario una
 * sequenza forzante che guadagna. Il secondo è quello che prende le forchette
 * e i pezzi lasciati in presa, cioè il grosso di quello che succede sotto i
 * 1500.
 */
export function perdente(stato, mossa) {
  if (mossa.capture && seeCattura(stato.board, mossa.from, mossa.to) <= -SOGLIA) return true;
  const dopo = applyMove(stato, mossa);
  return guadagnoForzante(dopo, PROFONDITA) >= SOGLIA;
}

/** Tutte le mosse perdenti di una posizione, in notazione UCI. */
export function mossePerdenti(stato) {
  const out = [];
  for (const m of legalMoves(stato)) {
    if (perdente(stato, m)) out.push(m);
  }
  return out;
}
