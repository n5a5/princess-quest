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
import { toTotal, fromTotal, handAngles, phrase, digital, distractors, KINDS, whyLine, HAND_OF, setHint, longHandRule, minuteGrab, minuteMove, snap, hourTurn, pickHand, stepFor, routineTimes, timeFor, ROUTINES } from '../shared/clock.js';

const ALL = Array.from({ length: 720 }, (_, t) => fromTotal(t));
const sameT = (a, b) => toTotal(a) === toTotal(b);
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
  assert.deepEqual(fromTotal(snap(minuteGrab(toTotal({ h: 2, m: 0 }), 180), 30)), { h: 2, m: 30 }, 'a tap on the 6 at 2:00 makes two thirty, not one thirty');
  for (const step of [30, 5]) for (const t of ALL.filter(x => x.m % step === 0)) {
    assert.equal(snap(minuteGrab(toTotal(t), t.m * 6), step), toTotal(t), 'grabbing the hand where it is moves nothing');
  }
  // letting go at the o'clock level settles on o'clock: snap to 60 never leaves a :30
  for (let c = -100; c < 900; c += 7) assert.equal(snap(c, 60) % 60, 0);
});

test('turning the short hand changes only the hour, and grabbing it where it is moves nothing', () => {
  for (const t of ALL.filter(x => x.m % 30 === 0)) assert.equal(hourTurn(handAngles(t).hour, t.m), toTotal(t), digital(t));
  assert.equal(hourTurn(90, 30), toTotal({ h: 3, m: 30 }), 'the short hand on the 3 numeral keeps three thirty (the long hand stays put)');
  assert.equal(hourTurn(150, 30), toTotal({ h: 5, m: 30 }));
  assert.equal(hourTurn(100, 0), toTotal({ h: 3, m: 0 }));
  assert.equal(hourTurn(359, 0), 0);
});

test('the hand under the finger: out at the numbers it is always the long hand', () => {
  for (const t of ALL.filter(x => x.m % 30 === 0)) for (let a = 0; a < 360; a += 15) assert.equal(pickHand(a, 0.72, toTotal(t)), 'minute', `${digital(t)} at ${a}°`);
  assert.equal(pickHand(60, 0.3, toTotal({ h: 2, m: 0 })), 'hour', 'on the short hand near the middle');
  assert.equal(pickHand(180, 0.7, toTotal({ h: 2, m: 0 })), 'minute', 'a finger on the 6 means the long hand');
  assert.equal(pickHand(5, 0.3, toTotal({ h: 12, m: 0 })), 'minute', 'hands together: the long hand');
});

test('wrong choices: real mistakes, distinct, never the answer, o\'clock only at the o\'clock level', () => {
  for (const stage of STAGES) for (let n = 1; n <= 3; n++) for (const t of ALL.filter(x => x.m % stepFor(stage) === 0)) {
    const w = distractors(t, n, stage);
    assert.equal(w.length, n, `${digital(t)} ${stage} n=${n}`);
    const keys = new Set(w.map(x => toTotal(x.time)));
    assert.equal(keys.size, n);
    assert.ok(!keys.has(toTotal(t)));
    for (const x of w) {
      assert.ok(KINDS.includes(x.kind) && HAND_OF[x.kind], x.kind);
      assert.match(whyLine(x.kind, t, x.time), /^That says [a-z' ]+\. [A-Z]/);
      assert.ok(x.time.h >= 1 && x.time.h <= 12 && [0, 30].includes(x.time.m));
      if (stage === 'hour') assert.equal(x.time.m, 0, 'a half-past choice would give the answer away');
    }
    if (t.m === 30 && n >= 2) assert.ok(w.some(x => sameT(x.time, fromTotal(toTotal(t) + 60))), 'the next-hour slip is always offered at thirty');
    // at the thirty level she always has to read both hands: one choice gets the long hand wrong
    if (stage === 'half' && n >= 2) assert.ok(w.some(x => x.time.m !== t.m), `${digital(t)} n=${n}: no long-hand choice`);
  }
});

test('set-the-clock hints: the long hand first, then the short hand, by its number', () => {
  assert.match(setHint({ h: 3, m: 30 }, { h: 3, m: 0 }), /down to the six/);
  assert.match(setHint({ h: 3, m: 0 }, { h: 4, m: 30 }), /up to the twelve/);
  assert.equal(setHint({ h: 3, m: 0 }, { h: 5, m: 0 }), 'Now move the short hand to the three.');
  assert.equal(setHint({ h: 3, m: 30 }, { h: 5, m: 30 }), 'Now move the short hand past the three.');
  assert.equal(whyLine('minute', { h: 3, m: 30 }, { h: 3, m: 0 }, 'match'), "This clock says three o'clock. " + longHandRule({ m: 30 }));
  assert.equal(whyLine('next', { h: 3, m: 30 }, { h: 4, m: 30 }), 'That says four thirty. The short hand has passed the three.');
  assert.equal(whyLine('next', { h: 3, m: 30 }, { h: 4, m: 30 }, 'match'), 'This clock says four thirty. We want three thirty. The short hand has passed the three.');
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
    if (stage === 'half') assert.notEqual(s.start.m, s.time.m, 'at the thirty level the long hand starts wrong too');
  }
  // at the half level both kinds come up
  const ms = new Set(Array.from({ length: 200 }, () => timeFor('half').m));
  assert.deepEqual([...ms].sort(), [0, 30]);
});

test('rounds: six cards, never two alike (a twin would count as an unscored retry), with any number of routine times', () => {
  const { buildRound } = lagoon;
  const r = { wake: '07:00', school: '08:00', dinner: '18:30', bath: '19:00', bed: '19:30' };
  for (const stage of STAGES) for (const kind of ['mix', 'read', 'set', 'match', 'day']) for (const n of [0, 1, 2, 5]) for (let i = 0; i < 200; i++) {
    const days = routineTimes(Object.fromEntries(Object.entries(r).slice(0, n)), stage);
    const items = buildRound(kind, { stage, choices: 3, days });
    assert.equal(items.length, 6, `${stage} ${kind} ${n}`);
    const ids = items.map(x => x.family.itemId(x.item));
    assert.equal(new Set(ids).size, 6, ids.join(' '));
    if (kind === 'day' && days.length) assert.ok(items.filter(x => x.item.routine).length >= Math.min(6, 2 * days.length));
  }
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
  assert.deepEqual(s.clock, { intro: null, introHalf: null, mistakes: { next: 3 } });
  const a = createEconomy({ storage: memoryStorage() });
  const b = createEconomy({ storage: memoryStorage() });
  a.save.clock.mistakes = { next: 2, swap: 1 }; b.save.clock.mistakes = { next: 5 }; b.save.clock.intro = '2026-10-25';
  a.mergeJSON(JSON.stringify(b.save));
  assert.deepEqual(a.save.clock, { intro: '2026-10-25', introHalf: null, mistakes: { next: 5, swap: 1 } });
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
  const intro = ['This is the short hand. It shows the hour.', 'This is the long hand. It shows the minutes.',
    "When the long hand points straight up to the twelve, we say o'clock. The short hand points to the three. Three o'clock!",
    'Watch! When the long hand goes all the way around, the short hand moves to the next number.', "Now it is four o'clock.",
    'Now watch the long hand go halfway round.', 'The long hand points straight down to the six. That means thirty.',
    'The short hand is halfway between the three and the four. It has passed the three, but not reached the four, so it is three thirty!'];
  const say = [
    'Welcome to Tick-Tock Lagoon! Tell the time to free the sea Squishies!', 'What time does the clock say?', 'Watch the hands.', ...intro,
    ...ROUTINES.map(r => r.line + ' What time does the clock say?'),
    ...['finn', 'pinchy', 'inky'].map(id => 'You freed ' + SQUISHY_KINDS.find(k => k.id === id).name + ' the Squishy!')
  ];
  for (const t of times) {
    const cap = phrase(t)[0].toUpperCase() + phrase(t).slice(1) + '!';
    say.push(cap, 'Which clock says ' + phrase(t) + '?', 'Make the clock say ' + phrase(t) + '.', 'It is ' + phrase(t) + '.', 'This clock says ' + phrase(t) + '.');
    for (const r of ROUTINES) say.push(r.line + ' Make the clock say ' + phrase(t) + '.');
    for (const u of times) if (!sameT(u, t)) {
      say.push('Your clock says ' + phrase(u) + '. ' + setHint(t, u));
      for (const k of KINDS) for (const c of ['read', 'match']) say.push(whyLine(k, t, u, c));
    }
  }
  const missing = [...new Set(say.flatMap(s => splitSentences(s)).filter(sn => !playable(sn)))];
  assert.deepEqual(missing, [], 'run tools/collect-lines.py and tools/build-lines-audio.py');
});
