/*
 * openings.js — repertorio di aperture organizzato per livello.
 * `line`  : mosse in notazione algebrica inglese, separate da spazio.
 * `side`  : colore da allenare (le mosse avversarie vengono giocate dall'app).
 * `notes` : commento su singole semimosse (chiave = indice della semimossa, da 0).
 */

export const LEVELS = [
  {
    id: 1,
    name: 'Principiante',
    tagline: 'I fondamentali: centro, sviluppo, arrocco',
    description:
      'Le aperture che ogni giocatore deve conoscere. Poche mosse, idee chiare: occupare il centro, sviluppare i pezzi leggeri e mettere il re al sicuro.',
    icon: '♙',
  },
  {
    id: 2,
    name: 'Intermedio',
    tagline: 'Sistemi completi e piani a lungo termine',
    description:
      'Varianti principali delle grandi difese e dei sistemi più giocati. Qui contano la struttura di pedoni e il piano, non solo le mosse.',
    icon: '♘',
  },
  {
    id: 3,
    name: 'Avanzato',
    tagline: 'Teoria da torneo, linee affilate',
    description:
      'Linee critiche giocate ai massimi livelli. Sequenze lunghe, sacrifici tematici e conoscenza precisa dell’ordine delle mosse.',
    icon: '♕',
  },
];

export const OPENINGS = [
  /* ------------------------------------------------------------------ *
   *  LIVELLO 1 — PRINCIPIANTE
   * ------------------------------------------------------------------ */
  {
    id: 'italiana',
    name: 'Apertura Italiana',
    eco: 'C50',
    level: 1,
    side: 'w',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'L’apertura più naturale del mondo: pedone al centro, cavallo e alfiere puntati sul punto debole f7.',
    plan:
      'Costruisci il centro con c3 e d4 al momento giusto, arrocca presto e tieni l’alfiere sulla diagonale a2-g8. Nella versione "Pianissimo" (d3) si gioca con manovre lente: Nbd2-f1-g3.',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    notes: {
      0: 'Occupa il centro e libera donna e alfiere: la mossa più forte del bianco.',
      2: 'Sviluppa attaccando e5. Ogni mossa deve fare qualcosa di utile.',
      3: 'Difende il pedone sviluppando: mai difendere con mosse passive.',
      4: 'L’alfiere mira a f7, la casa più debole del nero all’inizio.',
      5: 'Il nero risponde con simmetria e controlla d4.',
      6: 'Prepara d4: il centro si costruisce con i pedoni sostenuti.',
      8: 'Il "Giuoco Pianissimo": si rinuncia alla rottura immediata per un gioco di manovra.',
      10: 'Re al sicuro entro le prime 10 mosse: regola d’oro.',
    },
  },
  {
    id: 'due-cavalli',
    name: 'Difesa dei Due Cavalli',
    eco: 'C55',
    level: 1,
    side: 'b',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Il nero rinuncia alla simmetria e gioca 3...Nf6 attaccando e4: nasce subito una lotta tagliente.',
    plan:
      'Dopo 4.Ng5 il nero sacrifica un pedone con 4...d5 5.exd5 Na5 per scacciare l’alfiere e prendere l’iniziativa sullo sviluppo.',
    line: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6',
    notes: {
      5: 'Contrattacco: invece di difendere e5, il nero attacca e4.',
      6: 'Mossa "da principianti" solo in apparenza: attacca f7 con due pezzi.',
      7: 'La risposta corretta: si chiude la diagonale invece di difendere f7.',
      9: 'Attacca l’alfiere in c4 e guadagna tempo: il pedone in d5 si riprende dopo.',
      11: 'Il nero restituisce materiale per accelerare lo sviluppo.',
      15: 'Scaccia il cavallo: il nero ha un pedone in meno ma pezzi molto attivi.',
    },
  },
  {
    id: 'spagnola',
    name: 'Partita Spagnola (Ruy López)',
    eco: 'C84',
    level: 1,
    side: 'w',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'L’apertura più studiata della storia: 3.Bb5 mette pressione al difensore del pedone e5.',
    plan:
      'Il bianco costruisce il centro con c3 e d4, ritira l’alfiere su c2 e manovra il cavallo b1-d2-f1-g3 verso il re nero.',
    line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
    notes: {
      4: 'Attacca indirettamente e5 inchiodando il difensore.',
      5: 'La "domanda" all’alfiere: mossa quasi obbligata nel repertorio moderno.',
      6: 'Il bianco mantiene la diagonale: prendere in c6 regala i due alfieri.',
      8: 'Arrocco: il pedone e4 è avvelenato per il momento.',
      10: 'La torre sostiene e4 e prepara la spinta d4.',
      14: 'Prepara d4 costruendo il centro ideale.',
      16: 'Mossa profilattica: toglie la casa g4 all’alfiere nero prima di giocare d4.',
    },
  },
  {
    id: 'scozzese',
    name: 'Partita Scozzese',
    eco: 'C45',
    level: 1,
    side: 'w',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Il bianco apre subito il centro con 3.d4: poca teoria da memorizzare, pezzi attivi immediatamente.',
    plan:
      'Il centro si apre presto: sviluppa rapidamente, occupa la colonna d e sfrutta lo spazio. Ottima scelta per chi non vuole studiare la Spagnola.',
    line: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7',
    notes: {
      4: 'Rottura immediata al centro: nessuna preparazione, gioco aperto.',
      6: 'Il cavallo al centro è ben piazzato ma può essere attaccato.',
      7: 'Attacca il cavallo in d4 e sviluppa con tempo.',
      8: 'Sostiene il cavallo e prepara lo scambio degli alfieri.',
      9: 'La donna difende l’alfiere e punta su f2.',
      10: 'Rinforza d4 e apre una via di fuga per l’alfiere.',
    },
  },
  {
    id: 'scandinava',
    name: 'Difesa Scandinava',
    eco: 'B01',
    level: 1,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'Il nero sfida subito il pedone e4. Facile da imparare: poche varianti, piani sempre uguali.',
    plan:
      'Dopo aver riportato la donna in a5 (o d6), il nero completa lo sviluppo con Nf6, c6, Bf5 e arrocco lungo o corto.',
    line: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
    notes: {
      1: 'Sfida diretta al centro bianco fin dalla prima mossa.',
      3: 'Riprendere di donna è possibile perché il nero sa già dove ritirarla.',
      4: 'Sviluppo con tempo: il bianco guadagna un tempo attaccando la donna.',
      5: 'Casella sicura: la donna resta attiva sulla diagonale a5-e1.',
      9: 'Mossa chiave: dà una casa di fuga alla donna e sostiene d5.',
      11: 'L’alfiere esce prima di chiudere la catena con e6.',
    },
  },
  {
    id: 'francese',
    name: 'Difesa Francese',
    eco: 'C11',
    level: 1,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'Struttura solida: il nero cede spazio ma ottiene un centro compatto e un piano chiarissimo, la spinta ...c5.',
    plan:
      'Il nero attacca la base della catena bianca con ...c5 e ...f6. Problema storico: l’alfiere campochiaro chiuso da e6, da attivare con ...b6/...Ba6 o ...Bd7-b5.',
    line: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6',
    notes: {
      1: 'Prepara ...d5 sostenuto: il nero non concede il centro.',
      3: 'Il centro viene sfidato immediatamente.',
      5: 'Aumenta la pressione su e4 e costringe il bianco a decidere.',
      6: 'Il bianco chiude il centro e guadagna spazio (Variante Steinitz).',
      7: 'Il cavallo si ritira per riorganizzarsi: da d7 sosterrà ...c5.',
      9: 'La mossa tematica: si attacca la base della catena bianca (d4).',
    },
  },
  {
    id: 'caro-kann',
    name: 'Difesa Caro-Kann',
    eco: 'B18',
    level: 1,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'Come la Francese, ma senza il problema dell’alfiere cattivo: il nero lo sviluppa fuori dalla catena prima di giocare ...e6.',
    plan:
      'Struttura solidissima. Il nero completa con ...e6, ...Nd7, ...Ngf6 e arrocca; il finale è spesso leggermente migliore per lui grazie alla struttura sana.',
    line: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
    notes: {
      1: 'Prepara ...d5 con il pedone c, tenendo libera la diagonale c8-h3.',
      5: 'Si elimina la tensione: il nero sa già dove mettere i pezzi.',
      7: 'La mossa che distingue la Caro-Kann dalla Francese: alfiere attivo fuori dalla catena.',
      8: 'Scaccia l’alfiere guadagnando tempo.',
      10: 'Il bianco guadagna spazio sull’ala di re e minaccia h5.',
      11: 'Necessaria: crea la casa h7 per l’alfiere.',
      13: 'Sviluppo flessibile: il cavallo va in d7 per non ostruire il pedone c6.',
    },
  },
  {
    id: 'siciliana-aperta',
    name: 'Difesa Siciliana (Variante Aperta)',
    eco: 'B50',
    level: 1,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'La difesa più giocata al mondo: il nero non copia il bianco, sbilancia la partita e gioca per vincere.',
    plan:
      'Il nero scambia il pedone c contro il pedone d e ottiene la colonna c semiaperta per la controffensiva sull’ala di donna, mentre il bianco attacca sull’ala di re.',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
    notes: {
      1: 'Combatte per d4 restando asimmetrica: nasce una partita ricca di gioco.',
      3: 'Controlla e5 e prepara ...Nf6 senza essere scacciato subito.',
      5: 'Lo scambio tematico: il nero cede il centro ma apre la colonna c.',
      7: 'Attacca e4 e costringe il bianco a difenderlo.',
      8: 'La difesa naturale del pedone e4.',
      9: 'Mossa flessibile che toglie b5 ai pezzi bianchi: si entra nella Najdorf.',
    },
  },
  {
    id: 'qgd',
    name: 'Gambetto di Donna Rifiutato',
    eco: 'D35',
    level: 1,
    side: 'b',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Il modo più classico e solido di rispondere a 1.d4: il nero sostiene il centro con ...e6 e costruisce una fortezza.',
    plan:
      'Il nero completa lo sviluppo e cerca la liberazione con ...c5 o ...dxc4 seguito da ...c5. Il bianco gioca sulla "minoranza" con b4-b5.',
    line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
    notes: {
      2: 'Non è un vero sacrificio: il pedone c4 si può sempre recuperare.',
      3: 'Il nero rifiuta il pedone e sostiene solidamente d5.',
      6: 'Inchioda il cavallo e aumenta la pressione su d5.',
      7: 'Rompe l’inchiodatura e prepara l’arrocco.',
      11: 'Utile: chiede all’alfiere di decidere e crea aria per il re.',
      13: 'Prepara ...Bb7: l’alfiere problematico trova una diagonale.',
    },
  },
  {
    id: 'londra',
    name: 'Sistema Londra',
    eco: 'D02',
    level: 1,
    side: 'w',
    family: 'Sistemi · 1.d4',
    summary:
      'Un sistema, non una variante: le stesse cinque mosse contro quasi tutto. Perfetto per chi vuole giocare senza studiare teoria.',
    plan:
      'Struttura solida (d4-e3-c3), alfiere fuori dalla catena in f4, poi Bd3, Nbd2, O-O e attacco al re con Ne5 e la spinta f4 o h4.',
    line: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
    notes: {
      2: 'La firma del sistema: l’alfiere esce prima di chiudere con e3.',
      4: 'Solo ora si chiude la diagonale: l’ordine delle mosse è tutto.',
      8: 'Sostiene d4 e dà una casa di ritirata all’alfiere in c2.',
      10: 'Sviluppo armonico: il cavallo va in d2 per liberare l’alfiere in f1.',
      12: 'Evita lo scambio degli alfieri mantenendo la pressione sulla diagonale.',
      14: 'L’alfiere punta a h7: comincia il piano d’attacco al re.',
    },
  },
  {
    id: 'russa',
    name: 'Difesa Russa (Petroff)',
    eco: 'C42',
    level: 1,
    side: 'b',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Difesa simmetrica e solidissima. Contiene una trappola classica che ogni principiante deve conoscere.',
    plan:
      'Il nero non difende e5, contrattacca e4. Attenzione all’ordine: prima ...d6 per scacciare il cavallo, solo dopo ...Nxe4.',
    line: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Be7 O-O Nc6',
    notes: {
      3: 'Simmetria: il nero attacca e4 invece di difendere e5.',
      4: 'Il bianco prende, ma il pedone si recupera.',
      5: 'MOSSA CHIAVE: mai 4...Nxe4? subito per via di 5.Qe2! che vince un pezzo.',
      6: 'Il cavallo deve ritirarsi.',
      7: 'Solo adesso è sicuro riprendere il pedone.',
      9: 'Sostiene il cavallo in e4: senza questa mossa il pezzo è instabile.',
    },
  },

  /* ------------------------------------------------------------------ *
   *  LIVELLO 2 — INTERMEDIO
   * ------------------------------------------------------------------ */
  {
    id: 'najdorf',
    name: 'Siciliana Najdorf',
    eco: 'B90',
    level: 2,
    side: 'b',
    family: 'Siciliana',
    summary:
      'L’arma di Fischer e Kasparov: la variante più analizzata della storia degli scacchi.',
    plan:
      'La mossa 5...a6 toglie b5 ai pezzi bianchi e prepara ...e5 o ...e6. Il nero gioca sulla colonna c e sulla debolezza di e4; il bianco attacca con f3, g4 e arrocco lungo.',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7',
    notes: {
      9: 'La mossa Najdorf: profilassi pura, controlla b5 prima di sviluppare.',
      10: 'Attacco Inglese: il bianco prepara f3, Qd2 e arrocco lungo.',
      11: 'Guadagna spazio e scaccia il cavallo, accettando il buco in d5.',
      13: 'Controlla d5, la casa debole della struttura nera.',
      14: 'Sostiene e4 e prepara g4: il bianco attacca sull’ala di re.',
    },
  },
  {
    id: 'dragone',
    name: 'Siciliana Variante del Drago',
    eco: 'B70',
    level: 2,
    side: 'b',
    family: 'Siciliana',
    summary:
      'Il nero fianchetta in g7: l’alfiere "drago" spara sulla grande diagonale fino a a1.',
    plan:
      'Corsa agli armamenti: il nero gioca ...Rc8, ...Qa5 e sacrifici in c3; il bianco arrocca lungo e spinge h4-h5 con Bh6.',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6',
    notes: {
      9: 'Prepara il fianchetto: l’alfiere in g7 sarà il pezzo migliore del nero.',
      12: 'Blinda e4 e prepara l’attacco g4-h4: è la mossa dell’Attacco Jugoslavo.',
      13: 'Il nero arrocca comunque: la corsa è cominciata.',
      14: 'Collega le torri e prepara Bh6 per scambiare l’alfiere drago.',
      15: 'Sviluppo con pressione su d4 e sulla colonna c.',
    },
  },
  {
    id: 'nimzo',
    name: 'Difesa Nimzo-Indiana',
    eco: 'E32',
    level: 2,
    side: 'b',
    family: 'Difese indiane · 1.d4',
    summary:
      'Il nero inchioda il cavallo c3 e combatte per e4 con i pezzi, non con i pedoni. Difesa rispettatissima a ogni livello.',
    plan:
      'Scambiare l’alfiere in c3 raddoppiando i pedoni bianchi, poi bloccare la posizione e sfruttare le debolezze permanenti nel finale.',
    line: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7',
    notes: {
      1: 'Impedisce e4 e mantiene la massima flessibilità.',
      5: 'La mossa Nimzo: inchioda il cavallo e contende la casa e4.',
      6: 'Variante Classica: il bianco evita i pedoni doppi in anticipo.',
      8: 'Chiede all’alfiere di decidere: prendere o ritirarsi.',
      9: 'Il nero cede i due alfieri per rovinare la struttura o guadagnare tempo.',
      11: 'Prepara ...Bb7: il controllo di e4 continua con i pezzi.',
    },
  },
  {
    id: 'est-indiana',
    name: 'Difesa Est-Indiana',
    eco: 'E90',
    level: 2,
    side: 'b',
    family: 'Difese indiane · 1.d4',
    summary:
      'Il nero lascia il centro al bianco e poi lo attacca: ipermodernismo puro, partite feroci.',
    plan:
      'Dopo ...e5 e la chiusura d5, il nero attacca sull’ala di re con ...f5-f4-g5, il bianco sull’ala di donna con c5. Vince chi arriva primo.',
    line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
    notes: {
      3: 'Prepara il fianchetto: il nero cede il centro per attaccarlo dopo.',
      6: 'Il bianco costruisce il centro ideale, come vuole la teoria classica.',
      7: 'Prepara la rottura ...e5, il cuore dell’Est-Indiana.',
      11: 'La sfida al centro: ora il bianco deve scegliere fra tenere, chiudere o cambiare.',
      13: 'Aumenta la pressione su d4 provocando la chiusura.',
      14: 'Il centro si chiude: adesso ogni giocatore attacca sulla propria ala.',
      15: 'Il cavallo si sposta per liberare la spinta ...f5.',
    },
  },
  {
    id: 'slava',
    name: 'Difesa Slava',
    eco: 'D17',
    level: 2,
    side: 'b',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Come il Gambetto di Donna Rifiutato, ma sostenendo d5 con ...c6: l’alfiere campochiaro resta libero.',
    plan:
      'Il nero prende in c4 e sviluppa l’alfiere in f5 prima di chiudere con ...e6. Struttura sana e finali affidabili.',
    line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
    notes: {
      3: 'Sostiene d5 senza rinchiudere l’alfiere in c8.',
      7: 'Ora prendere è possibile: il nero minaccia di tenere il pedone con ...b5.',
      8: 'Impedisce ...b5, ma indebolisce b4.',
      9: 'La ragione di tutta la variante: l’alfiere esce prima di ...e6.',
      13: 'Usa la casa b4 indebolita da a4 e prepara l’arrocco.',
    },
  },
  {
    id: 'qga',
    name: 'Gambetto di Donna Accettato',
    eco: 'D20',
    level: 2,
    side: 'b',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Il nero prende il pedone, non per tenerlo, ma per cedere il centro e colpirlo subito con ...c5.',
    plan:
      'Restituire il pedone c4, giocare ...c5 per aprire la posizione e attaccare il pedone isolato o il centro bianco con pezzi attivi.',
    line: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 a4 Nc6 Qe2 cxd4 Rd1 Be7',
    notes: {
      3: 'Accettare è del tutto valido: il pedone non si può tenere a lungo.',
      4: 'Prima lo sviluppo: 3.e4 sarebbe possibile ma 3.Nf3 impedisce ...e5.',
      9: 'La rottura tematica: si colpisce d4 e si apre la posizione.',
      11: 'Prepara ...b5 guadagnando spazio sull’ala di donna.',
      12: 'Il bianco lo impedisce, accettando un piccolo indebolimento.',
      16: 'La torre occupa la colonna aperta: sarà lei a fare pressione su d5.',
    },
  },
  {
    id: 'inglese',
    name: 'Apertura Inglese',
    eco: 'A29',
    level: 2,
    side: 'w',
    family: 'Aperture di fianchetto · 1.c4',
    summary:
      'Una Siciliana con un tempo in più e i colori invertiti: gioco posizionale, spesso trasponibile.',
    plan:
      'Fianchetto in g2, pressione sulla colonna c e sulla casa d5. Il bianco gioca lentamente e sfrutta il tempo extra.',
    line: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7',
    notes: {
      0: 'Controlla d5 dall’ala: apertura flessibile e poco teorica.',
      6: 'Il fianchetto punta al centro da lontano, in particolare su d5.',
      7: 'Il nero rivendica il centro, come farebbe il bianco in una Siciliana.',
      10: 'L’alfiere in g2 e la pressione sulla lunga diagonale sono l’anima dell’Inglese.',
      12: 'Sviluppo completato: il bianco giocherà d3, Be3 e pressione sulla colonna c.',
    },
  },
  {
    id: 'winawer',
    name: 'Francese Variante Winawer',
    eco: 'C18',
    level: 2,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'La linea più affilata della Francese: il nero rovina la struttura bianca cedendo i due alfieri.',
    plan:
      'Il nero attacca il centro con ...c5 e sfrutta i pedoni doppi in c3; il bianco attacca sull’ala di re con Qg4 e la coppia degli alfieri.',
    line: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7',
    notes: {
      5: 'La mossa Winawer: inchioda il cavallo che difende e4.',
      6: 'Il bianco guadagna spazio e chiude il centro.',
      7: 'Attacco immediato alla base della catena.',
      8: 'Chiede all’alfiere di decidere subito.',
      10: 'Struttura sbilanciata: pedoni doppi in cambio di due alfieri e spazio.',
      12: 'Attacca g7 approfittando dell’assenza dell’alfiere nero.',
      13: 'Il nero ignora g7 e punta tutto sul contrattacco al centro.',
    },
  },
  {
    id: 'berlinese',
    name: 'Spagnola Variante Berlinese',
    eco: 'C67',
    level: 2,
    side: 'b',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Il "muro di Berlino" reso celebre da Kramnik contro Kasparov nel 2000: si entra in un finale difficilissimo da attaccare.',
    plan:
      'Il nero accetta pedoni doppi e la perdita dell’arrocco in cambio dei due alfieri e di una struttura molto resistente.',
    line: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
    notes: {
      5: 'Invece di 3...a6, il nero attacca subito e4.',
      7: 'Prendere è corretto: la casa e5 non si può tenere per sempre.',
      9: 'Il cavallo torna a difendere e blocca l’alfiere in b5.',
      11: 'La struttura nera si rovina, ma i due alfieri compensano.',
      14: 'Il cambio di donne è forzato...',
      15: '...e il re nero perde l’arrocco: nasce il celebre finale di Berlino.',
    },
  },
  {
    id: 'evans',
    name: 'Gambetto Evans',
    eco: 'C52',
    level: 2,
    side: 'w',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Un pedone in cambio di tempi e del centro: gambetto romantico ancora oggi pericolosissimo.',
    plan:
      'Con c3 e d4 il bianco costruisce un centro imponente sfruttando il tempo guadagnato sull’alfiere nero.',
    line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O Nge7',
    notes: {
      6: 'Il sacrificio: si devia l’alfiere per guadagnare tempo con c3 e d4.',
      7: 'Accettare è la scelta principale (rifiutare con ...Bb6 è solido).',
      8: 'Guadagna un tempo e prepara il centro.',
      10: 'Ecco la compensazione: centro forte e sviluppo rapido.',
      12: 'Il bianco non recupera il pedone: apre linee e sviluppa.',
    },
  },
  {
    id: 'caro-avanzata',
    name: 'Caro-Kann Variante Avanzata',
    eco: 'B12',
    level: 2,
    side: 'b',
    family: 'Difese a 1.e4',
    summary:
      'Il bianco chiude il centro con 3.e5 e attacca subito l’alfiere che il nero è appena riuscito a sviluppare.',
    plan:
      'Il nero sviluppa l’alfiere in f5 prima di ...e6 e poi colpisce la catena con ...c5, spesso completando con ...Ne7 e ...Nbc6.',
    line: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4 Nxd4 Ne7',
    notes: {
      4: 'Chiude il centro e guadagna spazio: la linea più giocata oggi.',
      5: 'Da fare subito: dopo ...e6 l’alfiere resterebbe murato.',
      7: 'Ora si può chiudere: l’alfiere buono è già fuori.',
      9: 'La rottura tematica contro ogni catena bianca in d4-e5.',
      13: 'Il cavallo va in e7 per non ostacolare la pressione su d4.',
    },
  },
  {
    id: 'gambetto-re',
    name: 'Gambetto di Re',
    eco: 'C33',
    level: 2,
    side: 'w',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'L’apertura romantica per eccellenza: il bianco offre un pedone per deviare e5 e conquistare il centro.',
    plan:
      'Recuperare il pedone f4 al momento giusto, aprire la colonna f per la torre e attaccare il re nero prima che si metta al sicuro.',
    line: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 d4 d6 Nd3 Nxe4 Bxf4',
    notes: {
      2: 'L’offerta: si devia il pedone e5 per prendere tutto il centro.',
      4: 'Impedisce ...Qh4+ e sviluppa: mossa necessaria prima di tutto il resto.',
      5: 'Il nero difende il pedone in più con la catena di pedoni.',
      6: 'Colpisce subito la catena: variante Kieseritzky.',
      8: 'Il cavallo si installa in e5, cuore della posizione.',
      10: 'Il centro bianco è imponente: questa è la compensazione.',
      14: 'Il pedone f4 è recuperato e la colonna f è aperta verso il re nero.',
    },
  },

  /* ------------------------------------------------------------------ *
   *  LIVELLO 3 — AVANZATO
   * ------------------------------------------------------------------ */
  {
    id: 'grunfeld',
    name: 'Difesa Grünfeld',
    eco: 'D85',
    level: 3,
    side: 'b',
    family: 'Difese indiane · 1.d4',
    summary:
      'Il nero lascia costruire al bianco un centro gigantesco per poi demolirlo con pezzi e pedoni. Arma di Kasparov e Svidler.',
    plan:
      'Pressione sulla catena c3-d4 con ...c5, ...Qa5, ...Bg4 e ...Rc8. Se il centro bianco resiste, il bianco vince; se cade, vince il nero.',
    line: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2 cxd4 cxd4 Qa5+ Bd2 Qxa2',
    notes: {
      5: 'La differenza dall’Est-Indiana: si sfida subito il centro.',
      8: 'Il bianco guadagna il centro con tempo.',
      10: 'Struttura tipica: centro bianco imponente contro pressione nera.',
      11: 'L’alfiere in g7 spara direttamente sul centro bianco.',
      13: 'La rottura chiave: si attacca la base della catena.',
      14: 'Linea moderna: la torre esce dalla diagonale dell’alfiere prima di sviluppare.',
      19: 'Scacco che guadagna materiale: la donna raccoglie in a2.',
      21: 'Il nero prende un pedone ma la donna resta lontana dal gioco.',
    },
  },
  {
    id: 'najdorf-inglese',
    name: 'Najdorf — Attacco Inglese',
    eco: 'B90',
    level: 3,
    side: 'b',
    family: 'Siciliana',
    summary:
      'Il sistema più diretto contro la Najdorf: arrocchi opposti e corsa all’attacco sulle due ali.',
    plan:
      'Il bianco spinge g4-g5 e apre la colonna h; il nero contrattacca con ...b5-b4 e ...Rc8 sulla colonna c. Ogni tempo vale una figura.',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7',
    notes: {
      10: 'Attacco Inglese: la coppia f3+Qd2 prepara l’arrocco lungo.',
      14: 'Blinda e4 e prepara g4: l’attacco parte da qui.',
      16: 'Collega le torri e prepara O-O-O.',
      18: 'Arrocchi opposti: si comincia a contare i tempi.',
      19: 'Il cavallo sostiene b5 e mira a c5 o b6.',
    },
  },
  {
    id: 'sveshnikov',
    name: 'Siciliana Sveshnikov',
    eco: 'B33',
    level: 3,
    side: 'b',
    family: 'Siciliana',
    summary:
      'Il nero accetta volontariamente un buco in d5 e un pedone doppio in cambio di attività dinamica. Usata da Carlsen nel match mondiale 2018.',
    plan:
      'Cacciare i pezzi bianchi da d5 con ...f5 e ...Be6, sfruttando i due alfieri e la pressione sulla colonna b dopo ...b5-b4.',
    line: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6 Nd5 f5',
    notes: {
      9: 'La mossa che definisce la variante: si scaccia il cavallo accettando il buco in d5.',
      10: 'L’unica casa attiva: da b5 il cavallo minaccia c7.',
      12: 'Aumenta la pressione sulla casa d5 inchiodando il difensore.',
      13: 'Scaccia il cavallo che deve andare nell’angolo.',
      15: 'Guadagna spazio e imprigiona il cavallo in a3.',
      17: 'Pedoni doppi accettati: in cambio, colonna g aperta e due alfieri.',
      19: 'Contrattacco immediato al centro: il nero non è mai passivo.',
    },
  },
  {
    id: 'marshall',
    name: 'Attacco Marshall',
    eco: 'C89',
    level: 3,
    side: 'b',
    family: 'Aperture aperte · 1.e4 e5',
    summary:
      'Un pedone sacrificato per un attacco permanente contro il re bianco: teoria pura, da conoscere a memoria.',
    plan:
      'Dopo ...d5 il nero ottiene un attacco duraturo con ...Bd6, ...Qh4 e ...Qh3 sulla colonna e e sull’ala di re.',
    line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d4 Bd6 Re1 Qh4 g3 Qh3',
    notes: {
      15: 'Il sacrificio Marshall: si offre un pedone per aprire le linee verso il re.',
      19: 'La sequenza è forzata: il nero recupera un pezzo.',
      21: 'Sostiene il cavallo in d5: senza questa mossa il sacrificio non funziona.',
      23: 'L’alfiere prende la diagonale verso h2: comincia l’attacco.',
      25: 'La donna entra in gioco con minaccia di matto in h2.',
      26: 'Obbligata: parare il matto indebolisce le case chiare.',
      27: 'La donna si installa in h3 e il bianco resta paralizzato per decine di mosse.',
    },
  },
  {
    id: 'meran',
    name: 'Semi-Slava Variante Meran',
    eco: 'D47',
    level: 3,
    side: 'b',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Il nero prende in c4 e lancia i pedoni sull’ala di donna: una delle strutture più ricche della teoria moderna.',
    plan:
      'Espansione con ...b5, ...a6 e ...c5 per aprire la diagonale dell’alfiere in b7; il bianco risponde con e4-e5 al centro.',
    line: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 Bb7 O-O a6 e4 c5',
    notes: {
      7: 'Semi-Slava: il nero sostiene d5 sia con c6 sia con e6.',
      8: 'Il bianco chiude l’alfiere in c1 ma consolida il centro.',
      11: 'Il momento giusto per prendere: si guadagna un tempo sull’alfiere.',
      13: 'La mossa Meran: si guadagna spazio e si prepara ...b4.',
      15: 'La grande diagonale è la vita di tutti i pezzi neri.',
      18: 'Il bianco rivendica il centro prima che il nero completi lo sviluppo.',
      19: 'Contrattacco immediato: la partita diventa concreta.',
    },
  },
  {
    id: 'catalana',
    name: 'Apertura Catalana',
    eco: 'E04',
    level: 3,
    side: 'w',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Un Gambetto di Donna con il fianchetto: l’alfiere in g2 esercita una pressione eterna sulla lunga diagonale.',
    plan:
      'Recuperare il pedone c4 con Qa4, Ne5 o a4 e poi giocare su e4/d5 con la pressione a lungo termine dell’alfiere in g2.',
    line: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 a6 O-O Nc6 e3 Bd7 Qe2 Bd6',
    notes: {
      4: 'La firma della Catalana: l’alfiere andrà in g2, non in e2 o d3.',
      7: 'La Catalana Aperta: il nero prende il pedone e cerca di tenerlo.',
      8: 'Il bianco non ha fretta: sviluppa e recupererà il pedone.',
      9: 'Prepara ...b5 per sostenere il pedone in più.',
      12: 'Rinforza d4 e apre la strada al recupero del pedone.',
      14: 'La donna sostiene il recupero in c4 e collega le torri.',
    },
  },
  {
    id: 'jugoslavo',
    name: 'Drago — Attacco Jugoslavo',
    eco: 'B76',
    level: 3,
    side: 'b',
    family: 'Siciliana',
    summary:
      '"Arrocca lungo e spingi h": la linea più violenta della teoria. Chi conosce meglio le mosse, vince.',
    plan:
      'Il bianco apre la colonna h con h4-h5 e scambia l’alfiere drago con Bh6; il nero sacrifica in c3 per aprire le linee verso il re bianco.',
    line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 O-O-O d5 exd5 Nxd5 Nxc6 bxc6 Bd4',
    notes: {
      16: 'Arrocco lungo: comincia la corsa fra i due attacchi.',
      17: 'La rottura liberatoria del nero: bisogna giocarla al momento esatto.',
      19: 'Il centro si apre proprio quando i re sono su ali opposte.',
      21: 'La struttura nera si rovina, ma la colonna b punta al re bianco.',
      22: 'Il bianco cerca lo scambio dell’alfiere drago, difensore chiave del re nero.',
    },
  },
  {
    id: 'mar-del-plata',
    name: 'Est-Indiana — Mar del Plata',
    eco: 'E97',
    level: 3,
    side: 'b',
    family: 'Difese indiane · 1.d4',
    summary:
      'La variante più feroce dell’Est-Indiana: attacchi su ali opposte, senza possibilità di tornare indietro.',
    plan:
      'Il nero spinge ...f5-f4, ...g5-g4 e cerca il matto; il bianco apre la colonna c e penetra in c7. Non esistono mosse difensive: si va fino in fondo.',
    line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Nd3 f5',
    notes: {
      13: 'Provoca la chiusura del centro: è quello che il nero vuole.',
      14: 'Il centro si blocca: da qui in poi si gioca solo sulle ali.',
      15: 'Il cavallo lascia la strada al pedone f.',
      16: 'Il cavallo va verso c2-b5 o sostiene f2 e la spinta c5.',
      17: 'Sostiene ...f5 e libera la diagonale dell’alfiere in g7.',
      19: 'Comincia l’assalto: seguiranno ...f4, ...g5, ...Rf6-h6.',
    },
  },
  {
    id: 'leningrado',
    name: 'Difesa Olandese Variante Leningrado',
    eco: 'A87',
    level: 3,
    side: 'b',
    family: 'Aperture chiuse · 1.d4',
    summary:
      'Un’Est-Indiana con ...f5 al posto di ...d6: il nero gioca per l’attacco fin dalla prima mossa.',
    plan:
      'Manovra ...Qe8-h5 (o ...Qe8-g6) e rottura ...e5. Struttura ambiziosa ma con il re leggermente scoperto.',
    line: 'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3 Qe8 d5 a5',
    notes: {
      1: 'Controlla e4 e prepara un attacco sull’ala di re: apertura molto combattiva.',
      5: 'Il fianchetto rende il Leningrado diverso dalle altre Olandesi.',
      11: 'Prepara la rottura ...e5, la chiave della struttura.',
      13: 'La manovra tipica: la donna lascia la colonna d e punta verso h5.',
      15: 'Fissa l’ala di donna e crea la casa c5 per i pezzi neri.',
    },
  },
  {
    id: 'samisch',
    name: 'Est-Indiana — Variante Sämisch',
    eco: 'E81',
    level: 3,
    side: 'w',
    family: 'Difese indiane · 1.d4',
    summary:
      'Il bianco sostiene il centro con f3 e prepara un attacco diretto con Qd2, Bh6 e g4-h4.',
    plan:
      'Struttura granitica: f3 blinda e4 e toglie g4 ai cavalli neri. Poi arrocco lungo e assalto sull’ala di re.',
    line: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 f5',
    notes: {
      8: 'La mossa Sämisch: blinda e4 e prepara g4, ma toglie f3 al cavallo.',
      10: 'Sostiene d4 e prepara Qd2-Bh6 per scambiare l’alfiere nero.',
      12: 'Chiude il centro: ora il bianco attacca sull’ala di donna o di re.',
      13: 'Il nero libera immediatamente la spinta ...f5.',
      14: 'Collega le torri e prepara l’arrocco lungo.',
    },
  },
];

export const byLevel = (level) => OPENINGS.filter((o) => o.level === level);
export const byId = (id) => OPENINGS.find((o) => o.id === id) || null;
export const plies = (opening) => opening.line.trim().split(/\s+/);
