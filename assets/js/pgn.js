/*
 * pgn.js — leggere le proprie partite, e dire che cosa non si è riusciti a leggere.
 *
 * Un lettore di PGN scritto per un'app che ha promesso di non affermare niente
 * che non abbia calcolato. Le conseguenze pratiche sono due, e sono entrambe
 * nella forma del risultato:
 *
 *  1. **Ogni partita scartata ha un motivo stampato.** «Ho letto 40 partite» su
 *     un file che ne contiene 52 è un'affermazione falsa detta senza mentire.
 *     Qui si dice: lette 40, scartate 12, e perché.
 *
 *  2. **Dal PGN si prendono solo mosse, orologi e tag standard.** Niente
 *     simboli di valutazione, niente nomi di categoria della piattaforma
 *     d'origine, niente scale altrui: un giudizio dato dal motore di qualcun
 *     altro non si può riscrivere come giudizio di questa app. Se serve un
 *     giudizio, lo calcola l'app, con il proprio motore e i propri limiti
 *     dichiarati.
 */

import { newGame, fromSan, applyMove, toSan, legalMoves } from './chess.js';

/** Le varianti che non sappiamo (e non vogliamo) giudicare. */
const VARIANTI_NOTE = new Set(['standard', 'chess', 'from position', '']);

/**
 * Spezza un file in partite. Una partita comincia con un blocco di tag e
 * finisce col risultato; fra due partite può esserci qualunque spaziatura.
 */
export function separa(testo) {
  const righe = String(testo).replace(/\r\n?/g, '\n').split('\n');
  const partite = [];
  let corrente = [];
  let dentroTag = false;

  for (const riga of righe) {
    const eTag = /^\s*\[/.test(riga);
    /* Un tag che arriva dopo delle mosse apre una partita nuova. */
    if (eTag && !dentroTag && corrente.some((r) => r.trim() && !/^\s*\[/.test(r))) {
      partite.push(corrente.join('\n'));
      corrente = [];
    }
    dentroTag = eTag;
    corrente.push(riga);
  }
  if (corrente.join('').trim()) partite.push(corrente.join('\n'));
  return partite.filter((p) => p.trim());
}

/** I tag fra parentesi quadre, come li scrive lo standard. */
export function tagDi(testo) {
  const out = {};
  const re = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
  let m = re.exec(testo);
  while (m) {
    out[m[1]] = m[2];
    m = re.exec(testo);
  }
  return out;
}

/**
 * Il corpo della partita, ripulito di quello che non ci serve.
 *
 * Le **varianti** fra parentesi tonde si tolgono per intero (annidate comprese):
 * sono mosse che non sono state giocate, e questa app guarda quello che è
 * successo davvero. Dai commenti si tiene solo l'orologio.
 */
export function mosseDi(testo) {
  let corpo = testo.replace(/\[\s*\w+\s*"[^"]*"\s*\]/g, ' ');

  /* Gli orologi si salvano prima di buttare i commenti. */
  const orologi = [];
  corpo = corpo.replace(/\{[^}]*\}/g, (commento) => {
    const clk = /%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(commento);
    orologi.push(clk ? (Number(clk[1]) * 3600 + Number(clk[2]) * 60 + Number(clk[3])) : null);
    return ` ${orologi.length - 1} `;
  });

  /* Le varianti annidate: si tolgono dall'interno verso l'esterno. */
  let prima;
  do {
    prima = corpo;
    corpo = corpo.replace(/\([^()]*\)/g, ' ');
  } while (corpo !== prima);

  corpo = corpo
    .replace(/;[^\n]*/g, ' ')          // commenti a fine riga
    .replace(/\$\d+/g, ' ')            // annotazioni numeriche (NAG)
    .replace(/\d+\s*\.(\.\.)?/g, ' ')  // numeri di mossa
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ');

  const gettoni = corpo.split(/\s+/).filter(Boolean);
  const mosse = [];
  let orologio = null;
  for (const g of gettoni) {
    const marca = /^(\d+)$/.exec(g);
    if (marca) {
      /* L'orologio nel commento si riferisce alla mossa appena giocata. */
      if (mosse.length) mosse[mosse.length - 1].clk = orologi[Number(marca[1])];
      continue;
    }
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(g)) continue;
    mosse.push({ san: g.replace(/[?!]+$/, ''), clk: orologio });
  }
  return mosse;
}

/**
 * Legge una partita e la rigioca sul motore. Se una mossa non è legale la
 * partita si ferma lì e lo dice: meglio mezza partita dichiarata che una
 * partita intera ricostruita a intuito.
 */
export function leggiPartita(testo) {
  const tag = tagDi(testo);
  const variante = String(tag.Variant || '').toLowerCase();
  if (!VARIANTI_NOTE.has(variante)) {
    return { ok: false, motivo: `variante non standard (${tag.Variant})`, tag };
  }

  const mosse = mosseDi(testo);
  if (!mosse.length) return { ok: false, motivo: 'nessuna mossa nel PGN', tag };

  let stato = tag.FEN ? null : newGame();
  if (tag.FEN) return { ok: false, motivo: 'partita da posizione, non dall’inizio', tag };

  const passi = [];
  for (const m of mosse) {
    const mossa = fromSan(stato, m.san);
    if (!mossa) {
      return {
        ok: false,
        motivo: `mossa non rigiocabile: ${m.san} alla semimossa ${passi.length + 1}`,
        tag,
        passi,
      };
    }
    passi.push({ stato, mossa, san: m.san, clk: m.clk, turno: stato.turn });
    stato = applyMove(stato, mossa);
  }

  return { ok: true, tag, passi, finale: stato, orologi: passi.some((p) => p.clk !== null) };
}

/**
 * Tutto il file, con il conto di quello che è entrato e di quello che no.
 *
 * `letti + scartati` deve sempre fare il numero di partite trovate: è la
 * proprietà che rende il riepilogo un'affermazione verificabile invece di una
 * rassicurazione.
 */
export function leggi(testo) {
  const blocchi = separa(testo);
  const partite = [];
  const scarti = [];

  for (const b of blocchi) {
    const p = leggiPartita(b);
    if (p.ok) partite.push(p);
    else scarti.push({ motivo: p.motivo, tag: p.tag });
  }

  const motivi = new Map();
  for (const s of scarti) {
    const chiave = s.motivo.replace(/\d+/g, 'N');
    motivi.set(chiave, (motivi.get(chiave) || 0) + 1);
  }

  return {
    trovate: blocchi.length,
    partite,
    scarti,
    motivi: [...motivi.entries()].map(([motivo, quante]) => ({ motivo, quante })),
    conOrologio: partite.filter((p) => p.orologi).length,
  };
}

/**
 * Da che parte giocava chi ha esportato il file.
 *
 * Non si indovina: si conta chi compare più spesso fra i due nomi, e se non
 * c'è un nome che domina si restituisce null e lo si chiede.
 */
export function giocatorePiuFrequente(partite) {
  const conta = new Map();
  for (const p of partite) {
    for (const chiave of ['White', 'Black']) {
      const nome = (p.tag[chiave] || '').trim();
      if (nome) conta.set(nome, (conta.get(nome) || 0) + 1);
    }
  }
  const ordinati = [...conta.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordinati.length) return null;
  if (ordinati.length > 1 && ordinati[0][1] === ordinati[1][1]) return null;
  return { nome: ordinati[0][0], partite: ordinati[0][1] };
}

export { legalMoves, toSan };
