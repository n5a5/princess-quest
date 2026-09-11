// shared/sfx.js — tiny synthesized game sounds (no assets, no network). Web Audio oscillators:
//   tap      soft pop when a tile or choice is pressed
//   sparkle  rising shimmer when a word blends or an answer is right
//   yay      three-note chime for a finished round
// Respects settings.muted. Silently does nothing where AudioContext is missing or locked.
export function createSfx({ settings }) {
  let ctx = null;
  const context = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; } catch { return null; } };
  function tone(freq, { at = 0, dur = 0.18, type = 'sine', gain = 0.12, slide = null } = {}) {
    const c = context(); if (!c || settings.muted) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  return {
    unlock() { context(); },
    tap() { tone(520, { dur: 0.08, type: 'triangle', gain: 0.08, slide: 380 }); },
    sparkle() { [880, 1175, 1568, 2093].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.22, gain: 0.07 })); },
    yay() { [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.14, dur: 0.3, type: 'triangle', gain: 0.1 })); tone(1047, { at: 0.42, dur: 0.5, gain: 0.08 }); }
  };
}
