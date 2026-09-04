# Percorso — da «Aperture di Scacchi» a un'app che insegna a giocare

Obiettivo: la stessa impalcatura di *Frasi* — test d'ingresso, percorso a livelli,
scheduler che comanda i ripassi, esercizi che si correggono da soli — applicata
agli scacchi, dove il giudice non è un'opinione ma la scacchiera.

Il piano per esteso, con le fonti:
<https://claude.ai/code/artifact/8b524346-40ff-4a8d-87be-5d016d9df86b>

Le 33 aperture non si buttano: scendono al **livello 6 di 8**. La forza si misura
su tattica, finali e posizione (Amsterdam Chess Test: van der Maas & Wagenmakers
2005), e lo studio serio da soli predice l'Elo meglio delle partite giocate
(Charness et al. 2005). Le aperture sono la parte del gioco che rende meno per
prima — ed è anche il pezzo di corpus più costoso da produrre, che c'è già.

Una tappa per iterazione. Ogni tappa finisce quando è **implementata, provata,
documentata e pubblicata**.

## Regole che valgono per ogni tappa

1. Nessun esercizio che chi studia possa correggere da sé: la mossa è giusta o no.
2. Nessun numero mostrato che non sia calcolato sui dati veri.
3. I motivi tattici si mescolano; le sessioni a tema singolo esistono solo come
   ripasso mirato, dichiarato tale.
4. Un item su quattro non ha nessuna tattica. «C'è sempre qualcosa» è l'indizio
   più forte del gioco, e al tavolo non esiste. *(Fatto: tappa 4.)*
5. La difficoltà la insegue la macchina, non la sceglie un menù.
6. Le fonti restano utilizzabili anche se un giorno l'app si vende: CC0 e tavole
   dei finali sì, corpus «non commerciale» no — da escludere adesso, non dopo.
7. **Non si misura sul materiale di allenamento.** Una parte del corpus non entra
   mai in sessione: serve solo agli esami, e ogni item d'esame si spende una
   volta sola.
8. **Una soglia si supera col limite inferiore dell'intervallo**, non con la
   stima migliore. Ventiquattro risposte lasciano un'incertezza di un centinaio
   di punti, e passare per fortuna in una giornata buona non è passare.
9. **Superato non è per sempre.** Sette e trenta giorni dopo, la stessa prova su
   materiale nuovo. Se non regge, il livello si riapre.
7. Nessuna dipendenza, nessun build, offline dopo la prima visita. Stockfish gira
   in fase di preparazione del corpus: nel repo finiscono numeri.

## I livelli

| | Livello | Uscita misurata (su posizioni **mai viste**) |
| --- | --- | --- |
| L0 | Vista della scacchiera | 18/20 all'esame, mediana sotto i 3 secondi |
| L1 | Non regalare pezzi | 19/20 controlli di sicurezza all'esame |
| L2 | I finali che si vincono a memoria | sei tecniche portate a casa senza perdere l'esito |
| L3 | I motivi tattici, mescolati | esame a 1400: **il limite inferiore** dell'intervallo lo supera, e nessun motivo sotto il 60% |
| L4 | Calcolo e visualizzazione | sequenze di 4 semimosse alla cieca, 8 su 10 |
| L5 | Posizione e piani | 70% su item posizionali del proprio livello |
| L6 | Le aperture, come conseguenza | la linea a memoria **e** il piano nominato |
| L7 | Le proprie partite | nessuna: è il regime di crociera |

E nessun livello resta superato per decreto: a **sette e a trenta giorni** l'app
lo richiede su materiale nuovo, e se non regge il livello si riapre.

## Tappe

- [x] **1. Le carte al posto delle stelle** — `store.js` v2: ogni item ha uno
      stato di memoria FSRS (stabilità, difficoltà, scadenza) e i progressi della
      v1 si migrano senza perdite. Da qui l'app ha una coda governata dalle
      scadenze, non un elenco da scorrere.
      Fatto: `assets/js/fsrs.js` (stesso motore di *Frasi*, copiato di proposito:
      le due app vivranno in repo diversi), chiave `aperture-scacchi/v2`, la v1
      resta intatta sul dispositivo e viene letta finché serve.

- [x] **2. Il corpus tattico** — `tools/build-puzzles.mjs` estrae dal database
      aperto di Lichess (6.100.960 righe lette, CC0) un sottoinsieme
      **stratificato per fascia di punteggio e motivo**: 3235 posizioni, 468 kB,
      190 per fascia da 100 punti dove il materiale c'è. Scelta deterministica.
      Provato: `tools/validate-puzzles.mjs` rigioca ogni soluzione sul motore —
      29.900 controlli, nessuna mossa illegale, i matti annunciati sono matti.
      Da dire: sotto i 700 punti le quote non si riempiono (il database ha poco
      materiale che superi i filtri di qualità), e lo strumento lo stampa.

- [x] **3. Trova la mossa, e un punteggio che si muove** — l'esercizio nuovo
      sulla scacchiera che c'era già: aggiornamento alla Elo su giocatore **e**
      item a ogni risposta, materiale nuovo pescato dove si risolve circa tre su
      quattro, motivi mescolati, tema svelato solo dopo la risposta, voto dedotto
      dall'esito (mai chiesto), carte sbagliate che rientrano nella sessione.
      Provato in `tools/validate-percorso.mjs` (59 controlli, compresa una
      simulazione di 300 risposte: forza vera 1450 → stimata 1412, giuste a
      regime 76%) e sul percorso vero nel browser: migrazione dalla v1, mossa
      sbagliata, mossa giusta, risposta dell'avversario, seconda mossa, esito
      salvato, sessione portata fino al riepilogo.
      Corretto strada facendo: il rientro di una carta non conta una seconda
      volta per il punteggio (non è una prova indipendente), e la sessione non
      cresce oltre 20 posizioni.

- [x] **3b. Il quaderno: registro, statistiche, taratura e backup** — la parte
      di *Frasi* che rende controllabile lo scheduler, portata di qua.
      Fatto: registro dei ripassi (fino a 3000, con voto, scadenza, motivo e
      punteggio); pagina **Statistiche** con ritenzione vera contro ritenzione
      richiesta, risposte per giorno, scadenze in arrivo, andamento del
      punteggio e motivi deboli; **taratura di FSRS sui propri ripassi**
      (`optimizer.js`, discesa a coordinate, soglia dichiarata a 120 ripassi)
      con errore di previsione prima/dopo e curva di calibrazione; due
      impostazioni che contano davvero — posizioni nuove al giorno e ritenzione
      richiesta — e una schermata «per oggi basta» che spiega perché il tetto
      esiste, invece di una coda vuota; **backup** in JSON, esportabile su file
      o negli appunti, reimportabile da file o incollato, con anteprima di che
      cosa contiene e conferma prima di sovrascrivere.
      Provato: 83 controlli in `validate-percorso.mjs` (registro, statistiche,
      ottimizzatore che non peggiora le previsioni, andata e ritorno del backup,
      quattro file non validi respinti) e nel browser — segmenti che scrivono le
      impostazioni, azzeramento e reimport, tetto giornaliero che ferma la
      sessione, forzatura che la riapre.

- [x] **3c. La home diventa il percorso** — apriva su «Impara le aperture», che
      è il livello 6 di 8: il posto sbagliato da cui cominciare, e nessuna
      indicazione di che cosa fare oggi.
      Fatto: la home ora apre su **la sessione di oggi** (scadenze + materiale
      nuovo che il tetto concede, durata stimata, un bottone solo), poi mostra
      **gli otto livelli** con criterio d'uscita, avanzamento misurato su quelli
      costruiti e «in arrivo» sugli altri sei — un percorso monco mostrato è
      meglio di un percorso nascosto. Le aperture hanno una schermata loro
      (`#/aperture`, marcata livello 6) sotto *Studio*, insieme alla tattica;
      statistiche e backup stanno sotto *Il quaderno*. Tre stati della home:
      prima sessione, sessione del giorno, tetto raggiunto (e allora il bottone
      propone l'apertura con meno stelle).
      Provato: 96 controlli in `validate-percorso.mjs` (fra cui: attivi solo i
      livelli davvero costruiti, nessun avanzamento inventato per gli altri, i
      numeri della sessione di oggi nei quattro casi limite) e nel browser i tre
      stati, con la navigazione home → aperture → livello → allenamento.

- [x] **3d. I progressi non stanno più solo sul telefono** — il backup su file
      c'era già, ma va ricordato, e chi si ricorda di fare un backup non è chi ne
      ha bisogno. Ora c'è un deposito: un Worker su Cloudflare con un namespace
      KV, un valore JSON per codice. (KV e non R2: il dato è piccolo e scritto di
      rado, e R2 chiede un metodo di pagamento anche nel piano gratuito.)
      Fatto: codice di sedici caratteri dal generatore crittografico (nessun
      account, nessuna email); invio automatico a fine sessione; ripresa su un
      altro dispositivo scrivendo il codice; e soprattutto **unione** invece di
      sovrascrittura — carte per data di ripasso, registro senza doppioni,
      conteggi dal salvataggio con più risposte, impostazioni locali.
      Provato: 156 controlli in `validate-percorso.mjs` (dodici sull'unione, coi
      due salvataggi che restano intatti) e nel browser il giro completo contro
      un deposito finto: attivazione, salvataggio, telefono vuoto che scrive il
      codice e si ritrova 4 carte, sessione che si salva da sola senza toccare
      niente. **Non provato**: il Worker vero su KV — serve il namespace, che si
      crea con le credenziali di Gionata. Finché non c'è, il binding resta
      commentato in `wrangler.jsonc`: il sito si pubblica e le rotte /api
      rispondono 503 col motivo.
      Da dire, e sta scritto nell'app: il codice è la chiave, e chi ce l'ha vede
      quei progressi.

- [x] **4. C'è o non c'è** — un quarto delle posizioni è quieto e la risposta
      giusta è «nessuna combinazione».
      Fatto: `tools/build-quiete.mjs` prende le posizioni finali delle soluzioni
      del corpus (partite vere, CC0) e ne tiene **656** con un criterio che si
      può controllare invece di credere: *nessuna sequenza di catture e scacchi
      entro tre semimosse guadagna due pedoni, per nessuno dei due colori*, e
      materiale pari entro tre pedoni. È una ricerca esaustiva sulle mosse
      forzanti, non una stima. In sessione sono una su quattro, distribuite a
      passo regolare (la loro posizione non deve diventare a sua volta un
      indizio), e la risposta è un bottone: «nessuna combinazione».
      Provato: tutte e 656 ricontrollate in `validate-nuovo.mjs` con una ricerca
      indipendente, e nel browser la sessione mista.
      Da dire, e sta scritto nell'app: un piano lento che vince un pedone in sei
      mosse non è una tattica, e questo criterio non lo vede.

- [x] **3e. L'esame, e la differenza fra sapere e aver appena ripassato** — il
      difetto più grosso che l'app avesse, e stava in bella vista: l'uscita da un
      livello si misurava sulle ultime venti risposte del registro, cioè su carte
      che FSRS aveva programmato **proprio perché** stavano per essere ricordate.
      E il criterio scritto di L3 («nessun motivo sotto il 60%») non lo faceva
      rispettare nessuno: `avanzamenti()` guardava solo il punteggio.
      Fatto: `esame.js` tiene fuori dall'allenamento l'8% del corpus (247
      posizioni, divisione deterministica sull'identificativo, così due
      dispositivi che si sincronizzano tengono fuori le stesse); `stima.js`
      stima la forza per massima verosimiglianza sugli item di difficoltà nota e
      ne dà l'**intervallo di confidenza**, con le due code dichiarate sature
      invece che stampate come un punto; il verdetto guarda il **limite
      inferiore** e il pavimento per motivo, e servono tutte e due. Un item
      d'esame si spende una volta sola. E ogni livello superato torna
      «da riverificare» a 7 e a 30 giorni: se la tenuta non regge, si riapre.
      Provato: 11.100 controlli in `tools/validate-nuovo.mjs`, fra cui la
      **copertura misurata** dell'intervallo (95,6% su 3000 simulazioni: se
      dichiara 95 deve coprire 95) e la prova che la coda di allenamento non
      contiene mai una posizione d'esame. Nel browser: esame di L0 giocato per
      intero, verdetto con i motivi sotto il pavimento nominati, prova di tenuta
      che compare a otto giorni.
      Trovato correggendo: il segno del bordo saturato era rovesciato, e un
      esame perfetto non superava la propria soglia.

- [x] **3f. La stessa tattica, ma non la stessa fotografia** — i puzzle si
      imparano come immagini, ed è il motivo per cui Lichess esclude dal
      punteggio quelli già giocati.
      Fatto: `mirror.js` specchia le colonne e ribalta traverse e colori; dal
      primo ripasso in poi la posizione si vede trasformata, in modo
      deterministico. Chi ha ancora l'arrocco resta fuori dalla specchiatura
      invece che falsificato.
      Provato: 6115 posizioni trasformate e **rigiocate sul motore**, più
      l'involuzione (trasformare due volte torna all'originale).

- [x] **3g. La confutazione giocata, e quanto eri sicuro** — davanti a una mossa
      sbagliata l'app diceva «non è la mossa». Adesso la scacchiera **gioca** la
      punizione: `see.js` conta il cambio statico sulla casa e trova il matto in
      una, quindi la punizione è un fatto, non un'opinione — e se non c'è, lo
      dice invece di inventarla. Prima di sapere com'è andata si dichiara quanto
      si era sicuri: un errore fatto da sicuri torna prima (ipercorrezione), e a
      fine sessione l'app dice quante volte «sicuro» aveva ragione.
      Provato: il cambio statico contro conti fatti a mano, e su 749 posizioni
      del corpus in cui un pezzo restava davvero in presa la confutazione è stata
      trovata tutte le volte.
      Trovato correggendo: contavo gli attaccanti con la geometria pura, quindi
      un pezzo «in presa» da un attaccante inchiodato risultava in presa. Ora si
      guardano solo le catture legali.

- [x] **4b. Il livello 4 esiste** — `calcolo.js`: la posizione si guarda per
      qualche secondo, poi i pezzi spariscono e le mosse si giocano a memoria; la
      risposta dell'avversario arriva scritta. La scala sale a 2, 4 e 6
      semimosse da sola, sui propri risultati.
      Trovato provando nel browser: spegnevo la scacchiera mettendoci una FEN
      vuota, e così sparivano anche le mosse legali — la risposta non si poteva
      proprio dare. Ora la posizione resta e sparisce solo il disegno.

- [x] **4c. La ricostruzione a cinque secondi (L0)** — l'esperimento di Chase e
      Simon come esercizio: la posizione per cinque secondi, poi la rimetti.
      Accanto alle posizioni vere ce ne sono di **casuali con gli stessi pezzi**,
      perché il numero da solo non direbbe niente: su quelle non migliora
      nessuno, e il divario fra le due colonne è la parte che l'esperienza
      costruisce.

- [x] **6b. Il piano nominato (L6)** — il criterio era «la linea a memoria **e**
      il piano»: la seconda metà era testo che si legge nella schermata di
      studio, e nessuno tornava mai a chiederlo. Ora è una domanda, con le
      alternative prese dalle aperture della **stessa famiglia** — strutture
      simili, dove i piani si confondono davvero.

- [x] **8b. Il regime: dove va il tempo, e quando fermarsi** — `regime.js`
      calcola sui **propri** dati la curva di fatica (prima metà contro seconda,
      a parità di difficoltà del materiale), l'effetto delle sconfitte di fila e
      i minuti spesi per livello con i punti guadagnati per ora. Sotto il minimo
      di dati non stampa un numero: dice quanti ne mancano. Nessuna media di
      popolazione usata come tappabuchi — il tilt, nei dati per giocatore, è una
      cosa di alcuni e non una legge.

- [ ] **5. Test d'ingresso e profilo a quattro assi** — sicurezza, tattica,
      finali, posizione, misurati separatamente sullo stampo dell'Amsterdam
      Chess Test; il percorso si riordina attorno all'asse debole, come il
      settore riordina le unità in *Frasi*. *(Riuso di `lingua/assets/js/irt.js`.)*

- [x] **6. Sicurezza e vista (L0-L1)** — *portata avanti nell'ordine*, perché
      l'app faceva cominciare dalla tattica: misurate, le prime quaranta
      posizioni che serviva a un principiante erano nove sacrifici, sette
      forchette e due mosse in media da trovare. Il primo gradino non c'era.
      Fatto: `basics.js` genera gli item dal motore, senza corpus — colore della
      casa, nome della casa illuminata, salti del cavallo (visita in ampiezza) —
      e ricava da posizioni vere «quale pezzo puoi prendere senza perdere
      niente», dove *gratis* vuol dire cattura **legale** su una casa che
      nessuno difende, calcolato e non stimato (`attackersOf` nuovo nel motore).
      In più: partenza morbida della tattica (finché il punteggio è provvisorio,
      solo posizioni a una mossa e motivi elementari) e criteri d'uscita letti
      dal registro — 18 su 20 con mediana sotto i 3 secondi per L0, punteggio
      800 e al massimo un errore sulle ultime venti per L1.
      Provato: 119 controlli in `validate-percorso.mjs` (fra cui il ricalcolo
      indipendente di ogni distanza del cavallo, di ogni colore di casa e di
      tutte le catture del livello 1) e nel browser una sessione intera di L0
      con le risposte ricalcolate dal test, tre item di L1 risolti e uno
      sbagliato di proposito.
      Trovati e corretti mentre si provava: alcune domande sul cavallo non
      avevano nessuna risposta giusta fra le opzioni (la distanza massima è sei,
      le opzioni arrivavano a quattro), e le prime sei domande erano tutte dello
      stesso tipo perché il serbatoio non era mescolato.

- [x] **7. Finali con la tavola (L2)** — la tavola dei finali a tre pezzi, fatta
      in casa: `tools/build-endgames.mjs` la genera con analisi retrograda
      (345.404 posizioni vinte con la Donna, 376.868 con la Torre; matto più
      lungo 10 e 16 mosse, cioè i numeri da manuale). Ridotta con le otto
      simmetrie e spedita solo per metà — il valore col Bianco al tratto si
      ricava in una mossa — sta in **89 kB** invece di 3,5 MB.
      Fatto: una mossa che perde il matto forzato **non viene giocata**, si
      annulla e si spiega perché; ogni mossa che lo mantiene è accettata anche se
      allunga (si corregge l'esito, non lo stile, e se allunga lo dice); il Nero
      difende al meglio possibile; si gioca fino al matto, che è la parte che di
      solito non si sa fare. Si esce con sei finali portati a casa senza mai
      perdere l'esito.
      Provato: 126 controlli in `validate-percorso.mjs`, fra cui **tutti gli 80
      finali giocati fino in fondo** con la tavola da una parte e la difesa
      migliore dall'altra — il matto arriva esattamente nelle semimosse
      annunciate — e i due massimi da manuale ricalcolati sulla tavola letta a
      runtime. Nel browser: una mossa che buttava la vittoria rifiutata e
      annullata, tre finali giocati, due puliti, il riepilogo che conta solo
      quelli senza errori.
      Da dire: opposizione, Lucena e Philidor hanno quattro o cinque pezzi (una
      tavola molto più grande) e **non ci sono**. È scritto nell'app, in fondo
      alla sessione, invece di lasciar credere che il livello le alleni.
      Corretti mentre si costruiva: la propagazione retrograda si fermava dopo
      due passate (i valori del Bianco sono dispari e quelli del Nero pari, e
      cercare «esattamente d» salta un giro su due), e il triangolo delle
      simmetrie usciva annidato nel file generato, così a runtime la tavola
      sembrava tutta illegale.

- [ ] **8. Le aperture rifatte (L6)** — repertorio ristretto (una col Bianco, due
      col Nero), ogni linea legata alla struttura di mediogioco che genera, e
      **punisci la deviazione**: l'avversario esce dal libro alla quarta mossa,
      che è ciò che succede quasi sempre.

- [ ] **9. Importa le tue partite (L7)** — PGN incollato o utente Lichess: l'app
      trova i punti dove la valutazione crolla e fabbrica carte con la posizione
      immediatamente prima dell'errore.

- [ ] **10. Il controllo del modello** — la pagina che confronta la forza stimata
      dall'app con il punteggio online vero. Gli item Lichess hanno un punteggio
      calcolato su milioni di tentativi: la stima **può essere smentita**. Se
      divergono, ha torto l'app.

## Cosa non si promette, e va scritto nell'app

- **Nessun tempo.** Ore di pratica e forza correlano bene, ma con dispersione
  enorme fra persone (Campitelli & Gobet 2008); la pratica deliberata spiega
  circa un quarto della varianza nei giochi (Macnamara et al. 2014).
- **Nessun beneficio fuori dagli scacchi.** Controllando placebo e bias di
  pubblicazione, il transfer a scuola e cognizione generale è ~zero
  (Sala & Gobet 2017).
- **Nessuna sostituzione del gioco.** Una partita lunga a settimana, analizzata a
  mano *prima* di accendere il motore, resta la sorgente degli errori propri.
