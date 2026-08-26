/*
 * exercises.js — costruisce l'esercizio di ogni carta.
 *
 * Regola che tiene insieme tutto il file: nessun esercizio può essere
 * corretto da chi studia. Se la risposta non è verificabile dalla macchina,
 * l'esercizio non va bene.
 *
 * Il motivo è documentato: dopo aver visto la soluzione, riconoscerla viene
 * scambiato per ricordarla (Koriat & Bjork 2005, "illusion of competence"),
 * e chi si autocorregge si dà ragione più spesso di quanto dovrebbe
 * (Dunlosky & Rawson 2012). Il voto che arriva a FSRS deve essere un dato,
 * non un'opinione.
 *
 * La scala dei quattro passaggi va dal riconoscere al produrre, che è
 * l'ordine in cui si impara davvero (Nation 2001), e ogni gradino chiede di
 * generare qualcosa in più del precedente (effetto generazione: Slamecka &
 * Graf 1978). I buchi del cloze aumentano man mano che la frase si consolida:
 * è il fading dell'impalcatura di Renkl & Atkinson (2003), l'aiuto si ritira
 * mentre la memoria regge da sola.
 */

import { levelIndex } from './corpus.js';

/* ------------------------- casualità ripetibile ------------------------- */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Generatore deterministico: la stessa carta dà sempre lo stesso esercizio. */
export function seeded(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rnd) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pickSome = (pool, n, rnd) => shuffle(pool, rnd).slice(0, n);

/** Frasi vicine per livello: distrattori plausibili, non assurdi. */
function neighbours(lang, sentence, rnd, limit = 24) {
  const target = levelIndex(sentence.lv);
  const pool = lang.sentences.filter((s) => s.id !== sentence.id);
  const near = pool.filter((s) => Math.abs(levelIndex(s.lv) - target) <= 1);
  return pickSome(near.length >= limit ? near : pool, limit, rnd);
}

/* ------------------------ 1. riconosci il senso ------------------------- */

/**
 * Quattro possibilità, una giusta. Sostituisce il vecchio "mostra e dimmi se
 * l'avevi indovinata": qui la risposta è un dato.
 *
 * Il verso conta. Chi punta a capire vede la frase e sceglie fra quattro
 * traduzioni; chi punta a parlare vede l'italiano e sceglie fra quattro frasi
 * nella lingua che studia — stesso esercizio, ma nella direzione in cui poi
 * dovrà usarla.
 */
export function buildChoice(sentence, lang, seed, direction = 'understand') {
  const rnd = seeded(`${seed}|choice`);
  const pick = direction === 'produce' ? (s) => s.text : (s) => s.it;
  const answer = pick(sentence);
  const used = new Set([answer]);
  const wrong = [];
  for (const s of neighbours(lang, sentence, rnd, 40)) {
    if (wrong.length === 3) break;
    const option = pick(s);
    if (used.has(option)) continue;
    used.add(option);
    wrong.push(option);
  }
  const options = shuffle([answer, ...wrong], rnd);
  return { options, correct: options.indexOf(answer), reversed: direction === 'produce' };
}

/* --------------------------- 2. componi ---------------------------------- */

const words = (text) => text.split(/\s+/).filter(Boolean);

/**
 * Tessere da rimettere in fila, più due parole di troppo. Sull'ordine delle
 * parole si gioca metà del tedesco, e toccare le tessere non richiede la
 * tastiera: meno carico estraneo, più attenzione alla struttura.
 */
export function buildTiles(sentence, lang, seed) {
  const rnd = seeded(`${seed}|tiles`);
  const answer = words(sentence.text);
  const own = new Set(answer.map((w) => w.toLowerCase()));
  const extras = [];
  for (const s of neighbours(lang, sentence, rnd, 40)) {
    if (extras.length === 2) break;
    const candidate = words(s.text).find((w) => w.length > 1 && !own.has(w.toLowerCase()));
    if (!candidate) continue;
    own.add(candidate.toLowerCase());
    extras.push(candidate);
  }
  return { answer, tiles: shuffle([...answer, ...extras], rnd), extras: extras.length };
}

/* ------------------------ 3. completa i buchi ---------------------------- */

/** Quanti buchi merita questa carta: uno all'inizio, fino a metà frase poi. */
export function blankCount(total, stability = 0, reps = 0) {
  if (reps < 1 || stability < 3) return 1;
  if (stability < 15) return Math.min(2, total);
  if (stability < 45) return Math.max(2, Math.round(total * 0.35));
  return Math.max(3, Math.round(total * 0.5));
}

/**
 * Il primo buco cade sempre sulla chiave grammaticale. Gli altri vanno dove
 * servono davvero: prima sulle parole che TU hai già sbagliato su questa carta
 * (la carta se le ricorda), poi sulle parole piene, dalla più lunga alla più
 * corta, così restano in piedi gli articoli e la frase resta leggibile.
 *
 * Mettere la difficoltà dove l'errore è già avvenuto è il modo più diretto di
 * applicare il principio delle difficoltà desiderabili: non serve rendere
 * difficile tutto, serve rendere difficile il punto che cede.
 */
export function buildCloze(sentence, card, seed) {
  const all = words(sentence.text);
  const keyWords = words(sentence.key);
  const start = all.findIndex((_, i) =>
    keyWords.every((k, j) => (all[i + j] || '').includes(k) || k.includes(all[i + j] || '')));
  const keyIdx = start >= 0
    ? keyWords.map((_, j) => start + j)
    : [all.findIndex((w) => w.includes(keyWords[0])) || 0];

  const hidden = new Set(keyIdx.filter((i) => i >= 0));
  const wanted = blankCount(all.length, card.s, card.reps);
  const missed = card.miss || {};
  const rest = all
    .map((w, i) => ({ w, i, missed: missed[w] || 0 }))
    .filter(({ i }) => !hidden.has(i))
    .sort((a, b) => b.missed - a.missed || b.w.length - a.w.length || a.i - b.i);
  for (const { i } of rest) {
    if (hidden.size >= wanted + keyIdx.length - 1) break;
    hidden.add(i);
  }

  // parti in ordine, con i buchi contigui raggruppati in uno solo
  const parts = [];
  let run = null;
  all.forEach((w, i) => {
    if (hidden.has(i)) {
      if (!run) { run = { blank: true, answer: [w] }; parts.push(run); }
      else run.answer.push(w);
    } else {
      run = null;
      parts.push({ blank: false, text: w });
    }
  });
  parts.forEach((p) => { if (p.blank) p.answer = p.answer.join(' '); });

  return {
    parts,
    blanks: parts.filter((p) => p.blank).length,
    hidden: hidden.size,
    total: all.length,
  };
}

/* --------------------------- voto automatico ----------------------------- */

/**
 * Dal risultato oggettivo al voto di FSRS. Nessuna via di mezzo:
 *   tutto giusto        → Bene
 *   parole giuste, forma sbagliata → Difficile
 *   manca qualcosa      → Di nuovo
 * "Facile" resta un'aggiunta manuale: nessuna macchina può sapere che una
 * risposta ti è venuta senza pensarci.
 */
export function autoGrade(result) {
  if (result.correct) return 3;
  if (result.score >= 0.999 && !result.extra) return 2;
  return 1;
}
