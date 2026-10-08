// tests/stage.test.js — Star Stage: every model clip the place can ask for exists, backward chaining order,
// countdown, the practice log in the save (clean, merge), and the voice gate on synthetic level streams.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJSON } from './helpers.js';
import { clipId, clipRanges, chainSteps, daysUntil, countdownHint, cleanStage, logPractice, mergeStage, stageDefaults, rmsDb, bigVoiceThreshold, createVoiceGate, roomLevel, followTimes, dayStrip, addDays } from '../shared/stage-plan.js';
import { REGISTRY } from '../games/registry.js';
import { migrate, defaultSave } from '../shared/economy.js';

const stage = readJSON('content/stage.json');
const blocks = [stage.warmup, stage.slate, ...stage.pieces];

test('every clip the place can play is bundled, and nothing else', () => {
  const want = new Set();
  for (const b of blocks) for (const [i, j] of clipRanges(b.chunks.length)) want.add(clipId(b.id, i, j) + '.ogg');
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
  assert.ok(stage.videos.length >= 1 && stage.videos.every(v => /^[\w-]{11}$/.test(v)));
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
  const long = run(createVoiceGate({ floorDb: -60, maxMs: 3000 }), flat(-20, 5000));
  assert.equal(long.reason, 'max');
  // a noisy room raises the start level; room noise alone is not her voice
  const noisy = createVoiceGate({ floorDb: -38 });
  assert.equal(noisy.startDb, -28);
  assert.equal(run(noisy, flat(-36, 8000)).reason, 'novoice');
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
  const said = [...src.matchAll(/say\('((?:[^'\\]|\\.)*)'\)/g)].map(m => unq(m[1]));
  said.push(...[...src.match(/const HINT = \{([\s\S]*?)\};/)[1].matchAll(/: '((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])));
  said.push(...[...src.matchAll(/cannot\('((?:[^'\\]|\\.)*)'\)/g)].map(m => unq(m[1])));
  for (const list of ['BIG', 'MORE', 'NOMIC']) said.push(...[...src.match(new RegExp('const ' + list + ' = \\[(.*)\\];'))[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])));
  said.push(...[...src.matchAll(/(?:intro|line): '((?:[^'\\]|\\.)*)'/g)].map(m => unq(m[1])), 'You did it!');
  for (const p of stage.pieces) said.push(p.intro, p.tip);
  const missing = said.flatMap(t => splitSentences(t)).filter(sn => !have[keyOf(sn)]);
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
  const t = followTimes(stage.pieces[0].chunks.map(c => c.text), 5327);
  assert.equal(t.length, 4); assert.equal(t[0], 0); assert.ok(t.every((x, k) => k === 0 || x > t[k - 1]) && t[3] < 5327);
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
