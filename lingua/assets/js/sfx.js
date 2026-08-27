/*
 * sfx.js — i suoni brevi delle risposte.
 *
 * Generati con WebAudio, niente file da scaricare: due o tre note, mai più di
 * un quarto di secondo. Servono a chiudere il ciclo dell'azione — hai risposto,
 * il sistema ha capito — non a festeggiare: un riscontro immediato e non
 * ambiguo è l'unica parte di questa faccenda con basi solide.
 *
 * Si tacciono da soli quando il sistema chiede meno movimento
 * (prefers-reduced-motion) o quando li spegni dalle impostazioni.
 */

let ctx = null;

const NOTES = {
  ok: [[660, 0], [880, 0.07]],
  wrong: [[200, 0], [150, 0.09]],
  done: [[660, 0], [880, 0.08], [1180, 0.16]],
  goal: [[520, 0], [780, 0.09], [1040, 0.18], [1560, 0.27]],
};

export function play(kind, { enabled = true } = {}) {
  if (!enabled || !NOTES[kind]) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ctx = ctx || new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    for (const [freq, delay] of NOTES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'wrong' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'wrong' ? 0.07 : 0.11, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    /* audio bloccato finché non c'è un tocco: pazienza */
  }
}
