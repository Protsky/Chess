/*
 * corpus-gsw.js — svizzero tedesco (züridütsch) per italofoni.
 *
 * Tre avvertenze oneste, che valgono per tutto il file:
 *
 * 1. Non esiste UN solo svizzero tedesco. Qui si usa il dialetto di Zurigo,
 *    il più diffuso e il più utile a chi arriva da fuori. Basilese, bernese
 *    e vallesano cambiano parecchio.
 * 2. Non esiste un'ortografia ufficiale. Si segue la grafia Dieth, la più
 *    usata negli SMS e nella cartellonistica: si scrive come si sente.
 * 3. Il QCER non certifica i dialetti. I livelli A1-C2 qui servono solo come
 *    bande di difficoltà, per far funzionare la stessa macchina delle altre
 *    lingue: non corrispondono a nessun esame.
 *
 * Ogni riga ha in più l'equivalente in tedesco standard: è il ponte con cui
 * un italiano impara davvero il dialetto, perché quasi sempre la differenza
 * sta in una regola, non in una parola a caso.
 */

export const GRAMMAR = [
  'saluti e cortesia', 'verbo sii', 'verbo haa', 'presente', 'domande',
  'negazione con nöd', 'articoli', 'dativo', 'possesso con vo',
  'possessivo dativo', 'pronomi', 'verbi modali', 'verbi separabili',
  'verbi riflessivi', 'imperativo', 'preposizioni', 'z per luoghi e orari',
  'Perfekt, unico passato', 'participi irregolari', 'Konjunktiv',
  'relative con wo', 'frasi secondarie', 'diminutivi in -li', 'gaa go / cho',
  'particelle e intercalari', 'espressioni fisse', 'ordine delle parole',
  'comparativi', 'superlativi', 'differenze dal tedesco', 'suoni e grafia',
];

const RAW = [
  /* ------------------------------- A1 ------------------------------- */
  ['a1-01', 'A1', 'Grüezi mitenand!', 'Buongiorno a tutti!', 'saluti e cortesia', 'Grüezi', ['generale'], 'Il saluto formale svizzero. Con più persone si aggiunge mitenand.', 'Guten Tag zusammen!'],
  ['a1-02', 'A1', 'Hoi, wie gaht’s?', 'Ciao, come va?', 'saluti e cortesia', 'Hoi', ['generale'], 'Hoi è il ciao informale; a più persone si dice Hoi zäme.', 'Hallo, wie geht’s?'],
  ['a1-03', 'A1', 'Merci vilmal!', 'Grazie mille!', 'saluti e cortesia', 'Merci', ['generale'], 'In Svizzera si ringrazia in francese, anche in dialetto tedesco.', 'Vielen Dank!'],
  ['a1-04', 'A1', 'Uf Widerluege.', 'Arrivederci.', 'saluti e cortesia', 'Widerluege', ['generale'], 'luege sta per schauen: alla lettera "al rivedersi".', 'Auf Wiedersehen.'],
  ['a1-05', 'A1', 'Ich chume us Italie.', 'Vengo dall’Italia.', 'suoni e grafia', 'chume', ['generale', 'viaggi'], 'La k tedesca diventa ch: kommen → chume, Kind → Chind.', 'Ich komme aus Italien.'],
  ['a1-06', 'A1', 'Wie heissisch du?', 'Come ti chiami?', 'domande', 'heissisch', ['generale'], 'La seconda persona finisce in -sch: du heissisch, du chunsch.', 'Wie heißt du?'],
  ['a1-07', 'A1', 'Ich han kei Ziit.', 'Non ho tempo.', 'verbo haa', 'han', ['lavoro'], 'haa fa: ich han, du häsch, er hät, mir händ.', 'Ich habe keine Zeit.'],
  ['a1-08', 'A1', 'Das isch mini Schwöschter.', 'Questa è mia sorella.', 'verbo sii', 'isch', ['generale'], 'sii fa: ich bi, du bisch, er isch, mir sind.', 'Das ist meine Schwester.'],
  ['a1-09', 'A1', 'Ich verstande nöd.', 'Non capisco.', 'negazione con nöd', 'nöd', ['generale'], 'nöd sostituisce nicht e sta dopo il verbo.', 'Ich verstehe nicht.'],
  ['a1-10', 'A1', 'Ich cha kei Dütsch.', 'Non so il tedesco.', 'negazione con nöd', 'kei', ['generale'], 'kei è invariabile: non si declina come il kein tedesco.', 'Ich kann kein Deutsch.'],
  ['a1-11', 'A1', 'Er schaffet i de Stadt.', 'Lavora in città.', 'differenze dal tedesco', 'schaffet', ['lavoro'], 'schaffe significa lavorare, non "creare" come in Germania.', 'Er arbeitet in der Stadt.'],
  ['a1-12', 'A1', 'Was choschtet das?', 'Quanto costa?', 'domande', 'choschtet', ['viaggi'], 'Anche la s davanti a consonante diventa sch: koschte, Poscht.', 'Was kostet das?'],
  ['a1-13', 'A1', 'Wo isch de Bahnhof?', 'Dov’è la stazione?', 'articoli', 'de', ['viaggi'], 'L’articolo maschile è de, il neutro s, il femminile d.', 'Wo ist der Bahnhof?'],
  ['a1-14', 'A1', 'Ich hätt gern es Kafi.', 'Vorrei un caffè.', 'Konjunktiv', 'hätt gern', ['viaggi'], 'es è l’articolo indeterminativo neutro; Kafi, non Kaffee.', 'Ich hätte gern einen Kaffee.'],
  ['a1-15', 'A1', 'De Zug fahrt am achti.', 'Il treno parte alle otto.', 'z per luoghi e orari', 'am achti', ['viaggi'], 'Gli orari prendono la -i: am achti, am zwölfi.', 'Der Zug fährt um acht.'],
  ['a1-16', 'A1', 'Ich gang z Fuess.', 'Vado a piedi.', 'z per luoghi e orari', 'z Fuess', ['viaggi'], 'La z compressa vale zu e nach: z Fuess, z Züri, z Mittag.', 'Ich gehe zu Fuß.'],
  ['a1-17', 'A1', 'Chasch mer hälfe?', 'Mi puoi aiutare?', 'verbi modali', 'Chasch', ['generale'], 'chöne fa: ich cha, du chasch, er cha, mir chönd.', 'Kannst du mir helfen?'],
  ['a1-18', 'A1', 'Es git da kein Parkplatz.', 'Qui non c’è parcheggio.', 'espressioni fisse', 'Es git', ['viaggi'], 'es git come es gibt; in alternativa si sente es hät.', 'Es gibt hier keinen Parkplatz.'],
  ['a1-19', 'A1', 'Hüt isch es rächt chalt.', 'Oggi fa piuttosto freddo.', 'suoni e grafia', 'chalt', ['generale'], 'rächt vale "abbastanza"; chalt di nuovo con la ch iniziale.', 'Heute ist es ziemlich kalt.'],
  ['a1-20', 'A1', 'Redsch chli langsamer?', 'Parli un po’ più lentamente?', 'diminutivi in -li', 'chli', ['viaggi'], 'chli è "un po’", da chlii = klein.', 'Redest du etwas langsamer?'],
  ['a1-21', 'A1', 'Mini Wohnig isch chlii.', 'Il mio appartamento è piccolo.', 'possessivo dativo', 'Mini', ['generale'], 'I possessivi fanno min, mini, mis secondo il genere.', 'Meine Wohnung ist klein.'],
  ['a1-22', 'A1', 'Wo isch s WC?', 'Dov’è il bagno?', 'articoli', 's', ['viaggi'], 'L’articolo neutro si riduce a una sola s attaccata alla parola.', 'Wo ist die Toilette?'],
  ['a1-23', 'A1', 'Ich han Hunger.', 'Ho fame.', 'espressioni fisse', 'Hunger', ['generale'], 'Come in tedesco, la fame si "ha" e non prende articolo.', 'Ich habe Hunger.'],
  ['a1-24', 'A1', 'S Znüni isch am nüni.', 'Lo spuntino è alle nove.', 'diminutivi in -li', 'Znüni', ['generale'], 'Znüni, Zmittag, Zvieri, Znacht: i pasti prendono il nome dall’ora.', 'Der Znüni ist um neun.'],
  ['a1-25', 'A1', 'Mir gönd go poschte.', 'Andiamo a fare la spesa.', 'gaa go / cho', 'go poschte', ['generale'], 'gaa + go + infinito: costruzione che il tedesco standard non ha.', 'Wir gehen einkaufen.'],

  /* ------------------------------- A2 ------------------------------- */
  ['a2-01', 'A2', 'Ich bi geschter is Kino ggange.', 'Ieri sono andato al cinema.', 'Perfekt, unico passato', 'ggange', ['generale'], 'Il participio di gaa è ggange, con la doppia g iniziale.', 'Ich bin gestern ins Kino gegangen.'],
  ['a2-02', 'A2', 'Mir händ lang gwartet.', 'Abbiamo aspettato a lungo.', 'Perfekt, unico passato', 'händ', ['viaggi'], 'La prima plurale finisce in -nd: mir händ, mir gönd, mir sind.', 'Wir haben lange gewartet.'],
  ['a2-03', 'A2', 'Letschti Wuche bin i chrank gsi.', 'La settimana scorsa ero malato.', 'Perfekt, unico passato', 'gsi', ['salute'], 'Il dialetto non ha il Präteritum: "ero" si dice bin gsi.', 'Letzte Woche war ich krank.'],
  ['a2-04', 'A2', 'Er hät kei Ziit gha.', 'Non aveva tempo.', 'participi irregolari', 'gha', ['lavoro'], 'gha è il participio di haa: hatte non esiste.', 'Er hatte keine Zeit.'],
  ['a2-05', 'A2', 'Ich mues früener gaa.', 'Devo andare via prima.', 'verbi modali', 'mues', ['lavoro'], 'müesse fa: ich mues, du muesch, mir müend.', 'Ich muss früher gehen.'],
  ['a2-06', 'A2', 'Du söttsch zum Dokter.', 'Dovresti andare dal medico.', 'Konjunktiv', 'söttsch', ['salute'], 'söttsch è il consiglio; il verbo di movimento si può omettere.', 'Du solltest zum Arzt gehen.'],
  ['a2-07', 'A2', 'Dörf ich da rauche?', 'Posso fumare qui?', 'verbi modali', 'Dörf', ['generale'], 'dörfe è il permesso, chöne la capacità.', 'Darf ich hier rauchen?'],
  ['a2-08', 'A2', 'Das isch günschtiger als s ander.', 'Questo costa meno dell’altro.', 'comparativi', 'günschtiger als', ['viaggi'], 'Comparativo in -er e poi als, come in tedesco.', 'Das ist günstiger als das andere.'],
  ['a2-09', 'A2', 'Das isch s beschte Restaurant da.', 'È il miglior ristorante qui.', 'superlativi', 's beschte', ['viaggi'], 'guet, besser, s beschte: irregolare come ovunque.', 'Das ist das beste Restaurant hier.'],
  ['a2-10', 'A2', 'Ich fröie mi uf d Ferie.', 'Non vedo l’ora della vacanza.', 'verbi riflessivi', 'fröie mi', ['viaggi'], 'Il riflessivo è mi, di, sich: più corto del tedesco.', 'Ich freue mich auf die Ferien.'],
  ['a2-11', 'A2', 'Er hät mer ghulfe.', 'Mi ha aiutato.', 'dativo', 'mer', ['generale'], 'mer è il dativo di ich, non "noi": attenzione all’ambiguità.', 'Er hat mir geholfen.'],
  ['a2-12', 'A2', 'Ich weiss, ass er chunt.', 'So che viene.', 'frasi secondarie', 'ass', ['generale'], 'ass sostituisce dass e manda comunque il verbo in fondo.', 'Ich weiß, dass er kommt.'],
  ['a2-13', 'A2', 'Ich blibe deheim, wil s rägnet.', 'Resto a casa perché piove.', 'frasi secondarie', 'deheim', ['generale'], 'deheim è "a casa"; zu Hause suona tedesco.', 'Ich bleibe zu Hause, weil es regnet.'],
  ['a2-14', 'A2', 'Wänn i Ziit han, lüt i a.', 'Se ho tempo, chiamo.', 'verbi separabili', 'lüt i a', ['lavoro'], 'aalüte è telefonare: il prefisso a vola in fondo.', 'Wenn ich Zeit habe, rufe ich an.'],
  ['a2-15', 'A2', 'Ich han vergässe z spichere.', 'Ho dimenticato di salvare.', 'z per luoghi e orari', 'z spichere', ['tecnologia'], 'La z serve anche come zu davanti all’infinito.', 'Ich habe vergessen zu speichern.'],
  ['a2-16', 'A2', 'Nächscht Wuche gang i uf Züri.', 'La prossima settimana vado a Zurigo.', 'preposizioni', 'uf Züri', ['viaggi'], 'uf + città dove il tedesco usa nach.', 'Nächste Woche fahre ich nach Zürich.'],
  ['a2-17', 'A2', 'Mir gsehnd öis am sächsi.', 'Ci vediamo alle sei.', 'pronomi', 'öis', ['generale'], 'öis è "noi" all’accusativo e al dativo.', 'Wir sehen uns um sechs.'],
  ['a2-18', 'A2', 'De Flug hät Verspötig.', 'Il volo è in ritardo.', 'espressioni fisse', 'Verspötig', ['viaggi'], 'I sostantivi in -ung diventano -ig: Wohnig, Verspötig, Rächnig.', 'Der Flug hat Verspätung.'],
  ['a2-19', 'A2', 'Chönd Sie das bitte wiederhole?', 'Può ripeterlo, per favore?', 'saluti e cortesia', 'Chönd Sie', ['viaggi'], 'La forma di cortesia esiste anche in dialetto, con Sie.', 'Können Sie das bitte wiederholen?'],
  ['a2-20', 'A2', 'Mir isch schlächt.', 'Mi sento male.', 'dativo', 'Mir', ['salute'], 'Il malessere va al dativo, senza soggetto.', 'Mir ist schlecht.'],
  ['a2-21', 'A2', 'Das tuet mer leid.', 'Mi dispiace.', 'espressioni fisse', 'tuet mer leid', ['generale'], 'tue è il verbo passe-partout del dialetto.', 'Das tut mir leid.'],
  ['a2-22', 'A2', 'Ich schaffe sit drü Jahr da.', 'Lavoro qui da tre anni.', 'preposizioni', 'sit drü', ['lavoro'], 'drü è tre; sit + presente come in tedesco.', 'Ich arbeite seit drei Jahren hier.'],
  ['a2-23', 'A2', 'Ich han kei Ahnig.', 'Non ne ho idea.', 'espressioni fisse', 'Ahnig', ['generale'], 'Ancora la desinenza -ig al posto di -ung.', 'Ich habe keine Ahnung.'],
  ['a2-24', 'A2', 'Mach’s guet!', 'Stammi bene!', 'saluti e cortesia', 'Mach’s', ['generale'], 'Il congedo informale più comune fra amici.', 'Mach’s gut!'],
  ['a2-25', 'A2', 'Häsch scho zmittag ggässe?', 'Hai già pranzato?', 'Perfekt, unico passato', 'zmittag', ['generale'], 'zmittag ässe: pranzare, in una parola sola.', 'Hast du schon zu Mittag gegessen?'],

  /* ------------------------------- B1 ------------------------------- */
  ['b1-01', 'B1', 'De Maa, wo öis aaglüte hät.', 'L’uomo che ci ha chiamato.', 'relative con wo', 'wo', ['generale'], 'Il relativo è sempre wo, per persone e cose, in ogni caso.', 'Der Mann, der uns angerufen hat.'],
  ['b1-02', 'B1', 'S Buech, wo n i kauft han.', 'Il libro che ho comprato.', 'relative con wo', 'wo n i', ['accademico'], 'Fra vocali spunta una n di appoggio: wo n i, gseh n i.', 'Das Buch, das ich gekauft habe.'],
  ['b1-03', 'B1', 'Wänn i meh Ziit hett, würd i reise.', 'Se avessi più tempo, viaggerei.', 'Konjunktiv', 'hett', ['viaggi'], 'hett e wär sono i congiuntivi vivi; per gli altri verbi si usa würd.', 'Wenn ich mehr Zeit hätte, würde ich reisen.'],
  ['b1-04', 'B1', 'Ich würd lieber deheim blibe.', 'Preferirei restare a casa.', 'Konjunktiv', 'würd lieber', ['generale'], 'würd + infinito è la forma standard del condizionale.', 'Ich würde lieber zu Hause bleiben.'],
  ['b1-05', 'B1', 'De Bricht isch geschter gschribe worde.', 'Il report è stato scritto ieri.', 'Perfekt, unico passato', 'worde', ['lavoro'], 'Il passivo passato usa isch ... worde, mai wurde.', 'Der Bericht wurde gestern geschrieben.'],
  ['b1-06', 'B1', 'S Problem wird grad aagluegt.', 'Il problema è in esame.', 'verbi separabili', 'aagluegt', ['tecnologia'], 'aaluege = ansehen. luege è il verbo svizzero per guardare.', 'Das Problem wird gerade angeschaut.'],
  ['b1-07', 'B1', 'Obwohl s rägnet, gönd mer use.', 'Anche se piove, usciamo.', 'frasi secondarie', 'use', ['generale'], 'use = hinaus; ine, ufe, abe funzionano allo stesso modo.', 'Obwohl es regnet, gehen wir raus.'],
  ['b1-08', 'B1', 'Drum han i abgseit.', 'Per questo ho annullato.', 'ordine delle parole', 'Drum', ['lavoro'], 'drum vale deshalb e tiene il verbo in seconda posizione.', 'Deshalb habe ich abgesagt.'],
  ['b1-09', 'B1', 'Trotzdem hät’s klappet.', 'Eppure ha funzionato.', 'espressioni fisse', 'klappet', ['tecnologia'], 'klappe = funzionare, riuscire. Frequentissimo.', 'Trotzdem hat es geklappt.'],
  ['b1-10', 'B1', 'Je meh i üebe, deschto besser gaht’s.', 'Più mi esercito, meglio va.', 'comparativi', 'deschto', ['accademico'], 'je ... deschto, con la solita s che diventa sch.', 'Je mehr ich übe, desto besser geht es.'],
  ['b1-11', 'B1', 'Ich han vor, nöchts Jahr z zügle.', 'Ho intenzione di traslocare l’anno prossimo.', 'differenze dal tedesco', 'z zügle', ['generale'], 'zügle è traslocare: in Germania si dice umziehen.', 'Ich habe vor, nächstes Jahr umzuziehen.'],
  ['b1-12', 'B1', 'Es lohnt sich, das aazluege.', 'Vale la pena guardarlo.', 'verbi separabili', 'aazluege', ['accademico'], 'Con i separabili la z si infila dentro: aa-z-luege.', 'Es lohnt sich, das anzuschauen.'],
  ['b1-13', 'B1', 'Er hät sich bi mir entschuldiget.', 'Si è scusato con me.', 'verbi riflessivi', 'bi mir', ['lavoro'], 'bi vale bei: bi mir, bi de Arbet.', 'Er hat sich bei mir entschuldigt.'],
  ['b1-14', 'B1', 'Mir sind öis einig worde.', 'Ci siamo messi d’accordo.', 'Perfekt, unico passato', 'einig worde', ['lavoro'], 'Ancora worde: il participio di werde.', 'Wir sind uns einig geworden.'],
  ['b1-15', 'B1', 'D Frischt isch verlängeret worde.', 'La scadenza è stata prorogata.', 'articoli', 'D', ['lavoro'], 'L’articolo femminile è una sola d attaccata alla parola.', 'Die Frist wurde verlängert.'],
  ['b1-16', 'B1', 'Ohni dich hett i das nöd gschafft.', 'Senza di te non ce l’avrei fatta.', 'Konjunktiv', 'hett i', ['generale'], 'ohni = ohne; hett + participio è l’irreale del passato.', 'Ohne dich hätte ich das nicht geschafft.'],
  ['b1-17', 'B1', 'Ich hett früener sölle buche.', 'Avrei dovuto prenotare prima.', 'verbi modali', 'sölle', ['viaggi'], 'Con i modali il participio diventa infinito: sölle, non gsollt.', 'Ich hätte früher buchen sollen.'],
  ['b1-18', 'B1', 'Das chunt druf aa.', 'Dipende.', 'espressioni fisse', 'druf aa', ['generale'], 'druf sta per darauf: aachoo uf = ankommen auf.', 'Das kommt darauf an.'],
  ['b1-19', 'B1', 'Ich kümmere mi drum.', 'Me ne occupo io.', 'verbi riflessivi', 'drum', ['lavoro'], 'drum sta per darum, come druf per darauf.', 'Ich kümmere mich darum.'],
  ['b1-20', 'B1', 'De Server isch scho wieder abgstürzt.', 'Il server si è bloccato di nuovo.', 'Perfekt, unico passato', 'abgstürzt', ['tecnologia'], 'La e atona cade: abgstürzt, gschribe, gsi.', 'Der Server ist schon wieder abgestürzt.'],
  ['b1-21', 'B1', 'Mir müend d Ursach ussefinde.', 'Dobbiamo trovare la causa.', 'verbi modali', 'müend', ['tecnologia'], 'usse = heraus: ussefinde, ussegaa.', 'Wir müssen die Ursache herausfinden.'],
  ['b1-22', 'B1', 'Mäld di bis am Fritig.', 'Fatti sentire entro venerdì.', 'imperativo', 'Mäld di', ['lavoro'], 'All’imperativo il riflessivo di seconda persona è di.', 'Melde dich bis Freitag.'],
  ['b1-23', 'B1', 'Ich bi mer nöd sicher, öb das stimmt.', 'Non sono sicuro che sia giusto.', 'frasi secondarie', 'öb', ['accademico'], 'öb è il "se" dubitativo, wänn quello condizionale.', 'Ich bin mir nicht sicher, ob das stimmt.'],
  ['b1-24', 'B1', 'Weisch, wänn er chunt?', 'Sai quando arriva?', 'domande', 'wänn er chunt', ['generale'], 'Nella domanda indiretta il verbo va in fondo.', 'Weißt du, wann er kommt?'],
  ['b1-25', 'B1', 'Das laht sich eifach löse.', 'Si risolve facilmente.', 'verbi riflessivi', 'laht sich', ['tecnologia'], 'laa + sich + infinito equivale a un passivo di possibilità.', 'Das lässt sich einfach lösen.'],

  /* ------------------------------- B2 ------------------------------- */
  ['b2-01', 'B2', 'Hett i das gwüsst, wär i früener cho.', 'Se lo avessi saputo, sarei venuto prima.', 'Konjunktiv', 'Hett i', ['generale'], 'Senza wänn il verbo apre la frase, come in tedesco.', 'Hätte ich das gewusst, wäre ich früher gekommen.'],
  ['b2-02', 'B2', 'Wär’s nöd besser, no z warte?', 'Non sarebbe meglio aspettare ancora?', 'Konjunktiv', 'Wär’s', ['lavoro'], 'no significa "ancora", non "no": falso amico interno.', 'Wäre es nicht besser, noch zu warten?'],
  ['b2-03', 'B2', 'Trotz em Räge sind alli cho.', 'Nonostante la pioggia sono venuti tutti.', 'dativo', 'Trotz em', ['generale'], 'Il genitivo non esiste: trotz regge il dativo, em Räge.', 'Trotz des Regens sind alle gekommen.'],
  ['b2-04', 'B2', 'Am Peter sis Auto isch kaputt.', 'La macchina di Peter è rotta.', 'possessivo dativo', 'Am Peter sis', ['generale'], 'Possesso col dativo più possessivo: "al Peter la sua macchina".', 'Peters Auto ist kaputt.'],
  ['b2-05', 'B2', 'Das isch s Buech vo mim Brueder.', 'È il libro di mio fratello.', 'possesso con vo', 'vo mim', ['generale'], 'L’altra via al possesso: vo + dativo.', 'Das ist das Buch von meinem Bruder.'],
  ['b2-06', 'B2', 'Er söll sehr erfahre sii.', 'Si dice che sia molto esperto.', 'verbi modali', 'söll', ['lavoro'], 'sölle come diceria: "dicono che", non un obbligo.', 'Er soll sehr erfahren sein.'],
  ['b2-07', 'B2', 'Das wird scho stimme.', 'Sarà senz’altro così.', 'particelle e intercalari', 'scho', ['generale'], 'scho qui non è "già": rassicura chi ascolta.', 'Das wird schon stimmen.'],
  ['b2-08', 'B2', 'Da chunsch nöd drus.', 'Non ci si capisce niente.', 'espressioni fisse', 'drus', ['tecnologia'], 'drus choo = venirne a capo. Espressione molto svizzera.', 'Da wird man nicht schlau draus.'],
  ['b2-09', 'B2', 'Es git no öppis z bespräche.', 'C’è ancora qualcosa da discutere.', 'pronomi', 'öppis', ['lavoro'], 'öppis = etwas, öpper = jemand, niene = nirgends.', 'Es gibt noch etwas zu besprechen.'],
  ['b2-10', 'B2', 'Do isch öpper gsi.', 'Qui c’è stato qualcuno.', 'pronomi', 'öpper', ['generale'], 'öpper regge il verbo al singolare, come jemand.', 'Da ist jemand gewesen.'],
  ['b2-11', 'B2', 'Chum doch mal verbii.', 'Fatti vedere, dai.', 'particelle e intercalari', 'doch mal', ['generale'], 'doch mal ammorbidisce l’invito; verbii = vorbei.', 'Komm doch mal vorbei.'],
  ['b2-12', 'B2', 'Das isch jetz aber schad.', 'Che peccato, però.', 'particelle e intercalari', 'aber', ['generale'], 'aber a metà frase è una particella, non una congiunzione.', 'Das ist jetzt aber schade.'],
  ['b2-13', 'B2', 'Mir wänd das nomal aaluege.', 'Vogliamo riguardarlo.', 'verbi modali', 'wänd', ['lavoro'], 'wele fa: ich wott, du wotsch, mir wänd.', 'Wir wollen das nochmal anschauen.'],
  ['b2-14', 'B2', 'Es macht nüt.', 'Non fa niente.', 'espressioni fisse', 'nüt', ['generale'], 'nüt = nichts. La risposta standard a una scusa.', 'Es macht nichts.'],
  ['b2-15', 'B2', 'Das gaht mi nüt aa.', 'Non mi riguarda.', 'espressioni fisse', 'gaht mi nüt aa', ['lavoro'], 'öpper öppis aagaa = riguardare qualcuno.', 'Das geht mich nichts an.'],
  ['b2-16', 'B2', 'Das isch guet gsi, gäll?', 'È stato bello, vero?', 'particelle e intercalari', 'gäll', ['generale'], 'gäll è il tag interrogativo svizzero: cerca conferma.', 'Das war gut, nicht wahr?'],
  ['b2-17', 'B2', 'Ich han’s im Gfüehl.', 'Ho una sensazione.', 'espressioni fisse', 'im Gfüehl', ['generale'], 'Anche qui la e atona cade: Gfüehl, Gschicht, Gschäft.', 'Ich habe so ein Gefühl.'],
  ['b2-18', 'B2', 'Jetz mach emal vorwärts.', 'Adesso sbrigati.', 'imperativo', 'emal', ['lavoro'], 'emal attenua l’ordine, come il mal tedesco.', 'Jetzt mach mal vorwärts.'],
  ['b2-19', 'B2', 'Das isch nöd ohni.', 'Non è da poco.', 'espressioni fisse', 'nöd ohni', ['lavoro'], 'Litote: dire poco per dire molto.', 'Das ist nicht ohne.'],
  ['b2-20', 'B2', 'D Näbewirkige träted sälte uf.', 'Gli effetti collaterali compaiono di rado.', 'verbi separabili', 'uf', ['salute'], 'uftrete = auftreten; Näbewirkige di nuovo con la -ig.', 'Die Nebenwirkungen treten selten auf.'],

  /* ------------------------------- C1 ------------------------------- */
  ['c1-01', 'C1', 'Das isch mer wurscht.', 'Per me è indifferente.', 'espressioni fisse', 'wurscht', ['generale'], 'Alla lettera "mi è salsiccia": totale indifferenza.', 'Das ist mir egal.'],
  ['c1-02', 'C1', 'Uf de letschti Drücker.', 'All’ultimo momento.', 'espressioni fisse', 'letschti Drücker', ['lavoro'], 'Immagine del bottone premuto un attimo prima della fine.', 'Auf den letzten Drücker.'],
  ['c1-03', 'C1', 'Das gaht wie gschmiert.', 'Fila liscio.', 'espressioni fisse', 'wie gschmiert', ['tecnologia'], 'gschmiert = ingrassato, come un ingranaggio.', 'Das geht wie geschmiert.'],
  ['c1-04', 'C1', 'Er hät e langi Leitig.', 'Ci mette un po’ a capire.', 'espressioni fisse', 'langi Leitig', ['lavoro'], 'La "linea lunga" del telefono: il messaggio ci mette a arrivare.', 'Er hat eine lange Leitung.'],
  ['c1-05', 'C1', 'Ich han de Fade verlore.', 'Ho perso il filo.', 'espressioni fisse', 'de Fade', ['accademico'], 'Stessa immagine dell’italiano, con Fade al posto di Faden.', 'Ich habe den Faden verloren.'],
  ['c1-06', 'C1', 'Das chunt mer spanisch vor.', 'Mi sembra strano.', 'verbi separabili', 'spanisch vor', ['generale'], 'vorchoo = vorkommen. Lo strano qui è "spagnolo".', 'Das kommt mir spanisch vor.'],
  ['c1-07', 'C1', 'Mir händ en Chrampf gha.', 'Abbiamo faticato parecchio.', 'differenze dal tedesco', 'Chrampf', ['lavoro'], 'Chrampf è il lavoro duro; chrampfe è sgobbare.', 'Wir hatten viel Arbeit.'],
  ['c1-08', 'C1', 'Das isch e ganz e anderi Gschicht.', 'È tutta un’altra storia.', 'articoli', 'e ganz e anderi', ['lavoro'], 'L’articolo indeterminativo si ripete dopo ganz: tratto tipico.', 'Das ist eine ganz andere Geschichte.'],
  ['c1-09', 'C1', 'Er nimmt kei Blatt vor de Mund.', 'Non le manda a dire.', 'espressioni fisse', 'kei Blatt', ['lavoro'], 'Il foglio davanti alla bocca è la reticenza che manca.', 'Er nimmt kein Blatt vor den Mund.'],
  ['c1-10', 'C1', 'Ich ha mi is Züüg gleit.', 'Mi ci sono messo d’impegno.', 'verbi riflessivi', 'is Züüg gleit', ['lavoro'], 'sich is Züüg lege: buttarcisi anima e corpo.', 'Ich habe mich ins Zeug gelegt.'],
  ['c1-11', 'C1', 'Das lauft nöd rund.', 'Non gira liscio.', 'espressioni fisse', 'rund', ['tecnologia'], 'Il contrario di gaht wie gschmiert.', 'Das läuft nicht rund.'],
  ['c1-12', 'C1', 'Er macht sich us em Staub.', 'Se la squaglia.', 'verbi riflessivi', 'us em Staub', ['generale'], 'us em è il dativo contratto: aus dem.', 'Er macht sich aus dem Staub.'],

  /* ------------------------------- C2 ------------------------------- */
  ['c2-01', 'C2', 'Er hät de Foifer und s Weggli welle.', 'Voleva la botte piena e la moglie ubriaca.', 'espressioni fisse', 'de Foifer und s Weggli', ['lavoro'], 'Il modo di dire più svizzero che ci sia: la moneta da cinque e anche il panino.', 'Er wollte alles auf einmal.'],
  ['c2-02', 'C2', 'Das gaht uf kei Chuehut.', 'Questo è inaudito.', 'espressioni fisse', 'uf kei Chuehut', ['generale'], 'Non ci sta nemmeno su una pelle di vacca, tanto è grosso.', 'Das geht auf keine Kuhhaut.'],
  ['c2-03', 'C2', 'Sie händ s Heu nöd uf de gliiche Bühni.', 'Non vanno d’accordo.', 'espressioni fisse', 's Heu', ['lavoro'], 'Il fieno su solai diversi: visioni incompatibili.', 'Sie sind sich nicht einig.'],
  ['c2-04', 'C2', 'Das hät weder Hand no Fuess.', 'Non sta né in cielo né in terra.', 'espressioni fisse', 'weder Hand no Fuess', ['accademico'], 'weder ... no = né ... né.', 'Das hat weder Hand noch Fuß.'],
  ['c2-05', 'C2', 'Jetz händ mer de Salat.', 'Adesso sono guai.', 'espressioni fisse', 'de Salat', ['tecnologia'], 'Si dice quando il pasticcio è ormai fatto.', 'Jetzt haben wir den Salat.'],
  ['c2-06', 'C2', 'Er macht us ere Mugg en Elefant.', 'Fa di una mosca un elefante.', 'espressioni fisse', 'us ere Mugg', ['generale'], 'Mugg è la zanzara; ere è il dativo femminile.', 'Er macht aus einer Mücke einen Elefanten.'],
  ['c2-07', 'C2', 'Das isch mer Hans was Heiri.', 'Per me è lo stesso.', 'espressioni fisse', 'Hans was Heiri', ['generale'], 'Due nomi qualunque: uno vale l’altro.', 'Das ist mir einerlei.'],
  ['c2-08', 'C2', 'Mir müend en Rank finde.', 'Dobbiamo trovare una via d’uscita.', 'espressioni fisse', 'en Rank', ['lavoro'], 'Rank è la curva della strada: si gira attorno all’ostacolo.', 'Wir müssen eine Lösung finden.'],
];

export const SENTENCES = RAW.map(([id, lv, text, it, g, key, dom, note, de]) => ({
  id: `gsw-${id}`, lv, text, it, g, key, dom, note, bridge: de,
}));

/* Banca di item per il test di livello adattivo (vedi corpus-en.js). */
const CENTER = { A1: -2.2, A2: -1.3, B1: -0.4, B2: 0.5, C1: 1.4, C2: 2.2 };

const ITEMS = [
  ['p01', 'A1', 'Come si saluta formalmente a Zurigo?', ['Grüezi', 'Moin', 'Servus', 'Tschüss'], 0, 1.5, -0.3],
  ['p02', 'A1', 'Ich ___ us Italie.', ['chume', 'komme', 'chumt', 'chunsch'], 0, 1.5, -0.1],
  ['p03', 'A1', 'Ich verstande ___.', ['nöd', 'nicht', 'kei', 'nüt'], 0, 1.6, 0.1],
  ['p04', 'A1', 'Cosa vuol dire "Merci vilmal"?', ['Grazie mille', 'Scusa tanto', 'A presto', 'Per favore'], 0, 1.4, -0.2],
  ['p05', 'A1', 'Ich gang ___ Fuess.', ['z', 'zu', 'uf', 'i'], 0, 1.5, 0.3],
  ['p06', 'A1', '___ mer hälfe?', ['Chasch', 'Kannst', 'Chunsch', 'Chönd'], 0, 1.5, 0.2],

  ['p07', 'A2', 'Come si dice "ero malato" in dialetto?', ['bin i chrank gsi', 'war i chrank', 'bin i chrank gsii worde', 'han i chrank gha'], 0, 1.7, -0.2],
  ['p08', 'A2', 'Er hät kei Ziit ___.', ['gha', 'ghabt', 'hatte', 'gsi'], 0, 1.6, 0],
  ['p09', 'A2', 'Ich weiss, ___ er chunt.', ['ass', 'dass', 'wo', 'öb'], 0, 1.6, 0.2],
  ['p10', 'A2', 'Mir ___ lang gwartet.', ['händ', 'haben', 'hend nicht', 'sind'], 0, 1.5, 0.1],
  ['p11', 'A2', 'Cosa significa "schaffe" in Svizzera?', ['Lavorare', 'Creare', 'Riuscire', 'Riposare'], 0, 1.5, 0.3],
  ['p12', 'A2', 'Nächscht Wuche gang i ___ Züri.', ['uf', 'nach', 'zu', 'i'], 0, 1.5, 0.4],

  ['p13', 'B1', 'De Maa, ___ öis aaglüte hät.', ['wo', 'der', 'wer', 'wa'], 0, 1.7, -0.2],
  ['p14', 'B1', 'De Bricht isch geschter gschribe ___.', ['worde', 'gworde', 'wurde', 'gsi'], 0, 1.7, 0.1],
  ['p15', 'B1', 'Wänn i meh Ziit ___, würd i reise.', ['hett', 'hätti gha', 'han', 'hätte'], 0, 1.6, 0.2],
  ['p16', 'B1', 'Es lohnt sich, das ___.', ['aazluege', 'z aaluege', 'aaluege z', 'anzuschauen'], 0, 1.7, 0.4],
  ['p17', 'B1', 'Cosa vuol dire "Das chunt druf aa"?', ['Dipende', 'Arriva subito', 'Non serve', 'Va bene'], 0, 1.4, -0.3],
  ['p18', 'B1', 'Ich bi mer nöd sicher, ___ das stimmt.', ['öb', 'wänn', 'ass', 'wo'], 0, 1.6, 0.3],

  ['p19', 'B2', 'Come si dice "la macchina di Peter"?', ['Am Peter sis Auto', 'Peters Auto', 'S Auto Peters', 'De Peter sis Auto'], 0, 1.7, 0.2],
  ['p20', 'B2', '___ em Räge sind alli cho.', ['Trotz', 'Trotz de', 'Trotz des', 'Wägen de'], 0, 1.6, 0.1],
  ['p21', 'B2', 'Es git no ___ z bespräche.', ['öppis', 'etwas', 'öpper', 'nüt'], 0, 1.6, 0.3],
  ['p22', 'B2', 'Che cosa aggiunge "gäll" alla fine di una frase?', ['Chiede conferma', 'Nega la frase', 'Fa una domanda nuova', 'Rafforza un ordine'], 0, 1.5, 0.4],
  ['p23', 'B2', 'Cosa significa "Da chunsch nöd drus"?', ['Non ci si capisce niente', 'Non puoi uscire', 'Non ci arrivi in tempo', 'Non vale la pena'], 0, 1.6, 0.5],
  ['p24', 'B2', 'Mir ___ das nomal aaluege.', ['wänd', 'wollen', 'wotsch', 'wei nöd'], 0, 1.6, 0.3],

  ['p25', 'C1', 'Cosa significa "Das isch mer wurscht"?', ['Non mi importa', 'Ho fame', 'È troppo caro', 'Mi va bene così'], 0, 1.5, -0.2],
  ['p26', 'C1', 'Cosa significa "Er hät e langi Leitig"?', ['Ci mette a capire', 'Parla troppo', 'Ha molta pazienza', 'Abita lontano'], 0, 1.6, 0.1],
  ['p27', 'C1', 'Das chunt mer ___ vor.', ['spanisch', 'komisch z', 'spanische', 'fremd us'], 0, 1.6, 0.3],
  ['p28', 'C1', 'Cosa vuol dire "Chrampf"?', ['Lavoro duro', 'Crampo alla gamba', 'Lite', 'Confusione'], 0, 1.5, 0.2],
  ['p29', 'C1', 'Er macht sich ___ Staub.', ['us em', 'us de', 'vom', 'ab em'], 0, 1.6, 0.4],

  ['p30', 'C2', 'Cosa significa "de Foifer und s Weggli welle"?', ['Volere tutto insieme', 'Fare la spesa', 'Pagare in contanti', 'Cambiare idea'], 0, 1.6, 0],
  ['p31', 'C2', 'Cosa significa "Das gaht uf kei Chuehut"?', ['È inaudito', 'Non serve a niente', 'È molto caro', 'È lontanissimo'], 0, 1.6, 0.2],
  ['p32', 'C2', 'Cosa significa "s Heu nöd uf de gliiche Bühni haa"?', ['Non andare d’accordo', 'Non avere tempo', 'Non avere soldi', 'Abitare lontano'], 0, 1.7, 0.3],
  ['p33', 'C2', 'Jetz händ mer de ___.', ['Salat', 'Chabis', 'Rank', 'Foifer'], 0, 1.6, 0.1],
  ['p34', 'C2', 'Cosa significa "en Rank finde"?', ['Trovare una via d’uscita', 'Fare la fila', 'Prendere una curva', 'Salire di grado'], 0, 1.6, 0.4],
];

export const PLACEMENT = ITEMS.map(([id, lv, prompt, options, correct, a, off]) => ({
  id: `gsw-${id}`,
  lv,
  prompt,
  options,
  correct,
  a,
  b: CENTER[lv] + off,
  kind: prompt.includes('___') ? 'gap' : 'ask',
}));

export const GSW = {
  code: 'gsw',
  name: 'Svizzero tedesco',
  flag: '🇨🇭',
  locale: 'de-CH',
  rate: 0.85,
  dir: 'ltr',
  variant: 'Züridütsch, grafia Dieth',
  blurb: 'Dialetto di Zurigo. Ogni frase porta con sé il tedesco standard di riscontro.',
  caveat: 'Lo svizzero tedesco non ha un’ortografia ufficiale e cambia da cantone a cantone: qui si segue il dialetto di Zurigo. I livelli A1-C2 sono bande di difficoltà, non certificazioni, perché il QCER non copre i dialetti. La voce sintetica legge in tedesco standard: prendila come indicazione, non come modello di pronuncia.',
  bridge: 'Tedesco standard',
  sentences: SENTENCES,
  placement: PLACEMENT,
  grammar: GRAMMAR,
};
