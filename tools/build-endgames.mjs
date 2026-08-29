/*
 * build-endgames.mjs — genera la tavola dei finali a tre pezzi.
 *
 *   node tools/build-endgames.mjs
 *
 * Perché una tavola e non un motore: il livello 2 promette una correzione **per
 * esito**, non per «mossa preferita». Dire «questa mossa butta via la vittoria»
 * è una cosa che si può affermare solo conoscendo il risultato con gioco
 * perfetto di entrambi — cioè con una tavola. Con tre pezzi la si costruisce,
 * ed è piccola: qui dentro non c'è nessuna stima.
 *
 * Metodo: analisi retrograda classica.
 *   1. si marcano le posizioni illegali;
 *   2. si marcano i matti (nero al tratto, sotto scacco, senza mosse) a 0;
 *   3. si sale di semimossa in semimossa: il Bianco vince in d+1 se **una**
 *      mossa porta a un nero perdente in d; il Nero perde in d+1 se **tutte**
 *      le sue mosse portano a bianchi vincenti in al massimo d.
 * Si ferma quando un giro non cambia più niente.
 *
 * L'uscita è `assets/js/endgames-data.js`: due tavole compresse a corse (RLE)
 * e in base64, perché 512 kB per tavola non stanno in un'app che deve girare
 * offline da un telefono.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/js/endgames-data.js');

/* --------------------------- valori delle case --------------------------- */

export const ILLEGALE = 255;
export const NON_VINTA = 254;          // patta, o comunque non vinta dal Bianco

const riga = (s) => s >> 3;
const col = (s) => s & 7;
const dentro = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const casa = (r, c) => r * 8 + c;

const RE_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const TORRE_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ALFIERE_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

const vicini = (() => {
  const out = new Array(64);
  for (let s = 0; s < 64; s++) {
    const list = [];
    for (const [dr, dc] of RE_D) {
      const r = riga(s) + dr;
      const c = col(s) + dc;
      if (dentro(r, c)) list.push(casa(r, c));
    }
    out[s] = list;
  }
  return out;
})();

const adiacenti = (a, b) => vicini[a].includes(b);

/** Case raggiunte da un pezzo che scorre, fermandosi sui due re. */
function scorri(from, dirs, blocco1, blocco2) {
  const out = [];
  for (const [dr, dc] of dirs) {
    let r = riga(from) + dr;
    let c = col(from) + dc;
    while (dentro(r, c)) {
      const s = casa(r, c);
      out.push(s);
      if (s === blocco1 || s === blocco2) break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

/* ------------------------------- la tavola ------------------------------- */

const indice = (wk, pezzo, bk, stm) => ((wk * 64 + pezzo) * 64 + bk) * 2 + stm;
const BIANCO = 0;
const NERO = 1;
const DIMENSIONE = 64 * 64 * 64 * 2;

/** Case da cui il pezzo bianco attacca, con i re a fare da ostacolo. */
function attaccateDa(tipo, pezzo, wk, bk) {
  if (tipo === 'Q') return scorri(pezzo, [...TORRE_D, ...ALFIERE_D], wk, bk);
  return scorri(pezzo, TORRE_D, wk, bk);
}

function genera(tipo) {
  const t = new Uint8Array(DIMENSIONE).fill(NON_VINTA);
  const inizio = Date.now();

  /* 1. legalità */
  for (let wk = 0; wk < 64; wk++) {
    for (let pezzo = 0; pezzo < 64; pezzo++) {
      if (pezzo === wk) { for (let bk = 0; bk < 64; bk++) { t[indice(wk, pezzo, bk, 0)] = ILLEGALE; t[indice(wk, pezzo, bk, 1)] = ILLEGALE; } continue; }
      for (let bk = 0; bk < 64; bk++) {
        if (bk === wk || bk === pezzo || adiacenti(wk, bk)) {
          t[indice(wk, pezzo, bk, 0)] = ILLEGALE;
          t[indice(wk, pezzo, bk, 1)] = ILLEGALE;
          continue;
        }
        // se tocca al Bianco, il Nero non può già essere sotto scacco
        if (attaccateDa(tipo, pezzo, wk, bk).includes(bk)) t[indice(wk, pezzo, bk, BIANCO)] = ILLEGALE;
      }
    }
  }

  /* mosse del Nero: il re va dove non è attaccato, e può prendere il pezzo se indifeso */
  function mosseNere(wk, pezzo, bk) {
    const out = [];
    for (const to of vicini[bk]) {
      if (to === wk || adiacenti(to, wk)) continue;
      if (to === pezzo) {
        // cattura: legale solo se il pezzo non è difeso dal re bianco
        if (!adiacenti(pezzo, wk)) out.push({ pezzo: -1, bk: to });
        continue;
      }
      if (attaccateDa(tipo, pezzo, wk, to).includes(to)) continue;
      out.push({ pezzo, bk: to });
    }
    return out;
  }

  /* mosse del Bianco: re (non adiacente al re nero) e pezzo (non sul re) */
  function mosseBianche(wk, pezzo, bk) {
    const out = [];
    for (const to of vicini[wk]) {
      if (to === pezzo || to === bk || adiacenti(to, bk)) continue;
      out.push({ wk: to, pezzo });
    }
    for (const to of attaccateDa(tipo, pezzo, wk, bk)) {
      if (to === wk || to === bk) continue;
      out.push({ wk, pezzo: to });
    }
    return out;
  }

  /* 2. i matti: nero al tratto, senza mosse, con il re attaccato */
  let fronte = 0;
  for (let wk = 0; wk < 64; wk++) {
    for (let pezzo = 0; pezzo < 64; pezzo++) {
      for (let bk = 0; bk < 64; bk++) {
        const i = indice(wk, pezzo, bk, NERO);
        if (t[i] === ILLEGALE) continue;
        if (mosseNere(wk, pezzo, bk).length) continue;
        if (attaccateDa(tipo, pezzo, wk, bk).includes(bk)) { t[i] = 0; fronte += 1; }
        // senza scacco è stallo: resta NON_VINTA, che è la verità
      }
    }
  }

  /*
   * 3. si propaga finché un giro intero non cambia più niente.
   *
   * Nota su un errore già fatto e corretto: iterare «cerca i neri che valgono
   * esattamente d» sembra naturale ma si ferma subito, perché i valori del
   * Bianco sono dispari e quelli del Nero pari — un giro su due non trova mai
   * niente e il ciclo si chiude dopo due passate, con la tavola quasi vuota.
   * Qui si prende il **minimo** sulle mosse del Bianco e il **massimo** su
   * quelle del Nero, senza livelli: converge da sé, un guscio per passata.
   */
  let passate = 0;
  for (;;) {
    let cambiato = 0;
    passate += 1;

    // Bianco al tratto: vince in (miglior nero) + 1.
    for (let wk = 0; wk < 64; wk++) {
      for (let pezzo = 0; pezzo < 64; pezzo++) {
        for (let bk = 0; bk < 64; bk++) {
          const i = indice(wk, pezzo, bk, BIANCO);
          if (t[i] !== NON_VINTA) continue;
          let migliore = -1;
          for (const m of mosseBianche(wk, pezzo, bk)) {
            const v = t[indice(m.wk, m.pezzo, bk, NERO)];
            if (v === NON_VINTA || v === ILLEGALE) continue;
            if (migliore === -1 || v < migliore) migliore = v;
          }
          if (migliore >= 0) { t[i] = migliore + 1; cambiato += 1; }
        }
      }
    }

    // Nero al tratto: perde in (peggior bianco) + 1, ma solo se **tutte** le
    // sue mosse sono già risolte: finché una è ignota, la posizione lo resta.
    for (let wk = 0; wk < 64; wk++) {
      for (let pezzo = 0; pezzo < 64; pezzo++) {
        for (let bk = 0; bk < 64; bk++) {
          const i = indice(wk, pezzo, bk, NERO);
          if (t[i] !== NON_VINTA) continue;
          const mosse = mosseNere(wk, pezzo, bk);
          if (!mosse.length) continue;
          let peggiore = -1;
          let tutte = true;
          for (const m of mosse) {
            if (m.pezzo === -1) { tutte = false; break; }       // ha catturato: patta
            const v = t[indice(wk, m.pezzo, m.bk, BIANCO)];
            if (v === NON_VINTA || v === ILLEGALE) { tutte = false; break; }
            if (v > peggiore) peggiore = v;
          }
          if (tutte && peggiore >= 0) { t[i] = peggiore + 1; cambiato += 1; }
        }
      }
    }

    if (!cambiato) break;
    if (passate > 200) break;                                  // rete di sicurezza
  }

  const vinte = t.reduce((n, v) => n + (v !== ILLEGALE && v !== NON_VINTA ? 1 : 0), 0);
  const maxDtm = t.reduce((m, v) => (v !== ILLEGALE && v !== NON_VINTA && v > m ? v : m), 0);
  console.log(`  ${tipo}: ${vinte.toLocaleString('it-CH')} posizioni vinte, matto più lungo ${maxDtm} semimosse`
    + ` (${((Date.now() - inizio) / 1000).toFixed(1)} s)`);
  return t;
}


/* ------------------------------- simmetrie ------------------------------- */

/*
 * Senza pedoni la scacchiera ha otto simmetrie: le due specchiature, le
 * rotazioni e le trasposizioni lasciano il finale identico a se stesso. Quindi
 * di ogni posizione se ne tiene **una sola**, quella in cui il re bianco cade
 * nel triangolo a1-d1-d4 (dieci case), e la tavola si divide per sei.
 *
 * Non è un'ottimizzazione gratuita: senza, il file da spedire al telefono
 * pesava 3,5 MB.
 */
export const TRASFORMA = [
  (s) => s,
  (s) => casa(riga(s), 7 - col(s)),
  (s) => casa(7 - riga(s), col(s)),
  (s) => casa(7 - riga(s), 7 - col(s)),
  (s) => casa(col(s), riga(s)),
  (s) => casa(col(s), 7 - riga(s)),
  (s) => casa(7 - col(s), riga(s)),
  (s) => casa(7 - col(s), 7 - riga(s)),
];

/** Le dieci case del triangolo, nell'ordine in cui stanno nella tavola ridotta. */
export const TRIANGOLO = [0, 1, 2, 3, 9, 10, 11, 18, 19, 27].map((i) => casa(7 - Math.floor(i / 8), i % 8));

const POSTO = (() => {
  const out = new Int8Array(64).fill(-1);
  TRIANGOLO.forEach((s, i) => { out[s] = i; });
  return out;
})();

/** La forma canonica di una terna: la più piccola fra le otto trasformate. */
export function canonica(wk, pezzo, bk) {
  let best = null;
  for (const f of TRASFORMA) {
    const a = f(wk);
    if (POSTO[a] < 0) continue;
    const b = f(pezzo);
    const c = f(bk);
    if (!best || a < best[0] || (a === best[0] && (b < best[1] || (b === best[1] && c < best[2])))) best = [a, b, c];
  }
  return best;
}

export const indiceRidotto = (wk, pezzo, bk) => (POSTO[wk] * 64 + pezzo) * 64 + bk;

/** Dalla tavola intera a quella ridotta, controllando che le simmetrie tengano. */
function riduci(t, nome) {
  /*
   * Si tiene solo la metà con il **Nero al tratto**. L'altra metà non serve
   * spedirla: il valore di una posizione col Bianco al tratto è il minimo dei
   * valori delle posizioni che le sue mosse producono, più uno — un giro solo di
   * mosse, che a runtime costa niente. Metà tavola in meno da scaricare.
   */
  const out = new Uint8Array(10 * 64 * 64).fill(ILLEGALE);
  let controlli = 0;
  for (let wk = 0; wk < 64; wk++) {
    for (let pezzo = 0; pezzo < 64; pezzo++) {
      for (let bk = 0; bk < 64; bk++) {
        const c = canonica(wk, pezzo, bk);
        if (!c) continue;
        // La simmetria deve dare lo stesso valore: se non lo dà, la tavola è
        // sbagliata e va detto subito, non scoperto da chi studia.
        const valore = t[indice(wk, pezzo, bk, 1)];
        const canonico = t[indice(c[0], c[1], c[2], 1)];
        if (valore !== canonico) throw new Error(`${nome}: la simmetria non tiene su ${wk},${pezzo},${bk}`);
        out[indiceRidotto(c[0], c[1], c[2])] = canonico;
        controlli += 1;
      }
    }
  }
  console.log(`  ${nome}: ridotta a ${(out.length / 1024).toFixed(0)} kB grezzi (${controlli.toLocaleString('it-CH')} controlli di simmetria)`);
  return out;
}

/* ------------------------------ compressione ----------------------------- */

/*
 * Corse **solo dove convengono**: la tavola alterna lunghi tratti uguali
 * (posizioni illegali, zone non vinte) a tratti che cambiano a ogni casa. Una
 * corsa per ogni valore, come si fa di solito, triplicava il file invece di
 * ridurlo: qui una corsa si apre solo da tre ripetizioni in su, e il resto va
 * come sta. Il byte 253 non compare mai fra i valori (il matto più lungo è 32),
 * quindi può fare da segnale.
 */
const CORSA = 253;

function comprimi(t) {
  const out = [];
  let i = 0;
  while (i < t.length) {
    const v = t[i];
    let n = 1;
    while (i + n < t.length && t[i + n] === v && n < 65535) n += 1;
    if (n >= 3) out.push(CORSA, v, n & 0xff, n >> 8);
    else for (let k = 0; k < n; k++) out.push(v);
    i += n;
  }
  return Buffer.from(out).toString('base64');
}

/* ------------------------------- le partenze ----------------------------- */

/*
 * Le posizioni da cui si comincia si scelgono **qui**, non a runtime: qui la
 * tavola intera è ancora in memoria, quindi il valore col Bianco al tratto è
 * una lettura invece di un giro di mosse, e si può setacciare tutta la
 * scacchiera in un attimo.
 *
 * Criteri: vinta, Bianco al tratto, matto abbastanza lontano da essere una
 * tecnica e non un indovinello, e i tre pezzi sparsi — non sempre nello stesso
 * angolo, che era il difetto della prima versione.
 */
function partenze(t, tipo, { min = 13, max = 27, quante = 40 } = {}) {
  const candidate = [];
  for (let wk = 0; wk < 64; wk++) {
    for (let pezzo = 0; pezzo < 64; pezzo++) {
      for (let bk = 0; bk < 64; bk++) {
        const v = t[indice(wk, pezzo, bk, BIANCO)];
        if (v === ILLEGALE || v === NON_VINTA) continue;
        if (v < min || v > max) continue;
        candidate.push({ wk, pezzo, bk, dtm: v });
      }
    }
  }

  // ordine sparso ma sempre lo stesso: la posizione di ieri è quella di oggi
  const chiave = (c) => ((c.wk * 7919 + c.pezzo * 104729 + c.bk * 1299709) % 1000003);
  candidate.sort((a, b) => chiave(a) - chiave(b));

  // niente due posizioni troppo simili: si tiene una sola posizione per casa
  // del re nero, così il materiale copre la scacchiera invece di un angolo.
  const presi = [];
  const visti = new Set();
  for (const c of candidate) {
    if (visti.has(c.bk)) continue;
    visti.add(c.bk);
    presi.push({ tipo, fen: fen(c.wk, c.pezzo, tipo, c.bk), dtm: c.dtm });
    if (presi.length >= quante) break;
  }
  return presi;
}

const NOMI = 'abcdefgh';
const nomeCasa = (s) => NOMI[col(s)] + (8 - riga(s));

function fen(wk, pezzo, tipo, bk) {
  const board = new Array(64).fill(null);
  board[wk] = 'K';
  board[pezzo] = tipo;
  board[bk] = 'k';
  const righe = [];
  for (let r = 0; r < 8; r++) {
    let s = '';
    for (let c = 0; c < 8; c++) s += board[casa(r, c)] || '1';
    righe.push(s.replace(/1{2,}/g, (m) => String(m.length)));
  }
  return `${righe.join('/')} w - - 0 1`;
}

/* -------------------------------- scrittura ------------------------------ */

console.log('Genero le tavole (analisi retrograda)…');
const intere = { Q: genera('Q'), R: genera('R') };
const inizi = [...partenze(intere.Q, 'Q'), ...partenze(intere.R, 'R')];
console.log(`  partenze scelte: ${inizi.length} (matto fra ${Math.min(...inizi.map((x) => x.dtm))} e ${Math.max(...inizi.map((x) => x.dtm))} semimosse)`);
const tavole = { Q: riduci(intere.Q, 'Q'), R: riduci(intere.R, 'R') };

const testo = `/*
 * endgames-data.js — la tavola dei finali. GENERATO: non modificare a mano.
 *
 *   node tools/build-endgames.mjs
 *
 * Re+Donna contro Re e Re+Torre contro Re, risolti per intero con analisi
 * retrograda: per ogni posizione legale c'è il numero di semimosse che mancano
 * al matto con gioco perfetto, o il fatto che quella posizione non è vinta.
 * È la ragione per cui il livello 2 può correggere **per esito** invece che per
 * «mossa preferita»: qui non si stima niente.
 *
 * Formato: byte in base64, con corse marcate dal byte 253 (valore, lunghezza a
 * 16 bit) dove ripagano. Dentro c'è solo la metà **Nero al tratto**: quella col
 * Bianco al tratto si ricava in una mossa, e non vale la pena spedirla.
 * La posizione va prima portata in forma canonica (re bianco nel triangolo
 * a1-d1-d4), poi l'indice è:
 *   (posto del re bianco nel triangolo * 64 + pezzo) * 64 + re nero
 * Valori: ${ILLEGALE} illegale, ${NON_VINTA} non vinta, altrimenti semimosse al matto.
 */

export const ILLEGALE = ${ILLEGALE};
export const NON_VINTA = ${NON_VINTA};

/** Le dieci case del triangolo: l'ordine conta, è quello dell'indice. */
export const TRIANGOLO = ${JSON.stringify(TRIANGOLO)};

/**
 * Le posizioni da cui si comincia: vinte, Bianco al tratto, con il matto a
 * distanza di tecnica. Il campo dtm è il numero di semimosse al matto con gioco
 * perfetto — non una stima, il valore della tavola.
 */
export const PARTENZE = ${JSON.stringify(inizi)};

export const TAVOLE = {
  Q: '${comprimi(tavole.Q)}',
  R: '${comprimi(tavole.R)}',
};
`;

fs.writeFileSync(OUT, testo);
console.log(`\nScritte in ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`);
