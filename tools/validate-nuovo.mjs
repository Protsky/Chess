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
ok(specchiate > 2000, `troppe poche posizioni specchiabili: ${specchiate}`);
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
ok(esame.length > 150 && esame.length < 400, `la quota tenuta fuori è fuori misura: ${esame.length}`);

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

ok(QUIETE.length > 300, `troppe poche posizioni quiete: ${QUIETE.length}`);
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
  ok(!!l.esame, `${l.code} è attivo ma non ha un criterio d'esame`);
}
const avanz = Percorso.avanzamenti({ rating: 900, aperture: { progress: {} }, log: [], livelli: {} });
ok(Object.keys(avanz).length === 6, `sei livelli attivi, non ${Object.keys(avanz).length}`);
ok(Object.values(avanz).every((a) => a.percent >= 0 && a.percent <= 100), 'nessun avanzamento fuori da 0-100');
ok(!('L5' in avanz) && !('L7' in avanz), 'i livelli non costruiti non devono avere un avanzamento');

/* La sessione di oggi conta il corpus allenabile, non quello intero. */
const oggi = Percorso.oggi({ due: 0, introduced: 0, settings: { newPerDay: 8 }, size: 12, maxNew: 8, viste: 0 });
ok(oggi.allenabili === allenamento.length, 'la home deve contare le posizioni allenabili, non tutte');
ok(oggi.allenabili < PUZZLES.length, 'e devono essere meno di tutte, altrimenti l\'esame non è tenuto fuori');

/* -------------------------------- verdetto ------------------------------- */

console.log(`Controlli: ${checks}`);
console.log(`Specchiature rigiocate sul motore: ${specchiate + ribaltate}`);
console.log(`Copertura dell'intervallo al 95%: ${(copertura * 100).toFixed(1)}% su ${PROVE} simulazioni`);
console.log(`Posizioni d'esame tenute fuori: ${esame.length} su ${PUZZLES.length}`);
console.log(`Posizioni quiete ricontrollate: ${QUIETE.length}`);
console.log(`Confutazioni trovate: ${confutate}/${occasioni}`);

if (errors.length) {
  console.error(`\n${errors.length} problemi:`);
  errors.slice(0, 40).forEach((e) => console.error(`  ${e}`));
  if (errors.length > 40) console.error(`  … e altri ${errors.length - 40}`);
  process.exit(1);
}

console.log('\nSpecchiatura, stima, esame, cambio statico, quiete, livelli e regime si comportano come dichiarato.');
