/*
 * see.js — che cosa costa davvero una mossa, contato invece che stimato.
 *
 * Finora, davanti a una mossa sbagliata, l'app diceva «Risolta con aiuto» e
 * mostrava la soluzione. È il feedback più debole che esista: dice *che* hai
 * sbagliato, non *che cosa succede* se giochi così. Nella meta-analisi di
 * Wisniewski, un feedback che spiega vale circa il doppio di uno che corregge
 * e basta; e nel livello 1 la ripresa che si guarda invece di leggerla era già
 * la cosa che funzionava meglio dell'app.
 *
 * Qui c'è il conto che permette di generalizzarla a tutti i livelli, senza
 * motore e senza rete: il **cambio statico** (static exchange evaluation).
 * Data una casa, si simula la sequenza di catture prendendo ogni volta il
 * pezzo attaccante di minor valore, e si vede chi ci guadagna. Ricalcolare gli
 * attaccanti dopo ogni cattura fa comparire da sole le batterie e i raggi X.
 *
 * Che cosa questo conto **non** è: una valutazione della posizione. Non sa di
 * iniziativa, non sa di struttura, non guarda oltre le catture su una casa. Per
 * questo l'app non lo chiama mai «valutazione» e non ne stampa mai un numero
 * come se fosse un giudizio: lo usa per le due sole cose che sa fare bene —
 * dire se un pezzo resta in presa, e trovare la mossa che punisce.
 */

import {
  legalMoves, applyMove, inCheck, colorOf, other, nameOf, toSan, attackersOf,
} from './chess.js';

/** In pedoni. Il re non ha prezzo: nella sequenza di cambi non viene mai preso. */
export const VALORE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

export const valoreDi = (pezzo) => (pezzo ? VALORE[pezzo.toUpperCase()] ?? 0 : 0);

export const NOME = { P: 'il pedone', N: 'il cavallo', B: 'l’alfiere', R: 'la torre', Q: 'la donna', K: 'il re' };

/**
 * Il guadagno di chi comincia la sequenza di catture sulla casa `casa`.
 *
 * Ricorsiva di proposito: a ogni passo chi è di turno può anche **rifiutare**
 * il cambio (il `max(0, …)`), che è precisamente ciò che rende il conto uguale
 * a quello che farebbe un giocatore prudente al tavolo.
 */
function sequenza(board, casa, di) {
  const attaccanti = attackersOf(board, casa, di);
  if (!attaccanti.length) return 0;

  let from = attaccanti[0];
  for (const a of attaccanti) if (valoreDi(board[a]) < valoreDi(board[from])) from = a;

  const preda = valoreDi(board[casa]);
  const dopo = board.slice();
  dopo[casa] = dopo[from];
  dopo[from] = null;

  return Math.max(0, preda - sequenza(dopo, casa, other(di)));
}

/**
 * Quanto guadagna, in pedoni, chi cattura da `from` a `to`. Negativo vuol dire
 * che il cambio perde: la classica cattura che «sembrava gratis».
 */
export function seeCattura(board, from, to) {
  const mio = colorOf(board[from]);
  if (!mio) return 0;
  const preda = valoreDi(board[to]);
  const dopo = board.slice();
  dopo[to] = dopo[from];
  dopo[from] = null;
  return preda - sequenza(dopo, to, other(mio));
}

/**
 * I pezzi di `colore` che l'avversario può prendere guadagnandoci: la
 * definizione operativa di «in presa», calcolata e non a occhio.
 */
export function pendenti(state, colore) {
  const nemico = other(colore);

  /*
   * Si guardano le catture **legali**, non chi tocca la casa.
   *
   * La prima versione contava gli attaccanti con `attackersOf`, che è la
   * geometria pura: un pezzo inchiodato risultava un attaccante, e un pezzo
   * «in presa» da un attaccante inchiodato non è in presa. Sul corpus la
   * differenza c'era, e si vedeva: nove posizioni su ottocento in cui l'app
   * avrebbe detto «resta in presa» senza che nessuno potesse prenderlo.
   *
   * Quando tocca all'altro colore si passa il turno per chiedere «e adesso lui
   * che cosa prende»: è la mossa nulla, e qui serve esattamente a questo.
   */
  const daMuovere = state.turn === nemico ? state : { ...state, turn: nemico };
  if (inCheck(daMuovere, nemico)) return [];

  const out = new Map();
  for (const m of legalMoves(daMuovere)) {
    if (!m.capture) continue;
    const preda = state.board[m.to];
    if (!preda || colorOf(preda) !== colore) continue;   // presa al varco: non è il pezzo su quella casa
    const guadagno = seeCattura(state.board, m.from, m.to);
    if (guadagno <= 0) continue;
    const prima = out.get(m.to);
    if (!prima || guadagno > prima.perdita) out.set(m.to, { casa: m.to, pezzo: preda, perdita: guadagno });
  }
  return [...out.values()].sort((a, b) => b.perdita - a.perdita);
}

/** Matto in una per chi è di turno? Torna la mossa, o null. */
export function mattoInUno(state) {
  for (const m of legalMoves(state)) {
    const dopo = applyMove(state, m);
    if (inCheck(dopo, dopo.turn) && legalMoves(dopo).length === 0) return m;
  }
  return null;
}

/**
 * La confutazione: che cosa fa l'avversario, adesso, per punire.
 *
 * Nell'ordine in cui punisce davvero — prima il matto, poi la cattura che
 * guadagna di più, poi lo scacco che guadagna un pezzo. Se non trova niente
 * torna null, e allora la mossa era sbagliata per un'altra ragione: lo si dice,
 * invece di inventare una punizione che non c'è.
 */
export function confutazione(state) {
  const matto = mattoInUno(state);
  if (matto) return { move: matto, tipo: 'matto', guadagno: Infinity };

  let migliore = null;
  for (const m of legalMoves(state)) {
    if (!m.capture) continue;
    const guadagno = seeCattura(state.board, m.from, m.to);
    if (guadagno > 0 && (!migliore || guadagno > migliore.guadagno)) {
      migliore = { move: m, tipo: 'cattura', guadagno };
    }
  }
  if (migliore) return migliore;

  /* Nessuna cattura conviene: resta lo scacco che porta a prendere qualcosa. */
  for (const m of legalMoves(state)) {
    const dopo = applyMove(state, m);
    if (!inCheck(dopo, dopo.turn)) continue;
    const in_presa = pendenti(dopo, dopo.turn);
    if (in_presa.length && in_presa[0].perdita >= 3) {
      return { move: m, tipo: 'scacco', guadagno: in_presa[0].perdita, poi: in_presa[0] };
    }
  }
  return null;
}

/**
 * Perché la mossa era sbagliata, in una delle categorie che si possono
 * dimostrare. Non è una diagnosi di stile: ogni etichetta corrisponde a un
 * conto che questo file sa fare.
 */
export function classifica(prima, mossa, { soluzione = [], indice = 0 } = {}) {
  const dopo = applyMove(prima, mossa);
  const mio = colorOf(mossa.piece);

  if (mattoInUno(dopo)) return { tipo: 'matto', testo: 'dopo questa mossa c’è matto in una.' };

  const perde = seeCattura(prima.board, mossa.from, mossa.to);
  if (mossa.capture && perde < 0) {
    return {
      tipo: 'cambio',
      perdita: -perde,
      testo: `la cattura non è gratis: il cambio che ne segue perde ${pedoni(-perde)}.`,
    };
  }

  const in_presa = pendenti(dopo, mio);
  const prima_in_presa = pendenti(prima, mio).reduce((s, x) => s + x.perdita, 0);
  const adesso = in_presa.reduce((s, x) => s + x.perdita, 0);
  if (in_presa.length && adesso > prima_in_presa) {
    const peggio = in_presa[0];
    return {
      tipo: 'regala',
      casa: peggio.casa,
      perdita: peggio.perdita,
      testo: `${NOME[peggio.pezzo.toUpperCase()]} in ${nameOf(peggio.casa)} resta in presa: ${pedoni(peggio.perdita)}.`,
    };
  }

  /*
   * L'idea giusta al momento sbagliato: la mossa giocata compare più avanti
   * nella soluzione. È un errore diverso dagli altri — la posizione l'hai
   * letta, l'ordine no — e dirlo cambia che cosa c'è da correggere.
   */
  const uci = `${nameOf(mossa.from)}${nameOf(mossa.to)}`;
  const dopoDiQui = soluzione.slice(indice + 1).filter((_, i) => i % 2 === 0);
  if (dopoDiQui.some((m) => m.slice(0, 4) === uci)) {
    return { tipo: 'ordine', testo: 'la mossa è giusta, ma non adesso: prima ne va giocata un’altra.' };
  }

  return { tipo: 'altro', testo: 'non perde materiale subito, ma la soluzione è un’altra.' };
}

const pedoni = (n) => (n === 1 ? 'un pedone' : `${Math.round(n * 10) / 10} pedoni`);

/** La confutazione in italiano leggibile, per il momento in cui la si mostra. */
export function testoConfutazione(state, conf) {
  if (!conf) return null;
  const san = toSan(state, conf.move);
  if (conf.tipo === 'matto') return `Il Nero non aspetta altro: ${san} è matto.`;
  if (conf.tipo === 'cattura') return `Segue ${san}, e sono ${pedoni(conf.guadagno)}.`;
  return `Segue ${san}, e poi cade ${nameOf(conf.poi.casa)}.`;
}
