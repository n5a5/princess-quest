// tests/economy.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy, migrate, localDay, starsFromRatio, starRankFromPromotions, SAVE_KEY } from '../shared/economy.js';

test('fresh save has schema 3 and defaults', () => {
  const eco = createEconomy({ storage: memoryStorage() });
  assert.equal(eco.save.schemaVersion, 3);
  assert.equal(eco.save.gems, 0);
  assert.equal(eco.save.child.name, 'Amelia');
});

test('migrate merges missing keys and keeps known ones', () => {
  const s = migrate({ gems: 12, settings: { muted: true } });
  assert.equal(s.gems, 12);
  assert.equal(s.settings.muted, true);
  assert.equal(s.settings.rate, 0.9);
  assert.deepEqual(s.streak, { days: [] });
});

test('corrupt storage falls back to defaults', () => {
  const eco = createEconomy({ storage: memoryStorage({ [SAVE_KEY]: '{not json' }) });
  assert.deepEqual(eco.save.badges, []);
});

test('gems add and spend, persisted', () => {
  const st = memoryStorage();
  const eco = createEconomy({ storage: st });
  eco.addGems(7);
  assert.equal(eco.spendGems(10), false);
  assert.equal(eco.spendGems(5), true);
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).gems, 2);
});

test('streak counts days played and a missed day pauses, never resets', () => {
  const clock = fixedClock();
  const eco = createEconomy({ storage: memoryStorage(), now: clock.now });
  eco.markPlayedToday();
  eco.markPlayedToday();
  assert.equal(eco.streak().count, 1);
  clock.advanceDays(1);
  eco.markPlayedToday();
  clock.advanceDays(3); // missed two days
  eco.markPlayedToday();
  const s = eco.streak();
  assert.equal(s.count, 3);
  assert.equal(s.playedToday, true);
  assert.equal(s.last7.length, 7);
  assert.equal(s.last7[6], true);
  assert.equal(s.last7[5], false);
});

test('stars from first-try ratio', () => {
  assert.equal(starsFromRatio(1), 3);
  assert.equal(starsFromRatio(0.7), 2);
  assert.equal(starsFromRatio(0.2), 1);
  const eco = createEconomy({ storage: memoryStorage() });
  assert.equal(eco.setStars('word-builder', 0.9), 3);
  assert.equal(eco.save.stars['word-builder'], 3);
});

test('star rank from promotions', () => {
  assert.equal(starRankFromPromotions(0), 1);
  assert.equal(starRankFromPromotions(3), 2);
  assert.equal(starRankFromPromotions(30), 5);
});

test('log is capped to 60 days', () => {
  const clock = fixedClock();
  const eco = createEconomy({ storage: memoryStorage(), now: clock.now });
  eco.logResult({ subskill: 'phonics-encode', ok: true });
  clock.advanceDays(61);
  eco.logResult({ subskill: 'phonics-encode', ok: false });
  assert.equal(eco.save.log.length, 1);
  assert.equal(eco.save.log[0].ok, false);
});

test('export/import round trip and reject garbage', () => {
  const eco = createEconomy({ storage: memoryStorage() });
  eco.addGems(3);
  const text = eco.exportJSON();
  const eco2 = createEconomy({ storage: memoryStorage() });
  assert.equal(eco2.importJSON(text), true);
  assert.equal(eco2.save.gems, 3);
  assert.equal(eco2.importJSON('nope'), false);
  assert.equal(eco2.importJSON('[1,2]'), false);
});

test('localDay formats local date', () => {
  assert.equal(localDay(new Date(2026, 0, 5)), '2026-01-05');
});
