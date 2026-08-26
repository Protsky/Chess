# 💬 Frasi

App web per **imparare una lingua memorizzando frasi**, non parole singole.
Frasi corte, una difficoltà grammaticale alla volta, riproposte nel momento in
cui stai per dimenticarle. Pensata per iPhone: si usa con il pollice, si
aggiunge alla schermata Home e funziona offline.

Nessuna dipendenza, nessun build: HTML, CSS e JavaScript puri.

## L'idea

Una parola isolata non porta con sé né la grammatica né le collocazioni. Una
frase di sei parole sì, e resta comunque dentro la memoria di lavoro. Quindi:

1. **Un test adattivo** stabilisce il livello in 8-16 domande.
2. **Le frasi nuove** vengono pescate appena sopra quel livello, nel settore
   che hai scelto (lavoro, viaggi, tecnologia, salute, ricerca, quotidiano).
3. **Ogni frase diventa quattro carte** in ordine crescente di sforzo, e
   ognuna si sblocca solo quando la precedente è consolidata.
4. **Un algoritmo di ripetizione dilazionata** decide quando rivedere ciascuna
   carta, puntando alla probabilità di ricordare che hai richiesto.

## I quattro esercizi, e perché nessuno si autovaluta

| | Esercizio | Come si corregge |
| --- | --- | --- |
| 👂 | **Riconosci** — quattro possibilità, una giusta | scelta giusta o sbagliata |
| 🧩 | **Componi** — tessere da rimettere in fila, due di troppo | ordine esatto |
| ✏️ | **Completa** — buchi che aumentano col consolidarsi della carta | parola per parola |
| 🗣️ | **Produci** — la frase intera, scritta o dettata a voce | confronto completo |

### Il verso conta più di quanto sembri

In *Impostazioni* si sceglie che cosa si vuole saper fare, e cambia sia la
domanda sia l'ordine dei gradini:

| | **Parlare** (di partenza) | **Capire** |
| --- | --- | --- |
| Riconosci | vedi l'italiano, scegli fra quattro frasi nella lingua | vedi la frase, scegli fra quattro traduzioni |
| Scala | comp → **prod** → build → cloze | comp → build → cloze → **prod** |

Non è una preferenza estetica. Con *Capire* la produzione è il quarto gradino:
arriva dopo settimane, e nel frattempo si pratica solo il verso opposto a quello
che serve. Con *Parlare* si parte sempre dall'italiano e la produzione è il
secondo gradino, quindi arriva al secondo giro. È il principio del
**transfer-appropriate processing** (Morris, Bransford & Franks, 1977): si
ricorda meglio quando le condizioni dello studio somigliano a quelle dell'uso.
Chi punta a capire il parlato ha la scala classica di Nation, che per quel-
l'obiettivo resta la più sensata.

Il punto non è la varietà: è che **nessuno di questi esercizi può essere
corretto da chi studia**. Chiedere "l'avevi indovinata?" dopo aver mostrato la
risposta non misura niente — dopo averla vista la si riconosce, e riconoscerla
viene scambiato per ricordarla (Koriat & Bjork, 2005). Chi si autocorregge si
dà ragione più spesso di quanto i dati giustifichino (Dunlosky & Rawson, 2012),
e quell'errore finisce dritto dentro FSRS, che programma i ripassi su un voto
gonfiato.

Qui il voto **scende dall'esito**: tutto giusto → *Bene*, parole giuste e forma
sbagliata → *Difficile*, manca qualcosa → *Di nuovo*. Resta un bottone per
correggerlo a mano — *Facile* nessuna macchina può indovinarlo — ma la
condizione normale è che tu non debba giudicarti.

### I buchi che crescono

Il cloze non ha un numero fisso di buchi: ne ha **uno** quando la carta è nuova
e arriva a **metà frase** quando è solida, con il primo buco sempre sulla chiave
grammaticale. È il *fading* dell'impalcatura di Renkl & Atkinson (2003): l'aiuto
si ritira mentre la memoria regge da sola, e la stessa frase resta un esercizio
utile invece di diventare un automatismo.

### La voce

Nel passaggio di produzione puoi **dettare la frase** invece di scriverla:
`SpeechRecognition` la trascrive e il confronto è lo stesso di una risposta
scritta. Non è solo comodità — pronunciare ad alta voce quello che si studia lo
fa ricordare meglio del solo leggerlo (*production effect*, MacLeod et al.
2010). Fra le trascrizioni proposte dal motore viene scelta la più vicina alla
frase attesa, così un omofono non conta come errore. Dove il browser non
trascrive (fuori da Safari e Chrome) il microfono non compare nemmeno.

## Tarare il modello sui propri ripassi

I 19 pesi di FSRS vengono di serie dai ripassi di centinaia di milioni di carte
altrui. Rifarli sui propri è il senso dichiarato dell'algoritmo, non un extra —
ed è quello che fa **Progressi ▸ Taratura del modello**:

1. dal registro si ricostruisce la storia di ogni carta (voto e giorni
   trascorsi, in ordine), scartando quelle di cui non si conosce l'inizio;
2. per una data scelta di pesi si rigioca la storia in avanti e, a ogni ripasso
   a distanza di almeno un giorno, si confronta la probabilità di ricordare che
   il modello prevedeva con quello che è successo davvero;
3. la misura è la **log-loss**, affiancata dall'**RMSE di calibrazione**: la
   prima dice quanto le previsioni sbagliano, la seconda se sono oneste — un
   modello che dice "85%" deve azzeccarci l'85% delle volte;
4. si scende **a coordinate**: un peso alla volta, si prova a spostarlo su e giù
   e si tiene lo spostamento che abbassa la log-loss. Quattro passate bastano e
   girano in un browser in un paio di decimi di secondo.

Su dati simulati a partire da pesi diversi da quelli di serie, la procedura
recupera un modello migliore dei default (log-loss 0,297 → 0,290, calibrazione
2,8% → 1,0%, in 180 ms). Su dati che seguono già i default il guadagno resta
trascurabile: è il controllo che impedisce all'ottimizzatore di inventarsi
miglioramenti che non ci sono.

Sotto i 120 ripassi utilizzabili il bottone resta spento, e fra 120 e 400 l'app
avverte che la stima è ancora rumorosa.

### Il prezzo della ritenzione

Alzare la ritenzione richiesta accorcia gli intervalli: ricordi di più e ripassi
di più. Non esiste un numero giusto per tutti, e chi te ne consiglia uno sta
nascondendo delle ipotesi. L'app mostra invece **quanto costa ognuno**,
simulando una popolazione di carte per un anno con i tuoi pesi e con i tuoi
tempi reali per ripasso — misurati dal registro, distinguendo quanto costa
indovinare da quanto costa sbagliare, perché una carta sbagliata torna più volte
e riparte da più in basso.

Con i pesi di serie, da 80% a 95% i ripassi passano da 5,4 a 11,6 all'anno per
carta, più del doppio, a fronte di 8 punti di memoria media in più. La scelta
resta tua, ma con i numeri davanti.

## I due motori

### FSRS — quando ripassare (`assets/js/fsrs.js`)

Implementazione di FSRS v5 (Ye et al.), il modello DSR che sta anche dietro allo
scheduler moderno di Anki. Ogni carta ha:

| | |
| --- | --- |
| **S** stabilità | l'intervallo, in giorni, al quale la probabilità di ricordare vale 0.9 |
| **D** difficoltà | da 1 a 10, con regressione verso la media: un errore isolato non affossa la carta |
| **R** recuperabilità | `R(t) = (1 + 19/81 · t/S)^-0.5`, una legge di potenza, non un esponenziale |

L'intervallo successivo si ottiene invertendo la curva per la ritenzione
richiesta nelle impostazioni (80-95%). Ripassare quando R è già sceso fa
crescere S molto più che ripassare subito: è lo spacing effect, scritto in
formule.

I pesi usati sono i 19 parametri di default della versione 5, ottimizzati su
dati aggregati. Un'ottimizzazione personale richiederebbe qualche migliaio di
ripassi tuoi e non è (ancora) implementata.

### IRT — a che livello sei (`assets/js/irt.js`)

Test adattivo su modello logistico a due parametri:

- `P(θ) = 1 / (1 + e^(-a(θ-b)))`, dove θ è la tua abilità, `b` la difficoltà
  dell'item e `a` quanto quell'item discrimina;
- dopo ogni risposta θ si ristima con **EAP** su una griglia con prior N(0,1):
  regge anche i pattern "tutte giuste" o "tutte sbagliate", dove la massima
  verosimiglianza divergerebbe;
- l'item successivo è quello di **massima informazione di Fisher** in θ, cioè
  quello di cui l'esito è meno prevedibile;
- ci si ferma quando l'errore standard scende sotto 0.35, o dopo 16 domande.

Le soglie in θ sono ancorate alle bande del QCER (A1-C2). Sulle banche reali,
in simulazione, l'abilità vera viene recuperata entro ±0.36 su tutta la scala.

## Il corpus

| Lingua | Frasi | Item del test | Punti di grammatica |
| --- | --- | --- | --- |
| 🇩🇪 Tedesco | 180 | 44 | 47 |
| 🇨🇭 Svizzero tedesco | 115 | 34 | 31 |
| 🇷🇺 Russo | 150 | 40 | 35 |
| 🇬🇧 Inglese | 205 | 48 | 46 |
| 🇪🇸 Spagnolo | 120 | 38 | 32 |

Tutte le frasi sono scritte per italofoni: la nota di ogni frase spiega proprio
il punto dove l'italiano ci fa sbagliare (la posizione del verbo tedesco,
`must` contro `have to`, `ser` contro `estar`, il congiuntivo dopo `cuando`).
Media di sei parole per frase.

### Il russo, e i due problemi che porta

**L'alfabeto.** La frase giusta si scrive in cirillico, che sulla tastiera
italiana non c'è. Le risposte si accettano in tutti e due i modi: in cirillico
il confronto è stretto (ь e ъ contano), in caratteri latini entrambe le frasi
vengono ridotte alla stessa traslitterazione grossolana, così le distinzioni che
la tastiera non permette di fare (щ contro ш, ы contro и) non ti penalizzano.
`зову́т`, `zovut`, `zovút`, `zavut`: passano tutte tranne l'ultima, che è
un'altra parola.

**L'accento tonico.** Non si scrive mai nei testi veri, cambia da forma a forma
e sposta il suono di tutte le vocali attorno: è l'informazione che manca sempre
e che serve sempre. Nel corpus si segna con un asterisco davanti alla vocale
(`теб*я`), diventa `тебя́` quando studi e sparisce nel confronto. Il validatore
controlla che ogni parola polisillabica ne abbia esattamente uno, che cada su
una vocale e che non finisca su una ё, che l'accento ce l'ha già per conto suo.

Ogni frase porta con sé una **riga di pronuncia** in caratteri latini, generata
dal testo accentato: `Как тебя́ зову́т?` diventa `kak tebiá zovút?`. È
un'approssimazione pensata per un lettore italiano, non una traslitterazione
scientifica.

### Lo svizzero tedesco, con tre avvertenze

Il dialetto è un caso a parte e l'app lo dice apertamente, sia in questa pagina
sia dentro la schermata di studio:

1. **Non esiste un solo svizzero tedesco.** Qui si usa il **züridütsch**, il
   dialetto di Zurigo: basilese, bernese e vallesano cambiano parecchio.
2. **Non esiste un'ortografia ufficiale.** Si segue la **grafia Dieth**, quella
   di SMS e cartelli: si scrive come si sente.
3. **Il QCER non certifica i dialetti.** I livelli A1-C2 servono solo da bande
   di difficoltà, per far girare la stessa macchina delle altre lingue.

Ogni frase in dialetto porta con sé **l'equivalente in tedesco standard**, che
compare accanto alla traduzione: è il ponte che rende visibile la regola —
`Trotz em Räge` contro `Trotz des Regens` dice in un colpo solo che il genitivo,
in Svizzera, non c'è. La voce sintetica usa `de-CH`, cioè tedesco standard
svizzero: va presa come indicazione, non come modello di pronuncia.

Per aggiungerne, basta una riga in `assets/js/corpus-de.js`, `corpus-gsw.js`,
`corpus-en.js` o `corpus-es.js`:

```js
['b1-46', 'B1', 'She talked us through it.', 'Ci ha spiegato tutto passo passo.',
 'phrasal verb', 'talked us through', ['lavoro'], 'talk somebody through = spiegare passo per passo.'],
```

In svizzero tedesco si aggiunge un nono campo con il tedesco standard.

Poi `node tools/validate-lingua.mjs` controlla che la chiave del cloze compaia
davvero nella frase, che il punto grammaticale sia nell'elenco, che i settori
esistano, che la lunghezza resti nella finestra 2-12 parole e che ogni frase in
dialetto abbia il suo equivalente standard.

## I dati

Tutto resta su questo dispositivo, in `localStorage`. Da *Impostazioni* si
esporta e si reimporta un backup JSON: conviene farlo prima di cambiare
telefono o svuotare i dati del browser.

## Provarla

I moduli JavaScript non funzionano aprendo il file da disco: serve un server.

```bash
python3 -m http.server 8080     # poi apri http://localhost:8080/lingua/
```

### Sull'iPhone

1. Pubblica la cartella (per esempio con **GitHub Pages**).
2. Apri l'indirizzo in Safari.
3. *Condividi ▸ Aggiungi a Home*: da lì parte a schermo intero e funziona offline.

### La voce

La voce sintetica usa `speechSynthesis` del sistema: su iOS le voci tedesca,
russa, inglese e spagnola sono già installate.

Ogni lingua ha il proprio **ritmo**, perché non si leggono tutte alla stessa
velocità: il russo sta al 72% della velocità impostata (a ritmo pieno, con le
vocali ridotte, è illeggibile per chi comincia), tedesco e svizzero tedesco
all'85%, inglese e spagnolo al 95%. Sopra c'è il moltiplicatore scelto da te.

Durante lo studio ogni frase ha due bottoni: **🔊 Ascolta** a velocità normale e
**🐢 Lento**, che scende ancora di un terzo e separa le parole una dall'altra per
costringere la sintesi a staccarle. Per il dialetto non esiste una voce
sintetica: si ripiega sul tedesco svizzero standard.

## Strumenti

```bash
node tools/validate-lingua.mjs     # corpus, motori, esercizi, taratura: 271 controlli
node tools/smoke-lingua.mjs        # prova end-to-end in Chromium (serve playwright)
python3 tools/make_icons_lingua.py # rigenera le icone PNG
```

## Perché dovrebbe funzionare

- **Cepeda et al. (2006)** — meta-analisi su 254 studi: a parità di tempo,
  distribuire le ripetizioni batte concentrarle.
- **Roediger & Karpicke (2006)** — testing effect: richiamare consolida più che
  rileggere. Per questo qui si scrive prima di vedere.
- **Bjork** — desirable difficulties: la carta torna quando ricordarla costa.
- **Ye et al. (2022-2024)** — FSRS: il modello di memoria usato qui.
- **Krashen (1985)** — input comprensibile "i+1": le frasi nuove escono appena
  sopra il livello stimato.
- **Wray (2002)**, **Ellis (2012)** — formulaic sequences: si impara a blocchi.
- **Nation (2001)** — la conoscenza ricettiva precede quella produttiva.
- **Rohrer & Taylor (2007)** — interleaving: mescolare conviene.
- **Lord (1980)**, **van der Linden & Glas (2000)** — test adattivi su IRT.
- **Koriat & Bjork (2005)**, **Dunlosky & Rawson (2012)** — illusione di
  competenza: perché l'autovalutazione qui non esiste.
- **Slamecka & Graf (1978)** — effetto generazione: si ricorda ciò che si produce.
- **Renkl & Atkinson (2003)** — fading: i buchi crescono col consolidarsi.
- **MacLeod et al. (2010)** — production effect: dirlo ad alta voce aiuta.
- **Consiglio d'Europa, QCER (2001/2020)** — la scala A1-C2 (che però i
  dialetti non li copre: per lo svizzero tedesco sono bande di difficoltà).
