/*
 * mirror.js — la stessa tattica, ma non la stessa fotografia.
 *
 * I puzzle di Lichess si imparano a memoria come immagini: dopo qualche giro
 * non si riconosce più l'inchiodatura, si riconosce *quella* posizione. È il
 * motivo per cui Lichess esclude dal punteggio i puzzle già giocati, e per cui
 * Chess.com ha dovuto ritarare i propri rating nel 2025.
 *
 * Qui si rimedia con due trasformazioni che lasciano la posizione legale e la
 * soluzione valida, ma cambiano il quadro:
 *
 *   specchia  le colonne si invertono (a↔h). Il motivo è lo stesso, la figura no.
 *   ribalta   si scambiano le traverse **e** i colori: il Bianco diventa il Nero.
 *
 * Nessuna delle due è un'approssimazione: gli scacchi sono simmetrici rispetto
 * a entrambe, e `tools/validate-mirror.mjs` rigioca ogni soluzione trasformata
 * sul motore per dimostrarlo invece di darlo per buono.
 *
 * Una sola cautela, ed è vera: specchiando le colonne l'arrocco non ha più
 * senso (il re finirebbe dalla parte sbagliata), quindi i diritti si tolgono.
 * Chi ha ancora l'arrocco resta fuori dalla specchiatura, non lo si falsifica.
 */

const FILES = 'abcdefgh';

/* Le otto traverse della FEN, ognuna espansa a otto caratteri ('.' = casa vuota). */
function righe(fen) {
  return fen.split(' ')[0].split('/').map((riga) => {
    let out = '';
    for (const c of riga) out += /\d/.test(c) ? '.'.repeat(Number(c)) : c;
    return out;
  });
}

function comprimi(righe) {
  return righe.map((riga) => riga.replace(/\.+/g, (vuote) => String(vuote.length))).join('/');
}

const scambiaCaso = (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());

const specchiaCasa = (casa) => (casa === '-' ? '-' : FILES[7 - FILES.indexOf(casa[0])] + casa[1]);
const ribaltaCasa = (casa) => (casa === '-' ? '-' : casa[0] + String(9 - Number(casa[1])));

/** Si può specchiare solo se nessuno dei due può ancora arroccare. */
export function specchiabile(fen) {
  return fen.split(' ')[2] === '-';
}

/**
 * Colonne invertite. Chi muove, i colori e le traverse restano quelli:
 * cambia soltanto da che parte della scacchiera succede tutto.
 */
export function specchia(fen) {
  const [, turno, , ep, mezze, mosse] = fen.split(' ');
  const board = comprimi(righe(fen).map((riga) => [...riga].reverse().join('')));
  return `${board} ${turno} - ${specchiaCasa(ep)} ${mezze} ${mosse}`;
}

/**
 * Traverse invertite e colori scambiati: chi era il Bianco in fondo diventa il
 * Nero in cima. I pedoni continuano ad andare avanti, l'arrocco cambia padrone.
 */
export function ribalta(fen) {
  const [, turno, arrocco, ep, mezze, mosse] = fen.split(' ');
  const board = comprimi(righe(fen).reverse().map((riga) => [...riga].map(scambiaCaso).join('')));
  const nuovoArrocco = arrocco === '-' ? '-'
    : [...arrocco].map(scambiaCaso).sort((a, b) => 'KQkq'.indexOf(a) - 'KQkq'.indexOf(b)).join('');
  return `${board} ${turno === 'w' ? 'b' : 'w'} ${nuovoArrocco} ${ribaltaCasa(ep)} ${mezze} ${mosse}`;
}

export const specchiaUci = (uci) =>
  specchiaCasa(uci.slice(0, 2)) + specchiaCasa(uci.slice(2, 4)) + uci.slice(4);

export const ribaltaUci = (uci) =>
  ribaltaCasa(uci.slice(0, 2)) + ribaltaCasa(uci.slice(2, 4)) + uci.slice(4);

/** Le trasformazioni disponibili, in ordine di quanto cambiano il quadro. */
export const FORME = ['dritta', 'specchiata', 'ribaltata', 'entrambe'];

/**
 * Sceglie la forma in modo **deterministico** a partire dall'identificativo e
 * da quante volte quella carta è già stata vista: alla prima si vede dritta,
 * ai ripassi cambia. Deterministico e non casuale perché due dispositivi che
 * si sincronizzano devono vedere la stessa cosa, e perché una prova che non si
 * può rigiocare uguale non è una prova.
 */
export function formaPer(puzzle, ripetizione = 0) {
  if (ripetizione <= 0) return 'dritta';
  const disponibili = specchiabile(puzzle.f) ? FORME : ['dritta', 'ribaltata'];
  return disponibili[ripetizione % disponibili.length];
}

/**
 * La posizione trasformata, soluzione compresa. Restituisce un oggetto della
 * stessa forma di un puzzle del corpus, così chi la usa non deve saperlo.
 * `id` resta quello originale: è la stessa carta, non una carta nuova.
 */
export function variante(puzzle, forma = 'dritta') {
  if (forma === 'dritta') return { ...puzzle, forma };
  if (forma === 'specchiata' && !specchiabile(puzzle.f)) return { ...puzzle, forma: 'dritta' };

  let fen = puzzle.f;
  let mosse = puzzle.m.split(' ');

  if (forma === 'specchiata' || forma === 'entrambe') {
    if (!specchiabile(fen)) return { ...puzzle, forma: 'ribaltata', ...applica(puzzle, 'ribaltata') };
    fen = specchia(fen);
    mosse = mosse.map(specchiaUci);
  }
  if (forma === 'ribaltata' || forma === 'entrambe') {
    fen = ribalta(fen);
    mosse = mosse.map(ribaltaUci);
  }
  return { ...puzzle, f: fen, m: mosse.join(' '), forma };
}

function applica(puzzle, forma) {
  const fen = forma === 'ribaltata' ? ribalta(puzzle.f) : specchia(puzzle.f);
  const uci = forma === 'ribaltata' ? ribaltaUci : specchiaUci;
  return { f: fen, m: puzzle.m.split(' ').map(uci).join(' ') };
}
