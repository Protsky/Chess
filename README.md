# ♟ Aperture di Scacchi

Gioco web per **memorizzare le aperture di scacchi più importanti**, divise per livello.
Pensato per iPhone: si usa con il pollice, si aggiunge alla schermata Home e funziona anche offline.

Nessuna dipendenza, nessun build: HTML, CSS e JavaScript puri.

## Come funziona

Ogni apertura ha due modalità:

- **Impara** — scorri la variante mossa dopo mossa (o falla scorrere da sola) con un commento
  su ogni mossa chiave, più il piano di gioco per entrambi i colori.
- **Allena** — la scacchiera ti chiede le mosse della tua parte, l’avversario risponde da solo.
  Sbagli? Al primo tentativo ti dice solo che non è quella giusta, al secondo ti indica il pezzo.
  Alla fine ricevi precisione, tempo e da 1 a 3 stelle.

Le stelle e i record restano salvati sul dispositivo (`localStorage`), livello per livello.
Dalla schermata di un livello, **⚡ Allenamento del livello** mette in coda 4 aperture,
dando la precedenza a quelle con meno stelle.

## Il repertorio

33 aperture, tutte con linea principale, idea, piano e commenti in italiano.

| Livello | Contenuto | Aperture |
| --- | --- | --- |
| **Principiante** | Centro, sviluppo, arrocco | Italiana, Due Cavalli, Spagnola, Scozzese, Scandinava, Francese, Caro-Kann, Siciliana Aperta, Gambetto di Donna Rifiutato, Sistema Londra, Russa |
| **Intermedio** | Sistemi completi e piani | Najdorf, Drago, Nimzo-Indiana, Est-Indiana, Slava, Gambetto di Donna Accettato, Inglese, Winawer, Berlinese, Gambetto Evans, Caro-Kann Avanzata, Gambetto di Re |
| **Avanzato** | Teoria da torneo | Grünfeld, Najdorf/Attacco Inglese, Sveshnikov, Marshall, Meran, Catalana, Attacco Jugoslavo, Mar del Plata, Leningrado, Sämisch |

La notazione è italiana per impostazione predefinita (R, D, T, A, C) e commutabile in inglese
dalle impostazioni, insieme a suoni ed elenco mosse.

## In linea

Pubblicata con GitHub Pages: **https://protsky.github.io/Chess/**

## Provarlo

Serve un piccolo server locale (i moduli JavaScript non funzionano aprendo il file da disco):

```bash
python3 -m http.server 8080     # poi apri http://localhost:8080
```

### Sull’iPhone

1. Pubblica la cartella (per esempio con **GitHub Pages**: *Settings ▸ Pages ▸ Deploy from a branch*).
2. Apri l’indirizzo in Safari.
3. **Condividi ▸ Aggiungi a Home**: l’app parte a schermo intero, senza barre del browser,
   e dopo la prima visita funziona anche senza rete grazie al service worker.

## Struttura

```
index.html               guscio dell'app e meta tag iOS
assets/css/app.css       tema scuro, layout mobile, scacchiera
assets/js/chess.js       motore: mosse legali, arrocco, presa al varco, notazione
assets/js/openings.js    il repertorio (dati)
assets/js/board.js       scacchiera interattiva (tocco-tocco)
assets/js/store.js       progressi e impostazioni su localStorage
assets/js/app.js         navigazione, modalità Impara e Allena
sw.js                    cache offline
tools/                   validazione, prove end-to-end, generatore di icone
```

## Sviluppo

```bash
node tools/validate.mjs      # ogni linea è legale? la notazione coincide?
node tools/smoke.mjs         # prova end-to-end su viewport iPhone (richiede playwright)
node tools/smoke.mjs URL     # stessa prova contro un sito già pubblicato
node tools/build-single.mjs  # genera la versione in un file solo, in dist/
node tools/check-single.mjs  # verifica quel file aperto da disco (file://)
python3 tools/make_icons.py  # rigenera le icone PNG
```

`validate.mjs` rigioca tutte le varianti sul motore: se una mossa è illegale o ambigua,
o se la notazione scritta a mano non corrisponde a quella generata, fallisce.
Da eseguire ogni volta che si tocca `openings.js`.

### Aggiungere un’apertura

Basta una voce in `assets/js/openings.js`:

```js
{
  id: 'nome-univoco',
  name: 'Nome visualizzato',
  eco: 'C50',
  level: 1,                       // 1, 2 o 3
  side: 'w',                      // colore da allenare
  family: 'Aperture aperte · 1.e4 e5',
  summary: 'Una o due frasi sull’idea.',
  plan: 'Il piano a medio termine.',
  line: 'e4 e5 Nf3 Nc6',          // notazione inglese, separata da spazi
  notes: { 0: 'Commento alla 1ª semimossa.' },   // indici da 0, facoltativi
}
```

Poi `node tools/validate.mjs` per la verifica.

---

## Anche in questo repository: 💬 Frasi

In `lingua/` c’è una seconda app, indipendente dalla prima: **impara una lingua
memorizzando frasi corte** invece di parole singole, con un test di livello
adattivo su modello IRT, quattro esercizi che si correggono da soli (niente
autovalutazione) e uno scheduler FSRS che decide quando riproporre ogni frase. Tedesco (180 frasi), svizzero tedesco di Zurigo (115, ognuna con
l’equivalente in tedesco standard), russo (150, con accento tonico segnato e
risposte accettate anche in caratteri latini), inglese (205) e spagnolo (120),
tutte scritte per italofoni. Si sceglie se allenarsi a **parlare** (dall’italiano
alla lingua, con la produzione al secondo gradino) o a **capire**; i pesi dello
scheduler si possono rifare sui propri ripassi, con la calibrazione a vista.

Stessa filosofia: nessuna dipendenza, nessun build, offline dopo la prima visita.

- In locale: `python3 -m http.server 8080`, poi <http://localhost:8080/lingua/>
- In linea: **https://protsky.github.io/Chess/lingua/**
- Dettagli, motori e riferimenti: [`lingua/README.md`](lingua/README.md)

```bash
node tools/validate-lingua.mjs   # corpus e motori
node tools/smoke-lingua.mjs      # prova end-to-end
```
