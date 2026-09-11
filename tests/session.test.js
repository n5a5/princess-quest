// tests/session.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClock } from '../shared/session.js';

test('accumulates active time between touches, ignores long idle gaps', () => {
  let t = 0;
  const clock = createSessionClock({ now: () => t, idleGapMs: 60000, limitMs: 600000 });
  clock.touch(); t += 30000; clock.touch();
  assert.equal(clock.activeMs(), 30000);
  t += 120000; clock.touch();
  assert.equal(clock.activeMs(), 30000, 'idle gap not counted');
});

test('due fires once at the limit', () => {
  let t = 0;
  const clock = createSessionClock({ now: () => t, idleGapMs: 60000, limitMs: 100000 });
  clock.touch();
  for (let i = 0; i < 5; i++) { t += 30000; clock.touch(); }
  assert.equal(clock.due(), true);
  assert.equal(clock.due(), false);
  clock.reset();
  assert.equal(clock.activeMs(), 0);
});
