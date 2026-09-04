"""
trappole-maia.py — secondo dei due passi che costruiscono le trappole.

    venv-maia/Scripts/python tools/trappole-maia.py

Il primo passo (`trappole-mosse.mjs`) ha stabilito un fatto di scacchi: in ogni
posizione, quali mosse perdono materiale. Qui si chiede a Maia-2 una cosa
diversa, che il motore non sa e non puo' sapere: **quanto spesso un essere umano
di una certa forza gioca proprio quelle mosse**.

Maia-2 (McIlroy-Young et al.) e' addestrata su partite umane vere di Lichess ed
e' condizionata sul rating di chi muove: non prevede la mossa migliore, prevede
la mossa che verra' giocata. E' l'unica fonte che permette di dire «qui un 1200
cade e un 1400 no» invece di dire «qui c'e' una trappola» e basta.

Che cosa finisce nel repo: **solo numeri**. Il modello (280 MB) e l'ambiente
Python restano fuori, come Stockfish per il corpus tattico. L'app non carica
niente di tutto questo.

Un avvertimento che va tenuto attaccato ai numeri, e che l'app scrive: questa e'
una *previsione di comportamento*, non un fatto. La probabilita' che una mossa
perda materiale e' verificata sul motore; la probabilita' che tu la giochi e'
stimata da un modello, con il suo errore.
"""

import json
import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent

# Le fasce: coprono l'arco in cui vive chi usa l'app, con un passo che Maia
# distingue davvero. Piu' fitte non aggiungerebbero informazione, solo file.
FASCE = [1100, 1300, 1500, 1700, 1900]

# Sotto questa copertura della probabilita' non si scrive niente: vorrebbe dire
# che le chiavi delle mosse non corrispondono, e i numeri sarebbero zeri
# travestiti da misure. Il silenzio non prova l'assenza.
COPERTURA_MINIMA = 0.90


def main():
    sorgente = QUI / 'trappole-mosse.json'
    if not sorgente.exists():
        sys.exit('Manca tools/trappole-mosse.json: prima `node tools/trappole-mosse.mjs`.')

    posizioni = json.loads(sorgente.read_text(encoding='utf-8'))
    print(f'Posizioni da valutare: {len(posizioni)} x {len(FASCE)} fasce')

    from maia2 import model as maia_model
    from maia2 import inference

    modello = maia_model.from_pretrained(type='rapid', device='cpu')
    prep = inference.prepare()

    out = []
    copertura_totale = 0.0
    conteggio = 0

    for i, pos in enumerate(posizioni):
        perdenti = set(pos['perdenti'])
        errori = []
        for elo in FASCE:
            distribuzione, _ = inference.inference_each(modello, prep, pos['f'], elo, elo)
            massa = sum(distribuzione.values())
            if massa > 0:
                copertura_totale += massa
                conteggio += 1
            p_err = sum(p for mossa, p in distribuzione.items() if mossa in perdenti)
            errori.append(round(p_err * 100))
        out.append({'id': pos['id'], 'r': pos['r'], 't': pos['t'], 'e': errori,
                    'perdenti': len(perdenti), 'legali': pos['legali']})

        if (i + 1) % 500 == 0:
            print(f'  {i + 1}/{len(posizioni)}')

    copertura = copertura_totale / max(1, conteggio)
    print(f'Copertura media della distribuzione: {copertura:.3f}')
    if copertura < COPERTURA_MINIMA:
        sys.exit(
            f'Copertura {copertura:.3f} sotto {COPERTURA_MINIMA}: le chiavi delle mosse '
            'non corrispondono fra il motore e Maia. Non scrivo niente: dei numeri '
            'costruiti su un disallineamento sarebbero zeri travestiti da misure.'
        )

    scrivi(out, copertura)


def scrivi(righe, copertura):
    """Il file generato: id, fascia per fascia, la probabilita' d'errore in percento."""

    # Ordine deterministico: rigenerato domani, byte per byte lo stesso.
    righe.sort(key=lambda x: (x['r'], x['id']))

    # Quante sono davvero trappole: alta alla tua fascia, e piu' bassa sopra.
    trappole = [r for r in righe if trappola_per(r) is not None]
    per_fascia = {}
    for r in trappole:
        f = trappola_per(r)
        per_fascia[f] = per_fascia.get(f, 0) + 1

    corpo = '\n'.join(
        f"  {{ id: '{r['id']}', r: {r['r']}, e: [{', '.join(str(x) for x in r['e'])}] }},"
        for r in righe
    )

    testo = f'''/*
 * trappole.js — GENERATO: non modificare a mano.
 *
 *   node tools/trappole-mosse.mjs
 *   venv-maia/Scripts/python tools/trappole-maia.py
 *
 * Per {len(righe)} posizioni, la probabilita' che un giocatore di ciascuna fascia
 * giochi una mossa che **perde materiale**.
 *
 * I due numeri vengono da due posti diversi, e la differenza conta:
 *
 *   - *quali* mosse perdono lo dice il motore di casa, con una ricerca
 *     esaustiva sulle mosse forzanti (`tools/forzante.mjs`). E' un fatto, e si
 *     puo' ricontrollare;
 *   - *quanto spesso vengono giocate* lo dice Maia-2, una rete addestrata su
 *     partite umane vere e condizionata sul rating di chi muove. E' una
 *     previsione di comportamento, con il suo errore, e l'app la presenta come
 *     tale invece di spacciarla per una misura.
 *
 * Fasce (Elo): {', '.join(str(f) for f in FASCE)}
 * Copertura media della distribuzione di Maia sulle mosse legali: {copertura:.3f}
 *
 * Trappole vere (errore >= {SOGLIA_ALTA}% alla tua fascia, e almeno {SALTO} punti
 * in meno alla fascia piu' alta): {len(trappole)}
{chr(10).join(f" *   {f}: {n}" for f, n in sorted(per_fascia.items()))}
 *
 *   id  identificativo del puzzle (o della quieta, con la q davanti)
 *   r   punteggio Glicko del puzzle d'origine
 *   e   probabilita' d'errore in percento, una per fascia
 */

/** Le fasce di Elo a cui i numeri si riferiscono. */
export const FASCE = [{', '.join(str(f) for f in FASCE)}];

/*
 * Le soglie che fanno dire «trappola», esportate invece che ricopiate: se
 * l'app ne usasse di sue, il numero mostrato e il numero calcolato qui
 * potrebbero divergere senza che nessuno se ne accorga.
 */
export const SOGLIA_ALTA = {SOGLIA_ALTA};
export const SALTO = {SALTO};

export const TRAPPOLE = [
{corpo}
];

const PER_ID = new Map(TRAPPOLE.map((t) => [t.id, t]));

export const byId = (id) => PER_ID.get(id) || null;
'''

    destinazione = RADICE / 'assets' / 'js' / 'trappole.js'
    destinazione.write_text(testo, encoding='utf-8')

    print(f'Scritto {destinazione.relative_to(RADICE)}: {len(righe)} posizioni')
    print(f'Trappole vere: {len(trappole)}')
    for f, n in sorted(per_fascia.items()):
        print(f'   fascia {f}: {n}')
    media = [sum(r["e"][i] for r in righe) / len(righe) for i in range(len(FASCE))]
    print('Errore medio per fascia: ' + ', '.join(
        f'{f}: {m:.0f}%' for f, m in zip(FASCE, media)))


SOGLIA_ALTA = 30
SALTO = 10


def trappola_per(riga):
    """La fascia per cui questa posizione e' una trappola, se lo e' per qualcuna.

    Due condizioni, e servono tutte e due: l'errore dev'essere **frequente** a
    quella fascia, e dev'essere **meno frequente in cima**. Una posizione dove
    sbagliano tutti allo stesso modo non e' una trappola del tuo livello, e' solo
    una posizione difficile - e dirla trappola sarebbe una bugia comoda.

    Il confronto e' con la fascia piu' alta, non con quella subito sopra: fra
    due fasce a duecento punti di distanza Maia distingue poco, e chiedendo un
    salto li' restavano trentadue posizioni in tutto. Misurato, non deciso.
    """
    alto = riga['e'][-1]
    for i in range(len(FASCE) - 1):
        if riga['e'][i] >= SOGLIA_ALTA and riga['e'][i] - alto >= SALTO:
            return FASCE[i]
    return None


if __name__ == '__main__':
    main()
