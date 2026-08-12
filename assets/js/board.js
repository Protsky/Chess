/*
 * board.js — scacchiera interattiva (tocca il pezzo, tocca la destinazione)
 */
import { legalMoves, colorOf, rowOf, colOf, idx, FILES, inCheck, kingSquare } from './chess.js';

// Il selettore di variante testuale (U+FE0E) evita che iOS renda i pezzi come emoji.
const GLYPH = { K: '♚︎', Q: '♛︎', R: '♜︎', B: '♝︎', N: '♞︎', P: '♟︎' };

export class Board {
  constructor({ onMove } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', 'Scacchiera');

    this.onMove = onMove || (() => {});
    this.orientation = 'w';
    this.state = null;
    this.lastMove = null;
    this.interactive = false;
    this.selected = null;
    this.candidates = [];
    this.squares = [];
    this.pieces = [];

    this.buildSquares();
    this.el.addEventListener('click', (e) => {
      const sq = e.target.closest('.sq');
      if (sq) this.handleTap(Number(sq.dataset.i));
    });
  }

  buildSquares() {
    this.el.textContent = '';
    this.squares = new Array(64);
    this.pieces = new Array(64);

    const order = [];
    for (let i = 0; i < 64; i++) order.push(i);
    if (this.orientation === 'b') order.reverse();

    for (const i of order) {
      const r = rowOf(i);
      const c = colOf(i);
      const sq = document.createElement('div');
      sq.className = `sq${(r + c) % 2 ? ' sq--dark' : ''}`;
      sq.dataset.i = String(i);

      const piece = document.createElement('span');
      piece.className = 'piece';
      sq.appendChild(piece);
      this.pieces[i] = piece;

      const lastRow = this.orientation === 'w' ? 7 : 0;
      const firstCol = this.orientation === 'w' ? 0 : 7;
      if (r === lastRow) sq.appendChild(coord('file', FILES[c]));
      if (c === firstCol) sq.appendChild(coord('rank', String(8 - r)));

      this.el.appendChild(sq);
      this.squares[i] = sq;
    }
  }

  setOrientation(color) {
    if (color === this.orientation) return;
    this.orientation = color;
    this.buildSquares();
    this.render();
  }

  flip() {
    this.setOrientation(this.orientation === 'w' ? 'b' : 'w');
  }

  setPosition(state, lastMove = null) {
    this.state = state;
    this.lastMove = lastMove;
    this.selected = null;
    this.candidates = [];
    this.render();
  }

  setInteractive(on) {
    this.interactive = on;
    this.el.classList.toggle('board--locked', !on);
    if (!on) {
      this.selected = null;
      this.candidates = [];
      this.render();
    }
  }

  render() {
    if (!this.state) return;
    const check = inCheck(this.state) ? kingSquare(this.state.board, this.state.turn) : -1;

    for (let i = 0; i < 64; i++) {
      const sq = this.squares[i];
      const p = this.state.board[i];
      const span = this.pieces[i];

      if (p) {
        span.textContent = GLYPH[p.toUpperCase()];
        span.className = `piece piece--${colorOf(p)}`;
      } else {
        span.textContent = '';
        span.className = 'piece';
      }

      sq.classList.toggle('sq--sel', this.selected === i);
      sq.classList.toggle('sq--last', !!this.lastMove && (this.lastMove.from === i || this.lastMove.to === i));
      sq.classList.toggle('sq--check', check === i);

      const dest = this.candidates.find((m) => m.to === i);
      sq.classList.toggle('sq--dest', !!dest);
      sq.classList.toggle('sq--capture', !!dest && (!!dest.capture || dest.enPassant));
    }
  }

  handleTap(i) {
    if (!this.interactive || !this.state) return;

    if (this.selected !== null) {
      const moves = this.candidates.filter((m) => m.to === i);
      if (moves.length) {
        // Nelle aperture non si promuove mai: in caso di promozione si sceglie la donna.
        const move = moves.find((m) => !m.promo || m.promo.toUpperCase() === 'Q') || moves[0];
        this.selected = null;
        this.candidates = [];
        this.render();
        this.onMove(move);
        return;
      }
      if (this.selected === i) {
        this.selected = null;
        this.candidates = [];
        this.render();
        return;
      }
    }

    const piece = this.state.board[i];
    if (piece && colorOf(piece) === this.state.turn) {
      const moves = legalMoves(this.state).filter((m) => m.from === i);
      this.selected = moves.length ? i : null;
      this.candidates = moves;
    } else {
      this.selected = null;
      this.candidates = [];
    }
    this.render();
  }

  /** Effetto temporaneo su una casa (`good`, `wrong`, `hint`). */
  flash(square, kind, ms = 600) {
    const sq = this.squares[square];
    if (!sq) return;
    const cls = `sq--${kind}`;
    sq.classList.remove(cls);
    void sq.offsetWidth; // forza il restart dell'animazione
    sq.classList.add(cls);
    if (ms) window.setTimeout(() => sq.classList.remove(cls), ms);
  }

  clearFlash(kind) {
    const cls = `sq--${kind}`;
    this.squares.forEach((sq) => sq.classList.remove(cls));
  }
}

function coord(kind, text) {
  const el = document.createElement('span');
  el.className = `sq__coord sq__coord--${kind}`;
  el.textContent = text;
  return el;
}

export { idx };
