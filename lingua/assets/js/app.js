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
import { createScheduler, GRADES, REVIEW, NEW } from './fsrs.js';
import { buildQueue, splitId, TYPES, nextDue, targetLevel } from './scheduler.js';
import { diff } from './check.js';
import * as Ex from './exercises.js';
import * as Speech from './speech.js';

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
const scheduler = () => createScheduler({ requestRetention: settings().retention });

/* --------------------------------- audio -------------------------------- */

let voices = [];
const loadVoices = () => {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
};
if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function speak(text, force = false) {
  if (!window.speechSynthesis || !lang) return;
  if (!force && !settings().tts) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang.locale;
    u.rate = settings().ttsRate;
    const base = lang.locale.slice(0, 2);
    const voice = voices.find((v) => v.lang === lang.locale) || voices.find((v) => v.lang.startsWith(base));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* qualche browser blocca la sintesi finché non c'è un tocco: pazienza */
  }
}

/* ------------------------------ navigazione ----------------------------- */

const TABS = [
  { id: 'home', label: 'Studia', icon: '◎' },
  { id: 'explore', label: 'Esplora', icon: '⌗' },
  { id: 'stats', label: 'Progressi', icon: '▤' },
  { id: 'settings', label: 'Impostazioni', icon: '⚙' },
];

function go(next) {
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
  const cov = Stats.levelCoverage(deck, lang);
  const seen = cov.reduce((a, c) => a + c.done, 0);
  const upcoming = nextDue(deck);

  setBar(`${lang.flag} ${lang.name}`, { action: { label: 'Cambia', fn: () => go('pickLang') } });

  const el = h(`
    <section class="pad stack">
      <div class="row">
        <div class="stat">
          <div class="stat__n">${deck.profile.cefr || '—'}</div>
          <div class="stat__l">livello</div>
        </div>
        <div class="stat">
          <div class="stat__n">${streak}</div>
          <div class="stat__l">giorni di fila</div>
        </div>
        <div class="stat">
          <div class="stat__n">${seen}</div>
          <div class="stat__l">frasi viste</div>
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
  view.append(el);
}

/* ------------------------------- sessione -------------------------------- */

function startSession({ extraNew = 0 } = {}) {
  const deck = Store.getDeck(lang.code);
  const cfg = settings();
  const day = Store.today(lang.code);
  const { queue } = buildQueue({
    lang,
    deck,
    settings: { ...cfg, newPerDay: cfg.newPerDay + extraNew },
    introducedToday: day.introduced,
  });
  if (!queue.length) return;
  session = {
    queue,
    index: 0,
    done: 0,
    again: 0,
    startedAt: Date.now(),
    sentences: new Map(lang.sentences.map((s) => [s.id, s])),
  };
  prepare();
  go('study');
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
  session.heard = null;
  session.micError = null;
  session.listening = false;

  if (type === 'comp') session.ex = Ex.buildChoice(sentence, lang, seed);
  else if (type === 'build') {
    session.ex = Ex.buildTiles(sentence, lang, seed);
    session.picked = [];
  } else if (type === 'cloze') {
    session.ex = Ex.buildCloze(sentence, card, seed);
    session.filled = session.ex.parts.filter((x) => x.blank).map(() => '');
  } else {
    session.ex = null;
    session.answer = '';
  }
}

/* ------------------------------ correzione ------------------------------- */

/** Confronto di un cloze: ogni buco separato, più un esito complessivo. */
function checkCloze(parts, filled) {
  const blanks = parts.filter((p) => p.blank);
  const rows = blanks.map((p, i) => ({ ...diff(p.answer, filled[i] || ''), answer: p.answer, given: filled[i] || '' }));
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
  session.result = result;
  session.grade = Ex.autoGrade(result);
  session.phase = 'done';
  render();
  window.scrollTo(0, 0); // la correzione va letta dall'inizio
}

function check() {
  const s = session.sentence;
  if (session.type === 'build') {
    const given = session.picked.map((i) => session.ex.tiles[i]).join(' ');
    settle(diff(s.text, given));
  } else if (session.type === 'cloze') {
    settle(checkCloze(session.ex.parts, session.filled));
  } else if (session.type === 'prod') {
    settle(diff(s.text, session.answer));
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
      const best = Speech.bestOf(alternatives, (text) => diff(target, text));
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
        <span class="pill pill--${type}">${meta.icon} ${meta.label}</span>
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
    // la traduzione è già nella domanda in ogni esercizio: qui non si ripete,
    // e la frase giusta torna solo dove non è già sotto gli occhi
    const repeat = type === 'build' || type === 'prod';
    body.append(h(`
      <div class="reveal">
        ${repeat ? `<p class="solution">${esc(sentence.text)}</p>` : ''}
        ${sentence.de ? `<p class="bridge"><span>${esc(lang.bridge || 'Standard')}</span>${esc(sentence.de)}</p>` : ''}
        <p class="note"><b>${esc(sentence.g)}</b> — ${esc(sentence.note)}</p>
        <div class="tags">${sentence.dom.map((d) => `<span class="tag">${esc(DOMAINS.find((x) => x.id === d)?.label || d)}</span>`).join('')}</div>
        ${type === 'comp' ? '' : '<button class="btn btn--icon" data-act="say">🔊 Ascolta</button>'}
      </div>`));
    foot.append(gradeBar(card));
  }

  on(el, '[data-act="say"]', 'click', () => speak(sentence.text, true));
  on(el, '[data-act="check"]', 'click', () => check());
  on(el, '[data-act="next"]', 'click', () => commit(session.grade));
  on(el, '[data-act="other"]', 'click', () => { session.showGrades = true; render(); });
  on(el, '[data-grade]', 'click', (e) => commit(Number(e.currentTarget.dataset.grade)));
}

/** Riga dei voti: uno solo, già deciso, salvo ripensamenti. */
function gradeBar(card) {
  const preview = scheduler().preview(card);
  const labels = { 1: 'Di nuovo', 2: 'Difficile', 3: 'Bene', 4: 'Facile' };
  if (!session.showGrades) {
    return h(`
      <div class="stack">
        <button class="btn btn--primary" data-act="next">
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
  body.append(h(`
    <div class="stack center">
      <p class="target">${esc(sentence.text)}</p>
      <button class="btn btn--icon" data-act="say">🔊 Riascolta</button>
      ${done ? '' : '<p class="muted small">Quale traduzione è la sua?</p>'}
    </div>`));
  speak(sentence.text);

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
  const line = h(`<p class="target target--cloze">${session.ex.parts.map((p) => {
    if (!p.blank) return `<span>${esc(p.text)}</span>`;
    blank += 1;
    const row = done ? session.result.rows[blank] : null;
    if (done) {
      return `<span class="slot slot--${row.correct ? 'ok' : 'ko'}">${esc(p.answer)}</span>`;
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
      : `Mancano ${session.ex.blanks} pezzi su ${session.ex.total} parole.`}</p>`));
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
  body.append(h(`
    <div class="stack center">
      <p class="hint hint--big">${esc(sentence.it)}</p>
      ${done ? '' : '<p class="muted small">Scrivila per intero, o dettala.</p>'}
    </div>`));

  if (!done) {
    const input = h(`<input class="input" type="text" inputmode="text" autocapitalize="none" autocomplete="off"
      autocorrect="off" spellcheck="false" placeholder="scrivi la frase" value="${esc(session.answer)}">`);
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

function commit(grade) {
  const card = currentCard();
  const sch = scheduler();
  const now = Date.now();
  const wasReview = card.state === REVIEW;
  const isNew = card.state === NEW;
  const next = sch.review(card, grade, now);

  Store.saveCard(next, lang.code);
  Store.logReview({
    t: now,
    id: card.id,
    type: session.type,
    g: grade,
    auto: grade === session.grade,
    wasReview,
    isNew,
    ivl: next.ivl,
    s: Number(next.s.toFixed(3)),
    d: Number(next.d.toFixed(2)),
  }, lang.code);

  session.done += 1;
  if (grade === 1) session.again += 1;

  // carta ancora in apprendimento: torna in coda dentro la sessione
  if (next.state === 'learning' || next.state === 'relearning') {
    const at = Math.min(session.index + 3, session.queue.length);
    session.queue.splice(at, 0, next);
  }

  session.index += 1;
  if (session.index >= session.queue.length) return go('done');
  prepare();
  render();
}

function endSession() {
  stopMic?.();
  if (!session) return go('home');
  go(session.done ? 'done' : 'home');
}

function paintDone() {
  const s = session;
  session = null;
  setBar('Sessione finita');
  const minutes = s ? Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)) : 0;
  const accuracy = s && s.done ? Math.round(((s.done - s.again) / s.done) * 100) : 0;
  const deck = Store.getDeck(lang.code);
  const up = nextDue(deck);
  const el = h(`
    <section class="pad stack">
      <div class="done">
        <div class="done__mark">✓</div>
        <h2>${s ? plural(s.done, 'carta ripassata', 'carte ripassate') : 'Fatto'}</h2>
        <p class="muted">${minutes} min · ${accuracy}% al primo colpo</p>
      </div>
      <div class="card card--flat">
        <p class="small muted">${up ? `Il prossimo ripasso è fra ${humanDelay(up - Date.now())}. Le carte tornano poco prima che tu le dimentichi: è lì che ripassare rende di più.` : 'Nessun ripasso in programma.'}</p>
      </div>
      <button class="btn btn--primary" data-act="home">Torna alla home</button>
      <button class="btn btn--ghost" data-act="stats">Guarda i progressi</button>
    </section>`);
  on(el, '[data-act="home"]', 'click', () => go('home'));
  on(el, '[data-act="stats"]', 'click', () => go('stats'));
  view.append(el);
}

/* -------------------------------- esplora -------------------------------- */

let filter = { lv: '', dom: '', q: '' };

function paintExplore() {
  const deck = Store.getDeck(lang.code);
  const introduced = new Set(Object.keys(deck.cards).map((id) => splitId(id).sid));
  const q = filter.q.trim().toLowerCase();
  const rows = lang.sentences.filter((s) =>
    (!filter.lv || s.lv === filter.lv)
    && (!filter.dom || s.dom.includes(filter.dom))
    && (!q || s.text.toLowerCase().includes(q) || s.it.toLowerCase().includes(q) || s.g.toLowerCase().includes(q)));

  setBar('Esplora il corpus');
  const el = h(`
    <section class="pad stack">
      <input class="input" id="q" type="search" placeholder="cerca una frase, una parola, una regola" value="${esc(filter.q)}">
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
  on(el, '[data-lv]', 'click', (e) => { filter.lv = e.currentTarget.dataset.lv; render(); });
  on(el, '[data-dom]', 'click', (e) => { filter.dom = e.currentTarget.dataset.dom; render(); });
  on(el, '[data-say]', 'click', (e) => speak(e.currentTarget.dataset.say, true));
  view.append(el);
}

/* ------------------------------- progressi ------------------------------- */

function bars(rows, key, height = 54) {
  const max = Math.max(1, ...rows.map((r) => r[key]));
  return `<div class="chart" style="--h:${height}px">
    ${rows.map((r) => `
      <div class="chart__col" title="${r.label}: ${r[key]}">
        <i style="height:${Math.round((r[key] / max) * 100)}%"></i>
        <span>${r.label}</span>
      </div>`).join('')}
  </div>`;
}

function paintStats() {
  const deck = Store.getDeck(lang.code);
  const cfg = settings();
  const ret = Stats.trueRetention(deck.log, 30);
  const states = Stats.stateCounts(deck.cards);
  const gram = Stats.grammarProgress(deck, lang).slice(0, 10);
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

      <div class="card card--flat">
        <div class="card__head"><b>Ultimi 14 giorni</b><span class="muted small">ripassi</span></div>
        ${bars(Stats.reviewsByDay(deck.log, 14), 'total')}
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Carico in arrivo</b><span class="muted small">prossimi 14 giorni</span></div>
        ${bars(Stats.forecast(deck.cards, 14), 'total')}
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Composizione del mazzo</b><span class="muted small">${states.total} carte</span></div>
        <div class="split">
          <span class="split__seg split__seg--learn" style="flex:${states.learning || 0.001}"></span>
          <span class="split__seg split__seg--young" style="flex:${states.young || 0.001}"></span>
          <span class="split__seg split__seg--mature" style="flex:${states.mature || 0.001}"></span>
        </div>
        <div class="legend">
          <span><i class="dot dot--learn"></i>${states.learning} in apprendimento</span>
          <span><i class="dot dot--young"></i>${states.young} giovani</span>
          <span><i class="dot dot--mature"></i>${states.mature} mature (oltre 21 g)</span>
        </div>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Grammatica coperta</b></div>
        ${gram.length ? gram.map((g) => `
          <div class="levels__row">
            <span class="levels__lv levels__lv--wide">${esc(g.g)}</span>
            <span class="levels__bar"><i style="width:${Math.round((g.seen / g.total) * 100)}%"></i></span>
            <span class="levels__n muted small">${g.seen}/${g.total}</span>
          </div>`).join('') : '<p class="muted small">Ancora niente: comincia una sessione.</p>'}
      </div>

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
  view.append(el);
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
        <div class="card__head"><b>Correzione</b></div>
        <label class="switch">
          <span>Voto automatico</span>
          <input type="checkbox" ${cfg.autoGrade ? 'checked' : ''} data-toggle="autoGrade">
        </label>
        <p class="small muted">Il voto lo decide l’esito dell’esercizio, non il tuo giudizio: dopo aver visto la soluzione la si riconosce e la si scambia per un ricordo. Puoi comunque correggerlo a mano dopo ogni carta.</p>
      </div>

      <div class="card card--flat">
        <div class="card__head"><b>Voce</b></div>
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
          <input type="range" min="60" max="120" step="5" value="${Math.round(cfg.ttsRate * 100)}" data-set="ttsRate" data-scale="100">
        </label>
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
          : el2.value;
    }
  });
  on(el, '[data-toggle]', 'change', (e) => Store.setSetting(e.currentTarget.dataset.toggle, e.currentTarget.checked));
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
  ['Input comprensibile appena sopra il livello', 'Krashen (1985), ipotesi dell’input "i+1": le frasi nuove vengono pescate poco sopra il livello stimato, non a caso.'],
  ['Si impara a blocchi, non a parole', 'Wray (2002) e Ellis (2012) sulle formulaic sequences: le sequenze fisse si recuperano intere e portano con sé collocazioni e ordine delle parole.'],
  ['Prima si riconosce, poi si produce', 'Nation (2001): la conoscenza ricettiva precede quella produttiva. Le tre carte per frase seguono questa scala.'],
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
      <p class="small muted">I parametri di FSRS usati qui sono quelli di default della versione 5, ottimizzati su dati aggregati: valgono come punto di partenza per chiunque. Un algoritmo tarato sulla tua cronologia richiederebbe qualche migliaio di ripassi tuoi.</p>
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
