/*
 * calcolo.js — livello 4: la posizione si guarda, poi si spegne.
 *
 * Perché questo livello esiste, e perché non è un vezzo da esibizione: fra
 * grandi maestri, giocare senza vedere la scacchiera **non** aumenta gli errori
 * rispetto al gioco rapido (Chabris & Hearst 2003); è la fretta che li aumenta.
 * Il che vuol dire che tenere la posizione in testa non è un talento a parte,
 * è la stessa competenza del calcolo, misurata senza l'aiuto degli occhi.
 *
 * Come funziona un item: si vede la posizione per qualche secondo, poi i pezzi
 * spariscono. Le mosse si giocano sulla scacchiera vuota, e la risposta
 * dell'avversario arriva scritta, non disegnata. La scacchiera giudica: è la
 * stessa soluzione del corpus, e o si arriva in fondo o no.
 *
 * Il criterio d'uscita non è un punteggio ma un conto: **sequenze di quattro
 * semimosse, otto su dieci**. Un numero che si può contare sul registro, e che
 * non ha bisogno di essere convertito in niente.
 */

import { PUZZLES } from './puzzles.js';
import * as Esame from './esame.js';

export const AXIS = 'calcolo';
export const PREFIX = 'c:';

/** Le profondità della scala, in semimosse dell'intera linea. */
export const PROFONDITA = [2, 4, 6];

/** Il criterio d'uscita, come sta scritto nel percorso. */
export const USCITA = { semimosse: 4, giuste: 8, su: 10 };

/** Quanto resta accesa la posizione prima di spegnersi. */
export const SECONDI = { 2: 8, 4: 12, 6: 16 };

export const SESSION_SIZE = 10;

export const cardIdOf = (puzzle, profondita) => `${PREFIX}${profondita}:${puzzle.id}`;

/** Le posizioni la cui soluzione dura esattamente quelle semimosse. */
export function poolPer(profondita, pool = PUZZLES) {
  return Esame.poolAllenamento(pool).filter((p) => p.m.split(' ').length === profondita);
}

/**
 * A che profondità si sta lavorando: la più bassa che non sia ancora ferma.
 *
 * Si sale quando le ultime dieci a quella profondità sono andate almeno otto
 * volte su dieci — la stessa soglia dell'uscita, applicata a ogni gradino
 * invece che solo all'ultimo. Si scende se si scivola sotto la metà: insistere
 * a sei semimosse quando non se ne reggono quattro non allena niente.
 */
export function profonditaDi(log, { finestra = 10 } = {}) {
  let scelta = PROFONDITA[0];
  for (const p of PROFONDITA) {
    const recenti = log.filter((e) => e.axis === AXIS && e.semimosse === p).slice(-finestra);
    if (recenti.length < finestra) return p;
    const giuste = recenti.filter((e) => e.correct).length;
    if (giuste >= USCITA.giuste) scelta = PROFONDITA[Math.min(PROFONDITA.indexOf(p) + 1, PROFONDITA.length - 1)];
    else return giuste * 2 < finestra ? PROFONDITA[Math.max(PROFONDITA.indexOf(p) - 1, 0)] : p;
  }
  return scelta;
}

/**
 * Costruisce la sessione. Le posizioni si pescano attorno al punteggio
 * tattico — chi calcola alla cieca su una posizione che non saprebbe risolvere
 * a occhi aperti sta misurando la tattica, non la visualizzazione.
 */
export function costruisci({ log = [], rating = 1000, viste = new Set(), size = SESSION_SIZE, pool = PUZZLES } = {}) {
  const profondita = profonditaDi(log);
  const candidati = poolPer(profondita, pool)
    .filter((p) => !viste.has(cardIdOf(p, profondita)))
    .map((p) => ({ p, d: Math.abs(p.r - rating) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, size * 4)
    .map((x) => x.p);

  return Esame.mescolaMotivi(candidati).slice(0, size).map((puzzle) => ({
    puzzle,
    profondita,
    secondi: SECONDI[profondita] ?? 12,
    id: cardIdOf(puzzle, profondita),
  }));
}

/**
 * Quanto manca all'uscita, contato sul registro: le ultime dieci risposte alla
 * profondità richiesta dal criterio, non a una qualsiasi.
 */
export function uscita(log) {
  const recenti = log
    .filter((e) => e.axis === AXIS && e.semimosse >= USCITA.semimosse)
    .slice(-USCITA.su);
  const giuste = recenti.filter((e) => e.correct).length;
  return {
    percent: Math.min(100, Math.round((giuste / USCITA.giuste) * 100)),
    giuste,
    su: recenti.length,
    label: recenti.length
      ? `${giuste} su ${recenti.length} a ${USCITA.semimosse} semimosse · servono ${USCITA.giuste} su ${USCITA.su}`
      : `Servono ${USCITA.giuste} sequenze giuste su ${USCITA.su}, a ${USCITA.semimosse} semimosse`,
  };
}
