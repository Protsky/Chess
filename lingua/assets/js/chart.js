/*
 * chart.js — grafici in SVG, senza librerie.
 *
 * Servono a rendere visibile il modello, non a decorare le statistiche: la
 * curva dell'oblio è la formula che decide i tuoi intervalli, la calibrazione
 * è il controllo che quella formula non stia mentendo, il prezzo della
 * ritenzione è la scelta che hai in mano.
 *
 * I colori non sono scelti a occhio. La serie categorica e la rampa
 * sequenziale passano i controlli calcolabili sul fondo scuro dell'app:
 * banda di luminosità, soglia di croma, separazione sotto daltonismo
 * (protanopia e deuteranopia, ΔE ≥ 8 in OKLab) e contrasto contro la
 * superficie. L'identità non è mai affidata al solo colore: ogni serie ha la
 * sua etichetta, e ogni segno il suo valore leggibile toccandolo.
 */

/** Ordine fisso delle serie: non si cicla e non si riassegna al variare dei dati. */
export const SERIES = ['#4a93e0', '#cf7a26', '#279c78', '#ab63d0'];

/** Rampa di grandezza: una sola tinta, dal poco al molto. */
export const RAMP = ['#1d6b50', '#26805f', '#38ac86', '#6fd8ae', '#a5f0d3'];

const LINE = '#2a3444';
const INK = '#93a1b8';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const round = (n) => Math.round(n * 100) / 100;

const svg = (w, h, body, label) => `
  <svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet">
    ${body}
  </svg>`;

/** Il valore di una tacca sull'asse, arrotondato a qualcosa di leggibile. */
function niceMax(max) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= pow * step) return pow * step;
  }
  return pow * 10;
}

/* ------------------------------- barre --------------------------------- */

/**
 * Barre impilate, fondo appoggiato alla linea di base.
 * rows: [{ label, values: [n, ...], readout }]
 */
export function bars({ rows, names, height = 132, everyLabel = 0, unit = '' }) {
  const W = 320;
  const padL = 26;
  const padB = 16;
  const padT = 8;
  const max = niceMax(Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + b, 0))));
  const plotH = height - padB - padT;
  const step = (W - padL) / rows.length;
  const bw = Math.max(2, Math.min(18, step - 3));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const gap = rows.length > 40 ? 0 : 2;   // 2px di superficie fra i segmenti
  const skip = everyLabel || Math.ceil(rows.length / 7);

  const grid = [0, 0.5, 1].map((f) => `
    <line x1="${padL}" y1="${round(padT + plotH * (1 - f))}" x2="${W}" y2="${round(padT + plotH * (1 - f))}"
      stroke="${LINE}" stroke-width="1"/>
    <text x="0" y="${round(padT + plotH * (1 - f) + 3)}" fill="${INK}" font-size="8">${round(max * f)}</text>`).join('');

  const marks = rows.map((r, i) => {
    const x = padL + i * step + (step - bw) / 2;
    let base = padT + plotH;
    const segs = r.values.map((v, s) => {
      if (!v) return '';
      const h = (v / max) * plotH;
      const top = base - h;
      const rect = `<rect x="${round(x)}" y="${round(top)}" width="${round(bw)}" height="${round(Math.max(1, h - (s ? gap : 0)))}"
        rx="${Math.min(4, bw / 2)}" fill="${SERIES[s]}"/>`;
      base = top - (s ? gap : 0);
      return rect;
    }).join('');
    const label = i % skip === 0
      ? `<text x="${round(x + bw / 2)}" y="${height - 4}" fill="${INK}" font-size="8" text-anchor="middle">${esc(r.label)}</text>`
      : '';
    const total = r.values.reduce((a, b) => a + b, 0);
    return `<g data-readout="${esc(r.readout || `${r.label}: ${total}${unit}`)}">
      <rect x="${round(padL + i * step)}" y="${padT}" width="${round(step)}" height="${round(plotH)}" fill="transparent"/>
      ${segs}${label}</g>`;
  }).join('');

  const summary = `${names.join(' e ')}: ${rows.length} colonne, massimo ${max}${unit}`;
  return svg(W, height, `${grid}${marks}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W}" y2="${padT + plotH}" stroke="${LINE}" stroke-width="1"/>`, summary);
}

/* -------------------------------- linea -------------------------------- */

/**
 * Una linea sola, con area sotto e qualche punto etichettato.
 * points: [{ x, y, label?, readout? }] già in unità dei dati.
 */
export function line({ points, height = 140, xLabels = [], yFormat = (v) => v, area = true, marks = [], hline = null }) {
  const W = 320;
  const padL = 30;
  const padB = 18;
  const padT = 10;
  const plotH = height - padB - padT;
  const plotW = W - padL - 6;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs) || 1;
  const yMax = niceMax(Math.max(...ys));
  const yMin = Math.min(0, ...ys);
  const px = (x) => padL + ((x - x0) / (x1 - x0 || 1)) * plotW;
  const py = (y) => padT + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${round(px(p.x))} ${round(py(p.y))}`).join(' ');
  const fill = area
    ? `<path d="${path} L${round(px(x1))} ${round(py(yMin))} L${round(px(x0))} ${round(py(yMin))} Z" fill="${SERIES[0]}" opacity="0.14"/>`
    : '';

  const grid = [0, 0.5, 1].map((f) => `
    <line x1="${padL}" y1="${round(padT + plotH * (1 - f))}" x2="${W - 6}" y2="${round(padT + plotH * (1 - f))}"
      stroke="${LINE}" stroke-width="1"/>
    <text x="0" y="${round(padT + plotH * (1 - f) + 3)}" fill="${INK}" font-size="8">${esc(yFormat(yMin + (yMax - yMin) * f))}</text>`).join('');

  const ticks = xLabels.map((t) => `
    <text x="${round(px(t.x))}" y="${height - 4}" fill="${INK}" font-size="8" text-anchor="middle">${esc(t.label)}</text>`).join('');

  // punti notevoli: pochi, etichettati, mai uno per ogni valore
  const dots = marks.map((m) => `
    <g data-readout="${esc(m.readout || m.label)}">
      <circle cx="${round(px(m.x))}" cy="${round(py(m.y))}" r="4.5" fill="${m.color || SERIES[1]}" stroke="#171f2b" stroke-width="2"/>
      ${m.label ? `<text x="${round(px(m.x))}" y="${round(py(m.y)) - 9}" fill="${INK}" font-size="8" text-anchor="middle">${esc(m.label)}</text>` : ''}
    </g>`).join('');

  const threshold = hline ? `
    <line x1="${padL}" y1="${round(py(hline.y))}" x2="${W - 6}" y2="${round(py(hline.y))}"
      stroke="${SERIES[1]}" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${W - 8}" y="${round(py(hline.y)) - 4}" fill="${INK}" font-size="8" text-anchor="end">${esc(hline.label)}</text>` : '';

  return svg(W, height, `${grid}${fill}${threshold}
    <path d="${path}" fill="none" stroke="${SERIES[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${ticks}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - 6}" y2="${padT + plotH}" stroke="${LINE}" stroke-width="1"/>`,
  `linea da ${round(Math.min(...ys))} a ${round(Math.max(...ys))}`);
}

/* ----------------------------- calibrazione ----------------------------- */

/**
 * Previsto contro accaduto. La diagonale è il modello perfetto: più i punti
 * ci stanno sopra, più le previsioni sono oneste. La grandezza del punto dice
 * quanti ripassi ci sono dentro, così una fascia con tre casi non pesa come
 * una con trecento.
 */
export function calibration({ bins, height = 250 }) {
  const W = 264;
  const pad = 34;
  const plot = W - pad - 10;
  const maxN = Math.max(1, ...bins.map((b) => b.n));
  const px = (v) => pad + v * plot;
  const py = (v) => height - pad - v * (height - pad - 10);

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `
    <line x1="${round(px(f))}" y1="${round(py(0))}" x2="${round(px(f))}" y2="${round(py(1))}" stroke="${LINE}" stroke-width="1" opacity="0.5"/>
    <line x1="${round(px(0))}" y1="${round(py(f))}" x2="${round(px(1))}" y2="${round(py(f))}" stroke="${LINE}" stroke-width="1" opacity="0.5"/>`).join('');

  const ticks = [0, 0.5, 1].map((f) => `
    <text x="${round(px(f))}" y="${round(py(0)) + 11}" fill="${INK}" font-size="8"
      text-anchor="${f === 1 ? 'end' : f === 0 ? 'start' : 'middle'}">${f * 100}%</text>
    <text x="${round(px(0)) - 4}" y="${round(py(f)) + 3}" fill="${INK}" font-size="8" text-anchor="end">${f * 100}%</text>`).join('');

  const dots = bins.map((b) => {
    const r = 3 + 6 * Math.sqrt(b.n / maxN);
    return `<g data-readout="Previsto ${Math.round(b.predicted * 100)}%, accaduto ${Math.round(b.observed * 100)}% su ${b.n} ripassi">
      <circle cx="${round(px(b.predicted))}" cy="${round(py(b.observed))}" r="${round(r)}"
        fill="${SERIES[0]}" stroke="#171f2b" stroke-width="2"/></g>`;
  }).join('');

  return svg(W, height, `${grid}
    <line x1="${round(px(0))}" y1="${round(py(0))}" x2="${round(px(1))}" y2="${round(py(1))}"
      stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${round(px(0.97))}" y="${round(py(0.62))}" fill="${INK}" font-size="8" text-anchor="end">modello onesto</text>
    ${ticks}${dots}
    <text x="${round(px(0.5))}" y="${height - 4}" fill="${INK}" font-size="9" text-anchor="middle">previsto</text>
    <text x="10" y="${round(py(0.5))}" fill="${INK}" font-size="9" text-anchor="middle" transform="rotate(-90 10 ${round(py(0.5))})">accaduto</text>`,
  `calibrazione su ${bins.length} fasce`);
}

/* ------------------------------ calendario ------------------------------ */

/** Griglia dei giorni, una colonna per settimana: quanto e quando hai studiato. */
export function heatmap({ days, weeks = 16 }) {
  const cell = 12;
  const gap = 3;
  const padT = 12;
  const W = weeks * (cell + gap);
  const H = padT + 7 * (cell + gap);
  const max = Math.max(1, ...days.map((d) => d.value));
  const shade = (v) => (v <= 0 ? '#1e2735' : RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * RAMP.length))]);

  const cells = days.map((d, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    return `<rect x="${col * (cell + gap)}" y="${padT + row * (cell + gap)}" width="${cell}" height="${cell}" rx="3"
      fill="${shade(d.value)}" data-readout="${esc(d.label)}: ${d.value === 0 ? 'niente' : `${d.value} ripassi`}"/>`;
  }).join('');

  const months = days.reduce((acc, d, i) => {
    if (i % 7 !== 0) return acc;
    const month = d.key.slice(5, 7);
    if (acc.last === month) return acc;
    acc.last = month;
    acc.out.push(`<text x="${Math.floor(i / 7) * (cell + gap)}" y="7" fill="${INK}" font-size="8">${d.month}</text>`);
    return acc;
  }, { out: [], last: null }).out.join('');

  return svg(W, H, `${months}${cells}`, `calendario di ${weeks} settimane`);
}

/**
 * Anello dell'obiettivo del giorno: un valore solo, quindi nessuna serie da
 * distinguere e nessuna legenda da mettere. Il numero grande al centro è il
 * dato; l'anello è il contesto.
 */
export function ring({ value, total, big, small, done = false, extra = 0, size = 128 }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, total ? value / total : 0));
  const stroke = done ? '#59d3b0' : '#2f7d69';
  return `
    <svg class="ring" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(`${value} su ${total}`)}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#1e2735" stroke-width="9"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${stroke}" stroke-width="9"
        stroke-linecap="round" stroke-dasharray="${round(c * p)} ${round(c)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
      ${extra > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r - 8}" fill="none" stroke="#a5f0d3" stroke-width="3"
        stroke-linecap="round" stroke-dasharray="${round(2 * Math.PI * (r - 8) * Math.min(1, extra))} ${round(2 * Math.PI * (r - 8))}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}
      <text x="${size / 2}" y="${size / 2 + 2}" fill="#e8edf6" font-size="26" font-weight="700" text-anchor="middle">${esc(big)}</text>
      <text x="${size / 2}" y="${size / 2 + 20}" fill="${INK}" font-size="10" text-anchor="middle">${esc(small)}</text>
    </svg>`;
}

/** Legenda: l'identità non sta mai nel solo colore. */
export const legend = (names) => `
  <div class="legend">
    ${names.map((n, i) => `<span><i class="swatch" style="background:${SERIES[i]}"></i>${esc(n)}</span>`).join('')}
  </div>`;
