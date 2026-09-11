// tests/content.test.js — content JSON sanity checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON } from './helpers.js';

test('standards.json has verified K benchmarks', () => {
  const s = readJSON('content/standards.json');
  assert.equal(s.framework, 'Florida B.E.S.T. Kindergarten');
  for (const code of ['ELA.K.F.1.2', 'ELA.K.F.1.3', 'ELA.K.F.1.4', 'ELA.K.R.1.4', 'ELA.K.V.1.3']) {
    assert.ok(s.ela[code], code + ' missing');
    assert.ok(s.ela[code].cpalmsId > 0);
    assert.ok(s.ela[code].text.length > 10);
  }
  for (const code of ['MA.K.NSO.1.1', 'MA.K.NSO.2.2', 'MA.K.NSO.3.1', 'MA.K.AR.1.2', 'MA.K.M.1.3', 'MA.K.DP.1.1', 'MA.K.GR.1.5']) {
    assert.ok(s.math[code], code + ' missing');
  }
  assert.equal(s.ela['ELA.K.R.1.2'], undefined, 'R.1.2 does not exist at K');
});

test('praise.json pools are non-empty and use {name}', () => {
  const p = readJSON('content/praise.json');
  for (const k of ['praise', 'retry', 'greeting', 'reveal']) {
    assert.ok(Array.isArray(p[k]) && p[k].length >= 6, k);
    p[k].forEach(line => assert.ok(line.trim().length > 0));
  }
  assert.ok(p.greeting.some(l => l.includes('{name}')));
});
