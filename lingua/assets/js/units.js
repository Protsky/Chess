/*
 * units.js — il percorso: le frasi in unità tematiche invece che in una coda
 * piatta.
 *
 * Perché un percorso, se lo scheduler sa già che cosa serve adesso?
 *
 *  - Struttura visibile. Una coda infinita non dice mai a che punto si è.
 *    Un percorso segna l'inizio e la fine di un pezzo di lavoro: è il
 *    "goal proximal" della letteratura sugli obiettivi (Bandura & Schunk 1981),
 *    che regge la motivazione meglio dell'obiettivo lontano.
 *  - Materiale legato. Le frasi di un'unità condividono livello e settore,
 *    quindi condividono vocabolario e situazione: il contesto ricorrente aiuta
 *    a costruire lo schema invece di dodici frasi scollegate.
 *
 * Che cosa il percorso NON fa: non tocca i ripassi. Le scadenze restano di
 * FSRS, sempre e comunque. Il percorso governa soltanto l'ORDINE in cui il
 * materiale nuovo entra — dove Duolingo mette in fila anche i richiami, qui
 * la fila è solo per le prime volte.
 *
 * E non rimette in cella chi sa già: le unità dei livelli fino a quello
 * misurato dal test iniziale nascono aperte. Il test è una misura, non un
 * ornamento — sarebbe assurdo farlo e poi obbligare un B1 a ricominciare da A1.
 */

import { DOMAINS, levelIndex } from './corpus.js';
import { REVIEW } from './fsrs.js';

/** Quante frasi al massimo in un'unità: un pezzo di lavoro di pochi giorni. */
export const UNIT_SIZE = 10;
/** Sotto questa soglia un gruppo è troppo magro per stare da solo. */
export const MIN_UNIT = 4;
/** Quanta parte di un'unità va imparata perché la successiva si apra. */
export const UNLOCK = 0.6;

const sidOf = (cardId) => cardId.split('|')[0];

const domIndex = (id) => {
  const i = DOMAINS.findIndex((d) => d.id === id);
  return i < 0 ? DOMAINS.length : i;
};

const domInfo = (id) => DOMAINS.find((d) => d.id === id) || { id, label: 'Un po’ di tutto', icon: '🧺' };

/*
 * Dentro un livello i settori scelti dall'utente vengono per primi, poi la
 * vita quotidiana, poi il resto. Il percorso non annulla il settore: lo mette
 * in fila. Chi studia per lavoro incontra le unità di lavoro subito, non fra
 * quattro unità.
 *
 * Il criterio non è il nome dell'unità ma quante delle sue frasi toccano un
 * settore scelto, anche come settore secondario: così un'unità "vita
 * quotidiana" piena di frasi da viaggio sale lo stesso.
 */
const domRank = (id) => (id === 'misto' ? 3 : id === 'generale' ? 1 : 2);

const hitRate = (rows, domains) => {
  if (!domains || !domains.length) return 0;
  return rows.filter((r) => r.dom.some((d) => domains.includes(d))).length / rows.length;
};

/** Il settore che dà il nome all'unità: il primo dichiarato dalla frase. */
const primaryDom = (s) => (s.dom && s.dom.length ? s.dom[0] : 'generale');

/**
 * Spezza un gruppo in pezzi il più possibile uguali, nessuno più lungo di
 * UNIT_SIZE. Meglio 7+6 che 10+3: un'unità di tre frasi sembra un errore.
 */
function chunk(rows, size = UNIT_SIZE) {
  if (rows.length <= size) return [rows];
  const pieces = Math.ceil(rows.length / size);
  const base = Math.floor(rows.length / pieces);
  const extra = rows.length % pieces;
  const out = [];
  let i = 0;
  for (let p = 0; p < pieces; p++) {
    const take = base + (p < extra ? 1 : 0);
    out.push(rows.slice(i, i + take));
    i += take;
  }
  return out;
}

const cache = new Map();

/**
 * Costruisce il percorso di una lingua: livello per livello, settore per
 * settore, in ordine fisso. Deterministico — lo stesso corpus dà sempre lo
 * stesso percorso, altrimenti il percorso si riordinerebbe sotto i piedi.
 */
export function buildUnits(lang, domains = []) {
  const picked = [...new Set(domains)].sort();
  const key = `${lang.code}|${picked.join(',')}`;
  if (cache.has(key)) return cache.get(key);

  const buckets = new Map();
  for (const s of lang.sentences) {
    const key = `${s.lv}|${primaryDom(s)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  }

  const byLevel = new Map();
  for (const [key, rows] of buckets) {
    const [lv, dom] = key.split('|');
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push({ dom, rows });
  }

  const units = [];
  const levels = [...byLevel.keys()].sort((a, b) => levelIndex(a) - levelIndex(b));
  for (const lv of levels) {
    const groups = byLevel.get(lv)
      .map((g) => ({ ...g, hit: hitRate(g.rows, picked) }))
      .sort((a, b) => b.hit - a.hit || domRank(a.dom) - domRank(b.dom) || domIndex(a.dom) - domIndex(b.dom));
    /* I gruppi troppo magri di un livello si fondono in un'unità mista, in
     * ordine di settore: meglio una "un po' di tutto" che tre unità da due. */
    const solid = groups.filter((g) => g.rows.length >= MIN_UNIT);
    const thin = groups.filter((g) => g.rows.length < MIN_UNIT).flatMap((g) => g.rows);
    const ordered = [...solid];
    if (thin.length >= MIN_UNIT) {
      const mixed = { dom: 'misto', rows: thin, hit: hitRate(thin, picked) };
      const at = ordered.findIndex((g) => g.hit < mixed.hit);
      ordered.splice(at < 0 ? ordered.length : at, 0, mixed);
    } else if (thin.length && ordered.length) {
      ordered[ordered.length - 1].rows.push(...thin);
    } else if (thin.length) {
      ordered.push({ dom: 'misto', rows: thin });
    }

    for (const g of ordered) {
      const pieces = chunk(g.rows);
      pieces.forEach((rows, n) => {
        const info = domInfo(g.dom);
        units.push({
          id: `${lv}-${g.dom}-${n + 1}`,
          level: lv,
          dom: g.dom,
          icon: info.icon,
          title: pieces.length > 1 ? `${info.label} ${n + 1}` : info.label,
          sentences: rows,
        });
      });
    }
  }

  units.forEach((u, i) => { u.index = i; });
  cache.set(key, units);
  return units;
}

/** Per ogni frase del mazzo: se è stata toccata e se è uscita dall'apprendimento. */
function deckIndex(deck) {
  const map = new Map();
  for (const [id, card] of Object.entries(deck.cards)) {
    const sid = sidOf(id);
    const row = map.get(sid) || { seen: 0, learned: false, ripe: 0 };
    row.seen += 1;
    if (card.state === REVIEW) { row.learned = true; row.ripe += 1; }
    map.set(sid, row);
  }
  return map;
}

/**
 * Stato di un'unità: quante frasi sono state viste, quante sono uscite
 * dall'apprendimento. "Imparata" qui vuol dire che almeno una carta della
 * frase è in ripasso — non che sia sistemata per sempre: quello lo decide
 * FSRS, giorno per giorno.
 */
export function unitProgress(unit, index) {
  let seen = 0;
  let learned = 0;
  let ripe = 0;
  for (const s of unit.sentences) {
    const row = index.get(s.id);
    if (!row) continue;
    seen += 1;
    ripe += row.ripe;
    if (row.learned) learned += 1;
  }
  const total = unit.sentences.length;
  return {
    total,
    seen,
    learned,
    ripe,
    percent: total ? Math.round((learned / total) * 100) : 0,
    done: total > 0 && learned === total,
  };
}

/**
 * Il percorso con lo stato di ogni unità.
 *
 * Il punto di partenza non è la prima unità: è la prima del livello misurato
 * dal test. Tutto quello che sta sotto resta aperto ma fuori dal cammino —
 * materiale facoltativo, buono da riprendere, non un pedaggio da pagare.
 * Da lì in avanti si procede in fila: un'unità apre la successiva quando è
 * imparata almeno per UNLOCK.
 *
 * `userLevel` è il livello come numero continuo (0 = A1): lo stesso che usa
 * lo scheduler per l'"i+1".
 */
export function pathState(lang, deck, userLevel = 1, domains = []) {
  const units = buildUnits(lang, domains);
  const index = deckIndex(deck);
  const floor = Math.floor(Math.max(0, userLevel));

  const rows = units.map((u) => ({ ...u, ...unitProgress(u, index) }));

  /* Dove comincia il cammino: la prima unità del livello misurato. */
  let start = rows.findIndex((u) => levelIndex(u.level) >= floor);
  if (start < 0) start = Math.max(0, rows.length - 1);

  let previousOpens = true;
  rows.forEach((u, i) => {
    if (i < start) {
      /* Sotto il livello misurato: aperto, ma non è il cammino. */
      u.open = true;
      u.behind = true;
      return;
    }
    u.behind = false;
    u.open = i === start || previousOpens || u.seen > 0;
    /* La successiva si apre quando questa è imparata abbastanza, oppure
     * quando è stata vista tutta: altrimenti un'unità introdotta ieri e non
     * ancora matura lascerebbe la coda senza niente di nuovo da dare. */
    previousOpens = u.open && (u.percent >= UNLOCK * 100 || (u.total > 0 && u.seen === u.total));
  });

  /* L'unità "attiva" è la prima del cammino non ancora finita: è quella da
   * cui conviene pescare le frasi nuove. */
  let active = rows.findIndex((u, i) => i >= start && u.open && !u.done);
  if (active < 0) active = rows.length - 1;

  return {
    units: rows,
    start,
    active,
    unit: rows[active] || null,
    openCount: rows.filter((u) => u.open && !u.behind).length,
    doneCount: rows.filter((u) => u.done).length,
  };
}

/**
 * Le frasi da cui il percorso permette di pescare adesso.
 *
 * `allowed` è l'unità in corso più quelle già aperte davanti: una sola unità
 * per volta lascerebbe la giornata a corto di novità appena l'unità è finita,
 * e il tetto di frasi nuove non verrebbe rispettato. `focus` è la sola unità
 * in corso, che nel punteggio pesa di più.
 *
 * Con `unitId` si guarda una sola unità: serve quando si sceglie un'unità a
 * mano dal percorso, comprese quelle sotto il livello misurato.
 */
export function newPool(lang, deck, userLevel, domains = [], unitId = null) {
  const path = pathState(lang, deck, userLevel, domains);
  const allowed = new Set();
  const focus = new Set();

  if (unitId) {
    const one = path.units.find((u) => u.id === unitId);
    if (one) {
      for (const s of one.sentences) { allowed.add(s.id); focus.add(s.id); }
      return { allowed, focus, path };
    }
  }

  let lookahead = true;
  for (const u of path.units) {
    /* Le unità sotto il livello misurato restano fuori dal pescaggio
     * automatico: sono facoltative, si aprono toccandole nel percorso. */
    if (u.behind || u.index < path.active) continue;
    if (!u.open) {
      /* Una sola unità di riserva oltre quelle aperte. Il giorno in cui
       * l'unità in corso finisce, senza riserva la giornata resterebbe sotto
       * il tetto di frasi nuove; domani si aprirebbe comunque, visto che
       * "vista per intero" basta a sbloccare. */
      if (!lookahead) break;
      lookahead = false;
    }
    for (const s of u.sentences) {
      allowed.add(s.id);
      if (u.index === path.active) focus.add(s.id);
    }
  }
  return { allowed, focus, path };
}
