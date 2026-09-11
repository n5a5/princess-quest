// tests/adaptive.test.js — v3: BKT mastery, outcome types, promotion rule, two-stop quest planner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, GROUPS, bktStep, BKT, diffDays, levelOf } from '../shared/adaptive.js';

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  return { clock, economy, adaptive: createAdaptive({ economy }) };
}

test('subskill table: 20 entries, every cabinet is a place, ids unique', () => {
  assert.equal(SUBSKILLS.length, 20);
  const places = new Set(['meadow', 'woods', 'well', 'caverns', 'falls', 'castle']);
  const ids = new Set();
  SUBSKILLS.forEach(s => { assert.ok(places.has(s.cabinet), s.id); assert.ok(s.stages.length >= 2); assert.ok(!ids.has(s.id)); ids.add(s.id); assert.ok([1, 2, 3].includes(s.tier)); });
  // the documented weaknesses are tier 1
  for (const id of ['phonics-gpc', 'phonics-encode', 'phonics-decode', 'pa-sounds', 'pa-rhyme', 'sight-words', 'subitize-tenframe', 'number-relations', 'add-sub', 'decompose-stories', 'measure', 'data-sort']) {
    assert.equal(SUBSKILLS.find(s => s.id === id).tier, 1, id);
  }
  // strengths are tier 3
  for (const id of ['shapes', 'comprehension']) assert.equal(SUBSKILLS.find(s => s.id === id).tier, 3, id);
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
  assert.equal(adaptive.level('phonics-encode'), 'known');
  clock.advanceDays(1);
  res = adaptive.record({ subskill: 'phonics-encode', outcome: 'firstTry', choices: 4 });
  assert.equal(res.promoted, true);
  assert.equal(adaptive.stage('phonics-encode'), 'b');
  assert.equal(adaptive.mastery('phonics-encode'), 0.5, 'estimate resets for the new stage');
  assert.equal(adaptive.level('phonics-encode'), 'learning');
});

test('levels: emerging, learning, known, mastered', () => {
  assert.equal(levelOf(0.2, 0, 3), 'emerging');
  assert.equal(levelOf(0.5, 0, 3), 'learning');
  assert.equal(levelOf(0.9, 1, 3), 'known');
  assert.equal(levelOf(0.9, 2, 3), 'mastered');
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

test('a saved stage beyond a shrunken stage list is clamped, never crashes', () => {
  const { adaptive, economy } = setup();
  economy.save.subskills['count-sequence'] = { stage: 9, p: 0.5, firstTryDays: {}, lastPracticed: null, promotions: 0, gpc: {} };
  assert.equal(adaptive.stage('count-sequence'), 'backward');
});

test('quest trail has one reading stop and one math stop, chosen by weakness', () => {
  const { adaptive, clock } = setup();
  // everything reading is strong except sight words; everything math is strong except measuring
  for (let i = 0; i < 8; i++) for (const s of SUBSKILLS) if (s.tier <= 2) adaptive.record({ subskill: s.id, outcome: ['sight-words', 'measure'].includes(s.id) ? 'revealed' : 'firstTry', choices: 4 });
  let q = adaptive.todayQuest();
  assert.equal(q.stops.length, 2);
  assert.equal(q.stops[0].cabinet, 'well');
  assert.equal(q.stops[0].subskill, 'sight-words');
  assert.equal(q.stops[1].cabinet, 'falls');
  assert.equal(q.stops[1].subskill, 'measure');
  // same place two days running is allowed; the third day rotates
  clock.advanceDays(1); q = adaptive.todayQuest(); assert.equal(q.stops[1].cabinet, 'falls');
  clock.advanceDays(1); q = adaptive.todayQuest(); assert.notEqual(q.stops[1].cabinet, 'falls');
  assert.ok(GROUPS.math.includes(q.stops[1].cabinet));
});

test('the same skill is not the target three days running', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 8; i++) for (const s of SUBSKILLS) if (GROUPS.reading.includes(s.cabinet)) adaptive.record({ subskill: s.id, outcome: s.id === 'phonics-gpc' ? 'revealed' : 'firstTry', choices: 4 });
  const targets = [];
  for (let d = 0; d < 3; d++) { targets.push(adaptive.todayQuest().stops[0].subskill); clock.advanceDays(1); }
  assert.equal(targets[0], 'phonics-gpc');
  assert.equal(targets[1], 'phonics-gpc');
  assert.notEqual(targets[2], 'phonics-gpc');
});

test('planner respects available cabinets and falls back to any playable one', () => {
  const { adaptive } = setup();
  const q = adaptive.todayQuest(['meadow']);
  assert.equal(q.stops.length, 1);
  assert.equal(q.stops[0].cabinet, 'meadow');
  const { adaptive: a2 } = setup();
  assert.equal(a2.todayQuest(['try-it']).stops[0].cabinet, 'try-it');
  const { adaptive: a3 } = setup();
  assert.equal(a3.pickQuestCabinet(['caverns']).cabinet, 'caverns');
});

test('an old-shape quest from a previous version is replaced, not crashed on', () => {
  const { adaptive, economy } = setup();
  economy.save.quest = { date: economy.today(), requiredCabinet: 'meadow', requiredDone: true, claimed: false };
  economy.save.questHistory = [{ date: '2026-09-01', cabinet: 'meadow', subskill: 'phonics-encode' }];
  const q = adaptive.todayQuest();
  assert.ok(Array.isArray(q.stops) && q.stops.length === 2);
  assert.equal(adaptive.questDone(), false);
});

test('review picks prefer mastered skills least recently practised', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 8; i++) adaptive.record({ subskill: 'pa-sounds', outcome: 'firstTry', choices: 4 });
  clock.advanceDays(3);
  for (let i = 0; i < 8; i++) adaptive.record({ subskill: 'pa-rhyme', outcome: 'firstTry', choices: 4 });
  assert.deepEqual(adaptive.reviewSkills('woods'), ['pa-sounds', 'pa-rhyme']);
});

test('quest completes when both stops are done, then claims once; extra rounds are counted', () => {
  const { adaptive, economy } = setup();
  const q = adaptive.todayQuest();
  const [a, b] = q.stops.map(s => s.cabinet);
  assert.equal(adaptive.nextStop().cabinet, a);
  adaptive.noteRoundFinished(a);
  assert.equal(adaptive.claimQuest(), false);
  assert.equal(adaptive.nextStop().cabinet, b);
  adaptive.noteRoundFinished('castle');
  assert.equal(adaptive.claimQuest(), false, 'a free-play round does not stand in for a planned stop');
  assert.equal(adaptive.todayQuest().extraRounds, 1);
  adaptive.noteRoundFinished(b);
  assert.equal(adaptive.nextStop(), null);
  assert.equal(adaptive.claimQuest(), true);
  assert.equal(economy.save.gems, 10);
  assert.equal(adaptive.claimQuest(), false);
  assert.equal(economy.streak().playedToday, true);
  assert.equal(adaptive.targetFor(a), q.stops[0].subskill);
  assert.equal(adaptive.targetFor('castle'), null);
});

test('diffDays', () => { assert.equal(diffDays('2026-09-01', '2026-09-10'), 9); });

test('an introduction or self-check (one choice) is logged but never moves mastery', () => {
  const { adaptive, economy } = setup();
  const before = adaptive.mastery('sight-words');
  adaptive.record({ subskill: 'sight-words', outcome: 'firstTry', choices: 1, review: true });
  assert.equal(adaptive.mastery('sight-words'), before);
  assert.equal(economy.save.log.length, 1, 'still logged for the parent corner');
  adaptive.record({ subskill: 'sight-words', outcome: 'firstTry', choices: 4 });
  assert.ok(adaptive.mastery('sight-words') > before, 'a real choice item still counts');
});
