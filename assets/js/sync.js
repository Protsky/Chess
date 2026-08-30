/*
 * sync.js — i progressi anche fuori da questo telefono.
 *
 * Regola che non cambia: **il dispositivo resta la copia principale**. L'app
 * funziona offline, e il deposito è una copia che si allinea quando c'è rete.
 * Non è un'app che smette di funzionare perché un server non risponde.
 *
 * Il codice di sedici caratteri è l'identità e la chiave insieme: chi ce l'ha
 * vede quei progressi. Lo si genera con `crypto.getRandomValues` (80 bit) e si
 * può leggere ad alta voce senza sbagliare — l'alfabeto di Crockford toglie
 * I, L, O e U proprio per quello.
 *
 * L'UNIONE, CHE È LA PARTE DIFFICILE
 * Due dispositivi che studiano lo stesso mazzo non si possono risolvere con
 * «vince l'ultimo che scrive»: chi ripassa sul telefono e poi apre il portatile
 * perderebbe la sessione. Quindi si uniscono, carta per carta:
 *
 *   - ogni carta ha il timestamp dell'ultimo ripasso: vince la più recente;
 *   - il registro si fonde per (carta, istante), senza doppioni;
 *   - punteggi e conteggi vengono dal salvataggio con più risposte, non dal più
 *     recente: sono cumulativi, e il più recente potrebbe essere il telefono
 *     appena reinstallato;
 *   - le impostazioni restano quelle del dispositivo su cui stai — sono
 *     preferenze, non progressi;
 *   - le aperture tengono il massimo di stelle e record, che è la loro regola
 *     da sempre.
 */

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODICE_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/;

/** Un codice nuovo, dal generatore crittografico del browser. */
export function nuovoCodice() {
  const byte = new Uint8Array(16);
  crypto.getRandomValues(byte);
  return Array.from(byte, (b) => ALFABETO[b % 32]).join('');
}

/** Normalizza quello che uno scrive a mano: maiuscole, niente spazi o trattini. */
export function pulisci(testo) {
  return String(testo || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export const valido = (codice) => CODICE_RE.test(pulisci(codice));

/* --------------------------------- rete ---------------------------------- */

const rotta = (codice) => `api/progressi/${encodeURIComponent(codice)}`;

/** Manda il salvataggio al deposito. Torna { ok, aggiornato } o { ok:false, motivo }. */
export async function spingi(codice, testoJson) {
  try {
    const risposta = await fetch(rotta(codice), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: testoJson,
    });
    const dati = await risposta.json().catch(() => ({}));
    if (!risposta.ok) return { ok: false, motivo: dati.errore || `errore ${risposta.status}` };
    return { ok: true, aggiornato: dati.aggiornato, byte: dati.byte };
  } catch (err) {
    return { ok: false, motivo: 'niente rete' };
  }
}

/** Chiede al deposito che cosa c'è sotto quel codice. */
export async function tira(codice) {
  try {
    const risposta = await fetch(rotta(codice), { headers: { accept: 'application/json' } });
    if (risposta.status === 404) return { ok: false, motivo: 'nessun progresso con questo codice' };
    if (!risposta.ok) {
      const dati = await risposta.json().catch(() => ({}));
      return { ok: false, motivo: dati.errore || `errore ${risposta.status}` };
    }
    return { ok: true, dati: await risposta.json(), aggiornato: risposta.headers.get('x-aggiornato') || null };
  } catch {
    return { ok: false, motivo: 'niente rete' };
  }
}

/* -------------------------------- l'unione -------------------------------- */

const risposteDi = (stato) => Object.values(stato?.counts || {}).reduce((n, c) => n + (c.done || 0), 0);

/**
 * Unisce due salvataggi. `locale` è quello di questo dispositivo, `remoto`
 * quello del deposito. Non modifica nessuno dei due.
 */
export function unisci(locale, remoto) {
  if (!remoto) return locale;
  if (!locale) return remoto;

  const out = structuredClone(locale);

  // Carte: vince quella ripassata più di recente. `last` è l'istante dell'ultimo
  // ripasso, ed è l'unica cosa che dice davvero quale delle due sa di più.
  out.cards = { ...(locale.cards || {}) };
  for (const [id, carta] of Object.entries(remoto.cards || {})) {
    const mia = out.cards[id];
    if (!mia || (carta.last || 0) > (mia.last || 0)) out.cards[id] = carta;
  }

  // Registro: unione senza doppioni, in ordine di tempo. La coppia (carta,
  // istante) identifica una risposta: la stessa carta non si risponde due volte
  // nello stesso millisecondo.
  const visti = new Set();
  const log = [];
  for (const voce of [...(locale.log || []), ...(remoto.log || [])]) {
    const chiave = `${voce.id}|${voce.t}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    log.push(voce);
  }
  log.sort((a, b) => (a.t || 0) - (b.t || 0));
  out.log = log.slice(-3000);

  // Punteggi e conteggi: dal salvataggio che ha risposto di più, non dal più
  // recente — un telefono appena reinstallato è recentissimo e non sa niente.
  const piuPratica = risposteDi(remoto) > risposteDi(locale) ? remoto : locale;
  out.rating = { ...(piuPratica.rating || {}) };
  out.counts = { ...(piuPratica.counts || {}) };

  // Aperture: la regola di sempre, il meglio delle due.
  out.progress = { ...(locale.progress || {}) };
  for (const [id, p] of Object.entries(remoto.progress || {})) {
    const mio = out.progress[id];
    out.progress[id] = mio
      ? {
        stars: Math.max(mio.stars || 0, p.stars || 0),
        best: Math.max(mio.best || 0, p.best || 0),
        attempts: Math.max(mio.attempts || 0, p.attempts || 0),
        lastAt: Math.max(mio.lastAt || 0, p.lastAt || 0),
      }
      : p;
  }

  // Pesi tarati: quelli fatti su più ripassi.
  const fsrsRemoto = remoto.fsrs || {};
  const fsrsLocale = locale.fsrs || {};
  out.fsrs = (fsrsRemoto.reviews || 0) > (fsrsLocale.reviews || 0) ? fsrsRemoto : fsrsLocale;

  // Serie e conteggi del giorno: il giorno più avanti.
  out.streak = (remoto.streak?.last || '') > (locale.streak?.last || '') ? remoto.streak : locale.streak;
  out.daily = (remoto.daily?.day || '') > (locale.daily?.day || '') ? remoto.daily : locale.daily;

  // Impostazioni: restano di questo dispositivo. Sono preferenze, non progressi.
  out.settings = locale.settings;
  out.trainings = Math.max(locale.trainings || 0, remoto.trainings || 0);

  return out;
}
