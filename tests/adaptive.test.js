// tests/adaptive.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, diffDays } from '../shared/adaptive.js';

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  return { clock, economy, adaptive: createAdaptive({ economy }) };
}

test('subskill table has 14 entries with stages and cabinets', () => {
  assert.equal(SUBSKILLS.length, 14);
  SUBSKILLS.forEach(s => { assert.ok(s.stages.length >= 2, s.id); assert.ok(s.cabinet); assert.ok([1, 2, 3].includes(s.tier)); });
});

test('promotes after 8 of last 10 first-try correct', () => {
  const { adaptive } = setup();
  let res;
  for (let i = 0; i < 10; i++) res = adaptive.record({ subskill: 'phonics-encode', ok: i !== 3 && i !== 7 });
  assert.equal(res.promoted, true);
  assert.equal(adaptive.stage('phonics-encode'), 'b');
  assert.equal(adaptive.stageIndex('phonics-encode'), 1);
});

test('does not promote at 7 of 10', () => {
  const { adaptive } = setup();
  let res;
  for (let i = 0; i < 10; i++) res = adaptive.record({ subskill: 'phonics-encode', ok: i > 2 });
  assert.equal(res.promoted, false);
  assert.equal(adaptive.stage('phonics-encode'), 'a');
});

test('retries and 2-choice items never enter the window', () => {
  const { adaptive, economy } = setup();
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'add-sub', ok: true, retry: true });
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'add-sub', ok: true, choices: 2 });
  assert.equal(economy.save.subskills['add-sub'].window.length, 0);
  assert.equal(economy.save.log.length, 20, 'still logged for the dashboard');
});

test('demotes only when 4 misses span two days', () => {
  const { adaptive, clock, economy } = setup();
  economy.save.subskills['measure'] = { stage: 2, window: [], lastPracticed: null, promotions: 0 };
  let res;
  for (let i = 0; i < 4; i++) res = adaptive.record({ subskill: 'measure', ok: false });
  assert.equal(res.demoted, false, 'same day');
  clock.advanceDays(1);
  res = adaptive.record({ subskill: 'measure', ok: false });
  assert.equal(res.demoted, true);
  assert.equal(adaptive.stageIndex('measure'), 1);
  assert.equal(economy.save.subskills['measure'].window.length, 0);
});

test('stage never drops below 0 or above max', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 4; i++) adaptive.record({ subskill: 'shapes', ok: false });
  clock.advanceDays(1);
  adaptive.record({ subskill: 'shapes', ok: false });
  assert.equal(adaptive.stageIndex('shapes'), 0);
  for (let round = 0; round < 6; round++) for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'shapes', ok: true });
  assert.equal(adaptive.stageIndex('shapes'), 2);
});

test('accuracy uses last 20 log rows; null when unpracticed', () => {
  const { adaptive } = setup();
  assert.equal(adaptive.accuracy('pa-sounds'), null);
  for (let i = 0; i < 30; i++) adaptive.record({ subskill: 'pa-sounds', ok: i >= 10 });
  assert.equal(adaptive.accuracy('pa-sounds'), 1);
});

test('missed items feed the trouble list at 3', () => {
  const { adaptive } = setup();
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  assert.deepEqual(adaptive.troubleList(), []);
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  assert.deepEqual(adaptive.troubleList(), [{ id: 'cat', count: 3 }]);
});

test('quest picks the weakest, stalest tier-1 cabinet and avoids three days running', () => {
  const { adaptive, clock, economy } = setup();
  for (let i = 0; i < 10; i++) {
    for (const id of adaptive.tier1Ids()) adaptive.record({ subskill: id, ok: id !== 'measure' });
  }
  let q = adaptive.todayQuest();
  assert.equal(q.requiredCabinet, 'measure-sort');
  assert.equal(q.date, economy.today());
  clock.advanceDays(1);
  q = adaptive.todayQuest();
  assert.equal(q.requiredCabinet, 'measure-sort');
  clock.advanceDays(1);
  q = adaptive.todayQuest();
  assert.notEqual(q.requiredCabinet, 'measure-sort', 'third day in a row is excluded');
});

test('unpracticed subskills are picked first', () => {
  const { adaptive } = setup();
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'phonics-encode', ok: true });
  const q = adaptive.todayQuest();
  assert.notEqual(q.requiredCabinet, 'word-builder');
});

test('quest completes with required plus a different choice, then claims once', () => {
  const { adaptive, economy } = setup();
  const q = adaptive.todayQuest();
  const other = q.requiredCabinet === 'word-builder' ? 'sound-garden' : 'word-builder';
  adaptive.noteRoundFinished(q.requiredCabinet);
  assert.equal(adaptive.claimQuest(), false);
  adaptive.noteRoundFinished(other);
  assert.equal(adaptive.todayQuest().choiceDone, true);
  assert.equal(adaptive.claimQuest(), true);
  assert.equal(economy.save.gems, 10);
  assert.equal(adaptive.claimQuest(), false);
  assert.equal(economy.streak().playedToday, true);
});

test('quest falls back to an available cabinet when no tier-1 cabinet is ready', () => {
  const { adaptive } = setup();
  const q = adaptive.todayQuest(['try-it']);
  assert.equal(q.requiredCabinet, 'try-it');
  assert.equal(q.requiredSubskill, null);
});

test('quest only considers available cabinets', () => {
  const { adaptive } = setup();
  const q = adaptive.todayQuest(['sound-garden', 'number-kingdom']);
  assert.ok(['sound-garden', 'number-kingdom'].includes(q.requiredCabinet));
});

test('diffDays', () => { assert.equal(diffDays('2026-09-01', '2026-09-10'), 9); });
