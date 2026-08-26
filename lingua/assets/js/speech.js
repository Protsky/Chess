/*
 * speech.js — riconoscimento vocale del browser.
 *
 * Serve a chiudere l'ultimo buco: dire la frase ad alta voce e poi dichiarare
 * da sé se era giusta non è una verifica. Qui la frase detta viene trascritta
 * e confrontata con quella attesa, esattamente come una risposta scritta.
 *
 * C'è anche un motivo di memoria, non solo di onestà: pronunciare ad alta voce
 * quello che si sta imparando lo fa ricordare meglio del solo leggerlo
 * (production effect: MacLeod, Gopie, Hourihan, Neary & Ozubko, 2010).
 *
 * Il supporto è disomogeneo: c'è su Safari (iOS 14.5 e successivi) e su
 * Chrome, manca altrove, e in certi casi la trascrizione passa dalla rete.
 * Quando manca, l'app non ne parla nemmeno e resta sulla tastiera.
 */

const Impl = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export const supported = Boolean(Impl);

const MESSAGES = {
  'not-allowed': 'Il microfono è bloccato: va concesso dalle impostazioni del browser.',
  'service-not-allowed': 'Il microfono è bloccato: va concesso dalle impostazioni del browser.',
  'no-speech': 'Non ho sentito niente. Riprova più vicino al microfono.',
  network: 'La trascrizione ha bisogno della rete e adesso non c’è.',
  aborted: '',
};

/**
 * Ascolta una frase sola.
 *   onResult riceve l'elenco delle trascrizioni proposte, dalla più probabile.
 * Restituisce una funzione per interrompere l'ascolto.
 */
export function listen({ locale, onResult, onError, onEnd }) {
  if (!Impl) {
    onError?.('Questo browser non trascrive la voce.');
    return () => {};
  }
  let rec;
  try {
    rec = new Impl();
  } catch {
    onError?.('Non riesco ad accendere il microfono.');
    return () => {};
  }

  rec.lang = locale;
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 5;

  rec.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const alternatives = [];
    for (let i = 0; i < last.length; i++) alternatives.push(last[i].transcript.trim());
    onResult(alternatives.filter(Boolean));
  };
  rec.onerror = (event) => {
    const msg = MESSAGES[event.error] ?? 'Il riconoscimento vocale non ha funzionato.';
    if (msg) onError?.(msg);
  };
  rec.onend = () => onEnd?.();

  try {
    rec.start();
  } catch {
    onError?.('Il microfono è già in ascolto.');
  }
  return () => { try { rec.abort(); } catch { /* già chiuso */ } };
}

/**
 * Fra le trascrizioni proposte tiene la migliore secondo il confronto dato:
 * chi parla non deve essere penalizzato perché il motore ha scelto un omofono.
 */
export function bestOf(alternatives, score) {
  let best = null;
  for (const text of alternatives) {
    const result = score(text);
    if (!best || result.score > best.result.score) best = { text, result };
  }
  return best;
}
