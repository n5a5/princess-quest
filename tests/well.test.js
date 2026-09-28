// tests/well.test.js — Wishing Well round building, homophone-free doors, reserved slots. DOM-free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, memoryStorage, fixedClock } from './helpers.js';
import { createEconomy } from '../shared/economy.js';
import { __test as well } from '../games/princess-quest/well.js';

const SW = readJSON('content/sight-words.json');
const SENT = readJSON('content/sentences.json');
const PH = readJSON('content/phonics.json');

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  well.setup({ economy }, SW, SENT, PH);
  return { economy, clock };
}
function introduce(economy, words, box = 3, day = '2026-09-01') {
  for (const w of words) economy.save.sightWords[w] = { box, firstTryDays: [], introducedDay: day, lastSeen: day };
}
const all = () => [...SW.lists.prePrimer, ...SW.lists.primer];

test('wish doors never offer a word that sounds the same as the target (to/two/too, for/four)', () => {
  const { economy } = setup();
  introduce(economy, all());
  for (const target of ['to', 'two', 'too', 'for', 'four']) {
    if (!all().includes(target)) continue;
    for (let i = 0; i < 200; i++) {
      const foils = well.foilsFor(target, 4);
      for (const f of foils) assert.ok(!well.soundsSame(f, target), target + ' was offered with ' + f);
    }
  }
});

test('a round keeps places for a wish note and see-it-say-it even with many words due', () => {
  const { economy } = setup();
  introduce(economy, all(), 2, '2026-08-01'); // every word introduced long ago and due
  for (let i = 0; i < 50; i++) {
    const items = well.buildRound();
    const ids = items.map(x => x.family.id);
    assert.ok(items.length <= 9);
    assert.ok(ids.includes('seesay'), 'see-it-say-it is in the round: ' + ids);
    assert.ok(ids.includes('note'), 'a wish note is in the round: ' + ids);
  }
});

test('the first visit introduces five words and still fits in nine items', () => {
  setup();
  const items = well.buildRound();
  assert.ok(items.length <= 9);
  assert.equal(items.filter(x => x.family.id === 'heart').length, 5);
});

test('new words wait while five or more introduced words are still in the first box', () => {
  const { economy } = setup();
  introduce(economy, all().slice(0, 6), 1, '2026-09-01');
  const items = well.buildRound();
  assert.equal(items.filter(x => x.family.id === 'heart').length, 0);
});

test('the heart words of the first scroll sentences are introduced first', () => {
  setup();
  const first = well.allWords().slice(0, 8);
  for (const w of ['the', 'is', 'see', 'a']) assert.ok(first.includes(w), w + ' is not among the first words: ' + first);
});

test('a child who knows her words, one round a day, masters words within weeks (reviews are never starved)', () => {
  const { economy, clock } = setup();
  const firstMastered = [];
  for (let day = 0; day < 60; day++) {
    for (const { family, item } of well.buildRound()) {
      if (family.id === 'heart') well.introduce(item);
      else if (family.id === 'heartap') well.applyTap(item, { misses: 0 });
    }
    firstMastered.push(well.masteredWords().length);
    clock.advanceDays(1);
  }
  const day = firstMastered.findIndex(n => n > 0);
  assert.ok(day >= 0 && day <= 25, 'first word mastered on day ' + day);
  assert.ok(firstMastered[59] >= 15, 'mastered after 60 days: ' + firstMastered[59]);
});

test('practice on a word that is not due changes nothing; help never moves a word up', () => {
  const { economy, clock } = setup();
  well.introduce('the');
  well.applyTap('the', { misses: 0 }); // same day: not due
  assert.equal(economy.save.sightWords.the.box, 1);
  clock.advanceDays(1);
  well.applyTap('the', { misses: 0, helped: true });
  assert.equal(economy.save.sightWords.the.box, 1);
  clock.advanceDays(1);
  well.applyTap('the', { misses: 0 });
  assert.equal(economy.save.sightWords.the.box, 2);
});
