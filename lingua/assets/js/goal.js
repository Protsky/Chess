/*
 * goal.js — punti e obiettivo del giorno.
 *
 * Perché esistono, e cosa non fanno.
 *
 * Fissare un obiettivo esplicito e misurabile è una delle poche leve
 * motivazionali con basi solide (Locke & Latham, 2002: obiettivi specifici e
 * moderatamente difficili producono risultati migliori di "fai del tuo
 * meglio"). Punti e serie di giorni sono un'impalcatura più debole: aiutano
 * a presentarsi, non a imparare, e la letteratura sulla gamification è molto
 * meno univoca di quanto il marketing lasci credere. Qui stanno per questo, e
 * per niente di più.
 *
 * La regola che li tiene onesti: i punti si prendono per aver risposto, non
 * per aver risposto BENE. Premiare la risposta giusta spingerebbe a scegliere
 * gli esercizi facili e a evitare quelli che insegnano di più — cioè
 * esattamente il contrario di quello che serve. Chi sbaglia una carta difficile
 * ha lavorato quanto chi ne indovina una facile, e prende gli stessi punti.
 */

/** Punti per ogni carta portata a termine, giusta o sbagliata che sia. */
export const PER_CARD = 10;

/** Premio una tantum per aver svuotato i ripassi in scadenza del giorno. */
export const CLEARED_BONUS = 20;

/** Obiettivi proponibili, in punti: circa 6, 12, 20 e 30 carte. */
export const GOALS = [
  { xp: 60, label: 'Leggero', hint: 'sei carte, due minuti' },
  { xp: 120, label: 'Normale', hint: 'dodici carte, cinque minuti' },
  { xp: 200, label: 'Serio', hint: 'venti carte, otto minuti' },
  { xp: 300, label: 'Intenso', hint: 'trenta carte, un quarto d’ora' },
];

export const goalOf = (xp) => GOALS.find((g) => g.xp === xp) || GOALS[1];

/** Quanto manca all'obiettivo, fra 0 e 1. */
export const progress = (xp, goal) => Math.max(0, Math.min(1, xp / (goal || 1)));

/** Le carte che restano per arrivare all'obiettivo. */
export const cardsLeft = (xp, goal) => Math.max(0, Math.ceil((goal - xp) / PER_CARD));
