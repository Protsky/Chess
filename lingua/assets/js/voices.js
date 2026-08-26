/*
 * voices.js — scegliere la voce meno peggiore fra quelle che ci sono.
 *
 * Il limite è del browser, non dell'app: `speechSynthesis` legge con le voci
 * installate sul dispositivo, e non tutte sono uguali. Su iOS convivono spesso
 * una voce "compatta" (piccola, sintetica, quella che si sente per prima) e una
 * versione migliorata che va scaricata a parte. Chrome espone le voci Google,
 * che passano dalla rete e suonano molto meglio delle locali.
 *
 * Il codice quindi fa due cose: mette in cima le voci che hanno più probabilità
 * di suonare bene, e lascia scegliere. Una voce davvero naturale richiederebbe
 * una sintesi lato server, cioè una dipendenza esterna e una connessione: non
 * è quello che questa app è.
 */

/** Indizi nel nome: chi li porta di solito suona meglio, chi porta gli ultimi peggio. */
const GOOD = ['neural', 'natural', 'premium', 'enhanced', 'siri', 'google', 'wavenet', 'multilingual'];
const POOR = ['compact', 'eloquence', 'novelty', 'espeak'];

const score = (voice, locale) => {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let s = 0;
  if (voice.lang === locale) s += 40;
  else if (voice.lang.slice(0, 2) === locale.slice(0, 2)) s += 20;
  if (!voice.localService) s += 12;          // le voci di rete sono quasi sempre le migliori
  if (voice.default) s += 2;
  for (const hint of GOOD) if (name.includes(hint)) s += 10;
  for (const hint of POOR) if (name.includes(hint)) s -= 25;
  return s;
};

/** Le voci utilizzabili per una lingua, dalla più promettente. */
export function forLocale(all, locale) {
  const base = locale.slice(0, 2);
  return all
    .filter((v) => v.lang && v.lang.slice(0, 2) === base)
    .map((v) => ({ voice: v, score: score(v, locale) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.voice);
}

/** La voce scelta a mano, se c'è ancora; altrimenti la migliore disponibile. */
export function pick(all, locale, preferredUri) {
  const list = forLocale(all, locale);
  if (!list.length) return null;
  return list.find((v) => v.voiceURI === preferredUri) || list[0];
}

/** Nome leggibile, senza il codice lingua ripetuto dentro. */
export const label = (voice) => `${voice.name}${voice.localService ? '' : ' · rete'}`;

/**
 * Vero quando l'unica voce disponibile è di quelle scarne: è il caso in cui
 * conviene dire dove si scarica quella migliorata, invece di lasciar credere
 * che il russo suoni per forza così.
 */
export function onlyPoor(all, locale) {
  const list = forLocale(all, locale);
  if (!list.length) return false;
  return list.every((v) => {
    const name = `${v.name} ${v.voiceURI}`.toLowerCase();
    return v.localService && !GOOD.some((g) => name.includes(g));
  });
}

export const isApple = () =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
