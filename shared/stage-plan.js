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

// How many of a piece's pictures are hidden, counted from the end, after `practices` finished practices: one more
// each time, so the last chunk is the first she says from memory and the pictures go before the mock auditions.
// Script fading from the end backwards (Krantz & McClannahan 1993, JABA 26:121; review: Topuz & Ülke
// Kürkçüoğlu 2022, Rev J Autism Dev Disord 9:366) and fading pictures rather than keeping them (Corey & Shamow
// 1972, JABA 5:311, children 4-5).
export function hiddenFromEnd(practices, n) { return Math.max(0, Math.min(n, practices)); }

// Backward chaining: the last chunk first, then the last two, and so on to the whole line, so every attempt ends
// on words she already knows. Only a light scaffold for the first two practices: in children the evidence does
// not favour it over forward or whole-task practice (Slocum & Tiger 2011, JABA 44:793; no consistent winner), and
// it leaves the start of a sequence weakest (Smith 1999, Percept Mot Skills 89:951), so every session also has
// whole runs from the first word.
export function chainSteps(n) { return Array.from({ length: n }, (_, k) => [n - 1 - k, n]); }

const dayNum = d => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
export function daysUntil(today, date) { return Math.round(dayNum(date) - dayNum(today)); }

// The map card's hint while the audition is coming; null once it has passed.
export function countdownHint(days, label) {
  if (!(days >= 0)) return null;
  return days === 0 ? label + ' today!' : days === 1 ? label + ' tomorrow!' : label + ' in ' + days + ' days';
}

// What Luna says on the map in the last week before the audition, so the place to go is spoken, not only written on
// its card. Whole sentences, so each one has a story-voice clip (tools/collect-lines.py). null outside that week.
const COUNTDOWN_SAY = ['Your Annie audition is today! Tap Star Stage.', 'Your Annie audition is tomorrow! Tap Star Stage.',
  'Your Annie audition is in two days! Tap Star Stage.', 'Your Annie audition is in three days! Tap Star Stage.',
  'Your Annie audition is in four days! Tap Star Stage.', 'Your Annie audition is in five days! Tap Star Stage.',
  'Your Annie audition is in six days! Tap Star Stage.', 'Your Annie audition is in seven days! Tap Star Stage.'];
export const countdownSay = days => (Number.isInteger(days) && days >= 0 && COUNTDOWN_SAY[days]) || null;

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
// the room (at least -50 dB, at most -12 dB) and at least minVoiced raw readings in that stretch are above it too,
// so a tap or a thud near the microphone (one loud reading that the smoothing drags out) is not her voice. A knock
// is forgotten when it stops, so the take keeps listening for her: a first sound that is loudest at its very first
// reading and then only decays (an impact and its room echo; a voice rises before it falls), or a take with fewer
// than minTotal raw readings above the start level in all (200 ms; a soft "Thank you!" is about that). It ends
// after endSilenceMs below the start level, at maxMs, or after noVoiceMs with no voice at all. The first graceMs
// are ignored (the start chime). A voice rises and falls with every syllable and the gaps between words; a steady
// sound (a fan, a hum, a TV's music bed) above the start level does not. So every smoothed reading from her first
// word on is kept, gaps included, and a take whose readings vary by less than 4 dB (10th to 90th percentile) counts
// as not heard. (Measuring only the readings above the start level cut a soft voice's range off at that level, so
// a quiet but clear voice was called steady.) step() returns null while listening, then
// { reason: 'end' | 'max' | 'novoice' | 'steady', heard, peakDb, maxDb, ms }; maxDb is the loudest smoothed reading
// (null if none), so a caller can tell a quiet voice (some sound) from a dead microphone (nothing at all).
// ignore(untilMs): skip readings until then (the "your turn" reminder chime played mid-take).
export function createVoiceGate({ floorDb = -60, endSilenceMs = 1200, maxMs = 12000, noVoiceMs = 7000, graceMs = 300, minVoiced = 3, minTotal = 4 } = {}) {
  const startDb = Math.min(Math.max(floorDb + 12, -50), -12);
  let smooth = null, heard = false, peakDb = -120, maxDb = -120, lastVoice = 0, done = null, ignoreUntil = 0;
  let voiced = 0, runPeak = -120, loudN = 0, total = 0; // this stretch: raw readings above the start level, its peak; all of them
  let since = []; // every smoothed level from her first word on
  let loudRaw = [], inOnset = false; // raw readings above the start level since the room was last quiet (the rise before the smoothed level crosses included); the stretch that started her
  // an impact: loudest within its first two readings (the analyser's window can catch the start of it half), then
  // only falling, and steeply (room echo, about 7 dB per reading; a voice sustains, then fades more slowly)
  const impact = a => {
    let i = 0;
    a.forEach((x, k) => { if (x > a[i]) i = k; });
    const m = Math.min(3, a.length - 1 - i); // the fall over (up to) three readings after the peak
    if (i > 1 || m < 2) return false;
    for (let k = i + 1; k < a.length; k++) if (a[k] >= a[k - 1]) return false;
    return (a[i] - a[i + m]) / m >= 5;
  };
  const forget = () => { heard = false; peakDb = -120; loudN = 0; total = 0; since = []; };
  const varies = () => { if (since.length < 8) return true; const s = [...since].sort((a, b) => a - b); return s[Math.floor(s.length * 0.9)] - s[Math.floor(s.length * 0.1)] >= 4; };
  const round = v => Math.round(v * 10) / 10;
  return {
    startDb,
    get heard() { return heard; },
    ignore(untilMs) { ignoreUntil = Math.max(ignoreUntil, untilMs); smooth = null; },
    step(db, t) {
      if (done) return done;
      const finish = reason => { const v = heard && varies(); return (done = { reason: heard && !v ? 'steady' : reason, heard: v, peakDb: v ? round(peakDb) : null, maxDb: maxDb > -120 ? round(maxDb) : null, ms: t }); };
      // the chime: not fed to the smoothing at all, or its tail would count as her voice
      if (t < graceMs || t < ignoreUntil) return t >= maxMs ? finish('max') : null;
      const lin = Math.pow(10, db / 20);
      smooth = smooth === null ? lin : smooth * 0.6 + lin * 0.4;
      const s = 20 * Math.log10(smooth + 1e-12);
      maxDb = Math.max(maxDb, s);
      if (db >= startDb) loudRaw.push(db);
      if (s >= startDb) {
        if (db >= startDb) { voiced++; total++; }
        runPeak = Math.max(runPeak, s);
        if (voiced >= minVoiced) { if (!heard) inOnset = true; heard = true; peakDb = Math.max(peakDb, runPeak); } // a bump never sets the peak
        if (heard) { lastVoice = t; loudN++; } // once she has started, every soft syllable keeps the take open
      } else {
        if (inOnset && impact(loudRaw)) forget(); // a knock and its echo started this: not her
        inOnset = false; voiced = 0; runPeak = -120;
        if (db < startDb) loudRaw = [];
        if (!heard) total = 0; // only stretches from her first word on count
      }
      if (heard) since.push(s);
      if (t >= maxMs) return finish('max');
      if (loudN >= 50 && !varies()) return finish('steady'); // 2.5 s of a steady sound: not her voice
      if (heard && t - lastVoice >= endSilenceMs) {
        if (total >= minTotal) return finish('end');
        forget(); // too short to be her: keep listening
      }
      if (!heard && t >= noVoiceMs) return finish('novoice');
      return null;
    }
  };
}

// The room's quiet level from readings taken while nothing plays: the median, skipping the first two (an analyser
// that has not received samples yet reads silence) and anything at or below -100 dB (dead air while the
// microphone starts). The minimum used before made every room look silent, so a TV or a fan always counted as
// her voice. No usable reading: -60.
export function roomLevel(readings, fallback = -60) {
  const ok = readings.slice(2).filter(db => Number.isFinite(db) && db > -100).sort((a, b) => a - b);
  return ok.length ? ok[Math.floor(ok.length / 2)] : fallback;
}

// The room level a turn's voice gate starts from: the lower median of the last five room readings (one at the
// start of each activity, one just before each turn), so one loud moment (her "yay!" as she taps, a door) never
// makes her inaudible, and a room that stays loud is followed after a couple of readings. Once her warm-up shout
// is known (refDb), the start level stays at least 6 dB under it (floor + 12 <= refDb - 6). No readings: -60.
export function quietFloor(readings, refDb = null) {
  const s = readings.filter(Number.isFinite).slice(-5).sort((a, b) => a - b);
  const f = s.length ? s[Math.floor((s.length - 1) / 2)] : -60;
  return refDb === null || refDb === undefined ? f : Math.min(f, refDb - 18);
}

// The room's level as heard during a take: the 10th percentile of its usable readings (the quiet before she starts,
// between phrases and after she stops), or null with fewer than 10 of them. Each take adds one to the room readings,
// so a bad reading (her "yay!" while the room was read, or a microphone that delivered nothing while it warmed up)
// is outvoted by the next try instead of lasting the whole visit.
export function quietLevel(readings) {
  const ok = readings.filter(db => Number.isFinite(db) && db > -100).sort((a, b) => a - b);
  return ok.length >= 10 ? ok[Math.floor(ok.length * 0.1)] : null;
}

// A take in which the microphone delivered digital silence (a muted, blocked or dead input): a working microphone
// always picks up some room noise, far above -90 dB, even when she says nothing.
export const deadMic = res => !!res && !res.heard && (res.maxDb === null || res.maxDb === undefined || res.maxDb < -90);

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
