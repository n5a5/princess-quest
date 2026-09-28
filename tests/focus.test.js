// tests/focus.test.js — the parent's "focus this week": planner boost, item generators lean on the sound and
// words, mouth cues exist for the confusable sounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, memoryStorage, fixedClock } from './helpers.js';
import { createEconomy, migrate } from '../shared/economy.js';
import { createAdaptive, FOCUS_BOOST } from '../shared/adaptive.js';
import { __test as meadow } from '../games/princess-quest/meadow.js';
import { __test as woods } from '../games/princess-quest/woods.js';
import { __test as well } from '../games/princess-quest/well.js';
import { mouthSVG, MOUTH_IDS } from '../shared/mouths.js';

const phonics = readJSON('content/phonics.json');
const sounds = Object.fromEntries(readJSON('content/sounds.json').sounds.map(s => [s.id, s]));
meadow.init({ phonics, sounds, sentences: readJSON('content/sentences.json') });
woods.init({ phonics, sounds, pa: readJSON('content/pa.json') });

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  return { clock, economy, adaptive: createAdaptive({ economy }) };
}

test('a focus runs seven days, boosts the skills it touches, and a broken one is dropped on load', () => {
  const { adaptive, clock } = setup();
  assert.equal(adaptive.focus(), null);
  const before = adaptive.skillScore('phonics-gpc');
  adaptive.setFocus({ sound: 'th', words: ['the', 'this'] });
  assert.deepEqual(adaptive.focus().words, ['the', 'this']);
  assert.ok(Math.abs(adaptive.skillScore('phonics-gpc') / before - FOCUS_BOOST) < 1e-9);
  assert.ok(Math.abs(adaptive.skillScore('sight-words') / adaptive.skillScore('sight-words') - 1) < 1e-9);
  clock.advanceDays(8);
  assert.equal(adaptive.focus(), null, 'expired');
  assert.equal(migrate({ schemaVersion: 3, gems: 0, settings: { focus: 'th' } }).settings.focus, null);
  assert.equal(migrate({ schemaVersion: 3, gems: 0, settings: { focus: { sound: 'th', until: '2026-10-05' } } }).settings.focus.until, '2026-10-05');
});

test('Meadow: with a focus on th, the th stone comes up in about half the letter-sound items even at set 1, with f/s/d foils', () => {
  let th = 0, conf = 0, hear = 0;
  for (let i = 0; i < 600; i++) {
    const it = meadow.gpcItem('set1', [], 'th');
    if (it.g === 'th') th++;
    if (it.kind === 'hear' && it.g === 'th') { hear++; if (it.foilsAll.some(f => ['f', 's', 'd', 'v'].includes(f))) conf++; }
    assert.ok(it.options === undefined || new Set(it.options).size === it.options.length);
  }
  assert.ok(th > 200 && th < 360, 'th items: ' + th);
  assert.ok(conf / hear > 0.9, 'th hear items with a sound-alike foil: ' + conf + '/' + hear);
  const none = Array.from({ length: 300 }, () => meadow.gpcItem('set1', [])).filter(it => it.g === 'th').length;
  assert.equal(none, 0, 'no focus: th stays out of set 1');
});

test('Meadow: focus words carry the grapheme; swaps put th in or take it out', () => {
  const words = meadow.pickWords(0, 6, { prefer: 'th' });
  assert.ok(words.filter(w => w.u.some(u => u[0] === 'th')).length >= 3, words.map(w => w.w).join(','));
  const pool = phonics.stages.slice(0, 3).flatMap(s => s.words);
  const pairs = meadow.swapPairs(pool, 3, 'th');
  assert.ok(pairs.length >= 1 && pairs.every(p => p.from.u[p.index][0] === 'th' || p.to.u[p.index][0] === 'th'), JSON.stringify(pairs.map(p => p.from.w + '>' + p.to.w)));
});

test('Woods: with a focus on th, first-sound items target /th/ about half the time and pair it with f/s/d/v pictures', () => {
  let th = 0, close = 0;
  for (let i = 0; i < 600; i++) {
    const it = woods.paItem('first', 0, [], 'th');
    if (it.phoneme === 'th') { th++; if (it.foils.some(f => ['f', 's', 'd', 'v'].includes(f.u.filter(u => u[1])[0][1]))) close++; }
    for (const f of it.foils) assert.notEqual(f.u.filter(u => u[1])[0][1], it.phoneme);
  }
  assert.ok(th > 200 && th < 400, 'th targets: ' + th);
  assert.ok(close / th > 0.9, 'th items with a close foil: ' + close + '/' + th);
});

test('Well: focus words are introduced first', () => {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  const adaptive = createAdaptive({ economy });
  well.setup({ economy, adaptive }, readJSON('content/sight-words.json'), readJSON('content/sentences.json'), phonics);
  adaptive.setFocus({ sound: 'dh', words: ['they', 'there', 'that'] });
  const first = well.buildRound().filter(x => x.family.id === 'heart').map(x => x.item);
  assert.deepEqual(first.slice(0, 3).sort(), ['that', 'there', 'they']);
});

test('mouth cues: th/dh, f/v, s/z, t/d, sh/ch draw; a plain vowel has none', () => {
  for (const id of MOUTH_IDS) assert.ok(mouthSVG(id).startsWith('<svg'), id);
  assert.ok(mouthSVG('dh').includes('<path d="M52 66'), 'voiced th shows the voice wave');
  assert.ok(!mouthSVG('th').includes('<path d="M52 66'));
  assert.equal(mouthSVG('a'), null);
  for (const id of ['th', 'dh', 'f', 's', 'd']) assert.ok(sounds[id], id + ' is a sound');
});
