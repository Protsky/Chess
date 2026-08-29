/*
 * validate-percorso.mjs — il percorso fa quello che dice?
 *
 *   node tools/validate-percorso.mjs
 *
 * Non prova l'interfaccia: prova le tre macchine che decidono che cosa vedrai
 * e quando — la memoria (FSRS), il punteggio (Elo su te e sull'item) e la coda
 * (scadenze prima, motivi mescolati). Sono tutte pure, quindi si fanno girare
 * per intero qui dentro, comprese trecento risposte simulate di un giocatore
 * di forza nota: se la stima non ci arriva, il modello sbaglia e va detto.
 */

/* localStorage finto: store.js lo usa e basta, non gli serve un browser. */
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

const Store = await import('../assets/js/store.js');
const Rating = await import('../assets/js/rating.js');
const Tactics = await import('../assets/js/tactics.js');
const { createScheduler, newCard, AGAIN, HARD, GOOD, EASY, DEFAULT_W } = await import('../assets/js/fsrs.js');
const { PUZZLES } = await import('../assets/js/puzzles.js');

let checks = 0;
const errors = [];

function ok(cond, message) {
  checks += 1;
  if (!cond) errors.push(message);
}

function near(value, target, tolerance, message) {
  ok(Math.abs(value - target) <= tolerance, `${message} (${value}, atteso ${target} ± ${tolerance})`);
}

const DAY = 86400000;

/* ------------------------- 1. la v1 non si perde ------------------------- */

memory.clear();
memory.set('aperture-scacchi/v1', JSON.stringify({
  progress: { italiana: { stars: 3, best: 100, attempts: 4, lastAt: 1 } },
  settings: { notation: 'en', sounds: false, showMoves: true },
  lastOpening: 'italiana',
  trainings: 7,
}));

ok(Store.getProgress('italiana').stars === 3, 'migrazione: le stelle della v1 sono sparite');
ok(Store.getSettings().notation === 'en', 'migrazione: le impostazioni della v1 sono sparite');
ok(Store.totalTrainings() === 7, 'migrazione: il conteggio degli allenamenti è sparito');
ok(Store.allCards().length === 0, 'migrazione: la v1 non aveva carte, e ora ce ne sono');

// La scrittura successiva deve andare sulla v2 e non toccare più la v1.
Store.setSetting('sounds', true);
ok(memory.has('aperture-scacchi/v2'), 'migrazione: non è stata scritta la chiave v2');
ok(JSON.parse(memory.get('aperture-scacchi/v1')).settings.sounds === false, 'migrazione: la v1 è stata sovrascritta');
ok(Store.getProgress('italiana').stars === 3, 'migrazione: dopo la scrittura i progressi si sono persi');

/* --------------------------- 2. carte e scadenze -------------------------- */

memory.clear();
const scheduler = createScheduler({ random: () => 0.5 });
const now = Date.UTC(2026, 7, 29, 9, 0, 0);

let card = newCard('t:abcde', { r: 1200 });
ok(card.due === 0, 'una carta nuova non è dovuta subito');

const good = scheduler.review(card, GOOD, now);
ok(good.due > now, 'dopo una risposta la carta resta scaduta');
const again = scheduler.review(card, AGAIN, now);
ok(again.due - now < 30 * 60000, 'dopo un errore la carta deve tornare dentro la sessione');
ok(again.s <= good.s, 'un errore non può rendere la memoria più stabile di una risposta giusta');

// Una carta consolidata e ripassata sul filo cresce più di una ripassata subito.
const solid = { ...newCard('t:x'), state: 'review', s: 10, d: 5, last: now - 10 * DAY, reps: 3 };
const onTime = scheduler.review(solid, GOOD, now);
const early = scheduler.review({ ...solid, last: now - 1 * DAY }, GOOD, now);
ok(onTime.s > early.s, 'ripassare sul filo deve rendere più che ripassare subito');

Store.saveCard(scheduler.review(newCard('t:due1'), GOOD, now - 40 * DAY));
Store.saveCard(scheduler.review(newCard('t:due2'), GOOD, now));
const due = Store.dueCards(Tactics.PREFIX, now);
ok(due.length === 1 && due[0].id === 't:due1', 'la coda delle scadenze non è quella attesa');
ok(Store.cardStats(Tactics.PREFIX, now).total === 2, 'il conteggio delle carte non torna');

/* ------------------------------ 3. i voti -------------------------------- */

const p2 = { id: 'x', m: 'a1a2 b1b2', r: 1000, t: 'fork', p: 'middlegame' };   // una mossa da trovare
ok(Tactics.gradeOf(p2, { errors: 0, seconds: 3 }).grade === EASY, 'giusta e veloce deve valere Facile');
ok(Tactics.gradeOf(p2, { errors: 0, seconds: 25 }).grade === HARD, 'giusta ma lenta deve valere Difficile');
ok(Tactics.gradeOf(p2, { errors: 1, seconds: 5 }).grade === HARD, 'un errore deve valere Difficile');
ok(Tactics.gradeOf(p2, { errors: 2, seconds: 5 }).grade === AGAIN, 'due errori devono valere Di nuovo');
ok(Tactics.gradeOf(p2, { revealed: true, seconds: 2 }).grade === AGAIN, 'svelata deve valere Di nuovo');
ok(Tactics.gradeOf(p2, { errors: 1 }).correct === false, 'una risposta con un errore non è "pulita"');
ok(Tactics.gradeOf(p2, { errors: 0, seconds: 8 }).correct === true, 'una risposta pulita non viene contata');

/* --------------------- 3b. le carte sbagliate tornano --------------------- */

const failed = scheduler.review(newCard('t:ripeti'), AGAIN, now);
ok(Tactics.shouldRepeat(failed, { repeats: 0, queued: 8, now }),
  'una carta sbagliata deve tornare dentro la sessione');
ok(!Tactics.shouldRepeat(failed, { repeats: Tactics.MAX_REPEATS, queued: 8, now }),
  'una carta non può tornare più di MAX_REPEATS volte');
ok(!Tactics.shouldRepeat(failed, { repeats: 0, queued: Tactics.SESSION_CAP, now }),
  'la sessione non deve crescere oltre il tetto');
ok(!Tactics.shouldRepeat(scheduler.review(newCard('t:ok'), EASY, now), { repeats: 0, queued: 8, now }),
  'una carta risolta e graduata non deve tornare nella stessa sessione');

/* ---------------------------- 4. il punteggio ----------------------------- */

near(Rating.expected(1200, 1200), 0.5, 0.001, 'pari forza deve dare 50%');
near(Rating.expected(1200, Rating.targetDifficulty(1200)), Rating.TARGET_SUCCESS, 0.005,
  'la difficoltà bersaglio non centra la probabilità voluta');
ok(Rating.stepFor(0) > Rating.stepFor(500), 'il passo K deve calare con l’esperienza');

const up = Rating.update({ rating: 1000, attempts: 0 }, 1400, true);
ok(up.delta > 0 && up.rating > 1000, 'risolvere una posizione difficile deve alzare il punteggio');
ok(up.item < 1400, 'una posizione risolta deve diventare (di poco) più facile');
const down = Rating.update({ rating: 1400, attempts: 0 }, 1000, false);
ok(down.delta < 0 && down.rating < 1400, 'sbagliare una posizione facile deve abbassare il punteggio');

const picked = Rating.pickByDifficulty(PUZZLES, 1300, 10);
ok(picked.length === 10, 'la scelta per difficoltà non restituisce abbastanza posizioni');
ok(picked.every((p) => Math.abs(p.r - Rating.targetDifficulty(1300)) <= 120),
  'le posizioni scelte sono lontane dal bersaglio');

// Il corpus copre tutto il percorso? Se una forza non ha materiale, si vede qui.
for (let r = 700; r <= 2200; r += 100) {
  const near10 = Rating.pickByDifficulty(PUZZLES, r, 10);
  ok(near10.length === 10 && Math.abs(near10[9].r - Rating.targetDifficulty(r)) <= 150,
    `corpus magro intorno a forza ${r}: il bersaglio è ${Rating.targetDifficulty(r)}`);
}

/* ------------------------- 5. la coda della sessione ---------------------- */

memory.clear();
const dueCards = [
  { ...newCard('t:' + PUZZLES[0].id), due: now - DAY },
  { ...newCard('t:' + PUZZLES[1].id), due: now - 2 * DAY },
];
const queue = Tactics.buildQueue({ due: dueCards, known: new Set(dueCards.map((c) => c.id)), rating: 1200 });

// Una sessione è "fino a" SESSION_SIZE: scadute più materiale nuovo, e il nuovo
// ha un tetto suo. All'inizio le sessioni sono più corte, ed è voluto.
const atteso = Math.min(Tactics.SESSION_SIZE, dueCards.length + Tactics.MAX_NEW);
ok(queue.length === atteso, `la sessione dovrebbe avere ${atteso} posizioni, ne ha ${queue.length}`);
ok(queue.filter((x) => x.fresh).length <= Tactics.MAX_NEW, 'troppo materiale nuovo in una sessione');
ok(queue.filter((x) => !x.fresh).length === 2, 'le carte scadute non sono tutte in coda');
ok(queue.every((x) => x.puzzle), 'una voce della coda non ha la posizione');

const adjacent = queue.filter((x, i) => i > 0 && x.puzzle.t === queue[i - 1].puzzle.t).length;
ok(adjacent === 0, `${adjacent} coppie di motivi uguali attaccate: i motivi vanno mescolati`);

// Con un motivo solo il mescolamento non può fare miracoli, ma non deve rompersi.
const oneTheme = Tactics.interleave(Array.from({ length: 4 }, () => ({ puzzle: { t: 'fork' } })));
ok(oneTheme.length === 4, 'il mescolamento perde posizioni quando il motivo è unico');

// Il materiale nuovo non ripropone carte già viste.
const known = new Set(PUZZLES.slice(0, 2000).map((p) => Tactics.cardIdOf(p)));
const fresh = Tactics.buildQueue({ due: [], known, rating: 1200 });
ok(fresh.every((x) => !known.has(Tactics.cardIdOf(x.puzzle))), 'la coda ripropone come nuove posizioni già viste');

/* ------------------- 6. trecento risposte di un giocatore ----------------- */

/*
 * Un giocatore di forza vera 1450 che risponde secondo il modello: la stima
 * deve arrivargli vicino partendo da 800, e la percentuale di risposte giuste
 * deve assestarsi intorno al bersaglio (0,75). Se una delle due non regge,
 * il numero mostrato nell'app sarebbe una decorazione.
 */
let seed = 12345;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const TRUE_SKILL = 1450;
let state = { rating: Rating.START_RATING, attempts: 0 };
const used = new Set();
let solved = 0;
let lateSolved = 0;
let lateCount = 0;

for (let i = 0; i < 300; i++) {
  const pool = PUZZLES.filter((p) => !used.has(p.id));
  const [item] = Rating.pickByDifficulty(pool, state.rating, 1 + Math.floor(rnd() * 6)).slice(-1);
  used.add(item.id);
  const correct = rnd() < Rating.expected(TRUE_SKILL, item.r);
  if (correct) solved += 1;
  if (i >= 150) { lateCount += 1; if (correct) lateSolved += 1; }
  const next = Rating.update(state, item.r, correct);
  state = { rating: next.rating, attempts: next.attempts };
}

near(state.rating, TRUE_SKILL, 150, 'dopo 300 risposte la stima non arriva alla forza vera');
near(lateSolved / lateCount, Rating.TARGET_SUCCESS, 0.12,
  'a regime la quota di risposte giuste non sta al bersaglio');
ok(solved > 150, 'con la difficoltà tarata si dovrebbe risolvere la maggioranza delle posizioni');

/* ------------------- 7. registro, statistiche, taratura ------------------- */

const Stats = await import('../assets/js/stats.js');
const Optimizer = await import('../assets/js/optimizer.js');

memory.clear();

/*
 * Si finge un mese di studio: dieci carte, un ripasso al giorno ciascuna, con
 * un errore ogni sei. Serve a due cose — che il registro regga i conti, e che
 * l'ottimizzatore, rigiocando quelle storie, non peggiori le previsioni.
 */
const sim = createScheduler({ random: () => 0.5 });
const T0 = Date.UTC(2026, 6, 1, 8, 0, 0);
let risposte = 0;

for (let c = 0; c < 10; c++) {
  let carta = newCard(`t:sim${c}`);
  for (let giorno = 0; giorno < 12; giorno++) {
    const quando = T0 + (giorno * 2 + c % 2) * DAY;
    const voto = (c + giorno) % 6 === 0 ? AGAIN : GOOD;
    const eraReview = carta.state === 'review';
    const nuova = carta.reps === 0;
    carta = sim.review(carta, voto, quando);
    Store.saveCard(carta);
    Store.logReview({
      id: carta.id, t: quando, g: voto, isNew: nuova, wasReview: eraReview,
      correct: voto !== AGAIN, ivl: carta.ivl, theme: c % 2 ? 'fork' : 'pin', rating: 900 + giorno * 5,
    });
    risposte += 1;
  }
}

ok(Store.getLog().length === risposte, 'il registro non ha tenuto tutte le risposte');
ok(Store.allCards(Tactics.PREFIX).length === 10, 'le carte simulate non sono tutte salvate');

const perGiorno = Stats.reviewsByDay(Store.getLog(), 14);
ok(perGiorno.length === 14, 'le risposte per giorno non coprono la finestra chiesta');
ok(perGiorno.every((d) => d.ok + d.again === d.total), 'tenute e da rifare non tornano col totale');

const previsione = Stats.forecast(Store.allCards(Tactics.PREFIX), 14);
ok(previsione.length === 14 && previsione.every((d) => d.total >= 0), 'la previsione delle scadenze è malformata');

const maturita = Stats.stateCounts(Store.allCards(Tactics.PREFIX));
ok(maturita.total === 10 && maturita.learning + maturita.young + maturita.mature === 10,
  'la distribuzione per maturità non somma alle carte');

const motivi = Stats.byTheme(Store.getLog());
ok(motivi.length === 2 && motivi.every((m) => m.rate >= 0 && m.rate <= 1), 'la resa per motivo non torna');
ok(motivi[0].rate <= motivi[1].rate, 'i motivi vanno dal peggiore al migliore');

// La ritenzione vera si calcola solo sui ripassi di carte già mature.
const ritenzione = Stats.trueRetention(Store.getLog(), 3650);
ok(ritenzione && ritenzione.n > 0 && ritenzione.rate > 0.5, 'la ritenzione vera non è calcolabile sui dati simulati');
ok(Stats.trueRetention([], 30) === null, 'senza ripassi la ritenzione deve essere nulla, non zero');

// Ottimizzatore: rigioca le storie e non deve peggiorare l'errore di previsione.
const storie = Optimizer.replay(Store.getLog());
ok(storie.length === 10, `dal registro dovrebbero uscire 10 storie, ne escono ${storie.length}`);
const prima = Optimizer.score(storie, DEFAULT_W);
const tarato = Optimizer.optimize(storie, { passes: 2 });
const dopo = Optimizer.score(storie, tarato.w);
ok(dopo.logLoss <= prima.logLoss + 1e-9, 'la taratura ha peggiorato le previsioni');
ok(tarato.w.length === 19 && tarato.w.every(Number.isFinite), 'i pesi tarati non sono 19 numeri validi');

Store.setWeights(tarato.w, { reviews: risposte });
ok(Store.getWeights().length === 19, 'i pesi tarati non si rileggono');
const suoi = createScheduler({ w: Store.getWeights(), requestRetention: 0.9 });
ok(suoi.review(newCard('t:x'), GOOD, T0).due > T0, 'lo scheduler non parte con i pesi tarati');
Store.clearWeights();
ok(Store.getWeights() === null, 'i pesi di serie non tornano dopo il ripristino');

/* --------------------------- 8. backup: fuori e dentro -------------------- */

const backup = Store.exportJson();
const info = Store.inspectBackup(backup);
ok(info.carte === 10, `il backup dovrebbe contenere 10 carte, ne dichiara ${info.carte}`);
ok(info.ripassi === risposte, 'il backup non contiene tutto il registro');

const prontuario = {
  cards: Store.allCards(Tactics.PREFIX).length,
  log: Store.getLog().length,
  settings: Store.getSettings().retention,
};

Store.reset();
ok(Store.allCards(Tactics.PREFIX).length === 0, 'l’azzeramento non ha tolto le carte');

Store.importJson(backup);
ok(Store.allCards(Tactics.PREFIX).length === prontuario.cards, 'l’import non ha rimesso le carte');
ok(Store.getLog().length === prontuario.log, 'l’import non ha rimesso il registro');
ok(Store.getSettings().retention === prontuario.settings, 'l’import non ha rimesso le impostazioni');

// Un backup di un'altra app, o un file qualunque, non deve entrare.
let respinto = 0;
for (const cattivo of ['{}', '[]', 'non json', JSON.stringify({ app: 'frasi', cards: {} })]) {
  try { Store.inspectBackup(cattivo); } catch { respinto += 1; }
}
ok(respinto === 4, `dovrebbero essere respinti 4 file non validi, ne sono stati respinti ${respinto}`);
ok(Store.allCards(Tactics.PREFIX).length === prontuario.cards, 'un file rifiutato ha comunque toccato i dati');

/* -------------------------------- verdetto ------------------------------- */

console.log(`Controlli: ${checks}`);
console.log(`Simulazione: forza vera ${TRUE_SKILL}, stimata ${state.rating}, giuste a regime ${
  Math.round((lateSolved / lateCount) * 100)}%`);

if (errors.length) {
  console.error(`\n${errors.length} problemi:`);
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
}

console.log('\nMemoria, punteggio e coda si comportano come dichiarato.');
