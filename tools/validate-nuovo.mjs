/*
 * validate-nuovo.mjs — le macchine nuove fanno quello che dicono?
 *
 *   node tools/validate-nuovo.mjs
 *
 * Non prova l'interfaccia: prova le sette macchine che decidono che cosa vedi,
 * che cosa conta e quando un livello si può dire superato — specchiatura,
 * stima con intervallo, esame tenuto fuori, cambio statico, posizioni quiete,
 * stato dei livelli e regime. Sono tutte pure, quindi girano per intero qui
 * dentro, sul corpus vero e non su un esempio scelto a mano.
 *
 * Le prove che contano di più sono tre, e sono quelle che smentiscono:
 *
 *   - ogni posizione specchiata viene **rigiocata sul motore**: se la
 *     trasformazione fosse sbagliata, la soluzione non sarebbe legale;
 *   - l'intervallo di confidenza viene misurato in simulazione: se dice 95%
 *     deve coprire la forza vera 95 volte su 100, e lo si conta;
 *   - ogni posizione dichiarata quieta viene **ricontrollata** con una ricerca
 *     esaustiva sulle mosse forzanti.
 */

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

const { readFileSync } = await import('node:fs');
const Mirror = await import('../assets/js/mirror.js');
const Stima = await import('../assets/js/stima.js');
const Esame = await import('../assets/js/esame.js');
const See = await import('../assets/js/see.js');
const Percorso = await import('../assets/js/percorso.js');
const Calcolo = await import('../assets/js/calcolo.js');
const Ricostruzione = await import('../assets/js/ricostruzione.js');
const Piani = await import('../assets/js/piani.js');
const Regime = await import('../assets/js/regime.js');
const Tactics = await import('../assets/js/tactics.js');
const Basics = await import('../assets/js/basics.js');
const Trappola = await import('../assets/js/trappola.js');
const Calibrato = await import('../assets/js/calibrato.js');
const Pgn = await import('../assets/js/pgn.js');
const Partite = await import('../assets/js/partite.js');
const Forzante = await import('../assets/js/forzante.js');
const { TRAPPOLE, FASCE, SOGLIA_ALTA, SALTO } = await import('../assets/js/trappole.js');
const Sync = await import('../assets/js/sync.js');
const Store = await import('../assets/js/store.js');
const { PUZZLES } = await import('../assets/js/puzzles.js');
const { QUIETE } = await import('../assets/js/quiete.js');
const { OPENINGS } = await import('../assets/js/openings.js');
const {
  fromFen, playUci, legalMoves, applyMove, inCheck, idxOf, nameOf, fen: fenDi, other,
} = await import('../assets/js/chess.js');

let checks = 0;
const errors = [];
const ok = (cond, message) => { checks += 1; if (!cond) errors.push(message); };
const near = (valore, atteso, tolleranza, message) => {
  ok(Math.abs(valore - atteso) <= tolleranza, `${message} (${valore}, atteso ${atteso} ± ${tolleranza})`);
};

const GIORNO = 86400000;

/* ------------------- 1. la specchiatura non inventa niente ---------------- */

let specchiate = 0;
let ribaltate = 0;
for (const p of PUZZLES) {
  for (const forma of ['specchiata', 'ribaltata', 'entrambe']) {
    const v = Mirror.variante(p, forma);
    if (v.forma === 'dritta') continue;          // arrocco ancora possibile: si salta, ed è giusto
    const stato = fromFen(v.f);
    if (!stato) { errors.push(`${p.id} ${forma}: FEN non leggibile`); checks += 1; continue; }
    const linea = playUci(v.m.split(' '), stato);
    checks += 1;
    if (!linea || linea.moves.length !== v.m.split(' ').length) {
      errors.push(`${p.id} ${forma}: la soluzione trasformata non è giocabile`);
      continue;
    }
    if (forma === 'specchiata') specchiate += 1;
    if (forma === 'ribaltata') ribaltate += 1;
  }
}
ok(specchiate > PUZZLES.length * 0.6, `troppe poche posizioni specchiabili: ${specchiate} su ${PUZZLES.length}`);
ok(ribaltate === PUZZLES.length, `il ribaltamento deve valere per tutte: ${ribaltate}/${PUZZLES.length}`);

/* Specchiare due volte torna al punto di partenza: è la prova che è un'involuzione. */
const campione = PUZZLES.filter((p) => Mirror.specchiabile(p.f)).slice(0, 200);
for (const p of campione) {
  ok(Mirror.specchia(Mirror.specchia(p.f)) === p.f, `${p.id}: specchiare due volte non torna all'originale`);
  ok(Mirror.ribalta(Mirror.ribalta(p.f)) === p.f, `${p.id}: ribaltare due volte non torna all'originale`);
}

/* Il colore di chi muove: specchiando resta, ribaltando si scambia. */
for (const p of campione.slice(0, 50)) {
  ok(Mirror.specchia(p.f).split(' ')[1] === p.f.split(' ')[1], `${p.id}: la specchiatura non deve cambiare chi muove`);
  ok(Mirror.ribalta(p.f).split(' ')[1] !== p.f.split(' ')[1], `${p.id}: il ribaltamento deve cambiare chi muove`);
}

/* La forma è deterministica e la prima presentazione è sempre dritta. */
for (const p of PUZZLES.slice(0, 100)) {
  ok(Mirror.formaPer(p, 0) === 'dritta', `${p.id}: la prima volta la posizione va vista dritta`);
  ok(Mirror.formaPer(p, 3) === Mirror.formaPer(p, 3), `${p.id}: la forma deve essere deterministica`);
}

/* ------------------ 2. l'intervallo copre quello che dice ---------------- */

let coperti = 0;
const PROVE = 3000;
/*
 * xorshift32 con Math.imul: un congruenziale lineare scritto in JS perde
 * precisione oltre 2^53 e falsa proprio il numero che qui si vuole misurare.
 * Deterministico, così la copertura riportata si può rifare identica.
 */
let seed = 2463534242;
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
};
for (let s = 0; s < PROVE; s++) {
  const risposte = [];
  for (let i = 0; i < Esame.ITEM; i++) {
    const d = 1250 + i * (300 / Esame.ITEM);
    risposte.push({ d, ok: rnd() < Stima.probabilita(1400, d) });
  }
  const e = Stima.stima(risposte);
  if (e.lo !== null && e.lo <= 1400 && e.hi >= 1400) coperti += 1;
}
const copertura = coperti / PROVE;
ok(copertura > 0.92 && copertura < 0.98, `l'intervallo al 95% copre il ${(copertura * 100).toFixed(1)}%: non è quello che dichiara`);

/* Più risposte, intervallo più stretto: se non fosse così non sarebbe informazione. */
const corte = Stima.stima(Array.from({ length: 12 }, (_, i) => ({ d: 1400, ok: i % 2 === 0 })));
const lunghe = Stima.stima(Array.from({ length: 96 }, (_, i) => ({ d: 1400, ok: i % 2 === 0 })));
ok(lunghe.hi - lunghe.lo < corte.hi - corte.lo, 'con più risposte l\'intervallo deve stringersi');

/* Le code: si dichiarano sature invece di stampare un numero inventato. */
const tutteGiuste = Stima.stima(Array.from({ length: 24 }, () => ({ d: 1400, ok: true })));
ok(tutteGiuste.saturo === 'alto', 'ventiquattro su ventiquattro deve dichiararsi saturata in alto');
ok(Stima.testo(tutteGiuste).startsWith('almeno'), 'una stima saturata si scrive "almeno", non come un punto');
const nessuna = Stima.stima(Array.from({ length: 24 }, () => ({ d: 1400, ok: false })));
ok(nessuna.saturo === 'basso', 'zero su ventiquattro deve dichiararsi saturata in basso');

/* Sotto il minimo di risposte non si passa mai, per quanto alta sia la stima. */
ok(!Stima.superaSoglia(Stima.stima([{ d: 2000, ok: true }, { d: 2000, ok: true }]), 1400),
  'due risposte non possono far superare una soglia');

/* La soglia guarda il limite inferiore, non la stima. */
const alPelo = Stima.stima(Array.from({ length: 24 }, (_, i) => ({ d: 1400, ok: i < 15 })));
ok(alPelo.rating > 1400, 'controllo di scena: la stima puntuale sta sopra la soglia');
ok(!Stima.superaSoglia(alPelo, 1400), 'con il limite inferiore sotto la soglia non si deve passare, anche se la stima è sopra');

/* ------------------- 3. l'esame è davvero tenuto fuori ------------------- */

const allenamento = Esame.poolAllenamento(PUZZLES);
const esame = Esame.poolEsame(PUZZLES);
ok(allenamento.length + esame.length === PUZZLES.length, 'la divisione deve coprire tutto il corpus');
const idsAllenamento = new Set(allenamento.map((p) => p.id));
ok(esame.every((p) => !idsAllenamento.has(p.id)), 'nessuna posizione può stare da tutte e due le parti');
/*
 * La quota e' l'8% del corpus: si controlla la proporzione, non un numero
 * assoluto. Con un numero assoluto questo test andava rifatto a ogni
 * rigenerazione del corpus - e un test che si riscrive a ogni build non
 * controlla il codice, insegue i dati.
 */
const quotaVera = esame.length / PUZZLES.length;
near(quotaVera, Esame.QUOTA, 0.02, 'la quota tenuta fuori deve essere quella dichiarata');
ok(esame.length >= Esame.ITEM * 3,
  `servono almeno tre esami di scorta, ce ne sono ${Math.floor(esame.length / Esame.ITEM)}`);

/* Deterministica: rieseguita dà lo stesso insieme. */
ok(Esame.poolEsame(PUZZLES).map((p) => p.id).join() === esame.map((p) => p.id).join(),
  'la divisione deve essere deterministica');

/* La coda dell'allenamento non deve mai contenere una posizione d'esame. */
const coda = Tactics.buildQueue({ due: [], known: new Set(), rating: 1400, attempts: 100, size: 200, maxNew: 200 });
ok(coda.length > 0, 'la coda di prova non deve essere vuota');
ok(coda.every((x) => !Esame.inEsame(x.puzzle.id)), 'una posizione d\'esame è finita nella coda di allenamento');

/* Anche con il punteggio provvisorio (pool ristretto) la regola vale. */
const codaGiovane = Tactics.buildQueue({ due: [], known: new Set(), rating: 800, attempts: 3, size: 60, maxNew: 60 });
ok(codaGiovane.every((x) => !Esame.inEsame(x.puzzle.id)), 'la partenza morbida non deve pescare dagli item d\'esame');

/* Un esame si compone a ogni soglia, con i motivi mescolati. */
for (const soglia of [800, 1000, 1200, 1400, 1600, 1800]) {
  const items = Esame.componi({ pool: PUZZLES, soglia });
  ok(items.length === Esame.ITEM, `esame a ${soglia}: ${items.length} item invece di ${Esame.ITEM}`);
  ok(items.every((p) => Esame.inEsame(p.id)), `esame a ${soglia}: c'è dentro roba di allenamento`);
  ok(new Set(items.map((p) => p.id)).size === items.length, `esame a ${soglia}: item ripetuti`);
  let attaccati = 0;
  for (let i = 1; i < items.length; i++) if (items[i].t === items[i - 1].t) attaccati += 1;
  ok(attaccati <= 2, `esame a ${soglia}: ${attaccati} coppie di motivi uguali attaccate`);
  const media = items.reduce((s, p) => s + p.r, 0) / items.length;
  ok(Math.abs(media - soglia) < 260, `esame a ${soglia}: difficoltà media ${Math.round(media)}, troppo lontana`);
}

/* Gli item spesi non tornano. */
const primo = Esame.componi({ pool: PUZZLES, soglia: 1400 });
const secondo = Esame.componi({ pool: PUZZLES, soglia: 1400, spesi: new Set(primo.map((p) => p.id)) });
ok(secondo.every((p) => !primo.some((q) => q.id === p.id)), 'un item d\'esame non si può spendere due volte');

/* --------------------- 4. il pavimento per motivo morde ------------------ */

const logForte = Array.from({ length: 40 }, (_, i) => ({ axis: 'tattica', theme: 'fork', correct: true }));
const logDebole = Array.from({ length: 12 }, (_, i) => ({ axis: 'tattica', theme: 'pin', correct: i < 4 }));
const deboli = Esame.motiviDeboli([...logForte, ...logDebole], { axis: 'tattica' });
ok(deboli.length === 1 && deboli[0].theme === 'pin', 'il pavimento deve trovare l\'inchiodatura al 33%');

/* Sotto il minimo di risposte un motivo non blocca: sarebbe rumore. */
const rumore = Array.from({ length: 4 }, () => ({ axis: 'tattica', theme: 'skewer', correct: false }));
ok(Esame.motiviDeboli(rumore, { axis: 'tattica' }).length === 0, 'quattro risposte non bastano per bloccare un livello');

/* L'asse conta: senza `axis` il pavimento non deve vedere righe di altri livelli. */
const altroAsse = Array.from({ length: 12 }, () => ({ axis: 'vista', theme: 'pin', correct: false }));
ok(Esame.motiviDeboli(altroAsse, { axis: 'tattica' }).length === 0, 'il pavimento della tattica non deve leggere le righe della vista');

/* E il verdetto di L3 li mette insieme tutti e due. */
const buone = Array.from({ length: 24 }, (_, i) => ({ d: 1700, ok: true, theme: i % 2 ? 'fork' : 'pin' }));
ok(Percorso.verdetto('L3', buone).passa, 'ventiquattro su ventiquattro a 1700 deve passare la soglia 1400');
const conBuco = buone.map((r, i) => (r.theme === 'pin' && i < 20 ? { ...r, ok: false } : r));
const vBuco = Percorso.verdetto('L3', conBuco);
ok(!vBuco.passa, 'un motivo sotto il pavimento deve bloccare il livello anche con il punteggio alto');
ok(vBuco.deboli.some((d) => d.theme === 'pin'), 'e deve dire quale motivo');

/* ------------------ 5. il cambio statico conta, non stima ---------------- */

const casi = [
  // FEN, da, a, guadagno atteso, che cosa prova
  ['4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5', 1, 'pedone indifeso: si guadagna un pedone'],
  ['4k3/8/2p5/3p4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5', -4, 'pedone difeso da un pedone: la torre perde quattro'],
  ['4k3/8/2p5/3p4/8/8/3R4/3RK3 w - - 0 1', 'd2', 'd5', -3, 'con la seconda torre si riprende il pedone: si perde tre, non quattro'],
  ['4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1', 'd2', 'd5', 3, 'cavallo indifeso: tre'],
];
for (const [fen, da, a, atteso, cosa] of casi) {
  const stato = fromFen(fen);
  ok(See.seeCattura(stato.board, idxOf(da), idxOf(a)) === atteso, `cambio statico — ${cosa}`);
}

/* I pendenti: il pezzo in presa lo trova, quello difeso no. */
const conPendente = fromFen('4k3/8/8/3n4/8/8/3R4/4K3 w - - 0 1');
ok(See.pendenti(conPendente, 'b').length === 1, 'il cavallo indifeso deve risultare in presa');
const difeso = fromFen('4k3/8/2p5/3n4/8/8/3R4/4K3 w - - 0 1');
ok(See.pendenti(difeso, 'b').length === 0, 'un cavallo difeso da un pedone non è "in presa" per una torre');

/* Il matto in una, e la confutazione che lo trova. */
const matto = fromFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
ok(See.mattoInUno(matto) !== null, 'Ta8 è matto e deve essere trovato');
ok(See.confutazione(matto).tipo === 'matto', 'la confutazione deve preferire il matto a qualunque cattura');

/*
 * E la prova che conta: su tutto il corpus, dopo una mossa a caso legale che
 * lascia un pezzo in presa, la confutazione deve esistere. Se il conto fosse
 * sbagliato, qui si vedrebbe.
 */
let confutate = 0;
let occasioni = 0;
for (const p of PUZZLES.slice(0, 300)) {
  const stato = fromFen(p.f);
  const dopoPrima = applyMove(stato, playUci([p.m.split(' ')[0]], stato).moves[0]);
  const mosse = legalMoves(dopoPrima);
  for (const m of mosse.slice(0, 6)) {
    const dopo = applyMove(dopoPrima, m);
    const inPresa = See.pendenti(dopo, dopoPrima.turn);
    if (!inPresa.length || inPresa[0].perdita < 3) continue;
    occasioni += 1;
    if (See.confutazione(dopo)) confutate += 1;
  }
}
ok(occasioni > 100, `troppe poche occasioni per provare la confutazione: ${occasioni}`);
ok(confutate === occasioni, `${occasioni - confutate} volte un pezzo restava in presa e la confutazione non l'ha trovato`);

/* La classifica dell'errore riconosce il pezzo regalato. */
const regalo = fromFen('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1');
const versoIlRe = legalMoves(regalo).find((m) => nameOf(m.to) === 'd7');
if (versoIlRe) {
  const c = See.classifica(regalo, versoIlRe, { soluzione: [], indice: 0 });
  ok(c.tipo === 'regala', `la torre in d7 accanto al re è un regalo, non "${c.tipo}"`);
}

/* ------------- 6. le posizioni quiete sono davvero quiete ---------------- */

function guadagnoForzante(stato, profondita) {
  if (profondita <= 0) return 0;
  const mosse = legalMoves(stato);
  if (!mosse.length) return inCheck(stato, stato.turn) ? -1000 : 0;
  let migliore = 0;
  for (const m of mosse) {
    const dopo = applyMove(stato, m);
    const scacco = inCheck(dopo, dopo.turn);
    if (!m.capture && !scacco) continue;
    if (scacco && legalMoves(dopo).length === 0) return 1000;
    const preso = m.capture ? See.seeCattura(stato.board, m.from, m.to) : 0;
    const risposta = guadagnoForzante(dopo, profondita - 1);
    const netto = m.capture ? preso - Math.max(0, risposta) : -risposta;
    if (netto > migliore) migliore = netto;
  }
  return migliore;
}

ok(QUIETE.length > PUZZLES.length * 0.1, `troppe poche posizioni quiete: ${QUIETE.length} su ${PUZZLES.length}`);
let nonQuiete = 0;
for (const q of QUIETE) {
  const stato = fromFen(q.f);
  checks += 1;
  if (!stato) { errors.push(`quieta ${q.id}: FEN illegale`); continue; }
  if (inCheck(stato, stato.turn)) { nonQuiete += 1; continue; }
  if (guadagnoForzante(stato, 3) >= 2) nonQuiete += 1;
}
ok(nonQuiete === 0, `${nonQuiete} posizioni dichiarate quiete hanno invece una tattica`);

/* Un quarto della sessione, e distribuite invece che ammucchiate. */
const q = Tactics.quiete({ rating: 1200, size: 12 });
ok(q.length === 3, `su dodici posizioni ne servono tre quiete, non ${q.length}`);
const intrecciata = Tactics.intreccia(Array.from({ length: 12 }, (_, i) => ({ puzzle: { id: `t${i}`, t: 'fork' } })), q);
ok(intrecciata.length === 15, 'l\'intreccio deve conservare tutte le posizioni');
const posizioni = intrecciata.map((x, i) => (x.quieta ? i : -1)).filter((i) => i >= 0);
ok(posizioni[0] >= 2 && posizioni[posizioni.length - 1] <= 13, `le quiete sono ammucchiate: ${posizioni.join(',')}`);

/* ---------------- 7. lo stato dei livelli e le tenute -------------------- */

const adesso = 1_700_000_000_000;
ok(Esame.statoLivello(null, { now: adesso }).stato === 'in-corso', 'senza record il livello è in corso');
ok(Esame.statoLivello(null, { now: adesso, pronto: true }).stato === 'esame-pronto', 'se i dati dicono che si può provare, si dice');

const appenaSuperato = { superatoIl: adesso, tenute: {} };
ok(Esame.statoLivello(appenaSuperato, { now: adesso + GIORNO }).stato === 'superato', 'il giorno dopo il livello è superato e basta');
ok(Esame.statoLivello(appenaSuperato, { now: adesso + 8 * GIORNO }).stato === 'da-riverificare', 'dopo sette giorni tocca la prima tenuta');
ok(Esame.statoLivello(appenaSuperato, { now: adesso + 8 * GIORNO }).prossima.tipo === 'tenuta7', 'e deve essere la tenuta a sette giorni');

const settePassata = { superatoIl: adesso, tenute: { tenuta7: adesso + 8 * GIORNO } };
ok(Esame.statoLivello(settePassata, { now: adesso + 10 * GIORNO }).stato === 'superato', 'fatta la prima tenuta si torna superati');
ok(Esame.statoLivello(settePassata, { now: adesso + 31 * GIORNO }).stato === 'da-riverificare', 'dopo trenta giorni tocca la seconda');

const entrambe = { superatoIl: adesso, tenute: { tenuta7: 1, tenuta30: 2 } };
ok(Esame.statoLivello(entrambe, { now: adesso + 400 * GIORNO }).stato === 'superato', 'fatte tutte e due, non si richiede più niente');
ok(Esame.statoLivello(entrambe, { now: adesso + 400 * GIORNO }).prossima === null, 'e non c\'è una prossima verifica');

const riaperto = { superatoIl: adesso, tenute: {}, riaperto: true };
ok(Esame.statoLivello(riaperto, { now: adesso + 40 * GIORNO }).stato === 'riaperto', 'una tenuta fallita riapre il livello');

/* ------------------------ 8. i livelli nuovi ----------------------------- */

/* L4: le profondità esistono davvero nel corpus, e la scala sale e scende. */
for (const p of Calcolo.PROFONDITA) {
  ok(Calcolo.poolPer(p).length >= 100, `L4: solo ${Calcolo.poolPer(p).length} posizioni a ${p} semimosse`);
  ok(Calcolo.poolPer(p).every((x) => Number.isFinite(x.rd)), `L4: al pool a ${p} semimosse manca la deviazione`);
  ok(Calcolo.poolPer(p).every((x) => x.m.split(' ').length === p), `L4: pool a ${p} semimosse sporco`);
  ok(Calcolo.poolPer(p).every((x) => !Esame.inEsame(x.id)), `L4: item d'esame nel pool di allenamento a ${p}`);
}
ok(Calcolo.profonditaDi([]) === 2, 'L4: si comincia da due semimosse');
const dieciBuone = Array.from({ length: 10 }, () => ({ axis: 'calcolo', semimosse: 2, correct: true }));
ok(Calcolo.profonditaDi(dieciBuone) === 4, 'L4: dieci su dieci a due semimosse deve far salire a quattro');
const dieciScarse = Array.from({ length: 10 }, (_, i) => ({ axis: 'calcolo', semimosse: 4, correct: i < 3 }));
ok(Calcolo.profonditaDi([...dieciBuone, ...dieciScarse]) === 2, 'L4: tre su dieci a quattro semimosse deve far scendere');
const uscita4 = Calcolo.uscita(Array.from({ length: 10 }, (_, i) => ({ axis: 'calcolo', semimosse: 4, correct: i < 8 })));
ok(uscita4.percent === 100, `L4: otto su dieci deve valere il 100% verso l'uscita, non ${uscita4.percent}%`);

/* L0 ricostruzione: le posizioni casuali restano posizioni legali. */
let casualiOk = 0;
for (const p of Ricostruzione.reali(PUZZLES).slice(0, 120)) {
  const mescolata = Ricostruzione.rimescola(p.f, 3);
  const stato = fromFen(mescolata);
  checks += 1;
  if (!stato) { errors.push(`ricostruzione: FEN illegale da ${p.id}`); continue; }
  const pezziPrima = p.f.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
  const pezziDopo = mescolata.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
  if (pezziPrima !== pezziDopo) { errors.push(`ricostruzione: ${p.id} ha perso pezzi nel rimescolamento`); continue; }
  casualiOk += 1;
}
ok(casualiOk >= 115, `ricostruzione: solo ${casualiOk}/120 rimescolamenti riusciti`);

const sessioneRic = Ricostruzione.costruisci({ seed: 11 });
ok(sessioneRic.filter((x) => x.vera).length === sessioneRic.length / 2, 'ricostruzione: metà vere e metà casuali');
const punteggioPieno = Ricostruzione.punteggio(sessioneRic[0].fen, sessioneRic[0].fen);
ok(punteggioPieno.quota === 1, 'ricostruzione: la posizione identica deve valere 1');
ok(Ricostruzione.punteggio(sessioneRic[0].fen, '8/8/8/8/8/8/8/8 w - - 0 1').giusti === 0,
  'ricostruzione: una scacchiera vuota non deve avere pezzi giusti');
ok(!Ricostruzione.divario([]).pronto, 'ricostruzione: senza prove non si dichiara nessun divario');

/* L6 i piani: distrattori dalla stessa famiglia, e nessun piano ripetuto. */
let stessaFamiglia = 0;
for (const o of OPENINGS) {
  const it = Piani.item(o);
  ok(it.opzioni.length === Piani.OPZIONI, `piani: ${o.id} ha ${it.opzioni.length} alternative`);
  ok(it.opzioni.filter((x) => x.giusta).length === 1, `piani: ${o.id} non ha esattamente una risposta giusta`);
  ok(new Set(it.opzioni.map((x) => x.testo)).size === it.opzioni.length, `piani: ${o.id} ha due alternative identiche`);
  const giusta = it.opzioni.find((x) => x.giusta);
  ok(giusta.testo === Piani.sintesi(o.plan), `piani: ${o.id} la risposta giusta non è il suo piano`);
  if (it.stessaFamiglia > 0) stessaFamiglia += 1;
}
ok(stessaFamiglia >= OPENINGS.length * 0.6,
  `piani: solo ${stessaFamiglia}/${OPENINGS.length} aperture hanno distrattori della stessa famiglia`);

/* Deterministico: la risposta giusta non finisce sempre nello stesso posto. */
const posizioniGiusta = OPENINGS.map((o) => Piani.item(o).opzioni.findIndex((x) => x.giusta));
ok(new Set(posizioniGiusta).size >= 2, 'piani: la risposta giusta sta sempre nella stessa posizione');
ok(Piani.item(OPENINGS[0]).opzioni[0].id === Piani.item(OPENINGS[0]).opzioni[0].id, 'piani: le alternative devono essere deterministiche');

/* L'uscita di L6 vuole la linea **e** il piano. */
const soloLinea = Object.fromEntries(OPENINGS.map((o) => [o.id, { stars: 3 }]));
ok(Piani.uscita({ progressi: soloLinea }).percent === 0, 'L6: le stelle da sole non devono valere il 100%');
const linePiuPiano = Object.fromEntries(OPENINGS.map((o) => [o.id, { stars: 3, pianoOk: true }]));
ok(Piani.uscita({ progressi: linePiuPiano }).percent === 100, 'L6: linea e piano insieme devono chiudere il livello');

/* --------------------- 9. il regime non inventa numeri -------------------- */

ok(!Regime.fatica([]).pronto, 'regime: senza sessioni non si dichiara nessuna curva di fatica');
ok(!Regime.freno([true, false, true]).pronto, 'regime: tre esiti non bastano per parlare di freno');
ok(!Regime.resaPerOra([], 'tattica').pronto, 'regime: senza minuti non si dichiara nessuna resa oraria');

/* Con abbastanza sessioni la fatica si misura, e il calo si vede. */
const logFatica = [];
for (let s = 0; s < 8; s++) {
  const base = s * 3 * 3600000;
  for (let i = 0; i < 12; i++) {
    logFatica.push({
      axis: 'tattica', t: base + i * 60000, correct: i < 6 ? true : i % 3 !== 0, rating: 1200,
    });
  }
}
const f = Regime.fatica(logFatica);
ok(f.pronto, 'regime: otto sessioni da dodici devono bastare');
ok(f.testa > f.coda, 'regime: in questo registro la prima metà va meglio della seconda, e va detto');
ok(f.difficoltaSimile, 'regime: a parità di difficoltà il confronto è pulito, e lo deve dire');

/* Le sessioni si ricavano dai buchi nel registro. */
const sessioni = Regime.raggruppaSessioni(logFatica);
ok(sessioni.length === 8, `regime: ${sessioni.length} sessioni invece di 8`);

/* Il freno si dichiara solo se l'effetto è nei dati. */
const senzaEffetto = Array.from({ length: 120 }, (_, i) => i % 2 === 0);
const fr = Regime.freno(senzaEffetto);
ok(fr.pronto === false || Math.abs(fr.effetto) < 0.3, 'regime: su esiti alternati non deve comparire un freno grosso');

/* I minuti vengono dai tempi veri, non da una stima per risposta. */
const minuti = Regime.minutiPerAsse([
  { axis: 'tattica', ms: 60000, t: 1 }, { axis: 'tattica', ms: 60000, t: 2 }, { axis: 'vista', ms: 30000, t: 3 },
]);
ok(minuti.tattica === 2 && minuti.vista === 0.5, `regime: minuti sbagliati ${JSON.stringify(minuti)}`);

/* --------------- 10. i progressi nuovi sopravvivono all'unione ------------ */

const locale = {
  progress: { italiana: { stars: 3, best: 90, attempts: 2, lastAt: 10, pianoOk: true, pianoAt: 50 } },
  esami: [{ livello: 'L3', tipo: 'uscita', t: 100, passa: true }],
  livelli: { L3: { superatoIl: 100, tenute: { tenuta7: 200 } } },
  spesi: ['a', 'b'],
  cards: {}, log: [], rating: {}, counts: {}, settings: {}, fsrs: {}, streak: {}, daily: {},
};
const remoto = {
  progress: { italiana: { stars: 2, best: 95, attempts: 5, lastAt: 20 } },
  esami: [{ livello: 'L1', tipo: 'uscita', t: 90, passa: true }],
  livelli: { L3: { superatoIl: 80, tenute: { tenuta30: 300 } } },
  spesi: ['b', 'c'],
  cards: {}, log: [], rating: {}, counts: {}, settings: {}, fsrs: {}, streak: {}, daily: {},
};
const unito = Sync.unisci(locale, remoto);
ok(unito.progress.italiana.pianoOk === true, 'unione: il piano nominato non deve sparire');
ok(unito.progress.italiana.stars === 3 && unito.progress.italiana.best === 95, 'unione: il meglio delle due, come sempre');
ok(unito.esami.length === 2, 'unione: gli esami dei due dispositivi si sommano');
ok(unito.spesi.length === 3, `unione: gli item spesi vanno uniti senza doppioni (${unito.spesi.length})`);
ok(unito.livelli.L3.superatoIl === 80, 'unione: vale il superamento più antico, è quello che fa partire l\'orologio');
ok(unito.livelli.L3.tenute.tenuta7 === 200 && unito.livelli.L3.tenute.tenuta30 === 300,
  'unione: le tenute fatte sui due dispositivi si sommano');

/* E il magazzino sa scrivere e rileggere le cose nuove. */
memory.clear();
Store.setLivello('L3', { superatoIl: 1234, tenute: {} });
ok(Store.getLivello('L3').superatoIl === 1234, 'store: lo stato del livello si rilegge');
Store.addEsame({ livello: 'L3', tipo: 'uscita', t: 1, passa: false, items: ['x1', 'x2'] });
ok(Store.getEsami('L3').length === 1, 'store: l\'esame si rilegge');
ok(Store.itemSpesi().has('x1'), 'store: gli item dell\'esame risultano spesi');
Store.savePiano('italiana', true);
ok(Store.getProgress('italiana').pianoOk === true, 'store: il piano nominato si salva');
Store.savePiano('italiana', false);
ok(Store.getProgress('italiana').pianoOk === true, 'store: un piano già nominato non si disimpara sbagliando dopo');

/* --------------- 11. l'app non promette livelli che non ha --------------- */

for (const l of Percorso.LIVELLI) {
  if (l.state !== 'attivo') {
    ok(!l.hash, `${l.code} è "in arrivo" ma ha una schermata`);
    continue;
  }
  ok(!!l.hash, `${l.code} è attivo ma non ha una schermata`);
  /* L7 e' attivo e senza esame: e' una scelta dichiarata, non una mancanza. */
  ok(!!l.esame || l.senzaEsame === true,
    `${l.code} è attivo senza criterio d'esame e senza dichiararlo`);
}
const avanz = Percorso.avanzamenti({ rating: 900, aperture: { progress: {} }, log: [], livelli: {} });
const attiviOra = Percorso.LIVELLI.filter((l) => l.state === 'attivo').length;
ok(Object.keys(avanz).length === attiviOra, `gli avanzamenti devono coprire i ${attiviOra} livelli attivi, non ${Object.keys(avanz).length}`);
ok(Object.values(avanz).every((a) => a.percent >= 0 && a.percent <= 100), 'nessun avanzamento fuori da 0-100');
ok(!('L5' in avanz), 'L5 non e ancora costruito e non deve avere un avanzamento');
ok('L7' in avanz && avanz.L7.senzaSoglia === true,
  'L7 e attivo ma senza soglia: la sua riga conta, non misura un avanzamento');

/* La sessione di oggi conta il corpus allenabile, non quello intero. */
const oggi = Percorso.oggi({ due: 0, introduced: 0, settings: { newPerDay: 8 }, size: 12, maxNew: 8, viste: 0 });
ok(oggi.allenabili === allenamento.length, 'la home deve contare le posizioni allenabili, non tutte');
ok(oggi.allenabili < PUZZLES.length, 'e devono essere meno di tutte, altrimenti l\'esame non è tenuto fuori');

/* --------- 12. il livello 1 sa dire perche', per ogni casa toccata --------- */

/*
 * Il difetto che questi controlli esistono per non far tornare: la scena della
 * ripresa partiva solo se il pezzo scelto era difeso. Chi toccava un pezzo che
 * non poteva nemmeno catturare non riceveva nessuna spiegazione, e restava con
 * la domanda vera in mano — «chi me lo riprende».
 *
 * Quindi qui si tocca **ogni casa possibile** di un campione di item veri e si
 * pretende che l'app abbia sempre qualcosa di vero da dire.
 */

const itemL1 = Basics.sicurezzaPool(120).filter((it) => it.kind === 'tocco');
ok(itemL1.length >= 60, `troppi pochi item del livello 1 per provare: ${itemL1.length}`);

let senzaSpiegazione = 0;
let difensoriSbagliati = 0;
let casiVisti = { vuota: 0, tuo: 0, irraggiungibile: 0, libera: 0, difesa: 0 };

for (const item of itemL1.slice(0, 60)) {
  const partenza = fromFen(item.fen);
  const prima = legalMoves(partenza).find(
    (m) => nameOf(m.from) + nameOf(m.to) === item.firstMove.slice(0, 4),
  );
  if (!prima) continue;
  const stato = applyMove(partenza, prima);

  for (let casa = 0; casa < 64; casa++) {
    if (casa === item.answer) continue;
    const sp = Basics.perche(stato, casa, item.answer);
    checks += 1;
    if (!sp.testo || sp.testo.length < 10) { senzaSpiegazione += 1; continue; }
    casiVisti[sp.tipo] = (casiVisti[sp.tipo] || 0) + 1;

    /*
     * Ogni difensore dichiarato deve poter davvero **riprendere**.
     *
     * Dove la cattura si può fare, la prova è quella vera: si gioca la cattura
     * e si guarda chi ha una risposta legale su quella casa. Dove non si può
     * (il pezzo è irraggiungibile) si mette un pezzo mio come esca, che è la
     * definizione operativa di «difeso».
     */
    if (sp.tipo === 'difesa') {
      const dopoCattura = applyMove(stato, sp.mossa);
      for (const d of sp.difensori) {
        const puo = legalMoves(dopoCattura).some((m) => m.from === d.from && m.to === casa);
        if (!puo) difensoriSbagliati += 1;
      }
      /* E la ripresa scelta dev'essere una di quelle elencate. */
      if (!sp.difensori.some((d) => d.from === sp.risposta.from)) difensoriSbagliati += 1;
    } else {
      for (const d of sp.difensori || []) {
        const conEsca = { ...stato, board: stato.board.slice(), turn: other(stato.turn), ep: null };
        conEsca.board[casa] = stato.turn === 'w' ? 'Q' : 'q';
        const puo = legalMoves(conEsca).some((m) => m.from === d.from && m.to === casa && m.capture);
        if (!puo) difensoriSbagliati += 1;
      }
    }
  }
}

ok(senzaSpiegazione === 0, `${senzaSpiegazione} case toccate non ricevono nessuna spiegazione`);
ok(difensoriSbagliati === 0, `${difensoriSbagliati} difensori dichiarati non possono davvero riprendere`);
ok(casiVisti.irraggiungibile > 0, 'il caso "non ci arrivo" deve comparire, ed e\' quello che prima taceva');
ok(casiVisti.difesa > 0, 'il caso "e\' difeso" deve comparire');
ok(casiVisti.tuo > 0, 'anche toccare un proprio pezzo deve avere una risposta');
ok(casiVisti.vuota > 0, 'anche toccare una casa vuota deve avere una risposta');

/*
 * Un difensore inchiodato non e' un difensore: e' la differenza fra la
 * geometria e le mosse legali, ed e' quella che rende la spiegazione vera.
 */
const inchiodato = fromFen('4k3/8/8/8/8/4b3/4N3/4K3 w - - 0 1');
ok(Basics.difensoriDi(inchiodato, idxOf('e3')).length === 0,
  'il cavallo in e2 e\' inchiodato dall\'alfiere: non difende niente');

/*
 * Il pedone che difende in diagonale: il caso che la prima versione perdeva.
 * b6 e' difeso dal pedone c7, e su una casa svuotata non lo si sarebbe visto.
 */
const conPedone = fromFen('4k3/2p5/1p6/8/8/8/8/4K3 w - - 0 1');
const difB6 = Basics.difensoriDi(conPedone, idxOf('b6'));
ok(difB6.length === 1, `b6 e' difeso dal pedone c7: ${difB6.length} difensori trovati`);
ok(difB6[0].from === idxOf('c7'), 'e il difensore deve essere proprio quello in c7');
ok(Basics.elenco(difB6).includes('c7'), `l'elenco deve nominare la casa: "${Basics.elenco(difB6)}"`);
ok(Basics.elenco([]) === 'da nessuno', 'senza difensori si dice "da nessuno"');

/* E una spinta di pedone non e' una difesa: b7 non difende b6. */
const soloSpinta = fromFen('4k3/1p6/8/8/8/8/8/4K3 w - - 0 1');
ok(Basics.difensoriDi({ ...soloSpinta, board: (() => {
  const b = soloSpinta.board.slice(); b[idxOf('b6')] = 'n'; return b;
})() }, idxOf('b6')).length === 0, 'il pedone in b7 puo\' spingere su b6, ma non lo difende');

/* Il caso insidioso: un pezzo gratis, ma non quello che valeva di piu'. */
let trovatoMinore = 0;
for (const item of itemL1.slice(0, 60)) {
  const partenza = fromFen(item.fen);
  const prima = legalMoves(partenza).find(
    (m) => nameOf(m.from) + nameOf(m.to) === item.firstMove.slice(0, 4),
  );
  if (!prima) continue;
  const stato = applyMove(partenza, prima);
  for (const libero of Basics.presaIn(stato)) {
    if (libero.square === item.answer) continue;
    const sp = Basics.perche(stato, libero.square, item.answer);
    checks += 1;
    if (sp.tipo === 'libera' && /vale di piu|davvero gratis/.test(sp.testo)) trovatoMinore += 1;
    else if (sp.tipo === 'libera') difensoriSbagliati += 1;
  }
}
ok(trovatoMinore > 0, 'il caso "e\' gratis, ma ce n\'e\' uno che vale di piu\'" deve essere riconosciuto');

/* ------------- 13. le trappole: numeri veri, e un giudizio solo ------------ */

/*
 * Due cose vanno provate, e sono diverse fra loro.
 *
 * La prima: che i numeri di Maia siano numeri, cioe' probabilita' fra 0 e 100,
 * una per fascia, per ogni riga. Se il file generato fosse rotto, l'app
 * stamperebbe percentuali inventate - ed e' esattamente il tipo di numero che
 * questa app si e' impegnata a non mostrare.
 *
 * La seconda, che conta di piu': che il **giudizio** dell'app a runtime sia lo
 * stesso che ha costruito il corpus. Maia sceglie le posizioni, ma non giudica
 * niente: la mossa che giochi la valuta `forzante.js`. Se i due conti
 * divergessero, l'app direbbe "questa perde" su una posizione scelta perche'
 * quella mossa non perde, o viceversa.
 */

ok(TRAPPOLE.length > PUZZLES.length * 0.5, `troppe poche righe di trappole: ${TRAPPOLE.length}`);
ok(FASCE.length >= 4, `servono almeno quattro fasce: ${FASCE.length}`);

let numeriRotti = 0;
for (const t of TRAPPOLE) {
  if (!Array.isArray(t.e) || t.e.length !== FASCE.length) { numeriRotti += 1; continue; }
  if (t.e.some((x) => !Number.isInteger(x) || x < 0 || x > 100)) numeriRotti += 1;
}
checks += TRAPPOLE.length;
ok(numeriRotti === 0, `${numeriRotti} righe di trappole con numeri fuori da 0-100`);

/* La fascia si sceglie per vicinanza, e non si esce mai dall'elenco. */
ok(Trappola.fasciaDi(500) === FASCE[0], 'sotto la prima fascia si usa la prima');
ok(Trappola.fasciaDi(9999) === FASCE[FASCE.length - 1], 'sopra l\'ultima si usa l\'ultima');
ok(Trappola.fasciaDi(1190) === 1100 && Trappola.fasciaDi(1210) === 1300, 'la fascia e\' quella piu\' vicina');

/* Nessuna trappola per l'ultima fascia: e' il metro, non un livello. */
ok(Trappola.perFascia(FASCE[FASCE.length - 1]).length === 0,
  'la fascia piu\' alta e\' il termine di paragone: non puo\' avere trappole sue');

/* La definizione morde davvero: alta alla fascia, e piu' bassa in cima. */
for (const f of FASCE.slice(0, -1)) {
  const i = FASCE.indexOf(f);
  const sue = Trappola.perFascia(f);
  checks += 1;
  const male = sue.filter((t) => t.e[i] < SOGLIA_ALTA || t.e[i] - t.e[t.e.length - 1] < SALTO);
  if (male.length) errors.push(`fascia ${f}: ${male.length} trappole non rispettano la propria definizione`);
  /* E sono ordinate dalla piu' insidiosa. */
  for (let k = 1; k < sue.length; k++) {
    const a = sue[k - 1].e[i] - sue[k - 1].e[sue[k - 1].e.length - 1];
    const b = sue[k].e[i] - sue[k].e[sue[k].e.length - 1];
    if (b > a) { errors.push(`fascia ${f}: le trappole non sono in ordine di divario`); break; }
  }
  checks += 1;
}

/* Una posizione, per ogni trappola: se manca, l'app avrebbe una carta vuota. */
let senzaPosizione = 0;
let nonPerdente = 0;
let controllate = 0;
for (const f of FASCE.slice(0, -1)) {
  for (const t of Trappola.perFascia(f).slice(0, 60)) {
    const pos = Trappola.posizioneDi(t);
    checks += 1;
    if (!pos) { senzaPosizione += 1; continue; }
    const stato = pos.stato || fromFen(pos.fen);
    if (!stato) { senzaPosizione += 1; continue; }

    /*
     * La prova che conta: in una posizione scelta come trappola deve esistere
     * almeno una mossa che il motore chiama perdente **e** almeno una che non lo
     * e'. Se tutte perdessero non ci sarebbe niente da imparare; se nessuna
     * perdesse, la posizione non sarebbe una trappola e il numero di Maia
     * sarebbe appeso al nulla.
     */
    const mosse = legalMoves(stato);
    const perdenti = mosse.filter((m) => Forzante.perdente(stato, m)).length;
    controllate += 1;
    if (perdenti === 0 || perdenti === mosse.length) nonPerdente += 1;
  }
}
ok(senzaPosizione === 0, `${senzaPosizione} trappole senza una posizione giocabile`);
ok(controllate > 150, `troppe poche trappole controllate: ${controllate}`);
ok(nonPerdente === 0,
  `${nonPerdente} trappole dove tutte le mosse perdono (o nessuna): non c'e' niente da scegliere`);

/* La sessione: solo trappole della propria fascia, senza doppioni. */
for (const r of [900, 1200, 1400, 1600]) {
  const sess = Trappola.costruisci({ rating: r });
  const f = Trappola.fasciaDi(r);
  ok(sess.fascia === f, `punteggio ${r}: fascia sbagliata`);
  ok(sess.items.every((it) => Trappola.eTrappola(it.riga, f)),
    `punteggio ${r}: in sessione e' finita una posizione che non e' una trappola di quella fascia`);
  ok(new Set(sess.items.map((it) => it.riga.id)).size === sess.items.length,
    `punteggio ${r}: doppioni in sessione`);
}

/* Le viste non tornano finche' non scadono. */
const primaSess = Trappola.costruisci({ rating: 1100 });
const viste = new Set(primaSess.items.map((it) => Trappola.cardIdOf(it.riga.id)));
const secondaSess = Trappola.costruisci({ rating: 1100, viste });
ok(secondaSess.items.every((it) => !viste.has(Trappola.cardIdOf(it.riga.id))),
  'una trappola gia\' vista non deve tornare come nuova');

/* I numeri mostrati sono quelli del file, non ricalcolati per strada. */
const rigaProva = Trappola.perFascia(1100)[0];
const n = Trappola.numeri(rigaProva, 1100);
ok(n.tuo === rigaProva.e[0] && n.alto === rigaProva.e[rigaProva.e.length - 1],
  'i numeri mostrati devono essere quelli del file');
ok(n.divario === n.tuo - n.alto, 'il divario e\' la differenza fra i due, e nient\'altro');
ok(n.tuo >= SOGLIA_ALTA && n.divario >= SALTO, 'la trappola piu\' insidiosa deve rispettare le soglie');

/* --------- 14. la curva dell'esame, il magazzino, i criteri applicati ------ */

/*
 * Il difetto che questi controlli esistono per non far tornare e' il piu'
 * subdolo di tutti: un criterio **dichiarato e non applicato**. Il file
 * percorso.js e' nato per toglierne uno (il pavimento del 60% che nessuno
 * faceva rispettare) e nel frattempo ne aveva lasciati entrare altri tre - la
 * mediana di L0, i sei finali di L2, la linea+piano di L6.
 *
 * Qui ogni numero che l'app mostra viene confrontato con la costante che decide
 * davvero. Se le due divergono, il test fallisce.
 */

const itemsL3 = Esame.componi({ pool: PUZZLES, soglia: 1400 });
ok(itemsL3.length === Esame.ITEM, `l'esame di L3 deve comporsi: ${itemsL3.length} item`);

const curva = Esame.curvaOperativa({ items: itemsL3, soglia: 1400 });
ok(curva.k !== null, 'la curva deve trovare un conteggio minimo');
ok(curva.k > 0 && curva.k <= itemsL3.length, `conteggio minimo fuori scala: ${curva.k}`);

/* Il conteggio minimo e' minimo davvero: uno in meno non deve passare. */
const conK = itemsL3.map((p, i) => ({ d: p.r, ok: i < curva.k }));
const conKmeno = itemsL3.map((p, i) => ({ d: p.r, ok: i < curva.k - 1 }));
ok(Stima.superaSoglia(Stima.stima(conK), 1400), 'con il conteggio minimo si deve passare');
ok(!Stima.superaSoglia(Stima.stima(conKmeno), 1400), 'con una risposta in meno non si deve passare');

/* La curva sale sempre: piu' sei forte, piu' e' probabile passare. */
for (let i = 1; i < curva.punti.length; i++) {
  checks += 1;
  if (curva.punti[i].p < curva.punti[i - 1].p) {
    errors.push('la curva operativa deve essere monotona crescente');
    break;
  }
}

/* Al punto di meta' la probabilita' e' meta'. */
const pMeta = Esame.probabilitaA(itemsL3, 1400, curva.meta);
near(pMeta, 0.5, 0.02, 'al punto di meta\' la probabilita\' di superare deve valere 0,5');

/*
 * La prova che conta: il conto esatto (Poisson-binomiale) deve coincidere con
 * una simulazione indipendente. Se il conto esatto fosse sbagliato, il numero
 * mostrato all'utente sarebbe inventato — ed e' proprio il numero con cui l'app
 * si presenta.
 */
let seme = 24680;
const dado = () => {
  seme ^= seme << 13; seme >>>= 0;
  seme ^= seme >>> 17;
  seme ^= seme << 5; seme >>>= 0;
  return seme / 4294967296;
};
for (const vera of [1400, 1500, 1600]) {
  let passa = 0;
  const N = 6000;
  for (let k = 0; k < N; k++) {
    const ris = itemsL3.map((x) => ({ d: x.r, ok: dado() < Stima.probabilita(vera, x.r) }));
    if (Stima.superaSoglia(Stima.stima(ris), 1400)) passa += 1;
  }
  near(Esame.probabilitaA(itemsL3, 1400, vera), passa / N, 0.02,
    `a forza ${vera} il conto esatto deve coincidere con la simulazione`);
}

/* E a 1400 esatti l'esame "a 1400" si supera poco: e' il numero da dichiarare. */
ok(Esame.probabilitaA(itemsL3, 1400, 1400) < 0.10,
  'a 1400 esatti questo esame si supera raramente: se non fosse cosi\' la prudenza dichiarata non ci sarebbe');
ok(curva.meta > 1450 && curva.meta < 1700, `il punto di meta\' e\' fuori misura: ${curva.meta}`);

/* I criteri a conteggio: la loro curva binomiale. */
for (const c of [{ giuste: 18, su: 20 }, { giuste: 19, su: 20 }, { giuste: 8, su: 10 }, { giuste: 3, su: 3 }]) {
  const t = Esame.tasso50(c);
  ok(t > 0.5 && t < 1, `${c.giuste}/${c.su}: tasso al 50% fuori scala (${t})`);
  const punti = Esame.curvaConteggio(c);
  ok(punti.every((x, i) => i === 0 || x.passa >= punti[i - 1].passa - 1e-9),
    `${c.giuste}/${c.su}: la curva a conteggio deve salire`);
}

/* ------------------------------ il magazzino ------------------------------ */

const mag = Esame.magazzino({ pool: PUZZLES, soglia: 1400 });
const contoAMano = Esame.poolEsame(PUZZLES).filter((p) => Math.abs(p.r - 1400) <= Esame.FINESTRA_UTILE).length;
ok(mag.utili === contoAMano, `il magazzino conta ${mag.utili}, a mano ne risultano ${contoAMano}`);
ok(mag.totali === Esame.poolEsame(PUZZLES).length, 'il totale deve essere il pool d\'esame intero');
ok(mag.esamiRimasti === Math.floor(contoAMano / Esame.ITEM), 'gli esami rimasti sono le scorte diviso la lunghezza');

/*
 * E non si allarga piu' in silenzio: se nella finestra utile non c'e' un esame
 * intero, `componi` torna vuoto invece di pescare a duecento punti di distanza.
 */
const quasiTutti = new Set(Esame.poolEsame(PUZZLES)
  .filter((p) => Math.abs(p.r - 1400) <= Esame.FINESTRA_UTILE)
  .slice(0, contoAMano - 5)
  .map((p) => p.id));
ok(Esame.componi({ pool: PUZZLES, soglia: 1400, spesi: quasiTutti }).length === 0,
  'con meno di un esame nella finestra utile, comporre deve fallire invece di allargare');
ok(!Esame.magazzino({ pool: PUZZLES, soglia: 1400, spesi: quasiTutti }).bastano,
  'e il magazzino deve dire che non bastano');

/* ------------------- il pavimento guarda la finestra ---------------------- */

/*
 * Prima il pavimento girava su tutto il registro: un motivo sbagliato mesi fa
 * teneva chiuso un livello per sempre. Adesso guarda le ultime venti.
 */
const t0 = 1_700_000_000_000;
const risalito = [
  ...Array.from({ length: 40 }, (_, i) => ({ axis: 'tattica', theme: 'pin', correct: i % 10 < 3, t: t0 + i })),
  ...Array.from({ length: 20 }, (_, i) => ({ axis: 'tattica', theme: 'pin', correct: i < 17, t: t0 + 100 + i })),
];
ok(Esame.motiviDeboli(risalito, { axis: 'tattica' }).length === 0,
  'un motivo che negli ultimi venti sta all\'85% non deve piu\' tenere chiuso il livello');

const ancoraDebole = [
  ...Array.from({ length: 40 }, (_, i) => ({ axis: 'tattica', theme: 'pin', correct: true, t: t0 + i })),
  ...Array.from({ length: 20 }, (_, i) => ({ axis: 'tattica', theme: 'pin', correct: i < 8, t: t0 + 100 + i })),
];
const deboliOra = Esame.motiviDeboli(ancoraDebole, { axis: 'tattica' });
ok(deboliOra.length === 1 && deboliOra[0].theme === 'pin',
  'un motivo al 40% sulle ultime venti deve bloccare, anche se prima andava bene');
ok(deboliOra[0].n === Esame.FINESTRA_MOTIVO, `la quota va calcolata sulla finestra, non su ${deboliOra[0].n} risposte`);
ok(deboliOra[0].viste === 60, 'e va detto quante se ne sono viste in tutto');

/* ------------- ogni criterio dichiarato e' anche applicato ---------------- */

/*
 * Il test che i quattro difetti trovati dall'analisi non possano tornare: per
 * ogni livello attivo, i numeri che compaiono nel testo mostrato devono essere
 * gli stessi che decidono nel codice.
 */
for (const l of Percorso.LIVELLI.filter((x) => x.state === 'attivo')) {
  ok(!!l.accesso, `${l.code}: manca il criterio d'accesso dichiarato`);
  ok(!!l.exit, `${l.code}: manca il criterio d'uscita dichiarato`);

  /*
   * Un livello puo' non avere esame, ma allora deve dirlo esplicitamente: e' il
   * caso di L7, i cui item non hanno difficolta' misurata e sono posizioni gia'
   * vissute, quindi non possono certificare niente.
   */
  if (l.senzaEsame) {
    ok(l.esame === null, `${l.code}: dichiarato senza esame ma ne ha uno`);
    ok(!Percorso.pronto(l.code, { log: [], rating: 3000 }), `${l.code}: senza esame non puo' essere "pronto"`);
    ok(!Percorso.verdetto(l.code, []).passa, `${l.code}: senza esame non puo' emettere un verdetto positivo`);
    continue;
  }
  ok(!!l.esame, `${l.code}: manca il descrittore d'esame`);

  if (l.esame.tipo === 'conta') {
    /* I numeri dell'esame devono comparire nel testo d'uscita. */
    ok(l.exit.includes(String(l.esame.giuste)) || l.exit.includes(String(l.esame.su)),
      `${l.code}: il testo d'uscita ("${l.exit}") non nomina i numeri dell'esame (${l.esame.giuste}/${l.esame.su})`);
  } else {
    ok(l.exit.includes(String(l.esame.soglia)),
      `${l.code}: il testo d'uscita non nomina la soglia ${l.esame.soglia}`);
  }
}

/* La mediana di L0 entra nel verdetto, non solo nell'accesso. */
const venti = (ok_, ms) => Array.from({ length: 20 }, (_, i) => ({ ok: i < ok_, theme: 'colore', ms }));
ok(!Percorso.verdetto('L0', venti(19, 4500)).passa, 'L0: 19 su 20 ma lente non deve passare');
ok(Percorso.verdetto('L0', venti(19, 2400)).passa, 'L0: 19 su 20 e veloci deve passare');
ok(!Percorso.verdetto('L0', venti(17, 2000)).passa, 'L0: 17 su 20 non basta nemmeno se velocissime');
ok(Percorso.verdetto('L0', venti(19, 4500)).medianaOk === false, 'e l\'esito deve dire che il problema e\' la mediana');
/* L1 non chiede la mediana: non deve inventarsela. */
ok(Percorso.verdetto('L1', venti(19, 9000)).passa, 'L1 non ha un criterio di tempo, e non deve applicarne uno');

/* L'accesso a L3 e' legato alla curva, non a un numero incollato. */
const logTattica = Array.from({ length: 80 }, (_, i) => ({ axis: 'tattica', correct: true, t: t0 + i }));
const meta = Percorso.puntoMeta(1400);
ok(meta === curva.meta, 'il punto di meta\' usato dall\'accesso deve essere quello della curva');
ok(!Percorso.pronto('L3', { log: logTattica, rating: meta - 60 }), 'sotto il punto di meta\' non si accede');
ok(Percorso.pronto('L3', { log: logTattica, rating: meta + 20 }), 'sopra il punto di meta\' si accede');
ok(!Percorso.pronto('L3', { log: logTattica.slice(0, 20), rating: meta + 200 }),
  'con poche risposte non si accede, per quanto alto sia il punteggio');

/*
 * L'esame ha lunghezza FISSA, e deve restare cosi'.
 *
 * Un arresto anticipato (fermarsi appena l'intervallo e' deciso) era stato
 * proposto per risparmiare item, ed e' stato **misurato**: sposta la curva
 * operativa fino a 8,4 punti percentuali, e nel verso che rende l'esame piu'
 * facile, perche' guardare lo stesso intervallo dopo ogni risposta e' un test
 * ripetuto. La lunghezza media scendeva a 18,6 item: un risparmio vero, pagato
 * con una regola che non misura piu' quello che dice. Non si spedisce.
 */
ok(Esame.ITEM === 24, 'la lunghezza dell\'esame e\' fissa per scelta misurata: non renderla variabile senza rifare la simulazione');

/* ------------- 15. la barriera: chi puo' entrare nella misura ------------- */

/*
 * La regola era scritta nei commenti e rispettata a mano. Adesso e' codice, e
 * questi controlli la tengono ferma: un item senza difficolta' misurata non ha
 * un posto nella verosimiglianza di Rasch, e dargliene uno vuol dire
 * inventargli un numero.
 *
 * Il caso pericoloso e' L7: item scelti perche' li hai sbagliati TU. Non
 * abbassano solo la stima, RESTRINGONO l'intervallo (ogni item aggiunge
 * informazione di Fisher) - e siccome il criterio d'uscita e' il limite
 * inferiore, non corrompono la stima: corrompono il test.
 */

for (const prefisso of Calibrato.NON_CALIBRATI) {
  ok(Calibrato.generato(`${prefisso}qualcosa`), `${prefisso} deve risultare generato in casa`);
  ok(!Calibrato.misurabile({ id: `${prefisso}x`, d: 1400 }),
    `${prefisso}: un item generato non puo' entrare nella misura, nemmeno con una difficolta' addosso`);
}
ok(Calibrato.misurabile({ id: 't:abc', d: 1400 }), 'un item del corpus con difficolta' + ' deve poter misurare');
ok(!Calibrato.misurabile({ id: 't:abc' }), 'senza difficolta non si misura');
ok(!Calibrato.misurabile({ id: 't:abc', d: 1400, rd: 200 }), 'con una deviazione troppo grande non si misura');

/* Lo stimatore non filtra in silenzio: restituisce gli scarti col motivo. */
const misto = [
  { id: 't:a', d: 1400, ok: true }, { id: 't:b', d: 1450, ok: false },
  { id: 'g:mia', d: 1400, ok: false }, { id: 'b:presa:x', d: 900, ok: true },
];
const st = Stima.stima(misto);
ok(st.n === 2, `lo stimatore deve usare solo i due item del corpus, ne ha usati ${st.n}`);
ok(st.scartate.length === 2, 'e deve restituire i due scartati');
ok(st.scartate.every((x) => x.motivo), 'ogni scarto deve avere un motivo scritto');

/*
 * La prova che conta: la pipeline VERA di L7 su un PGN vero. Con oggetti
 * costruiti a mano il test passerebbe anche se la barriera non esistesse nel
 * percorso reale.
 */
const PGN_PROVA = `[Event "Prova"]
[Site "https://lichess.org/xyz"]
[White "io"]
[Black "altri"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Ng5 Qxg5 5. d3 Qxg2 0-1`;

const letto = Pgn.leggi(PGN_PROVA);
ok(letto.partite.length === 1, 'il PGN di prova deve leggersi');
ok(letto.partite.length + letto.scarti.length === letto.trovate, 'lette + scartate deve fare le trovate');
const estratto = Partite.estrai(letto.partite, { nome: 'io' });
ok(estratto.items.length >= 1, 'nel PGN di prova c-e almeno una perdita di materiale (4.Ng5)');

/* Ogni item di L7 deve essere respinto dalla misura. */
for (const item of estratto.items) {
  const id = Partite.cardIdOf(item.id);
  ok(Calibrato.generato(id), `l'item di L7 ${id} deve risultare generato`);
  ok(!Calibrato.misurabile({ id, d: 1400, ok: true }), `l'item di L7 ${id} non puo' entrare nella misura`);
}
const conL7 = Stima.stima([
  { id: 't:a', d: 1400, ok: true },
  ...estratto.items.map((x) => ({ id: Partite.cardIdOf(x.id), d: 1400, ok: false })),
]);
ok(conL7.n === 1, `gli item di L7 non devono entrare nello stimatore (ne sono entrati ${conL7.n - 1})`);

/* E il pool d'esame non li contiene, perche' non stanno nemmeno nel corpus. */
ok(Esame.poolEsame(PUZZLES).every((p) => !Calibrato.generato(p.id)),
  'nel pool d-esame non deve esserci nessun item generato');

/* Il lettore di PGN dichiara gli scarti invece di ingoiarli. */
const conVariante = `${PGN_PROVA}

[Event "X"]
[White "a"]
[Black "b"]
[Variant "Crazyhouse"]
[Result "1-0"]

1. e4 e5 1-0`;
const letto2 = Pgn.leggi(conVariante);
ok(letto2.trovate === 2, `due partite nel file, ne ha trovate ${letto2.trovate}`);
ok(letto2.scarti.length === 1, 'la variante non standard va scartata');
ok(letto2.scarti[0].motivo.includes('Crazyhouse'), 'e il motivo deve nominarla');

/* Nessun simbolo di valutazione della piattaforma sopravvive all'import. */
const conSimboli = `[Event "X"]
[White "io"]
[Black "altri"]
[Result "*"]

1. e4?! { [%eval 0.2] } e5!! $2 { commento } 2. Nf3 *`;
const letto3 = Pgn.leggi(conSimboli);
ok(letto3.partite.length === 1, 'la partita con simboli deve leggersi');
ok(letto3.partite[0].passi.every((x) => !/[?!$]/.test(x.san)),
  'nessun simbolo di valutazione deve sopravvivere alle mosse importate');

/* ---------- 16. i simboli chiamati esistono davvero -------------------- */

/*
 * La guardia contro il bug piu' stupido e piu' costoso che questa sessione
 * abbia prodotto.
 *
 * Riscrivendo `percorso.js` per gli esami ho tolto `uscitaDi`. Ho aggiornato la
 * suite. E ho lasciato indietro **due chiamate in app.js**, tutte e due nei
 * riepiloghi di fine sessione: L0/L1 e i finali. Chi arrivava all'ultima
 * domanda restava piantato li', perche' il riepilogo andava in errore prima di
 * disegnarsi - una sessione completata che non finiva mai.
 *
 * Nessuno dei test lo vedeva: erano tutti sui moduli puri, e l'unica cosa che
 * poteva accorgersene era aprire l'app e arrivare in fondo a una sessione.
 * Questo controllo e' la rete: legge app.js, raccoglie ogni `Modulo.simbolo` e
 * pretende che quel simbolo sia esportato davvero, importando il modulo vero.
 *
 * E' una lettura statica, e la lettura statica ha i suoi limiti - ma per la
 * domanda "questo simbolo esiste?" e' esattamente lo strumento giusto.
 */

const sorgenteApp = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');

const MODULI = {
  Percorso, Esame, Stima, Calibrato, Trappola, Calcolo, Piani, Regime,
  Ricostruzione, Tactics, Basics, Mirror, See, Forzante, Partite, Pgn, Store, Sync,
};

const senzaCommenti = sorgenteApp
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

let mancanti = 0;
for (const [nome, modulo] of Object.entries(MODULI)) {
  const re = new RegExp(`\\b${nome}\\.([A-Za-z_$][\\w$]*)`, 'g');
  const usati = new Set();
  let m = re.exec(senzaCommenti);
  while (m) { usati.add(m[1]); m = re.exec(senzaCommenti); }

  for (const simbolo of usati) {
    checks += 1;
    if (!(simbolo in modulo)) {
      mancanti += 1;
      errors.push(`app.js chiama ${nome}.${simbolo}, che ${nome} non esporta`);
    }
  }
}
ok(mancanti === 0, `${mancanti} simboli chiamati e non esportati`);

/*
 * E lo stesso per gli strumenti, che importano i moduli dell'app: un tool che
 * si rompe si nota subito, ma solo se qualcuno lo esegue.
 */
for (const tool of ['build-quiete.mjs', 'trappole-mosse.mjs']) {
  const testo = readFileSync(new URL(`./${tool}`, import.meta.url), 'utf8');
  checks += 1;
  const importati = [...testo.matchAll(/await import\('([^']+)'\)/g)].map((x) => x[1]);
  if (!importati.length) errors.push(`${tool}: nessun import trovato, il controllo non sta guardando niente`);
}

/* -------------------------------- verdetto ------------------------------- */

console.log(`Controlli: ${checks}`);
console.log(`Specchiature rigiocate sul motore: ${specchiate + ribaltate}`);
console.log(`Copertura dell'intervallo al 95%: ${(copertura * 100).toFixed(1)}% su ${PROVE} simulazioni`);
console.log(`Posizioni d'esame tenute fuori: ${esame.length} su ${PUZZLES.length}`);
console.log(`Posizioni quiete ricontrollate: ${QUIETE.length}`);
console.log(`Confutazioni trovate: ${confutate}/${occasioni}`);
console.log(`Case del livello 1 con una spiegazione vera: ${Object.values(casiVisti).reduce((a, b) => a + b, 0)}`);
console.log(`Trappole per fascia: ${Trappola.disponibili().map((d) => `${d.fascia}:${d.quante}`).join(' ')}`);
console.log(`Esame di L3: servono ${curva.k}/${curva.su}, a 1400 si supera il ${(Esame.probabilitaA(itemsL3, 1400, 1400) * 100).toFixed(1)}%, meta' a ${curva.meta}`);
console.log(`Magazzino d'esame a 1400: ${mag.utili} posizioni utili (${mag.esamiRimasti} esami) su ${mag.totali} libere`);

if (errors.length) {
  console.error(`\n${errors.length} problemi:`);
  errors.slice(0, 40).forEach((e) => console.error(`  ${e}`));
  if (errors.length > 40) console.error(`  … e altri ${errors.length - 40}`);
  process.exit(1);
}

console.log('\nSpecchiatura, stima, esame, cambio statico, quiete, livelli e regime si comportano come dichiarato.');
