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
| 🔗 | **Abbina** — sei coppie da chiudere a tocchi | coppia giusta o sbagliata |
| 👂 | **Riconosci** — quattro possibilità, una giusta | scelta giusta o sbagliata |
| 🧩 | **Componi** — tessere da rimettere in fila, due di troppo | ordine esatto |
| ✏️ | **Completa** — buchi che aumentano col consolidarsi della carta | parola per parola |
| 🗣️ | **Produci** — la frase intera, scritta o dettata a voce | confronto completo |
| 🎧 | **Ascolta e scrivi** — una produzione su tre arriva senza testo, solo audio | confronto completo |

### L'abbinamento che apre la sessione

Quando in coda ci sono almeno quattro riconoscimenti, la sessione si apre con
un **abbinamento a sei coppie**: si tocca la frase in italiano, si tocca la sua
traduzione, e la coppia si chiude.

Non è un tipo di carta nuovo — è un altro modo di far sostenere lo stesso
riconoscimento a sei carte insieme, e ognuna esce con il voto che si è preso:
**al primo colpo** → Bene, **dopo un errore** → Difficile, **dopo due** → Di
nuovo. Il vantaggio non è la velocità: è che i cinque distrattori sono frasi
vere, presenti sullo schermo nello stesso momento, quindi il richiamo avviene
**sotto interferenza** invece che contro tre opzioni pescate a caso. Si spegne
dalle impostazioni.

### Ascolta e scrivi

Una produzione su tre arriva **senza il testo italiano**: solo un bottone
grande, l'audio, e il campo dove scrivere quello che hai sentito. Decidere
quale tocca a chi è deterministico (dipende dal seme della carta), e succede
solo se una voce c'è: senza audio la carta resta una produzione normale.

È il gradino che mancava fra il capire e il produrre — decodificare il parlato
e riscriverlo mette insieme le due cose — e su una lingua con un altro alfabeto
è l'unico esercizio che lega davvero il suono alla forma scritta.

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

Quando indovini la carta successiva **arriva da sola** (aspettando che l'audio,
se parte, finisca di leggere: tagliare a metà la parola che stai imparando è
peggio del tocco che ti si risparmia) (una
barra sul bottone lo dice, e toccando *Avanti* la anticipi): se hai indovinato
non c'è niente da leggere, e un tocco di conferma per ognuna delle venti carte
di una sessione sono venti tocchi di troppo. Quando sbagli si aspetta sempre,
perché lì la correzione è l'unica parte che conta.

Qui il voto **scende dall'esito**: tutto giusto → *Bene*, parole giuste e forma
sbagliata → *Difficile*, manca qualcosa → *Di nuovo*. Resta un bottone per
correggerlo a mano — *Facile* nessuna macchina può indovinarlo — ma la
condizione normale è che tu non debba giudicarti.

### I buchi che crescono, e che si spostano

Il cloze non ha un numero fisso di buchi: ne ha **uno** quando la carta è nuova
e arriva a **metà frase** quando è solida, con il primo buco sempre sulla chiave
grammaticale. È il *fading* dell'impalcatura di Renkl & Atkinson (2003): l'aiuto
si ritira mentre la memoria regge da sola, e la stessa frase resta un esercizio
utile invece di diventare un automatismo.

I buchi in più, però, non cadono a caso: **la carta si ricorda le parole che hai
sbagliato** e li mette lì. Rendere difficile tutto non serve — serve rendere
difficile il punto che cede. È il principio delle difficoltà desiderabili
puntato dove l'errore è già avvenuto, invece che sparso a caso sulla frase.

### La stessa regola in frasi diverse

Quando si sceglie una frase nuova non conta solo il livello e il settore: conta
anche il punto grammaticale. Una regola **mai incontrata** allarga il repertorio;
una regola **già incontrata ma ancora fragile** (stabilità media sotto i 7
giorni) ha bisogno di *un altro esempio*, non della stessa frase ripetuta. È
così che una struttura diventa una regola invece che una frase imparata a
memoria — la variabilità degli esempi è ciò che permette di generalizzarla.

### La voce

Nel passaggio di produzione puoi **dettare la frase** invece di scriverla:
`SpeechRecognition` la trascrive e il confronto è lo stesso di una risposta
scritta. Non è solo comodità — pronunciare ad alta voce quello che si studia lo
fa ricordare meglio del solo leggerlo (*production effect*, MacLeod et al.
2010). Fra le trascrizioni proposte dal motore viene scelta la più vicina alla
frase attesa, così un omofono non conta come errore. Dove il browser non
trascrive (fuori da Safari e Chrome) il microfono non compare nemmeno.

## I grafici: far vedere il modello, non decorarlo

I *Progressi* non sono una bacheca di numeri motivazionali. Ogni grafico
risponde a una domanda che riguarda il modello:

| Grafico | Domanda |
| --- | --- |
| **La tua curva dell'oblio** | come decide, il modello, quando ti ripropone una carta? |
| **Calibrazione** | quando dice "85%", ci azzecca l'85% delle volte? |
| **Il prezzo della ritenzione** | quanto costa ogni scelta che posso fare? |
| **Ripassi fatti / Carico in arrivo** | quanto sto spendendo e quanto spenderò? |
| **Parole diverse incontrate** | quanto lessico diverso mi è passato davanti? |
| **Mappa della grammatica** | quali regole reggono e quali no? |

La curva dell'oblio non è un'illustrazione presa da un libro: è
`R(t) = (1 + 19/81 · t/S)^-0.5` calcolata con **la stabilità mediana del tuo
mazzo** e **i tuoi pesi**, con segnata sopra la soglia di ritenzione che hai
chiesto e il punto in cui la carta torna. La mappa della grammatica è
interattiva: si tocca un punto e si aprono le frasi che lo contengono.

### I colori sono calcolati, non scelti a occhio

La serie categorica e la rampa sequenziale passano i controlli misurabili
contro la superficie scura dell'app: banda di luminosità OKLCH, soglia di
croma, **separazione sotto daltonismo** (protanopia e deuteranopia, ΔE ≥ 8 in
OKLab) e contrasto. L'identità non è mai affidata al solo colore — ogni serie
ha la sua etichetta in legenda, e ogni segno scrive il proprio valore quando lo
tocchi, perché su un telefono il passaggio del mouse non esiste. Nessun grafico
ha due scale sullo stesso asse: dove servono due grandezze diverse (il prezzo
della ritenzione) ci sono due grafici uno sotto l'altro.

## Obiettivo del giorno, punti e serie

In cima alla home c'è un anello: i punti di oggi contro l'obiettivo che hai
scelto (60, 120, 200 o 300, cioè da sei a trenta carte). A fine sessione
l'anello si riempie, con un suono breve e diverso quando l'obiettivo è appena
stato raggiunto.

La regola che tiene la cosa onesta: **dieci punti per ogni carta portata a
termine, giusta o sbagliata che sia**, più venti una volta al giorno quando
svuoti i ripassi in scadenza. Premiare la risposta giusta spingerebbe a
scegliere gli esercizi facili e a evitare quelli che insegnano di più — cioè
esattamente il contrario di quello che serve. Chi sbaglia una carta difficile
ha lavorato quanto chi ne indovina una facile.

Sul perché esiste, senza gonfiare: fissare un obiettivo esplicito e un po'
sopra la comodità è una delle poche leve motivazionali con basi solide (Locke &
Latham, 2002). Punti e serie di giorni sono un'impalcatura più debole: aiutano
a presentarsi, non a imparare, e la letteratura sulla gamification è molto meno
univoca di quanto il marketing lasci credere. Stanno lì per quello, e per
niente di più — e non toccano in nessun modo lo scheduler.

I suoni si spengono dalle impostazioni, e si tacciono da soli quando il sistema
chiede meno movimento (`prefers-reduced-motion`), insieme alle animazioni.

## Il criterio di sessione

Quante volte devi azzeccare una carta prima che la sessione la lasci andare:
**una** (di serie) o **due**. Con due, dopo un richiamo corretto la carta torna
qualche posizione più avanti e va richiamata di nuovo prima di uscire.

È il *successive relearning* di Rawson & Dunlosky (2011) e Rawson, Dunlosky &
Sciartelli (2013): portare ogni elemento a un criterio di richiamo dentro la
sessione, e poi ripetere la cosa nelle sessioni successive, regge a mesi di
distanza molto meglio del richiamo singolo. Il secondo richiamo costa poco —
la carta è appena stata richiamata — e rende molto. In cambio le sessioni si
allungano, quindi la scelta resta esplicita.

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

Tutto resta su questo dispositivo, in `localStorage`. L'unica cosa che esce è
la frase da leggere ad alta voce, e solo se la voce online è accesa. Da *Impostazioni* si
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
costringere la sintesi a staccarle.

### Voce online, quando quella del telefono non basta

`speechSynthesis` legge con le voci installate sul dispositivo, e su iPhone
Safari per il russo ne espone **una sola**: la Milena compatta. Le versioni
migliorate scaricate da *Accessibilità ▸ Contenuto letto* quasi mai arrivano al
browser, e dal lato del codice non c'è modo di forzarle.

Quindi si prende la voce da un'altra parte. Google Translate espone un endpoint
di sintesi **pubblico e senza chiave** — lo stesso che pronuncia le traduzioni
sul loro sito — che restituisce un mp3 di una voce neurale:

```
https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q=…
```

Non serve libreria né registrazione: basta un `<audio>` che punti lì. È attivo
di serie sul **russo** e si può accendere su qualunque lingua da *Impostazioni
▸ Voce*, con un bottone per provarlo e vedere subito se risponde.

Il prezzo, per intero:

- **serve la connessione.** Senza rete l'app continua a funzionare con la voce
  del telefono;
- **la frase viaggia fino a Google.** Sono frasi di un corpus pubblico, non
  roba tua, ma va detto. La pagina è servita con `referrer: no-referrer`, così
  non parte nemmeno l'indirizzo da cui arriva la richiesta;
- **non è un servizio documentato.** Può rallentare, limitare le richieste o
  sparire. Per questo ogni riproduzione ha un ripiego immediato: al primo
  fallimento l'online si spegne per il resto della sessione e si torna alla
  voce locale, senza attese;
- **non essendoci CORS** l'mp3 non si può leggere via `fetch`, quindi non
  finisce nella cache offline dell'app: resta la cache HTTP del browser, che
  copre i riascolti ravvicinati.

Questa parte è l'unica del progetto che dipende da un servizio esterno, e
l'unica che le prove automatiche non possono verificare fino in fondo: si
controlla che l'indirizzo sia ben formato, che il cirillico sopravviva alla
codifica, che le frasi stiano sotto il limite di caratteri del servizio e —
questo sì, per davvero, perché nell'ambiente di prova la rete non c'è — che
**il ripiego funzioni**: senza connessione l'app lo dice e continua con la voce
del telefono, senza errori.

### Ascolto guidato

Vale con qualunque voce, ed è complementare:

- **👣 Parola per parola** legge una parola alla volta, ognuna come frase a sé,
  con una pausa vera in mezzo, e **illumina la parola mentre la pronuncia**;
- **toccando una parola qualsiasi** della frase si sente solo quella, quante
  volte si vuole.

Su una lingua nuova — a maggior ragione in un altro alfabeto — metà del
problema non è come suona la voce: è la **segmentazione**, cioè sentire dove
finisce una parola e comincia l'altra dentro una frase letta di fila. Un canale
doppio, che si sente e si vede allo stesso tempo, lega il suono alla forma
scritta.

Restano regolabili velocità (con il moltiplicatore per lingua) e **tono**.

 Per il dialetto non esiste una voce
sintetica: si ripiega sul tedesco svizzero standard.

## Strumenti

```bash
node tools/validate-lingua.mjs     # corpus, motori, esercizi, taratura, voce: 314 controlli
node tools/smoke-lingua.mjs        # 115 controlli end-to-end in Chromium
node tools/smoke-lingua.mjs        # prova end-to-end in Chromium (serve playwright)
python3 tools/make_icons_lingua.py # rigenera le icone PNG
```

## Perché dovrebbe funzionare

- **Cepeda et al. (2006)** — meta-analisi su 254 studi: a parità di tempo,
  distribuire le ripetizioni batte concentrarle.
- **Roediger & Karpicke (2006)** — testing effect: richiamare consolida più che
  rileggere. Per questo qui si scrive prima di vedere.
- **Richland, Kornell & Kao (2009)**, **Carpenter & Toftness (2017)** —
  prequestioning: tentare prima di sapere migliora ciò che si impara subito
  dopo. Una frase nuova non viene mostrata, viene chiesta.
- **Morris, Bransford & Franks (1977)** — transfer-appropriate processing:
  l'esercizio deve somigliare all'uso. Da qui la scala "parlare".
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
- **Rawson & Dunlosky (2011)**, **Rawson, Dunlosky & Sciartelli (2013)** —
  successive relearning: il criterio di sessione a due richiami.
- **Nation** — copertura lessicale: si conta il lessico per tipi diversi.
- **Consiglio d'Europa, QCER (2001/2020)** — la scala A1-C2 (che però i
  dialetti non li copre: per lo svizzero tedesco sono bande di difficoltà).
