/*
 * chess.js — mini motore scacchistico
 * Indici: 0 = a8 ... 63 = h1  (riga 0 in alto)
 * Pezzi:  maiuscolo = Bianco, minuscolo = Nero, null = casa vuota
 */

export const FILES = 'abcdefgh';

export const idx = (r, c) => r * 8 + c;
export const rowOf = (i) => i >> 3;
export const colOf = (i) => i & 7;
export const nameOf = (i) => FILES[colOf(i)] + (8 - rowOf(i));
export const idxOf = (name) => idx(8 - Number(name[1]), FILES.indexOf(name[0]));
export const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const other = (c) => (c === 'w' ? 'b' : 'w');

const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_D = [...BISHOP_D, ...ROOK_D];

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

/** Posizione iniziale. */
export function newGame() {
  const board = new Array(64).fill(null);
  const back = 'rnbqkbnr';
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = back[c];
    board[idx(1, c)] = 'p';
    board[idx(6, c)] = 'P';
    board[idx(7, c)] = back[c].toUpperCase();
  }
  return { board, turn: 'w', castling: { K: true, Q: true, k: true, q: true }, ep: null, half: 0, full: 1 };
}

export function clone(s) {
  return {
    board: s.board.slice(),
    turn: s.turn,
    castling: { ...s.castling },
    ep: s.ep,
    half: s.half,
    full: s.full,
  };
}

/** La casa `target` è attaccata da un pezzo di colore `by`? */
export function isAttacked(board, target, by) {
  const r = rowOf(target);
  const c = colOf(target);

  // Pedoni (il bianco cattura verso righe minori, il nero verso righe maggiori)
  const pr = by === 'w' ? r + 1 : r - 1;
  const pawn = by === 'w' ? 'P' : 'p';
  for (const dc of [-1, 1]) {
    if (inside(pr, c + dc) && board[idx(pr, c + dc)] === pawn) return true;
  }

  // Cavalli
  const knight = by === 'w' ? 'N' : 'n';
  for (const [dr, dc] of KNIGHT_D) {
    if (inside(r + dr, c + dc) && board[idx(r + dr, c + dc)] === knight) return true;
  }

  // Re
  const king = by === 'w' ? 'K' : 'k';
  for (const [dr, dc] of QUEEN_D) {
    if (inside(r + dr, c + dc) && board[idx(r + dr, c + dc)] === king) return true;
  }

  // Pezzi che scorrono
  const sliders = [
    { dirs: BISHOP_D, pieces: by === 'w' ? ['B', 'Q'] : ['b', 'q'] },
    { dirs: ROOK_D, pieces: by === 'w' ? ['R', 'Q'] : ['r', 'q'] },
  ];
  for (const { dirs, pieces } of sliders) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const p = board[idx(rr, cc)];
        if (p) {
          if (pieces.includes(p)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

export function kingSquare(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  return board.indexOf(king);
}

export function inCheck(state, color = state.turn) {
  const k = kingSquare(state.board, color);
  return k >= 0 && isAttacked(state.board, k, other(color));
}

function pushMove(list, m) {
  list.push({ promo: null, capture: null, castle: null, enPassant: false, ...m });
}

/** Mosse pseudo-legali (senza filtro sullo scacco). */
function pseudoMoves(state) {
  const { board, turn } = state;
  const moves = [];
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || colorOf(piece) !== turn) continue;
    const r = rowOf(from);
    const c = colOf(from);
    const type = piece.toUpperCase();

    if (type === 'P') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const lastRow = turn === 'w' ? 0 : 7;
      const one = idx(r + dir, c);
      if (inside(r + dir, c) && !board[one]) {
        addPawn(moves, from, one, piece, null, r + dir === lastRow);
        const two = idx(r + 2 * dir, c);
        if (r === startRow && !board[two]) {
          pushMove(moves, { from, to: two, piece });
        }
      }
      for (const dc of [-1, 1]) {
        if (!inside(r + dir, c + dc)) continue;
        const to = idx(r + dir, c + dc);
        const targetPiece = board[to];
        if (targetPiece && colorOf(targetPiece) !== turn) {
          addPawn(moves, from, to, piece, targetPiece, r + dir === lastRow);
        } else if (!targetPiece && state.ep === to) {
          pushMove(moves, { from, to, piece, capture: turn === 'w' ? 'p' : 'P', enPassant: true });
        }
      }
      continue;
    }

    if (type === 'N' || type === 'K') {
      const dirs = type === 'N' ? KNIGHT_D : QUEEN_D;
      for (const [dr, dc] of dirs) {
        if (!inside(r + dr, c + dc)) continue;
        const to = idx(r + dr, c + dc);
        const targetPiece = board[to];
        if (targetPiece && colorOf(targetPiece) === turn) continue;
        pushMove(moves, { from, to, piece, capture: targetPiece });
      }
      if (type === 'K') addCastling(state, moves, from, piece);
      continue;
    }

    const dirs = type === 'B' ? BISHOP_D : type === 'R' ? ROOK_D : QUEEN_D;
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (inside(rr, cc)) {
        const to = idx(rr, cc);
        const targetPiece = board[to];
        if (targetPiece && colorOf(targetPiece) === turn) break;
        pushMove(moves, { from, to, piece, capture: targetPiece });
        if (targetPiece) break;
        rr += dr;
        cc += dc;
      }
    }
  }
  return moves;
}

function addPawn(moves, from, to, piece, capture, promoting) {
  if (promoting) {
    for (const p of ['Q', 'R', 'B', 'N']) {
      pushMove(moves, { from, to, piece, capture, promo: colorOf(piece) === 'w' ? p : p.toLowerCase() });
    }
  } else {
    pushMove(moves, { from, to, piece, capture });
  }
}

function addCastling(state, moves, from, piece) {
  const { board, turn, castling } = state;
  const enemy = other(turn);
  const home = turn === 'w' ? idxOf('e1') : idxOf('e8');
  if (from !== home) return;
  if (isAttacked(board, home, enemy)) return;

  const short = turn === 'w' ? castling.K : castling.k;
  const long = turn === 'w' ? castling.Q : castling.q;

  if (short) {
    const [f1, g1, h1] = turn === 'w' ? ['f1', 'g1', 'h1'] : ['f8', 'g8', 'h8'];
    const rook = turn === 'w' ? 'R' : 'r';
    if (!board[idxOf(f1)] && !board[idxOf(g1)] && board[idxOf(h1)] === rook &&
        !isAttacked(board, idxOf(f1), enemy) && !isAttacked(board, idxOf(g1), enemy)) {
      pushMove(moves, { from, to: idxOf(g1), piece, castle: 'K' });
    }
  }
  if (long) {
    const [d1, c1, b1, a1] = turn === 'w' ? ['d1', 'c1', 'b1', 'a1'] : ['d8', 'c8', 'b8', 'a8'];
    const rook = turn === 'w' ? 'R' : 'r';
    if (!board[idxOf(d1)] && !board[idxOf(c1)] && !board[idxOf(b1)] && board[idxOf(a1)] === rook &&
        !isAttacked(board, idxOf(d1), enemy) && !isAttacked(board, idxOf(c1), enemy)) {
      pushMove(moves, { from, to: idxOf(c1), piece, castle: 'Q' });
    }
  }
}

/** Mosse legali della posizione. */
export function legalMoves(state) {
  return pseudoMoves(state).filter((m) => {
    const next = applyMove(state, m);
    return !inCheck({ ...next, turn: state.turn }, state.turn);
  });
}

/** Applica una mossa e restituisce il nuovo stato (non muta l'originale). */
export function applyMove(state, move) {
  const s = clone(state);
  const { board } = s;
  const color = colorOf(move.piece);

  board[move.from] = null;
  board[move.to] = move.promo || move.piece;

  if (move.enPassant) {
    const capturedSquare = idx(rowOf(move.to) + (color === 'w' ? 1 : -1), colOf(move.to));
    board[capturedSquare] = null;
  }

  if (move.castle) {
    const row = color === 'w' ? 7 : 0;
    const rook = color === 'w' ? 'R' : 'r';
    if (move.castle === 'K') {
      board[idx(row, 7)] = null;
      board[idx(row, 5)] = rook;
    } else {
      board[idx(row, 0)] = null;
      board[idx(row, 3)] = rook;
    }
  }

  // Diritti di arrocco
  const type = move.piece.toUpperCase();
  if (type === 'K') {
    if (color === 'w') { s.castling.K = false; s.castling.Q = false; }
    else { s.castling.k = false; s.castling.q = false; }
  }
  const corner = { [idxOf('a1')]: 'Q', [idxOf('h1')]: 'K', [idxOf('a8')]: 'q', [idxOf('h8')]: 'k' };
  if (corner[move.from]) s.castling[corner[move.from]] = false;
  if (corner[move.to]) s.castling[corner[move.to]] = false;

  // Presa al varco disponibile solo dopo un doppio passo di pedone
  s.ep = null;
  if (type === 'P' && Math.abs(rowOf(move.to) - rowOf(move.from)) === 2) {
    s.ep = idx((rowOf(move.to) + rowOf(move.from)) / 2, colOf(move.from));
  }

  s.half = type === 'P' || move.capture ? 0 : s.half + 1;
  if (color === 'b') s.full += 1;
  s.turn = other(color);
  return s;
}

export function sameMove(a, b) {
  return !!a && !!b && a.from === b.from && a.to === b.to && (a.promo || null) === (b.promo || null);
}

/** Notazione algebrica (inglese) della mossa nella posizione data. */
export function toSan(state, move, moves = legalMoves(state)) {
  const type = move.piece.toUpperCase();
  let san;

  if (move.castle) {
    san = move.castle === 'K' ? 'O-O' : 'O-O-O';
  } else if (type === 'P') {
    san = move.capture ? `${FILES[colOf(move.from)]}x${nameOf(move.to)}` : nameOf(move.to);
    if (move.promo) san += `=${move.promo.toUpperCase()}`;
  } else {
    const rivals = moves.filter(
      (m) => m.piece === move.piece && m.to === move.to && m.from !== move.from,
    );
    let disamb = '';
    if (rivals.length) {
      const sameFile = rivals.some((m) => colOf(m.from) === colOf(move.from));
      const sameRank = rivals.some((m) => rowOf(m.from) === rowOf(move.from));
      if (!sameFile) disamb = FILES[colOf(move.from)];
      else if (!sameRank) disamb = String(8 - rowOf(move.from));
      else disamb = nameOf(move.from);
    }
    san = `${type}${disamb}${move.capture ? 'x' : ''}${nameOf(move.to)}`;
  }

  const next = applyMove(state, move);
  if (inCheck(next)) san += legalMoves(next).length ? '+' : '#';
  return san;
}

/** Converte una SAN (inglese) nella mossa legale corrispondente, o null. */
export function fromSan(state, san) {
  const moves = legalMoves(state);
  const clean = san.replace(/[+#!?]/g, '').replace(/\s+/g, '').replace(/e\.p\./i, '');

  if (/^([0O])-\1-\1$/.test(clean)) return moves.find((m) => m.castle === 'Q') || null;
  if (/^([0O])-\1$/.test(clean)) return moves.find((m) => m.castle === 'K') || null;

  const m = clean.match(/^([KQRBN])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([QRBN]))?$/);
  if (!m) return null;
  const [, letter, file, rank, target, promo] = m;
  const type = letter || 'P';
  const to = idxOf(target);

  const candidates = moves.filter((mv) => {
    if (mv.piece.toUpperCase() !== type) return false;
    if (mv.to !== to) return false;
    if (file && FILES[colOf(mv.from)] !== file) return false;
    if (rank && String(8 - rowOf(mv.from)) !== rank) return false;
    if (promo && (mv.promo || '').toUpperCase() !== promo) return false;
    if (!promo && mv.promo) return mv.promo.toUpperCase() === 'Q';
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Riproduce una linea di mosse SAN.
 * @returns {{states: object[], moves: object[], sans: string[]}}
 */
export function playLine(sans, start = newGame()) {
  const states = [start];
  const moves = [];
  let state = start;
  sans.forEach((san, i) => {
    const move = fromSan(state, san);
    if (!move) throw new Error(`Mossa non valida "${san}" alla semimossa ${i + 1}`);
    moves.push(move);
    state = applyMove(state, move);
    states.push(state);
  });
  return { states, moves, sans };
}

export function fen(state) {
  let rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[idx(r, c)];
      if (p) {
        if (empty) { row += empty; empty = 0; }
        row += p;
      } else empty++;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const rights = ['K', 'Q', 'k', 'q'].filter((k) => state.castling[k]).join('') || '-';
  return `${rows.join('/')} ${state.turn} ${rights} ${state.ep === null ? '-' : nameOf(state.ep)} ${state.half} ${state.full}`;
}

/** Numero di mossa leggibile: 1, 1..., 2, ... */
export function moveNumber(ply) {
  return Math.floor(ply / 2) + 1;
}
