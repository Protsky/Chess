/*
 * tts.js — voce online, quando quella del dispositivo non basta.
 *
 * Su iPhone, Safari espone per il russo una sola voce (Milena compatta) e le
 * versioni migliorate scaricate dal sistema non arrivano al browser. Non è un
 * problema che si risolva regolando velocità o tono: la voce è quella.
 *
 * Google Translate espone un endpoint di sintesi pubblico e senza chiave — lo
 * stesso che pronuncia le traduzioni sul sito — che restituisce un mp3 di una
 * voce neurale. Si può usare senza registrarsi e senza libreria: basta un
 * elemento <audio> che punti all'indirizzo.
 *
 * Con quel che comporta, detto qui e ripetuto nelle impostazioni:
 *
 *   - non è un'API documentata. Può rallentare, limitare le richieste o
 *     sparire senza preavviso: per questo ogni riproduzione ha un ripiego
 *     immediato sulla voce di sistema, e un fallimento spegne l'online per il
 *     resto della sessione invece di far aspettare a vuoto;
 *   - serve la connessione. Senza rete l'app continua a funzionare, con la
 *     voce del telefono;
 *   - la frase da leggere viaggia fino a Google. Sono frasi di un corpus
 *     pubblico, non roba tua, ma va detto;
 *   - non essendoci CORS non si può leggere l'mp3 via fetch, quindi non lo si
 *     può mettere nella cache dell'app: resta la cache HTTP del browser, che
 *     copre i riascolti ravvicinati.
 */

const ENDPOINT = 'https://translate.google.com/translate_tts';

/** Le frasi più lunghe di così l'endpoint le rifiuta: il corpus sta ben sotto. */
export const MAX_CHARS = 190;

export const supported = typeof Audio !== 'undefined';

/** Indirizzo dell'mp3 per una frase. `slow` usa il parlato scandito di Google. */
export function url(text, locale, { slow = false } = {}) {
  const tl = locale.slice(0, 2);
  const q = encodeURIComponent(text.slice(0, MAX_CHARS));
  const speed = slow ? '&ttsspeed=0.24' : '';
  return `${ENDPOINT}?ie=UTF-8&client=tw-ob&tl=${tl}${speed}&q=${q}`;
}

let current = null;

/** Ferma quello che sta suonando, se sta suonando qualcosa. */
export function stop() {
  if (!current) return;
  try {
    current.pause();
    current.src = '';
  } catch { /* già chiuso */ }
  current = null;
}

/**
 * Riproduce un indirizzo e promette di dire quando ha finito.
 * Rifiuta su errore o se ci mette troppo: chi chiama ripiega sulla voce locale.
 */
export function play(src, { timeout = 9000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!supported) return reject(new Error('audio non disponibile'));
    stop();
    const audio = new Audio(src);
    current = audio;
    audio.preload = 'auto';

    let settled = false;
    const finish = (ok, err) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (current === audio) current = null;
      ok ? resolve() : reject(err || new Error('riproduzione fallita'));
    };
    const timer = window.setTimeout(() => finish(false, new Error('troppo lenta')), timeout);

    audio.addEventListener('ended', () => finish(true));
    audio.addEventListener('error', () => finish(false, new Error('non raggiungibile')));
    audio.play().catch((err) => finish(false, err));
  });
}

/** Scalda la cache del browser senza far sentire niente. */
export function preload(src) {
  if (!supported) return;
  try {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
  } catch { /* niente di grave */ }
}
