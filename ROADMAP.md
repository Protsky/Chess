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
7. **Un fatto e una previsione non si scrivono allo stesso modo.** Che una
   mossa perda materiale lo dimostra il motore; che tu la giochi lo stima un
   modello. Dove compare la seconda, l'app dice da dove viene.
8. **Non si misura sul materiale di allenamento.** Una parte del corpus non entra
   mai in sessione: serve solo agli esami, e ogni item d'esame si spende una
   volta sola.
9. **Una soglia si supera col limite inferiore dell'intervallo**, non con la
   stima migliore. Ventiquattro risposte lasciano un'incertezza di un centinaio
   di punti, e passare per fortuna in una giornata buona non è passare.
10. **Superato non è per sempre.** Sette e trenta giorni dopo, la stessa prova su
   materiale nuovo. Se non regge, il livello si riapre.
7. Nessuna dipendenza, nessun build, offline dopo la prima visita. Stockfish gira
   in fase di preparazione del corpus: nel repo finiscono numeri.

## I livelli

| | Livello | Uscita misurata (su posizioni **mai viste**) |
| --- | --- | --- |
| L0 | Vista della scacchiera | 18/20 all'esame **e** mediana sotto i 3 secondi anche li' |
| L1 | Non regalare pezzi | 19/20 controlli di sicurezza all'esame |
| L2 | I finali che si vincono a memoria | 3 finali di fila senza perdere l'esito (i sei sono l'accesso) |
| L3 | I motivi tattici, mescolati | esame a 1400 sul **limite inferiore** (17 giuste su 24; meta' delle volte a 1542), e nessun motivo sotto il 60% sulle ultime venti |
| L4 | Calcolo e visualizzazione | sequenze di 4 semimosse alla cieca, 8 su 10 |
| L5 | Posizione e piani | 70% su item posizionali del proprio livello |
| L6 | Le aperture, come conseguenza | 7 piani nominati su 8, su aperture della stessa famiglia |
| L7 | Il materiale nelle tue partite | nessuna: è il regime di crociera, e non ha esame perché i suoi item non possono certificare niente |

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

- [x] **1b. Le trappole del tuo livello** — la sola cosa dell'app che non si
      poteva fare col motore di casa, e per cui e' valsa la pena uscirne.
      Il problema: «questa posizione e' difficile» e «in questa posizione *tu*
      cadi» sono due affermazioni diverse, e la seconda ha bisogno di sapere che
      cosa gioca un essere umano di una certa forza — cosa che nessun motore sa,
      perche' i motori giocano bene.
      Fatto in due passi, tenuti separati di proposito. `tools/trappole-mosse.mjs`
      stabilisce un **fatto di scacchi**: in ogni posizione, quali mosse perdono
      materiale (ricerca esaustiva sulle mosse forzanti, `assets/js/forzante.js`,
      lo stesso conto che dichiara quiete le posizioni). `tools/trappole-maia.py`
      chiede a **Maia-2** — una rete addestrata su partite umane vere di Lichess,
      condizionata sul rating di chi muove — quanto spesso un giocatore di una
      certa fascia gioca proprio quelle mosse. La prima cosa e' verificabile, la
      seconda e' una previsione di comportamento, e l'app non le confonde mai:
      il numero e' sempre accompagnato da «stima di Maia-2, non un conteggio».
      L'esercizio che ne esce e' l'unico dell'app in cui non c'e' niente da
      trovare: c'e' qualcosa da **non fare**. La mossa che giochi la giudica il
      motore, con lo stesso conto della preparazione — Maia sceglie le posizioni
      e non giudica niente.
      Nel repo finiscono solo numeri: il modello (280 MB) e l'ambiente Python
      restano fuori, come Stockfish per il corpus tattico.
      Provato: 18.577 controlli in `validate-nuovo.mjs`, fra cui la copertura
      della distribuzione di Maia sulle mosse legali (1.000: se le chiavi non
      corrispondessero i numeri sarebbero zeri travestiti da misure, e lo
      strumento si ferma invece di scrivere) e la prova che in ogni trappola
      esiste almeno una mossa che perde **e** almeno una che regge.
      **Il limite, e sta scritto nell'app**: 231 trappole a 1100, 168 a 1300,
      94 a 1500, sei a 1700. Salendo si esauriscono, non perche' i forti non
      sbaglino ma perche' Maia distingue sempre meno fra fasce vicine. Le soglie
      sono rimaste strette (errore >= 30%, divario >= 10 punti): allargarle
      finche' il numero diventa grosso e' il modo classico di fabbricare una
      funzione che non c'e'.
      Corretto strada facendo: il primo criterio confrontava fasce **adiacenti**,
      e a duecento punti di distanza Maia distingue troppo poco - restavano
      trentadue posizioni in tutto. Il confronto giusto e' con la fascia piu'
      alta, ed e' una cosa che si e' vista misurando, non ragionando.

- [x] **1c. Il livello 1 dice chi te lo riprende** — la scena della ripresa
      partiva solo se il pezzo scelto era difeso: chi toccava un pezzo che non
      poteva nemmeno catturare non riceveva **nessuna** spiegazione, e restava
      con la domanda vera in mano. Anche nel caso «difeso», il difensore veniva
      solo nominato mentre sulla scacchiera si accendeva la casa dove ti
      riprendono — cioe' non quella che serviva vedere.
      Fatto: ogni casa toccata ha la sua risposta (vuota, tua, irraggiungibile,
      gratis ma di meno, difesa), i difensori si **accendono** tutti sulla
      posizione della domanda, e un bottone rifa' la scena invece di lasciarla
      scappare in cinque secondi.
      Trovati dal test, e sono due bug veri: i difensori li calcolavo sulla casa
      svuotata, e cosi' un pedone che difende in diagonale spariva mentre una
      spinta di pedone veniva contata come difesa (39 falsi difensori su sessanta
      item); e nel caso «difeso» vanno contati **dopo** la mia cattura, perche' il
      mio pezzo andandosene apre linee e libera difensori che prima non c'erano
      (altri 11).
      Provato: 3780 case toccate su item veri, ognuna con una spiegazione
      verificata rigiocando la ripresa sulla posizione vera.

- [x] **3h. La curva dell'esame, e i criteri che nessuno applicava** — nato da
      un'analisi multi-agente sull'app com'era, con verifica avversaria delle
      fonti. Quattro dei difetti trovati erano stati introdotti dalla tappa 3e,
      cioe' proprio da quella che doveva togliere i criteri dichiarati e non
      applicati. Vale la pena elencarli.
      **Il punto di mezzo.** L'app diceva «esame a 1400» e implementava un esame
      che a 1400 esatti si supera il **2,9%** delle volte: con ventiquattro item
      l'errore standard vale ottanta punti, e il limite inferiore se li porta
      dietro. Il cinquanta per cento si raggiunge a **1542**. Non e' un difetto
      da correggere abbassando la soglia — e' la prudenza scelta — ma un numero
      da scrivere accanto. Adesso `esame.js` lo calcola in modo **esatto**:
      nel modello di Rasch il punteggio dipende solo dal *numero* di risposte
      giuste, quindi la regola si riduce a «almeno 17 su 24» e la probabilita' e'
      una Poisson-binomiale sugli item veri. Niente simulazione, niente
      approssimazione.
      **La soglia d'accesso a L3** era `rating >= 1350`, dove l'esame si supera
      lo 0,5% delle volte: si bruciavano ventiquattro delle poche posizioni
      d'esame per un tentativo quasi certamente perso, cioe' l'opposto di quello
      che il commento dichiarava. Adesso la legge dalla curva.
      **La mediana di L0** era dichiarata da sempre («18 su 20, mediana sotto i
      3 secondi») e nel verdetto non entrava: la guardava solo l'accesso. Adesso
      un esame con 19 risposte giuste e mediana 4,5 s **non passa**, e l'esito
      dice che il problema e' il tempo.
      **Il pavimento per motivo** girava su tutto il registro (fino a 3000
      ripassi): un motivo sbagliato mesi prima restava nel denominatore per
      sempre, e teneva chiuso un livello su risposte vecchie. Adesso guarda le
      **ultime venti** risposte per motivo.
      **Il magazzino.** Il numero mostrato erano gli item dell'esame (sempre 24),
      non le scorte. Attorno a 1400 le posizioni d'esame sono **74** entro ±300,
      cioe' tre esami — quanti ne serve un percorso completo, con zero margine
      per una riapertura. Adesso l'app conta e mostra le scorte vere, e `componi`
      **non allarga piu' in silenzio** oltre ±300: prima arrivava a ±800, dove gli
      item non dicono piu' niente sulla soglia e l'intervallo si allarga proprio
      quando servirebbe stretto. Meglio un esame che non parte, dicendolo.
      **Accesso e uscita** sono adesso due righe distinte per ogni livello: L2
      dichiarava «sei finali» e l'esame ne chiedeva tre, L6 dichiarava «la linea
      e il piano» e l'esame era 7 su 8.
      Provato: 18.643 controlli in `validate-nuovo.mjs`, fra cui il confronto fra
      il conto esatto e una simulazione indipendente (entro 2 punti percentuali)
      e un test che, per ogni livello attivo, pretende che i numeri scritti nel
      testo siano quelli che decidono nel codice — cosi' il difetto non puo'
      rientrare una terza volta.

- [ ] **Arresto anticipato dell'esame — MISURATO E RESPINTO.** Fermarsi appena
      l'intervallo e' deciso avrebbe fatto scendere la lunghezza media da 24 a
      18,6 item, e le scorte sono la risorsa scarsa. Ma la simulazione dice che
      sposta la curva operativa fino a **8,4 punti percentuali**, e nel verso che
      rende l'esame piu' facile: guardare lo stesso intervallo dopo ogni risposta
      e' un test ripetuto. Il piano prevedeva di spedirlo solo se lo scarto
      restava sotto i 2 punti. Non ci sta, quindi non si spedisce, e un test lo
      blocca. (Scartato anche l'SPRT: la fonte che lo vendeva riporta lunghezze
      medie fra 22,7 e 33,5 item, cioe' **piu'** dei 24 fissi.)

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

- [x] **9. Il materiale nelle tue partite (L7)** — costruito, ma con il nome che
      il motore di casa consente davvero.
      Il piano diceva «l'app trova i punti dove la valutazione crolla». Non può:
      a runtime c'è solo il motore di casa, che conta i cambi su una casa e cerca
      le sequenze forzanti entro tre semimosse. Vede le sviste di materiale e i
      matti brevi; non vede un piano sbagliato, una struttura rovinata,
      un'iniziativa regalata, un finale a cinque pezzi. Chiamare «i tuoi crolli»
      un rilevatore di materiale sarebbe una previsione scritta come un fatto.
      Quindi il livello si chiama **Materiale nelle tue partite**, e la
      schermata elenca in testa che cosa trova e che cosa **non** trova. Un
      rilevatore incompleto vale come veto e mai come assoluzione: «non ho
      trovato niente» non vuol dire «hai giocato bene», e sta scritto.
      Fatto: `pgn.js` legge un file multipartita (commenti, varianti annidate,
      NAG, orologi `%clk`) e dichiara **lette + scartate = trovate**, con il
      motivo di ogni scarto; dal PGN entrano solo mosse, orologi e tag standard —
      nessun simbolo di valutazione e nessuna categoria della piattaforma
      d'origine, perché il giudizio del motore di qualcun altro non si riscrive
      come giudizio di questa app. `partite.js` trova le semimosse in cui hai
      perso materiale **e** in cui esisteva un'alternativa che non ne perdeva
      (dove tutte le mosse perdono, l'errore era prima). L'esercizio è quello
      delle trappole: «trova una mossa che non perde materiale», stesso giudice.
      Sotto cinque partite non si mostra nessuna percentuale: sarebbe rumore.
      Provato: 18.7k+ controlli, fra cui la pipeline vera su un PGN vero.

- [x] **La barriera di misura** — la regola «solo item con difficoltà misurata
      entrano nella stima» era scritta nei commenti e rispettata a mano.
      Adesso è codice (`calibrato.js`), e serviva prima di L7 per una ragione
      precisa: item scelti perché li hai sbagliati **tu** sono sistematicamente
      difficili per te, quindi non abbassano solo la stima — **restringono
      l'intervallo**, perché ogni item aggiunge informazione di Fisher. E
      siccome il criterio d'uscita è il limite inferiore dell'intervallo, non
      corromperebbero la stima: corromperebbero il test, che è peggio e si vede
      meno. La barriera poggia su due requisiti indipendenti, così cade solo se
      cadono entrambi: difficoltà ignota, e posizione già vissuta al tavolo. Il
      secondo chiude anche la scappatoia futura «installo un motore forte e li
      calibro a posteriori». `stima.js` non filtra più in silenzio: restituisce
      gli scarti col motivo.



- [ ] **10. Il controllo del modello** — la pagina che confronta la forza stimata
      dall'app con il punteggio online vero. Gli item Lichess hanno un punteggio
      calcolato su milioni di tentativi: la stima **può essere smentita**. Se
      divergono, ha torto l'app.

## Quello che questa iterazione ha lasciato aperto

Tre cose, e non sono dimenticanze: due hanno bisogno di scaricare qualcosa e una
di una decisione che non tocca a chi scrive il codice.

- **Le scorte d'esame.** Attorno a 1400 restano 74 posizioni entro ±300 punti,
  cioè tre esami — quanti ne serve un percorso completo, con zero margine per una
  riapertura. Ma è una penuria **rimovibile**: le 3235 posizioni sul disco sono
  lo 0,053% del database di Lichess (6.057.356 puzzle, CC0). Il CSV pesa 304 MB
  compressi e non è più sul disco. Rigenerando il corpus, e portandosi dietro la
  colonna `RatingDeviation` che oggi manca, la soglia dichiarata in
  `calibrato.js` smetterebbe di essere un debito e comincerebbe a filtrare.
- **La copertura di L6.** Si può misurare — dalle partite CC0 di Lichess, non da
  quelle dei puzzle — ma solo dichiarando *prima* i quattro parametri (mossa N,
  fascia Elo, controllo di tempo, colore): la stessa cifra può valere 20% o 80%
  a seconda di scelte fatte dopo aver visto il risultato.
- **L5.** Un pilota con Maia-2, già installata, direbbe se è costruibile: quante
  posizioni hanno una mossa di riferimento la cui probabilità **cresce** con la
  forza. Perché la strada ovvia («trova la mossa che il motore mette prima») non
  regge: l'accordo con la prima scelta del motore cresce di circa 1,2 punti
  percentuali ogni 100 Elo, che su 24 item binari fa 0,6 risposte attese ogni
  200 punti — sotto il rumore.

## Cosa non si promette, e va scritto nell'app

- **Nessun tempo.** Ore di pratica e forza correlano bene, ma con dispersione
  enorme fra persone (Campitelli & Gobet 2008); la pratica deliberata spiega
  circa un quarto della varianza nei giochi (Macnamara et al. 2014).
- **Nessun beneficio fuori dagli scacchi.** Controllando placebo e bias di
  pubblicazione, il transfer a scuola e cognizione generale è ~zero
  (Sala & Gobet 2017).
- **Nessuna sostituzione del gioco.** Una partita lunga a settimana, analizzata a
  mano *prima* di accendere il motore, resta la sorgente degli errori propri.
