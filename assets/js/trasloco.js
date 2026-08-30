/*
 * trasloco.js — quello che si vede aprendo il **vecchio** indirizzo.
 *
 * L'app vive su https://chess.donati.workers.dev/. Su GitHub Pages restava una
 * seconda copia, identica nel contenuto e diversa dove conta: il deposito del
 * browser è legato all'indirizzo, quindi chi studiava di là aveva un altro
 * mazzo, altre scadenze, un altro punteggio. Due copie della stessa app non
 * sono un doppione innocuo — sono due studi separati che si credono uno.
 *
 * Invece di spegnere e basta, questa pagina fa tre cose:
 *   1. dice dov'è andata l'app e ci porta;
 *   2. offre di **scaricare i progressi rimasti su questa origine**, perché è
 *      l'unica pagina al mondo che può leggerli (stessa origine, stesso
 *      localStorage) — e se c'è un codice di sincronizzazione lo mostra, che è
 *      la via più corta per ritrovarsi tutto di là;
 *   3. **stacca il service worker** e svuota le sue cache: senza, questa copia
 *      continuerebbe a funzionare offline per sempre, che è esattamente il
 *      guasto da chiudere.
 */

const CASA = 'https://chess.donati.workers.dev/';
const CHIAVE = 'aperture-scacchi/v2';
const CHIAVE_V1 = 'aperture-scacchi/v1';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function leggiSalvataggio() {
  const raw = localStorage.getItem(CHIAVE) || localStorage.getItem(CHIAVE_V1);
  if (!raw) return null;
  try {
    const dati = JSON.parse(raw);
    return {
      raw,
      carte: Object.keys(dati.cards || {}).length,
      aperture: Object.keys(dati.progress || {}).length,
      ripassi: (dati.log || []).length,
      codice: dati.sync?.codice || null,
    };
  } catch {
    return { raw, carte: 0, aperture: 0, ripassi: 0, codice: null };
  }
}

export function mostra(radice) {
  const salvataggio = leggiSalvataggio();

  radice.innerHTML = `
    <div class="stack">
      <div class="hero">
        <div class="eyebrow">Cambio di indirizzo</div>
        <h1>L'app si è spostata</h1>
        <p>Vive su <strong>chess.donati.workers.dev</strong>. Questa è una vecchia copia su GitHub Pages: il contenuto
          è lo stesso, ma i progressi no — il browser li lega all'indirizzo, quindi studiare qui e là vuol dire
          avere due mazzi separati che si credono uno.</p>
      </div>
      <a class="btn btn--primary" href="${CASA}">Vai all'app ›</a>

      ${salvataggio ? `
        <div class="note">
          <div class="note__label">Quello che è rimasto qui</div>
          ${salvataggio.carte} carte, ${salvataggio.aperture} aperture iniziate, ${salvataggio.ripassi} ripassi.
          ${salvataggio.codice
            ? `Hai un codice di sincronizzazione: <strong>${esc(salvataggio.codice.replace(/(.{4})/g, '$1 ').trim())}</strong> —
               scrivilo di là in <em>Impostazioni ▸ Usa un altro codice</em> e ritrovi tutto senza file di mezzo.`
            : 'Scaricalo e reimportalo di là da <em>Impostazioni ▸ Importa da un file</em>.'}
        </div>
        <button class="btn" id="scarica">⬇︎ Scarica i progressi rimasti qui</button>
      ` : `
        <div class="note">Su questa copia non hai mai studiato: non c'è niente da salvare.</div>
      `}

      <div id="esito"></div>
      <p class="hint-text">Questa pagina ha anche staccato il service worker di questa copia, così non continua a
        funzionare offline alle tue spalle.</p>
    </div>`;

  const bottone = radice.querySelector('#scarica');
  const esito = radice.querySelector('#esito');

  if (bottone) {
    bottone.onclick = () => {
      const blob = new Blob([salvataggio.raw], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `scacchi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      esito.innerHTML = `<div class="note">Scaricato: ${Math.round(salvataggio.raw.length / 1024)} kB.
        Ora importalo nell'app nuova.</div>`;
    };
  }

  // Il service worker di questa copia se ne va: è la parte che rende il
  // trasloco definitivo invece che apparente.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrazioni) => Promise.all(registrazioni.map((r) => r.unregister())))
      .catch(() => { /* niente da staccare */ });
  }
  if (window.caches) {
    caches.keys().then((nomi) => Promise.all(nomi.map((n) => caches.delete(n)))).catch(() => {});
  }
}
