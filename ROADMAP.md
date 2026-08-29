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
   più forte del gioco, e al tavolo non esiste. *(Tappa 4.)*
5. La difficoltà la insegue la macchina, non la sceglie un menù.
6. Le fonti restano utilizzabili anche se un giorno l'app si vende: CC0 e tavole
   dei finali sì, corpus «non commerciale» no — da escludere adesso, non dopo.
7. Nessuna dipendenza, nessun build, offline dopo la prima visita. Stockfish gira
   in fase di preparazione del corpus: nel repo finiscono numeri.

## I livelli

| | Livello | Uscita misurata |
| --- | --- | --- |
| L0 | Vista della scacchiera | 18/20 corrette, mediana sotto i 3 secondi |
| L1 | Non regalare pezzi | punteggio tattico ≥ 800, ≤ 1 errore su 20 item di sicurezza |
| L2 | I finali che si vincono a memoria | sei tecniche portate a casa senza perdere l'esito |
| L3 | I motivi tattici, mescolati | punteggio ≥ 1400 stabile, nessun motivo sotto il 60% |
| L4 | Calcolo e visualizzazione | sequenze di 4 semimosse alla cieca, 8 su 10 |
| L5 | Posizione e piani | 70% su item posizionali del proprio livello |
| L6 | Le aperture, come conseguenza | la linea a memoria **e** il piano nominato |
| L7 | Le proprie partite | nessuna: è il regime di crociera |

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

- [ ] **4. C'è o non c'è** — un quarto delle posizioni è quieto e la risposta
      giusta è «nessuna combinazione». Serve un criterio verificabile di
      «quieta»: una ricerca di quiescenza sul motore di casa, o una valutazione
      precalcolata. È la tappa che separa questa app da un allenatore di puzzle.

- [ ] **5. Test d'ingresso e profilo a quattro assi** — sicurezza, tattica,
      finali, posizione, misurati separatamente sullo stampo dell'Amsterdam
      Chess Test; il percorso si riordina attorno all'asse debole, come il
      settore riordina le unità in *Frasi*. *(Riuso di `lingua/assets/js/irt.js`.)*

- [ ] **6. Sicurezza e vista (L0-L1)** — item generati dal motore, senza corpus:
      colore della casa, cavallo in *n* mosse, chi attacca una casa, pezzi in
      presa, matto in uno.

- [ ] **7. Finali con la tavola (L2)** — giocati fino in fondo contro la difesa
      migliore, corretti **per esito** e non per mossa preferita.

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
