/*
 * situations.mjs — le situazioni di una giornata qualunque, in chiaro.
 *
 * Serve a due strumenti: `corpus-review.mjs`, che mostra i buchi prima di
 * allargare il corpus, e `validate-lingua.mjs`, che impedisce che i buchi
 * tornino. Il riconoscimento è dichiaratamente grezzo — parole chiave sulla
 * traduzione italiana — e sta qui in chiaro proprio perché si possa
 * contestare riga per riga. Non è una misura: è una lente.
 */

/* Le situazioni di una giornata qualunque, con le parole che le tradiscono. */
export const SITUATIONS = [
  ['salutare', /\b(ciao|buongiorno|buonasera|buonanotte|arrivederci|salve|a domani|a presto)/i],
  ['presentarsi', /\b(mi chiamo|come ti chiami|come si chiama|piacere|vengo da|abito a|sono italian)/i],
  ['come stai', /\b(come stai|come sta|come va|tutto bene|sto bene)/i],
  ['ringraziare e scusarsi', /\b(grazie|prego|scusa|scusi|mi dispiace|per favore|per piacere)/i],
  ['chiedere l’ora', /\b(che ore sono|che ora|in punto|mezzogiorno|mezzanotte|alle (sette|otto|nove|dieci|undici|sei|cinque))/i],
  ['giorni e date', /\b(luned|marted|mercoled|gioved|venerd|sabato|domenica|domani|ieri|oggi|settimana|mese|weekend|fine settimana)/i],
  ['numeri e prezzi', /\b(quanto costa|euro|prezzo|caro|economic|sconto|costa)/i],
  ['al bar e al ristorante', /\b(caff|birra|vino|acqua|tavolo|men|ordinare|cameriere|colazione|pranzo|cena|ristorante|bar)/i],
  ['il conto', /\b(il conto|pagare|carta di credito|contanti|bancomat|pago)/i],
  ['fare la spesa', /\b(spesa|supermercato|pane|latte|frutta|verdura|negozio|comprare|compro)/i],
  ['taglie e vestiti', /\b(taglia|provare|maglia|scarpe|giacca|vestit|camicia|pantalon)/i],
  ['chiedere indicazioni', /\b(dov’è|dove si trova|come arrivo|vicino|lontano|a destra|a sinistra|dritto|angolo)/i],
  ['mezzi e biglietti', /\b(autobus|treno|metro|tram|biglietto|fermata|binario|stazione|aeroporto|volo|taxi)/i],
  ['albergo e alloggio', /\b(albergo|hotel|camera|prenot|chiave|colazione inclusa|check)/i],
  ['casa e affitto', /\b(appartamento|affitto|casa|stanza|cucina|bagno|balcone|vicin)/i],
  ['il tempo che fa', /\b(piove|nevica|sole|freddo|caldo|vento|nuvol|tempo è)/i],
  ['salute e dolori', /\b(male|dolore|febbre|raffreddore|tosse|stanc|malat|mal di)/i],
  ['farmacia e medico', /\b(farmacia|medic|dottor|ricetta|pastigl|ospedale|appuntamento dal)/i],
  ['telefono e messaggi', /\b(telefon|chiamare|messaggio|numero|rispondere|richiam|cellulare)/i],
  ['internet e tecnologia', /\b(wifi|wi-fi|internet|password|batteria|schermo|app\b|computer|caric|online|file|sito)/i],
  ['lavoro e riunioni', /\b(lavoro|ufficio|riunione|collega|capo|progetto|scadenza|turno|contratto)/i],
  ['email e messaggi scritti', /\b(e-?mail|mail\b|allegat|lettera)/i],
  ['banca e soldi', /\b(banca|conto corrente|bonifico|soldi|stipendio|risparmi)/i],
  ['famiglia', /\b(madre|padre|mamma|pap|sorella|fratello|figli|moglie|marito|nonn|genitori)/i],
  ['amici e inviti', /\b(amic|invit|venire con|festa|uscire|ci vediamo|andiamo insieme)/i],
  ['tempo libero', /\b(film|cinema|musica|libro|leggere|serie|teatro|concerto|passeggiat)/i],
  ['cucinare e mangiare a casa', /\b(cucin|cena a casa|ricetta|forno|padella|preparo|fame|mangi)/i],
  ['bere', /\b(bere|bevo|sete|bicchiere|bottiglia)/i],
  ['sveglia e routine', /\b(mi alzo|sveglia|mi lavo|mi vesto|vado a letto|dormo|dormire|colazione)/i],
  ['pulizie e faccende', /\b(puli|lava|bucato|faccende|ordine|spazzatura|piatti)/i],
  ['studio e scuola', /\b(studi|scuola|universit|esame|corso|lezione|impar)/i],
  ['sport e movimento', /\b(sport|palestra|corr|nuot|bicicletta|camminare|allena)/i],
  ['chiedere permesso e aiuto', /\b(posso|puoi aiutarmi|mi puoi|potrebbe|mi aiuti|permesso|si può)/i],
  ['non ho capito', /\b(non ho capito|non capisco|più lentamente|ripetere|come si dice|cosa significa)/i],
  ['quantità', /\b(quanti|quante|poco|molto|troppo|abbastanza|un po’|niente)/i],
  ['opinioni ed emozioni', /\b(mi piace|non mi piace|penso|credo|content|trist|preoccup|sono sicur|secondo me)/i],
  ['appuntamenti', /\b(appuntamento|prenotare|disponibil|libero (alle|domani)|spost(are|o) l)/i],
  ['problemi e imprevisti', /\b(non funziona|si è rotto|ho perso|in ritardo|sbagliat|problema|aiuto)/i],
];

export const words = (s) => s.split(/\s+/).filter(Boolean).length;

/* Due frasi sono "vicine" se le loro traduzioni condividono quasi tutto. */
const bag = (s) => new Set(s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
export function overlap(a, b) {
  const A = bag(a);
  const B = bag(b);
  // sotto le tre parole piene il confronto non dice niente: "A domani!" e
  // "Domani mi alzerò prima" condividono tutto quello che hanno
  if (A.size < 3 || B.size < 3) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

