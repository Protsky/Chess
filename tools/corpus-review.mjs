/*
 * corpus-review.mjs — rivedere il corpus prima di allargarlo.
 *
 *   node tools/corpus-review.mjs           tutte le lingue
 *   node tools/corpus-review.mjs de ru     solo queste
 *
 * Serve a rispondere a una domanda sola: le frasi che ci sono servono davvero
 * a chi vive la giornata in quella lingua? Un corpus può essere corretto e
 * inutile — pieno di frasi giuste che nessuno dice mai. Qui si guardano
 * cinque cose:
 *
 *  1. la forma della piramide: quante frasi per livello (in basso servono di
 *     più, non di meno: è lì che si passa il tempo);
 *  2. la lunghezza: ad A1 una frase lunga non è difficile, è sbagliata;
 *  3. le situazioni quotidiane coperte, contro un elenco esplicito;
 *  4. i doppioni, cioè due frasi che insegnano la stessa cosa;
 *  5. i punti grammaticali con un solo esempio, che si imparano a memoria
 *     invece che come regola.
 *
 * L'elenco delle situazioni sta in `situations.mjs`, in chiaro: il
 * riconoscimento è grezzo — parole chiave sulla traduzione italiana — e non è
 * una misura, è una lente per vedere i buchi. Le frasi che non entrano in
 * nessuna situazione vengono stampate: spesso sono proprio quelle da rivedere.
 */

import { LANGS, LEVELS, DOMAINS } from '../lingua/assets/js/corpus.js';
import { SITUATIONS, words, overlap } from './situations.mjs';

const pad = (s, n) => String(s).padEnd(n);
const bar = (n, max, width = 22) => '█'.repeat(Math.round((n / Math.max(max, 1)) * width));

const wanted = process.argv.slice(2);
const langs = wanted.length ? LANGS.filter((l) => wanted.includes(l.code)) : LANGS;

for (const lang of langs) {
  console.log(`\n${'═'.repeat(64)}\n${lang.flag} ${lang.name} — ${lang.sentences.length} frasi\n${'═'.repeat(64)}`);

  // 1. la piramide
  const perLevel = LEVELS.map((lv) => ({ lv, n: lang.sentences.filter((s) => s.lv === lv).length }));
  const max = Math.max(...perLevel.map((r) => r.n));
  console.log('\n▸ Frasi per livello');
  for (const r of perLevel) console.log(`  ${pad(r.lv, 3)} ${pad(r.n, 4)} ${bar(r.n, max)}`);
  const base = perLevel[0].n + perLevel[1].n;
  const share = Math.round((base / lang.sentences.length) * 100);
  console.log(`  A1+A2 = ${base} frasi, il ${share}% del corpus${share < 45 ? '  ← la base è magra' : ''}`);

  // 2. la lunghezza
  console.log('\n▸ Parole per frase');
  for (const lv of LEVELS) {
    const rows = lang.sentences.filter((s) => s.lv === lv);
    if (!rows.length) continue;
    const w = rows.map((s) => words(s.text)).sort((a, b) => a - b);
    const med = w[Math.floor(w.length / 2)];
    const long = rows.filter((s) => words(s.text) > (lv === 'A1' ? 6 : lv === 'A2' ? 8 : 12));
    console.log(`  ${pad(lv, 3)} mediana ${pad(med, 3)} max ${pad(w[w.length - 1], 3)}${long.length ? `  ← ${long.length} sopra la soglia: ${long.slice(0, 3).map((s) => s.text).join(' · ')}` : ''}`);
  }

  // 3. le situazioni quotidiane
  console.log('\n▸ Situazioni quotidiane (solo A1 e A2, dove si vive la giornata)');
  const easy = lang.sentences.filter((s) => s.lv === 'A1' || s.lv === 'A2');
  const covered = new Map();
  const orphans = [];
  for (const s of easy) {
    const hits = SITUATIONS.filter(([, re]) => re.test(s.it)).map(([name]) => name);
    if (!hits.length) orphans.push(s);
    for (const name of hits) covered.set(name, (covered.get(name) || 0) + 1);
  }
  const missing = SITUATIONS.filter(([name]) => !covered.has(name)).map(([name]) => name);
  const thin = SITUATIONS.filter(([name]) => covered.get(name) === 1).map(([name]) => name);
  console.log(`  coperte ${covered.size}/${SITUATIONS.length}`);
  if (missing.length) console.log(`  MAI toccate: ${missing.join(', ')}`);
  if (thin.length) console.log(`  con un solo esempio: ${thin.join(', ')}`);
  if (orphans.length) console.log(`  fuori da ogni situazione (${orphans.length}): ${orphans.slice(0, 8).map((s) => s.it).join(' · ')}`);

  // 4. i doppioni
  console.log('\n▸ Frasi troppo vicine');
  const close = [];
  for (let i = 0; i < lang.sentences.length; i++) {
    for (let j = i + 1; j < lang.sentences.length; j++) {
      const o = overlap(lang.sentences[i].it, lang.sentences[j].it);
      if (o >= 0.8) close.push([lang.sentences[i], lang.sentences[j], o]);
    }
  }
  if (!close.length) console.log('  nessuna');
  for (const [a, b, o] of close.slice(0, 10)) console.log(`  ${Math.round(o * 100)}%  ${a.id} "${a.it}"  ≈  ${b.id} "${b.it}"`);

  // 5. la grammatica con un esempio solo
  console.log('\n▸ Punti grammaticali con un solo esempio');
  const gram = new Map();
  for (const s of lang.sentences) gram.set(s.g, (gram.get(s.g) || 0) + 1);
  const singles = lang.grammar.filter((g) => gram.get(g) === 1);
  const never = lang.grammar.filter((g) => !gram.has(g));
  console.log(`  un esempio solo (${singles.length}): ${singles.join(', ') || 'nessuno'}`);
  if (never.length) console.log(`  MAI usati (${never.length}): ${never.join(', ')}`);

  // 6. i settori per livello
  console.log('\n▸ Settori per livello (frasi, anche come settore secondario)');
  console.log(`  ${pad('', 14)}${LEVELS.map((lv) => pad(lv, 5)).join('')}`);
  for (const d of DOMAINS) {
    const row = LEVELS.map((lv) => lang.sentences.filter((s) => s.lv === lv && s.dom.includes(d.id)).length);
    console.log(`  ${pad(d.label.slice(0, 13), 14)}${row.map((n) => pad(n || '·', 5)).join('')}`);
  }
}
console.log('');
