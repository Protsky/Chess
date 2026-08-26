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
3. **Ogni frase diventa tre carte** in ordine crescente di sforzo:
   comprendere → completare il buco grammaticale → produrre dall'italiano.
   La produzione si sblocca solo quando il passaggio precedente è consolidato.
4. **Un algoritmo di ripetizione dilazionata** decide quando rivedere ciascuna
   carta, puntando alla probabilità di ricordare che hai richiesto.

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
| 🇩🇪 Tedesco | 180 | 44 | 46 |
| 🇨🇭 Svizzero tedesco | 115 | 34 | 31 |
| 🇬🇧 Inglese | 205 | 48 | 46 |
| 🇪🇸 Spagnolo | 120 | 38 | 32 |

Tutte le frasi sono scritte per italofoni: la nota di ogni frase spiega proprio
il punto dove l'italiano ci fa sbagliare (la posizione del verbo tedesco,
`must` contro `have to`, `ser` contro `estar`, il congiuntivo dopo `cuando`).
Media di sei parole per frase.

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

La voce sintetica usa `speechSynthesis` del sistema: su iOS le voci tedesca,
inglese e spagnola sono già installate. Per il dialetto non esiste una voce
sintetica: si ripiega sul tedesco svizzero standard.

## Strumenti

```bash
node tools/validate-lingua.mjs     # corpus + motori: 177 controlli
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
- **Consiglio d'Europa, QCER (2001/2020)** — la scala A1-C2.
