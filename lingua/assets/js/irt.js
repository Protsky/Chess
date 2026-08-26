/*
 * irt.js — test di livello adattivo (CAT) su modello IRT a 2 parametri.
 *
 * Riferimenti: Lord, "Applications of Item Response Theory to Practical
 * Testing Problems" (1980); van der Linden & Glas, "Computerized Adaptive
 * Testing" (2000). Le soglie in θ sono ancorate ai livelli del QCER
 * (Council of Europe, 2001/2020).
 *
 * Come funziona:
 *   1. ogni item ha una difficoltà b (sulla stessa scala dell'abilità θ)
 *      e una discriminazione a (quanto separa chi sa da chi non sa);
 *   2. la probabilità di rispondere bene è  P(θ) = 1 / (1 + e^(-a(θ-b)));
 *   3. dopo ogni risposta θ si ristima con EAP (media della distribuzione
 *      a posteriori su una griglia, prior N(0,1)): stabile anche con
 *      pattern "tutte giuste" o "tutte sbagliate", dove la massima
 *      verosimiglianza divergerebbe;
 *   4. l'item successivo è quello che massimizza l'informazione di Fisher
 *      in θ, cioè quello di cui l'esito è meno prevedibile: è così che il
 *      test converge in ~15 domande invece di 60.
 */

/** Griglia di quadratura su cui si calcola la distribuzione a posteriori. */
const GRID = (() => {
  const pts = [];
  for (let x = -4; x <= 4.0001; x += 0.05) pts.push(Math.round(x * 1000) / 1000);
  return pts;
})();

const PRIOR_SD = 1;

/** Livelli QCER con il centro della loro banda in θ. */
export const CEFR = [
  { id: 'A1', center: -2.2, name: 'Contatto', blurb: 'frasi essenziali di uso quotidiano' },
  { id: 'A2', center: -1.3, name: 'Sopravvivenza', blurb: 'situazioni di routine e bisogni immediati' },
  { id: 'B1', center: -0.4, name: 'Soglia', blurb: 'esperienze, opinioni e progetti' },
  { id: 'B2', center: 0.5, name: 'Progresso', blurb: 'discorso articolato anche su temi astratti' },
  { id: 'C1', center: 1.4, name: 'Efficacia', blurb: 'uso flessibile, sfumature e registro' },
  { id: 'C2', center: 2.2, name: 'Padronanza', blurb: 'precisione idiomatica in ogni contesto' },
];

const CUTS = [-1.75, -0.85, 0.05, 0.95, 1.8];

/** Livello QCER corrispondente a un'abilità θ. */
export function toCefr(theta) {
  let i = 0;
  while (i < CUTS.length && theta >= CUTS[i]) i++;
  return CEFR[i].id;
}

/** Posizione (0..1) dentro la banda del livello: utile per la barra di avanzamento. */
export function bandProgress(theta) {
  const lo = -2.65;
  const hi = 2.65;
  let i = 0;
  while (i < CUTS.length && theta >= CUTS[i]) i++;
  const start = i === 0 ? lo : CUTS[i - 1];
  const end = i === CUTS.length ? hi : CUTS[i];
  return Math.min(1, Math.max(0, (theta - start) / (end - start)));
}

/** Probabilità di risposta corretta secondo il modello 2PL. */
export function p2pl(theta, a, b) {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

/** Informazione di Fisher dell'item in θ: I = a² P (1-P). */
export function itemInfo(theta, a, b) {
  const p = p2pl(theta, a, b);
  return a * a * p * (1 - p);
}

/**
 * Stima EAP di θ (media a posteriori) e relativo errore standard.
 * `responses`: [{ a, b, correct }]
 */
export function estimate(responses) {
  let num = 0;
  let den = 0;
  const post = new Array(GRID.length);

  for (let i = 0; i < GRID.length; i++) {
    const th = GRID[i];
    let lik = Math.exp(-(th * th) / (2 * PRIOR_SD * PRIOR_SD)); // prior N(0,1)
    for (const r of responses) {
      const p = p2pl(th, r.a, r.b);
      lik *= r.correct ? p : 1 - p;
    }
    post[i] = lik;
    num += th * lik;
    den += lik;
  }
  if (!(den > 0)) return { theta: 0, se: PRIOR_SD };

  const theta = num / den;
  let varSum = 0;
  for (let i = 0; i < GRID.length; i++) varSum += post[i] * (GRID[i] - theta) ** 2;
  return { theta, se: Math.sqrt(varSum / den) };
}

/**
 * Sceglie l'item successivo: massima informazione in θ, con un pizzico di
 * casualità fra i primi candidati (controllo dell'esposizione, così due test
 * di fila non fanno esattamente le stesse domande).
 */
export function pickNext(bank, askedIds, theta, random = Math.random) {
  const pool = bank.filter((it) => !askedIds.includes(it.id));
  if (!pool.length) return null;
  const scored = pool
    .map((it) => ({ it, info: itemInfo(theta, it.a, it.b) }))
    .sort((x, y) => y.info - x.info);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(random() * top.length)].it;
}

/** Regola di arresto: precisione sufficiente, o si è esaurito il budget di domande. */
export function shouldStop(responses, se, { min = 8, max = 16, target = 0.35 } = {}) {
  if (responses.length >= max) return true;
  if (responses.length < min) return false;
  return se <= target;
}

/** Percorso completo del test, per la schermata di riepilogo. */
export function summary(responses) {
  const { theta, se } = estimate(responses);
  const correct = responses.filter((r) => r.correct).length;
  return {
    theta,
    se,
    cefr: toCefr(theta),
    correct,
    total: responses.length,
    ci: [toCefr(theta - 1.96 * se), toCefr(theta + 1.96 * se)],
  };
}
