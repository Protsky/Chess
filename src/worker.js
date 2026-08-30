/*
 * worker.js — il pezzo di app che gira su Cloudflare, e serve a una cosa sola:
 * tenere i progressi al sicuro anche quando il telefono li perde.
 *
 * Il resto dell'app resta com'è: statica, offline, con i dati su questo
 * dispositivo. Qui c'è solo un deposito: un valore JSON per codice, su KV.
 *
 * PERCHÉ KV E NON R2
 * R2 è fatto per gli oggetti grossi; qui si salva un JSON da cento kilobyte,
 * scritto una volta a fine sessione. Per quella forma KV è la casa giusta: una
 * chiave, un valore, fino a 25 MiB. E c'è una ragione pratica che pesa quanto
 * quella tecnica — per abilitare R2 Cloudflare chiede un metodo di pagamento
 * anche nel piano gratuito, mentre KV su questo account è già in uso. Il giorno
 * in cui i dati diventassero grossi (PGN, analisi, audio) si cambia binding e
 * il resto di questo file resta identico.
 *
 * KV è *eventualmente* consistente: una lettura può arrivare qualche secondo
 * indietro. Qui non fa danno, perché il client **unisce** invece di
 * sovrascrivere — una copia leggermente vecchia produce al più una fusione in
 * più, non una sessione persa.
 *
 * PERCHÉ SERVE
 * Finora i progressi stavano solo nel browser. In iOS il deposito di un sito
 * non aperto per sette settimane può essere liberato, e chi cambia telefono
 * ricomincia da zero: mesi di ripassi che spariscono senza che nessuno abbia
 * sbagliato niente. Il backup su file c'è già, ma va ricordato — e chi si
 * ricorda di fare un backup non è chi ne ha bisogno.
 *
 * COME SI RICONOSCE CHI TORNA, E PERCHÉ COSÌ
 * Non ci sono account: nessuna email, nessuna password, niente da rubare e
 * niente da dimenticare. C'è un **codice** di sedici caratteri, generato dal
 * browser con il generatore crittografico e scritto sul dispositivo. Chi ha il
 * codice ha quei progressi — su qualunque telefono. È anche il limite, e va
 * detto a chiaro: **il codice è la chiave**. Sedici caratteri Crockford base32
 * sono ~80 bit: indovinarne uno non è una cosa che si fa.
 *
 * COSA C'È DENTRO, E COSA NO
 * Carte, scadenze, punteggi, registro dei ripassi, impostazioni. Nessun nome,
 * nessuna email, nessun indirizzo IP salvato: nel deposito ci sono solo scacchi.
 *
 * SE IL DEPOSITO NON C'È
 * Finché il namespace KV non è collegato, le rotte rispondono 503 con il motivo, e
 * il sito continua a funzionare come prima. Un'app che si rompe perché manca una
 * cosa che le serve solo per un extra è un'app scritta male.
 */

/** Crockford base32 senza I, L, O, U: non si confondono leggendo o dettando. */
const CODICE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{16}$/;

/** Mezzo mega: un anno di ripassi sta in molto meno, e il resto è sospetto. */
const LIMITE_BYTE = 512 * 1024;

const json = (dati, stato = 200) => new Response(JSON.stringify(dati), {
  status: stato,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  },
});

/*
 * Il prefisso non è decorazione: il namespace era nato per essere condiviso con
 * Frasi. Poi Frasi ha scelto un'altra strada — un Durable Object con SQLite, che
 * non chiede di creare risorse a mano — quindi qui dentro oggi ci sono solo
 * scacchi. Il prefisso resta lo stesso: costa niente, e il giorno che serve serve.
 */
const chiaveDi = (codice) => `scacchi:${codice}`;

async function leggi(env, codice) {
  const { value, metadata } = await env.PROGRESSI.getWithMetadata(chiaveDi(codice), { type: 'text' });
  if (value === null) return json({ errore: 'nessun progresso con questo codice' }, 404);
  return new Response(value, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-aggiornato': metadata?.aggiornato || '',
    },
  });
}

async function scrivi(request, env, codice) {
  const lunghezza = Number(request.headers.get('content-length') || 0);
  if (lunghezza > LIMITE_BYTE) {
    return json({ errore: `troppo grande: il limite è ${Math.round(LIMITE_BYTE / 1024)} kB` }, 413);
  }

  const testo = await request.text();
  if (testo.length > LIMITE_BYTE) {
    return json({ errore: `troppo grande: il limite è ${Math.round(LIMITE_BYTE / 1024)} kB` }, 413);
  }

  // Si controlla che sia JSON e che somigli a un salvataggio di questa app:
  // il deposito non è un posto dove chiunque mette quello che vuole.
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    return json({ errore: 'non è JSON' }, 400);
  }
  if (!dati || typeof dati !== 'object' || Array.isArray(dati)) return json({ errore: 'forma non riconosciuta' }, 400);
  if (dati.app && dati.app !== 'aperture-scacchi') return json({ errore: 'è il salvataggio di un\'altra app' }, 400);
  if (!dati.cards && !dati.progress) return json({ errore: 'non contiene né carte né progressi' }, 400);

  const aggiornato = new Date().toISOString();
  await env.PROGRESSI.put(chiaveDi(codice), testo, { metadata: { aggiornato } });

  return json({ salvato: true, aggiornato, byte: testo.length });
}

async function api(request, env, url) {
  if (!env.PROGRESSI) {
    return json({ errore: 'il deposito non è collegato a questo Worker (manca il namespace KV)' }, 503);
  }

  const pezzi = url.pathname.split('/').filter(Boolean);          // ['api','progressi','<codice>']
  if (pezzi[1] !== 'progressi' || pezzi.length !== 3) return json({ errore: 'rotta sconosciuta' }, 404);

  const codice = pezzi[2].toUpperCase();
  if (!CODICE.test(codice)) return json({ errore: 'codice non valido' }, 400);

  if (request.method === 'GET') return leggi(env, codice);
  if (request.method === 'PUT') return scrivi(request, env, codice);
  return json({ errore: 'metodo non ammesso' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    // Tutto il resto è l'app statica, servita come prima.
    return env.ASSETS.fetch(request);
  },
};
