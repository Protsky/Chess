/*
 * app.js — navigazione, modalità "Impara" e modalità "Allena".
 */
import { LEVELS, OPENINGS, byLevel, byId, plies } from './openings.js';
import { playLine, sameMove, nameOf, moveNumber } from './chess.js';
import { Board } from './board.js';
import * as Store from './store.js';

/* ------------------------------- utilità ------------------------------- */

const PIECE_IT = { P: 'il pedone', N: 'il cavallo', B: 'l’alfiere', R: 'la torre', Q: 'la donna', K: 'il re' };
const SAN_IT = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
const COLOR_IT = { w: 'Bianco', b: 'Nero' };

const app = document.getElementById('view');
const barBack = document.getElementById('bar-back');
const barTitle = document.getElementById('bar-title');
const barAction = document.getElementById('bar-action');

const board = new Board({ onMove: (move) => session && session.onMove(move) });

let session = null;      // allenamento in corso
let timers = [];         // timer da ripulire al cambio schermata

const h = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const later = (fn, ms) => {
  const id = window.setTimeout(fn, ms);
  timers.push(id);
  return id;
};

const clearTimers = () => {
  timers.forEach(window.clearTimeout);
  timers.forEach(window.clearInterval);
  timers = [];
};

/** Traduce la notazione inglese in italiana, se richiesto dalle impostazioni. */
function san(text) {
  if (Store.getSettings().notation !== 'it') return text;
  return text.replace(/^([KQRBN])/, (_, l) => SAN_IT[l]).replace(/=([QRBN])/, (_, l) => `=${SAN_IT[l]}`);
}

function sanChip(index, text) {
  const n = moveNumber(index);
  return index % 2 === 0 ? `${n}. ${san(text)}` : `${n}… ${san(text)}`;
}

function starsHtml(count, total = 3) {
  return Array.from({ length: total }, (_, i) => `<span class="star${i < count ? ' star--on' : ''}">★</span>`).join('');
}

function line(opening) {
  return playLine(plies(opening));
}

function userPlyIndexes(opening, total) {
  const out = [];
  for (let i = 0; i < total; i++) if ((i % 2 === 0 ? 'w' : 'b') === opening.side) out.push(i);
  return out;
}

/* --------------------------------- audio -------------------------------- */

let audio = null;

function beep(kind) {
  if (!Store.getSettings().sounds) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = audio || new Ctx();
    if (audio.state === 'suspended') audio.resume();
    const notes = { move: [520], ok: [660, 880], err: [190, 150], win: [660, 880, 1180] }[kind] || [440];
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = kind === 'err' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const start = audio.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'err' ? 0.09 : 0.14, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* audio non disponibile: si prosegue in silenzio */
  }
}

/* ------------------------------- barra alta ----------------------------- */

function setBar({ title, back = null, action = null }) {
  barTitle.textContent = title;
  if (back) {
    barBack.hidden = false;
    barBack.onclick = () => { location.hash = back; };
  } else {
    barBack.hidden = true;
    barBack.onclick = null;
  }
  if (action) {
    barAction.hidden = false;
    barAction.textContent = action.label;
    barAction.setAttribute('aria-label', action.aria || action.label);
    barAction.onclick = action.onClick;
  } else {
    barAction.hidden = true;
    barAction.onclick = null;
  }
}

/* ------------------------------- schermate ------------------------------ */

function renderHome() {
  const all = Store.summarize(OPENINGS);
  const last = Store.getLastOpening() && byId(Store.getLastOpening());

  setBar({ title: 'Aperture di Scacchi', action: { label: '⚙︎', aria: 'Impostazioni', onClick: () => { location.hash = '#/impostazioni'; } } });

  const view = h(`<div class="stack">
    <div class="hero">
      <h1>Impara le aperture</h1>
      <p>Studia le linee principali mossa dopo mossa, poi giocale a memoria sulla scacchiera. Tre livelli, ${OPENINGS.length} aperture.</p>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat__value stat__value--gold">${all.stars}</div><div class="stat__label">Stelle</div></div>
      <div class="stat"><div class="stat__value">${all.mastered}</div><div class="stat__label">Padroneggiate</div></div>
      <div class="stat"><div class="stat__value">${all.percent}%</div><div class="stat__label">Completato</div></div>
    </div>
    ${last ? `<button class="card" data-go="#/apertura/${last.id}">
      <div class="row"><span class="tag tag--gold">Riprendi</span><span class="spacer"></span><span class="level-card__chevron">›</span></div>
      <div class="level-card__name" style="margin-top:8px">${esc(last.name)}</div>
      <div class="opening-card__meta">${esc(last.family)}</div>
    </button>` : ''}
    <div class="section-title">Livelli</div>
    <div class="stack" id="levels"></div>
    <p class="hint-text">Suggerimento: da Safari tocca <strong>Condividi ▸ Aggiungi a Home</strong> per usare l’app a schermo intero, anche offline.</p>
  </div>`);

  const levels = view.querySelector('#levels');
  for (const level of LEVELS) {
    const stats = Store.summarize(byLevel(level.id));
    levels.appendChild(h(`<button class="card level-card" data-go="#/livello/${level.id}">
      <div class="level-card__badge">${level.icon}</div>
      <div class="level-card__body">
        <div class="level-card__name">${esc(level.name)}</div>
        <div class="level-card__tag">${esc(level.tagline)}</div>
        <div class="bar"><div class="bar__fill" style="width:${stats.percent}%"></div></div>
        <div class="bar__label">${stats.stars}/${stats.max} stelle · ${stats.total} aperture</div>
      </div>
      <div class="level-card__chevron">›</div>
    </button>`));
  }

  mount(view);
}

function renderLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) return renderHome();

  const openings = byLevel(level.id);
  const stats = Store.summarize(openings);
  setBar({ title: level.name, back: '#/' });

  const view = h(`<div class="stack">
    <div class="hero">
      <h1>${esc(level.name)}</h1>
      <p>${esc(level.description)}</p>
      <div class="bar"><div class="bar__fill" style="width:${stats.percent}%"></div></div>
      <div class="bar__label">${stats.stars}/${stats.max} stelle · ${stats.mastered} su ${stats.total} padroneggiate</div>
    </div>
    <button class="btn btn--primary" data-go="#/allenamento/${level.id}">⚡ Allenamento del livello</button>
    <div class="section-title">Aperture</div>
    <div class="stack" id="list"></div>
  </div>`);

  const list = view.querySelector('#list');
  for (const opening of openings) {
    const p = Store.getProgress(opening.id);
    list.appendChild(h(`<button class="card opening-card" data-go="#/apertura/${opening.id}">
      <div class="opening-card__top">
        <span class="opening-card__name">${esc(opening.name)}</span>
        <span class="tag">${esc(opening.eco)}</span>
      </div>
      <div class="opening-card__meta">${esc(opening.family)} · si gioca con il <strong>${COLOR_IT[opening.side]}</strong></div>
      <div class="row">
        <div class="stars">${starsHtml(p.stars)}</div>
        <span class="spacer"></span>
        <span class="tag tag--${opening.side}">${p.attempts ? `${p.best}% al meglio` : 'da iniziare'}</span>
      </div>
    </button>`));
  }

  mount(view);
}

/* ------------------------------ modalità studio ------------------------- */

function renderStudy(id) {
  const opening = byId(id);
  if (!opening) return renderHome();

  Store.setLastOpening(opening.id);
  const { states, moves, sans } = line(opening);
  const progress = Store.getProgress(opening.id);
  let ply = 0;
  let playing = null;

  setBar({ title: opening.name, back: `#/livello/${opening.level}`, action: { label: '⇅', aria: 'Gira la scacchiera', onClick: () => board.flip() } });

  const view = h(`<div class="stack">
    <div class="opening-head">
      <h2>${esc(opening.name)}</h2>
      <p>${esc(opening.family)} · ${esc(opening.eco)} · giochi con il ${COLOR_IT[opening.side]}</p>
      <div class="row" style="margin-top:8px">
        <div class="stars">${starsHtml(progress.stars)}</div>
        <span class="spacer"></span>
        <span class="tag">${progress.attempts ? `record ${progress.best}%` : 'mai allenata'}</span>
      </div>
    </div>
    <div class="segmented" role="tablist">
      <button role="tab" aria-selected="true">Impara</button>
      <button role="tab" aria-selected="false" data-go="#/apertura/${opening.id}/allena">Allena</button>
    </div>
    <div class="board-wrap" id="board-host"></div>
    <div class="controls">
      <button id="first" aria-label="Inizio">⏮</button>
      <button id="prev" aria-label="Mossa precedente">‹</button>
      <button id="play" aria-label="Riproduci la variante">▶</button>
      <button id="next" aria-label="Mossa successiva">›</button>
      <button id="last" aria-label="Fine">⏭</button>
    </div>
    <div class="moves" id="moves"></div>
    <div class="note" id="note"></div>
    <div class="note" style="border-left-color:var(--blue)">
      <div class="note__label" style="color:var(--blue)">Piano di gioco</div>
      ${esc(opening.plan)}
    </div>
    <button class="btn btn--primary" data-go="#/apertura/${opening.id}/allena">Allena questa apertura</button>
  </div>`);

  const movesEl = view.querySelector('#moves');
  const noteEl = view.querySelector('#note');
  const playBtn = view.querySelector('#play');

  sans.forEach((text, i) => {
    const chip = h(`<button class="move-chip">${esc(sanChip(i, text))}</button>`);
    chip.onclick = () => { stop(); goTo(i + 1); };
    movesEl.appendChild(chip);
  });

  function goTo(target) {
    ply = Math.max(0, Math.min(sans.length, target));
    board.setPosition(states[ply], ply > 0 ? moves[ply - 1] : null);

    Array.from(movesEl.children).forEach((chip, i) => {
      chip.classList.toggle('move-chip--done', i < ply);
      chip.classList.toggle('move-chip--current', i === ply - 1);
    });
    const current = movesEl.children[ply - 1];
    if (current) current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    const note = ply > 0 ? opening.notes?.[ply - 1] : null;
    if (ply === 0) {
      noteEl.innerHTML = `<div class="note__label">L’idea</div>${esc(opening.summary)}`;
    } else {
      const label = `${sanChip(ply - 1, sans[ply - 1])} · ${COLOR_IT[(ply - 1) % 2 === 0 ? 'w' : 'b']}`;
      noteEl.innerHTML = `<div class="note__label">${esc(label)}</div>${esc(note || 'Prosegui: la variante continua.')}`;
    }

    view.querySelector('#first').disabled = ply === 0;
    view.querySelector('#prev').disabled = ply === 0;
    view.querySelector('#next').disabled = ply === sans.length;
    view.querySelector('#last').disabled = ply === sans.length;
  }

  function stop() {
    if (playing) window.clearInterval(playing);
    playing = null;
    playBtn.textContent = '▶';
  }

  playBtn.onclick = () => {
    if (playing) return stop();
    if (ply === sans.length) goTo(0);
    playBtn.textContent = '⏸';
    playing = window.setInterval(() => {
      if (ply >= sans.length) return stop();
      goTo(ply + 1);
      beep('move');
    }, 1100);
    timers.push(playing);
  };

  view.querySelector('#first').onclick = () => { stop(); goTo(0); };
  view.querySelector('#prev').onclick = () => { stop(); goTo(ply - 1); };
  view.querySelector('#next').onclick = () => { stop(); goTo(ply + 1); };
  view.querySelector('#last').onclick = () => { stop(); goTo(sans.length); };

  board.setInteractive(false);
  board.setOrientation(opening.side);
  mount(view);
  view.querySelector('#board-host').appendChild(board.el);
  goTo(0);
}

/* ---------------------------- modalità allenamento ---------------------- */

function renderTraining(queue, backHash, title) {
  const openings = queue.map(byId).filter(Boolean);
  if (!openings.length) return renderHome();

  setBar({ title, back: backHash, action: { label: '⇅', aria: 'Gira la scacchiera', onClick: () => board.flip() } });

  const results = [];
  let current = null;

  const view = h(`<div class="stack">
    <div class="opening-head" id="head"></div>
    <div class="progress-line" id="progress"></div>
    <div class="board-wrap" id="board-host"></div>
    <div class="prompt" id="prompt"><span class="prompt__dot"></span><span class="prompt__text"></span></div>
    <div class="moves" id="moves"></div>
    <div class="btn-row">
      <button class="btn" id="hint">💡 Aiuto</button>
      <button class="btn" id="reveal">👁 Mostra</button>
    </div>
    <button class="btn btn--ghost btn--danger" id="quit">Esci dall’allenamento</button>
  </div>`);

  const headEl = view.querySelector('#head');
  const progressEl = view.querySelector('#progress');
  const promptEl = view.querySelector('#prompt');
  const promptDot = promptEl.querySelector('.prompt__dot');
  const promptText = promptEl.querySelector('.prompt__text');
  const movesEl = view.querySelector('#moves');

  function setPrompt(text, kind = '') {
    promptEl.className = `prompt${kind ? ` prompt--${kind}` : ''}`;
    promptText.innerHTML = text;
  }

  function drawProgress() {
    progressEl.textContent = '';
    current.userPlies.forEach((plyIndex, i) => {
      const span = document.createElement('span');
      const state = current.marks[i];
      if (state) span.className = state;
      else if (plyIndex === current.ply) span.className = 'now';
      progressEl.appendChild(span);
    });
  }

  function drawMoves() {
    movesEl.hidden = !Store.getSettings().showMoves;
    movesEl.textContent = '';
    current.sans.forEach((text, i) => {
      const done = i < current.ply;
      const chip = h(`<span class="move-chip ${done ? 'move-chip--done' : 'move-chip--hidden'}">${
        esc(done ? sanChip(i, text) : `${moveNumber(i)}${i % 2 === 0 ? '.' : '…'} ???`)
      }</span>`);
      movesEl.appendChild(chip);
    });
    const last = movesEl.children[Math.max(0, current.ply - 1)];
    if (last) last.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function loadOpening(index) {
    const opening = openings[index];
    const { states, moves, sans } = line(opening);
    current = {
      opening,
      index,
      states,
      moves,
      sans,
      ply: 0,
      userPlies: userPlyIndexes(opening, sans.length),
      marks: [],
      attempts: 0,
      hints: 0,
      failed: false,
      start: Date.now(),
    };
    current.marks = current.userPlies.map(() => null);

    Store.setLastOpening(opening.id);
    headEl.innerHTML = `<h2>${esc(opening.name)}</h2><p>${
      openings.length > 1 ? `Apertura ${index + 1} di ${openings.length} · ` : ''
    }giochi con il ${COLOR_IT[opening.side]}</p>`;
    promptDot.className = `prompt__dot prompt__dot--${opening.side}`;

    board.setOrientation(opening.side);
    board.setPosition(states[0], null);
    drawProgress();
    drawMoves();
    step();
  }

  function step() {
    board.clearFlash('hint');
    if (current.ply >= current.moves.length) return finish();

    const turn = current.ply % 2 === 0 ? 'w' : 'b';
    if (turn !== current.opening.side) {
      board.setInteractive(false);
      setPrompt(`Il ${COLOR_IT[turn]} risponde…`);
      later(() => {
        playMove(current.moves[current.ply]);
        beep('move');
        step();
      }, 650);
      return;
    }

    board.setInteractive(true);
    current.failed = false;
    current.attempts = 0;
    const n = moveNumber(current.ply);
    setPrompt(`Tocca a te: <strong>mossa ${n} del ${COLOR_IT[turn]}</strong>. Qual è la continuazione?`);
  }

  function playMove(move) {
    current.ply += 1;
    board.setPosition(current.states[current.ply], move);
    drawProgress();
    drawMoves();
  }

  function markCurrent(value) {
    const i = current.userPlies.indexOf(current.ply);
    if (i >= 0 && current.marks[i] !== 'err') current.marks[i] = value;
  }

  function onMove(move) {
    const expected = current.moves[current.ply];
    if (!expected) return;

    if (sameMove(move, expected)) {
      // Si blocca subito la scacchiera: durante il riscontro e la risposta
      // avversaria nessun tocco deve poter registrare un'altra mossa.
      board.setInteractive(false);
      markCurrent(current.failed ? 'err' : 'ok');
      board.flash(move.to, 'good', 700);
      beep('ok');
      const text = sanChip(current.ply, current.sans[current.ply]);
      playMove(expected);
      setPrompt(`<strong>${esc(text)}</strong> — esatto!`, 'good');
      later(step, 520);
      return;
    }

    current.attempts += 1;
    current.failed = true;
    markCurrent('err');
    drawProgress();
    board.flash(move.to, 'wrong', 500);
    beep('err');

    if (current.attempts === 1) {
      setPrompt('Non è la mossa della variante. Riprova.', 'bad');
    } else {
      const piece = PIECE_IT[expected.piece.toUpperCase()];
      board.flash(expected.from, 'hint', 2600);
      setPrompt(`Non ancora. Muovi <strong>${piece}</strong> che si trova in ${esc(nameOf(expected.from))}.`, 'bad');
    }
  }

  function finish() {
    board.setInteractive(false);
    const total = current.userPlies.length;
    const ok = current.marks.filter((m) => m === 'ok').length;
    const accuracy = Math.round((ok / total) * 100);
    const stars = accuracy === 100 && current.hints === 0 ? 3 : accuracy >= 80 ? 2 : 1;
    const seconds = Math.round((Date.now() - current.start) / 1000);

    const saved = Store.saveResult(current.opening.id, { stars, accuracy });
    results.push({ opening: current.opening, accuracy, stars, seconds });
    beep(stars === 3 ? 'win' : 'ok');

    const isLast = current.index === openings.length - 1;
    renderResult({ accuracy, stars, seconds, ok, total, saved, isLast, index: current.index });
  }

  function renderResult({ accuracy, stars, seconds, ok, total, saved, isLast, index }) {
    const titles = { 3: 'Perfetto!', 2: 'Ci siamo quasi', 1: 'Apertura completata' };
    const panel = h(`<div class="stack">
      <div class="result">
        <div class="result__stars">${starsHtml(stars)}</div>
        <div class="result__title">${titles[stars]}</div>
        <div class="result__sub">${esc(current.opening.name)}<br>${ok} mosse su ${total} indovinate al primo colpo${
          current.hints ? ` · ${current.hints} aiuti usati` : ''
        }</div>
        <div class="result__grid">
          <div class="stat"><div class="stat__value stat__value--gold">${accuracy}%</div><div class="stat__label">Precisione</div></div>
          <div class="stat"><div class="stat__value">${seconds}s</div><div class="stat__label">Tempo</div></div>
          <div class="stat"><div class="stat__value">${saved.best}%</div><div class="stat__label">Record</div></div>
        </div>
      </div>
      ${isLast ? '' : '<button class="btn btn--primary" id="next-op">Prossima apertura ›</button>'}
      <button class="btn ${isLast ? 'btn--primary' : ''}" id="again">↻ Ripeti questa apertura</button>
      <button class="btn btn--ghost" data-go="#/apertura/${current.opening.id}">Rivedi la variante</button>
      <button class="btn btn--ghost" data-go="${backHash}">Torna indietro</button>
    </div>`);

    if (isLast && results.length > 1) {
      const totalStars = results.reduce((sum, r) => sum + r.stars, 0);
      const avg = Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / results.length);
      panel.insertBefore(
        h(`<div class="note"><div class="note__label">Sessione completata</div>${results.length} aperture allenate · precisione media ${avg}% · ${totalStars} stelle in questa sessione.</div>`),
        panel.children[1] || null,
      );
    }

    mount(panel);
    const next = panel.querySelector('#next-op');
    if (next) next.onclick = () => { mount(view); attachBoard(); loadOpening(index + 1); };
    panel.querySelector('#again').onclick = () => { mount(view); attachBoard(); loadOpening(index); };
  }

  function attachBoard() {
    view.querySelector('#board-host').appendChild(board.el);
  }

  view.querySelector('#hint').onclick = () => {
    if (!board.interactive) return;
    const expected = current.moves[current.ply];
    if (!expected) return;
    current.hints += 1;
    current.failed = true;
    markCurrent('err');
    drawProgress();
    board.flash(expected.from, 'hint', 2600);
    setPrompt(`Muovi <strong>${PIECE_IT[expected.piece.toUpperCase()]}</strong> che si trova in ${esc(nameOf(expected.from))}.`);
  };

  view.querySelector('#reveal').onclick = () => {
    if (!board.interactive) return;
    const expected = current.moves[current.ply];
    if (!expected) return;
    current.hints += 1;
    markCurrent('err');
    const text = sanChip(current.ply, current.sans[current.ply]);
    playMove(expected);
    setPrompt(`La mossa era <strong>${esc(text)}</strong>. Memorizzala!`, 'bad');
    later(step, 900);
  };

  view.querySelector('#quit').onclick = () => { location.hash = backHash; };

  session = { onMove: (move) => onMove(move) };
  mount(view);
  attachBoard();
  loadOpening(0);
}

/* ------------------------------ impostazioni ---------------------------- */

function renderSettings() {
  const settings = Store.getSettings();
  setBar({ title: 'Impostazioni', back: '#/' });

  const view = h(`<div class="stack">
    <div class="section-title">Preferenze</div>
    <div class="setting">
      <div class="setting__label">Notazione italiana
        <div class="setting__hint">R, D, T, A, C invece di K, Q, R, B, N</div>
      </div>
      <button class="switch" id="notation" role="switch" aria-checked="${settings.notation === 'it'}" aria-label="Notazione italiana"></button>
    </div>
    <div class="setting">
      <div class="setting__label">Suoni
        <div class="setting__hint">Un segnale per mosse giuste e sbagliate</div>
      </div>
      <button class="switch" id="sounds" role="switch" aria-checked="${settings.sounds}" aria-label="Suoni"></button>
    </div>
    <div class="setting">
      <div class="setting__label">Elenco mosse durante l’allenamento
        <div class="setting__hint">Mostra le mosse già giocate sotto la scacchiera</div>
      </div>
      <button class="switch" id="showMoves" role="switch" aria-checked="${settings.showMoves}" aria-label="Elenco mosse"></button>
    </div>
    <div class="section-title">Dati</div>
    <div class="note">
      Allenamenti completati: <strong>${Store.totalTrainings()}</strong> · stelle totali: <strong>${Store.summarize(OPENINGS).stars}</strong>.
      I progressi restano su questo dispositivo.
    </div>
    <button class="btn btn--ghost btn--danger" id="reset">Azzera i progressi</button>
    <p class="hint-text">Aperture: ${OPENINGS.length} su ${LEVELS.length} livelli. Notazione, commenti e piani sono in italiano.</p>
  </div>`);

  const toggle = (id, read, write) => {
    const el = view.querySelector(`#${id}`);
    el.onclick = () => {
      const next = !read();
      write(next);
      el.setAttribute('aria-checked', String(next));
      beep('move');
    };
  };

  toggle('notation', () => Store.getSettings().notation === 'it', (v) => Store.setSetting('notation', v ? 'it' : 'en'));
  toggle('sounds', () => Store.getSettings().sounds, (v) => Store.setSetting('sounds', v));
  toggle('showMoves', () => Store.getSettings().showMoves, (v) => Store.setSetting('showMoves', v));

  view.querySelector('#reset').onclick = () => {
    if (window.confirm('Azzerare stelle e statistiche di tutte le aperture?')) {
      Store.reset();
      renderSettings();
    }
  };

  mount(view);
}

/* -------------------------------- routing ------------------------------- */

function mount(node) {
  app.textContent = '';
  app.appendChild(node);
  window.scrollTo(0, 0);
}

function pickQueue(level) {
  const openings = byLevel(level);
  const sorted = [...openings]
    .map((o) => ({ o, p: Store.getProgress(o.id), r: Math.random() }))
    .sort((a, b) => a.p.stars - b.p.stars || a.r - b.r);
  return sorted.slice(0, Math.min(4, sorted.length)).map((x) => x.o.id);
}

function route() {
  clearTimers();
  session = null;
  board.setInteractive(false);

  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [screen, param, sub] = parts;

  if (screen === 'livello') return renderLevel(Number(param));
  if (screen === 'apertura' && byId(param)) {
    if (sub === 'allena') {
      const opening = byId(param);
      return renderTraining([param], `#/apertura/${param}`, opening.name);
    }
    return renderStudy(param);
  }
  if (screen === 'allenamento') {
    const level = LEVELS.find((l) => l.id === Number(param));
    if (level) return renderTraining(pickQueue(level.id), `#/livello/${level.id}`, `Allenamento ${level.name}`);
  }
  if (screen === 'impostazioni') return renderSettings();
  return renderHome();
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-go]');
  if (target) {
    e.preventDefault();
    location.hash = target.dataset.go;
  }
});

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline non disponibile */ });
  });
}
