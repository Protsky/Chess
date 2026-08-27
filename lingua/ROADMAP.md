# Percorso — verso un'app che si usa come Duolingo

Obiettivo: la scorrevolezza e l'invito a tornare di un'app di massa, senza
buttare via quello che c'è sotto — scheduler tarabile, esercizi che si
correggono da soli, niente numeri che mentono.

Una tappa per iterazione. Ogni tappa finisce quando è **implementata, provata
(`validate-lingua` + `smoke-lingua`), documentata e pubblicata**.

## Regole che valgono per ogni tappa

1. Niente che premi la risposta giusta più della risposta data: i punti non
   devono spingere verso l'esercizio facile.
2. Niente numero mostrato che non sia calcolato sui dati veri.
3. Ogni aggiunta motivazionale dichiara quanto vale: la letteratura sulla
   gamification è meno univoca di quanto il marketing lasci credere.
4. Ogni esercizio nuovo deve essere correggibile dalla macchina.
5. Movimento e suono si spengono con `prefers-reduced-motion`.

## Tappe

- [x] **1. Obiettivo del giorno** — anello dei punti in home, obiettivo
      scegliibile, chiusura di sessione con animazione e suoni, serie di giorni.
      *(Locke & Latham 2002 sugli obiettivi; il resto dichiarato come
      impalcatura.)*

- [ ] **2. Abbina** — esercizio a coppie da toccare, italiano contro lingua,
      sei coppie mescolate. Veloce, adatto all'inizio di una sessione, e
      correggibile in modo secco. *(Riconoscimento sotto interferenza: le
      coppie sbagliate sono distrattori attivi, non decorazione.)*

- [ ] **3. Ascolta e scrivi** — dettatura pura: nessun testo, solo audio, e si
      scrive quello che si è sentito. Il gradino che manca fra il capire e il
      produrre. *(Decodifica fonologica; per il russo si appoggia alla voce
      online.)*

- [ ] **4. Percorso a unità** — le frasi raggruppate in unità tematiche con un
      percorso visibile, stato di completamento e sblocco progressivo, invece
      di una coda piatta. È la differenza strutturale più grossa con Duolingo.
      Lo scheduler resta il padrone dei ripassi: il percorso governa solo
      l'ordine in cui il materiale nuovo entra.

- [ ] **5. Ripasso degli errori** — una sezione dedicata alle carte sbagliate
      di recente, con un giro corto e mirato. *(Il ripasso concentrato sugli
      errori rende più del ripasso uniforme.)*

- [ ] **6. Micro-interazioni e identità** — transizioni fra le carte, riscontro
      aptico dove esiste, schermate meno spoglie, un'icona che non sia un
      fumetto generico.

- [ ] **7. Livelli per unità** — rifare un'unità a difficoltà crescente
      (riconosci → produci → detta), con un segno visibile del grado raggiunto.

- [ ] **8. Riepilogo settimanale** — cosa è migliorato e cosa no, misurato:
      ritenzione, parole nuove, punti grammaticali consolidati.

## Idee tenute in caldo

- Modo "conversazione": due o tre frasi collegate invece di frasi isolate.
- Scelta della difficoltà del giorno (più ripassi o più roba nuova).
- Esportare le frasi ostiche come mazzo Anki.
