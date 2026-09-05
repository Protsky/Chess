/*
 * manifesto.js — da dove viene il corpus. GENERATO: non modificare a mano.
 *
 * Serve a una cosa sola: le cifre di scorta che l'app mostra ("ne restano 264,
 * cioè 11 esami") invecchiano, perché l'export di Lichess cambia ogni mese. Un
 * numero senza la data della fonte da cui viene è vero oggi e falso domani, e
 * nessuno se ne accorge.
 */

export const MANIFESTO = {
  "fonte": "https://database.lichess.org/lichess_db_puzzle.csv.zst",
  "licenza": "CC0",
  "scaricato": "2026-09-05",
  "modificato": "2026-09-05",
  "byte": 304384407,
  "sha256": "a0ea9129c6b6434dfb34a9ac4ec660c9cfff22b2de465e01854f018fc847f073",
  "righeLette": 6100960,
  "ammesse": 9970,
  "criteri": {
    "MIN_PLAYS": 500,
    "MIN_POPULARITY": 85,
    "MAX_DEVIATION": 90,
    "PER_BAND": 600,
    "PER_BAND_THEME": 45,
    "MIN_RATING": 400,
    "MAX_RATING": 2200,
    "MAX_PLIES": 6
  }
};

export const dataSnapshot = () => MANIFESTO.modificato;
