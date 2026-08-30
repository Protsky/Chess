# ♟ Aperture di Scacchi

App web per **imparare a giocare a scacchi**, non solo per memorizzare aperture.
Pensata per iPhone: si usa con il pollice, si aggiunge alla schermata Home e funziona anche offline.

Nessuna dipendenza, nessun build: HTML, CSS e JavaScript puri.

Il piano per esteso, con le fonti, sta in [`ROADMAP.md`](ROADMAP.md).

## Come si usa

La home apre su **quello che si fa oggi**: una sessione sola, già composta —
le carte in scadenza più il materiale nuovo che il tetto giornaliero concede —
con la durata stimata e un bottone. Sotto, **il percorso**: gli otto livelli con
il criterio d'uscita di ciascuno, quello su cui stai adesso, e quali sono
davvero costruiti. Quelli che non ci sono ancora restano marcati «in arrivo»:
mostrare un percorso monco è meglio che nasconderlo.

Chi apre l'app la prima volta si trova sul **livello 0**, non sulla tattica.

Le aperture non sono più la prima schermata. Sono il livello 6 di 8, e stanno
sotto *Studio* insieme alla tattica.

## Le parti

### 🪜 I primi due gradini — vista e sicurezza

Prima si cominciava dalla tattica, e non andava bene: le posizioni più facili del
database di Lichess sono facili *per chi gioca su Lichess*. Misurate, le prime
quaranta che l'app sceglieva erano nove sacrifici, sette forchette e due mosse in
media da trovare. Non è il primo gradino di nessuno.

Ora i due gradini che venivano prima ci sono, e non hanno bisogno di corpus:
gli item se li fabbrica il motore.

- **L0 · Vista della scacchiera** — di che colore è d5, come si chiama la casa
  illuminata, in quante mosse il cavallo va da b1 a e5 (visita in ampiezza, non
  una tabella). Si esce con 18 risposte giuste sulle ultime 20 **e** mediana
  sotto i 3 secondi: qui conta che sia automatico, non che sia giusto.
- **L1 · Non regalare pezzi** — «quale pezzo puoi prendere senza perdere
  niente?», su posizioni vere del corpus. Un pezzo è gratis solo se la cattura è
  **legale** e la casa non è difesa da nessuno: entrambe le cose si calcolano sul
  motore, non si stimano. Si esce a punteggio 800 con al massimo un errore sulle
  ultime venti. **Se sbagli, la ragione si guarda invece di leggerla**: la
  scacchiera gioca la tua cattura e poi la ripresa dell’avversario — «prendi
  Cxe5, e te lo riprende il cavallo in c6» — e solo dopo torna alla posizione
  della domanda con la risposta giusta accesa.

E per chi entra dalla tattica senza passare di lì, la **partenza è morbida**:
finché il punteggio è provvisorio (le prime 25 risposte) arrivano solo posizioni
a una mossa sola e sui motivi elementari.

### ♔ L2 · I finali che si vincono a memoria

Re e Donna, Re e Torre. È l'unico posto del gioco dove la correzione **non è un
parere**: con tre pezzi il risultato con gioco perfetto si conosce per intero,
quindi l'app può dire «questa mossa butta via la vittoria» e avere ragione.

La tavola la genera `tools/build-endgames.mjs` con analisi retrograda — 345.404
posizioni vinte con la Donna, 376.868 con la Torre, matto più lungo 10 e 16
mosse, che sono i numeri da manuale. Ridotta con le otto simmetrie della
scacchiera e spedita solo per metà (il valore col Bianco al tratto si ricava in
una mossa): **89 kB** invece di 3,5 MB.

- **Una mossa che perde il matto forzato non viene giocata**: si annulla e si
  spiega perché. È l'unico momento in cui vale la pena fermare qualcuno.
- **Ogni mossa che mantiene il matto è accettata**, anche se non è la più
  rapida — si corregge l'esito, non lo stile. Se allunga, lo dice.
- **Il Nero difende al meglio possibile**: allenarsi contro una difesa sciocca
  insegna a vincere contro una difesa sciocca.
- Opposizione, Lucena e Philidor hanno quattro o cinque pezzi: tavola molto più
  grande, e per ora non ci sono. Scritto nell'app, invece di fingere.

### 🎯 Tattica — trova la mossa

3235 posizioni dal database aperto di Lichess (CC0), ognuna col suo punteggio
Glicko-2 calcolato su milioni di tentativi veri. Una sessione è **fino a 12
posizioni**: prima le carte scadute, poi materiale nuovo.

- **La difficoltà si insegue, non si sceglie.** Un aggiornamento alla Elo muove a
  ogni risposta sia la tua forza sia quella della posizione, e le posizioni nuove
  arrivano dove ne risolvi circa **tre su quattro**. (Klinkenberg, Straatemeier &
  van der Maas 2011.)
- **I motivi si mescolano.** Due posizioni con lo stesso motivo non si toccano
  mai, e il motivo si scopre *dopo* aver risposto: in partita nessuno annuncia
  che c'è un'inchiodatura. (Kornell & Bjork 2008.)
- **Il voto non te lo chiede nessuno.** Scende dall'esito — pulita e veloce,
  pulita, con un errore, svelata — e da lì FSRS decide quando rivedere la
  posizione. Chi si autovaluta si dà ragione più spesso di quanto i dati
  giustifichino.
- **Gli errori tornano dentro la sessione**, al massimo due volte, e senza
  contare una seconda volta per il punteggio: una carta appena vista risolvere
  non è una prova indipendente.

### 📈 Statistiche e backup

La ripetizione dilazionata è un modello che fa promesse: «questa posizione la
ricorderai fra sedici giorni con il 90% di probabilità». La pagina delle
statistiche serve a controllare se quelle promesse le mantiene.

- **Ritenzione vera** — quanti dei ripassi arrivati a scadenza sono andati bene,
  accanto alla ritenzione che hai chiesto. Se le due si scostano, sono le
  scadenze a essere sbagliate, non tu.
- **Risposte per giorno**, **scadenze in arrivo** (14 giorni), **andamento del
  punteggio** e **i motivi che scappano**: quale tema continui a sbagliare, che
  in sessione non si può vedere perché i motivi sono mescolati.
- **Taratura di FSRS sui tuoi ripassi.** I 19 pesi di serie vengono dai ripassi
  di altri; sopra 120 ripassi utilizzabili si possono rifare sui tuoi, con una
  discesa a coordinate che gira sul telefono. La pagina mostra l'errore di
  previsione prima e dopo e la curva di calibrazione: previsto contro accaduto.
  Sotto quella soglia il bottone non compare — sarebbe rumore, non taratura.
- **Backup.** Tutto sta su questo telefono e basta: nessun account, nessun
  server. Da *Impostazioni* si esporta un file JSON (o si copia negli appunti) e
  lo si rimette da file o incollandolo. Prima di sovrascrivere, l'app dice che
  cosa c'è dentro il backup — data, carte, ripassi, punteggio — e chiede
  conferma. Serve davvero: in iOS il deposito di un sito non aperto per sette
  settimane può essere liberato.

Due parametri, in *Impostazioni*: **posizioni nuove al giorno** (il materiale
nuovo genera i ripassi dei mesi prossimi: il tetto è ciò che tiene la coda di
domani a una misura fattibile) e **ritenzione richiesta** (85, 90 o 95%). Il
secondo cambia direttamente gli intervalli, quindi cambia quanto lavoro fai.

### 📖 Aperture — impara e allena

Il repertorio di sempre: 33 aperture, tutte con linea principale, idea, piano e
commenti in italiano, divise in tre livelli.

- **Impara** — scorri la variante mossa dopo mossa (o falla scorrere da sola) con un commento
  su ogni mossa chiave, più il piano di gioco per entrambi i colori.
- **Allena** — la scacchiera ti chiede le mosse della tua parte, l'avversario risponde da solo.
  Sbagli? Al primo tentativo ti dice solo che non è quella giusta, al secondo ti indica il pezzo.
  Alla fine ricevi precisione, tempo e da 1 a 3 stelle.

Le stelle e i record restano salvati sul dispositivo (`localStorage`), livello per livello.
Dalla schermata di un livello, **⚡ Allenamento del livello** mette in coda 4 aperture,
dando la precedenza a quelle con meno stelle.

| Livello | Contenuto | Aperture |
| --- | --- | --- |
| **Principiante** | Centro, sviluppo, arrocco | Italiana, Due Cavalli, Spagnola, Scozzese, Scandinava, Francese, Caro-Kann, Siciliana Aperta, Gambetto di Donna Rifiutato, Sistema Londra, Russa |
| **Intermedio** | Sistemi completi e piani | Najdorf, Drago, Nimzo-Indiana, Est-Indiana, Slava, Gambetto di Donna Accettato, Inglese, Winawer, Berlinese, Gambetto Evans, Caro-Kann Avanzata, Gambetto di Re |
| **Avanzato** | Teoria da torneo | Grünfeld, Najdorf/Attacco Inglese, Sveshnikov, Marshall, Meran, Catalana, Attacco Jugoslavo, Mar del Plata, Leningrado, Sämisch |

La notazione è italiana per impostazione predefinita (R, D, T, A, C) e commutabile in inglese
dalle impostazioni, insieme a suoni ed elenco mosse.

## In linea

Pubblicata con GitHub Pages: **https://protsky.github.io/Chess/**

### Anche su Cloudflare Pages

Stessa cartella, nessun build: l'app è statica e usa solo percorsi relativi
(`"start_url": "./"` nel manifest), quindi gira uguale alla radice di un dominio
o dentro una sottocartella.

Il motivo per cui vale la pena averla anche lì è [`_headers`](_headers): su
GitHub Pages le intestazioni non si toccano e arriva `max-age=600` su tutto —
per dieci minuti dopo ogni pubblicazione i telefoni che hanno già visitato l'app
ricevono i file vecchi, e il service worker poi se li tiene. Su Cloudflare Pages
il codice si rivalida sempre (ETag, risposta 304) e le icone restano in cache
una settimana.

Due modi, uno solo dei quali va fatto:

1. **Collegando il repo** (consigliato): *Workers & Pages ▸ Create ▸ Pages ▸
   Connect to Git ▸ Protsky/Chess*, ramo `main`, **nessun comando di build** e
   cartella di uscita `/`. Da lì ogni push si pubblica da solo.
2. **Da questa macchina**, senza collegare niente:

```bash
npx wrangler login                                   # apre il browser, una volta sola
npx wrangler pages deploy . --project-name=scacchi   # ogni volta che si pubblica
```

Il primo modo pubblica anche i rami di prova su indirizzi separati; il secondo
non chiede nessun accesso al repo.

## Provarlo

Serve un piccolo server locale (i moduli JavaScript non funzionano aprendo il file da disco):

```bash
python3 -m http.server 8080     # poi apri http://localhost:8080
```

### Sull'iPhone

1. Pubblica la cartella (per esempio con **GitHub Pages**: *Settings ▸ Pages ▸ Deploy from a branch*).
2. Apri l'indirizzo in Safari.
3. **Condividi ▸ Aggiungi a Home**: l'app parte a schermo intero, senza barre del browser,
   e dopo la prima visita funziona anche senza rete grazie al service worker.

## Struttura

```
index.html               guscio dell'app e meta tag iOS
assets/css/app.css       tema scuro, layout mobile, scacchiera
assets/js/chess.js       motore: mosse legali, arrocco, presa al varco, notazione, FEN e UCI
assets/js/percorso.js    gli otto livelli e la sessione di oggi (quello che la home mostra)
assets/js/basics.js      L0 e L1: item generati dal motore, nessun corpus
assets/js/endgames.js    L2: la tavola dei finali, e chi la interroga
assets/js/endgames-data.js  la tavola (dati, generata — non si tocca a mano)
assets/js/openings.js    il repertorio (dati)
assets/js/puzzles.js     il corpus tattico (dati, generato — non si tocca a mano)
assets/js/board.js       scacchiera interattiva (tocco-tocco)
assets/js/fsrs.js        ripetizione dilazionata (FSRS-5), la stessa macchina di Frasi
assets/js/optimizer.js   rifà i 19 pesi di FSRS sui propri ripassi
assets/js/stats.js       ritenzione vera, scadenze, motivi deboli: numeri sui dati veri
assets/js/chart.js       grafici in SVG, senza librerie
assets/js/rating.js      forza e difficoltà sulla stessa scala, aggiornate insieme
assets/js/tactics.js     coda della sessione e voto di ogni risposta (niente DOM)
assets/js/store.js       progressi, carte, registro dei ripassi e backup (localStorage v2)
assets/js/app.js         navigazione, Impara, Allena, Tattica
sw.js                    cache offline
tools/                   validazione, prove end-to-end, generatore del corpus e delle icone
```

## Sviluppo

```bash
node tools/validate.mjs           # ogni linea di apertura è legale? la notazione coincide?
node tools/validate-puzzles.mjs   # ogni soluzione tattica rigiocata sul motore
node tools/validate-percorso.mjs  # memoria, punteggio, coda, livelli, finali
node tools/build-endgames.mjs     # rigenera la tavola dei finali (qualche secondo)
node tools/smoke.mjs              # prova end-to-end su viewport iPhone (richiede playwright)
node tools/build-single.mjs       # genera la versione in un file solo, in dist/
python3 tools/make_icons.py       # rigenera le icone PNG
```

`validate-percorso.mjs` non prova l'interfaccia: prova le tre macchine che
decidono che cosa vedi e quando. Comprende una simulazione di 300 risposte di un
giocatore di forza nota — se la stima non ci arriva, il punteggio mostrato
sarebbe una decorazione, e il controllo fallisce.

### Rigenerare il corpus tattico

```bash
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst   # ~290 MB, CC0
node tools/build-puzzles.mjs lichess_db_puzzle.csv.zst
node tools/validate-puzzles.mjs
```

La scelta è **deterministica**: stesso file in ingresso, stesso corpus in uscita.
Lo strumento stampa quante posizioni ha trovato per fascia di punteggio e per
motivo, e segna le quote non raggiunte: sotto i 700 punti il database ha poco
materiale che superi i filtri di qualità, e si vede.

### Aggiungere un'apertura

Basta una voce in `assets/js/openings.js`:

```js
{
  id: 'nome-univoco',
  name: 'Nome visualizzato',
  eco: 'C50',
  level: 1,                       // 1, 2 o 3
  side: 'w',                      // colore da allenare
  family: 'Aperture aperte · 1.e4 e5',
  summary: 'Una o due frasi sull'idea.',
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
autovalutazione) e uno scheduler FSRS che decide quando riproporre ogni frase. Tedesco (211 frasi), svizzero tedesco di Zurigo (115, ognuna con
l’equivalente in tedesco standard), russo (185, con accento tonico segnato e
risposte accettate anche in caratteri latini), inglese (232) e spagnolo (120),
tutte scritte per italofoni. Si sceglie se allenarsi a **parlare** (dall’italiano
alla lingua, con la produzione al secondo gradino) o a **capire**; i pesi dello
scheduler si possono rifare sui propri ripassi, con la curva dell’oblio e la
calibrazione disegnate a partire dai propri numeri. Le frasi nuove entrano
seguendo un **percorso a unità** che parte dal livello uscito dal test e si
riordina attorno al settore scelto; i ripassi restano governati dalle scadenze,
non dal percorso.

Stessa filosofia: nessuna dipendenza, nessun build, offline dopo la prima visita.
L’unica eccezione è facoltativa: la voce online (la sintesi pubblica di Google
Translate), accesa di serie sul russo perché le voci di sistema lì non bastano.

- In locale: `python3 -m http.server 8080`, poi <http://localhost:8080/lingua/>
- In linea: **https://protsky.github.io/Chess/lingua/**
- Dettagli, motori e riferimenti: [`lingua/README.md`](lingua/README.md)

```bash
node tools/validate-lingua.mjs   # corpus, motori e percorso (409 controlli)
node tools/corpus-review.mjs     # che cosa manca al corpus, lingua per lingua
node tools/smoke-lingua.mjs      # prova end-to-end (127 controlli)
```
