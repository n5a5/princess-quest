// tests/adaptive.test.js — v2: BKT mastery, outcome types, promotion rule, planner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, bktStep, BKT, diffDays } from '../shared/adaptive.js';

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  return { clock, economy, adaptive: createAdaptive({ economy }) };
}

test('subskill table: 15 entries, every cabinet is a place', () => {
  assert.equal(SUBSKILLS.length, 15);
  const places = new Set(['meadow', 'well', 'caverns', 'falls', 'castle']);
  SUBSKILLS.forEach(s => { assert.ok(places.has(s.cabinet), s.id); assert.ok(s.stages.length >= 2); });
});

test('bktStep moves p up on correct, down on wrong, less for guessable items', () => {
  const up = bktStep(0.3, 1, 1 / 3), down = bktStep(0.3, 0, 1 / 3);
  assert.ok(up > 0.3 && down < 0.3);
  assert.ok(bktStep(0.3, 1, 1 / 2) < bktStep(0.3, 1, 1 / 4), 'two-choice correct is weaker evidence than four-choice');
  assert.ok(bktStep(0.3, 0.5, 1 / 3) < up && bktStep(0.3, 0.5, 1 / 3) > down, 'scaffolded sits between');
});

test('first-try correct answers over two days promote a stage; same-day streak does not', () => {
  const { adaptive, clock } = setup();
  let res;
  for (let i = 0; i < 8; i++) res = adaptive.record({ subskill: 'phonics-encode', outcome: 'firstTry', choices: 4 });
  assert.equal(res.promoted, false, 'needs a second day');
  assert.ok(adaptive.mastery('phonics-encode') > 0.85);
  clock.advanceDays(1);
  res = adaptive.record({ subskill: 'phonics-encode', outcome: 'firstTry', choices: 4 });
  assert.equal(res.promoted, true);
  assert.equal(adaptive.stage('phonics-encode'), 'b');
  assert.equal(adaptive.mastery('phonics-encode'), 0.5, 'estimate resets for the new stage');
});

test('revealed answers lower mastery and flag reteach; nothing demotes', () => {
  const { adaptive } = setup();
  let res;
  for (let i = 0; i < 4; i++) res = adaptive.record({ subskill: 'measure', outcome: 'revealed', itemId: 'longer-1' });
  assert.ok(adaptive.mastery('measure') < 0.4);
  assert.equal(res.reteach, true);
  assert.equal(adaptive.stageIndex('measure'), 0);
  assert.equal(adaptive.troubleList()[0].id, 'longer-1');
});

test('review items and abandoned items do not count toward promotion', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'add-sub', outcome: 'firstTry', review: true });
  clock.advanceDays(1);
  const res = adaptive.record({ subskill: 'add-sub', outcome: 'firstTry', review: true });
  assert.equal(res.promoted, false);
  const before = adaptive.mastery('pa-sounds');
  adaptive.record({ subskill: 'pa-sounds', outcome: 'abandoned' });
  assert.equal(adaptive.mastery('pa-sounds'), before);
});

test('per-GPC mastery is tracked when gpc is given', () => {
  const { adaptive } = setup();
  adaptive.record({ subskill: 'phonics-decode', outcome: 'firstTry', gpc: 'sh' });
  adaptive.record({ subskill: 'phonics-decode', outcome: 'revealed', gpc: 'th' });
  assert.ok(adaptive.gpcMastery('phonics-decode', 'sh') > adaptive.gpcMastery('phonics-decode', 'th'));
  assert.equal(adaptive.gpcMastery('phonics-decode', 'ck'), BKT.pInit);
});

test('accuracy and trend from the log', () => {
  const { adaptive, clock } = setup();
  assert.equal(adaptive.accuracy('pa-sounds'), null);
  for (let i = 0; i < 6; i++) adaptive.record({ subskill: 'pa-sounds', outcome: i < 2 ? 'firstTry' : 'revealed' });
  clock.advanceDays(8);
  for (let i = 0; i < 6; i++) adaptive.record({ subskill: 'pa-sounds', outcome: i < 5 ? 'firstTry' : 'revealed' });
  assert.ok(adaptive.trend('pa-sounds') > 0.3);
  assert.equal(adaptive.accuracy('pa-sounds', 6), 5 / 6);
});

test('planner picks the weakest, stalest tier-1 place and avoids three days running', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 8; i++) for (const id of adaptive.tier1Ids()) adaptive.record({ subskill: id, outcome: id === 'measure' ? 'revealed' : 'firstTry', choices: 4 });
  let q = adaptive.todayQuest();
  assert.equal(q.requiredCabinet, 'falls');
  clock.advanceDays(1); q = adaptive.todayQuest(); assert.equal(q.requiredCabinet, 'falls');
  clock.advanceDays(1); q = adaptive.todayQuest(); assert.notEqual(q.requiredCabinet, 'falls');
});

test('planner respects available cabinets and falls back to any playable one', () => {
  const { adaptive } = setup();
  assert.equal(adaptive.todayQuest(['meadow']).requiredCabinet, 'meadow');
  const { adaptive: a2 } = setup();
  assert.equal(a2.todayQuest(['try-it']).requiredCabinet, 'try-it');
});

test('review picks prefer mastered skills least recently practised', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 8; i++) adaptive.record({ subskill: 'pa-sounds', outcome: 'firstTry', choices: 4 });
  clock.advanceDays(3);
  for (let i = 0; i < 8; i++) adaptive.record({ subskill: 'phonics-decode', outcome: 'firstTry', choices: 4 });
  assert.deepEqual(adaptive.reviewSkills('meadow'), ['pa-sounds', 'phonics-decode']);
});

test('quest completes with required plus a different choice, then claims once', () => {
  const { adaptive, economy } = setup();
  const q = adaptive.todayQuest();
  const other = q.requiredCabinet === 'meadow' ? 'caverns' : 'meadow';
  adaptive.noteRoundFinished(q.requiredCabinet);
  assert.equal(adaptive.claimQuest(), false);
  adaptive.noteRoundFinished(other);
  assert.equal(adaptive.claimQuest(), true);
  assert.equal(economy.save.gems, 10);
  assert.equal(adaptive.claimQuest(), false);
  assert.equal(economy.streak().playedToday, true);
});

test('diffDays', () => { assert.equal(diffDays('2026-09-01', '2026-09-10'), 9); });
