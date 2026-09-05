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

/* ---------------------- 9. il percorso mostrato in home ------------------- */

const Percorso = await import('../assets/js/percorso.js');

ok(Percorso.LIVELLI.length === 8, 'i livelli del percorso devono essere otto');
ok(Percorso.LIVELLI.every((l) => l.code && l.name && l.exit), 'ogni livello deve dire come ci si esce');

const attivi = Percorso.LIVELLI.filter((l) => l.state === 'attivo');
const costruiti = ['L0', 'L1', 'L2', 'L3', 'L4', 'L6', 'L7'];
ok(attivi.length === costruiti.length && attivi.every((l) => l.hash && costruiti.includes(l.code)),
  'attivi devono essere solo i livelli davvero costruiti, e devono portare da qualche parte');
ok(Percorso.LIVELLI.filter((l) => l.state === 'in-arrivo').length === 8 - costruiti.length,
  'i livelli non ancora costruiti devono restare marcati "in arrivo"');

const senzaStorico = { log: [], livelli: {} };
const av = Percorso.avanzamenti({ rating: 800, aperture: { percent: 0, stars: 0, max: 99, progress: {} }, ...senzaStorico });
ok(Object.keys(av).length === attivi.length, 'nessun avanzamento va calcolato per i livelli che non esistono');
ok(av.L3.percent === 0, 'a punteggio di partenza il livello 3 deve stare a zero');
/*
 * La barra di L3 punta al punto in cui l'esame si supera una volta su due
 * (~1542), non alla soglia nominale: a 1400 di allenamento l'esame "a 1400" si
 * supera il 3% delle volte, e una barra piena la' sarebbe una promessa falsa.
 */
const meta = Percorso.puntoMeta(1400);
ok(meta > 1400, `il punto di meta deve stare sopra la soglia nominale (vale ${meta})`);
ok(Percorso.avanzamenti({ rating: 1400, aperture: { percent: 0, stars: 0, max: 99, progress: {} }, ...senzaStorico }).L3.percent < 100,
  'a 1400 di allenamento il livello 3 non deve essere pieno: quel esame si supera il 3% delle volte');
ok(Percorso.avanzamenti({ rating: meta, aperture: { percent: 0, stars: 0, max: 99, progress: {} }, ...senzaStorico }).L3.percent === 100,
  'al punto in cui si supera una volta su due la barra deve essere piena');
ok(Percorso.avanzamenti({ rating: 3000, aperture: { percent: 0, stars: 0, max: 99, progress: {} }, ...senzaStorico }).L3.percent === 100,
  'l’avanzamento non può superare il 100%');

/* La sessione di oggi: i numeri della home devono essere quelli veri. */
const set = { newPerDay: 8, retention: 0.9 };
const primoGiorno = Percorso.oggi({ due: 0, introduced: 0, settings: set, size: 12, maxNew: 8, viste: 0 });
ok(primoGiorno.totale === 8 && primoGiorno.nuove === 8, 'il primo giorno la sessione è tutta materiale nuovo');
ok(primoGiorno.minuti >= 1, 'la durata stimata non può essere zero');

const conScadenze = Percorso.oggi({ due: 30, introduced: 0, settings: set, size: 12, maxNew: 8, viste: 100 });
ok(conScadenze.totale === 12 && conScadenze.nuove === 0,
  'con molte scadenze la sessione si riempie di ripassi, non di materiale nuovo');

const tettoPieno = Percorso.oggi({ due: 0, introduced: 8, settings: set, size: 12, maxNew: 8, viste: 100 });
ok(tettoPieno.totale === 0 && tettoPieno.tettoRaggiunto, 'a tetto pieno e senza scadenze non c’è sessione');

const finito = Percorso.oggi({ due: 0, introduced: 0, settings: set, size: 12, maxNew: 8, viste: 999999 });
ok(finito.nuove === 0 && finito.corpusFinito, 'finito il corpus non si possono promettere posizioni nuove');

/* ------------------- 10. i fondamentali, L0 e L1 -------------------------- */

const Basics = await import('../assets/js/basics.js');
const Chess = await import('../assets/js/chess.js');

/* L0: le risposte se le calcola il motore, quindi si possono ricontrollare. */
const vista = Basics.vistaPool();
ok(vista.length >= 180, `il livello 0 dovrebbe avere almeno 180 item, ne ha ${vista.length}`);
ok(new Set(vista.map((i) => i.id)).size === vista.length, 'due item della vista hanno lo stesso identificativo');
ok(vista.every((i) => i.options.filter((o) => o.ok).length === 1), 'ogni domanda deve avere una sola risposta giusta');

// a1 è scura, h1 è chiara, a8 è chiara: se questo si rompe, si rompe tutto L0.
ok(!Basics.isLight(Chess.idxOf('a1')), 'a1 deve essere scura');
ok(Basics.isLight(Chess.idxOf('h1')), 'h1 deve essere chiara');
ok(Basics.isLight(Chess.idxOf('a8')), 'a8 deve essere chiara');

const colore = vista.filter((i) => i.id.includes('colore'));
ok(colore.length === 64, 'il colore va chiesto su tutte e 64 le case');
ok(colore.every((i) => {
  const casa = Chess.idxOf(i.id.split(':')[2]);
  const chiaraGiusta = i.options.find((o) => o.ok).label === 'Chiara';
  return chiaraGiusta === Basics.isLight(casa);
}), 'una domanda sul colore ha la risposta sbagliata');

const cavalli = vista.filter((i) => i.id.includes('cavallo'));
ok(cavalli.every((i) => {
  const [from, to] = i.id.split(':')[2].split('-');
  const passi = Chess.knightDistance(Chess.idxOf(from), Chess.idxOf(to));
  return Number(i.options.find((o) => o.ok).label) === passi;
}), 'una domanda sul cavallo non corrisponde alla distanza vera');
ok(Chess.knightDistance(Chess.idxOf('a1'), Chess.idxOf('b2')) === 4, 'a1→b2 sono quattro salti, non tre');
ok(Chess.knightDistance(Chess.idxOf('g1'), Chess.idxOf('f3')) === 1, 'g1→f3 è un salto solo');

/* L1: la risposta deve essere una cattura legale su una casa non difesa. */
const sicurezza = Basics.sicurezzaPool(60);
ok(sicurezza.length >= 40, `il livello 1 dovrebbe ricavare almeno 40 item dal corpus, ne ricava ${sicurezza.length}`);

let verificati = 0;
for (const item of sicurezza) {
  const start = Chess.fromFen(item.fen);
  const prima = Chess.legalMoves(start).find((m) => Chess.nameOf(m.from) + Chess.nameOf(m.to) === item.firstMove.slice(0, 4));
  if (!prima) continue;
  const dopo = Chess.applyMove(start, prima);
  const cattura = Chess.legalMoves(dopo).some((m) => m.to === item.answer && dopo.board[m.to]);
  const difensori = Chess.attackersOf(dopo.board, item.answer, Chess.other(dopo.turn)).length;
  if (cattura && difensori === 0) verificati += 1;
}
ok(verificati === sicurezza.length,
  `${sicurezza.length - verificati} item del livello 1 non sono catture legali su case indifese`);

/*
 * La correzione del livello 1 fa vedere la ripresa: «prendi, e te lo riprendono».
 * Deve dire il vero su tutti e cinque i casi, e soprattutto deve concordare con
 * l'item — la casa giusta dev'essere libera anche secondo questa funzione.
 */
const posizione = Chess.fromFen('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
const difesa = Basics.catturaDi(posizione, Chess.idxOf('e5'));
ok(difesa.tipo === 'difesa', 'un pedone difeso dev’essere riconosciuto come difeso');
ok(Chess.nameOf(difesa.risposta.from) === 'c6', 'la ripresa deve venire dal cavallo in c6');
ok(difesa.saldo === -2, `prendere un pedone col cavallo costa 2, non ${difesa.saldo}`);
ok(Basics.catturaDi(posizione, Chess.idxOf('h6')).tipo === 'vuota', 'una casa vuota non è una cattura');
ok(Basics.catturaDi(posizione, Chess.idxOf('c4')).tipo === 'tuo', 'un pezzo proprio non si cattura');
ok(Basics.catturaDi(posizione, Chess.idxOf('a8')).tipo === 'irraggiungibile', 'un pezzo che non si può prendere va detto tale');

// Concordanza: se l'item dice «questo è libero», la scena deve dire lo stesso.
let concordi = 0;
for (const item of Basics.sicurezzaPool(40)) {
  const st0 = Chess.fromFen(item.fen);
  const prima = Chess.legalMoves(st0).find((m) => Chess.nameOf(m.from) + Chess.nameOf(m.to) === item.firstMove.slice(0, 4));
  if (!prima) continue;
  if (Basics.catturaDi(Chess.applyMove(st0, prima), item.answer).tipo === 'libera') concordi += 1;
}
ok(concordi === 40, `${40 - concordi} item del livello 1 dicono «libero» dove la scena vede una ripresa`);

// Le forme dell'italiano, che sono la metà del messaggio.
ok(Basics.nomeDi('r') === 'La torre' && Basics.participioDi('r') === 'difesa', 'la torre è difesa, non difeso');
ok(Basics.daDi('B') === 'dall’alfiere' && Basics.daDi('k') === 'dal re', 'le preposizioni articolate non tornano');

/* Le code dei fondamentali: scadenze prima, tipi mescolati. */
const codaVista = Basics.buildQueue({ axis: Basics.VISTA, due: [], known: new Set(), pool: vista });
ok(codaVista.length === Math.min(Basics.SESSION_SIZE, Basics.MAX_NEW), 'la sessione di L0 non ha la lunghezza attesa');
const attaccati = codaVista.filter((x, i) => i > 0 && Basics.tipoDi(x.item) === Basics.tipoDi(codaVista[i - 1].item)).length;
ok(attaccati === 0, `${attaccati} domande dello stesso tipo attaccate: vanno mescolate`);

/*
 * I criteri d'uscita si leggono dal registro, non da un contatore a parte.
 *
 * Da settembre 2026 questi numeri non chiudono più un livello da soli: dicono
 * soltanto che si può **provare** l'esame, che è la cosa che poi decide. È il
 * cambiamento che ha tolto di mezzo il difetto vecchio — l'uscita misurata
 * sulle stesse carte che lo scheduler stava facendo ripassare.
 */
const finto = [];
for (let i = 0; i < 20; i++) finto.push({ id: 'v:x', t: Date.now(), g: 3, axis: Basics.VISTA, correct: i < 19, ms: 2000, rating: 600 });
ok(Percorso.pronto('L0', { log: finto }), '19 giuste su 20 e mediana 2 s devono aprire l\'esame di L0');
const lente = finto.map((e) => ({ ...e, ms: 9000 }));
ok(!Percorso.pronto('L0', { log: lente }), 'giuste ma lente non devono aprire l\'esame');
ok(!Percorso.pronto('L0', { log: [] }), 'senza risposte non si va all\'esame');

const sicuro = finto.map((e) => ({ ...e, axis: Basics.SICUREZZA, rating: 800 }));
ok(Percorso.pronto('L1', { log: sicuro }), '19 controlli di sicurezza su 20 devono aprire l\'esame di L1');

/* E l'esame, da solo, è l'unica cosa che fa dire «superato». */
const aperture = { percent: 0, stars: 0, max: 99, progress: {} };
const senzaEsame = Percorso.avanzamenti({ rating: 800, aperture, log: finto, livelli: {} });
ok(senzaEsame.L0.stato === 'esame-pronto', 'senza esame sostenuto il livello non è superato, è pronto');
const conEsame = Percorso.avanzamenti({
  rating: 800, aperture, log: finto, livelli: { L0: { superatoIl: Date.now(), tenute: {} } },
});
ok(conEsame.L0.stato === 'superato', 'con l\'esame passato il livello risulta superato');

/* Il percorso comincia da L0, e la home ci manda lì. */
const nessunDato = Percorso.avanzamenti({ rating: 800, aperture, log: [], livelli: {} });
ok(Percorso.livelloCorrente(nessunDato).code === 'L0', 'chi comincia deve trovarsi sul livello 0, non sul 3');
ok(Percorso.livelloCorrente(conEsame).code === 'L1', 'superato L0 si passa a L1');

/* Partenza morbida della tattica: le prime risposte sono a una mossa sola. */
const primi = Tactics.buildQueue({ due: [], known: new Set(), rating: 800, attempts: 0 });
ok(primi.every((x) => Tactics.userPlyCount(x.puzzle) === 1),
  'finché il punteggio è provvisorio le posizioni devono avere una mossa sola');
const dopoTaratura = Tactics.buildQueue({ due: [], known: new Set(), rating: 800, attempts: 40 });
ok(dopoTaratura.some((x) => Tactics.userPlyCount(x.puzzle) > 1),
  'a punteggio tarato devono tornare anche le posizioni più lunghe');

/* ----------------------- 11. i finali, con la tavola ---------------------- */

globalThis.atob = globalThis.atob || ((b) => Buffer.from(b, 'base64').toString('binary'));
const Endgames = await import('../assets/js/endgames.js');

/*
 * La prova che conta: si gioca ogni finale fino in fondo, Bianco con la tavola
 * e Nero con la difesa migliore. Se il matto non arriva **esattamente** nelle
 * semimosse annunciate, la tavola sta mentendo — e mentirebbe a chi studia.
 */
function giocaFinale(fen) {
  let st = Chess.fromFen(fen);
  let semimosse = 0;
  while (semimosse < 120) {
    if (Endgames.isMatto(st)) return { esito: 'matto', semimosse };
    if (Endgames.isStallo(st)) return { esito: 'stallo', semimosse };
    if (st.turn === 'w') {
      let migliore = null;
      let valore = 999;
      for (const m of Chess.legalMoves(st)) {
        const v = Endgames.valoreDopo(Chess.applyMove(st, m));
        if (v === Endgames.NON_VINTA || v === Endgames.ILLEGALE) continue;
        if (v < valore) { valore = v; migliore = m; }
      }
      if (!migliore) return { esito: 'vittoria persa', semimosse };
      st = Chess.applyMove(st, migliore);
    } else {
      const risposta = Endgames.difesa(st);
      if (!risposta) return { esito: 'senza mosse', semimosse };
      st = Chess.applyMove(st, risposta);
    }
    semimosse += 1;
  }
  return { esito: 'troppo lunga', semimosse };
}

const finali = [...Endgames.partenze('Q'), ...Endgames.partenze('R')];
ok(finali.length >= 60, `le partenze dei finali dovrebbero essere almeno 60, sono ${finali.length}`);

let esatti = 0;
for (const f of finali) {
  const r = giocaFinale(f.fen);
  if (r.esito === 'matto' && r.semimosse === f.dtm) esatti += 1;
}
ok(esatti === finali.length,
  `${finali.length - esatti} finali non finiscono a matto nelle semimosse annunciate dalla tavola`);

// I massimi noti: 10 mosse con la Donna, 16 con la Torre. Se cambiano, la
// generazione è sbagliata — sono numeri da manuale, non opinioni.
const massimo = (tipo) => {
  let max = 0;
  for (let wk = 0; wk < 64; wk++) {
    for (let pezzo = 0; pezzo < 64; pezzo++) {
      for (let bk = 0; bk < 64; bk++) {
        const v = Endgames.valoreNero(tipo, wk, pezzo, bk);
        if (v !== Endgames.ILLEGALE && v !== Endgames.NON_VINTA && v > max) max = v;
      }
    }
  }
  return max;
};
ok(massimo('Q') === 20, `col la Donna il matto più lungo deve essere 20 semimosse, è ${massimo('Q')}`);
ok(massimo('R') === 32, `con la Torre il matto più lungo deve essere 32 semimosse, è ${massimo('R')}`);

// Una posizione senza il pezzo non è vinta: se la tavola dicesse altro, l'app
// accetterebbe mosse che perdono la Donna.
const senzaPezzo = Chess.fromFen('8/8/8/3k4/8/8/8/4K3 b - - 0 1');
ok(Endgames.valoreDopo(senzaPezzo) === Endgames.NON_VINTA, 'Re contro Re non può risultare vinto');

// Difesa: il Nero deve prendere il pezzo indifeso invece di farsi mattare.
const preda = Chess.fromFen('8/8/8/3k4/3Q4/8/8/4K3 b - - 0 1');
const mossaNera = Endgames.difesa(preda);
ok(mossaNera && Chess.nameOf(mossaNera.to) === 'd4', 'la difesa deve catturare la Donna indifesa');

const logFinali = Array.from({ length: 6 }, () => ({ axis: Endgames.AXIS, correct: true, t: Date.now() }));
const avFinali = Percorso.avanzamenti({
  rating: 800, aperture: { percent: 0, stars: 0, max: 99, progress: {} }, log: logFinali, livelli: {},
});
ok(avFinali.L2.percent === 100, 'sei finali puliti devono portare il livello 2 al 100%');
ok(Percorso.pronto('L2', { log: logFinali }), 'e devono aprire la prova del livello 2');

/* ------------------- 12. l'unione fra due dispositivi --------------------- */

const Sync = await import('../assets/js/sync.js');

/*
 * La parte che può far perdere mesi di ripassi se è sbagliata. «Vince l'ultimo
 * che scrive» qui non va bene: chi ripassa sul telefono e poi apre il portatile
 * perderebbe la sessione appena fatta. Si unisce carta per carta, e queste sono
 * le regole scritte in sync.js, controllate una per una.
 */
const localeSim = {
  cards: {
    'v:colore:a1': { id: 'v:colore:a1', last: 100, s: 1 },     // più vecchia della remota
    'v:colore:b2': { id: 'v:colore:b2', last: 500, s: 3 },     // solo qui
  },
  log: [{ id: 'v:colore:a1', t: 100, correct: true }, { id: 'v:colore:b2', t: 500, correct: true }],
  counts: { vista: { done: 2, correct: 2 } },
  rating: { vista: { rating: 520, attempts: 2 } },
  progress: { italiana: { stars: 2, best: 80, attempts: 3, lastAt: 10 } },
  settings: { notation: 'it', newPerDay: 4 },
  fsrs: { w: null, reviews: 0 },
  streak: { count: 2, last: '2026-08-29' },
  daily: { day: '2026-08-29', introduced: 2, reviewed: 2 },
  trainings: 3,
};

const remotoSim = {
  cards: {
    'v:colore:a1': { id: 'v:colore:a1', last: 900, s: 9 },     // ripassata dopo: vince
    'v:cavallo:a1-b2': { id: 'v:cavallo:a1-b2', last: 700, s: 2 },  // solo là
  },
  log: [{ id: 'v:colore:a1', t: 100, correct: true }, { id: 'v:colore:a1', t: 900, correct: true }],
  counts: { vista: { done: 12, correct: 9 } },                 // ha praticato di più
  rating: { vista: { rating: 640, attempts: 12 } },
  progress: { italiana: { stars: 3, best: 60, attempts: 1, lastAt: 99 } },
  settings: { notation: 'en', newPerDay: 20 },
  fsrs: { w: new Array(19).fill(1), reviews: 300 },
  streak: { count: 9, last: '2026-08-30' },
  daily: { day: '2026-08-30', introduced: 5, reviewed: 5 },
  trainings: 1,
};

const unito = Sync.unisci(localeSim, remotoSim);

ok(unito.cards['v:colore:a1'].last === 900, 'fra due copie della stessa carta deve vincere quella ripassata dopo');
ok(unito.cards['v:colore:b2'] && unito.cards['v:cavallo:a1-b2'], 'le carte che stanno da una parte sola non si perdono');
ok(Object.keys(unito.cards).length === 3, `dovrebbero restare 3 carte, ne restano ${Object.keys(unito.cards).length}`);

ok(unito.log.length === 3, `il registro va unito senza doppioni: 3 voci attese, ${unito.log.length} trovate`);
ok(unito.log[0].t <= unito.log[1].t && unito.log[1].t <= unito.log[2].t, 'il registro unito deve restare in ordine di tempo');

ok(unito.counts.vista.done === 12, 'i conteggi vengono da chi ha risposto di più, non dal più recente');
ok(unito.rating.vista.rating === 640, 'il punteggio segue i conteggi');
ok(unito.progress.italiana.stars === 3 && unito.progress.italiana.best === 80,
  'le aperture tengono il meglio delle due: 3 stelle e 80 di record');
ok(unito.settings.notation === 'it' && unito.settings.newPerDay === 4,
  'le impostazioni restano del dispositivo: sono preferenze, non progressi');
ok(unito.fsrs.reviews === 300, 'i pesi tarati su più ripassi sono quelli buoni');
ok(unito.streak.last === '2026-08-30' && unito.daily.day === '2026-08-30', 'serie e giornata prendono il giorno più avanti');
ok(unito.trainings === 3, 'gli allenamenti delle aperture non calano mai');

// L'unione non tocca gli originali: se lo facesse, un errore di rete lascerebbe
// il dispositivo con dati mezzi mescolati.
ok(localeSim.cards['v:colore:a1'].last === 100 && Object.keys(remotoSim.cards).length === 2,
  'unisci() non deve modificare i due salvataggi di partenza');

// Casi limite: senza uno dei due non si perde l'altro.
ok(Sync.unisci(localeSim, null) === localeSim, 'senza remoto resta il locale');
ok(Sync.unisci(null, remotoSim) === remotoSim, 'senza locale resta il remoto');

/*
 * La guardia sul vuoto. Non è un caso di scuola: la sessione che lavora su
 * Frasi l'ha visto succedere davvero — su un telefono appena installato ogni
 * gesto scrive, quindi la copia locale è sempre la più recente e finisce per
 * cancellare mesi di ripassi. Qui la strada è chiusa due volte: dall'unione,
 * che è simmetrica, e da questa guardia.
 */
ok(!Sync.haQualcosaDaSalvare({ cards: {}, progress: {}, log: [] }),
  'uno stato senza niente dentro non deve essere considerato salvabile');
ok(!Sync.haQualcosaDaSalvare(null), 'niente stato, niente da salvare');
ok(Sync.haQualcosaDaSalvare({ cards: { 'v:x': {} } }), 'una carta sola basta per salvare');
ok(Sync.haQualcosaDaSalvare({ progress: { italiana: {} } }), 'un’apertura iniziata basta per salvare');

const vuoto = { cards: {}, progress: {}, log: [], counts: {}, rating: {}, settings: {} };
const pieno = Sync.unisci(vuoto, localeSim);
ok(Object.keys(pieno.cards).length === 2, 'un dispositivo vuoto che si unisce a uno pieno deve prendere tutto');
ok(pieno.counts.vista.done === 2, 'e prendersi anche i conteggi, invece di azzerarli');

/* I codici: sedici caratteri, senza le lettere che si confondono. */
const codici = new Set();
for (let i = 0; i < 200; i++) codici.add(Sync.nuovoCodice());
ok(codici.size === 200, 'due codici generati non devono mai coincidere');
ok([...codici].every((c) => Sync.CODICE_RE.test(c)), 'ogni codice generato deve passare la propria convalida');
ok([...codici].every((c) => !/[ILOU]/.test(c)), 'I, L, O e U non devono comparire: si confondono a leggerle');
ok(Sync.valido('kkjq-wcdp e9jk djac'.toUpperCase().replace(/[^0-9A-Z]/g, '')), 'un codice scritto con spazi e trattini deve essere accettato');
ok(!Sync.valido('KKJQ'), 'un codice corto non è valido');
ok(!Sync.valido('KKJQWCDPE9JKDJ3I'), 'un codice con una lettera vietata non è valido');

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
