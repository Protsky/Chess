/*
 * app.js — navigazione, modalità "Impara" e modalità "Allena".
 */
import { LEVELS, OPENINGS, byLevel, byId, plies } from './openings.js';
import { playLine, sameMove, nameOf, moveNumber, fromFen, playUci, legalMoves, inCheck, applyMove, other, toSan } from './chess.js';
import { Board } from './board.js';
import * as Store from './store.js';
import * as Tactics from './tactics.js';
import * as Rating from './rating.js';
import * as Percorso from './percorso.js';
import * as Basics from './basics.js';
import * as Endgames from './endgames.js';
import * as Sync from './sync.js';
import { createScheduler, newCard, DEFAULT_W, AGAIN, HARD, GOOD, EASY } from './fsrs.js';
import * as Stats from './stats.js';
import * as Chart from './chart.js';
import * as Optimizer from './optimizer.js';

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

/* --------------------------- invio dei progressi ------------------------- */

/*
 * Dopo ogni sessione la copia va nel deposito, se la sincronizzazione è accesa.
 * Aspetta un secondo e mezzo e si accavalla con niente: chi finisce due sessioni
 * di fila manda una volta sola. Se la rete non c'è non succede niente di male —
 * il dispositivo resta la copia principale, e al prossimo giro riprova.
 */
let invioInCorso = null;

function sincronizzaPresto() {
  const { codice } = Store.getSync();
  if (!codice) return;
  clearTimeout(invioInCorso);
  invioInCorso = window.setTimeout(async () => {
    const esito = await Sync.spingi(codice, Store.exportJson());
    Store.setSync(esito.ok
      ? { ultimoInvio: Date.now(), ultimoErrore: null }
      : { ultimoErrore: esito.motivo });
  }, 1500);
}

/* ------------------------------- schermate ------------------------------ */

/**
 * La home risponde a tre domande, in quest'ordine: che cosa faccio adesso,
 * dove sono nel percorso, dov'è il resto. Prima apriva sulle aperture, che sono
 * il livello 6 di 8: era il posto sbagliato da cui cominciare.
 */
function renderHome() {
  const aperture = Store.summarize(OPENINGS);
  const rating = tacticState();
  const carte = Store.cardStats(Tactics.PREFIX);
  const daily = Store.getDaily();
  const streak = Store.getStreak();
  const settings = Store.getSettings();
  const viste = Store.allCards(Tactics.PREFIX).length;

  const oggi = Percorso.oggi({
    due: carte.due,
    introduced: daily.introduced,
    settings,
    size: Tactics.SESSION_SIZE,
    maxNew: Tactics.MAX_NEW,
    viste,
  });

  const avanzamenti = Percorso.avanzamenti({ rating: rating.rating, aperture, log: Store.getLog() });
  const corrente = Percorso.livelloCorrente(avanzamenti);
  const primaVolta = carte.total === 0;

  const daRipassare = [...OPENINGS]
    .map((o) => ({ o, p: Store.getProgress(o.id) }))
    .sort((a, b) => a.p.stars - b.p.stars || (a.p.lastAt || 0) - (b.p.lastAt || 0))[0];

  const base = ['L0', 'L1', 'L2'].includes(corrente.code);
  const testa = base
    ? {
      // Chi comincia non parte dalla tattica: parte dal gradino che ha davanti.
      titolo: corrente.name,
      riga: `${corrente.line} <span class="prompt__aside">${avanzamenti[corrente.code].label}.</span>`,
      cta: primaVolta && !Store.getLog().length ? 'Comincia da qui' : 'Continua da qui',
      hash: corrente.hash,
    }
    : primaVolta
      ? {
        titolo: 'Si comincia dalla tattica',
        riga: `${oggi.totale} posizioni mescolate, che si aggiustano da sole sulla tua forza. Circa ${oggi.minuti} minuti.`,
        cta: 'Inizia la prima sessione',
        hash: '#/tattica',
      }
      : oggi.totale > 0
        ? {
          titolo: 'La sessione di oggi',
          riga: `${oggi.totale} ${oggi.totale === 1 ? 'posizione' : 'posizioni'}: ${oggi.ripassi} in scadenza`
            + `${oggi.nuove ? ` e ${oggi.nuove} ${oggi.nuove === 1 ? 'nuova' : 'nuove'}` : ' e nessuna nuova, il tetto di oggi è pieno'}`
            + ` · circa ${oggi.minuti} ${oggi.minuti === 1 ? 'minuto' : 'minuti'}.`,
          cta: 'Inizia la sessione',
          hash: '#/tattica',
        }
        : {
          titolo: 'Per oggi la tattica è a posto',
          riga: `Niente in scadenza e ${daily.introduced} ${daily.introduced === 1 ? 'posizione nuova' : 'posizioni nuove'} già introdotte.`
            + ' Il tempo che avanza va bene per un’apertura.',
          cta: daRipassare ? `Allena ${daRipassare.o.name}` : 'Guarda le aperture',
          hash: daRipassare ? `#/apertura/${daRipassare.o.id}/allena` : '#/aperture',
        };

  setBar({ title: 'Scacchi', action: { label: '⚙︎', aria: 'Impostazioni', onClick: () => { location.hash = '#/impostazioni'; } } });

  const view = h(`<div class="stack">
    <div class="hero">
      <div class="eyebrow">Oggi · livello ${corrente.code.slice(1)} di 8</div>
      <h1>${esc(testa.titolo)}</h1>
      <p>${testa.riga}</p>
    </div>
    <button class="btn btn--primary" data-go="${testa.hash}">${esc(testa.cta)}</button>
    <div class="stats">
      <div class="stat"><div class="stat__value stat__value--gold">${avanzamenti[corrente.code]?.percent ?? 0}%</div><div class="stat__label">Verso il ${corrente.code}</div></div>
      <div class="stat"><div class="stat__value">${streak}</div><div class="stat__label">Giorni di fila</div></div>
      <div class="stat"><div class="stat__value">${daily.reviewed}</div><div class="stat__label">Fatte oggi</div></div>
    </div>

    <div class="section-title">Il percorso</div>
    <div class="stack" id="path"></div>
    <p class="hint-text">La forza si misura su tattica, finali e posizione: le aperture sono il livello 6, non il primo.
      Oggi l’app copre <strong>L0</strong>, <strong>L1</strong>, <strong>L2</strong>, <strong>L3</strong> e <strong>L6</strong>; gli altri tre sono da costruire, e finché non ci sono restano vuoti invece di fingere.</p>

    <div class="section-title">Studio</div>
    <button class="card tactic-card" data-go="#/tattica">
      <div class="tactic-card__body">
        <div class="level-card__name">🎯 Tattica — trova la mossa</div>
        <div class="tactic-card__meta">${carte.total
          ? `${carte.due} da ripassare · ${carte.total} carte · ${carte.solid} consolidate`
          : 'Posizioni vere con la difficoltà che insegue la tua forza'}</div>
      </div>
      <div class="level-card__chevron">›</div>
    </button>
    <button class="card tactic-card" data-go="#/aperture">
      <div class="tactic-card__body">
        <div class="level-card__name">📖 Aperture — impara e allena</div>
        <div class="tactic-card__meta">${aperture.stars}/${aperture.max} stelle · ${OPENINGS.length} aperture su ${LEVELS.length} livelli</div>
      </div>
      <div class="level-card__chevron">›</div>
    </button>

    <div class="section-title">Il quaderno</div>
    <button class="card tactic-card" data-go="#/statistiche">
      <div class="tactic-card__body">
        <div class="level-card__name">📈 Come sta andando</div>
        <div class="tactic-card__meta">Ritenzione vera, scadenze in arrivo, motivi deboli, taratura</div>
      </div>
      <div class="level-card__chevron">›</div>
    </button>
    <button class="card tactic-card" data-go="#/impostazioni">
      <div class="tactic-card__body">
        <div class="level-card__name">⚙︎ Impostazioni e backup</div>
        <div class="tactic-card__meta">Posizioni nuove al giorno, ritenzione, esporta i dati</div>
      </div>
      <div class="level-card__chevron">›</div>
    </button>

    <div class="note">
      <div class="note__label">Quello che l’app non può fare</div>
      Una partita lenta a settimana, analizzata a mano <em>prima</em> di accendere il motore. È lì che si producono i tuoi errori,
      ed è lo studio da soli — non le partite in sé — a predire il punteggio. Questo promemoria non lo posso misurare io.
    </div>
    <p class="hint-text">Da Safari: <strong>Condividi ▸ Aggiungi a Home</strong> per usarla a schermo intero e offline.
      I dati stanno solo qui: ogni tanto esporta un backup.</p>
  </div>`);

  const path = view.querySelector('#path');
  for (const livello of Percorso.LIVELLI) {
    const avanzamento = avanzamenti[livello.code];
    const attivo = livello.state === 'attivo';
    const qui = livello.code === corrente.code;
    const row = h(`<${attivo ? 'button' : 'div'} class="card path-row${attivo ? '' : ' path-row--soon'}${qui ? ' path-row--now' : ''}"${
      attivo ? ` data-go="${livello.hash}"` : ''
    }>
      <div class="path-row__code">${livello.code}</div>
      <div class="path-row__body">
        <div class="path-row__name">${esc(livello.name)}${qui ? ' <span class="tag tag--gold">sei qui</span>' : ''}</div>
        <div class="path-row__line">${esc(livello.line)}</div>
        ${attivo && avanzamento
          ? `<div class="bar"><div class="bar__fill" style="width:${avanzamento.percent}%"></div></div>
             <div class="bar__label">${esc(avanzamento.label)} · si esce a: ${esc(livello.exit)}</div>`
          : `<div class="bar__label">Da costruire · si uscirà a: ${esc(livello.exit)}</div>`}
      </div>
      ${attivo ? '<div class="level-card__chevron">›</div>' : '<div class="path-row__soon">in arrivo</div>'}
    </${attivo ? 'button' : 'div'}>`);
    path.appendChild(row);
  }

  mount(view);
}

/* ------------------------------- aperture ------------------------------- */

/** Il livello 6, con la sua schermata: i tre gradini del repertorio. */
function renderOpenings() {
  const all = Store.summarize(OPENINGS);
  const last = Store.getLastOpening() && byId(Store.getLastOpening());

  setBar({ title: 'Aperture', back: '#/' });

  const view = h(`<div class="stack">
    <div class="hero">
      <div class="eyebrow">Livello 6</div>
      <h1>Impara le aperture</h1>
      <p>Studia le linee mossa dopo mossa, poi giocale a memoria sulla scacchiera. ${OPENINGS.length} aperture su ${LEVELS.length} livelli.</p>
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
    <p class="hint-text">Una linea imparata rende quando sai giocare la posizione che produce: per questo le aperture stanno
      dopo la tattica, non prima.</p>
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
    sincronizzaPresto();
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

/* --------------------------------- tattica ------------------------------ */

/*
 * Lo scheduler si costruisce all'inizio di ogni sessione, non una volta sola:
 * la ritenzione richiesta e i pesi tarati in casa si possono cambiare fra una
 * sessione e l'altra, e uno scheduler nato con i valori vecchi continuerebbe a
 * dare scadenze che nessuno ha più chiesto.
 */
function makeScheduler() {
  const w = Store.getWeights();
  return createScheduler({
    requestRetention: Store.getSettings().retention,
    ...(w ? { w } : {}),
  });
}

/** Stato del punteggio tattico: quello vero, o quello di partenza se non c'è. */
function tacticState() {
  return Store.getRating(Tactics.AXIS) || { rating: Rating.START_RATING, attempts: 0 };
}

/** La posizione è matto? Serve ad accettare i matti alternativi. */
function isMate(state) {
  return inCheck(state) && legalMoves(state).length === 0;
}

function renderTacticsSession({ extraNew = 0 } = {}) {
  const now = Date.now();
  const state = tacticState();
  const cards = Store.allCards(Tactics.PREFIX);
  const scheduler = makeScheduler();

  /*
   * Il tetto giornaliero al materiale nuovo non è un dettaglio di comodo: ogni
   * posizione nuova genera i ripassi dei prossimi mesi, quindi la coda di
   * domani la si decide oggi. Si può sfondare, ma dicendolo.
   */
  const daily = Store.getDaily();
  const roomToday = Math.max(0, Store.getSettings().newPerDay - daily.introduced) + extraNew;
  const due = Store.dueCards(Tactics.PREFIX, now);
  const queue = Tactics.buildQueue({
    due,
    known: new Set(cards.map((c) => c.id)),
    rating: state.rating,
    attempts: state.attempts,
    maxNew: Math.min(Tactics.MAX_NEW, roomToday),
  });

  if (!queue.length) return renderTacticsEmpty({ cards, daily, now });

  setBar({ title: 'Tattica', back: '#/', action: { label: '⇅', aria: 'Gira la scacchiera', onClick: () => board.flip() } });

  const results = [];
  let current = null;

  const view = h(`<div class="stack">
    <div class="opening-head" id="head"></div>
    <div class="progress-line" id="progress"></div>
    <div class="board-wrap" id="board-host"></div>
    <div class="prompt" id="prompt"><span class="prompt__dot"></span><span class="prompt__text"></span></div>
    <div class="btn-row">
      <button class="btn" id="reveal">👁 Mostra la mossa</button>
    </div>
    <button class="btn btn--ghost btn--danger" id="quit">Esci dalla sessione</button>
  </div>`);

  const headEl = view.querySelector('#head');
  const progressEl = view.querySelector('#progress');
  const promptEl = view.querySelector('#prompt');
  const promptDot = promptEl.querySelector('.prompt__dot');
  const promptText = promptEl.querySelector('.prompt__text');

  function setPrompt(text, kind = '') {
    promptEl.className = `prompt${kind ? ` prompt--${kind}` : ''}`;
    promptText.innerHTML = text;
  }

  function drawProgress() {
    progressEl.textContent = '';
    queue.forEach((_, i) => {
      const span = document.createElement('span');
      const done = results[i];
      if (done) span.className = done.correct ? 'ok' : 'err';
      else if (current && i === current.index) span.className = 'now';
      progressEl.appendChild(span);
    });
  }

  function loadItem(index) {
    const item = queue[index];
    const start = fromFen(item.puzzle.f);
    const line = playUci(item.puzzle.m.split(' '), start);
    const side = other(start.turn);

    current = {
      ...item,
      index,
      states: line.states,
      moves: line.moves,
      sans: line.sans,
      side,
      ply: 0,
      errors: 0,
      revealed: false,
      start: Date.now(),
    };

    headEl.innerHTML = `<h2>Posizione ${index + 1} di ${queue.length}</h2><p>${
      item.fresh ? 'Nuova' : 'Ripasso'
    } · giochi con il ${COLOR_IT[side]}${item.puzzle.p === 'endgame' ? ' · finale' : ''}</p>`;
    promptDot.className = `prompt__dot prompt__dot--${side}`;

    board.setOrientation(side);
    board.setPosition(current.states[0], null);
    board.setInteractive(false);
    drawProgress();

    // La prima mossa è dell'avversario: è l'errore che apre la combinazione.
    setPrompt('Guarda la mossa dell’avversario…');
    later(() => {
      playMove();
      beep('move');
      current.start = Date.now();
      askMove();
    }, 800);
  }

  function playMove() {
    board.setPosition(current.states[current.ply + 1], current.moves[current.ply]);
    current.ply += 1;
  }

  function askMove() {
    if (current.ply >= current.moves.length) return finish();
    board.setInteractive(true);
    const left = Math.ceil((current.moves.length - current.ply) / 2);
    setPrompt(`Muove il <strong>${COLOR_IT[current.side]}</strong>: trova la mossa migliore.${
      left > 1 ? ` <span class="prompt__aside">(${left} mosse da trovare)</span>` : ''
    }`);
  }

  function opponentReplies() {
    if (current.ply >= current.moves.length) return finish();
    board.setInteractive(false);
    setPrompt(`Il ${COLOR_IT[other(current.side)]} risponde…`);
    later(() => {
      playMove();
      beep('move');
      askMove();
    }, 620);
  }

  function accepts(move) {
    const expected = current.moves[current.ply];
    if (sameMove(move, expected)) return true;
    // Un matto vale un matto: se la variante finiva a matto e anche questa mossa
    // lo dà, rifiutarla sarebbe pedanteria — in partita nessuno lo farebbe.
    const here = current.states[current.ply];
    if (current.ply !== current.moves.length - 1) return false;
    return isMate(applyMove(here, expected)) && isMate(applyMove(here, move));
  }

  function onMove(move) {
    if (!current || current.ply >= current.moves.length) return;

    if (accepts(move)) {
      board.setInteractive(false);
      board.flash(move.to, 'good', 600);
      beep('ok');
      playMove();
      setPrompt('<strong>Esatto.</strong>', 'good');
      later(opponentReplies, 480);
      return;
    }

    current.errors += 1;
    board.flash(move.to, 'wrong', 500);
    beep('err');

    if (current.errors === 1) {
      setPrompt('Non è la mossa. Guarda ancora: che cosa lascia scoperto?', 'bad');
      return;
    }
    reveal();
  }

  function reveal() {
    const expected = current.moves[current.ply];
    current.revealed = true;
    board.setInteractive(false);
    board.flash(expected.from, 'hint', 1800);
    setPrompt(`Era <strong>${esc(san(current.sans[current.ply]))}</strong>.`, 'bad');
    later(() => {
      playMove();
      later(opponentReplies, 520);
    }, 900);
  }

  function finish() {
    board.setInteractive(false);
    const seconds = Math.round((Date.now() - current.start) / 1000);
    const { grade, correct } = Tactics.gradeOf(current.puzzle, {
      errors: current.errors,
      revealed: current.revealed,
      seconds,
    });

    // Memoria: la carta esce con una scadenza vera, calcolata su come è andata.
    const before = current.card || newCard(Tactics.cardIdOf(current.puzzle), { r: current.puzzle.r });
    const card = scheduler.review(before, grade, Date.now());

    /*
     * Forza: si muove solo sulla risposta pulita, e muove anche l'item. Ma solo
     * alla **prima** presentazione: una carta che torna dentro la sessione la si
     * è appena vista risolvere, quindi non è una prova indipendente — contarla
     * di nuovo gonfierebbe (o affosserebbe) il punteggio due volte per lo stesso
     * errore. Lo scheduler invece la registra eccome: quello è un ripasso vero.
     */
    const first = !current.repeat;
    const itemRating = before.r ?? current.puzzle.r;
    const next = first
      ? Rating.update(tacticState(), itemRating, correct)
      : { ...tacticState(), item: itemRating, delta: 0 };
    card.r = next.item;
    Store.saveCard(card);
    if (first) {
      Store.setRating(Tactics.AXIS, { rating: next.rating, attempts: next.attempts });
      Store.addCount(Tactics.AXIS, correct);
    }

    Store.logReview({
      id: card.id,
      t: Date.now(),
      g: grade,
      isNew: !before.reps,
      wasReview: before.state === 'review',
      correct,
      ivl: card.ivl,
      theme: current.puzzle.t,
      ...(first ? { rating: next.rating } : {}),
    });

    results[current.index] = { correct, seconds, first, delta: next.delta, card, puzzle: current.puzzle };

    // Una carta sbagliata non finisce la giornata qui: torna in fondo alla coda.
    if (Tactics.shouldRepeat(card, { repeats: current.repeat || 0, queued: queue.length })) {
      queue.push({ puzzle: current.puzzle, card, fresh: false, repeat: (current.repeat || 0) + 1 });
    }
    beep(correct ? 'win' : 'err');
    drawProgress();

    const days = card.ivl || 0;
    setPrompt(`${correct ? '<strong>Risolta.</strong>' : 'Risolta con aiuto.'} Motivo: <strong>${
      esc(Tactics.themeName(current.puzzle))
    }</strong> · ${first ? `${next.delta >= 0 ? '+' : ''}${next.delta} punti` : 'ripasso, niente punti'} · si rivede ${
      days ? `fra ${days} ${days === 1 ? 'giorno' : 'giorni'}` : 'oggi stesso'
    }.`, correct ? 'good' : '');

    later(() => {
      if (current.index + 1 < queue.length) loadItem(current.index + 1);
      else renderSummary();
    }, 1600);
  }

  function renderSummary() {
    // Solo le prime presentazioni: i rientri della stessa carta sono correzioni,
    // non altre posizioni, e contarli farebbe un totale che non vuol dire niente.
    const done = results.filter((r) => r && r.first);
    const clean = done.filter((r) => r.correct).length;
    const delta = done.reduce((sum, r) => sum + r.delta, 0);
    const state2 = tacticState();
    const counts = Store.getCounts(Tactics.AXIS);
    const stats = Store.cardStats(Tactics.PREFIX);

    const panel = h(`<div class="stack">
      <div class="result">
        <div class="result__title">Sessione finita</div>
        <div class="result__sub">${clean} ${clean === 1 ? 'posizione risolta' : 'posizioni risolte'} su ${done.length} al primo colpo</div>
        <div class="result__grid">
          <div class="stat"><div class="stat__value stat__value--gold">${state2.rating}</div><div class="stat__label">Punteggio</div></div>
          <div class="stat"><div class="stat__value">${delta >= 0 ? '+' : ''}${delta}</div><div class="stat__label">Sessione</div></div>
          <div class="stat"><div class="stat__value">${stats.total}</div><div class="stat__label">Carte</div></div>
        </div>
      </div>
      <div class="note"><div class="note__label">Dove sei</div>
        ${counts.done} risposte in tutto, ${counts.correct} pulite (${
          counts.done ? Math.round((counts.correct / counts.done) * 100) : 0
        }%). Le posizioni arrivano dove ne risolvi circa tre su quattro: se la percentuale sta lì, la difficoltà è tarata.
      </div>
      <div class="stack" id="recap"></div>
      <button class="btn btn--primary" id="more">Un’altra sessione</button>
      <button class="btn btn--ghost" data-go="#/">Torna alla home</button>
    </div>`);

    const recap = panel.querySelector('#recap');
    done.forEach((r) => {
      recap.appendChild(h(`<div class="card recap">
        <span class="recap__mark recap__mark--${r.correct ? 'ok' : 'err'}">${r.correct ? '✓' : '✗'}</span>
        <span class="recap__name">${esc(Tactics.themeName(r.puzzle))}</span>
        <span class="tag">${r.puzzle.r}</span>
        <a class="recap__link" href="https://lichess.org/training/${r.puzzle.id}" target="_blank" rel="noopener">rivedi ↗</a>
      </div>`));
    });

    mount(panel);
    sincronizzaPresto();
    panel.querySelector('#more').onclick = () => renderTacticsSession();
  }

  view.querySelector('#reveal').onclick = () => {
    if (!board.interactive) return;
    current.errors = Math.max(current.errors, 1);
    reveal();
  };
  view.querySelector('#quit').onclick = () => { location.hash = '#/'; };

  session = { onMove: (move) => onMove(move) };
  mount(view);
  view.querySelector('#board-host').appendChild(board.el);
  loadItem(0);
}

/* --------------------- niente in coda: e va detto bene ------------------- */

/**
 * Non è una schermata di errore: è il momento in cui il metodo sta funzionando.
 * Le scadenze non sono ancora arrivate e il tetto giornaliero al materiale nuovo
 * è stato raggiunto. Si può forzare — ma sapendo che le posizioni in più
 * torneranno tutte, e che la coda di domani si sta decidendo adesso.
 */
function renderTacticsEmpty({ cards, daily, now }) {
  setBar({ title: 'Tattica', back: '#/' });

  const prossima = cards
    .map((c) => c.due || 0)
    .filter((d) => d > now)
    .sort((a, b) => a - b)[0];

  const quando = prossima
    ? (() => {
      const ore = (prossima - now) / 3600000;
      if (ore < 1) {
        const minuti = Math.max(1, Math.round(ore * 60));
        return `fra ${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}`;
      }
      if (ore < 24) {
        const tonde = Math.round(ore);
        return `fra ${tonde} ${tonde === 1 ? 'ora' : 'ore'}`;
      }
      const giorni = Math.round(ore / 24);
      return `fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
    })()
    : null;

  const settings = Store.getSettings();

  const view = h(`<div class="stack">
    <div class="hero">
      <h1>Per oggi basta</h1>
      <p>${daily.introduced
        ? `Hai già introdotto <strong>${daily.introduced}</strong> ${daily.introduced === 1 ? 'posizione nuova' : 'posizioni nuove'}, il tetto che ti sei dato.`
        : 'Non ci sono carte in scadenza adesso.'}
      ${quando ? ` La prossima torna <strong>${quando}</strong>.` : ''}</p>
    </div>
    <div class="note">
      <div class="note__label">Perché non ti do altro</div>
      Ogni posizione nuova non finisce oggi: genera i ripassi delle settimane prossime. Il tetto giornaliero è ciò che tiene la coda
      di domani a una misura che si riesce a fare — ed è l'unico modo perché «ripassare» resti dieci minuti e non un'ora.
    </div>
    <button class="btn" id="more">Studia lo stesso 5 posizioni nuove</button>
    <button class="btn btn--ghost" data-go="#/statistiche">Guarda come sta andando ›</button>
    <button class="btn btn--ghost" data-go="#/impostazioni">Cambia il tetto (ora ${settings.newPerDay} al giorno) ›</button>
    <button class="btn btn--ghost" data-go="#/">Torna alla home</button>
  </div>`);

  view.querySelector('#more').onclick = () => renderTacticsSession({ extraNew: 5 });
  mount(view);
}

/* ----------------------------- fondamentali ----------------------------- */

const VUOTA = '8/8/8/8/8/8/8/8 w - - 0 1';

const TITOLI = {
  [Basics.VISTA]: { barra: 'Vista', titolo: 'Vista della scacchiera' },
  [Basics.SICUREZZA]: { barra: 'Sicurezza', titolo: 'Non regalare pezzi' },
};

/** Stato del punteggio di un asse dei fondamentali. */
function basicsState(axis) {
  return Store.getRating(axis) || { rating: Basics.START, attempts: 0 };
}

/**
 * La sessione dei livelli 0 e 1. Stessa impalcatura della tattica — scadenze
 * prima, tipi mescolati, voto dedotto dall'esito — su item che non vengono da
 * un corpus ma dal motore: qui la risposta giusta si calcola, non si consulta.
 */
function renderBasicsSession(axis) {
  const now = Date.now();
  const prefix = Basics.PREFIX[axis];
  const scheduler = makeScheduler();
  const pool = axis === Basics.VISTA ? Basics.vistaPool() : Basics.sicurezzaPool();
  const cards = Store.allCards(prefix);

  const queue = Basics.buildQueue({
    axis,
    due: Store.dueCards(prefix, now),
    known: new Set(cards.map((c) => c.id)),
    pool,
  });

  if (!queue.length) return renderHome();

  setBar({ title: TITOLI[axis].barra, back: '#/' });

  const results = [];
  let current = null;

  const view = h(`<div class="stack">
    <div class="opening-head" id="head"></div>
    <div class="progress-line" id="progress"></div>
    <div class="board-wrap" id="board-host"></div>
    <div class="prompt" id="prompt"><span class="prompt__text"></span></div>
    <div class="stack" id="options"></div>
    <button class="btn btn--ghost btn--danger" id="quit">Esci dalla sessione</button>
  </div>`);

  const headEl = view.querySelector('#head');
  const progressEl = view.querySelector('#progress');
  const promptEl = view.querySelector('#prompt');
  const promptText = promptEl.querySelector('.prompt__text');
  const optionsEl = view.querySelector('#options');
  const boardHost = view.querySelector('#board-host');

  function setPrompt(html, kind = '') {
    promptEl.className = `prompt${kind ? ` prompt--${kind}` : ''}`;
    promptText.innerHTML = html;
  }

  function drawProgress() {
    progressEl.textContent = '';
    queue.forEach((_, i) => {
      const span = document.createElement('span');
      const done = results[i];
      if (done) span.className = done.correct ? 'ok' : 'err';
      else if (current && i === current.index) span.className = 'now';
      progressEl.appendChild(span);
    });
  }

  function loadItem(index) {
    const { item, card } = queue[index];
    current = { item, card, index, start: Date.now(), risposto: false, stato: null };

    headEl.innerHTML = `<h2>Domanda ${index + 1} di ${queue.length}</h2><p>${
      queue[index].fresh ? 'Nuova' : 'Ripasso'
    } · ${TITOLI[axis].titolo}</p>`;

    // La scacchiera serve solo ad alcune domande: le altre si fanno a mente.
    const mostraScacchiera = !!(item.fen || item.empty);
    boardHost.hidden = !mostraScacchiera;
    if (mostraScacchiera) {
      if (!boardHost.contains(board.el)) boardHost.appendChild(board.el);
      let stato = fromFen(item.fen || VUOTA);
      let ultima = null;
      if (item.firstMove) {
        // Come nella tattica: si vede la mossa dell'avversario, poi tocca a te.
        const mossa = legalMoves(stato).find((m) => nameOf(m.from) + nameOf(m.to) === item.firstMove.slice(0, 4));
        if (mossa) { ultima = mossa; stato = applyMove(stato, mossa); }
      }
      board.setOrientation(item.side || 'w');
      board.setInteractive(false);
      board.setPosition(stato, ultima);
      current.stato = stato;
      (item.marks || []).forEach((m) => board.flash(m.square, m.kind || 'hint', 60000));
    }

    setPrompt(`${item.prompt}${item.hint ? ` <span class="prompt__aside">${esc(item.hint)}</span>` : ''}`);
    drawProgress();

    optionsEl.textContent = '';
    if (item.kind === 'opzioni') {
      item.options.forEach((opt, i) => {
        const btn = h(`<button class="btn" data-opt="${i}">${esc(opt.label)}</button>`);
        btn.onclick = () => rispondi(opt.ok, btn);
        optionsEl.appendChild(btn);
      });
    } else {
      board.setSelectMode((square) => rispondi(square === item.answer, null, square));
    }
  }

  function rispondi(giusta, btn, square = null) {
    if (current.risposto) return;
    current.risposto = true;
    board.setSelectMode(null);
    board.clearFlash('hint');

    const secondi = (Date.now() - current.start) / 1000;
    const pace = Basics.paceFor(current.item);
    const grade = !giusta ? AGAIN : secondi <= pace.quick ? EASY : secondi >= pace.slow ? HARD : GOOD;

    if (btn) {
      btn.classList.add(giusta ? 'btn--good' : 'btn--bad');
      // Anche la risposta giusta va mostrata: sapere di aver sbagliato non basta.
      if (!giusta) {
        [...optionsEl.children].forEach((b, i) => {
          if (current.item.options[i].ok) b.classList.add('btn--good');
        });
      }
    }
    let attesa = giusta ? 1200 : 2400;
    if (current.item.kind === 'tocco') {
      if (square !== null) board.flash(square, giusta ? 'good' : 'wrong', 1500);
      if (!giusta) {
        // Se il pezzo scelto era difeso, la ragione si guarda: si gioca la
        // cattura e poi la ripresa, e solo dopo la posizione torna com'era.
        const scena = square === null ? null : Basics.catturaDi(current.stato, square);
        if (scena && scena.tipo === 'difesa') {
          attesa = mostraRipresa(scena);
        } else {
          board.flash(current.item.answer, 'good', 2500);
        }
      }
    }
    beep(giusta ? 'ok' : 'err');

    const before = current.card || newCard(current.item.id, { r: current.item.difficulty });
    const card = scheduler.review(before, grade, Date.now());
    const stato = basicsState(axis);
    const next = Rating.update(stato, before.r ?? current.item.difficulty, giusta);
    card.r = next.item;
    Store.saveCard(card);
    Store.setRating(axis, { rating: next.rating, attempts: next.attempts });
    Store.addCount(axis, giusta);
    Store.logReview({
      id: card.id,
      t: Date.now(),
      g: grade,
      isNew: !before.reps,
      wasReview: before.state === 'review',
      correct: giusta,
      ivl: card.ivl,
      axis,
      ms: Math.round(secondi * 1000),
      theme: Basics.tipoDi(current.item),
      rating: next.rating,
    });

    results[current.index] = { correct: giusta, item: current.item, delta: next.delta };
    drawProgress();
    setPrompt(`${giusta ? '<strong>Giusto.</strong>' : '<strong>No.</strong>'} ${esc(current.item.explain)}`, giusta ? 'good' : 'bad');

    later(() => {
      if (current.index + 1 < queue.length) loadItem(current.index + 1);
      else renderBasicsSummary();
    }, attesa);
  }

  /**
   * La scena della ripresa: prendi, e te lo riprendono. Dura il tempo che serve
   * a vederla — poi la scacchiera torna alla posizione della domanda, con la
   * risposta giusta accesa, perché quello che deve restare in testa è la
   * posizione di partenza, non il disastro.
   */
  function mostraRipresa(scena) {
    const dopoCattura = applyMove(current.stato, scena.mossa);
    const dopoRipresa = applyMove(dopoCattura, scena.risposta);
    const preso = esc(san(toSan(current.stato, scena.mossa)));
    const ripreso = esc(san(toSan(dopoCattura, scena.risposta)));

    board.setPosition(dopoCattura, scena.mossa);
    board.flash(scena.mossa.to, 'good', 700);
    setPrompt(`Prendi: <strong>${preso}</strong>…`, '');

    later(() => {
      board.setPosition(dopoRipresa, scena.risposta);
      board.flash(scena.risposta.to, 'wrong', 900);
      beep('err');
      setPrompt(`…e te lo riprende: <strong>${ripreso}</strong>. `
        + `${esc(Basics.nomeDi(scena.preda))} era ${esc(Basics.participioDi(scena.preda))}${scena.difensore ? ` ${esc(Basics.daDi(scena.difensore))} in ${esc(nameOf(scena.risposta.from))}` : ''}`
        + `${scena.saldo < 0 ? `, e resti sotto di ${Math.abs(scena.saldo)}` : ''}.`, 'bad');
    }, 1100);

    later(() => {
      board.setPosition(current.stato, null);
      board.flash(current.item.answer, 'good', 2200);
      setPrompt(`<strong>Quello libero era in ${esc(nameOf(current.item.answer))}.</strong> ${esc(current.item.explain)}`, 'bad');
    }, 3200);

    return 5600;
  }

  function renderBasicsSummary() {
    const fatte = results.filter(Boolean);
    const giuste = fatte.filter((r) => r.correct).length;
    const stato = basicsState(axis);
    const uscita = Percorso.uscitaDi(axis, Store.getLog());

    const panel = h(`<div class="stack">
      <div class="result">
        <div class="result__title">${giuste === fatte.length ? 'Tutte giuste' : 'Sessione finita'}</div>
        <div class="result__sub">${giuste} ${giuste === 1 ? 'risposta giusta' : 'risposte giuste'} su ${fatte.length}</div>
        <div class="result__grid">
          <div class="stat"><div class="stat__value stat__value--gold">${stato.rating}</div><div class="stat__label">Punteggio</div></div>
          <div class="stat"><div class="stat__value">${uscita.percent}%</div><div class="stat__label">Verso l’uscita</div></div>
          <div class="stat"><div class="stat__value">${Store.cardStats(Basics.PREFIX[axis]).total}</div><div class="stat__label">Carte</div></div>
        </div>
      </div>
      <div class="note"><div class="note__label">Per passare oltre</div>${esc(uscita.label)}</div>
      <div class="stack" id="recap"></div>
      <button class="btn btn--primary" id="more">Un’altra sessione</button>
      <button class="btn btn--ghost" data-go="#/">Torna alla home</button>
    </div>`);

    const recap = panel.querySelector('#recap');
    fatte.filter((r) => !r.correct).forEach((r) => {
      recap.appendChild(h(`<div class="card recap">
        <span class="recap__mark recap__mark--err">✗</span>
        <span class="recap__name">${esc(r.item.explain)}</span>
      </div>`));
    });

    mount(panel);
    sincronizzaPresto();
    panel.querySelector('#more').onclick = () => renderBasicsSession(axis);
  }

  view.querySelector('#quit').onclick = () => { location.hash = '#/'; };

  session = null;
  mount(view);
  loadItem(0);
}

/* -------------------------------- i finali ------------------------------- */

/**
 * Il livello 2. Qui la correzione non è un parere: con tre pezzi la tavola
 * conosce il risultato con gioco perfetto, quindi «questa mossa butta via la
 * vittoria» è un fatto. Una mossa che perde il matto forzato **non viene
 * giocata**: si annulla e si dice perché, che è l'unico momento in cui vale la
 * pena fermare qualcuno.
 */
function renderFinaliSession() {
  const now = Date.now();
  const scheduler = makeScheduler();
  const cards = Store.allCards(Endgames.PREFIX);
  const giro = Store.getCounts(Endgames.AXIS).done || 0;
  const queue = Endgames.buildQueue({ known: new Set(cards.map((c) => c.id)), giro });

  if (!queue.length) return renderHome();

  setBar({ title: 'Finali', back: '#/', action: { label: '⇅', aria: 'Gira la scacchiera', onClick: () => board.flip() } });

  const results = [];
  let current = null;

  const view = h(`<div class="stack">
    <div class="opening-head" id="head"></div>
    <div class="progress-line" id="progress"></div>
    <div class="board-wrap" id="board-host"></div>
    <div class="prompt" id="prompt"><span class="prompt__dot prompt__dot--w"></span><span class="prompt__text"></span></div>
    <div class="btn-row">
      <button class="btn" id="hint">💡 Mostra una mossa che vince</button>
    </div>
    <button class="btn btn--ghost btn--danger" id="quit">Esci dalla sessione</button>
  </div>`);

  const headEl = view.querySelector('#head');
  const progressEl = view.querySelector('#progress');
  const promptEl = view.querySelector('#prompt');
  const promptText = promptEl.querySelector('.prompt__text');

  function setPrompt(html, kind = '') {
    promptEl.className = `prompt${kind ? ` prompt--${kind}` : ''}`;
    promptText.innerHTML = html;
  }

  function drawProgress() {
    progressEl.textContent = '';
    queue.forEach((_, i) => {
      const span = document.createElement('span');
      const done = results[i];
      if (done) span.className = done.correct ? 'ok' : 'err';
      else if (current && i === current.index) span.className = 'now';
      progressEl.appendChild(span);
    });
  }

  function loadItem(index) {
    const item = queue[index];
    current = {
      item,
      index,
      state: fromFen(item.fen),
      card: Store.getCard(item.id),
      mosse: 0,
      buttate: 0,
      lente: 0,
      aiuti: 0,
      start: Date.now(),
    };

    headEl.innerHTML = `<h2>${esc(item.nome)}</h2><p>Finale ${index + 1} di ${queue.length} · `
      + `matto in ${Math.ceil(item.dtm / 2)} mosse con gioco perfetto</p>`;

    board.setOrientation('w');
    board.setPosition(current.state, null);
    drawProgress();
    chiedi();
  }

  function chiedi() {
    const restanti = Endgames.valoreBianco(current.state);
    board.setInteractive(true);
    setPrompt(`Muove il <strong>Bianco</strong>: porta a casa il matto.`
      + ` <span class="prompt__aside">${restanti === Endgames.NON_VINTA ? '' : `matto in ${Math.ceil(restanti / 2)}`}</span>`);
  }

  function onMove(move) {
    if (!current || !board.interactive) return;
    const prima = Endgames.valoreBianco(current.state);
    const dopo = applyMove(current.state, move);
    const valore = Endgames.valoreDopo(dopo);

    // La mossa che perde il matto forzato non si gioca: si annulla e si spiega.
    if (valore === Endgames.NON_VINTA || valore === Endgames.ILLEGALE) {
      current.buttate += 1;
      board.flash(move.to, 'wrong', 900);
      beep('err');
      const perso = Endgames.pezziDi(dopo).pezzo < 0;
      setPrompt(`<strong>No.</strong> ${perso
        ? 'Così il pezzo si perde, e con tre pezzi in meno non c’è più matto.'
        : 'Con questa mossa il matto forzato non c’è più: è patta.'} La posizione torna com’era.`, 'bad');
      board.setPosition(current.state, null);
      return;
    }

    board.setInteractive(false);
    current.mosse += 1;
    // Accettata anche se non è la più rapida: si corregge l'esito, non lo stile.
    const ottimale = valore === prima - 1;
    if (!ottimale) current.lente += 1;
    current.state = dopo;
    board.setPosition(current.state, move);
    beep('move');

    if (Endgames.isMatto(current.state)) return finisci(true);
    if (Endgames.isStallo(current.state)) return finisci(false, 'Stallo: il Nero non ha mosse e non è sotto scacco. È patta.');

    setPrompt(ottimale ? 'Bene.' : 'Vale ancora: vinci lo stesso, ma allunghi.', ottimale ? 'good' : '');

    later(() => {
      const risposta = Endgames.difesa(current.state);
      if (!risposta) return finisci(false, 'Il Nero non ha mosse.');
      current.state = applyMove(current.state, risposta);
      board.setPosition(current.state, risposta);
      beep('move');
      if (Endgames.isMatto(current.state)) return finisci(true);
      if (current.mosse >= Endgames.MOSSE_MAX) {
        return finisci(false, `Sono passate ${Endgames.MOSSE_MAX} mosse: la vittoria c’è ancora, ma la tecnica è quella di arrivarci.`);
      }
      chiedi();
    }, 620);
  }

  function finisci(vinto, motivo = '') {
    board.setInteractive(false);
    const secondi = Math.round((Date.now() - current.start) / 1000);
    const pulito = vinto && current.buttate === 0 && current.aiuti === 0;
    const grade = !vinto || current.buttate >= 2 ? AGAIN
      : current.buttate === 1 || current.aiuti ? HARD
        : current.lente <= 2 ? EASY : GOOD;

    const before = current.card || newCard(current.item.id, { r: current.item.difficulty });
    const card = scheduler.review(before, grade, Date.now());
    const stato = Store.getRating(Endgames.AXIS) || { rating: Endgames.START, attempts: 0 };
    const next = Rating.update(stato, before.r ?? current.item.difficulty, pulito);
    card.r = next.item;
    Store.saveCard(card);
    Store.setRating(Endgames.AXIS, { rating: next.rating, attempts: next.attempts });
    Store.addCount(Endgames.AXIS, pulito);
    Store.logReview({
      id: card.id,
      t: Date.now(),
      g: grade,
      isNew: !before.reps,
      wasReview: before.state === 'review',
      correct: pulito,
      ivl: card.ivl,
      axis: Endgames.AXIS,
      ms: secondi * 1000,
      theme: current.item.tipo === 'Q' ? 'donna' : 'torre',
      rating: next.rating,
    });

    results[current.index] = { correct: pulito, item: current.item, mosse: current.mosse, buttate: current.buttate, lente: current.lente };
    drawProgress();
    beep(vinto ? 'win' : 'err');

    setPrompt(vinto
      ? `<strong>Matto in ${current.mosse} mosse.</strong>`
        + `${current.buttate ? ` Con ${current.buttate} ${current.buttate === 1 ? 'mossa che buttava' : 'mosse che buttavano'} la vittoria.` : ''}`
        + `${current.lente ? ` ${current.lente} ${current.lente === 1 ? 'mossa allungava' : 'mosse allungavano'} il matto.` : ' Nessuna mossa sprecata.'}`
      : `<strong>Finito senza matto.</strong> ${esc(motivo)}`, vinto ? 'good' : 'bad');

    later(() => {
      if (current.index + 1 < queue.length) loadItem(current.index + 1);
      else riepilogo();
    }, 2200);
  }

  function riepilogo() {
    const fatti = results.filter(Boolean);
    const puliti = fatti.filter((r) => r.correct).length;
    const stato = Store.getRating(Endgames.AXIS) || { rating: Endgames.START, attempts: 0 };
    const uscita = Percorso.uscitaDi(Endgames.AXIS, Store.getLog());

    const panel = h(`<div class="stack">
      <div class="result">
        <div class="result__title">${puliti === fatti.length ? 'Tutti portati a casa' : 'Sessione finita'}</div>
        <div class="result__sub">${puliti} ${puliti === 1 ? 'finale vinto' : 'finali vinti'} su ${fatti.length} senza mai perdere l’esito</div>
        <div class="result__grid">
          <div class="stat"><div class="stat__value stat__value--gold">${stato.rating}</div><div class="stat__label">Punteggio</div></div>
          <div class="stat"><div class="stat__value">${uscita.percent}%</div><div class="stat__label">Verso l’uscita</div></div>
          <div class="stat"><div class="stat__value">${Store.cardStats(Endgames.PREFIX).total}</div><div class="stat__label">Carte</div></div>
        </div>
      </div>
      <div class="note"><div class="note__label">Per passare oltre</div>${esc(uscita.label)}</div>
      <div class="note">
        <div class="note__label">Che cosa copre questo livello</div>
        Re e Donna, Re e Torre: le due tecniche che una tavola a tre pezzi risolve per intero. Opposizione, Lucena e Philidor
        hanno quattro o cinque pezzi — una tavola molto più grande — e per ora non ci sono. Meglio dirlo che fingere di allenarle.
      </div>
      <button class="btn btn--primary" id="more">Un’altra sessione</button>
      <button class="btn btn--ghost" data-go="#/">Torna alla home</button>
    </div>`);

    mount(panel);
    sincronizzaPresto();
    panel.querySelector('#more').onclick = () => renderFinaliSession();
  }

  view.querySelector('#hint').onclick = () => {
    if (!board.interactive) return;
    const mosse = legalMoves(current.state);
    let migliore = null;
    let valore = 999;
    for (const m of mosse) {
      const v = Endgames.valoreDopo(applyMove(current.state, m));
      if (v === Endgames.NON_VINTA || v === Endgames.ILLEGALE) continue;
      if (v < valore) { valore = v; migliore = m; }
    }
    if (!migliore) return;
    current.aiuti += 1;
    board.flash(migliore.from, 'hint', 2600);
    board.flash(migliore.to, 'hint', 2600);
    setPrompt(`Una che vince: <strong>${esc(san(toSan(current.state, migliore)))}</strong>.`);
  };

  view.querySelector('#quit').onclick = () => { location.hash = '#/'; };

  session = { onMove: (move) => onMove(move) };
  mount(view);
  view.querySelector('#board-host').appendChild(board.el);
  loadItem(0);
}

/* ------------------------------ statistiche ----------------------------- */

/** Toccare un segno di un grafico ne scrive il valore sotto. */
function wireCharts(root) {
  root.querySelectorAll('.chart-card').forEach((card) => {
    const out = card.querySelector('.chart__readout');
    if (!out) return;
    const show = (e) => {
      const mark = e.target.closest('[data-readout]');
      if (mark) out.textContent = mark.dataset.readout;
    };
    card.addEventListener('pointerdown', show);
    card.addEventListener('pointermove', show);
  });
}

const pct = (x) => `${Math.round(x * 100)}%`;

function renderStats() {
  setBar({ title: 'Statistiche', back: '#/' });

  const log = Store.getLog();
  const cards = Store.allCards(Tactics.PREFIX);
  const settings = Store.getSettings();
  const rating = tacticState();
  const counts = Store.getCounts(Tactics.AXIS);
  const daily = Store.getDaily();
  const streak = Store.getStreak();
  const fsrs = Store.getFsrs();

  const retention = Stats.trueRetention(log);
  const state = Stats.stateCounts(cards);
  const stability = Stats.medianStability(cards);
  const perDay = Stats.reviewsByDay(log, 14);
  const forecast = Stats.forecast(cards, 14);
  const trend = Stats.ratingTrend(log, 30);
  const themes = Stats.byTheme(log);
  const sequences = Optimizer.replay(log);
  const reviewCount = sequences.reduce((sum, s) => sum + s.length, 0);

  const view = h(`<div class="stack">
    <div class="hero">
      <h1>Come sta andando</h1>
      <p>Tutto quello che c'è qui è calcolato sulle tue risposte. Dove i dati non bastano, lo dice invece di inventare una media.</p>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat__value stat__value--gold">${rating.rating}</div><div class="stat__label">Punteggio</div></div>
      <div class="stat"><div class="stat__value">${streak}</div><div class="stat__label">Giorni di fila</div></div>
      <div class="stat"><div class="stat__value">${daily.reviewed}</div><div class="stat__label">Oggi</div></div>
    </div>

    <div class="section-title">La misura che conta</div>
    <div class="note">
      <div class="note__label">Ritenzione vera</div>
      ${retention
        ? `Dei ripassi arrivati a scadenza negli ultimi 30 giorni ne hai indovinati il
           <strong>${pct(retention.rate)}</strong> (su ${retention.n}). Ne avevi chiesti il
           <strong>${pct(settings.retention)}</strong>.
           ${Math.abs(retention.rate - settings.retention) < 0.07
             ? 'Le scadenze cadono dove dovrebbero.'
             : retention.rate < settings.retention
               ? 'Gli intervalli sono lunghi rispetto a quello che chiedi: taralli sui tuoi ripassi, o alza la ritenzione.'
               : 'Stai ripassando prima del necessario: potresti chiedere una ritenzione più bassa e vedere meno carte.'}`
        : 'Ancora nessun ripasso arrivato a scadenza: questa misura compare quando le prime carte tornano, fra qualche giorno.'}
    </div>

    <div class="section-title">Le carte</div>
    <div class="stats">
      <div class="stat"><div class="stat__value">${state.learning}</div><div class="stat__label">In corso</div></div>
      <div class="stat"><div class="stat__value">${state.young}</div><div class="stat__label">Giovani</div></div>
      <div class="stat"><div class="stat__value">${state.mature}</div><div class="stat__label">Mature</div></div>
    </div>
    <p class="hint-text">Matura = intervallo di almeno 21 giorni.${
      stability ? ` Stabilità mediana: <strong>${stability < 1 ? stability.toFixed(1) : Math.round(stability)} giorni</strong> — è l'intervallo al quale la probabilità di ricordare vale 0,9.` : ''
    }</p>

    <div class="section-title">Le risposte, giorno per giorno</div>
    <div class="card chart-card">
      <div class="chart-wrap">${Chart.bars({
        rows: perDay.map((d) => ({
          label: d.label,
          values: [d.ok, d.again],
          readout: `${d.label} ${d.month}: ${d.total} risposte, ${d.again} da rifare`,
        })),
        names: ['tenute', 'da rifare'],
      })}</div>
      <div class="chart__readout muted">${Chart.legend(['tenute', 'da rifare'])}</div>
    </div>

    <div class="section-title">Che cosa scade</div>
    <div class="card chart-card">
      <div class="chart-wrap">${Chart.bars({
        rows: forecast.map((d) => ({ label: d.label, values: [d.total], readout: `${d.label}: ${d.total} carte` })),
        names: ['in scadenza'],
      })}</div>
      <div class="chart__readout muted">Prossimi 14 giorni · ${Stats.estimateMinutes(forecast[0].total)} min oggi, se le fai tutte</div>
    </div>

    ${trend.length > 1 ? `<div class="section-title">Il punteggio</div>
    <div class="card chart-card">
      <div class="chart-wrap">${Chart.line({
        points: trend.map((d, i) => ({ x: i, y: d.rating, readout: `${d.label}: ${d.rating}` })),
        xLabels: trend.map((d) => d.label),
      })}</div>
      <div class="chart__readout muted">Ultimo valore di ogni giornata</div>
    </div>` : ''}

    ${themes.length ? `<div class="section-title">I motivi che scappano</div>
    <div class="stack" id="themes"></div>
    <p class="hint-text">Solo i motivi visti almeno tre volte. In sessione restano comunque mescolati: qui si guardano, non si allenano a blocchi.</p>` : ''}

    <div class="section-title">La taratura</div>
    <div class="note" id="fit">
      <div class="note__label">FSRS sui tuoi ripassi</div>
      ${reviewCount >= Optimizer.MIN_REVIEWS
        ? `Hai ${reviewCount} ripassi utilizzabili${reviewCount < Optimizer.GOOD_REVIEWS ? ' (sopra i 400 i pesi cominciano a dire qualcosa di stabile)' : ''}.
           ${fsrs.fittedAt ? `Ultima taratura: ${new Date(fsrs.fittedAt).toLocaleDateString('it-CH')} su ${fsrs.reviews || '?'} ripassi.` : 'Ora usi i pesi di serie, che vengono dai ripassi di altri.'}`
        : `Servono almeno ${Optimizer.MIN_REVIEWS} ripassi a distanza di giorni per rifare i pesi: ne hai ${reviewCount}. Sotto quella soglia sarebbe rumore, non taratura.`}
    </div>
    ${reviewCount >= Optimizer.MIN_REVIEWS ? `<button class="btn" id="fit-run">⚙︎ Ricalibra sui miei ripassi</button>` : ''}
    ${fsrs.w ? `<button class="btn btn--ghost" id="fit-clear">Torna ai pesi di serie</button>` : ''}
    <div id="fit-out"></div>

    <button class="btn btn--ghost" data-go="#/impostazioni">Impostazioni e backup ›</button>
  </div>`);

  const themeList = view.querySelector('#themes');
  if (themeList) {
    for (const row of themes.slice(0, 8)) {
      themeList.appendChild(h(`<div class="card recap">
        <span class="recap__name">${esc(Tactics.themeName({ t: row.theme }))}</span>
        <span class="tag${row.rate < 0.5 ? ' tag--gold' : ''}">${pct(row.rate)}</span>
        <span class="recap__link">${row.ok}/${row.n}</span>
      </div>`));
    }
  }

  const run = view.querySelector('#fit-run');
  if (run) {
    run.onclick = () => {
      run.disabled = true;
      run.textContent = 'Sto rifacendo i conti…';
      const out = view.querySelector('#fit-out');
      // Un giro di respiro prima di bloccare il thread: il bottone deve cambiare
      // faccia prima che il telefono si metta a macinare.
      later(() => {
        const prima = Optimizer.score(sequences, Store.getWeights() || DEFAULT_W);
        const fitted = Optimizer.optimize(sequences, { start: Store.getWeights() || DEFAULT_W });
        const dopo = Optimizer.score(sequences, fitted.w);
        Store.setWeights(fitted.w, { reviews: reviewCount });
        out.innerHTML = `<div class="card chart-card">
          <div class="note__label">Prima e dopo, sugli stessi ripassi</div>
          <p class="hint-text">Errore medio della previsione: <strong>${prima.logLoss.toFixed(4)}</strong> →
            <strong>${dopo.logLoss.toFixed(4)}</strong>${dopo.rmse != null ? ` · scarto di calibrazione ${pct(dopo.rmse)}` : ''}.
            ${fitted.improvement > 0.001 ? 'I nuovi pesi spiegano meglio i tuoi ripassi e sono stati salvati.' : 'Il guadagno è minimo: i pesi di serie ti descrivevano già bene.'}</p>
          <div class="chart-wrap chart-wrap--square">${Chart.calibration({ bins: Optimizer.calibration(dopo.rows) })}</div>
          <div class="chart__readout muted">Previsto contro accaduto: più i punti stanno sulla diagonale, più le scadenze sono oneste.</div>
        </div>`;
        run.textContent = '✓ Ricalibrato';
        wireCharts(out);
      }, 60);
    };
  }

  const clear = view.querySelector('#fit-clear');
  if (clear) {
    clear.onclick = () => {
      Store.clearWeights();
      renderStats();
    };
  }

  mount(view);
  wireCharts(view);
}

/* ------------------------------ impostazioni ---------------------------- */

function renderSettings(message = '', syncMessage = '') {
  const settings = Store.getSettings();
  const sync = Store.getSync();
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
    <div class="section-title">Studio</div>
    <div class="setting setting--stack">
      <div class="setting__label">Posizioni nuove al giorno
        <div class="setting__hint">Il materiale nuovo costa molto più del ripasso: ogni carta nuova torna, e la coda di domani la fai tu oggi.</div>
      </div>
      <div class="seg" id="newPerDay">
        ${[4, 8, 12, 20].map((n) => `<button class="seg__btn${settings.newPerDay === n ? ' seg__btn--on' : ''}" data-val="${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div class="setting setting--stack">
      <div class="setting__label">Ritenzione richiesta
        <div class="setting__hint">La probabilità di ricordare quando la posizione torna. Più alta = meno dimenticanze e molte più ripetizioni; più bassa = meno lavoro e più buchi.</div>
      </div>
      <div class="seg" id="retention">
        ${[0.85, 0.9, 0.95].map((r) => `<button class="seg__btn${Math.abs(settings.retention - r) < 0.001 ? ' seg__btn--on' : ''}" data-val="${r}">${Math.round(r * 100)}%</button>`).join('')}
      </div>
    </div>
    <p class="hint-text">La ritenzione vera, misurata sui tuoi ripassi, sta in <a href="#/statistiche">Statistiche</a>: è lì che si vede se le scadenze cadono dove dovrebbero.</p>

    <div class="section-title">Dati</div>
    <div class="note">
      Allenamenti completati: <strong>${Store.totalTrainings()}</strong> · stelle totali: <strong>${Store.summarize(OPENINGS).stars}</strong> ·
      carte tattiche: <strong>${Store.cardStats(Tactics.PREFIX).total}</strong> · ripassi registrati: <strong>${Store.getLog().length}</strong>.
    </div>

    <div class="section-title">Sincronizza</div>
    <div class="note">
      <div class="note__label">Come funziona</div>
      I progressi restano su questo dispositivo — l'app funziona offline, e non cambia. In più, se accendi la sincronizzazione,
      una copia va in un deposito e torna indietro su qualunque altro telefono con lo stesso <strong>codice</strong>.
      Niente account, niente email: <strong>il codice è la chiave</strong>, quindi chi ce l'ha vede questi progressi. Tienilo da parte.
    </div>
    ${sync.codice ? `
    <div class="setting setting--stack">
      <div class="setting__label">Il tuo codice
        <div class="setting__hint">Scrivilo su un altro dispositivo per continuare da lì. ${
          sync.ultimoInvio ? `Ultimo salvataggio: ${new Date(sync.ultimoInvio).toLocaleString('it-CH')}.` : 'Non ancora salvato.'
        }${sync.ultimoErrore ? ` <strong>Ultimo tentativo fallito: ${esc(sync.ultimoErrore)}.</strong>` : ''}</div>
      </div>
      <div class="codice" id="codice">${esc(sync.codice.replace(/(.{4})/g, '$1 ').trim())}</div>
    </div>
    <button class="btn" id="sync-ora">⬆︎ Salva adesso nel deposito</button>
    <button class="btn btn--ghost" id="sync-copia">Copia il codice</button>
    <button class="btn btn--ghost" id="sync-altro">Usa un altro codice</button>
    <button class="btn btn--ghost btn--danger" id="sync-stacca">Stacca questo dispositivo</button>
    ` : `
    <button class="btn" id="sync-attiva">☁︎ Attiva la sincronizzazione</button>
    <button class="btn btn--ghost" id="sync-altro">Ho già un codice</button>
    `}
    <div id="sync-out">${syncMessage ? `<div class="note">${syncMessage}</div>` : ''}</div>

    <div class="section-title">Backup</div>
    <div class="note">
      <div class="note__label">Perché serve</div>
      Tutto sta su questo telefono e basta: non c'è nessun account e nessun server. Se cancelli i dati del sito, cambi telefono, o iOS libera spazio
      perché l'app non la apri da qualche settimana, i progressi se ne vanno con loro. Il backup è un file JSON: tienilo da parte ogni tanto.
    </div>
    <button class="btn" id="export">⬇︎ Esporta un backup</button>
    <button class="btn btn--ghost" id="copy">Copia negli appunti</button>
    <button class="btn btn--ghost" id="import">⬆︎ Importa da un file</button>
    <button class="btn btn--ghost" id="paste">Incolla un backup</button>
    <input type="file" id="file" accept="application/json,.json" hidden>
    <div id="backup-out">${message ? `<div class="note">${message}</div>` : ''}</div>

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

  const segment = (id, current, apply) => {
    const box = view.querySelector(`#${id}`);
    if (!box) return;
    box.onclick = (e) => {
      const btn = e.target.closest('.seg__btn');
      if (!btn) return;
      apply(Number(btn.dataset.val));
      box.querySelectorAll('.seg__btn').forEach((b) => b.classList.toggle('seg__btn--on', b === btn));
      beep('move');
    };
  };

  segment('newPerDay', settings.newPerDay, (v) => Store.setSetting('newPerDay', v));
  segment('retention', settings.retention, (v) => Store.setSetting('retention', v));

  /* --------------------------- sincronizzazione --------------------------- */

  const attivaSync = view.querySelector('#sync-attiva');
  if (attivaSync) {
    attivaSync.onclick = async () => {
      const codice = Sync.nuovoCodice();
      attivaSync.disabled = true;
      attivaSync.textContent = 'Salvo…';
      const esito = await Sync.spingi(codice, Store.exportJson());
      if (!esito.ok) {
        Store.setSync({ ultimoErrore: esito.motivo });
        renderSettings('', `Non sono riuscito ad attivare la sincronizzazione: ${esc(esito.motivo)}. I progressi restano qui, come prima.`);
        return;
      }
      Store.setSync({ codice, ultimoInvio: Date.now(), ultimoErrore: null });
      renderSettings('', `Sincronizzazione attiva. <strong>Segnati il codice</strong>: senza, da un altro telefono questi progressi non si ritrovano.`);
    };
  }

  const salvaOra = view.querySelector('#sync-ora');
  if (salvaOra) {
    salvaOra.onclick = async () => {
      salvaOra.disabled = true;
      salvaOra.textContent = 'Salvo…';
      const esito = await Sync.spingi(sync.codice, Store.exportJson());
      Store.setSync(esito.ok ? { ultimoInvio: Date.now(), ultimoErrore: null } : { ultimoErrore: esito.motivo });
      renderSettings('', esito.ok
        ? `Salvato: ${Math.round((esito.byte || 0) / 1024)} kB nel deposito.`
        : `Non salvato: ${esc(esito.motivo)}. Sul dispositivo non è cambiato niente.`);
    };
  }

  const copiaCodice = view.querySelector('#sync-copia');
  if (copiaCodice) {
    copiaCodice.onclick = async () => {
      try {
        await navigator.clipboard.writeText(sync.codice);
        renderSettings('', 'Codice copiato negli appunti.');
      } catch {
        renderSettings('', `Gli appunti non sono disponibili qui. Il codice è <strong>${esc(sync.codice)}</strong>: copialo a mano.`);
      }
    };
  }

  const altroCodice = view.querySelector('#sync-altro');
  if (altroCodice) {
    altroCodice.onclick = async () => {
      const scritto = window.prompt('Scrivi il codice dell’altro dispositivo (16 caratteri):');
      if (!scritto) return;
      const codice = Sync.pulisci(scritto);
      if (!Sync.valido(codice)) {
        renderSettings('', 'Quel codice non ha la forma giusta: sedici caratteri, senza I, L, O e U.');
        return;
      }
      const esito = await Sync.tira(codice);
      if (!esito.ok) {
        renderSettings('', `Non ho trovato niente: ${esc(esito.motivo)}.`);
        return;
      }

      /*
       * Non si sovrascrive: si unisce. Chi ha studiato su due dispositivi non
       * deve perdere una sessione perché ha toccato il bottone nell'ordine
       * sbagliato — le carte si scelgono una per una, la più ripassata vince.
       */
      const prima = Store.cardStats().total;
      const unito = Sync.unisci(Store.statoIntero(), esito.dati);
      Store.applica({ ...unito, sync: { codice, ultimoInvio: Date.now(), ultimoErrore: null } });
      const dopo = Store.cardStats().total;
      beep('win');
      renderSettings('', `Unito: da ${prima} carte a <strong>${dopo}</strong>. Ora questo dispositivo usa il codice ${esc(codice.slice(0, 4))}…`);
    };
  }

  const stacca = view.querySelector('#sync-stacca');
  if (stacca) {
    stacca.onclick = () => {
      if (!window.confirm('Stacco questo dispositivo dal deposito?\n\nI progressi restano qui e nel deposito: smette solo di mandarli.')) return;
      Store.setSync({ codice: null, ultimoInvio: null, ultimoErrore: null });
      renderSettings('', 'Staccato. I progressi restano su questo dispositivo, e nel deposito restano fermi all’ultimo salvataggio.');
    };
  }

  /* --------------------------- backup: fuori e dentro --------------------- */

  const out = view.querySelector('#backup-out');
  const say = (html, kind = '') => { out.innerHTML = `<div class="note${kind ? ` note--${kind}` : ''}">${html}</div>`; };
  const nomeFile = () => `scacchi-backup-${Store.dayKey()}.json`;

  view.querySelector('#export').onclick = () => {
    const blob = new Blob([Store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeFile();
    a.click();
    later(() => URL.revokeObjectURL(a.href), 2000);
    say(`Backup pronto: <strong>${nomeFile()}</strong>. Su iPhone finisce in File ▸ Download: spostalo dove non lo perdi.`);
  };

  view.querySelector('#copy').onclick = async () => {
    const text = Store.exportJson();
    try {
      await navigator.clipboard.writeText(text);
      say(`Copiato negli appunti: ${Math.round(text.length / 1024)} kB. Incollalo in una nota o in un messaggio a te stesso.`);
    } catch {
      // Senza permesso appunti (o senza https) resta il vecchio modo: si seleziona a mano.
      say(`Gli appunti non sono disponibili qui. Usa <strong>Esporta un backup</strong>, oppure copia a mano da qui:
        <textarea class="backup-text" readonly rows="4">${esc(text)}</textarea>`);
    }
  };

  const file = view.querySelector('#file');
  view.querySelector('#import').onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0];
    if (f) applyBackup(await f.text());
    file.value = '';
  };

  view.querySelector('#paste').onclick = () => {
    const text = window.prompt('Incolla qui il contenuto del backup:');
    if (text) applyBackup(text);
  };

  /** Prima si guarda che cosa c'è dentro, poi si chiede, e solo alla fine si sovrascrive. */
  function applyBackup(text) {
    let info;
    try {
      info = Store.inspectBackup(text);
    } catch (err) {
      say(`Non è un backup leggibile: ${esc(err.message)}. Non ho toccato niente.`, 'warn');
      return;
    }
    const quando = info.esportato ? new Date(info.esportato).toLocaleString('it-CH') : 'data sconosciuta';
    const ok = window.confirm(
      `Backup del ${quando}\n\n`
      + `${info.carte} carte tattiche, ${info.aperture} aperture iniziate, ${info.ripassi} ripassi`
      + `${info.punteggio ? `, punteggio ${info.punteggio}` : ''}.\n\n`
      + 'Sostituisce tutto quello che c\'è ora su questo dispositivo. Procedo?',
    );
    if (!ok) return;
    Store.importJson(text);
    beep('win');
    renderSettings(`Importato: <strong>${info.carte} ${info.carte === 1 ? 'carta' : 'carte'}</strong> e ${info.ripassi} ${info.ripassi === 1 ? 'ripasso' : 'ripassi'}. Le scadenze sono quelle del backup.`);
  }

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
  if (screen === 'finali') return renderFinaliSession();
  if (screen === 'vista') return renderBasicsSession(Basics.VISTA);
  if (screen === 'sicurezza') return renderBasicsSession(Basics.SICUREZZA);
  if (screen === 'aperture') return renderOpenings();
  if (screen === 'tattica') return renderTacticsSession();
  if (screen === 'statistiche') return renderStats();
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

/*
 * Registrazione e aggiornamento.
 *
 * `update()` a ogni apertura chiede al server se `sw.js` è cambiato; se sì, il
 * nuovo service worker si installa (riscaricando i file senza cache HTTP) e
 * prende il posto del vecchio. Quando questo succede si ricarica **una volta
 * sola** — la guardia serve perché `controllerchange` scatta anche alla prima
 * installazione, e senza si finirebbe in un giro di ricariche.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      registration.update().catch(() => { /* offline: si riprova alla prossima apertura */ });

      if (navigator.serviceWorker.controller) {
        let ricaricato = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (ricaricato) return;
          ricaricato = true;
          window.location.reload();
        });
      }
    } catch {
      /* offline non disponibile: l'app funziona lo stesso, senza cache */
    }
  });
}
