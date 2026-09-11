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

test('phonics.json: every unit uses a known phoneme id, graphemes spell the word, stages have enough words', () => {
  const ids = new Set(readJSON('content/sounds.json').sounds.map(s => s.id));
  const { stages } = readJSON('content/phonics.json');
  assert.deepEqual(stages.map(s => s.id), ['a', 'b', 'c', 'd', 'd2', 'e', 'f']);
  const seen = new Set();
  for (const st of stages) {
    assert.ok(st.words.length >= 24, `${st.id} has ${st.words.length} words`);
    for (const w of st.words) {
      assert.ok(!seen.has(w.w), 'duplicate word ' + w.w); seen.add(w.w);
      assert.ok(w.p && w.p.trim(), w.w + ' needs a picture');
      assert.equal(w.u.map(u => u[0]).join(''), w.w, w.w + ' graphemes must spell the word');
      for (const [g, p] of w.u) { assert.ok(g, w.w); if (p !== null) assert.ok(ids.has(p), `${w.w}: unknown phoneme ${p}`); }
      assert.ok(w.u.some(u => u[1] !== null), w.w);
    }
  }
});

test('praise.json pools are non-empty and use {name}', () => {
  const p = readJSON('content/praise.json');
  for (const k of ['praise', 'retry', 'greeting', 'reveal']) {
    assert.ok(Array.isArray(p[k]) && p[k].length >= 6, k);
    p[k].forEach(line => assert.ok(line.trim().length > 0));
  }
  assert.ok(p.greeting.some(l => l.includes('{name}')));
});
