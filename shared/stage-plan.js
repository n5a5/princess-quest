// shared/stage-plan.js — pure helpers for Star Stage (games/princess-quest/stage.js): which model clips exist,
// the backward-chaining order, the audition countdown, the practice log in the save, and the voice gate that
// decides from microphone levels when she started and stopped talking and how loud she was.
// No DOM, so all of it runs under node --test.

export const clipId = (blockId, i, j) => `${blockId}-${i}-${j}`;

// Every range of chunks that has a model clip: each chunk alone and each tail, chunk i to the end (backward
// chaining). A block that is only echoed, never chained (Try another line), has its chunks and the whole.
// Mirrors ranges() in tools/build-stage-audio.py.
export function clipRanges(n, chain = true) {
  const seen = new Set(), out = [];
  for (let i = 0; i < n; i++) for (const r of [[i, i + 1], chain ? [i, n] : [0, n]]) { const k = r.join(); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// The plan for one day, in order (Star Stage glows the first one not yet done today). Spaced practice: a little
// every day rather than a lot at once. Four or more days out: hear the real song (until she has heard it), the
// line, the song. The last three days add a mock audition. Audition day: only the short warm-up. After it: none.
// `canHear`: the cast recording is loaded on this device.
export function dailyPlan(today, auditionDate, { heard = false, canHear = false } = {}) {
  const d = daysUntil(today, auditionDate);
  if (d < 0) return [];
  if (d === 0) return ['dayof'];
  const plan = canHear && !heard ? ['hear'] : [];
  plan.push('line', 'song');
  if (d <= 3) plan.push('audition');
  return plan;
}

// How much picture help a piece gets, from how many times she has practised it (prompt fading):
// 0 = pictures all the way; 1 = she first tries it from memory with the pictures showing, and her solo has faded
// pictures; 2 = she first tries it from memory behind the curtain, and her solo is behind the curtain.
export function cueLevel(practices) { return practices >= 2 ? 2 : practices === 1 ? 1 : 0; }

// Backward chaining: the last chunk first, then the last two, and so on to the whole line, so every new
// piece leads into words she already knows and the end is the part she has said most.
export function chainSteps(n) { return Array.from({ length: n }, (_, k) => [n - 1 - k, n]); }

const dayNum = d => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
export function daysUntil(today, date) { return Math.round(dayNum(date) - dayNum(today)); }

// The map card's hint while the audition is coming; null once it has passed.
export function countdownHint(days, label) {
  if (!(days >= 0)) return null;
  return days === 0 ? label + ' today!' : days === 1 ? label + ' tomorrow!' : label + ' in ' + days + ' days';
}

// ---------- practice log (save.stage) ----------
// days: { 'YYYY-MM-DD': { line, song, watch, audition } } counts; solos: { line, song } finished practices;
// watched: times the clip played 45 s or more; auditions: full run-throughs; songCut: where the audition
// chorus sits in the loaded song recording, if a grown-up adjusted it ({ start, end } seconds) or null.
export const stageDefaults = () => ({ days: {}, watched: 0, auditions: 0, solos: {}, songCut: null });
const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function cleanStage(x) {
  const out = stageDefaults();
  if (!isObj(x)) return out;
  if (isObj(x.days)) for (const [d, row] of Object.entries(x.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !isObj(row)) continue;
    const r = {};
    for (const [k, v] of Object.entries(row)) if (count(v)) r[k] = count(v);
    out.days[d] = r;
  }
  out.watched = count(x.watched); out.auditions = count(x.auditions);
  if (isObj(x.solos)) for (const [k, v] of Object.entries(x.solos)) if (count(v)) out.solos[k] = count(v);
  const c = x.songCut;
  if (isObj(c) && Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start + 1) out.songCut = { start: c.start, end: c.end };
  return out;
}

export function logPractice(stage, day, kind) {
  const row = stage.days[day] || (stage.days[day] = {});
  row[kind] = (row[kind] || 0) + 1;
  return row;
}

// Two devices: every count keeps the larger of the two, so merging twice changes nothing.
export function mergeStage(a, b) {
  const x = cleanStage(a), y = cleanStage(b);
  for (const [d, row] of Object.entries(y.days)) {
    const mine = x.days[d] || (x.days[d] = {});
    for (const [k, v] of Object.entries(row)) mine[k] = Math.max(mine[k] || 0, v);
  }
  x.watched = Math.max(x.watched, y.watched); x.auditions = Math.max(x.auditions, y.auditions);
  for (const [k, v] of Object.entries(y.solos)) x.solos[k] = Math.max(x.solos[k] || 0, v);
  if (!x.songCut && y.songCut) x.songCut = y.songCut; // the recording lives per device; keep this device's cut
  return x;
}

// ---------- loudness ----------
export function rmsDb(samples) {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  return 10 * Math.log10(s / Math.max(1, samples.length) + 1e-12);
}

// A "big stage voice" is within 6 dB of her own warm-up shout (half its loudness), so it works with any
// microphone. A whispered warm-up cannot set the bar below -36 dB; with no warm-up the bar is -26 dB.
export function bigVoiceThreshold(refDb) { return refDb === null || refDb === undefined ? -26 : Math.max(refDb, -30) - 6; }

// Voice gate, fed one level reading (dB) every ~50 ms. Speech starts when the smoothed level rises 12 dB above
// the room (and above -50 dB); it ends after endSilenceMs below that, at maxMs, or after noVoiceMs with no
// voice at all. The first graceMs are ignored (the start chime). step() returns null while listening, then
// { reason: 'end' | 'max' | 'novoice', heard, peakDb, ms }.
// ignore(untilMs): skip readings until then (the "your turn" reminder chime played mid-take).
export function createVoiceGate({ floorDb = -60, endSilenceMs = 1200, maxMs = 12000, noVoiceMs = 7000, graceMs = 300 } = {}) {
  const startDb = Math.max(Math.min(floorDb, -40) + 12, -50);
  let smooth = null, heard = false, peakDb = -120, lastVoice = 0, done = null, ignoreUntil = 0;
  return {
    startDb,
    get heard() { return heard; },
    ignore(untilMs) { ignoreUntil = Math.max(ignoreUntil, untilMs); smooth = null; },
    step(db, t) {
      if (done) return done;
      // the chime: not fed to the smoothing at all, or its tail would count as her voice
      if (t < graceMs || t < ignoreUntil) return t >= maxMs ? (done = { reason: 'max', heard, peakDb: heard ? Math.round(peakDb * 10) / 10 : null, ms: t }) : null;
      const lin = Math.pow(10, db / 20);
      smooth = smooth === null ? lin : smooth * 0.6 + lin * 0.4;
      const s = 20 * Math.log10(smooth + 1e-12);
      if (s >= startDb) { heard = true; lastVoice = t; }
      if (heard) peakDb = Math.max(peakDb, s);
      const finish = reason => (done = { reason, heard, peakDb: heard ? Math.round(peakDb * 10) / 10 : null, ms: t });
      if (t >= maxMs) return finish('max');
      if (heard && t - lastVoice >= endSilenceMs) return finish('end');
      if (!heard && t >= noVoiceMs) return finish('novoice');
      return null;
    }
  };
}

// The room's quiet level from readings taken while nothing plays: the median, skipping the first two (an analyser
// that has not received samples yet reads silence) and anything at or below -100 dB (dead air while the
// microphone starts). The minimum used before made every room look silent, so a TV or a fan always counted as
// her voice. No usable reading: -60.
export function roomLevel(readings) {
  const ok = readings.slice(2).filter(db => Number.isFinite(db) && db > -100).sort((a, b) => a - b);
  return ok.length ? ok[Math.floor(ok.length / 2)] : -60;
}

// When each chunk starts inside a clip that says chunks i..j-1, so its picture can light up as Luna says it:
// offsets in ms, in proportion to each chunk's letters.
export function followTimes(texts, ms) {
  const w = texts.map(t => Math.max(1, String(t).replace(/[^a-z]/gi, '').length));
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map(x => { const at = Math.round(acc / total * ms); acc += x; return at; });
}

// The row of days up to the audition for the menu (she counts circles, she cannot read "in 5 days"): from the
// first day she practiced, or today, at most a week back. kind: 'done' (practiced), 'missed', 'today', 'future',
// 'audition'. Empty once the audition has passed.
export function dayStrip(today, auditionDate, practiced) {
  if (daysUntil(today, auditionDate) < 0) return [];
  const first = [...practiced].filter(d => d <= today).sort()[0] || today;
  const back = Math.min(7, Math.max(0, daysUntil(first, today)));
  const out = [];
  for (let k = -back; k <= daysUntil(today, auditionDate); k++) {
    const d = addDays(today, k);
    const kind = d === auditionDate ? 'audition' : practiced.has(d) ? 'done' : d === today ? 'today' : d < today ? 'missed' : 'future';
    out.push({ day: d, kind, today: d === today });
  }
  return out;
}
export function addDays(day, n) {
  const t = new Date(dayNum(day) * 86400000 + n * 86400000);
  return t.toISOString().slice(0, 10);
}
