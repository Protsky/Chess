/*
 * corpus.js — registro delle lingue e vocabolario condiviso.
 *
 * Una "frase" è l'unità minima di studio: abbastanza corta da entrare nella
 * memoria di lavoro (Miller, 1956: 4±1 chunk), abbastanza completa da portarsi
 * dietro un pezzo di grammatica in contesto. È l'idea del sentence mining e
 * dei "formulaic sequences" (Wray 2002; Ellis 2012): si impara il blocco, non
 * la parola isolata, perché il blocco contiene già collocazioni, ordine delle
 * parole e morfologia.
 */

import { DE } from './corpus-de.js';
import { GSW } from './corpus-gsw.js';
import { RU } from './corpus-ru.js';
import { EN } from './corpus-en.js';
import { ES } from './corpus-es.js';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Settori: pesano la scelta delle frasi nuove, non le nascondono. */
export const DOMAINS = [
  { id: 'generale', label: 'Vita quotidiana', icon: '☕' },
  { id: 'lavoro', label: 'Lavoro e ufficio', icon: '💼' },
  { id: 'viaggi', label: 'Viaggi', icon: '✈️' },
  { id: 'tecnologia', label: 'Tecnologia', icon: '💻' },
  { id: 'salute', label: 'Salute', icon: '🩺' },
  { id: 'accademico', label: 'Studio e ricerca', icon: '🎓' },
];

export const LANGS = [DE, GSW, RU, EN, ES];

export const byCode = (code) => LANGS.find((l) => l.code === code) || null;

export const levelIndex = (lv) => LEVELS.indexOf(lv);

/** Tutte le frasi di una lingua indicizzate per id. */
export function sentenceMap(lang) {
  const map = new Map();
  for (const s of lang.sentences) map.set(s.id, s);
  return map;
}
