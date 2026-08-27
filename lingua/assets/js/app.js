/*
 * app.js — schermate e interazione.
 *
 * L'app si tiene in tre stati: quale schermata è aperta, la sessione di studio
 * in corso e il test di livello in corso. Tutto il resto vive in localStorage
 * (store.js) e viene riletto a ogni render, così non ci sono due verità.
 */

import { LANGS, DOMAINS, LEVELS, byCode } from './corpus.js';
import * as Store from './store.js';
import * as Irt from './irt.js';
import * as Stats from './stats.js';
import * as Chart from './chart.js';
import * as Fsrs from './fsrs.js';
import { createScheduler, GRADES, REVIEW, NEW, DEFAULT_W } from './fsrs.js';
import * as Opt from './optimizer.js';
import { buildQueue, splitId, TYPES, nextDue, targetLevel, levelScore } from './scheduler.js';
import * as Units from './units.js';
import { diff } from './check.js';
import * as Ex from './exercises.js';
import * as Speech from './speech.js';
import * as Voices from './voices.js';
import * as Tts from './tts.js';
import * as Sfx from './sfx.js';
import * as Goal from './goal.js';

/* ------------------------------- utilità ------------------------------- */

const view = document.getElementById('view');
const bar = document.getElementById('bar');
const barTitle = document.getElementById('bar-title');
const barBack = document.getElementById('bar-back');
const barAction = document.getElementById('bar-action');
const tabs = document.getElementById('tabs');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const h = (html) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
};

const on = (root, sel, event, fn) => {
  root.querySelectorAll(sel).forEach((el) => el.addEventListener(event, fn));
};

/** Un timer che non sopravvive al cambio di schermata. */
let timers = [];
const later = (fn, ms) => { timers.push(window.setTimeout(fn, ms)); };
const clearTimers = () => { timers.forEach(window.clearTimeout); timers = []; };

const reduceMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function humanDays(days) {
  if (days < 1) return 'oggi';
  if (days < 30) return `${Math.round(days)} g`;
  if (days < 365) return `${(days / 30).toFixed(days < 60 ? 1 : 0)} mesi`;
  return `${(days / 365).toFixed(1)} anni`;
}

function humanDelay(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} g`;
}

function labelInterval(step) {
  if (step.days !== undefined) return humanDays(step.days);
  return `${Math.max(1, step.minutes)} min`;
}

/* ------------------------------ stato vivo ----------------------------- */

let screen = 'home';
let session = null;
let exam = null;
let lang = null;

const settings = () => Store.getSettings();
const scheduler = () => {
  const cfg = settings();
  return createScheduler({ requestRetention: cfg.retention, w: cfg.w || undefined });
};

/* --------------------------------- audio -------------------------------- */

let voices = [];
const loadVoices = () => {
  const before = voices.length;
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  // su alcuni browser l'elenco arriva dopo: quando cambia, la schermata si rifà
  if (!before && voices.length && screen === 'settings') render();
};
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

/*
 * La velocità non è la stessa per tutte le lingue: il russo letto a ritmo
 * pieno, con le sue vocali ridotte, è illeggibile per chi comincia. Ogni
 * lingua ha il suo moltiplicatore, sopra quello scelto nelle impostazioni.
 */
function utterance(text, { slow = false } = {}) {
  const cfg = settings();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang.locale;
  u.rate = Math.min(1.6, Math.max(0.3, cfg.ttsRate * (lang.rate ?? 1) * (slow ? 0.7 : 1)));
  u.pitch = cfg.ttsPitch ?? 1;
  const voice = Voices.pick(voices, lang.locale, cfg.voices?.[lang.code]);
  if (voice) u.voice = voice;
  return u;
}

/** La voce del dispositivo, con la promessa di dire quando ha finito. */
function speakLocal(text, { slow = false } = {}) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const u = utterance(text, { slow });
      u.onend = finish;
      u.onerror = finish;
      // rete di sicurezza: su iOS onend a volte non arriva
      window.setTimeout(finish, 1500 + text.length * 90);
      window.speechSynthesis.speak(u);
    } catch {
      finish();
    }
  });
}

/*
 * Stato della voce online per la sessione in corso: al primo fallimento si
 * smette di provarci, così un endpoint lento non trasforma ogni ascolto in
 * un'attesa. Si riparte alla prossima apertura dell'app.
 */
let onlineVoice = 'unknown';   // 'ok' | 'failed'

const wantsOnline = () =>
  Tts.supported
  && Boolean(settings().online?.[lang.code])
  && navigator.onLine !== false
  && onlineVoice !== 'failed';

/** Dice una cosa e promette di dire quando ha finito, online o in locale. */
async function say(text, { slow = false } = {}) {
  if (wantsOnline()) {
    try {
      await Tts.play(Tts.url(text, lang.locale, { slow }));
      onlineVoice = 'ok';
      return;
    } catch {
      onlineVoice = 'failed';
      if (screen === 'settings') render();
    }
  }
  await speakLocal(text, { slow });
}

function speak(text, { force = false, slow = false } = {}) {
  if (!lang) return Promise.resolve();
  if (!force && !settings().tts) return Promise.resolve();
  stopSpeaking();
  const promise = say(text, { slow });
  if (session) session.saying = promise;   // l'avanzamento automatico la aspetta
  return promise;
}

let guided = null;

function stopSpeaking() {
  if (guided) {
    window.clearTimeout(guided.timer);
    guided.tokens.forEach((el) => el.classList.remove('tok--on'));
    guided = null;
  }
  Tts.stop();
  try { window.speechSynthesis.cancel(); } catch { /* niente da fermare */ }
}

/*
 * Ascolto guidato: ogni parola letta a sé, con una pausa vera in mezzo e la
 * parola illuminata mentre viene pronunciata.
 *
 * Non serve a fare bella figura con la sintesi — serve perché su una lingua
 * nuova il problema non è la naturalezza, è la segmentazione: dentro una frase
 * letta di fila non si sente dove finisce una parola e comincia l'altra. Il
 * doppio canale (si sente e si vede allo stesso tempo) lega il suono alla
 * forma scritta, che in cirillico è metà del lavoro.
 */
function speakGuided(root, text) {
  const tokens = [...root.querySelectorAll('[data-tok]')];
  if (!tokens.length) return speak(text, { force: true, slow: true });

  stopSpeaking();
  const words = tokens.map((el) => el.textContent);
  const state = { tokens, timer: null };
  guided = state;

  (async () => {
    for (let i = 0; i < words.length; i++) {
      if (guided !== state) return;
      tokens.forEach((el) => el.classList.remove('tok--on'));
      tokens[i].classList.add('tok--on');
      await say(words[i], { slow: true });
      if (guided !== state) return;
      await new Promise((r) => { state.timer = window.setTimeout(r, 280); });
    }
    if (guided === state) {
      tokens.forEach((el) => el.classList.remove('tok--on'));
      guided = null;
    }
  })();
}

/** La frase come parole toccabili: un tocco legge solo quella. */
const sentenceTokens = (text) => text
  .split(/\s+/)
  .filter(Boolean)
  .map((w, i) => `<span class="tok" data-tok="${i}">${esc(w)}</span>`)
  .join(' ');

/* ------------------------------ navigazione ----------------------------- */

const TABS = [
  { id: 'home', label: 'Studia', icon: '◎' },
  { id: 'explore', label: 'Esplora', icon: '⌗' },
  { id: 'stats', label: 'Progressi', icon: '▤' },
  { id: 'settings', label: 'Impostazioni', icon: '⚙' },
];

function go(next) {
  clearTimers();
  screen = next;
  render();
  window.scrollTo(0, 0);
}

function renderTabs() {
  const hidden = ['welcome', 'pickLang', 'test', 'testResult', 'study', 'done', 'pickDomains'].includes(screen);
  tabs.hidden = hidden;
  document.body.classList.toggle('no-tabs', hidden);
  if (hidden) return;
  tabs.innerHTML = TABS.map((t) => `
    <button class="tab${t.id === screen ? ' tab--on' : ''}" data-go="${t.id}">
      <span class="tab__icon">${t.icon}</span><span class="tab__label">${t.label}</span>
    </button>`).join('');
  on(tabs, '[data-go]', 'click', (e) => go(e.currentTarget.dataset.go));
}

function setBar(title, { back = null, action = null } = {}) {
  barTitle.textContent = title;
  barBack.hidden = !back;
  if (back) barBack.onclick = back;
  barAction.hidden = !action;
  if (action) {
    barAction.textContent = action.label;
    barAction.onclick = action.fn;
  }
  bar.hidden = screen === 'welcome';
}

/* -------------------------------- render -------------------------------- */

function render() {
  const state = Store.getState();
  lang = state.lang ? byCode(state.lang) : null;
  if (!lang && !['welcome', 'pickLang'].includes(screen)) screen = 'welcome';

  const painters = {
    welcome: paintWelcome,
    pickLang: paintPickLang,
    pickDomains: paintPickDomains,
    test: paintTest,
    testResult: paintTestResult,
    home: paintHome,
    study: paintStudy,
    done: paintDone,
    path: paintPath,
    explore: paintExplore,
    stats: paintStats,
    settings: paintSettings,
    science: paintScience,
  };
  view.innerHTML = '';
  (painters[screen] || paintHome)();
  renderTabs();
}

/* ------------------------------- benvenuto ------------------------------ */

function paintWelcome() {
  setBar('');
  const el = h(`
    <section class="pad stack">
      <div class="hero">
        <div class="hero__mark">“ ”</div>
        <h2 class="hero__title">Impara per frasi,<br>non per parole</h2>
        <p class="hero__sub">Frasi corte, una difficoltà alla volta, ripassate nel momento in cui stai per dimenticarle.</p>
      </div>
      <ul class="points">
        <li><b>Un test adattivo</b> stima il tuo livello in poche domande, come un esame computerizzato vero.</li>
        <li><b>Quattro esercizi per frase</b>: riconoscerla, comporla, completarla, produrla. Uno alla volta, quando il precedente regge.</li>
        <li><b>Nel verso che ti serve</b>: se vuoi parlare, parti dall’italiano e tiri fuori tu la frase, fin dal primo giorno.</li>
        <li><b>Niente autovalutazione</b>: ogni risposta viene corretta dalla macchina, e il voto scende da lì.</li>
        <li><b>Un algoritmo di ripetizione</b> (FSRS, lo stesso principio di Anki) decide quando rivedere ogni frase.</li>
        <li><b>Il tuo settore</b>: lavoro, viaggi, tecnologia, salute, ricerca.</li>
      </ul>
      <button class="btn btn--primary" data-act="start">Comincia</button>
      <button class="btn btn--ghost" data-act="why">Perché funziona</button>
    </section>`);
  on(el, '[data-act="start"]', 'click', () => go('pickLang'));
  on(el, '[data-act="why"]', 'click', () => go('science'));
  view.append(el);
}

function paintPickLang() {
  setBar('Che lingua studi?', { back: () => go('welcome') });
  const el = h(`
    <section class="pad stack">
      <p class="lead">Il corpus è scritto per chi parla italiano: le note spiegano proprio i punti dove l’italiano ci fa sbagliare.</p>
      <div class="stack">
        ${LANGS.map((l) => `
          <button class="card card--tap" data-lang="${l.code}">
            <span class="card__flag">${l.flag}</span>
            <span class="card__body">
              <span class="card__title">${esc(l.name)}${l.variant ? ` <em class="card__var">${esc(l.variant)}</em>` : ''}</span>
              <span class="card__sub">${l.sentences.length} frasi · ${l.grammar.length} punti di grammatica</span>
              ${l.blurb ? `<span class="card__sub">${esc(l.blurb)}</span>` : ''}
            </span>
            <span class="card__go">›</span>
          </button>`).join('')}
      </div>
    </section>`);
  on(el, '[data-lang]', 'click', (e) => {
    const code = e.currentTarget.dataset.lang;
    Store.setLang(code);
    lang = byCode(code);
    const deck = Store.getDeck(code);
    go(deck.profile.at ? 'home' : 'test');
  });
  view.append(el);
}

function paintPickDomains() {
  const chosen = new Set(settings().domains);
  setBar('Il tuo settore', { action: { label: 'Fine', fn: () => go('home') } });
  const el = h(`
    <section class="pad stack">
      <p class="lead">Le frasi nuove verranno pescate soprattutto da qui. Puoi sceglierne più di uno, o nessuno per restare sul generale.</p>
      <div class="grid">
        ${DOMAINS.map((d) => `
          <button class="chip-card${chosen.has(d.id) ? ' chip-card--on' : ''}" data-dom="${d.id}">
            <span class="chip-card__icon">${d.icon}</span>
            <span>${esc(d.label)}</span>
          </button>`).join('')}
      </div>
      <button class="btn btn--primary" data-act="done">Continua</button>
    </section>`);
  on(el, '[data-dom]', 'click', (e) => {
    const id = e.currentTarget.dataset.dom;
    const next = new Set(settings().domains);
    next.has(id) ? next.delete(id) : next.add(id);
    Store.setSetting('domains', [...next]);
    e.currentTarget.classList.toggle('chip-card--on');
  });
  on(el, '[data-act="done"]', 'click', () => go('home'));
  view.append(el);
}

/* ----------------------------- test di livello --------------------------- */

function startExam() {
  exam = { responses: [], asked: [], est: { theta: 0, se: 1 }, item: null, locked: false };
  nextExamItem();
  go('test');
}

function nextExamItem() {
  exam.item = Irt.pickNext(lang.placement, exam.asked, exam.est.theta);
}

function paintTest() {
  if (!exam) return startExam();
  setBar('Test di livello', { back: () => { exam = null; go('home'); } });
  const it = exam.item;
  if (!it) return finishExam();

  const n = exam.responses.length + 1;
  const confidence = Math.max(0, Math.min(1, (1 - exam.est.se) / 0.7));
  const el = h(`
    <section class="pad stack">
      <div class="exam-head">
        <span class="pill">Domanda ${n}</span>
        <span class="muted small">precisione della stima</span>
        <div class="meter"><i style="width:${Math.round(confidence * 100)}%"></i></div>
      </div>
      <div class="prompt">${esc(it.prompt).replace('___', '<span class="blank">____</span>')}</div>
      <div class="stack">
        ${it.options.map((o, i) => `<button class="btn btn--option" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>
      <button class="btn btn--ghost small" data-act="skip">Salta il test, parto da capo</button>
    </section>`);

  on(el, '[data-i]', 'click', (e) => {
    if (exam.locked) return;
    exam.locked = true;
    const i = Number(e.currentTarget.dataset.i);
    const correct = i === it.correct;
    el.querySelectorAll('[data-i]').forEach((b) => {
      const bi = Number(b.dataset.i);
      if (bi === it.correct) b.classList.add('btn--right');
      else if (bi === i) b.classList.add('btn--wrong');
    });
    exam.asked.push(it.id);
    exam.responses.push({ a: it.a, b: it.b, correct, id: it.id, lv: it.lv });
    exam.est = Irt.estimate(exam.responses);
    setTimeout(() => {
      exam.locked = false;
      if (Irt.shouldStop(exam.responses, exam.est.se)) finishExam();
      else { nextExamItem(); render(); }
    }, 520);
  });
  on(el, '[data-act="skip"]', 'click', () => {
    Store.saveProfile(lang.code, { theta: -1.75, se: 1, cefr: 'A1', skipped: true });
    exam = null;
    go('pickDomains');
  });
  view.append(el);
}

function finishExam() {
  const s = Irt.summary(exam.responses);
  Store.saveProfile(lang.code, { theta: s.theta, se: s.se, cefr: s.cefr, skipped: false });
  exam = { ...exam, result: s };
  go('testResult');
}

function paintTestResult() {
  const r = exam?.result;
  if (!r) return go('home');
  const band = Irt.CEFR.find((c) => c.id === r.cefr);
  setBar('Il tuo livello');
  const el = h(`
    <section class="pad stack">
      <div class="result">
        <div class="result__level">${r.cefr}</div>
        <div class="result__name">${esc(band.name)}</div>
        <p class="result__blurb">${esc(band.blurb)}</p>
      </div>
      <div class="scale">
        ${Irt.CEFR.map((c) => `<span class="scale__step${c.id === r.cefr ? ' scale__step--on' : ''}">${c.id}</span>`).join('')}
      </div>
      <div class="card card--flat">
        <p class="small muted">
          Stima θ = ${r.theta.toFixed(2)} con errore standard ${r.se.toFixed(2)}
          su ${plural(r.total, 'domanda', 'domande')} (${r.correct} corrette).
          L’intervallo di confidenza al 95% copre ${r.ci[0] === r.ci[1] ? r.ci[0] : `${r.ci[0]}–${r.ci[1]}`}:
          più studi, più il livello si aggiusta da solo.
        </p>
      </div>
      <button class="btn btn--primary" data-act="next">Scegli il settore</button>
      <button class="btn btn--ghost" data-act="again">Rifai il test</button>
    </section>`);
  on(el, '[data-act="next"]', 'click', () => { exam = null; go('pickDomains'); });
  on(el, '[data-act="again"]', 'click', () => startExam());
  view.append(el);
}

/* --------------------------------- home --------------------------------- */

function paintHome() {
  const deck = Store.getDeck(lang.code);
  const cfg = settings();
  const day = Store.today(lang.code);
  const { counts } = buildQueue({ lang, deck, settings: cfg, introducedToday: day.introduced });
  const streak = Store.streak(lang.code);
  const goal = Goal.goalOf(cfg.dailyGoal);
  const cov = Stats.levelCoverage(deck, lang);
  const seen = cov.reduce((a, c) => a + c.done, 0);
  const upcoming = nextDue(deck);

  setBar(`${lang.flag} ${lang.name}`, { action: { label: 'Cambia', fn: () => go('pickLang') } });

  const el = h(`
    <section class="pad stack">
      <div class="today">
        ${Chart.ring({
          value: day.xp,
          total: goal.xp,
          big: String(day.xp),
          small: day.xp >= goal.xp ? `obiettivo ${goal.xp} ✓` : `su ${goal.xp}`,
          done: day.xp >= goal.xp,
          extra: day.xp > goal.xp ? (day.xp - goal.xp) / goal.xp : 0,
        })}
        <div class="today__side">
          <p class="today__title">${day.xp >= goal.xp ? 'Obiettivo raggiunto' : 'Obiettivo di oggi'}</p>
          <p class="small muted">${day.xp > goal.xp
            ? `${day.xp - goal.xp} punti oltre l’obiettivo · puoi fermarti quando vuoi`
            : day.xp === goal.xp
              ? `${esc(goal.label.toLowerCase())} · puoi fermarti qui o andare avanti`
              : `${plural(Goal.cardsLeft(day.xp, goal.xp), 'carta', 'carte')} e ci sei`}</p>
          <div class="today__chips">
            <span class="pill">🔥 ${plural(streak, 'giorno', 'giorni')}</span>
            <span class="pill">${deck.profile.cefr || '—'}</span>
            <span class="pill">${seen} frasi</span>
          </div>
        </div>
      </div>

      <div class="card card--flat queue">
        <div class="queue__row"><span class="dot dot--new"></span> ${plural(counts.fresh, 'frase nuova', 'frasi nuove')}</div>
        <div class="queue__row"><span class="dot dot--learn"></span> ${plural(counts.learning, 'carta in apprendimento', 'carte in apprendimento')}</div>
        <div class="queue__row"><span class="dot dot--due"></span> ${plural(counts.shownDue, 'ripasso in scadenza', 'ripassi in scadenza')}${counts.due > counts.shownDue ? ` <span class="muted small">(di ${counts.due}, il resto domani)</span>` : ''}</div>
      </div>

      ${counts.total
        ? `<button class="btn btn--primary btn--big" data-act="study">
             Studia ${plural(counts.total, 'carta', 'carte')}<span class="btn__sub">circa ${plural(Stats.estimateMinutes(counts.total), 'minuto', 'minuti')}</span>
           </button>`
        : `<div class="card card--flat empty">
             <p><b>Per oggi è tutto.</b></p>
             <p class="small muted">${upcoming ? `Il prossimo ripasso è fra ${humanDelay(upcoming - Date.now())}.` : 'Aggiungi frasi da Esplora quando vuoi.'}</p>
             <button class="btn btn--ghost small" data-act="extra">Studia lo stesso 5 frasi nuove</button>
           </div>`}

      ${pathCard(deck)}

      <div class="card card--flat">
        <div class="card__head"><b>Copertura del corpus</b><span class="muted small">${seen}/${lang.sentences.length}</span></div>
        <div class="levels">
          ${cov.map((c) => `
            <div class="levels__row">
              <span class="levels__lv">${c.lv}</span>
              <span class="levels__bar"><i style="width:${c.percent}%"></i></span>
              <span class="levels__n muted small">${c.done}/${c.total}</span>
            </div>`).join('')}
        </div>
      </div>

      ${lang.caveat ? `<p class="small muted caveat">${esc(lang.caveat)}</p>` : ''}

      <button class="btn btn--ghost small" data-act="why">Perché funziona</button>
    </section>`);

  on(el, '[data-act="study"]', 'click', () => startSession());
  on(el, '[data-act="extra"]', 'click', () => startSession({ extraNew: 5 }));
  on(el, '[data-act="why"]', 'click', () => go('science'));
  on(el, '[data-act="path"]', 'click', () => go('path'));
  view.append(el);
}

/* -------------------------------- percorso ------------------------------- */

/** Lo stato del percorso per il mazzo corrente. */
const currentPath = (deck) => Units.pathState(lang, deck, levelScore(deck.profile?.theta), settings().domains);

/** Il riquadro in home: dove si è, quanto manca, e le unità che seguono. */
function pathCard(deck) {
  const path = currentPath(deck);
  const u = path.unit;
  if (!u) return '';
  const ahead = path.units.slice(path.active + 1, path.active + 6);
  return `
    <button class="card card--flat unit-card" data-act="path">
      <div class="card__head"><b>Percorso</b><span class="muted small">unità ${u.index - path.start + 1} di ${path.units.length - path.start} ›</span></div>
      <div class="unit-card__row">
        <span class="unit-bubble unit-bubble--on">${u.icon}</span>
        <span class="unit-card__main">
          <span class="unit-card__title">${esc(u.title)}</span>
          <span class="muted small">${u.level} · ${u.learned}/${u.total} frasi imparate</span>
        </span>
      </div>
      <span class="levels__bar"><i style="width:${u.percent}%"></i></span>
      ${ahead.length ? `<span class="unit-card__ahead">${ahead.map((n) => `<i class="unit-dot${n.open ? ' unit-dot--open' : ''}" title="${esc(n.title)}"></i>`).join('')}<span class="muted small">poi ${esc(ahead[0].title.toLowerCase())}</span></span>` : ''}
    </button>`;
}

/**
 * Il percorso per esteso. Le unità sotto il livello misurato dal test restano
 * raggiungibili ma segnate come facoltative: il test ha già detto che quel
 * livello c'è, ripassarlo è una scelta, non un pedaggio.
 */
function paintPath() {
  const deck = Store.getDeck(lang.code);
  const path = currentPath(deck);
  setBar('Il percorso', { back: () => go('home') });

  let level = '';
  const rows = path.units.map((u) => {
    const head = u.level !== level ? `<p class="unit-level">${u.level}</p>` : '';
    level = u.level;
    const state = u.done ? 'done' : u.index === path.active ? 'on' : u.open ? 'open' : 'locked';
    const badge = { done: '✓', on: '●', open: '', locked: '' }[state];
    return `${head}
      <button class="unit-row unit-row--${state}${u.behind ? ' unit-row--behind' : ''}"
              ${state === 'locked' ? 'disabled' : `data-unit="${u.id}"`}>
        <span class="unit-bubble unit-bubble--${state}">${state === 'locked' ? '🔒' : u.icon}</span>
        <span class="unit-row__main">
          <span class="unit-row__title">${esc(u.title)}${u.behind ? ' <span class="muted small">facoltativa</span>' : ''}</span>
          <span class="levels__bar"><i style="width:${u.percent}%"></i></span>
          <span class="muted small">${u.learned}/${u.total} imparate${u.seen > u.learned ? ` · ${u.seen - u.learned} in corso` : ''}</span>
        </span>
        <span class="unit-row__badge">${badge}</span>
      </button>`;
  }).join('');

  const el = h(`
    <section class="pad stack">
      <p class="small muted">Le frasi nuove escono dall’unità in corso. I ripassi no:
        quelli restano governati dalle scadenze, qualunque unità li abbia introdotti.
        ${path.start > 0 ? `Il test iniziale ti ha messo a ${esc(deck.profile.cefr || lang.sentences[0].lv)}, quindi il cammino parte da lì.` : ''}</p>
      <div class="card card--flat path">${rows}</div>
      <p class="small muted">Un’unità apre la successiva quando ne hai imparato almeno
        il ${Math.round(Units.UNLOCK * 100)}% — o quando le hai viste tutte.
        Tocca un’unità aperta per farne una sessione mirata.</p>
    </section>`);
  on(el, '[data-unit]', 'click', (e) => startSession({ unit: e.currentTarget.dataset.unit }));
  view.append(el);
}

/* ------------------------------- sessione -------------------------------- */

/**
 * `unit` limita le frasi nuove a una sola unità: serve quando si sceglie
 * un'unità a mano dal percorso. I ripassi in scadenza entrano lo stesso —
 * saltarli per fare un'unità a piacere sarebbe barare con le scadenze.
 */
function startSession({ extraNew = 0, unit = null } = {}) {
  const deck = Store.getDeck(lang.code);
  const cfg = settings();
  const day = Store.today(lang.code);
  /* Un'unità scelta a mano quando il tetto del giorno è già speso vale come il
   * "studia lo stesso": cinque frasi in più, dichiarate, non il tetto tolto. */
  const spare = unit && cfg.newPerDay - day.introduced <= 0 ? 5 : 0;
  const { queue } = buildQueue({
    lang,
    deck,
    settings: { ...cfg, newPerDay: cfg.newPerDay + extraNew + spare, unit },
    introducedToday: day.introduced,
  });
  if (!queue.length) return;
  session = {
    queue,
    index: 0,
    done: 0,
    again: 0,
    earned: 0,
    startXp: Store.today(lang.code).xp,
    hits: new Map(),          // richiami corretti di ogni carta dentro questa sessione
    startedAt: Date.now(),
    sentences: new Map(lang.sentences.map((s) => [s.id, s])),
  };
  openMatch();
  prepare();
  go('study');
}

/** Quante coppie fa un abbinamento, e da quante carte in giù ha senso farlo. */
const MATCH_SIZE = 6;
const MATCH_MIN = 4;

/**
 * Apre la sessione con un abbinamento, se ci sono abbastanza riconoscimenti in
 * coda: si tocca l'italiano, si tocca la frase, e le coppie si chiudono.
 *
 * Non è un tipo di carta nuovo — è un altro modo di far sostenere lo stesso
 * riconoscimento a sei carte insieme. Il vantaggio non è la velocità: è che i
 * cinque distrattori sono frasi vere, presenti sullo schermo nello stesso
 * momento, quindi il richiamo avviene sotto interferenza invece che contro tre
 * opzioni scelte a caso. Il voto di ogni carta esce da come è andata la sua
 * coppia: al primo colpo, dopo un errore, dopo due.
 */
function openMatch() {
  if (!settings().match) return;
  const picks = [];
  for (let i = 0; i < session.queue.length && picks.length < MATCH_SIZE; i++) {
    const card = session.queue[i];
    if (splitId(card.id).type !== 'comp') continue;
    const sentence = session.sentences.get(splitId(card.id).sid);
    if (!sentence) continue;
    picks.push({ card, sentence, index: i });
  }
  if (picks.length < MATCH_MIN) return;

  // le carte abbinate escono dalla coda: vengono chiuse qui
  const taken = new Set(picks.map((p) => p.index));
  session.queue = session.queue.filter((_, i) => !taken.has(i));

  const rnd = Ex.seeded(`${session.startedAt}|match`);
  const order = (n) => Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5);
  session.match = {
    pairs: picks,
    left: order(picks.length),
    right: order(picks.length),
    selected: null,
    solved: new Set(),
    errors: new Map(),
    wrong: null,
  };
}

const currentCard = () => session.queue[session.index];

/** Prepara l'esercizio della carta corrente e azzera la risposta. */
function prepare() {
  const card = currentCard();
  if (!card) return;
  const { sid, type } = splitId(card.id);
  const sentence = session.sentences.get(sid);
  if (!sentence) return;
  const seed = `${card.id}|${card.reps}`;

  session.type = type;
  session.sentence = sentence;
  session.phase = 'ask';
  session.result = null;
  session.grade = null;
  session.chosen = null;
  session.showGrades = !settings().autoGrade;
  session.auto = false;
  session.saying = null;
  session.spoke = { ask: false, done: false };
  session.heard = null;
  session.micError = null;
  session.listening = false;
  session.shownAt = Date.now(); // serve a misurare quanto costa davvero un ripasso

  if (type === 'comp') session.ex = Ex.buildChoice(sentence, lang, seed, settings().direction);
  else if (type === 'build') {
    session.ex = Ex.buildTiles(sentence, lang, seed);
    session.picked = [];
  } else if (type === 'cloze') {
    session.ex = Ex.buildCloze(sentence, card, seed);
    session.filled = session.ex.parts.filter((x) => x.blank).map(() => '');
  } else {
    /*
     * Ascolta e scrivi: ogni tanto la produzione arriva senza il testo
     * italiano, solo con l'audio. È il gradino che manca fra il capire e il
     * produrre — decodificare il parlato e riscriverlo mette insieme le due
     * cose — e su una lingua con un altro alfabeto è l'unico esercizio che
     * lega davvero il suono alla forma scritta.
     *
     * Capita a una carta su tre, deciso dal seme della carta, e solo se c'è
     * una voce: senza audio la carta resta una produzione normale.
     */
    const voiceReady = settings().tts && (Tts.supported || (window.speechSynthesis && voices.length));
    session.ex = null;
    session.answer = '';
    session.dictation = voiceReady && Ex.seeded(`${seed}|dictation`)() < 0.34;
  }
}

/* ------------------------------ correzione ------------------------------- */

/** Metro di confronto della lingua: per il russo dipende da come si è risposto. */
const folded = (answer) => (lang.fold ? lang.fold(answer) : undefined);

/** Confronto di un cloze: ogni buco separato, più un esito complessivo. */
function checkCloze(parts, filled) {
  const blanks = parts.filter((p) => p.blank);
  const rows = blanks.map((p, i) => {
    const given = filled[i] || '';
    return { ...diff(p.answer, given, folded(given)), answer: p.answer, given };
  });
  return {
    rows,
    correct: rows.every((r) => r.correct),
    score: rows.reduce((a, r) => a + r.score, 0) / (rows.length || 1),
    extra: rows.reduce((a, r) => a + r.extra, 0),
    near: rows.flatMap((r) => r.near),
    marks: [],
  };
}

function settle(result) {
  const cfg = settings();
  session.result = result;
  session.grade = Ex.autoGrade(result);
  session.phase = 'done';
  Sfx.play(result.correct ? 'ok' : 'wrong', { enabled: cfg.sounds && !reduceMotion() });

  /*
   * Se hai indovinato non c'è niente da leggere: la correzione conferma e
   * basta, e chiedere un tocco per ognuna delle venti carte di una sessione
   * è un tocco di troppo venti volte. Quando si sbaglia invece si aspetta,
   * perché lì la correzione è l'unica parte che serve davvero.
   */
  session.auto = Boolean(result.correct && cfg.autoGrade && cfg.autoNext);
  session.saying = null;
  render();
  window.scrollTo(0, 0);

  /*
   * Se durante la correzione parte la lettura della frase, l'avanzamento la
   * aspetta: tagliare a metà la parola che stai imparando è peggio del tocco
   * che l'automatismo ti risparmia. Il tetto evita che una sintesi bloccata
   * fermi la sessione.
   */
  if (!session.auto) return;
  const spoken = session.saying
    ? Promise.race([session.saying, new Promise((r) => later(r, 7000))])
    : Promise.resolve();
  spoken.catch(() => {}).then(() => {
    if (session?.auto) later(() => { if (session?.auto) commit(session.grade); }, 500);
  });
}

function check() {
  const s = session.sentence;
  if (session.type === 'build') {
    const given = session.picked.map((i) => session.ex.tiles[i]).join(' ');
    settle(diff(s.text, given, folded(given)));
  } else if (session.type === 'cloze') {
    settle(checkCloze(session.ex.parts, session.filled));
  } else if (session.type === 'prod') {
    settle(diff(s.text, session.answer, folded(session.answer)));
  }
}

function answerChoice(i) {
  if (session.phase === 'done') return;
  session.chosen = i;
  const ok = i === session.ex.correct;
  settle({ correct: ok, score: ok ? 1 : 0, extra: 0, marks: [], near: [], rows: [] });
}

/* --------------------------------- voce ---------------------------------- */

let stopMic = null;

function toggleMic() {
  if (session.listening) {
    stopMic?.();
    session.listening = false;
    return render();
  }
  session.micError = null;
  session.listening = true;
  render();
  const target = session.sentence.text;
  stopMic = Speech.listen({
    locale: lang.locale,
    onResult: (alternatives) => {
      const best = Speech.bestOf(alternatives, (text) => diff(target, text, folded(text)));
      if (!best) return;
      session.heard = best.text;
      session.answer = best.text;
      session.listening = false;
      settle(best.result);
    },
    onError: (message) => {
      session.micError = message;
      session.listening = false;
      render();
    },
    onEnd: () => {
      if (!session.listening) return;
      session.listening = false;
      render();
    },
  });
}

/* -------------------------------- schermata ------------------------------ */

function paintStudy() {
  if (session?.match) return paintMatch();
  if (!session || session.index >= session.queue.length) return go('done');
  const card = currentCard();
  const sentence = session.sentence;
  if (!sentence) { session.index++; prepare(); return render(); }

  const type = session.type;
  const meta = TYPES.find((t) => t.id === type);
  const isNew = card.state === NEW;
  const total = session.queue.length;
  const progress = Math.round((session.done / (session.done + (total - session.index))) * 100);

  setBar('', { back: () => endSession() });
  barTitle.innerHTML = `<span class="progress"><i style="width:${progress}%"></i></span>`;

  const el = h(`
    <section class="study">
      <div class="study__meta">
        <span class="pill pill--${type}">${type === 'prod' && session.dictation ? '🎧 Ascolta e scrivi' : `${meta.icon} ${meta.label}`}</span>
        <span class="pill pill--ghost">${sentence.lv}</span>
        ${lang.variant ? `<span class="pill pill--ghost">${esc(lang.variant.split(',')[0])}</span>` : ''}
        ${isNew ? '<span class="pill pill--new">nuova</span>' : ''}
        <span class="grow"></span>
        <span class="muted small">${session.index + 1}/${total}</span>
      </div>
      <div class="study__body" id="body"></div>
      <div class="study__foot" id="foot"></div>
    </section>`);
  view.append(el);

  const body = el.querySelector('#body');
  const foot = el.querySelector('#foot');
  const done = session.phase === 'done';

  ({ comp: askComp, build: askBuild, cloze: askCloze, prod: askProd }[type])(body, foot, sentence, done);

  if (done) {
    /*
     * La frase giusta compare qui salvo dove è già sotto gli occhi e toccabile:
     * in ogni schermata dev'esserci una sola riga di parole toccabili, altrimenti
     * l'ascolto guidato non saprebbe quale leggere.
     */
    const shown = (type === 'comp' && !session.ex.reversed) || type === 'cloze';
    body.append(h(`
      <div class="reveal">
        ${shown ? '' : `<p class="solution">${sentenceTokens(sentence.text)}</p>`}
        ${sentence.bridge ? `<p class="bridge"><span>${esc(lang.bridge)}</span>${esc(sentence.bridge)}</p>` : ''}
        <p class="note"><b>${esc(sentence.g)}</b> — ${esc(sentence.note)}</p>
        <div class="tags">${sentence.dom.map((d) => `<span class="tag">${esc(DOMAINS.find((x) => x.id === d)?.label || d)}</span>`).join('')}</div>
        ${type === 'comp' && !session.ex?.reversed ? '' : audioButtons()}
      </div>`));
    foot.append(gradeBar(card));
  }

  on(el, '[data-act="say"]', 'click', () => speak(sentence.text, { force: true }));
  on(el, '[data-act="guided"]', 'click', () => speakGuided(body, sentence.text));
  on(el, '[data-tok]', 'click', (e) => {
    stopSpeaking();
    speak(e.currentTarget.textContent, { force: true, slow: true });
  });
  on(el, '[data-act="check"]', 'click', () => check());
  on(el, '[data-act="next"]', 'click', () => commit(session.grade));
  on(el, '[data-act="other"]', 'click', () => {
    session.auto = false;
    clearTimers();
    session.showGrades = true;
    render();
  });
  on(el, '[data-grade]', 'click', (e) => commit(Number(e.currentTarget.dataset.grade)));
}

/** Frase intera oppure parola per parola. Toccando una parola si sente solo quella. */
const audioButtons = () => `
  <div class="audio">
    <button class="btn btn--icon" data-act="say">🔊 Ascolta</button>
    <button class="btn btn--icon" data-act="guided">👣 Parola per parola</button>
  </div>`;

/* ------------------------- 0. abbina: sei coppie ------------------------- */

function paintMatch() {
  const m = session.match;
  const total = m.pairs.length;
  const left = m.left.map((i) => ({ i, text: m.pairs[i].sentence.it }));
  const right = m.right.map((i) => ({ i, text: m.pairs[i].sentence.text }));

  setBar('', { back: () => endSession() });
  barTitle.innerHTML = `<span class="progress"><i style="width:${Math.round((m.solved.size / total) * 100)}%"></i></span>`;

  const cellClass = (i, side) => {
    if (m.solved.has(i)) return ' match__cell--done';
    if (m.wrong && m.wrong.includes(`${side}${i}`)) return ' match__cell--wrong';
    if (m.selected && m.selected.side === side && m.selected.i === i) return ' match__cell--on';
    return '';
  };

  const el = h(`
    <section class="study">
      <div class="study__meta">
        <span class="pill pill--match">🔗 Abbina</span>
        <span class="grow"></span>
        <span class="muted small">${m.solved.size}/${total}</span>
      </div>
      <div class="study__body">
        <p class="muted small center">Tocca una frase a sinistra e la sua traduzione a destra.</p>
        <div class="match">
          <div class="match__col">
            ${left.map((row) => `<button class="match__cell${cellClass(row.i, 'l')}" data-side="l" data-pair="${row.i}"
              ${m.solved.has(row.i) ? 'disabled' : ''}>${esc(row.text)}</button>`).join('')}
          </div>
          <div class="match__col">
            ${right.map((row) => `<button class="match__cell${cellClass(row.i, 'r')}" data-side="r" data-pair="${row.i}"
              ${m.solved.has(row.i) ? 'disabled' : ''}>${esc(row.text)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="study__foot"></div>
    </section>`);
  view.append(el);
  on(el, '[data-pair]', 'click', (e) => matchTap(e.currentTarget.dataset.side, Number(e.currentTarget.dataset.pair)));
}

function matchTap(side, i) {
  const m = session.match;
  if (m.solved.has(i) || m.wrong) return;
  const sel = m.selected;

  if (!sel || sel.side === side) {
    m.selected = { side, i };
    return render();
  }
  if (sel.i === i) {
    m.solved.add(i);
    m.selected = null;
    Sfx.play('ok', { enabled: settings().sounds && !reduceMotion() });
    if (m.solved.size === m.pairs.length) return closeMatch();
    return render();
  }

  // sbagliata: l'errore va sulla carta di entrambe le frasi coinvolte
  for (const k of [sel.i, i]) m.errors.set(k, (m.errors.get(k) || 0) + 1);
  m.wrong = [`${sel.side}${sel.i}`, `${side}${i}`];
  m.selected = null;
  Sfx.play('wrong', { enabled: settings().sounds && !reduceMotion() });
  render();
  later(() => { m.wrong = null; render(); }, 620);
}

/** Chiude l'abbinamento e registra le sei carte con il voto che si sono presi. */
function closeMatch() {
  const m = session.match;
  session.match = null;
  for (const [k, { card }] of m.pairs.entries()) {
    const errors = m.errors.get(k) || 0;
    applyReview(card, errors === 0 ? 3 : errors === 1 ? 2 : 1, 'comp', { ms: 0 });
  }
  Sfx.play('done', { enabled: settings().sounds && !reduceMotion() });
  if (session.index >= session.queue.length) {
    if (Store.markCleared(Goal.CLEARED_BONUS, lang.code)) session.earned += Goal.CLEARED_BONUS;
    return go('done');
  }
  prepare();
  render();
}

/** Riga dei voti: uno solo, già deciso, salvo ripensamenti. */
function gradeBar(card) {
  const preview = scheduler().preview(card);
  const labels = { 1: 'Di nuovo', 2: 'Difficile', 3: 'Bene', 4: 'Facile' };
  if (!session.showGrades) {
    return h(`
      <div class="stack">
        <button class="btn btn--primary${session.auto ? ' btn--auto' : ''}" data-act="next">
          Avanti<span class="btn__sub">${labels[session.grade]} · fra ${labelInterval(preview[session.grade])}</span>
        </button>
        <button class="btn btn--ghost small" data-act="other">Non è andata così: scegli tu il voto</button>
      </div>`);
  }
  return h(`
    <div class="grades">
      ${GRADES.map((g) => `
        <button class="grade grade--${g}${session.grade === g ? ' grade--hint' : ''}" data-grade="${g}">
          <span class="grade__l">${labels[g]}</span>
          <span class="grade__i">${labelInterval(preview[g])}</span>
        </button>`).join('')}
    </div>`);
}

/* ---------------------- 1. riconosci: quattro scelte --------------------- */

function askComp(body, foot, sentence, done) {
  const reversed = session.ex.reversed;

  if (reversed) {
    // si parte dall'italiano: la frase nella lingua è la risposta, non la domanda,
    // quindi non la si legge ad alta voce prima che sia stata scelta
    body.append(h(`
      <div class="stack center">
        <p class="hint hint--big">${esc(sentence.it)}</p>
        ${done ? '' : '<p class="muted small">Come si dice?</p>'}
      </div>`));
    if (done && !session.spoke.done) { session.spoke.done = true; speak(sentence.text); }
  } else {
    body.append(h(`
      <div class="stack center">
        <p class="target">${sentenceTokens(sentence.text)}</p>
        ${audioButtons()}
        ${done ? '' : '<p class="muted small">Quale traduzione è la sua?</p>'}
      </div>`));
    const phase = done ? 'done' : 'ask';
    if (!session.spoke[phase]) { session.spoke[phase] = true; speak(sentence.text); }
  }

  const list = h(`
    <div class="stack">
      ${session.ex.options.map((o, i) => {
        let cls = '';
        if (done && i === session.ex.correct) cls = ' btn--right';
        else if (done && i === session.chosen) cls = ' btn--wrong';
        return `<button class="btn btn--option${cls}" data-choice="${i}"${done ? ' disabled' : ''}>${esc(o)}</button>`;
      }).join('')}
    </div>`);
  body.append(list);
  on(list, '[data-choice]', 'click', (e) => answerChoice(Number(e.currentTarget.dataset.choice)));
}

/* ------------------------- 2. componi: tessere --------------------------- */

function askBuild(body, foot, sentence, done) {
  const picked = session.picked;
  const built = picked.map((i) => session.ex.tiles[i]).join(' ');

  body.append(h(`
    <div class="stack center">
      <p class="hint hint--big">${esc(sentence.it)}</p>
      ${done ? '' : '<p class="muted small">Rimetti in fila le parole. Due non servono.</p>'}
    </div>`));

  const line = h(`<div class="tray${done ? (session.result.correct ? ' tray--ok' : ' tray--ko') : ''}">
    ${picked.length
      ? picked.map((i, pos) => `<button class="tile tile--set" data-drop="${pos}"${done ? ' disabled' : ''}>${esc(session.ex.tiles[i])}</button>`).join('')
      : '<span class="tray__ghost">tocca le parole qui sotto</span>'}
  </div>`);
  body.append(line);

  if (!done) {
    const pool = h(`<div class="tiles">
      ${session.ex.tiles.map((w, i) => picked.includes(i)
        ? `<span class="tile tile--used">${esc(w)}</span>`
        : `<button class="tile" data-tile="${i}">${esc(w)}</button>`).join('')}
    </div>`);
    body.append(pool);
    on(pool, '[data-tile]', 'click', (e) => { picked.push(Number(e.currentTarget.dataset.tile)); render(); });
    on(line, '[data-drop]', 'click', (e) => { picked.splice(Number(e.currentTarget.dataset.drop), 1); render(); });
    foot.append(h(`<button class="btn btn--primary" data-act="check"${picked.length ? '' : ' disabled'}>Controlla</button>`));
  } else {
    body.append(marksBlock(session.result));
  }
}

/* --------------------- 3. completa: buchi crescenti ---------------------- */

function askCloze(body, foot, sentence, done) {
  let blank = -1;
  let tok = -1;
  const line = h(`<p class="target target--cloze">${session.ex.parts.map((p) => {
    if (!p.blank) return done ? `<span class="tok" data-tok="${++tok}">${esc(p.text)}</span>` : `<span>${esc(p.text)}</span>`;
    blank += 1;
    const row = done ? session.result.rows[blank] : null;
    if (done) {
      return `<span class="slot slot--${row.correct ? 'ok' : 'ko'} tok" data-tok="${++tok}">${esc(p.answer)}</span>`;
    }
    return `<input class="slot slot--in" data-blank="${blank}" size="${Math.max(4, p.answer.length)}"
      inputmode="text" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false"
      value="${esc(session.filled[blank])}">`;
  }).join(' ')}</p>`);

  body.append(h(`<div class="stack center">
    <p class="hint">${esc(sentence.it)}</p>
  </div>`));
  body.append(line);

  if (!done) {
    body.append(h(`<p class="muted small center">${session.ex.blanks === 1
      ? 'Manca un pezzo. Crescono man mano che la frase si consolida.'
      : `Mancano ${session.ex.blanks} pezzi su ${session.ex.total} parole.`}${
      lang.script ? ' Puoi scrivere anche in caratteri latini.' : ''}</p>`));
    const inputs = [...line.querySelectorAll('[data-blank]')];
    inputs.forEach((input, i) => {
      input.addEventListener('input', () => { session.filled[i] = input.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (i + 1 < inputs.length) inputs[i + 1].focus();
        else check();
      });
    });
    setTimeout(() => inputs[0]?.focus(), 60);
    foot.append(h('<button class="btn btn--primary" data-act="check">Controlla</button>'));
  } else {
    const wrong = session.result.rows.filter((r) => !r.correct);
    if (wrong.length) {
      body.append(h(`<div class="check check--ko">
        ${wrong.map((r) => `<p class="small">Hai scritto <b class="w w--missing">${esc(r.given || '—')}</b>, era <b class="w w--ok">${esc(r.answer)}</b>.</p>`).join('')}
      </div>`));
    }
  }
}

/* ---------------- 4. produci: scrittura oppure dettatura ----------------- */

function askProd(body, foot, sentence, done) {
  const heard = session.dictation;

  if (heard && !done) {
    body.append(h(`
      <div class="stack center">
        <p class="muted small">Ascolta e scrivi quello che senti.</p>
        <button class="btn btn--listen" data-act="say">🔊</button>
        <button class="btn btn--icon" data-act="guided">👣 Parola per parola</button>
      </div>`));
    if (!session.spoke.ask) { session.spoke.ask = true; speak(sentence.text, { force: true }); }
  } else {
    body.append(h(`
      <div class="stack center">
        ${heard ? '<p class="muted small">Era questa:</p>' : ''}
        <p class="hint hint--big">${esc(sentence.it)}</p>
        ${done ? '' : `<p class="muted small">Scrivila per intero, o dettala.${lang.script ? ` In ${esc(lang.script)} o in caratteri latini: vanno bene entrambi.` : ''}</p>`}
      </div>`));
  }

  if (!done) {
    const input = h(`<input class="input" type="text" inputmode="text" autocapitalize="none" autocomplete="off"
      autocorrect="off" spellcheck="false" placeholder="${lang.script ? 'scrivi la frase, anche in latino' : 'scrivi la frase'}" value="${esc(session.answer)}">`);
    body.append(input);
    input.addEventListener('input', () => { session.answer = input.value; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    if (!session.listening) setTimeout(() => input.focus(), 60);

    if (Speech.supported && settings().speechInput) {
      const mic = h(`<button class="btn btn--mic${session.listening ? ' btn--mic-on' : ''}" data-act="mic">
        ${session.listening ? '● Ti ascolto… tocca per fermare' : '🎙 Dettala a voce'}
      </button>`);
      body.append(mic);
      mic.addEventListener('click', () => toggleMic());
    }
    if (session.micError) body.append(h(`<p class="small muted center">${esc(session.micError)}</p>`));
    foot.append(h('<button class="btn btn--primary" data-act="check">Controlla</button>'));
  } else {
    if (session.heard) {
      body.append(h(`<p class="small muted center">Ho sentito: “${esc(session.heard)}”</p>`));
    }
    body.append(marksBlock(session.result));
  }
}

/** Frase attesa parola per parola, con quello che manca in evidenza. */
function marksBlock(result) {
  return h(`
    <div class="check ${result.correct ? 'check--ok' : 'check--ko'}">
      <div class="check__line">${result.marks.map((m) => `<span class="w w--${m.status}">${esc(m.word)}</span>`).join(' ')}</div>
      ${result.near.length
        ? `<p class="small muted">Hai messo ${result.near.map((n) => `<b>${esc(n.written)}</b>`).join(', ')} al posto di ${result.near.map((n) => `<b>${esc(n.expected)}</b>`).join(', ')}.</p>`
        : ''}
    </div>`);
}

/* ------------------------------- avanzamento ----------------------------- */

/**
 * Registra una risposta su una carta: scheduler, registro, punti, e il rientro
 * in coda quando serve. Non tocca l'avanzamento della sessione, perché
 * l'abbinamento ne chiude sei in un colpo solo.
 */
function applyReview(card, grade, type, { miss = null, ms = 0 } = {}) {
  const sch = scheduler();
  const now = Date.now();
  const wasReview = card.state === REVIEW;
  const isNew = card.state === NEW;
  const next = sch.review(card, grade, now);
  if (miss) next.miss = miss;

  Store.saveCard(next, lang.code);
  Store.logReview({
    t: now,
    id: card.id,
    type,
    g: grade,
    wasReview,
    isNew,
    ivl: next.ivl,
    ms: Math.min(600000, ms),
    xp: Goal.PER_CARD,
    s: Number(next.s.toFixed(3)),
    d: Number(next.d.toFixed(2)),
  }, lang.code);

  session.done += 1;
  session.earned += Goal.PER_CARD;
  if (grade === 1) session.again += 1;

  /*
   * Criterio di sessione (successive relearning: Rawson & Dunlosky 2011;
   * Rawson, Dunlosky & Sciartelli 2013). Richiamare una cosa UNA volta per
   * sessione e poi rivederla a distanza produce già molto; richiamarla più
   * volte prima di chiudere la sessione produce di più, e a un costo modesto
   * perché la seconda volta arriva quasi gratis. Chi lo vuole lo attiva.
   */
  const hits = grade >= 3 ? (session.hits.get(card.id) || 0) + 1 : 0;
  session.hits.set(card.id, hits);
  const wantsMore = grade >= 3 && hits < (settings().criterion || 1);

  if (next.state === 'learning' || next.state === 'relearning' || wantsMore) {
    const at = Math.min(session.index + (wantsMore ? 5 : 3), session.queue.length);
    session.queue.splice(at, 0, next);
  }
  return next;
}

/** Fine della sessione, o carta successiva. */
function advance() {
  session.index += 1;
  if (session.index >= session.queue.length) {
    // coda svuotata: il premio si prende una volta al giorno, non una a sessione
    if (Store.markCleared(Goal.CLEARED_BONUS, lang.code)) session.earned += Goal.CLEARED_BONUS;
    return go('done');
  }
  prepare();
  render();
}

function commit(grade) {
  session.auto = false;
  clearTimers();
  stopSpeaking();
  const card = currentCard();

  // la carta si tiene le parole che hai sbagliato: i buchi futuri andranno lì
  let miss = null;
  if (session.type === 'cloze' && session.result?.rows) {
    const acc = { ...(card.miss || {}) };
    for (const row of session.result.rows) {
      if (row.correct) continue;
      for (const word of row.answer.split(/\s+/)) acc[word] = (acc[word] || 0) + 1;
    }
    if (Object.keys(acc).length) miss = acc;
  }

  applyReview(card, grade, session.type, { miss, ms: Date.now() - (session.shownAt || Date.now()) });
  advance();
}

function endSession() {
  stopMic?.();
  stopSpeaking();
  if (session) session.match = null;
  if (!session) return go('home');
  go(session.done ? 'done' : 'home');
}

function paintDone() {
  const s = session;
  session = null;
  setBar('');
  const cfg = settings();
  const day = Store.today(lang.code);
  const goal = Goal.goalOf(cfg.dailyGoal);
  const reached = day.xp >= goal.xp;
  const justReached = reached && s && (s.startXp || 0) < goal.xp;
  const minutes = s ? Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)) : 0;
  const accuracy = s && s.done ? Math.round(((s.done - s.again) / s.done) * 100) : 0;
  const deck = Store.getDeck(lang.code);
  const up = nextDue(deck);

  Sfx.play(justReached ? 'goal' : 'done', { enabled: cfg.sounds && !reduceMotion() });

  const el = h(`
    <section class="pad stack done-screen">
      <div class="done">
        <div class="done__ring${reduceMotion() ? '' : ' done__ring--in'}">
          ${Chart.ring({
            value: day.xp,
            total: goal.xp,
            big: `+${s ? s.earned : 0}`,
            small: reached ? `${day.xp} oggi · obiettivo ✓` : `${day.xp} su ${goal.xp}`,
            done: reached,
            extra: day.xp > goal.xp ? (day.xp - goal.xp) / goal.xp : 0,
            size: 148,
          })}
        </div>
        <h2>${justReached ? 'Obiettivo raggiunto' : reached ? 'Ancora avanti' : 'Sessione finita'}</h2>
        <p class="muted">${s ? plural(s.done, 'carta', 'carte') : ''} · ${minutes} min · ${accuracy}% al primo colpo</p>
      </div>

      <div class="row">
        <div class="stat">
          <div class="stat__n">${day.xp}<span class="stat__of">${reached ? ' ✓' : `/${goal.xp}`}</span></div>
          <div class="stat__l">punti di oggi</div>
        </div>
        <div class="stat">
          <div class="stat__n">🔥 ${Store.streak(lang.code)}</div>
          <div class="stat__l">giorni di fila</div>
        </div>
      </div>

      <div class="card card--flat">
        <p class="small muted">${up
          ? `Il prossimo ripasso è fra ${humanDelay(up - Date.now())}. Le carte tornano poco prima che tu le dimentichi: è lì che ripassare rende di più.`
          : 'Nessun ripasso in programma.'}</p>
      </div>
      <button class="btn btn--primary" data-act="home">Torna alla home</button>
      <button class="btn btn--ghost" data-act="stats">Guarda i progressi</button>
    </section>`);
  on(el, '[data-act="home"]', 'click', () => go('home'));
  on(el, '[data-act="stats"]', 'click', () => go('stats'));
  view.append(el);
}

/* -------------------------------- esplora -------------------------------- */

let filter = { lv: '', dom: '', q: '', g: '' };

function paintExplore() {
  const deck = Store.getDeck(lang.code);
  const introduced = new Set(Object.keys(deck.cards).map((id) => splitId(id).sid));
  const q = filter.q.trim().toLowerCase();
  const rows = lang.sentences.filter((s) =>
    (!filter.lv || s.lv === filter.lv)
    && (!filter.dom || s.dom.includes(filter.dom))
    && (!filter.g || s.g === filter.g)
    && (!q || s.text.toLowerCase().includes(q) || s.it.toLowerCase().includes(q) || s.g.toLowerCase().includes(q)));

  setBar('Esplora il corpus');
  const el = h(`
    <section class="pad stack">
      <input class="input" id="q" type="search" placeholder="cerca una frase, una parola, una regola" value="${esc(filter.q)}">
      ${filter.g ? `<button class="chip chip--on chip--clear" data-act="clear-g">${esc(filter.g)} ✕</button>` : ''}
      <div class="scroller">
        <button class="chip${filter.lv ? '' : ' chip--on'}" data-lv="">Tutti</button>
        ${LEVELS.map((lv) => `<button class="chip${filter.lv === lv ? ' chip--on' : ''}" data-lv="${lv}">${lv}</button>`).join('')}
      </div>
      <div class="scroller">
        <button class="chip${filter.dom ? '' : ' chip--on'}" data-dom="">Ogni settore</button>
        ${DOMAINS.map((d) => `<button class="chip${filter.dom === d.id ? ' chip--on' : ''}" data-dom="${d.id}">${d.icon} ${esc(d.label)}</button>`).join('')}
      </div>
      <p class="muted small">${plural(rows.length, 'frase', 'frasi')}</p>
      <div class="stack" id="list">
        ${rows.slice(0, 120).map((s) => `
          <div class="row-item${introduced.has(s.id) ? ' row-item--seen' : ''}">
            <div class="row-item__main">
              <p class="row-item__t">${esc(s.text)}</p>
              <p class="row-item__i">${esc(s.it)}</p>
              <p class="row-item__g">${s.lv} · ${esc(s.g)}</p>
            </div>
            <button class="icon-btn" data-say="${esc(s.text)}">🔊</button>
          </div>`).join('')}
      </div>
      ${rows.length > 120 ? '<p class="muted small center">Affina la ricerca per vedere le altre.</p>' : ''}
    </section>`);

  const input = el.querySelector('#q');
  input.addEventListener('input', () => {
    filter.q = input.value;
    const pos = input.selectionStart;
    render();
    const again = view.querySelector('#q');
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  });
  on(el, '[data-act="clear-g"]', 'click', () => { filter.g = ''; render(); });
  on(el, '[data-lv]', 'click', (e) => { filter.lv = e.currentTarget.dataset.lv; render(); });
  on(el, '[data-dom]', 'click', (e) => { filter.dom = e.currentTarget.dataset.dom; render(); });
  on(el, '[data-say]', 'click', (e) => speak(e.currentTarget.dataset.say, { force: true }));
  view.append(el);
}

/* ------------------------------- progressi ------------------------------- */

/** Contenitore standard di un grafico, con la riga che risponde al tocco. */
function chartCard({ title, badge = '', intro = '', svg, legend = '', foot = '' }) {
  return `
    <div class="card card--flat chart-card">
      <div class="card__head"><b>${title}</b>${badge ? `<span class="muted small">${badge}</span>` : ''}</div>
      ${intro ? `<p class="small muted">${intro}</p>` : ''}
      <div class="chart-wrap">${svg}</div>
      ${legend}
      <p class="small muted chart__readout">&nbsp;</p>
      ${foot ? `<p class="small muted">${foot}</p>` : ''}
    </div>`;
}

/** Toccare o passare sopra un segno ne scrive il valore sotto al grafico. */
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

let gramExpanded = false;   // la mappa mostra di norma solo i punti già incontrati

/** Dal consolidamento di un punto grammaticale al passo della rampa. */
function gramColor(g) {
  if (!g.seen) return '#1e2735';
  const steps = Chart.RAMP;
  const solid = Math.min(1, g.strength / 30);          // 30 giorni di stabilità = solido
  const covered = g.seen / g.total;
  return steps[Math.min(steps.length - 1, Math.floor(((solid * 0.7) + (covered * 0.3)) * steps.length))];
}

/**
 * La curva dell'oblio della carta tipica del mazzo: quella con la stabilità
 * mediana, disegnata con i pesi in uso e con la soglia di ritenzione richiesta.
 * È la formula che decide gli intervalli, resa guardabile.
 */
function forgettingCurve(deck, cfg) {
  const median = Stats.medianStability(deck.cards);
  const s = median || Fsrs.initStability(cfg.w || DEFAULT_W, 3);
  const due = Math.max(1, Math.round(Fsrs.intervalFor(s, cfg.retention)));
  const span = Math.max(2, Math.round(due * 2.4));
  const points = [];
  for (let i = 0; i <= 40; i++) {
    const t = (span * i) / 40;
    points.push({ x: t, y: Fsrs.retrievability(t, s) });
  }
  return {
    badge: median ? `stabilità mediana ${humanDays(s)}` : 'carta nuova',
    svg: Chart.line({
      points,
      yFormat: (v) => `${Math.round(v * 100)}%`,
      xLabels: [{ x: 0, label: 'oggi' }, { x: due, label: humanDays(due) }, { x: span, label: humanDays(span) }],
      hline: { y: cfg.retention, label: `${Math.round(cfg.retention * 100)}%` },
      marks: [{ x: due, y: cfg.retention, label: 'ripasso', readout: `Dopo ${humanDays(due)} la probabilità di ricordarla è scesa al ${Math.round(cfg.retention * 100)}%: è lì che la carta torna.` }],
    }),
    foot: median
      ? `La carta a metà del tuo mazzo regge ${humanDays(s)} prima di scendere al 90%. Con la ritenzione al ${Math.round(cfg.retention * 100)}% torna dopo ${humanDays(due)}: prima sarebbe tempo sprecato, dopo sarebbe dimenticata.`
      : 'Compare sui tuoi numeri appena qualche carta arriva in ripasso. Per ora è quella di una carta appena imparata.',
  };
}

function paintStats() {
  const deck = Store.getDeck(lang.code);
  const cfg = settings();
  const ret = Stats.trueRetention(deck.log, 30);
  const states = Stats.stateCounts(deck.cards);
  const gram = Stats.grammarProgress(deck, lang);
  const history = Stats.reviewsByDay(deck.log, 30);
  const calendar = Stats.reviewsByDay(deck.log, 112).map((d) => ({ ...d, value: d.total }));
  const vocab = Stats.vocabulary(deck, lang);
  const forget = forgettingCurve(deck, cfg);
  const trouble = Stats.troubleSpots(deck, lang, 5);
  const theta = deck.profile.theta;

  setBar('Progressi');
  const el = h(`
    <section class="pad stack">
      <div class="card card--flat">
        <div class="card__head"><b>Livello stimato</b><span class="pill">${deck.profile.cefr || '—'}</span></div>
        <div class="scale">
          ${Irt.CEFR.map((c) => `<span class="scale__step${c.id === deck.profile.cefr ? ' scale__step--on' : ''}">${c.id}</span>`).join('')}
        </div>
        <p class="small muted">${theta === null || theta === undefined
          ? 'Non hai ancora fatto il test.'
          : `θ = ${theta.toFixed(2)} · posizione nella banda ${Math.round(Irt.bandProgress(theta) * 100)}% · le frasi nuove pescano intorno al livello ${targetLevel(theta)}.`}</p>
        <button class="btn btn--ghost small" data-act="retest">Rifai il test</button>
      </div>

      <div class="row">
        <div class="stat">
          <div class="stat__n">${ret ? `${Math.round(ret.rate * 100)}%` : '—'}</div>
          <div class="stat__l">ritenzione reale</div>
        </div>
        <div class="stat">
          <div class="stat__n">${Math.round(cfg.retention * 100)}%</div>
          <div class="stat__l">obiettivo</div>
        </div>
        <div class="stat">
          <div class="stat__n">${states.mature}</div>
          <div class="stat__l">carte mature</div>
        </div>
      </div>
      <p class="small muted">${ret
        ? `Misurata su ${plural(ret.n, 'ripasso', 'ripassi')} degli ultimi 30 giorni. Se resta vicina all’obiettivo, gli intervalli sono tarati bene.`
        : 'La ritenzione reale compare dopo i primi ripassi a scadenza.'}</p>

      ${chartCard({
        title: 'La tua curva dell’oblio',
        badge: forget.badge,
        intro: 'La formula che decide i tuoi intervalli, disegnata sui tuoi numeri: la probabilità di ricordare cala nel tempo, e il ripasso cade quando arriva alla ritenzione che hai chiesto.',
        svg: forget.svg,
        foot: forget.foot,
      })}

      ${chartCard({
        title: 'Ripassi fatti',
        badge: 'ultimi 30 giorni',
        svg: Chart.bars({ rows: history.map((d) => ({ label: d.label, values: [d.ok, d.again], readout: `${d.label}: ${d.total} ripassi, ${d.again} sbagliati` })), names: ['indovinati', 'sbagliati'] }),
        legend: Chart.legend(['indovinati', 'sbagliati']),
        foot: `${history.reduce((n, d) => n + d.total, 0)} ripassi in trenta giorni, ${history.filter((d) => d.total).length} giorni con almeno una carta.`,
      })}

      ${chartCard({
        title: 'Calendario dello studio',
        badge: '16 settimane',
        svg: Chart.heatmap({ days: calendar }),
        foot: `Ogni quadratino è un giorno, più chiaro dove hai ripassato di più. Serie attuale: ${plural(Store.streak(lang.code), 'giorno', 'giorni')}.`,
      })}

      ${chartCard({
        title: 'Carico in arrivo',
        badge: 'prossimi 14 giorni',
        svg: Chart.bars({ rows: Stats.forecast(deck.cards, 14).map((d) => ({ label: d.label, values: [d.total], readout: `${d.label}: ${d.total} carte in scadenza` })), names: ['carte in scadenza'] }),
        foot: 'Quanto ti costerà ogni giorno se non aggiungi nulla. Se cresce troppo, abbassa le frasi nuove al giorno.',
      })}

      ${vocab.points.length > 1 ? chartCard({
        title: 'Parole diverse incontrate',
        badge: `${vocab.types} su ${vocab.total}`,
        intro: 'Non quante frasi hai visto, ma quanti tipi lessicali diversi: è la quota di parole note dentro un testo a decidere se lo capisci.',
        svg: Chart.line({
          points: vocab.points,
          yFormat: (v) => Math.round(v),
          xLabels: [{ x: 0, label: 'inizio' }, { x: vocab.points.length - 1, label: 'oggi' }],
          marks: [{ x: vocab.points.length - 1, y: vocab.types, label: String(vocab.types), readout: `${vocab.types} parole diverse` }],
        }),
        foot: `Il corpus ${esc(lang.name.toLowerCase())} ne contiene ${vocab.total} in tutto.`,
      }) : ''}

      <div class="card card--flat">
        <div class="card__head"><b>Composizione del mazzo</b><span class="muted small">${states.total} carte</span></div>
        <div class="split">
          <span class="split__seg split__seg--learn" style="flex:${states.learning || 0.001}"></span>
          <span class="split__seg split__seg--young" style="flex:${states.young || 0.001}"></span>
          <span class="split__seg split__seg--mature" style="flex:${states.mature || 0.001}"></span>
        </div>
        <div class="legend">
          <span><i class="swatch" style="background:#cf7a26"></i>${states.learning} in apprendimento</span>
          <span><i class="swatch" style="background:#4a93e0"></i>${states.young} giovani</span>
          <span><i class="swatch" style="background:#279c78"></i>${states.mature} mature (oltre 21 g)</span>
        </div>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Mappa della grammatica</b><span class="muted small">${gram.filter((g) => g.seen).length}/${gram.length} punti</span></div>
        <p class="small muted">Più chiaro, più solido. Tocca un punto per vedere tutte le frasi che lo contengono.</p>
        <div class="gram-map">
          ${(gramExpanded ? gram : gram.filter((g) => g.seen)).map((g) => `
            <button class="gram" data-gram="${esc(g.g)}" style="--fill:${gramColor(g)}">
              <span class="gram__n">${esc(g.g)}</span>
              <span class="gram__v">${g.seen}/${g.total}</span>
            </button>`).join('')}
        </div>
        ${gram.some((g) => !g.seen) ? `<button class="btn btn--ghost small" data-act="gram-all">${
          gramExpanded ? 'Mostra solo quelli incontrati' : `Mostra anche i ${gram.filter((g) => !g.seen).length} mai incontrati`}</button>` : ''}
        <div class="legend">
          <span><i class="swatch" style="background:#1e2735"></i>mai visto</span>
          <span><i class="swatch" style="background:${Chart.RAMP[0]}"></i>fragile</span>
          <span><i class="swatch" style="background:${Chart.RAMP[4]}"></i>solido</span>
        </div>
      </div>

      <div id="tuning-slot"></div>

      ${trouble.length ? `
      <div class="card card--flat">
        <div class="card__head"><b>Le più ostiche</b></div>
        ${trouble.map((t) => `
          <div class="row-item">
            <div class="row-item__main">
              <p class="row-item__t">${esc(t.sentence.text)}</p>
              <p class="row-item__g">${plural(t.card.lapses, 'errore', 'errori')} · ${esc(TYPES.find((x) => x.id === t.type).short)} · difficoltà ${t.card.d.toFixed(1)}/10</p>
            </div>
          </div>`).join('')}
      </div>` : ''}
    </section>`);
  on(el, '[data-act="retest"]', 'click', () => startExam());
  on(el, '[data-act="gram-all"]', 'click', () => { gramExpanded = !gramExpanded; render(); });
  on(el, '[data-gram]', 'click', (e) => {
    filter = { lv: '', dom: '', q: '', g: e.currentTarget.dataset.gram };
    go('explore');
  });
  const slot = el.querySelector('#tuning-slot');
  paintTuning(slot, deck, cfg);
  paintRetention(slot, deck, cfg);
  wireCharts(el);
  wireCharts(slot);
  view.append(el);
}


/* ---------------------- taratura del modello di memoria ------------------ */

let tuning = null;   // esito dell'ultima ottimizzazione, in attesa di conferma

function paintTuning(container, deck, cfg) {
  const sequences = Opt.replay(deck.log);
  const current = cfg.w || DEFAULT_W;
  const now = Opt.score(sequences, current);
  const personal = Boolean(cfg.w);
  const enough = now.n >= Opt.MIN_REVIEWS;

  const card = h(`
    <div class="card card--flat chart-card">
      <div class="card__head">
        <b>Taratura del modello</b>
        <span class="pill">${personal ? 'pesi tuoi' : 'pesi di serie'}</span>
      </div>
      <p class="small muted">
        I 19 pesi di FSRS che decidono i tuoi intervalli vengono, di serie, dai ripassi di
        centinaia di milioni di carte altrui. Si possono rifare sui tuoi: è il senso
        dichiarato dell’algoritmo, non un extra.
      </p>
      <div class="row">
        <div class="stat">
          <div class="stat__n">${now.n}</div>
          <div class="stat__l">ripassi utilizzabili</div>
        </div>
        <div class="stat">
          <div class="stat__n">${now.rmse === null ? '—' : (now.rmse * 100).toFixed(1) + '%'}</div>
          <div class="stat__l">errore di calibrazione</div>
        </div>
        <div class="stat">
          <div class="stat__n">${Number.isFinite(now.logLoss) ? now.logLoss.toFixed(3) : '—'}</div>
          <div class="stat__l">log-loss</div>
        </div>
      </div>
      <div id="tuning-body"></div>
    </div>`);
  container.append(card);
  const body = card.querySelector('#tuning-body');

  if (!now.n) {
    body.append(h('<p class="small muted">La taratura compare dopo i primi ripassi arrivati a scadenza: prima non c’è niente da misurare.</p>'));
    return;
  }

  const bins = Opt.calibration(now.rows);
  body.append(h(`
    <div class="stack">
      <p class="small muted">
        Quando il modello dice “te la ricordi all’85%”, dovrebbe azzeccarci l’85% delle volte.
        Ogni punto è una fascia di previsioni: sulla diagonale il modello è onesto, sotto è
        ottimista, sopra è prudente. Più grande il punto, più ripassi ci sono dentro.
      </p>
      <div class="chart-wrap chart-wrap--square">${Chart.calibration({ bins })}</div>
      <p class="small muted chart__readout">&nbsp;</p>
    </div>`));

  if (tuning) {
    const better = tuning.after.logLoss < tuning.before.logLoss;
    body.append(h(`
      <div class="card card--flat">
        <p class="small"><b>${better ? 'Trovati pesi migliori dei tuoi attuali.' : 'I pesi attuali reggono: non ho trovato di meglio.'}</b></p>
        <p class="small muted">
          log-loss ${tuning.before.logLoss.toFixed(4)} → <b>${tuning.after.logLoss.toFixed(4)}</b> ·
          calibrazione ${(tuning.before.rmse * 100).toFixed(1)}% → <b>${(tuning.after.rmse * 100).toFixed(1)}%</b>
          ${tuning.n < Opt.GOOD_REVIEWS ? '<br>Con meno di ' + Opt.GOOD_REVIEWS + ' ripassi la stima è ancora rumorosa: rifalla più avanti.' : ''}
        </p>
        <div class="row">
          <button class="btn btn--primary" data-act="apply"${better ? '' : ' disabled'}>Usa questi pesi</button>
          <button class="btn btn--ghost" data-act="discard">Lascia stare</button>
        </div>
      </div>`));
  } else {
    body.append(h(`
      <div class="stack">
        <button class="btn btn--ghost" data-act="fit"${enough ? '' : ' disabled'}>
          Ricalcola i pesi sui miei ripassi
        </button>
        ${enough ? '' : `<p class="small muted">Servono almeno ${Opt.MIN_REVIEWS} ripassi a scadenza: ne hai ${now.n}. Sotto quella soglia si starebbe tarando sul rumore.</p>`}
        ${personal ? '<button class="btn btn--ghost small" data-act="reset-w">Torna ai pesi di serie</button>' : ''}
      </div>`));
  }

  on(card, '[data-act="fit"]', 'click', (e) => {
    const btn = e.currentTarget;
    btn.textContent = 'Sto rigiocando i tuoi ripassi…';
    btn.disabled = true;
    setTimeout(() => {
      const result = Opt.optimize(sequences, { start: current });
      tuning = { w: result.w, before: now, after: Opt.score(sequences, result.w), n: now.n };
      render();
    }, 30);
  });
  on(card, '[data-act="apply"]', 'click', () => {
    Store.setSetting('w', tuning.w);
    tuning = null;
    render();
  });
  on(card, '[data-act="discard"]', 'click', () => { tuning = null; render(); });
  on(card, '[data-act="reset-w"]', 'click', () => { Store.setSetting('w', null); render(); });
}

/** Quanto costa la ritenzione che hai chiesto, e quanto costerebbero le altre. */
function paintRetention(container, deck, cfg) {
  const cost = Opt.measuredCost(deck.log);
  const curve = Opt.retentionCurve(cfg.w || DEFAULT_W, { cost });
  const here = curve.find((p) => Math.abs(p.retention - cfg.retention) < 0.005) || curve[10];
  const low = curve[0];
  const high = curve[curve.length - 1];

  container.append(h(`
    <div class="card card--flat chart-card">
      <div class="card__head"><b>Il prezzo della ritenzione</b><span class="pill">${Math.round(cfg.retention * 100)}%</span></div>
      <p class="small muted">
        Alzare la ritenzione richiesta accorcia gli intervalli: ricordi di più e ripassi di più.
        Non esiste un numero giusto per tutti — dipende da quanto tempo hai — quindi invece di
        consigliartene uno, ecco quanto costa ognuno, simulato con i tuoi pesi
        ${cost.measured ? `e con i tuoi tempi reali (${cost.pass.toFixed(0)} s se indovini, ${cost.fail.toFixed(0)} s se sbagli)` : 'e con tempi di riferimento, finché non ne avrai di tuoi'}.
      </p>
      <p class="small muted"><b>Quanto costa</b> — ripassi all’anno per carta</p>
      <div class="chart-wrap">${Chart.bars({
        rows: curve.map((p) => ({
          label: `${Math.round(p.retention * 100)}`,
          values: [p.reviews],
          readout: `Al ${Math.round(p.retention * 100)}%: ${p.reviews.toFixed(1)} ripassi e ${p.minutes.toFixed(1)} minuti all’anno, memoria media ${Math.round(p.knowledge * 100)}%`,
        })),
        names: ['ripassi all’anno'],
        everyLabel: 3,
      })}</div>
      <p class="small muted"><b>Quanto rende</b> — memoria media nell’anno</p>
      <div class="chart-wrap">${Chart.line({
        points: curve.map((p) => ({ x: p.retention * 100, y: p.knowledge })),
        yFormat: (v) => `${Math.round(v * 100)}%`,
        area: false,
        xLabels: [{ x: 80, label: '80%' }, { x: 88, label: '88%' }, { x: 95, label: '95%' }],
        marks: [{ x: here.retention * 100, y: here.knowledge, label: 'tu', readout: `Al ${Math.round(here.retention * 100)}% che hai adesso: ${here.reviews.toFixed(1)} ripassi l’anno per una memoria media del ${Math.round(here.knowledge * 100)}%` }],
        height: 120,
      })}</div>
      <p class="small muted chart__readout">&nbsp;</p>
      <p class="small muted">
        Due grafici e non uno con due scale: le due grandezze non si confrontano, si leggono una
        sotto l’altra. Fra ${Math.round(low.retention * 100)}% e ${Math.round(high.retention * 100)}%
        i ripassi passano da ${low.reviews.toFixed(1)} a ${high.reviews.toFixed(1)} —
        ${(high.reviews / low.reviews).toFixed(1)} volte tanti — per
        ${Math.round((high.knowledge - low.knowledge) * 100)} punti di memoria media in più.
      </p>
    </div>`));
}

/* ------------------------------ impostazioni ----------------------------- */

function paintSettings() {
  const cfg = settings();
  const chosen = new Set(cfg.domains);
  setBar('Impostazioni');
  const el = h(`
    <section class="pad stack">
      <div class="card card--flat">
        <div class="card__head"><b>Ritmo</b></div>
        <label class="field">
          <span>Frasi nuove al giorno <b class="val">${cfg.newPerDay}</b></span>
          <input type="range" min="0" max="30" step="1" value="${cfg.newPerDay}" data-set="newPerDay">
        </label>
        <label class="field">
          <span>Tetto ai ripassi <b class="val">${cfg.maxReviews}</b></span>
          <input type="range" min="20" max="300" step="10" value="${cfg.maxReviews}" data-set="maxReviews">
        </label>
        <label class="field">
          <span>Ritenzione richiesta <b class="val">${Math.round(cfg.retention * 100)}%</b></span>
          <input type="range" min="80" max="95" step="1" value="${Math.round(cfg.retention * 100)}" data-set="retention" data-scale="100">
        </label>
        <p class="small muted">Più la ritenzione è alta, più i ripassi sono fitti. Sopra il 90% il carico cresce in fretta a fronte di poca memoria in più: 90% è il compromesso su cui FSRS è tarato.</p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Settori</b></div>
        <div class="grid">
          ${DOMAINS.map((d) => `
            <button class="chip-card${chosen.has(d.id) ? ' chip-card--on' : ''}" data-dom="${d.id}">
              <span class="chip-card__icon">${d.icon}</span><span>${esc(d.label)}</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Che cosa vuoi saper fare</b></div>
        <div class="grid">
          <button class="chip-card${cfg.direction === 'produce' ? ' chip-card--on' : ''}" data-dir="produce">
            <span class="chip-card__icon">🗣️</span><span>Parlare</span>
          </button>
          <button class="chip-card${cfg.direction === 'understand' ? ' chip-card--on' : ''}" data-dir="understand">
            <span class="chip-card__icon">👂</span><span>Capire</span>
          </button>
        </div>
        <p class="small muted">
          Con <b>Parlare</b> parti sempre dall’italiano e devi tirare fuori tu la frase, e la
          produzione è il secondo gradino invece dell’ultimo: si ricorda meglio quando
          l’esercizio somiglia a quello che dovrai fare davvero. Con <b>Capire</b> parti dalla
          frase e ne cerchi il senso, e la produzione arriva alla fine.
        </p>
        <p class="small muted">Vale da qui in avanti: le carte già avviate restano dove sono.</p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Obiettivo di oggi</b><span class="pill">${cfg.dailyGoal} punti</span></div>
        <div class="grid">
          ${Goal.GOALS.map((g) => `
            <button class="chip-card${cfg.dailyGoal === g.xp ? ' chip-card--on' : ''}" data-goal="${g.xp}">
              <span class="chip-card__icon">${g.xp}</span><span>${esc(g.label)}</span>
            </button>`).join('')}
        </div>
        <p class="small muted">
          ${esc(Goal.goalOf(cfg.dailyGoal).hint)}. Dieci punti per ogni carta portata a termine —
          <b>giusta o sbagliata che sia</b> — più ${Goal.CLEARED_BONUS} una volta al giorno quando svuoti
          i ripassi in scadenza.
        </p>
        <p class="small muted">
          I punti si prendono per aver risposto, non per aver risposto bene: premiare la risposta
          giusta spingerebbe a scegliere gli esercizi facili, cioè il contrario di quello che serve.
          Un obiettivo esplicito e un po’ sopra la comodità è una delle poche leve motivazionali con
          basi solide; punti e serie di giorni servono a farti presentare, non a farti imparare.
        </p>
        <label class="switch">
          <span>Suoni di risposta</span>
          <input type="checkbox" ${cfg.sounds ? 'checked' : ''} data-toggle="sounds">
        </label>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Criterio di sessione</b></div>
        <div class="grid">
          <button class="chip-card${(cfg.criterion || 1) === 1 ? ' chip-card--on' : ''}" data-crit="1">
            <span class="chip-card__icon">1×</span><span>Una volta</span>
          </button>
          <button class="chip-card${(cfg.criterion || 1) === 2 ? ' chip-card--on' : ''}" data-crit="2">
            <span class="chip-card__icon">2×</span><span>Due volte</span>
          </button>
        </div>
        <p class="small muted">
          Quante volte devi azzeccare una carta prima che la sessione la lasci andare. Richiamarla
          due volte a distanza di qualche carta, e poi rivederla nei giorni successivi, è la
          combinazione che regge meglio a distanza di mesi: la seconda volta costa poco e rende
          molto. In cambio le sessioni si allungano.
        </p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Correzione</b></div>
        <label class="switch">
          <span>Voto automatico</span>
          <input type="checkbox" ${cfg.autoGrade ? 'checked' : ''} data-toggle="autoGrade">
        </label>
        <label class="switch">
          <span>Avanza da solo quando indovini</span>
          <input type="checkbox" ${cfg.autoNext ? 'checked' : ''} data-toggle="autoNext">
        </label>
        <p class="small muted">
          Quando hai indovinato non c’è niente da leggere: la carta successiva arriva da sé dopo
          un attimo, e toccando Avanti la anticipi. Quando sbagli si aspetta sempre, perché lì la
          correzione è l’unica parte che conta.
        </p>
        <p class="small muted">Il voto lo decide l’esito dell’esercizio, non il tuo giudizio: dopo aver visto la soluzione la si riconosce e la si scambia per un ricordo. Puoi comunque correggerlo a mano dopo ogni carta.</p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Voce</b></div>
        ${onlineVoiceRow(cfg)}
        <div class="card__head"><b>Voce del dispositivo</b><span class="muted small">di riserva</span></div>
        ${voiceChooser(cfg)}
        <label class="switch">
          <span>Dettare le risposte${Speech.supported ? '' : ' <em class="muted small">(non disponibile qui)</em>'}</span>
          <input type="checkbox" ${cfg.speechInput ? 'checked' : ''} ${Speech.supported ? '' : 'disabled'} data-toggle="speechInput">
        </label>
        <p class="small muted">${Speech.supported
          ? 'Nel passaggio di produzione puoi dire la frase invece di scriverla: viene trascritta e confrontata come una risposta scritta. Dirla ad alta voce, per conto suo, la fa ricordare meglio.'
          : 'Questo browser non trascrive la voce. Su iPhone funziona con Safari, da iOS 14.5.'}</p>
        <label class="switch">
          <span>Voce sintetica</span>
          <input type="checkbox" ${cfg.tts ? 'checked' : ''} data-toggle="tts">
        </label>
        <label class="field">
          <span>Velocità della voce <b class="val">${cfg.ttsRate.toFixed(2)}×</b></span>
          <input type="range" min="50" max="120" step="5" value="${Math.round(cfg.ttsRate * 100)}" data-set="ttsRate" data-scale="100">
        </label>
        <label class="field">
          <span>Tono <b class="val">${(cfg.ttsPitch ?? 1).toFixed(2)}</b></span>
          <input type="range" min="70" max="140" step="5" value="${Math.round((cfg.ttsPitch ?? 1) * 100)}" data-set="ttsPitch" data-scale="100">
        </label>
        <p class="small muted">
          Ogni lingua ha poi il suo ritmo: ${esc(lang.name)} viene letto al ${Math.round((lang.rate ?? 1) * 100)}% di questa velocità
          (${(cfg.ttsRate * (lang.rate ?? 1)).toFixed(2)}× in tutto). Durante lo studio il bottone
          👣 <b>Parola per parola</b> legge una parola alla volta, con una pausa vera in mezzo e la
          parola illuminata: e toccando una parola qualsiasi della frase si sente solo quella.
        </p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Dati</b></div>
        <button class="btn btn--ghost" data-act="export">Esporta un backup</button>
        <button class="btn btn--ghost" data-act="import">Importa un backup</button>
        <input type="file" accept="application/json" id="file" hidden>
        <button class="btn btn--danger" data-act="reset">Azzera ${esc(lang.name)}</button>
        <p class="small muted">Tutto è salvato solo su questo dispositivo. Il backup è un file JSON: tienilo da parte prima di cambiare telefono.</p>
      </div>

      <button class="btn btn--ghost small" data-act="why">Perché funziona</button>
    </section>`);

  on(el, '[data-set]', 'input', (e) => {
    const el2 = e.currentTarget;
    const scale = Number(el2.dataset.scale || 1);
    const value = Number(el2.value) / scale;
    Store.setSetting(el2.dataset.set, value);
    const label = el2.parentElement.querySelector('.val');
    if (label) {
      label.textContent = el2.dataset.set === 'retention' ? `${el2.value}%`
        : el2.dataset.set === 'ttsRate' ? `${value.toFixed(2)}×`
          : el2.dataset.set === 'ttsPitch' ? value.toFixed(2)
            : el2.value;
    }
  });
  on(el, '[data-toggle]', 'change', (e) => Store.setSetting(e.currentTarget.dataset.toggle, e.currentTarget.checked));
  on(el, '[data-online]', 'change', (e) => {
    Store.setSetting('online', { ...(settings().online || {}), [lang.code]: e.currentTarget.checked });
    onlineVoice = 'unknown';
    render();
    if (e.currentTarget.checked) testOnlineVoice();
  });
  on(el, '[data-act="test-online"]', 'click', () => testOnlineVoice());
  on(el, '[data-voice]', 'change', (e) => {
    const next = { ...(settings().voices || {}), [lang.code]: e.currentTarget.value };
    Store.setSetting('voices', next);
    speak(lang.sentences.find((s) => s.lv === 'A1')?.text || 'Test', { force: true });
  });
  on(el, '[data-act="try-voice"]', 'click', () => {
    const sample = lang.sentences.find((s) => s.lv === 'A1');
    speak(sample ? sample.text : 'Test', { force: true });
  });
  on(el, '[data-goal]', 'click', (e) => {
    Store.setSetting('dailyGoal', Number(e.currentTarget.dataset.goal));
    render();
  });
  on(el, '[data-crit]', 'click', (e) => {
    Store.setSetting('criterion', Number(e.currentTarget.dataset.crit));
    render();
  });
  on(el, '[data-dir]', 'click', (e) => {
    Store.setSetting('direction', e.currentTarget.dataset.dir);
    render();
  });
  on(el, '[data-dom]', 'click', (e) => {
    const id = e.currentTarget.dataset.dom;
    const next = new Set(settings().domains);
    next.has(id) ? next.delete(id) : next.add(id);
    Store.setSetting('domains', [...next]);
    e.currentTarget.classList.toggle('chip-card--on');
  });
  on(el, '[data-act="export"]', 'click', () => {
    const blob = new Blob([Store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `frasi-backup-${Store.dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const file = el.querySelector('#file');
  on(el, '[data-act="import"]', 'click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      Store.importJson(await f.text());
      render();
    } catch (err) {
      alert(`Non sono riuscito a leggere il backup: ${err.message}`);
    }
  });
  on(el, '[data-act="reset"]', 'click', () => {
    if (confirm(`Cancello tutti i progressi di ${lang.name}? Il backup, se ce l’hai, resta valido.`)) {
      Store.resetDeck(lang.code);
      go('home');
    }
  });
  on(el, '[data-act="why"]', 'click', () => go('science'));
  view.append(el);
}

/** Fa sentire una frase e mostra da dove è arrivata: online o dal telefono. */
async function testOnlineVoice() {
  const sample = lang.sentences.find((s) => s.lv === 'A1');
  if (!sample) return;
  stopSpeaking();
  await say(sample.text, {});
  if (screen === 'settings') render();
}

/** Voce online: una sintesi neurale gratuita al posto di quella del telefono. */
function onlineVoiceRow(cfg) {
  const on = Boolean(cfg.online?.[lang.code]);
  return `
    <label class="switch">
      <span>Voce online per ${esc(lang.name.toLowerCase())}</span>
      <input type="checkbox" ${on ? 'checked' : ''} data-online>
    </label>
    <p class="small muted">
      Usa la sintesi pubblica di Google Translate — la stessa che pronuncia le traduzioni sul
      loro sito — invece della voce installata sul telefono. È gratuita, non serve registrarsi,
      ed è una voce neurale: per il russo la differenza con la Milena compatta è netta.
      ${on ? `<br><b>${{
        failed: 'Non risponde: sto usando la voce del dispositivo. Riprovo alla prossima apertura.',
        ok: 'Funziona: l’ultimo ascolto è arrivato da lì.',
        unknown: 'Non l’ho ancora sentita: provala qui sotto.',
      }[onlineVoice]}</b>` : ''}
    </p>
    ${on ? '<button class="btn btn--icon" data-act="test-online">🔊 Prova la voce online</button>' : ''}
    <p class="small muted">
      Il prezzo, per intero: serve la connessione (senza rete si torna alla voce del telefono),
      la frase da leggere arriva ai server di Google, e non è un servizio documentato — può
      rallentare o smettere di funzionare, e in quel caso l’app ripiega da sola senza farti
      aspettare.
    </p>`;
}

/** Scelta della voce fra quelle installate sul dispositivo. */
function voiceChooser(cfg) {
  const list = Voices.forLocale(voices, lang.locale);
  const chosen = Voices.pick(voices, lang.locale, cfg.voices?.[lang.code]);

  if (!voices.length) {
    return '<p class="small muted">Sto ancora leggendo le voci installate. Se non compaiono, questo browser non ne espone.</p>';
  }
  if (!list.length) {
    return `<p class="small muted">Nessuna voce ${esc(lang.name.toLowerCase())} installata su questo dispositivo. ${
      Voices.isApple() ? 'Si aggiunge da Impostazioni ▸ Accessibilità ▸ Contenuto letto ▸ Voci.' : 'Dipende dal sistema, non dal browser.'}</p>`;
  }
  return `
    <label class="field">
      <span>Voce per ${esc(lang.name.toLowerCase())} <b class="val">${list.length} disponibili</b></span>
      <select class="select" data-voice>
        ${list.map((v) => `<option value="${esc(v.voiceURI)}"${v.voiceURI === chosen?.voiceURI ? ' selected' : ''}>${esc(Voices.label(v))}</option>`).join('')}
      </select>
    </label>
    <button class="btn btn--icon" data-act="try-voice">🔊 Prova questa voce</button>
    ${Voices.onlyPoor(voices, lang.locale) ? `
      <p class="small muted">
        Qui c’è solo la voce di base, quella scarna. ${Voices.isApple()
          ? 'Su iPhone le voci migliorate scaricate da Impostazioni ▸ Accessibilità ▸ Contenuto letto <b>quasi mai arrivano al browser</b>: Safari resta sulla voce compatta, e non c’è modo di forzarlo da qui.'
          : 'Le voci si installano dal sistema operativo: una volta aggiunte compaiono in questo elenco.'}
      </p>` : ''}
    <p class="small muted">
      La sintesi è quella del tuo dispositivo e l’app non può fare meglio di quello che c’è.
      Quando la voce non basta, serve a poco alzarla o rallentarla: usa
      👣 <b>Parola per parola</b>, che stacca una parola dall’altra e la illumina mentre la legge,
      e tocca le singole parole per risentirle. Su una lingua nuova il problema è capire dove
      finisce una parola, più che quanto suona naturale.
    </p>`;
}

/* ----------------------------- perché funziona --------------------------- */

const PAPERS = [
  ['Ripassare a intervalli crescenti batte il ripasso ravvicinato', 'Cepeda, Pashler, Vul, Wixted & Rohrer (2006), meta-analisi su 254 studi: a parità di tempo speso, distribuire le ripetizioni migliora la ritenzione a lungo termine.'],
  ['Richiamare è più efficace che rileggere', 'Roediger & Karpicke (2006), testing effect: provare a tirare fuori la risposta consolida più di riguardare la soluzione. Per questo qui si scrive prima di vedere.'],
  ['Riconoscere la risposta non è ricordarla', 'Koriat & Bjork (2005), illusione di competenza: dopo aver visto la soluzione sembra ovvia, e la si scambia per un ricordo. Dunlosky & Rawson (2012) misurano quanto chi si autocorregge si dia ragione più del dovuto. È il motivo per cui qui nessun esercizio si valuta da sé.'],
  ['Quello che produci resta più di quello che leggi', 'Slamecka & Graf (1978), effetto generazione: una parola tirata fuori da soli si ricorda meglio della stessa parola letta. Ogni gradino della scala chiede di generare un pezzo in più.'],
  ['L’impalcatura va tolta poco per volta', 'Renkl & Atkinson (2003), fading degli esempi svolti: l’aiuto si ritira mentre la competenza cresce. Qui i buchi del cloze aumentano man mano che la frase si consolida.'],
  ['Dirlo ad alta voce lo fissa meglio', 'MacLeod, Gopie, Hourihan, Neary & Ozubko (2010), production effect: pronunciare quello che si studia lo rende più memorabile del solo leggerlo. Per questo la produzione si può dettare, non solo scrivere.'],
  ['La difficoltà giusta è quella che costa', 'Bjork, desirable difficulties: la carta torna quando la probabilità di ricordarla è scesa intorno al 90%, non prima.'],
  ['Il modello della memoria a tre variabili', 'Ye et al. (2022-2024), FSRS: stabilità, difficoltà e recuperabilità, con curva di oblio a legge di potenza. È l’algoritmo che decide qui ogni intervallo.'],
  ['I parametri si rifanno sui tuoi dati, non restano quelli di tutti', 'Sempre FSRS: i 19 pesi di serie vengono da centinaia di milioni di ripetizioni altrui e sono pensati per essere riottimizzati sulla cronologia di chi studia. Da Progressi si rigioca il proprio registro e si cercano i pesi che spiegano meglio i propri ripassi.'],
  ['Una previsione va misurata, non creduta', 'La qualità di un modello probabilistico si giudica con la log-loss e con la calibrazione: se dice “85%” deve azzeccarci l’85% delle volte. Il grafico in Progressi mette il previsto accanto all’accaduto, fascia per fascia.'],
  ['Input comprensibile appena sopra il livello', 'Krashen (1985), ipotesi dell’input "i+1": le frasi nuove vengono pescate poco sopra il livello stimato, non a caso.'],
  ['Si impara a blocchi, non a parole', 'Wray (2002) e Ellis (2012) sulle formulaic sequences: le sequenze fisse si recuperano intere e portano con sé collocazioni e ordine delle parole.'],
  ['Prima si riconosce, poi si produce', 'Nation (2001): la conoscenza ricettiva precede quella produttiva. È la scala che segui se scegli "capire".'],
  ['L’esercizio deve somigliare a quello che vuoi saper fare', 'Morris, Bransford & Franks (1977), transfer-appropriate processing: si ricorda meglio quando le condizioni dello studio somigliano a quelle dell’uso. Se l’obiettivo è parlare, l’esercizio parte dall’italiano e chiede di tirare fuori la frase — non il contrario. È la scala "parlare", quella di partenza.'],
  ['Provarci prima di sapere aiuta, anche sbagliando', 'Richland, Kornell & Kao (2009) e Carpenter & Toftness (2017), prequestioning: tentare una risposta che non si può ancora conoscere migliora l’apprendimento di quello che arriva subito dopo. È il motivo per cui una frase nuova non viene mostrata: viene chiesta.'],
  ['Ricordare mentre altre risposte ti distraggono', 'L’abbinamento a inizio sessione non è un gioco messo lì per alleggerire: le cinque frasi sbagliate sono vere e stanno sullo schermo nello stesso momento, quindi il richiamo avviene sotto interferenza invece che contro tre opzioni pescate a caso. Ogni carta si prende il voto della sua coppia: al primo colpo, dopo un errore, dopo due.'],
  ['La stessa regola in frasi diverse, non la stessa frase', 'Variabilità della pratica: un punto grammaticale ancora fragile viene ripreso in un’altra frase, non ripetendo quella di prima. È così che diventa una regola invece che una frase imparata a memoria.'],
  ['La difficoltà va messa dove cede', 'I buchi del cloze si spostano sulle parole che hai già sbagliato su quella carta. Rendere difficile tutto non serve: serve rendere difficile il punto che non regge.'],
  ['Richiamare due volte in una sessione, e poi a distanza', 'Rawson & Dunlosky (2011) e Rawson, Dunlosky & Sciartelli (2013), successive relearning: portare ogni elemento a un criterio di richiamo dentro la sessione, e poi ripetere la cosa nelle sessioni successive, produce una tenuta a mesi di distanza molto superiore al richiamo singolo. È l’opzione "due volte" nelle impostazioni.'],
  ['Si capisce un testo quando se ne conoscono abbastanza parole', 'Nation, sulla copertura lessicale: la comprensione dipende dalla quota di parole note dentro un testo, e quella quota si costruisce per tipi diversi, non ripetendo gli stessi. Per questo i progressi contano le parole diverse incontrate, non le frasi.'],
  ['Un modello va guardato, non creduto', 'La curva dell’oblio in Progressi non è un’illustrazione: è la funzione che decide i tuoi intervalli, disegnata con i tuoi parametri, con segnata sopra la soglia a cui la carta torna.'],
  ['Un traguardo vicino tira più di uno lontano', 'Bandura & Schunk (1981) e la letteratura sui goal prossimali: un obiettivo raggiungibile in poco tempo regge la motivazione meglio di uno lontano. Il percorso spezza il corpus in unità da poche frasi, con un inizio e una fine visibili. Attenzione a che cosa fa e a che cosa non fa: ordina il materiale nuovo, non tocca le scadenze dei ripassi — quelle restano di FSRS, altrimenti il percorso mangerebbe il metodo.'],
  ['Il contesto che si ripete aiuta a costruire la regola', 'Le frasi di un’unità condividono livello e settore, quindi vocabolario e situazione. Il materiale legato costa meno da tenere insieme di dodici frasi scollegate, e la stessa struttura vista in contesti vicini diventa una regola invece che un pezzo imparato a memoria.'],
  ['Il test iniziale serve a qualcosa o non serve a niente', 'Se il livello viene misurato con un test adattivo, obbligare poi un B1 a ripartire da A1 rende la misura decorativa. Qui il cammino parte dal livello uscito dal test; le unità sotto restano aperte e dichiarate facoltative, da fare se si vuole.'],
  ['Mescolare gli argomenti conviene', 'Rohrer & Taylor (2007), interleaving: alternare tipi diversi di esercizio peggiora la sensazione immediata e migliora il risultato a distanza.'],
  ['Misurare il livello con poche domande giuste', 'Lord (1980) e van der Linden & Glas (2000), test adattivi su modello IRT: ogni domanda è scelta per essere massimamente informativa sul tuo θ.'],
  ['Una scala condivisa', 'Consiglio d’Europa, QCER (2001, aggiornato 2020): A1-C2 come riferimento per livelli e descrittori.'],
];

function paintScience() {
  setBar('Perché funziona', { back: () => go(Store.getLang() ? 'home' : 'welcome') });
  const el = h(`
    <section class="pad stack">
      <p class="lead">Niente di magico: solo quattro idee messe insieme, ognuna con dietro letteratura solida.</p>
      <div class="stack">
        ${PAPERS.map(([t, b]) => `
          <div class="card card--flat paper">
            <p class="paper__t">${esc(t)}</p>
            <p class="paper__b">${esc(b)}</p>
          </div>`).join('')}
      </div>
      <p class="small muted">I parametri di FSRS partono da quelli di default della versione 5, ottimizzati su dati aggregati. Da <b>Progressi ▸ Taratura del modello</b> si rifanno sui tuoi ripassi: sotto qualche centinaio la stima è rumorosa, e l’app lo dice invece di nasconderlo.</p>
    </section>`);
  view.append(el);
}

/* --------------------------------- avvio --------------------------------- */

document.addEventListener('keydown', (e) => {
  if (screen !== 'study' || !session) return;
  if (session.phase === 'ask') {
    if (e.key === 'Enter' && session.type !== 'cloze') { e.preventDefault(); check(); }
    else if (session.type === 'comp' && ['1', '2', '3', '4'].includes(e.key)) answerChoice(Number(e.key) - 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    commit(session.grade);
  } else if (['1', '2', '3', '4'].includes(e.key)) {
    commit(Number(e.key));
  }
});

const state = Store.getState();
screen = state.lang ? 'home' : 'welcome';
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
