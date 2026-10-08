// tests/stage.test.js — Star Stage: every model clip the place can ask for exists, backward chaining order,
// countdown, the practice log in the save (clean, merge), and the voice gate on synthetic level streams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJSON } from './helpers.js';
import { clipId, clipRanges, chainSteps, daysUntil, countdownHint, cleanStage, logPractice, mergeStage, stageDefaults, rmsDb, bigVoiceThreshold, createVoiceGate, roomLevel, followTimes, dayStrip, addDays, dailyPlan, hiddenFromEnd } from '../shared/stage-plan.js';
import { REGISTRY } from '../games/registry.js';
import { migrate, defaultSave } from '../shared/economy.js';

const stage = readJSON('content/stage.json');
const blocks = [stage.warmup, stage.slate, ...stage.pieces, ...stage.others];

test('every clip the place can play is bundled, and nothing else', () => {
  const want = new Set();
  for (const b of blocks) for (const [i, j] of clipRanges(b.chunks.length, b.chain !== false)) want.add(clipId(b.id, i, j) + '.ogg');
  const have = new Set(readdirSync(join(ROOT, 'assets/audio/stage')));
  assert.deepEqual([...want].filter(f => !have.has(f)), [], 'missing clips (run tools/build-stage-audio.py)');
  assert.deepEqual([...have].filter(f => !want.has(f)), [], 'stale clips');
  const dur = readJSON('content/stage-audio.json');
  for (const f of want) assert.ok(dur[f.replace('.ogg', '')] > 300, 'duration of ' + f);
});

test('content: pieces, pictures, dates', () => {
  assert.deepEqual(stage.pieces.map(p => p.id).sort(), ['line', 'song']);
  for (const b of blocks) for (const c of b.chunks) { assert.ok(c.text.trim(), b.id); assert.ok(c.pic, b.id + ' picture'); }
  for (const p of stage.pieces) { assert.ok(p.intro && p.tip && p.maxMs >= 8000, p.id); }
  assert.match(stage.auditionDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(stage.videos, undefined, 'no YouTube: it could lead out of the app');
  for (const p of stage.pieces) assert.ok(p.act, p.id + ' acting cue');
  assert.equal(stage.others.length, 7, 'the other seven lines on the audition sheet');
  for (const o of stage.others) { assert.ok(o.role && o.pic && o.intro && o.tip && o.act && o.chain === false, o.id); assert.ok(o.chunks.length >= 4 && o.chunks.every(c => c.text && c.pic), o.id); }
  assert.ok(!JSON.stringify(stage).includes('Mr.') || stage.others.every(o => o.chunks.every(c => !c.text.includes('Mr.') || c.say)), 'Mr. is read as a sentence end: give it a say');
  const reg = REGISTRY.find(r => r.id === 'stage');
  assert.ok(reg && existsSync(join(ROOT, reg.entry.replace('./', ''))));
  assert.equal(reg.spotlight.until, stage.auditionDate, 'map countdown and the place use the same date');
});

test('clip ranges: singles and tails, no duplicates', () => {
  assert.deepEqual(clipRanges(4), [[0, 1], [0, 4], [1, 2], [1, 4], [2, 3], [2, 4], [3, 4]]);
  assert.deepEqual(clipRanges(1), [[0, 1]]);
});

test('backward chaining: last chunk first, ends with the whole thing', () => {
  assert.deepEqual(chainSteps(4), [[3, 4], [2, 4], [1, 4], [0, 4]]);
  for (const [i, j] of chainSteps(4)) assert.ok(clipRanges(4).some(r => r[0] === i && r[1] === j));
});

test('countdown', () => {
  assert.equal(daysUntil('2026-10-08', '2026-10-14'), 6);
  assert.equal(daysUntil('2026-10-31', '2026-11-01'), 1); // across a month (and the DST change on Nov 1)
  assert.equal(countdownHint(6, 'Annie audition'), 'Annie audition in 6 days');
  assert.equal(countdownHint(1, 'Annie audition'), 'Annie audition tomorrow!');
  assert.equal(countdownHint(0, 'Annie audition'), 'Annie audition today!');
  assert.equal(countdownHint(-1, 'Annie audition'), null);
});

test('practice log: survives the save migration, junk is dropped, merging is idempotent', () => {
  const s = defaultSave();
  logPractice(s.stage, '2026-10-09', 'line'); logPractice(s.stage, '2026-10-09', 'line'); s.stage.solos.line = 2; s.stage.auditions = 1;
  const back = migrate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.stage, s.stage);
  assert.deepEqual(cleanStage({ days: { bad: {}, '2026-10-09': { line: -1, song: 'x', watch: 2 } }, watched: 'many', solos: [] }), { ...stageDefaults(), days: { '2026-10-09': { watch: 2 } } });
  assert.deepEqual(migrate({ ...s, stage: 'nope' }).stage, stageDefaults());
  const other = { days: { '2026-10-09': { line: 1, song: 1 }, '2026-10-10': { audition: 1 } }, watched: 3, auditions: 0, solos: { song: 1 } };
  const m1 = mergeStage(s.stage, other);
  assert.deepEqual(m1.days, { '2026-10-09': { line: 2, song: 1 }, '2026-10-10': { audition: 1 } });
  assert.equal(m1.watched, 3); assert.equal(m1.auditions, 1); assert.deepEqual(m1.solos, { line: 2, song: 1 });
  assert.deepEqual(mergeStage(m1, other), m1);
});

const run = (gate, levels, stepMs = 50) => { for (let k = 0; k < levels.length; k++) { const r = gate.step(levels[k], k * stepMs); if (r) return r; } return null; };
const flat = (db, ms) => Array(Math.round(ms / 50)).fill(db);

test('voice gate: hears speech, waits for her to stop, reports the peak', () => {
  const g = createVoiceGate({ floorDb: -65, endSilenceMs: 1200, maxMs: 12000, noVoiceMs: 7000 });
  const r = run(g, [...flat(-65, 600), ...flat(-25, 1500), ...flat(-65, 400), ...flat(-30, 500), ...flat(-65, 3000)]);
  assert.equal(r.reason, 'end');
  assert.equal(r.heard, true);
  assert.ok(r.peakDb > -27 && r.peakDb <= -25, String(r.peakDb));
  assert.ok(r.ms >= 600 + 1500 + 400 + 500 + 1200 && r.ms < 600 + 1500 + 400 + 500 + 1500, 'a short pause does not end the take');
});

test('voice gate: silence ends at noVoiceMs, a chime in the grace period is ignored, maxMs caps a take', () => {
  const quiet = run(createVoiceGate({ floorDb: -60, noVoiceMs: 7000 }), [-20, -20, -20, -20, ...flat(-62, 8000)]);
  assert.deepEqual([quiet.reason, quiet.heard, quiet.peakDb], ['novoice', false, null]);
  const syll = ms => Array.from({ length: Math.round(ms / 50) }, (_, k) => -22 - 12 * Math.abs(Math.sin(k / 2.4))); // a voice: up and down every syllable
  const long = run(createVoiceGate({ floorDb: -60, maxMs: 3000 }), syll(5000));
  assert.equal(long.reason, 'max');
  assert.equal(long.heard, true);
  // a noisy room raises the start level; room noise alone is not her voice
  const noisy = createVoiceGate({ floorDb: -38 });
  assert.equal(noisy.startDb, -26);
  assert.equal(run(noisy, flat(-36, 8000)).reason, 'novoice');
  // a loud TV or fan (red team: -25 dB counted as her voice): the room level is no longer capped at -40
  assert.equal(createVoiceGate({ floorDb: -25 }).startDb, -13);
  assert.equal(createVoiceGate({ floorDb: -5 }).startDb, -12, 'never above -12 dB');
});

test('big voice: relative to her warm-up, with sane limits', () => {
  assert.equal(bigVoiceThreshold(null), -26);
  assert.equal(bigVoiceThreshold(-12), -18);
  assert.equal(bigVoiceThreshold(-45), -36); // a whispered warm-up cannot make everything "big"
  assert.ok(Math.abs(rmsDb(new Float32Array(1000).fill(0.1)) - -20) < 0.01);
});

// Star Stage speaks in the story voice whatever the setting (audio.say { story: true }), which only works when
// every sentence it says has a rendered clip; otherwise the whole line falls back to the device voice.
test('every Star Stage sentence has a story-voice clip', async () => {
  const { readFileSync } = await import('node:fs');
  const { splitSentences, keyOf } = await import('../shared/audio.js');
  const have = readJSON('content/lines-audio.json').lines;
  const src = readFileSync(join(ROOT, 'games/princess-quest/stage.js'), 'utf8');
  const unq = s => s.replace(/\\'/g, "'");
  // every sentence-like string literal not glued to another with + (ternaries included)
  const said = [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].filter(m => /^[A-Z][a-z]/.test(m[1]) && (/[.!?]$/.test(m[1]) || m[1].split(' ').length >= 4)
    && src.slice(m.index + m[0].length).trimStart()[0] !== '+' && src.slice(0, m.index).trimEnd().slice(-1) !== '+').map(m => unq(m[1]));
  said.push(...[...src.match(/const HINT = \{([\s\S]*?)\};/)[1].matchAll(/: '((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])));
  said.push(...[...src.matchAll(/cannot\('((?:[^'\\]|\\.)*)'\)/g)].map(m => unq(m[1])));
  for (const list of ['BIG', 'MORE']) said.push(...[...src.match(new RegExp('const ' + list + ' = \\[(.*)\\];'))[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])));
  said.push(...[...src.matchAll(/(?:intro|line): '((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])), 'You did it!');
  for (const p of stage.pieces) said.push(p.intro, p.tip);
  const missing = said.filter(t => /^[A-Za-z]/.test(t)).flatMap(t => splitSentences(t)).filter(sn => !have[keyOf(sn)]);
  assert.ok(said.length >= 25, String(said.length));
  assert.deepEqual([...new Set(missing)], [], 'run tools/collect-lines.py and tools/build-lines-audio.py');
});

test('room level: median of real readings, not the silent first ones', () => {
  assert.equal(roomLevel([-120, -120, -45, -44, -46, -130, -43]), -44);
  assert.equal(roomLevel([-120, -120, -120]), -60);
  assert.equal(roomLevel([]), -60);
  // a TV at -40 dB now raises the start level, so the TV alone is not her voice
  assert.equal(createVoiceGate({ floorDb: roomLevel([-120, -120, -40, -41, -40, -39]) }).startDb, -28);
});

test('follow-along: each picture lights in proportion to its words', () => {
  assert.deepEqual(followTimes(['abcd', 'abcd'], 1000), [0, 500]);
  assert.deepEqual(followTimes(['Yes, Miss Hannigan.'], 1300), [0]);
  const chunks = stage.pieces[0].chunks.map(c => c.text);
  const t = followTimes(chunks, 5327);
  assert.equal(t.length, chunks.length); assert.equal(t[0], 0); assert.ok(t.every((x, k) => k === 0 || x > t[k - 1]) && t[t.length - 1] < 5327);
});

test('day strip: a circle per day to the audition, stars on practice days', () => {
  const kinds = s => s.map(d => d.kind).join(' ');
  assert.equal(kinds(dayStrip('2026-10-09', '2026-10-14', new Set(['2026-10-08']))), 'done today future future future future audition');
  assert.equal(kinds(dayStrip('2026-10-09', '2026-10-14', new Set(['2026-10-07', '2026-10-09']))), 'done missed done future future future future audition');
  assert.equal(dayStrip('2026-10-09', '2026-10-14', new Set()).filter(d => d.today).length, 1);
  assert.equal(kinds(dayStrip('2026-10-14', '2026-10-14', new Set())), 'audition');
  assert.deepEqual(dayStrip('2026-10-15', '2026-10-14', new Set()), []);
  assert.ok(dayStrip('2026-10-13', '2026-10-14', new Set(['2026-09-01'])).length <= 9, 'at most a week back');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('song cut: kept when sane, dropped when not; content default is inside the clip', () => {
  assert.deepEqual(cleanStage({ songCut: { start: 10.8, end: 27 } }).songCut, { start: 10.8, end: 27 });
  assert.equal(cleanStage({ songCut: { start: 10, end: 10.5 } }).songCut, null);
  assert.equal(cleanStage({ songCut: 'x' }).songCut, null);
  assert.deepEqual(mergeStage({ songCut: null }, { songCut: { start: 1, end: 9 } }).songCut, { start: 1, end: 9 });
  const c = stage.songCut;
  assert.ok(c.start >= 0 && c.end > c.start + 5 && c.end < c.duration, 'chorus inside the recording');
});

test('daily plan: hear first, then line and song, mock auditions in the last three days, warm-up on the day', () => {
  const A = '2026-10-14';
  assert.deepEqual(dailyPlan('2026-10-08', A, { canHear: true }), ['hear', 'line', 'song']);
  assert.deepEqual(dailyPlan('2026-10-08', A, { canHear: true, heard: true }), ['line', 'song']);
  assert.deepEqual(dailyPlan('2026-10-08', A, { canHear: false }), ['line', 'song'], 'no recording loaded: nothing she cannot do');
  assert.deepEqual(dailyPlan('2026-10-10', A, { heard: true, canHear: true }), ['line', 'song']);
  assert.deepEqual(dailyPlan('2026-10-11', A, { heard: true, canHear: true }), ['line', 'song', 'audition']);
  assert.deepEqual(dailyPlan('2026-10-13', A, { heard: true, canHear: true }), ['line', 'song', 'audition']);
  assert.deepEqual(dailyPlan(A, A, { canHear: true }), ['dayof']);
  assert.deepEqual(dailyPlan('2026-10-15', A, {}), []);
});

test('cue fading: one more picture hidden from the end each practice, then all of them', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(k => hiddenFromEnd(k, 3)), [0, 1, 2, 3, 3]);
  assert.deepEqual([0, 1, 4, 5].map(k => hiddenFromEnd(k, 4)), [0, 1, 4, 4]);
  assert.equal(stage.pieces.find(x => x.id === 'line').chunks.length, 3, 'the line in three clauses');
});

test('voice gate: the reminder chime mid-take is not taken for her voice', () => {
  const g = createVoiceGate({ floorDb: -65, noVoiceMs: 7000, endSilenceMs: 1200 });
  let r = null, t = 0;
  for (; t < 3000; t += 50) r = g.step(-64, t);
  assert.equal(g.heard, false);
  g.ignore(t + 500);
  for (; t < 3500; t += 50) r = g.step(-20, t); // the chime, loud
  assert.equal(g.heard, false, 'chime ignored');
  for (; t < 7200 && !r; t += 50) r = g.step(-64, t);
  assert.equal(r.reason, 'novoice');
  const g2 = createVoiceGate({ floorDb: -65 });
  g2.ignore(1000);
  let r2 = null;
  for (let u = 0; u < 3000 && !r2; u += 50) r2 = g2.step(u < 1000 ? -64 : -25, u);
  assert.equal(g2.heard, true, 'her voice after the window counts');
});

test('echo-only clips: each chunk and the whole', () => {
  assert.deepEqual(clipRanges(4, false), [[0, 1], [0, 4], [1, 2], [2, 3], [3, 4]]);
});

test('voice gate: a steady sound above the start level is not her voice, and ends the take early', () => {
  const steady = run(createVoiceGate({ floorDb: -60, maxMs: 30000 }), flat(-25, 30000));
  assert.deepEqual([steady.reason, steady.heard, steady.peakDb], ['steady', false, null]);
  assert.ok(steady.ms <= 3000, 'within about 2.5 s of the sound starting: ' + steady.ms);
  // (a steady tone under about a second is not caught: its rise and fall look like a syllable)
});

test('voice gate: a soft voice a little over the start level is heard, not called steady (review: a quiet child was never heard)', () => {
  // syllables peaking 5 dB over the start level (-48), dipping toward the room between them
  const env = [-60, -54, -48, -45, -43, -44, -47, -52, -58, -60];
  const soft = Array.from({ length: 120 }, (_, k) => env[k % env.length]);
  const r = run(createVoiceGate({ floorDb: -60, maxMs: 9000, endSilenceMs: 1500 }), [...soft, ...flat(-60, 2000)]);
  assert.deepEqual([r.reason, r.heard], ['end', true]);
  assert.ok(r.peakDb > -48 && r.peakDb < -42, String(r.peakDb));
});

test('voice gate: one bump near the microphone is not her turn (review: a tap earned "Big stage voice!")', () => {
  for (const bump of [[-23], [-30, -34]]) {
    const levels = flat(-60, 8000);
    bump.forEach((db, k) => { levels[30 + k] = db; });
    const r = run(createVoiceGate({ floorDb: -60, noVoiceMs: 7000 }), levels);
    assert.deepEqual([r.reason, r.heard, r.peakDb], ['novoice', false, null], JSON.stringify(bump));
    assert.ok(r.maxDb > -48, 'the sound itself is reported (maxDb), so a caller knows the microphone works');
  }
  assert.equal(run(createVoiceGate({ floorDb: -60, noVoiceMs: 7000 }), flat(-60, 8000)).maxDb < -59, true);
});

test('room level per turn: one loud reading never sets the floor; a room that stays loud does (review: deaf for the whole visit)', async () => {
  const { quietFloor, deadMic } = await import('../shared/stage-plan.js');
  assert.equal(quietFloor([]), -60);
  assert.equal(quietFloor([-25]), -25, 'a single reading is all there is');
  assert.equal(quietFloor([-25, -60]), -60, 'her "yay!" at the tap, then a quiet reading before her turn');
  assert.equal(quietFloor([-60, -58, -25, -61, -59]), -59);
  assert.equal(quietFloor([-60, -30, -29, -31]), -31, 'the TV went on and stayed on: followed within readings');
  assert.equal(quietFloor([-60, -60, -60, -60, -60, -30, -30, -30]), -30, 'only the last five count');
  assert.equal(quietFloor([-30], -20), -38, 'the start level stays 6 dB under her warm-up shout');
  assert.equal(quietFloor([-60], -20), -60);
  assert.equal(roomLevel([-120, -120, -120], null), null, 'no usable reading: the fallback');
  assert.equal(deadMic({ heard: false, maxDb: -120 }), true);
  assert.equal(deadMic({ heard: false, maxDb: null }), true);
  assert.equal(deadMic({ heard: false, maxDb: -58 }), false, 'a quiet child in a quiet room: the microphone works');
  assert.equal(deadMic({ heard: true, maxDb: -20 }), false);
});

test('Luna: the horn glow points at its own gradient (review: the id was never filled in, so the glow vanished)', async () => {
  const { lunaSVG } = await import('../shared/characters.js');
  const svg = lunaSVG({ state: 'idle', glow: 2 });
  const def = svg.match(/id="(hornglow-[^"]+)"/);
  assert.ok(def, 'the gradient is defined');
  assert.ok(svg.includes(`fill="url(#${def[1]})"`), 'and used by the glow circle');
  assert.ok(!svg.includes('${'), 'no template text left in the markup');
});

test('map countdown: Luna says where to go in the audition week only', async () => {
  const { countdownSay } = await import('../shared/stage-plan.js');
  assert.equal(countdownSay(0), 'Your Annie audition is today! Tap Star Stage.');
  assert.equal(countdownSay(1), 'Your Annie audition is tomorrow! Tap Star Stage.');
  assert.equal(countdownSay(6), 'Your Annie audition is in six days! Tap Star Stage.');
  assert.equal(countdownSay(8), null);
  assert.equal(countdownSay(-1), null);
  const { readFileSync } = await import('node:fs');
  const lines = JSON.parse(readFileSync(new URL('../content/lines-audio.json', import.meta.url), 'utf8')).lines;
  for (let d = 0; d <= 7; d++) for (const part of countdownSay(d).match(/[^!.]+[!.]/g)) assert.ok(lines[part.trim().toLowerCase()], 'clip for ' + part);
});

test('room level from her takes: one loud reading is outvoted by the next take (review: still deaf for the visit when the first reading was loud)', async () => {
  const { quietLevel, quietFloor } = await import('../shared/stage-plan.js');
  assert.equal(quietLevel([-120, -120, -50]), null, 'too few usable readings');
  const take = [...Array(20).fill(-120), ...Array(30).fill(-61), ...Array(60).fill(-25), ...Array(30).fill(-60)];
  assert.equal(quietLevel(take), -61, 'the quiet around her voice, not her voice and not the warm-up silence');
  // her "yay!" during the room reading, then readings that came back empty (a microphone warming up): the first
  // take's quiet level brings the start level back down for the retry
  const rooms = [-21];
  assert.equal(quietFloor(rooms), -21);
  rooms.push(quietLevel(take));
  assert.equal(quietFloor(rooms), -61);
  // a steady TV is not quiet: its level is the room
  assert.equal(quietLevel(Array(100).fill(-30)), -30);
});
