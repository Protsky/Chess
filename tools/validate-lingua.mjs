/*
 * Controlli sull'app "Frasi": corpus, motore di ripetizione, test adattivo,
 * correzione delle risposte e costruzione della coda.
 *
 *   node tools/validate-lingua.mjs
 */
import { LANGS, DOMAINS, LEVELS } from '../lingua/assets/js/corpus.js';
import * as Fsrs from '../lingua/assets/js/fsrs.js';
import * as Irt from '../lingua/assets/js/irt.js';
import { diff, suggestGrade, normalize } from '../lingua/assets/js/check.js';
import { buildQueue, cardId, unlocked, ladder, TYPES } from '../lingua/assets/js/scheduler.js';
import * as Ex from '../lingua/assets/js/exercises.js';
import * as Tr from '../lingua/assets/js/translit.js';
import * as Opt from '../lingua/assets/js/optimizer.js';
import * as Tts from '../lingua/assets/js/tts.js';

let errors = 0;
let checks = 0;

const fail = (msg) => { console.error(`  ✗ ${msg}`); errors++; };
const ok = (label) => { checks++; console.log(`  ✓ ${label}`); };
const expect = (cond, msg) => { checks++; if (!cond) fail(msg); };

const DOMAIN_IDS = DOMAINS.map((d) => d.id);
const DAY = 86400000;

/* ------------------------------- corpus -------------------------------- */

for (const lang of LANGS) {
  console.log(`\n[${lang.code}] ${lang.name}`);
  const ids = new Set();

  for (const s of lang.sentences) {
    const tag = `${s.id}`;
    if (ids.has(s.id)) fail(`${tag}: id duplicato`);
    ids.add(s.id);
    if (!LEVELS.includes(s.lv)) fail(`${tag}: livello sconosciuto (${s.lv})`);
    if (!lang.grammar.includes(s.g)) fail(`${tag}: punto grammaticale fuori elenco (${s.g})`);
    if (!s.text.includes(s.key)) fail(`${tag}: la chiave "${s.key}" non compare nella frase`);
    if (!s.key.trim()) fail(`${tag}: chiave vuota`);
    if (normalize(s.text) === normalize(s.key)) fail(`${tag}: il cloze nasconde tutta la frase`);
    if (!s.it || !s.it.trim()) fail(`${tag}: manca la traduzione`);
    if (!s.note || s.note.length < 20) fail(`${tag}: nota troppo scarna`);
    for (const [field, value] of [['frase', s.text], ['chiave', s.key], ['nota', s.note], ['traduzione', s.it]]) {
      if (value.includes('*')) fail(`${tag}: asterisco non convertito nella ${field}`);
    }
    if (!s.dom.length) fail(`${tag}: nessun settore`);
    if (lang.bridge && !s.bridge) fail(`${tag}: manca la riga di riscontro (${lang.bridge})`);
    if (!lang.bridge && s.bridge) fail(`${tag}: riga di riscontro su una lingua che non la dichiara`);
    for (const d of s.dom) if (!DOMAIN_IDS.includes(d)) fail(`${tag}: settore sconosciuto (${d})`);
    const words = s.text.split(/\s+/).length;
    if (words < 2 || words > 12) fail(`${tag}: ${words} parole, fuori dalla finestra 2-12`);
  }
  ok(`${lang.sentences.length} frasi coerenti${lang.bridge ? `, tutte con la riga "${lang.bridge.toLowerCase()}"` : ''}`);

  for (const lv of LEVELS) {
    const n = lang.sentences.filter((s) => s.lv === lv).length;
    expect(n >= 5, `[${lang.code}] livello ${lv}: solo ${n} frasi`);
  }
  ok('tutti i livelli QCER coperti');

  const pids = new Set();
  for (const it of lang.placement) {
    const tag = `${it.id}`;
    if (pids.has(it.id)) fail(`${tag}: id duplicato`);
    pids.add(it.id);
    if (it.options.length !== 4) fail(`${tag}: ${it.options.length} opzioni invece di 4`);
    if (new Set(it.options).size !== it.options.length) fail(`${tag}: opzioni ripetute`);
    if (!(it.correct >= 0 && it.correct < it.options.length)) fail(`${tag}: indice della risposta fuori intervallo`);
    if (!(it.a > 0.5 && it.a < 3)) fail(`${tag}: discriminazione implausibile (${it.a})`);
    if (!(it.b > -3.5 && it.b < 3.5)) fail(`${tag}: difficoltà fuori scala (${it.b})`);
    if (it.kind === 'gap' && !it.prompt.includes('___')) fail(`${tag}: manca il buco`);
  }
  ok(`${lang.placement.length} item del test coerenti`);

  for (const lv of LEVELS) {
    const n = lang.placement.filter((p) => p.lv === lv).length;
    expect(n >= 4, `[${lang.code}] test: solo ${n} item di livello ${lv}`);
  }
  ok('banca del test distribuita su tutti i livelli');

  expect(lang.rate > 0.5 && lang.rate <= 1, `[${lang.code}] velocità di lettura implausibile (${lang.rate})`);
}

/* -------------------------------- FSRS --------------------------------- */

console.log('\n[fsrs] motore di ripetizione');
{
  const sch = Fsrs.createScheduler({ random: () => 0.5 });
  let card = Fsrs.newCard('t');
  const t0 = Date.parse('2026-01-01T09:00:00Z');

  const preview = sch.preview(card, t0);
  expect(Fsrs.GRADES.every((g) => preview[g]), 'anteprima incompleta per una carta nuova');

  let now = t0;
  card = sch.review(card, 3, now);
  const stabilities = [];
  const intervals = [];
  for (let i = 0; i < 8; i++) {
    now = card.due;
    card = sch.review(card, 3, now);
    if (card.state === 'review') {
      stabilities.push(card.s);
      intervals.push(card.ivl);
    }
  }
  expect(stabilities.every((s, i) => i === 0 || s > stabilities[i - 1]), 'la stabilità non cresce ripassando bene');
  expect(intervals.every((v, i) => i === 0 || v >= intervals[i - 1]), 'gli intervalli non crescono');
  ok(`8 ripassi corretti: intervallo da ${intervals[0]} a ${intervals[intervals.length - 1]} giorni`);

  // la carta torna quando R è sceso alla ritenzione richiesta
  for (const retention of [0.8, 0.85, 0.9, 0.95]) {
    const s2 = Fsrs.createScheduler({ requestRetention: retention, random: () => 0.5 });
    let c = Fsrs.newCard('r');
    let t = t0;
    c = s2.review(c, 3, t);
    for (let i = 0; i < 4; i++) { t = c.due; c = s2.review(c, 3, t); }
    // oltre il tetto di 10 anni l'intervallo viene tagliato e R resta più alto
    if (c.ivl < 3650) {
      const r = s2.currentRetrievability(c, c.due);
      expect(Math.abs(r - retention) < 0.03, `ritenzione a scadenza ${r.toFixed(3)} contro ${retention} richiesto`);
    }
  }
  ok('la scadenza cade dove la probabilità di ricordare vale quanto richiesto');

  // più alta la ritenzione, più corti gli intervalli
  const spans = [0.8, 0.9, 0.95].map((rr) => {
    const s3 = Fsrs.createScheduler({ requestRetention: rr, random: () => 0.5 });
    let c = Fsrs.newCard('x');
    let t = t0;
    c = s3.review(c, 3, t);
    for (let i = 0; i < 4; i++) { t = c.due; c = s3.review(c, 3, t); }
    return c.ivl;
  });
  expect(spans[0] > spans[1] && spans[1] > spans[2], `intervalli non monotoni sulla ritenzione: ${spans}`);
  ok(`intervalli ${spans[0]}g / ${spans[1]}g / ${spans[2]}g per ritenzione 80/90/95%`);

  // un errore accorcia, non allunga
  let strong = Fsrs.newCard('l');
  let t = t0;
  strong = sch.review(strong, 3, t);
  for (let i = 0; i < 5; i++) { t = strong.due; strong = sch.review(strong, 3, t); }
  const before = strong.s;
  const after = sch.review(strong, 1, strong.due);
  expect(after.s < before, 'un errore non riduce la stabilità');
  expect(after.lapses === 1, 'un errore su carta matura non conta come lapse');
  expect(after.state === 'relearning', 'dopo un errore la carta non torna in riapprendimento');
  ok('errore su carta matura: stabilità in calo e rientro in riapprendimento');

  // difficoltà sempre nel dominio, qualunque sequenza di voti
  let d = Fsrs.newCard('d');
  let clock = t0;
  const seq = [3, 1, 4, 2, 1, 1, 3, 4, 2, 3, 1, 4];
  for (const g of seq) {
    d = sch.review(d, g, clock);
    clock = Math.max(d.due, clock + DAY);
    expect(d.d >= 1 && d.d <= 10, `difficoltà fuori scala: ${d.d}`);
    expect(d.s > 0, 'stabilità non positiva');
  }
  ok('difficoltà e stabilità restano nel dominio su una sequenza mista di 12 voti');

  // "Facile" non può essere più corto di "Bene"
  let cmp = Fsrs.newCard('c');
  cmp = sch.review(cmp, 3, t0);
  cmp = sch.review(cmp, 3, cmp.due);
  const p = sch.preview(cmp, cmp.due);
  expect((p[4].days ?? 0) >= (p[3].days ?? 0), 'Facile non è almeno lungo quanto Bene');
  expect((p[3].days ?? 0) >= (p[2].days ?? 0), 'Bene non è almeno lungo quanto Difficile');
  ok('gli intervalli dei quattro voti sono ordinati');
}

/* --------------------------------- IRT --------------------------------- */

console.log('\n[irt] test adattivo');
{
  expect(Irt.toCefr(-3) === 'A1' && Irt.toCefr(3) === 'C2', 'estremi della scala QCER sbagliati');
  const order = [-3, -2, -1, 0, 1, 2, 3].map(Irt.toCefr);
  const idx = order.map((c) => Irt.CEFR.findIndex((x) => x.id === c));
  expect(idx.every((v, i) => i === 0 || v >= idx[i - 1]), 'la mappatura θ → QCER non è monotona');
  ok('la scala θ → QCER è monotona');

  // recupero dell'abilità vera su dati simulati, con le banche reali
  let rng = 42;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };
  for (const lang of LANGS) {
    const biases = [];
    for (const trueTheta of [-2.2, -1.3, -0.4, 0.5, 1.4, 2.2]) {
      const runs = [];
      for (let k = 0; k < 30; k++) {
        const asked = [];
        const resp = [];
        let est = { theta: 0, se: 1 };
        while (!Irt.shouldStop(resp, est.se)) {
          const it = Irt.pickNext(lang.placement, asked, est.theta, rand);
          if (!it) break;
          asked.push(it.id);
          resp.push({ a: it.a, b: it.b, correct: rand() < Irt.p2pl(trueTheta, it.a, it.b) });
          est = Irt.estimate(resp);
        }
        runs.push(est.theta);
      }
      const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
      biases.push(Math.abs(mean - trueTheta));
      expect(Math.abs(mean - trueTheta) < 0.6, `[${lang.code}] θ vero ${trueTheta}: stima media ${mean.toFixed(2)}`);
    }
    ok(`[${lang.code}] abilità recuperata entro ±${Math.max(...biases).toFixed(2)} su 6 profili × 30 simulazioni`);
  }

  // l'informazione è massima quando la difficoltà coincide con l'abilità
  const at = Irt.itemInfo(0, 1.5, 0);
  expect(at > Irt.itemInfo(0, 1.5, 1.5) && at > Irt.itemInfo(0, 1.5, -1.5), 'informazione di Fisher non centrata su b');
  ok("l'informazione di Fisher è massima dove b coincide con θ");

  // il prior tiene a bada i pattern estremi
  const allRight = Irt.estimate(Array.from({ length: 10 }, () => ({ a: 1.4, b: 0, correct: true })));
  expect(Number.isFinite(allRight.theta) && allRight.theta < 4, 'la stima diverge con tutte le risposte giuste');
  ok('tutte giuste o tutte sbagliate non fanno divergere la stima');
}

/* ------------------------------ correzione ------------------------------ */

console.log('\n[check] correzione delle risposte');
{
  const cases = [
    ['Me gusta el café.', 'me gusta el cafe', true, 3],
    ['Me gusta el café.', 'Me gusta el café', true, 3],
    ['Me gusta el café.', 'me gustan el cafe', false, 2],
    ['I have been working here since 2019.', 'I have worked here since 2019', false, 1],
    ['Turn left at the corner.', 'turn left at the corner!', true, 3],
    ['¿De dónde eres?', 'de donde eres', true, 3],
  ];
  for (const [expected, given, correct, grade] of cases) {
    const r = diff(expected, given);
    expect(r.correct === correct, `"${given}": corretto atteso ${correct}, ottenuto ${r.correct}`);
    expect(suggestGrade(r) === grade, `"${given}": voto atteso ${grade}, ottenuto ${suggestGrade(r)}`);
  }
  ok('accenti, maiuscole e punteggiatura perdonati; la morfologia no');

  const r = diff('There are no seats left.', 'there are seats left');
  expect(r.marks.some((m) => m.word === 'no' && m.status === 'missing'), 'la parola mancante non viene segnalata');
  ok('le parole mancanti sono indicate una per una');
}

/* ------------------------------- coda ---------------------------------- */

console.log('\n[translit] cirillico e tastiera italiana');
{
  const ru = LANGS.find((l) => l.code === 'ru');
  const ACUTE = '\u0301';
  const VOWELS = 'аеиоуыэюяАЕИОУЫЭЮЯ';

  let problems = 0;
  let marked = 0;
  for (const s of ru.sentences) {
    for (const raw of s.text.split(/\s+/)) {
      const w = raw.replace(/[.,?!]/g, '');
      const n = (w.match(new RegExp(ACUTE, 'g')) || []).length;
      const at = w.indexOf(ACUTE);
      const vowels = (w.match(/[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/g) || []).length;
      if (n > 1) { fail(`${s.id}: due accenti in "${w}"`); problems++; }
      if (n && w.includes('ё')) { fail(`${s.id}: accento su una parola con ё ("${w}")`); problems++; }
      if (n && !VOWELS.includes(w[at - 1] || '')) { fail(`${s.id}: accento non su vocale in "${w}"`); problems++; }
      if (!n && !w.includes('ё') && vowels > 1) { fail(`${s.id}: "${w}" polisillabica senza accento`); problems++; }
      if (n) marked++;
    }
  }
  expect(problems === 0, `${problems} anomalie sugli accenti tonici`);
  ok(`${marked} parole con accento tonico, tutte ben formate`);

  // scrivere in cirillico o in latino deve valere allo stesso modo
  const pairs = [
    ['Как тебя зовут?', ['как тебя зовут', 'Kak tebya zovut', 'kak tebja zovut', 'kak tebia zovut'], true],
    ['Как тебя зовут?', ['как тибя зовут', 'kak tebe zovut'], false],
    ['Я не знаю.', ['я не знаю', 'ya ne znayu', 'ja ne znaju', 'ia ne znaiu'], true],
    ['Очень приятно.', ['ochen priyatno', 'очень приятно', 'ochen prijatno'], true],
  ];
  for (const [target, answers, shouldPass] of pairs) {
    for (const given of answers) {
      const r = diff(target, given, Tr.folderFor(given));
      expect(r.correct === shouldPass, `"${given}" contro "${target}": atteso ${shouldPass}, ottenuto ${r.correct}`);
    }
  }
  ok('le risposte valgono in cirillico e in caratteri latini, ma non se la parola è sbagliata');

  // in cirillico il metro resta stretto: ь e ъ contano
  const strict = diff('Мне нужно идти.', 'мне нужно идти', Tr.folderFor('мне нужно идти'));
  const loose = diff('Мне нужно идти.', 'мне нужно итти', Tr.folderFor('мне нужно итти'));
  expect(strict.correct && !loose.correct, 'il confronto in cirillico non distingue le consonanti');
  ok('chi scrive in cirillico viene tenuto sui dettagli');

  // la pronuncia non è vuota e non contiene più cirillico
  const bad = ru.sentences.filter((s) => !s.bridge || Tr.hasCyrillic(s.bridge));
  expect(bad.length === 0, `${bad.length} righe di pronuncia incomplete`);
  ok(`${ru.sentences.length} righe di pronuncia generate dal testo accentato`);
}

console.log('\n[tts] voce online');
{
  for (const l of LANGS) {
    const sample = l.sentences[0];
    const url = Tts.url(sample.text, l.locale);
    expect(url.startsWith('https://'), `[${l.code}] indirizzo non sicuro`);
    expect(url.includes(`tl=${l.locale.slice(0, 2)}`), `[${l.code}] lingua mancante nell'indirizzo`);
    expect(decodeURIComponent(url.split('&q=')[1]) === sample.text, `[${l.code}] frase codificata male`);
  }
  ok(`${LANGS.length} lingue: indirizzo della voce online ben formato`);

  const slow = Tts.url('Привет', 'ru-RU', { slow: true });
  expect(slow.includes('ttsspeed=0.24'), 'la lettura scandita non passa il parametro di velocità');
  expect(!Tts.url('Привет', 'ru-RU').includes('ttsspeed'), 'la lettura normale passa un parametro che non serve');
  ok('la lettura scandita usa il parlato lento del servizio');

  const long = 'a'.repeat(400);
  const cut = decodeURIComponent(Tts.url(long, 'ru-RU').split('&q=')[1]);
  expect(cut.length === Tts.MAX_CHARS, `frase non tagliata al limite: ${cut.length}`);
  const longest = Math.max(...LANGS.flatMap((l) => l.sentences.map((s) => s.text.length)));
  expect(longest < Tts.MAX_CHARS, `c'è una frase di ${longest} caratteri, oltre il limite del servizio`);
  ok(`la frase più lunga del corpus è di ${longest} caratteri, sotto il limite di ${Tts.MAX_CHARS}`);

  const enc = Tts.url('Я не знаю.', 'ru-RU');
  expect(!/[^\x00-\x7F]/.test(enc), 'indirizzo con caratteri non ASCII: alcuni client lo rifiutano');
  ok('il cirillico viaggia codificato in percentuale, accenti compresi');
}

console.log('\n[exercises] esercizi che si correggono da soli');
{
  const lang = LANGS.find((l) => l.code === 'de');
  const norm = (s) => normalize(s);

  for (const s of lang.sentences) {
    const seed = `${s.id}|0`;

    for (const [direction, right] of [['understand', s.it], ['produce', s.text]]) {
      const choice = Ex.buildChoice(s, lang, seed, direction);
      if (choice.options.length !== 4) fail(`${s.id}: ${choice.options.length} scelte invece di 4`);
      if (new Set(choice.options).size !== 4) fail(`${s.id}: due scelte identiche`);
      if (choice.options[choice.correct] !== right) fail(`${s.id}: la scelta giusta non è quella attesa (${direction})`);
      if (choice.reversed !== (direction === 'produce')) fail(`${s.id}: verso non segnalato`);
    }

    const tiles = Ex.buildTiles(s, lang, seed);
    if (tiles.answer.join(' ') !== s.text) fail(`${s.id}: le tessere non ricompongono la frase`);
    if (tiles.tiles.length !== tiles.answer.length + tiles.extras) fail(`${s.id}: conteggio tessere sbagliato`);
    for (const w of tiles.answer) {
      if (!tiles.tiles.includes(w)) fail(`${s.id}: manca la tessera "${w}"`);
    }

    const cloze = Ex.buildCloze(s, { s: 0, reps: 0 }, seed);
    const rebuilt = cloze.parts.map((p) => (p.blank ? p.answer : p.text)).join(' ');
    if (rebuilt !== s.text) fail(`${s.id}: i buchi non ricompongono la frase (${rebuilt})`);
    const holes = cloze.parts.filter((p) => p.blank).map((p) => norm(p.answer)).join(' ');
    if (!holes.includes(norm(s.key)) && !norm(s.key).includes(holes)) {
      fail(`${s.id}: il primo buco non cade sulla chiave (${holes} contro ${norm(s.key)})`);
    }
  }
  ok(`${lang.sentences.length} frasi: scelte nei due versi, tessere e buchi coerenti su tutte`);

  // l'impalcatura si ritira: più la carta è solida, più pezzi spariscono
  let regressions = 0;
  for (const s of lang.sentences) {
    let prev = 0;
    for (const [reps, stability] of [[0, 0], [2, 5], [4, 20], [8, 60], [12, 200]]) {
      const c = Ex.buildCloze(s, { s: stability, reps }, s.id);
      if (c.hidden < prev) regressions++;
      prev = c.hidden;
    }
  }
  expect(regressions === 0, `${regressions} casi in cui i buchi diminuiscono col consolidarsi della carta`);
  const sample = lang.sentences.find((s) => s.text.split(' ').length >= 7);
  const growth = [[0, 0], [4, 20], [12, 200]].map(([reps, st]) => Ex.buildCloze(sample, { s: st, reps }, sample.id).hidden);
  expect(growth[2] > growth[0], 'i buchi non crescono mai');
  ok(`i buchi passano da ${growth[0]} a ${growth[2]} su una frase di ${sample.text.split(' ').length} parole`);

  // i buchi vanno dove si è già sbagliato
  const long = lang.sentences.find((s) => s.text.split(' ').length >= 7);
  const words = long.text.split(' ').filter((w) => !long.key.includes(w));
  const victim = words[words.length - 1];
  const blind = Ex.buildCloze(long, { s: 40, reps: 6 }, long.id);
  const guided = Ex.buildCloze(long, { s: 40, reps: 6, miss: { [victim]: 4 } }, long.id);
  const hidesIt = (c) => c.parts.some((p) => p.blank && p.answer.split(' ').includes(victim));
  expect(hidesIt(guided), `la parola sbagliata "${victim}" non finisce nel buco`);
  expect(guided.hidden === blind.hidden, 'la storia degli errori cambia il numero dei buchi invece della posizione');
  ok(`i buchi si spostano sulle parole già sbagliate ("${victim}"), a parità di quantità`);

  // stesso seme, stesso esercizio: niente sorprese fra un render e l'altro
  const s0 = lang.sentences[3];
  const a1 = Ex.buildTiles(s0, lang, 'x|1').tiles.join('|');
  const a2 = Ex.buildTiles(s0, lang, 'x|1').tiles.join('|');
  const a3 = Ex.buildTiles(s0, lang, 'x|2').tiles.join('|');
  expect(a1 === a2, 'lo stesso seme dà due esercizi diversi');
  expect(a1 !== a3, 'semi diversi danno lo stesso esercizio');
  ok('gli esercizi sono ripetibili a parità di seme e cambiano a ogni ripasso');

  expect(Ex.autoGrade({ correct: true, score: 1, extra: 0 }) === 3, 'tutto giusto non vale Bene');
  expect(Ex.autoGrade({ correct: false, score: 1, extra: 0 }) === 2, 'forma sbagliata non vale Difficile');
  expect(Ex.autoGrade({ correct: false, score: 0.5, extra: 0 }) === 1, 'risposta incompleta non vale Di nuovo');
  expect(Ex.autoGrade({ correct: false, score: 1, extra: 2 }) === 1, 'parole di troppo non vengono penalizzate');
  ok('il voto scende dall’esito, non da un giudizio');
}

console.log('\n[optimizer] pesi tarati sui propri ripassi');
{
  // si costruisce un utente finto la cui memoria segue pesi diversi dai default,
  // e si controlla che l'ottimizzatore sappia riconoscerlo dai soli ripassi
  const truth = Fsrs.DEFAULT_W.map((x, i) => x * (i % 3 === 0 ? 1.4 : 0.75));
  let rnd = 11;
  const rand = () => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd / 2147483648; };
  const t0 = Date.parse('2026-01-01T08:00:00Z');
  const log = [];
  for (let c = 0; c < 200; c++) {
    let state = Fsrs.memoryStep(truth, null, 3, 0);
    let when = t0 + c * 60000;
    log.push({ id: `c${c}`, t: when, g: 3, isNew: true });
    for (let i = 0; i < 8; i++) {
      const ivl = Math.max(1, Math.round(Fsrs.intervalFor(state.s, 0.9)));
      const grade = rand() < Fsrs.retrievability(ivl, state.s) ? 3 : 1;
      when += ivl * 86400000;
      log.push({ id: `c${c}`, t: when, g: grade, isNew: false });
      state = Fsrs.memoryStep(truth, state, grade, ivl);
    }
  }

  const sequences = Opt.replay(log);
  expect(sequences.length === 200, `ricostruite ${sequences.length} storie invece di 200`);
  expect(Opt.replay(log.filter((e) => !e.isNew)).length === 0, 'storie senza inizio non vanno scartate');
  ok(`${sequences.length} storie ricostruite dal registro, quelle senza inizio scartate`);

  const before = Opt.score(sequences, Fsrs.DEFAULT_W);
  const started = Date.now();
  const fitted = Opt.optimize(sequences, { start: Fsrs.DEFAULT_W });
  const elapsed = Date.now() - started;
  const after = Opt.score(sequences, fitted.w);

  expect(after.logLoss < before.logLoss, `la log-loss non migliora: ${before.logLoss} → ${after.logLoss}`);
  expect(after.rmse < before.rmse, `la calibrazione non migliora: ${before.rmse} → ${after.rmse}`);
  expect(fitted.w.every((x, i) => x >= Fsrs.BOUNDS[i][0] && x <= Fsrs.BOUNDS[i][1]), 'pesi fuori dai limiti');
  expect(elapsed < 5000, `troppo lento per un telefono: ${elapsed} ms`);
  ok(`log-loss ${before.logLoss.toFixed(4)} → ${after.logLoss.toFixed(4)}, calibrazione ${(before.rmse * 100).toFixed(1)}% → ${(after.rmse * 100).toFixed(1)}%, in ${elapsed} ms`);

  // su dati generati dai pesi di serie, non deve inventarsi miglioramenti grossi
  const honest = [];
  for (let c = 0; c < 120; c++) {
    let state = Fsrs.memoryStep(Fsrs.DEFAULT_W, null, 3, 0);
    const steps = [{ grade: 3, elapsed: 0 }];
    for (let i = 0; i < 8; i++) {
      const ivl = Math.max(1, Math.round(Fsrs.intervalFor(state.s, 0.9)));
      const grade = rand() < Fsrs.retrievability(ivl, state.s) ? 3 : 1;
      steps.push({ grade, elapsed: ivl });
      state = Fsrs.memoryStep(Fsrs.DEFAULT_W, state, grade, ivl);
    }
    honest.push(steps);
  }
  const baseline = Opt.score(honest, Fsrs.DEFAULT_W);
  const refit = Opt.score(honest, Opt.optimize(honest, { start: Fsrs.DEFAULT_W }).w);
  expect(baseline.logLoss - refit.logLoss < 0.05, `guadagno sospetto su dati già di serie: ${baseline.logLoss - refit.logLoss}`);
  ok('su dati che seguono già i pesi di serie il guadagno resta trascurabile');

  const bins = Opt.calibration(before.rows);
  expect(bins.every((b) => b.n > 0 && b.predicted >= b.from - 1e-9 && b.predicted <= b.to + 1e-9), 'fasce di calibrazione incoerenti');
  expect(Math.abs(bins.reduce((a, b) => a + b.n, 0) - before.n) < 1, 'la calibrazione perde per strada dei ripassi');
  ok(`${bins.length} fasce di calibrazione, tutte con dentro le previsioni giuste`);

  // la curva del costo deve essere monotona: più ritenzione, più ripassi
  const curve = Opt.retentionCurve(Fsrs.DEFAULT_W);
  expect(curve.length === 16, `curva con ${curve.length} punti invece di 16`);
  expect(curve.every((p, i) => i === 0 || p.reviews >= curve[i - 1].reviews - 0.2), 'i ripassi non crescono con la ritenzione');
  expect(curve.every((p, i) => i === 0 || p.knowledge >= curve[i - 1].knowledge - 0.01), 'la memoria media non cresce con la ritenzione');
  expect(curve[15].reviews > curve[0].reviews * 1.5, 'la differenza di carico fra 80% e 95% è troppo piccola per essere vera');
  ok(`dal 80% al 95%: ${curve[0].reviews.toFixed(1)} → ${curve[15].reviews.toFixed(1)} ripassi l’anno per ${Math.round((curve[15].knowledge - curve[0].knowledge) * 100)} punti di memoria`);

  const cost = Opt.measuredCost([
    ...Array.from({ length: 30 }, () => ({ g: 3, ms: 8000 })),
    ...Array.from({ length: 15 }, () => ({ g: 1, ms: 20000 })),
    { g: 3, ms: 400 }, { g: 3, ms: 999999 },
  ]);
  expect(cost.measured && Math.abs(cost.pass - 8) < 0.01 && Math.abs(cost.fail - 20) < 0.01, `tempi misurati male: ${JSON.stringify(cost)}`);
  ok('i tempi per ripasso si misurano dal registro, scartando le pause');
}

console.log('\n[scheduler] costruzione della sessione');
{
  const lang = LANGS.find((l) => l.code === 'en');
  const settings = { newPerDay: 8, maxReviews: 100, retention: 0.9, domains: ['lavoro'] };
  const deck = { profile: { theta: -0.4 }, cards: {}, log: [] };

  const first = buildQueue({ lang, deck, settings, random: () => 0.5 });
  expect(first.queue.length === 8, `prima sessione: ${first.queue.length} carte invece di 8`);
  expect(first.queue.every((c) => c.id.endsWith('|comp')), 'una frase nuova non parte dalla comprensione');
  const sids = first.queue.map((c) => c.id.split('|')[0]);
  expect(new Set(sids).size === sids.length, 'due carte della stessa frase nella stessa sessione');
  ok('la prima sessione introduce solo comprensioni, una per frase');

  // il bersaglio è "poco sopra il livello": si controlla la distribuzione su
  // molte sessioni, perché la scelta è casuale pesata e non deterministica
  const tally = {};
  let domHits = 0;
  let picks = 0;
  for (let k = 0; k < 40; k++) {
    const q = buildQueue({ lang, deck: { profile: { theta: -0.4 }, cards: {}, log: [] }, settings });
    for (const c of q.queue) {
      const s = lang.sentences.find((x) => x.id === c.id.split('|')[0]);
      tally[s.lv] = (tally[s.lv] || 0) + 1;
      picks++;
      if (s.dom.includes('lavoro')) domHits++;
    }
  }
  const onTarget = ((tally.B1 || 0) + (tally.B2 || 0)) / picks;
  expect(onTarget > 0.7, `solo il ${Math.round(onTarget * 100)}% delle frasi nuove è al livello giusto`);
  expect((tally.C2 || 0) / picks < 0.05, 'troppe frasi ben oltre il livello');
  ok(`con θ = -0.4 (B1) il ${Math.round(onTarget * 100)}% delle frasi nuove è B1 o B2`);

  expect(domHits / picks > 0.5, `settore scelto poco rispettato: ${Math.round((domHits / picks) * 100)}%`);
  ok(`${Math.round((domHits / picks) * 100)}% delle frasi nuove dal settore richiesto`);

  // un punto grammaticale già visto ma ancora fragile va rivisto in un'ALTRA frase
  const counts = new Map();
  for (const s of lang.sentences) counts.set(s.g, (counts.get(s.g) || 0) + 1);
  const point = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const family = lang.sentences.filter((s) => s.g === point);
  expect(family.length >= 4, `servono più frasi di "${point}" per la prova`);
  const withHistory = (stability) => {
    const cards = {};
    for (const s of family.slice(0, 2)) {
      const id = cardId(s.id, 'comp');
      cards[id] = { ...Fsrs.newCard(id), state: 'review', reps: 3, s: stability, due: Date.now() + 5 * 86400000 };
    }
    let hits = 0;
    let total = 0;
    for (let k = 0; k < 40; k++) {
      const q = buildQueue({ lang, deck: { profile: { theta: 0.5 }, cards, log: [] }, settings: { ...settings, domains: [] } });
      for (const c of q.queue) {
        if (c.state !== 'new') continue;
        const s = lang.sentences.find((x) => x.id === c.id.split('|')[0]);
        total += 1;
        if (s.g === point) hits += 1;
      }
    }
    return hits / total;
  };
  const shaky = withHistory(2);      // punto ancora traballante
  const solid = withHistory(90);     // punto ormai consolidato
  expect(shaky > solid, `un punto fragile non viene ripreso più di uno solido: ${shaky.toFixed(3)} contro ${solid.toFixed(3)}`);
  ok(`un punto grammaticale fragile torna in altre frasi ${(shaky / Math.max(solid, 0.001)).toFixed(1)} volte più spesso di uno consolidato`);

  expect(buildQueue({ lang, deck, settings, introducedToday: 8 }).counts.fresh === 0, 'il tetto giornaliero non viene rispettato');
  ok('il tetto di frasi nuove al giorno viene rispettato');

  // la scala si sale un gradino alla volta, e solo su un gradino consolidato
  const sid = lang.sentences[0].id;
  const mature = (id) => ({ ...Fsrs.newCard(id), state: 'review', reps: 2, s: 6 });

  expect(ladder('understand').join(' ') === 'comp build cloze prod', `scala "capire" inattesa: ${ladder('understand')}`);
  expect(ladder('produce').join(' ') === 'comp prod build cloze', `scala "parlare" inattesa: ${ladder('produce')}`);
  expect(new Set(ladder('produce')).size === TYPES.length, 'la scala "parlare" non contiene tutti i tipi');

  for (const direction of ['understand', 'produce']) {
    const order = ladder(direction);
    const own = { ...deck, cards: {} };
    own.cards[cardId(sid, 'comp')] = { ...Fsrs.newCard(cardId(sid, 'comp')), state: 'learning', reps: 1, s: 0.4 };
    expect(!unlocked(own, sid, order[1], direction), `[${direction}] il secondo gradino si sblocca troppo presto`);
    for (let i = 1; i < order.length; i++) {
      own.cards[cardId(sid, order[i - 1])] = mature(cardId(sid, order[i - 1]));
      expect(unlocked(own, sid, order[i], direction), `[${direction}] ${order[i]} non si sblocca dopo ${order[i - 1]}`);
      if (i + 1 < order.length) {
        expect(!unlocked(own, sid, order[i + 1], direction), `[${direction}] ${order[i + 1]} salta un gradino`);
      }
    }
    ok(`${direction === 'produce' ? 'parlare' : 'capire'}: ${order.join(' → ')}, un gradino alla volta`);
  }

  // chi punta a parlare arriva alla produzione al secondo giro, non al quarto
  const spoken = { profile: { theta: 0 }, cards: {}, log: [] };
  // il riconoscimento è maturo e non in scadenza oggi: altrimenti la frase resta
  // occupata e il gradino successivo aspetta domani, com'è giusto che sia
  spoken.cards[cardId(sid, 'comp')] = { ...mature(cardId(sid, 'comp')), due: Date.now() + 5 * 86400000 };
  const nextUp = buildQueue({
    lang,
    deck: spoken,
    settings: { ...settings, direction: 'produce', newPerDay: 1 },
    random: () => 0.5,
  }).queue.map((c) => c.id.split('|')[1]);
  expect(nextUp.includes('prod'), `dopo il riconoscimento non arriva la produzione: ${nextUp}`);
  ok('con l’obiettivo "parlare" la produzione è il secondo gradino');

  // i ripassi in scadenza precedono le novità e restano mescolati
  const deck2 = { profile: { theta: 0 }, cards: {}, log: [] };
  for (let i = 0; i < 12; i++) {
    const id = cardId(lang.sentences[i].id, 'comp');
    deck2.cards[id] = { ...Fsrs.newCard(id), state: 'review', reps: 3, s: 10, ivl: 10, due: Date.now() - (i + 1) * 3600000 };
  }
  const mixed = buildQueue({ lang, deck: deck2, settings, random: () => 0.5 });
  expect(mixed.counts.due === 12, `attesi 12 ripassi, trovati ${mixed.counts.due}`);
  expect(mixed.queue.length === 12 + mixed.counts.fresh, 'la coda non contiene tutto');
  const firstNew = mixed.queue.findIndex((c) => c.state === 'new');
  expect(firstNew > 0, 'le carte nuove sono tutte in testa invece che mescolate');
  ok(`ripassi e novità mescolati: la prima nuova arriva in posizione ${firstNew + 1}`);
}

console.log(`\n${errors ? `${errors} problemi su ${checks} controlli` : `tutto a posto (${checks} controlli)`}`);
process.exit(errors ? 1 : 0);
