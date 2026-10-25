// tests/lagoon.test.js — Tick-Tock Lagoon: the clock's time maths (geared hands, phrases, snapping, turning past
// the 12), the wrong choices (real mistakes, never the answer, never a giveaway), the card generators, her
// routine times, and the save fields. No DOM: shared/clock.js keeps the maths apart from the SVG.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy, migrate } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, GROUPS } from '../shared/adaptive.js';
import { REGISTRY, SQUISHIES } from '../games/registry.js';
import { SQUISHY_KINDS } from '../shared/characters.js';
import { __test as lagoon } from '../games/princess-quest/lagoon.js';
import { toTotal, fromTotal, handAngles, phrase, digital, distractors, WHY, setHint, minuteGrab, minuteMove, snap, dragHour, stepFor, routineTimes, timeFor, ROUTINES } from '../shared/clock.js';

const ALL = Array.from({ length: 720 }, (_, t) => fromTotal(t));
const STAGES = SUBSKILLS.find(s => s.id === 'time-tell').stages;

test('time maths: totals round-trip, 12 not 0, the hour hand is geared to the minute hand', () => {
  for (let t = 0; t < 720; t++) assert.equal(toTotal(fromTotal(t)), t);
  assert.deepEqual(fromTotal(0), { h: 12, m: 0 });
  assert.deepEqual(fromTotal(-30), { h: 11, m: 30 });
  assert.deepEqual(handAngles({ h: 3, m: 30 }), { hour: 105, minute: 180 }, 'half past three: hour hand halfway from 3 to 4');
  assert.deepEqual(handAngles({ h: 12, m: 0 }), { hour: 0, minute: 0 });
  for (const t of ALL) {
    const a = handAngles(t);
    assert.ok(a.hour >= 0 && a.hour < 360 && a.minute >= 0 && a.minute < 360);
    assert.equal(a.hour, (t.h % 12) * 30 + t.m / 2);
  }
});

test('phrases say the time the way she says it at home', () => {
  assert.equal(phrase({ h: 3, m: 0 }), "three o'clock");
  assert.equal(phrase({ h: 3, m: 30 }), 'three thirty');
  assert.equal(phrase({ h: 12, m: 30 }), 'twelve thirty');
  assert.equal(phrase({ h: 1, m: 5 }), 'one oh five');
  assert.equal(phrase({ h: 9, m: 15 }), 'nine fifteen');
  assert.equal(phrase({ h: 10, m: 45 }), 'ten forty-five');
  assert.equal(digital({ h: 7, m: 5 }), '7:05');
  for (const t of ALL) assert.match(phrase(t), /^[a-z' -]+$/);
});

test('turning the minute hand: past the 12 the hour moves on (clockwise) or back (anticlockwise), at every step', () => {
  const sweep = (start, from, to, dir, step) => {
    let cont = minuteGrab(toTotal(start), from), prev = from;
    for (let a = from; dir > 0 ? a <= to : a >= to; a += dir * 5) { cont = minuteMove(cont, prev, ((a % 360) + 360) % 360); prev = ((a % 360) + 360) % 360; }
    return fromTotal(snap(cont, step));
  };
  assert.deepEqual(sweep({ h: 3, m: 30 }, 180, 360, 1, 30), { h: 4, m: 0 }, '3:30 turned clockwise to the top is 4:00, not 3:00');
  assert.deepEqual(sweep({ h: 3, m: 0 }, 0, -180, -1, 30), { h: 2, m: 30 }, '3:00 turned back to the bottom is 2:30');
  assert.deepEqual(sweep({ h: 11, m: 0 }, 0, 720, 1, 30), { h: 1, m: 0 }, 'two whole turns move the hour on two');
  assert.deepEqual(sweep({ h: 12, m: 0 }, 0, -360, -1, 30), { h: 11, m: 0 });
  for (const step of [30, 5]) for (const t of ALL.filter(x => x.m % step === 0)) {
    assert.equal(snap(minuteGrab(toTotal(t), t.m * 6), step), toTotal(t), 'grabbing the hand where it is moves nothing');
  }
  assert.equal(dragHour(105, 30), toTotal({ h: 3, m: 30 }));
  assert.equal(dragHour(100, 60), toTotal({ h: 3, m: 0 }));
  assert.equal(dragHour(359, 60), 0);
});

test('wrong choices: real mistakes, distinct, never the answer, o\'clock only at the o\'clock level', () => {
  for (const stage of STAGES) for (let n = 1; n <= 3; n++) for (const t of ALL.filter(x => x.m % stepFor(stage) === 0)) {
    const w = distractors(t, n, stage);
    assert.equal(w.length, n, `${digital(t)} ${stage} n=${n}`);
    const keys = new Set(w.map(x => toTotal(x.time)));
    assert.equal(keys.size, n);
    assert.ok(!keys.has(toTotal(t)));
    for (const x of w) {
      assert.ok(WHY[x.kind], x.kind);
      assert.ok(x.time.h >= 1 && x.time.h <= 12 && [0, 30].includes(x.time.m));
      if (stage === 'hour') assert.equal(x.time.m, 0, 'a half-past choice would give the answer away');
    }
    if (t.m === 30) assert.deepEqual(w[0].time, fromTotal(toTotal(t) + 60), 'the next-hour slip is always offered at half past');
  }
});

test('set-the-clock hints: the long hand first, then the short hand', () => {
  assert.match(setHint({ h: 3, m: 30 }, { h: 3, m: 0 }), /down to the six/);
  assert.match(setHint({ h: 3, m: 0 }, { h: 4, m: 30 }), /up to the twelve/);
  assert.match(setHint({ h: 3, m: 0 }, { h: 5, m: 0 }), /short hand/);
});

test('card generators: one right answer, the level\'s times only, a set card starts a few turns away', () => {
  const { gen, FAMILIES } = lagoon;
  for (const stage of STAGES) for (let i = 0; i < 1500; i++) {
    const step = stepFor(stage);
    for (const f of [FAMILIES.read, FAMILIES.match]) {
      const it = gen(f, stage, { choices: 2 + (i % 3) });
      assert.equal(it.time.m % step, 0);
      if (stage === 'hour') assert.equal(it.time.m, 0);
      assert.equal(it.wrong.length, 1 + (i % 3));
      assert.ok(!it.wrong.some(w => toTotal(w.time) === toTotal(it.time)));
    }
    const s = gen(FAMILIES.set, stage);
    const d = Math.abs(toTotal(s.start) - toTotal(s.time)), dist = Math.min(d, 720 - d);
    assert.ok(dist >= 2 * step && dist <= 3 * step, `start ${digital(s.start)} target ${digital(s.time)}`);
    assert.equal(toTotal(s.start) % step, 0);
  }
  // at the half level both kinds come up
  const ms = new Set(Array.from({ length: 200 }, () => timeFor('half').m));
  assert.deepEqual([...ms].sort(), [0, 30]);
});

test('her routine times: only real times the level can show, as a 12-hour clock', () => {
  const r = { wake: '07:00', school: '07:45', lunch: '12:00', dinner: '18:30', bath: '19:00', bed: '00:30', junk: '9:00', x: 'abc' };
  assert.deepEqual(routineTimes(r, 'hour').map(x => [x.id, digital(x.time)]), [['wake', '7:00'], ['lunch', '12:00'], ['bath', '7:00']]);
  assert.deepEqual(routineTimes(r, 'half').map(x => x.id), ['wake', 'lunch', 'dinner', 'bath', 'bed']);
  assert.equal(digital(routineTimes(r, 'half').find(x => x.id === 'bed').time), '12:30');
  assert.deepEqual(routineTimes({ wake: '25:00', bed: '19:99' }, 'half'), []);
  assert.deepEqual(routineTimes(undefined, 'half'), []);
  for (const x of ROUTINES) assert.match(x.line, /^Time (to|for) [a-z ]+!$/);
});

test('the place: registered, free play (never a quest stop), three sea Squishies that exist', () => {
  const r = REGISTRY.find(x => x.id === 'lagoon');
  assert.ok(r && r.ready);
  assert.deepEqual(r.subskills, ['time-tell']);
  assert.ok(!Object.values(GROUPS).flat().includes('lagoon'), 'Star Stage and the reading/math quest keep her daily time');
  assert.equal(SQUISHIES.lagoon.length, 3);
  for (const id of SQUISHIES.lagoon) assert.ok(SQUISHY_KINDS.find(k => k.id === id && k.sea), id);
  const all = Object.values(SQUISHIES).flat();
  assert.equal(new Set(all).size, all.length, 'no Squishy lives in two places');
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  const adaptive = createAdaptive({ economy });
  for (let d = 0; d < 10; d++) { const q = adaptive.todayQuest(REGISTRY.map(x => x.id)); assert.ok(!q.stops.some(s => s.cabinet === 'lagoon')); clock.advanceDays(1); }
});

test('save: routine times and clock mistakes are cleaned on load and combined across devices', () => {
  const s = migrate({ schemaVersion: 3, gems: 0, settings: { routine: { wake: '07:00', bed: 'late', Bad: '08:00', school: 7 } }, clock: { intro: 5, mistakes: { next: 3, swap: -1, near: 'x' } } });
  assert.deepEqual(s.settings.routine, { wake: '07:00' });
  assert.deepEqual(s.clock, { intro: null, mistakes: { next: 3 } });
  const a = createEconomy({ storage: memoryStorage() });
  const b = createEconomy({ storage: memoryStorage() });
  a.save.clock.mistakes = { next: 2, swap: 1 }; b.save.clock.mistakes = { next: 5 }; b.save.clock.intro = '2026-10-25';
  a.mergeJSON(JSON.stringify(b.save));
  assert.deepEqual(a.save.clock, { intro: '2026-10-25', mistakes: { next: 5, swap: 1 } });
  a.mergeJSON(JSON.stringify(b.save));
  assert.deepEqual(a.save.clock.mistakes, { next: 5, swap: 1 }, 'merging twice changes nothing');
});

// Everything the Lagoon can say plays in Luna's recorded voice: each sentence is a recorded line, or splits into
// recorded pieces the way shared/audio.js segment() splices them ("Which clock says" + "three thirty?").
test('every Lagoon sentence has Luna\'s recording (whole, or spliced from recorded pieces)', async () => {
  const { splitSentences, keyOf } = await import('../shared/audio.js');
  const { readJSON } = await import('./helpers.js');
  const { existsSync } = await import('node:fs');
  const audio = readJSON('content/lines-audio.json');
  const has = k => !!audio.lines[k] && existsSync(`assets/audio/lines/${audio.lines[k]}.${audio.ext}`);
  const playable = sn => {
    if (has(keyOf(sn))) return true;
    const w = sn.trim().split(/\s+/), best = Array(w.length + 1).fill(false); best[0] = true;
    for (let i = 0; i < w.length; i++) if (best[i]) for (let j = i + 1; j <= w.length; j++) if (has(keyOf(w.slice(i, j).join(' ')))) best[j] = true;
    return best[w.length];
  };
  const times = Array.from({ length: 24 }, (_, i) => ({ h: 1 + (i >> 1), m: (i & 1) * 30 }));
  const say = [
    'Welcome to Tick-Tock Lagoon! Tell the time to free the sea Squishies!', 'What time does the clock say?', 'Watch the hands.',
    'This is the short hand. It shows the hour.', 'This is the long hand. It shows the minutes.',
    'Watch! When the long hand goes all the way around, the short hand moves to the next number.', 'Now it is four o\'clock.',
    ...Object.values(WHY), ...ROUTINES.map(r => r.line + ' What time does the clock say?'),
    ...['finn', 'pinchy', 'inky'].map(id => 'You freed ' + SQUISHY_KINDS.find(k => k.id === id).name + ' the Squishy!')
  ];
  for (const t of times) {
    say.push('Which clock says ' + phrase(t) + '?', 'Make the clock say ' + phrase(t) + '.', 'It is ' + phrase(t) + '.', 'This clock says ' + phrase(t) + '.');
    for (const r of ROUTINES) say.push(r.line + ' Make the clock say ' + phrase(t) + '.');
    for (const u of times) if (u.m !== t.m || u.h !== t.h) say.push('Your clock says ' + phrase(u) + '. ' + setHint(t, u));
  }
  const missing = [...new Set(say.flatMap(s => splitSentences(s)).filter(sn => !playable(sn)))];
  assert.deepEqual(missing, [], 'run tools/collect-lines.py and tools/build-lines-audio.py');
});
