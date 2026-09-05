/*
 * calibrato.js — che cosa può entrare nella misura, e che cosa no.
 *
 * L'app misura la forza con un modello di Rasch: ogni item entra nella
 * verosimiglianza con la propria difficoltà. Il che vuol dire che un item
 * **senza** difficoltà misurata non può entrarci affatto — non «entra male»:
 * non ha proprio un posto dove stare, e dargliene uno significa inventargli un
 * numero.
 *
 * Finora la regola era scritta nei commenti e rispettata a mano. Basta una
 * distrazione per romperla, e c'è un caso in arrivo che la romperebbe di sicuro:
 * gli item ricavati dalle **proprie partite** (L7). Quelli sono pericolosi due
 * volte, e per ragioni indipendenti — quindi la barriera cade solo se cadono
 * tutte e due:
 *
 *  1. **Difficoltà ignota.** Nessuno li ha mai fatti risolvere a migliaia di
 *     persone, quindi non hanno un Glicko-2. Una difficoltà stimata da un
 *     modello non basta: i migliori modelli pubblicati sbagliano in media di
 *     ~250 punti, cioè quasi quanto la semibanda che l'esame deve discriminare.
 *  2. **Posizione già vissuta.** Vengono da partite che l'utente ha giocato:
 *     non sono «tenute fuori dall'allenamento», e non si possono spendere una
 *     volta sola perché sono già state spese al tavolo.
 *
 * Il secondo punto è quello che chiude la scappatoia futura «installo un motore
 * forte e li calibro a posteriori»: anche calibrati, resterebbero posizioni già
 * viste.
 *
 * E il danno che farebbero non è quello che verrebbe da pensare. Item scelti
 * perché *tu* li hai sbagliati sono sistematicamente difficili per te: non
 * abbassano solo la stima, **restringono l'intervallo** — perché ogni item in
 * più aggiunge informazione di Fisher. Siccome il criterio d'uscita è il limite
 * inferiore dell'intervallo, non corromperebbero la stima: corromperebbero il
 * test, che è peggio e si vede meno.
 */

/**
 * I prefissi degli item **generati in casa**: la difficoltà gliela abbiamo
 * assegnata noi (o non ce l'hanno affatto), quindi non misurano una forza.
 *
 *   b:  i fondamentali di L0 e L1, fabbricati dal motore
 *   c:  le sequenze alla cieca di L4 (l'item è puzzle × profondità)
 *   p:  i piani di L6
 *   r:  le ricostruzioni a cinque secondi
 *   x:  le trappole (la difficoltà è la probabilità d'errore di Maia, che è
 *       una previsione di comportamento, non una difficoltà misurata)
 *   g:  gli item dalle proprie partite (L7)
 *   q:  le posizioni quiete: il loro `r` è quello del puzzle da cui derivano,
 *       cioè la difficoltà di **un'altra** posizione. Indica una fascia, non
 *       misura questa.
 */
export const NON_CALIBRATI = ['b:', 'c:', 'p:', 'r:', 'x:', 'g:', 'q:'];

/** Il prefisso degli item che una difficoltà misurata ce l'hanno: il corpus. */
export const CALIBRATO = 't:';

/**
 * La deviazione massima del Glicko-2 di un puzzle perché la sua difficoltà
 * conti come «nota».
 *
 * Un puzzle risolto da poche persone ha un rating con una deviazione enorme:
 * il numero c'è, ma non è una misura. Lichess pubblica la RatingDeviation
 * proprio per questo.
 *
 * Per un po' il corpus non se la portava dietro, e questa soglia stava qui come
 * **debito dichiarato**: c'era scritta e non filtrava niente. Dal 05/09/2026 il
 * corpus ha il campo `rd` e la soglia funziona davvero — anche se in pratica
 * scarta poco, perché il generatore ammette solo posizioni con deviazione sotto
 * 90. È difesa in profondità: se un giorno quel filtro si allentasse a monte,
 * questa barriera resterebbe.
 */
export const RD_MAX = 100;

const senzaPrefisso = (id) => String(id ?? '');

/** L'identificativo appartiene a una famiglia generata in casa? */
export function generato(id) {
  const s = senzaPrefisso(id);
  return NON_CALIBRATI.some((p) => s.startsWith(p));
}

/**
 * Questa risposta può entrare nella misura della forza?
 *
 * Serve una difficoltà finita **e** che non venga da una famiglia generata.
 * Le due condizioni sono indipendenti di proposito: una difficoltà finita
 * attaccata a un item generato in casa è esattamente il caso che non si vuole
 * lasciar passare.
 */
export function misurabile(risposta) {
  if (!risposta || !Number.isFinite(risposta.d)) return false;
  if (risposta.id !== undefined && generato(risposta.id)) return false;
  if (Number.isFinite(risposta.rd) && risposta.rd > RD_MAX) return false;
  return true;
}

/**
 * Divide le risposte in quelle che misurano e quelle che non possono.
 *
 * Non filtra in silenzio: chi chiama riceve anche gli scarti, con il motivo, e
 * l'app li dichiara. Un filtro silenzioso è il modo in cui una regola smette di
 * esistere senza che nessuno se ne accorga.
 */
export function separa(risposte = []) {
  const dentro = [];
  const fuori = [];
  for (const r of risposte) {
    if (misurabile(r)) dentro.push(r);
    else fuori.push({ ...r, motivo: motivoDi(r) });
  }
  return { dentro, fuori };
}

function motivoDi(r) {
  if (!r) return 'risposta vuota';
  if (r.id !== undefined && generato(r.id)) return 'item generato in casa: la difficoltà non è misurata su tentativi umani';
  if (!Number.isFinite(r.d)) return 'nessuna difficoltà misurata';
  if (Number.isFinite(r.rd) && r.rd > RD_MAX) return `difficoltà troppo incerta (deviazione ${r.rd} sopra ${RD_MAX})`;
  return 'non misurabile';
}

/**
 * La stessa domanda per un item del corpus, prima ancora di rispondere.
 * Serve a `esame.js` per non comporre un esame con materiale che poi la
 * barriera respingerebbe.
 */
export function itemMisurabile(item) {
  if (!item || !Number.isFinite(item.r)) return false;
  if (generato(item.id)) return false;
  if (Number.isFinite(item.rd) && item.rd > RD_MAX) return false;
  return true;
}
