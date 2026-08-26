/*
 * translit.js — cirillico e tastiera italiana.
 *
 * Il russo porta un problema che le altre lingue non hanno: la frase giusta
 * si scrive in un alfabeto che sulla tastiera non c'è. Delle due, una:
 *
 *   - se scrivi in cirillico, il confronto è stretto e ti tiene sui dettagli
 *     (ь e ъ contano, е ed ё no perché la seconda quasi nessuno la scrive);
 *   - se scrivi in caratteri latini, entrambe le frasi vengono ridotte alla
 *     stessa traslitterazione grossolana, e le distinzioni che una tastiera
 *     italiana non permette di fare (щ contro ш, ы contro и) non ti penalizzano.
 *
 * L'accento tonico si scrive nel corpus con un asterisco davanti alla vocale
 * (`теб*я` diventa `тебя́`): resta visibile quando studi, sparisce nel confronto.
 */

const CYRILLIC = /[Ѐ-ӿ]/;

export const hasCyrillic = (text) => CYRILLIC.test(text);

/** Segna l'accento tonico sulla vocale che segue l'asterisco. */
export const stress = (text) => text.replace(/\*(.)/g, '$1́');

const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'iu', я: 'ia',
};

/*
 * Una i lunga vale una i: "priiatno" e "priatno" sono lo stesso tentativo,
 * scritto da chi ha in testa la ja russa o la ia italiana.
 */
const collapse = (text) => text.replace(/ii+/g, 'i');

/** Da cirillico alla forma latina canonica. */
export function toLatin(text) {
  let out = '';
  for (const ch of text.toLowerCase()) out += ch in MAP ? MAP[ch] : ch;
  return collapse(out);
}

/*
 * Versione da leggere, non da confrontare: tiene la ё (sempre accentata),
 * distingue ы da и e й da и. Serve solo alla riga di pronuncia sotto la frase.
 */
const PRETTY = { ...MAP, 'ё': 'ió', 'ы': 'y', 'й': 'j' };

export function toLatinPretty(text) {
  let out = '';
  for (const ch of text.toLowerCase()) out += ch in PRETTY ? PRETTY[ch] : ch;
  return out;
}

/*
 * Le scritture latine che un italiano usa davvero, ricondotte alla stessa
 * forma canonica. L'ordine conta: prima i gruppi lunghi, poi i singoli, con
 * dei segnaposto per non far ricadere i gruppi già risolti nelle regole dopo.
 */
const LATIN_RULES = [
  [/shch|sch|szcz/g, '~s'],
  [/tsch/g, '~c'],
  [/ya|ja/g, '~a'],
  [/yu|ju/g, '~u'],
  [/yo|jo/g, 'e'],
  [/kh/g, 'h'],
  [/ts/g, 'c'],
  [/zh/g, '~z'],
  [/ch/g, '~c'],
  [/sh/g, '~s'],
  [/[yj]/g, 'i'],
  [/w/g, 'v'],
  [/x/g, 'ks'],
  [/['`’]/g, ''],
  [/~a/g, 'ia'],
  [/~u/g, 'iu'],
  [/~z/g, 'zh'],
  [/~c/g, 'ch'],
  [/~s/g, 'sh'],
];

/** Da una scrittura latina qualsiasi alla stessa forma canonica. */
export function foldLatin(text) {
  let out = text.toLowerCase();
  for (const [re, to] of LATIN_RULES) out = out.replace(re, to);
  return collapse(out);
}

/** In cirillico si perdona solo la ё scritta е: il resto conta. */
const foldCyrillic = (text) => text.toLowerCase().replace(/ё/g, 'е');

/**
 * Sceglie il metro di confronto guardando come ha risposto chi studia.
 * Serve a check.js, che lo applica a tutte e due le frasi.
 */
export function folderFor(answer) {
  if (hasCyrillic(answer)) return foldCyrillic;
  return (text) => (hasCyrillic(text) ? toLatin(text) : foldLatin(text));
}
