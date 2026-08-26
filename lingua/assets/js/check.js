/*
 * check.js — confronto fra quello che si scrive e la frase giusta.
 *
 * L'obiettivo non è la pignoleria ortografica ma il richiamo attivo: accenti,
 * maiuscole, punteggiatura e apostrofi tipografici non fanno differenza,
 * l'ordine delle parole sì. Il risultato viene mostrato parola per parola,
 * perché vedere *dove* si è sbagliato vale più di un semplice "no".
 */

/**
 * Toglie accenti, punteggiatura e differenze di maiuscole. La ß diventa ss:
 * su una tastiera italiana non si digita, e in Svizzera non si scrive proprio.
 */
export function normalize(text, fold) {
  const flat = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[.,!?¿¡;:"()…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // fold: metro di confronto proprio della lingua (per il russo, l'alfabeto)
  return fold ? fold(flat).replace(/\s+/g, ' ').trim() : flat;
}

export const tokens = (text, fold) => normalize(text, fold).split(' ').filter(Boolean);

/** Distanza di Levenshtein, per perdonare un refuso dentro una parola. */
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/*
 * Due parole "vicine" restano allineate nel confronto, ma non sono
 * equivalenti: in una lingua flessiva gusta/gustan dista un carattere ed è
 * un errore di grammatica, non un refuso. Servono ad allineare il diff, non
 * a promuovere la risposta.
 */
const closeEnough = (a, b) => a === b || (a.length > 3 && editDistance(a, b) === 1);

/**
 * Allinea la risposta alla frase attesa con la classica programmazione
 * dinamica delle differenze, e restituisce i token attesi marcati.
 */
export function diff(expected, given, fold) {
  const exp = tokens(expected, fold);
  const got = tokens(given, fold);
  const m = exp.length;
  const n = got.length;

  // lunghezza della sottosequenza comune più lunga
  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = closeEnough(exp[i], got[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const shown = expected.split(/\s+/).filter(Boolean);
  const marks = [];
  const near = [];
  let i = 0;
  let j = 0;
  let typos = 0;
  while (i < m && j < n) {
    if (closeEnough(exp[i], got[j])) {
      const typo = exp[i] !== got[j];
      if (typo) {
        typos++;
        near.push({ written: got[j], expected: exp[i] });
      }
      marks.push({ word: shown[i] ?? exp[i], status: typo ? 'typo' : 'ok' });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      marks.push({ word: shown[i] ?? exp[i], status: 'missing' });
      i++;
    } else {
      j++; // parola di troppo nella risposta: la si ignora, conta il calo di punteggio
    }
  }
  while (i < m) {
    marks.push({ word: shown[i] ?? exp[i], status: 'missing' });
    i++;
  }

  const hits = marks.filter((x) => x.status !== 'missing').length;
  const extra = Math.max(0, n - hits);
  const score = m ? Math.max(0, (hits - extra * 0.5) / m) : 0;

  return {
    marks,
    near,
    score,
    typos,
    extra,
    perfect: normalize(expected, fold) === normalize(given, fold),
    correct: score >= 0.999 && extra === 0 && typos === 0,
  };
}

/**
 * Voto suggerito a partire dal confronto: è solo una proposta, l'ultima
 * parola resta a chi studia (l'autovalutazione è parte del metodo).
 */
export function suggestGrade(result) {
  if (result.correct) return 3;                                  // tutto giusto
  if (result.score >= 0.999 && !result.extra) return 2;          // parole giuste, forma sbagliata
  return 1;                                                      // manca qualcosa
}
