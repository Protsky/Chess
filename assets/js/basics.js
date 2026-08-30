/*
 * basics.js — i due gradini che venivano prima di tutto, e mancavano.
 *
 * L0 «Vista della scacchiera» e L1 «Non regalare pezzi» non hanno bisogno di un
 * corpus: gli item se li fabbrica il motore che c'è già. È anche il motivo per
 * cui vengono prima — sono le uniche cose che si possono chiedere a chi non sa
 * ancora niente, e sono quelle che liberano l'attenzione per tutto il resto.
 *
 * Perché questi item e non altri:
 *
 *  - **Il colore di una casa, il nome di una casa, i salti del cavallo.** Finché
 *    costano attenzione, l'attenzione manca al gioco. Chase & Simon (1973)
 *    descrivono la forza come riconoscimento di configurazioni: le
 *    configurazioni si vedono solo se la geometria della scacchiera è già
 *    automatica. Che questo si alleni bene *a parte* è impalcatura ragionevole,
 *    non un risultato dimostrato, e nell'app va detto così.
 *
 *  - **Il pezzo in presa.** Sotto i 1200 punti le partite si decidono quasi
 *    sempre lì. L'item non chiede una combinazione: chiede la scansione, cioè
 *    l'unica abitudine che al tavolo si ripete a ogni mossa.
 *
 * Ogni item ha una risposta che la macchina verifica da sé — colore calcolato,
 * distanza calcolata con una visita in ampiezza, cattura *legale* e casa non
 * difesa da nessuno. Niente autovalutazione, come dappertutto qui dentro.
 */

import {
  FILES, idx, idxOf, nameOf, rowOf, colOf, colorOf, other,
  fromFen, legalMoves, applyMove, attackersOf, knightDistance,
} from './chess.js';
import { PUZZLES } from './puzzles.js';

export const VISTA = 'vista';
export const SICUREZZA = 'sicurezza';

/** Prefissi delle carte, uno per asse: la coda si filtra per famiglia. */
export const PREFIX = { [VISTA]: 'v:', [SICUREZZA]: 's:' };

/** Punteggio di partenza dei due assi di base: la soglia d uscita di L1 è 800. */
export const START = 500;

export const SESSION_SIZE = 10;
export const MAX_NEW = 6;

/** Soglie d'uscita dichiarate nel percorso, e misurate sul registro. */
export const USCITA = {
  [VISTA]: { giuste: 18, su: 20, mediana: 3000 },
  [SICUREZZA]: { punteggio: 800, erroriMax: 1, su: 20 },
};

const CASE = Array.from({ length: 64 }, (_, i) => i);
const VALORE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 99 };
/* Nome col suo articolo e il participio giusto: «la torre non è difesa». */
const NOME_PEZZO = {
  P: ['Il pedone', 'difeso'],
  N: ['Il cavallo', 'difeso'],
  B: ['L’alfiere', 'difeso'],
  R: ['La torre', 'difesa'],
  Q: ['La donna', 'difesa'],
  K: ['Il re', 'difeso'],
};

/** Numero pseudocasuale ripetibile: stesso seme, stessa sessione. */
export function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

/* ------------------------------ L0: la vista ----------------------------- */

/** Le case chiare sono quelle in cui colonna e traversa hanno parità diversa. */
export const isLight = (square) => (rowOf(square) + colOf(square)) % 2 === 0;

export function coloreItem(square) {
  const chiara = isLight(square);
  return {
    id: `${PREFIX[VISTA]}colore:${nameOf(square)}`,
    axis: VISTA,
    kind: 'opzioni',
    difficulty: 400,
    prompt: `Di che colore è la casa <strong>${nameOf(square)}</strong>?`,
    hint: 'Senza guardare la scacchiera.',
    options: [
      { label: 'Chiara', ok: chiara },
      { label: 'Scura', ok: !chiara },
    ],
    explain: `${nameOf(square)} è ${chiara ? 'chiara' : 'scura'}: colonna ${FILES[colOf(square)]} (${colOf(square) + 1}ª)`
      + ` e traversa ${8 - rowOf(square)} hanno parità ${chiara ? 'diversa' : 'uguale'}.`,
  };
}

export function nomeItem(square) {
  const giusto = nameOf(square);
  const vicine = CASE
    .filter((i) => i !== square && Math.abs(rowOf(i) - rowOf(square)) <= 2 && Math.abs(colOf(i) - colOf(square)) <= 2)
    .slice(0, 24);
  const distrattori = [];
  for (const casa of vicine) {
    if (distrattori.length >= 3) break;
    if (!distrattori.includes(nameOf(casa))) distrattori.push(nameOf(casa));
  }
  const etichette = [giusto, ...distrattori].sort();
  return {
    id: `${PREFIX[VISTA]}nome:${giusto}`,
    axis: VISTA,
    kind: 'opzioni',
    difficulty: 450,
    prompt: 'Come si chiama la casa illuminata?',
    marks: [{ square, kind: 'hint' }],
    empty: true,
    options: etichette.map((l) => ({ label: l, ok: l === giusto })),
    explain: `Colonna ${FILES[colOf(square)]}, traversa ${8 - rowOf(square)}: ${giusto}.`,
  };
}

export function cavalloItem(from, to) {
  const passi = knightDistance(from, to);
  /*
   * Le opzioni si costruiscono **attorno alla risposta**, non su un intervallo
   * fisso: da un angolo all'altro il cavallo ci mette sei salti, e con le
   * opzioni 1-4 quella domanda non aveva nessuna risposta giusta. Trovato dal
   * validatore, che infatti ricalcola ogni distanza invece di fidarsi.
   */
  const numeri = [];
  for (const n of [passi, passi - 1, passi + 1, passi + 2, passi - 2, passi + 3]) {
    if (n >= 1 && n <= 6 && !numeri.includes(n)) numeri.push(n);
    if (numeri.length === 4) break;
  }
  numeri.sort((a, b) => a - b);
  const opzioni = numeri.map((n) => ({ label: `${n}`, ok: n === passi }));
  return {
    id: `${PREFIX[VISTA]}cavallo:${nameOf(from)}-${nameOf(to)}`,
    axis: VISTA,
    kind: 'opzioni',
    difficulty: 500 + passi * 60,
    prompt: `In quante mosse il cavallo va da <strong>${nameOf(from)}</strong> a <strong>${nameOf(to)}</strong>?`,
    hint: 'Scacchiera vuota, nessun pezzo intorno.',
    fen: cavalloFen(from),
    marks: [{ square: to, kind: 'hint' }],
    options: opzioni,
    explain: `${passi} ${passi === 1 ? 'mossa' : 'mosse'}. Il cavallo cambia colore di casa a ogni salto:`
      + ` da ${isLight(from) ? 'chiara' : 'scura'} a ${isLight(to) ? 'chiara' : 'scura'} servono un numero`
      + ` ${isLight(from) === isLight(to) ? 'pari' : 'dispari'} di mosse.`,
  };
}

function cavalloFen(square) {
  const righe = [];
  for (let r = 0; r < 8; r++) {
    let riga = '';
    for (let c = 0; c < 8; c++) riga += idx(r, c) === square ? 'N' : '1';
    righe.push(riga.replace(/1{2,}/g, (m) => String(m.length)));
  }
  return `${righe.join('/')} w - - 0 1`;
}

/* --------------------------- L1: non regalare pezzi ---------------------- */

/**
 * Un pezzo è «gratis» se lo si può catturare con una mossa **legale** e la casa
 * non è difesa da nessuno. Niente stime: la cattura si prova sul motore, e i
 * difensori si contano. Le inchiodature non le consideriamo, e per questo si
 * chiede solo il caso senza difensori — dove non c'è niente da valutare.
 */
export function presaIn(state) {
  const mie = state.turn;
  const sue = other(mie);
  const out = [];
  const mosse = legalMoves(state);

  for (const mossa of mosse) {
    const preda = state.board[mossa.to];
    if (!preda || colorOf(preda) !== sue) continue;
    if (attackersOf(state.board, mossa.to, sue).length) continue;   // è difesa
    const dopo = applyMove(state, mossa);
    if (attackersOf(dopo.board, mossa.to, sue).length) continue;    // difesa scoperta
    out.push({ square: mossa.to, piece: preda, value: VALORE[preda.toUpperCase()] || 0, move: mossa });
  }
  return out;
}

/**
 * Item «prendi il pezzo gratis», ricavato dalle posizioni vere del corpus.
 * Si parte dal FEN e si gioca la mossa dell'avversario, come nella tattica:
 * la posizione che si vede è quella in cui tocca a chi studia.
 */
export function presaItem(puzzle) {
  const start = fromFen(puzzle.f);
  if (!start) return null;
  const prima = legalMoves(start).find((m) => {
    const uci = puzzle.m.split(' ')[0];
    return nameOf(m.from) + nameOf(m.to) === uci.slice(0, 4);
  });
  if (!prima) return null;

  const state = applyMove(start, prima);
  const gratis = presaIn(state);
  if (!gratis.length) return null;

  // Una sola risposta buona: se ce ne fossero due, «quale» diventerebbe ambiguo.
  const migliore = gratis.slice().sort((a, b) => b.value - a.value);
  if (migliore.length > 1 && migliore[0].value === migliore[1].value) return null;
  const bersaglio = migliore[0];
  if (bersaglio.value < 3) return null;      // un pedone gratis non insegna la scansione

  return {
    id: `${PREFIX[SICUREZZA]}presa:${puzzle.id}`,
    axis: SICUREZZA,
    kind: 'tocco',
    difficulty: Math.min(900, puzzle.r),
    prompt: `Muove il ${state.turn === 'w' ? 'Bianco' : 'Nero'}: <strong>quale pezzo puoi prendere senza perdere niente?</strong>`,
    hint: 'Tocca il pezzo da catturare. Non c\'è nessuna combinazione: è un pezzo lasciato lì.',
    fen: puzzle.f,
    firstMove: puzzle.m.split(' ')[0],
    side: state.turn,
    answer: bersaglio.square,
    explain: `${NOME_PEZZO[bersaglio.piece.toUpperCase()][0]} in ${nameOf(bersaglio.square)} non è ${NOME_PEZZO[bersaglio.piece.toUpperCase()][1]} da nessuno.`,
  };
}

/**
 * Che cosa succede davvero se prendo **quel** pezzo.
 *
 * Serve alla correzione del livello 1: dire «no, quello è difeso» è un'etichetta;
 * far vedere il pedone che riprende è la ragione. Restituisce la cattura più
 * naturale (col pezzo di minor valore, che è quella che chiunque farebbe) e, se
 * c'è, la ripresa migliore dell'avversario — anche quella col pezzo che vale
 * meno, perché è la ripresa che costa di più a chi ha catturato.
 */
export function catturaDi(state, square) {
  const preda = state.board[square];
  if (!preda) return { tipo: 'vuota' };
  if (colorOf(preda) === state.turn) return { tipo: 'tuo', preda };

  const valore = (p) => VALORE[p.toUpperCase()] || 0;
  const catture = legalMoves(state)
    .filter((m) => m.to === square)
    .sort((a, b) => valore(a.piece) - valore(b.piece));
  if (!catture.length) return { tipo: 'irraggiungibile', preda };

  const mossa = catture[0];
  const dopo = applyMove(state, mossa);
  const riprese = legalMoves(dopo)
    .filter((m) => m.to === square)
    .sort((a, b) => valore(a.piece) - valore(b.piece));

  if (!riprese.length) return { tipo: 'libera', mossa, preda };

  const risposta = riprese[0];
  return {
    tipo: 'difesa',
    mossa,
    risposta,
    preda,
    difensore: dopo.board[risposta.from],
    saldo: valore(preda) - valore(mossa.piece),      // negativo = ci rimetti
  };
}

/*
 * Le tre forme che servono alle spiegazioni, perché l'italiano non perdona:
 * «La torre era difesa **dal** re», non «Il torre era difeso **da il** re».
 */
export function nomeDi(pezzo) {
  return NOME_PEZZO[String(pezzo).toUpperCase()]?.[0] || 'Il pezzo';
}

export function participioDi(pezzo) {
  return NOME_PEZZO[String(pezzo).toUpperCase()]?.[1] || 'difeso';
}

const DA_PEZZO = { P: 'dal pedone', N: 'dal cavallo', B: 'dall’alfiere', R: 'dalla torre', Q: 'dalla donna', K: 'dal re' };

export function daDi(pezzo) {
  return DA_PEZZO[String(pezzo).toUpperCase()] || 'da un pezzo';
}

/* ------------------------------- le sessioni ----------------------------- */

/** Tutte le case, in un ordine sparso ma sempre lo stesso. */
function caseSparse(seed) {
  const rnd = rng(seed);
  return CASE.map((i) => ({ i, k: rnd() })).sort((a, b) => a.k - b.k).map((x) => x.i);
}

/** Gli item di L0 che l'app può proporre: 64 + 64 + 64, generati, non scritti. */
export function vistaPool(seed = 7) {
  const sparse = caseSparse(seed);
  const colori = sparse.map((casa) => coloreItem(casa));
  const nomi = sparse.map((casa) => nomeItem(casa));
  const cavalli = [];
  for (let n = 0; n < sparse.length; n++) {
    const from = sparse[n];
    const to = sparse[(n * 3 + 11) % 64];
    if (from !== to) cavalli.push(cavalloItem(from, to));
  }

  /*
   * I tre tipi si alternano già nel serbatoio, non solo nella coda: il materiale
   * nuovo si prende dalla testa, e una testa fatta di sole domande sul colore
   * darebbe sei domande uguali di fila. (Trovato dal validatore.)
   */
  const items = [];
  for (let i = 0; i < Math.max(colori.length, nomi.length, cavalli.length); i++) {
    if (colori[i]) items.push(colori[i]);
    if (cavalli[i]) items.push(cavalli[i]);
    if (nomi[i]) items.push(nomi[i]);
  }
  return items;
}

/** Gli item di L1, ricavati dalle posizioni più facili del corpus. */
export function sicurezzaPool(limit = 120) {
  const out = [];
  for (const puzzle of PUZZLES) {
    if (puzzle.r > 1100) continue;
    const item = presaItem(puzzle);
    if (item) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * La coda di una sessione dei fondamentali: prima le scadenze, poi il nuovo.
 * Stessa regola della tattica — il ripasso tiene in piedi quello che si sa.
 */
export function buildQueue({ axis, due = [], known = new Set(), pool, size = SESSION_SIZE, maxNew = MAX_NEW }) {
  const tutti = pool || (axis === VISTA ? vistaPool() : sicurezzaPool());
  const perId = new Map(tutti.map((i) => [i.id, i]));
  const items = [];

  for (const card of due) {
    const item = perId.get(card.id);
    if (item) items.push({ item, card, fresh: false });
    if (items.length >= size) break;
  }

  const spazio = Math.min(maxNew, size - items.length);
  if (spazio > 0) {
    const nuovi = tutti.filter((i) => !known.has(i.id)).slice(0, spazio);
    for (const item of nuovi) items.push({ item, card: null, fresh: true });
  }

  return mescola(items);
}

/** Due item dello stesso tipo non si toccano, se c'è modo di evitarlo. */
export function mescola(items) {
  const resto = items.slice();
  const out = [];
  let ultimo = null;
  while (resto.length) {
    let i = resto.findIndex((x) => tipoDi(x.item) !== ultimo);
    if (i === -1) i = 0;
    const [next] = resto.splice(i, 1);
    out.push(next);
    ultimo = tipoDi(next.item);
  }
  return out;
}

export const tipoDi = (item) => String(item.id).split(':')[1];

/** Quanto ci si mette, per questo tipo di domanda: il voto ne tiene conto. */
export function paceFor(item) {
  if (item.axis === VISTA) return { quick: 3, slow: 8 };
  return { quick: 8, slow: 20 };
}
