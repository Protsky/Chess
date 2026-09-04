/*
 * piani.js — livello 6: la linea, e perché.
 *
 * Il criterio d'uscita del livello delle aperture è sempre stato «la linea a
 * memoria **e** il piano nominato». La prima metà l'app la misurava (le stelle
 * dell'allenamento); la seconda no: il campo `plan` di ogni apertura era testo
 * che si legge nella schermata di studio, e nessuno tornava mai a chiedertelo.
 * Una cosa che si legge e non si richiama non è una cosa che si sa.
 *
 * Qui il piano diventa una domanda. Le alternative sbagliate non sono prese a
 * caso: si pescano fra le aperture della **stessa famiglia**, cioè fra
 * strutture di pedoni simili, perché è lì che si confondono davvero. Un
 * distrattore tratto da un'apertura lontana si scarta senza sapere niente, e
 * misurerebbe la capacità di escludere, non la conoscenza del piano.
 *
 * Non c'è autovalutazione: la risposta giusta è il piano che sta scritto per
 * quell'apertura, e o è quello o non lo è.
 */

import { OPENINGS, byId } from './openings.js';

export const AXIS = 'piani';
export const PREFIX = 'p:';

export const OPZIONI = 3;
export const SESSION_SIZE = 8;

export const cardIdOf = (id) => PREFIX + id;

/**
 * La prima frase del piano: quanto basta a riconoscerlo, non tanto da poterlo
 * distinguere per lunghezza invece che per contenuto.
 */
export function sintesi(testo) {
  const pulito = String(testo || '').replace(/\s+/g, ' ').trim();
  const punto = pulito.search(/\.\s/);
  const frase = punto > 40 ? pulito.slice(0, punto + 1) : pulito;
  return frase.length > 200 ? `${frase.slice(0, 197)}…` : frase;
}

/*
 * Un ordine deterministico che dipende dall'apertura: la stessa domanda
 * riproposta domani ha le stesse alternative nello stesso posto, così una
 * risposta giusta non può venire dall'aver notato che «la vera è la seconda».
 */
function hash(testo) {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Le alternative per un'apertura: prima quelle della stessa famiglia, poi
 * quelle dello stesso livello se la famiglia è piccola. Mai due piani identici.
 */
export function distrattori(opening, { n = OPZIONI - 1, pool = OPENINGS } = {}) {
  const suo = sintesi(opening.plan);
  const candidati = pool.filter((o) => o.id !== opening.id && sintesi(o.plan) !== suo);
  const stessaFamiglia = candidati.filter((o) => o.family === opening.family);
  const stessoLivello = candidati.filter((o) => o.family !== opening.family && o.level === opening.level);
  const resto = candidati.filter((o) => o.family !== opening.family && o.level !== opening.level);

  const ordina = (xs) => xs.slice().sort((a, b) => hash(`${opening.id}:${a.id}`) - hash(`${opening.id}:${b.id}`));
  return [...ordina(stessaFamiglia), ...ordina(stessoLivello), ...ordina(resto)].slice(0, n);
}

/** Un item: la posizione raggiunta dalla linea, e i piani fra cui scegliere. */
export function item(opening) {
  const alternative = distrattori(opening);
  const opzioni = [{ id: opening.id, testo: sintesi(opening.plan), giusta: true }]
    .concat(alternative.map((o) => ({ id: o.id, testo: sintesi(o.plan), giusta: false })))
    .sort((a, b) => hash(`${opening.id}|${a.id}`) - hash(`${opening.id}|${b.id}`));

  return {
    id: cardIdOf(opening.id),
    opening,
    line: opening.line,
    side: opening.side,
    opzioni,
    /* Da quante alternative si sceglie: serve a dire quanto vale una giusta. */
    fra: opzioni.length,
    stessaFamiglia: alternative.filter((o) => o.family === opening.family).length,
  };
}

/**
 * La sessione: solo aperture già portate a casa con la linea. Chiedere il piano
 * di una variante che non si sa ancora giocare misurerebbe due cose insieme.
 */
export function costruisci({ progressi = {}, size = SESSION_SIZE, minStelle = 2, pool = OPENINGS } = {}) {
  const pronte = pool.filter((o) => (progressi[o.id]?.stars || 0) >= minStelle);
  const scelte = (pronte.length ? pronte : pool)
    .slice()
    .sort((a, b) => (progressi[a.id]?.pianoAt || 0) - (progressi[b.id]?.pianoAt || 0));
  return scelte.slice(0, size).map(item);
}

/**
 * Quanto manca al criterio: la linea (stelle) **e** il piano, sulle aperture
 * per cui entrambe le cose sono state misurate. Un'apertura conta solo se il
 * piano è stato chiesto almeno una volta: prima di allora non si sa.
 */
export function uscita({ progressi = {}, pool = OPENINGS, minStelle = 3 } = {}) {
  const conLinea = pool.filter((o) => (progressi[o.id]?.stars || 0) >= minStelle);
  const conPiano = conLinea.filter((o) => progressi[o.id]?.pianoOk);
  const percent = pool.length ? Math.round((conPiano.length / pool.length) * 100) : 0;
  return {
    percent,
    linea: conLinea.length,
    piano: conPiano.length,
    totale: pool.length,
    label: `${conLinea.length} linee a memoria, ${conPiano.length} piani nominati su ${pool.length}`,
  };
}

export { byId };
