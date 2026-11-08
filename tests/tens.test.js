// tests/tens.test.js — Gem Bundles (tens and ones): generators, slip choices, the math focus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy, migrate } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, FOCUS_BOOST } from '../shared/adaptive.js';
import { __test as caverns } from '../games/princess-quest/caverns.js';
import { REGISTRY } from '../games/registry.js';

test('tens-ones is a Caverns skill with bundles, ten more and the road to 100; counting gained decade crossings', () => {
  const d = SUBSKILLS.find(s => s.id === 'tens-ones');
  assert.deepEqual(d.stages, ['bundles', 'tenmore', 'road100']);
  assert.equal(d.cabinet, 'caverns');
  assert.ok(SUBSKILLS.find(s => s.id === 'count-sequence').stages.includes('decades'));
  assert.ok(REGISTRY.find(r => r.id === 'caverns').subskills.includes('tens-ones'));
});

test('Gem Bundles generators stay in kindergarten ranges and items differ', () => {
  const F = caverns.FAMILIES.tens;
  for (let i = 0; i < 3000; i++) {
    const b = caverns.gen(F, 'bundles');
    assert.equal(b.kind, 'bundles'); assert.ok(b.k >= 1 && b.k <= 5 && b.r >= 0 && b.r <= 9, JSON.stringify(b));
    const t = caverns.gen(F, 'tenmore');
    assert.equal(t.kind, 'tenmore'); assert.ok(t.k >= 1 && t.k <= 8 && t.r >= 1 && t.r <= 9 && [1, 10].includes(t.more), JSON.stringify(t));
    assert.ok(t.k * 10 + t.r + t.more <= 99, 'answer stays under 100: ' + JSON.stringify(t));
    const r = caverns.gen(F, 'road100');
    const target = r.back ? r.from - r.hop : r.from + r.hop;
    assert.ok(r.hop >= 1 && r.hop <= 2 && target >= 1 && target <= 10 && r.from >= 0 && r.from <= 10, JSON.stringify(r));
    const dc = caverns.gen(caverns.FAMILIES.count, 'decades');
    assert.equal(dc.kind, 'decades'); assert.equal((dc.start + 3) % 10, 0); assert.ok(dc.start + 3 >= 20 && dc.start + 3 <= 90);
  }
  const ids = new Set(['bundles', 'tenmore', 'road100'].flatMap(st => Array.from({ length: 300 }, () => F.itemId(caverns.gen(F, st)))));
  assert.ok(ids.size > 60, 'distinct items: ' + ids.size);
});

test('slip choices: the answer plus the mistakes a child makes, as many as the controller asks, all within 1 to 100', () => {
  caverns.setChoiceN(3);
  const c = caverns.slipChoices(37, [28, 47, 36]);
  assert.equal(c.length, 3); assert.equal(c.filter(x => x.ok).length, 1); assert.ok(c.some(x => x.label === '37'));
  assert.ok(c.every(x => ['37', '28', '47'].includes(x.label)), 'slips come first: ' + c.map(x => x.label));
  caverns.setChoiceN(4);
  const d = caverns.slipChoices(99, [109, 100, 98]);
  assert.equal(d.length, 4);
  for (const x of d) assert.ok(Number(x.label) >= 1 && Number(x.label) <= 100, x.label);
  assert.equal(new Set(d.map(x => x.label)).size, 4);
  caverns.setChoiceN(3);
});

test('a math focus boosts that skill in the planner and survives a reload', () => {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  const adaptive = createAdaptive({ economy });
  const before = adaptive.skillScore('tens-ones');
  adaptive.setFocus({ skill: 'tens-ones' });
  assert.equal(adaptive.focus().skill, 'tens-ones');
  assert.ok(Math.abs(adaptive.skillScore('tens-ones') / before - FOCUS_BOOST) < 1e-9);
  assert.ok(Math.abs(adaptive.skillScore('measure') / adaptive.skillScore('measure') - 1) < 1e-9);
  const again = createAdaptive({ economy: createEconomy({ storage: memoryStorage(), now: clock.now }) });
  assert.equal(again.focus(), null);
  assert.equal(migrate({ schemaVersion: 3, gems: 0, settings: { focus: { skill: 'tens-ones', until: '2099-01-01' } } }).settings.focus.skill, 'tens-ones');
  assert.equal(migrate({ schemaVersion: 3, gems: 0, settings: { focus: { skill: 7, until: '2099-01-01' } } }).settings.focus.skill, null);
});
