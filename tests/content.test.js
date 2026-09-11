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
  // BUG-05: a picture must identify exactly one word, or choices become unanswerable
  const byPic = {};
  for (const st of stages) for (const w of st.words) (byPic[w.p] = byPic[w.p] || []).push(w.w);
  const dups = Object.entries(byPic).filter(([, v]) => v.length > 1);
  assert.deepEqual(dups, [], 'duplicate pictures');
});

test('sight-words.json: 92 Dolch words, units spell each word, phoneme ids valid, hearts marked', () => {
  const ids = new Set(readJSON('content/sounds.json').sounds.map(s => s.id));
  const sw = readJSON('content/sight-words.json');
  assert.equal(sw.lists.prePrimer.length, 40);
  assert.equal(sw.lists.primer.length, 52);
  for (const w of [...sw.lists.prePrimer, ...sw.lists.primer]) {
    const u = sw.words[w];
    assert.ok(u, w + ' missing units');
    assert.equal(u.map(x => x[0]).join(''), w, w + ' graphemes must spell the word');
    for (const [g, p, heart] of u) { assert.ok(g); if (p !== null) assert.ok(ids.has(p), `${w}: unknown phoneme ${p}`); if (p === null) assert.ok(heart === true || g === 'e', `${w}: silent part ${g} needs a heart`); }
  }
});

test('stories, poems, calm and scenarios content is complete', () => {
  const st = readJSON('content/stories.json');
  assert.ok(st.stories.length >= 6);
  for (const s of st.stories) {
    assert.ok(['literary', 'informational'].includes(s.kind), s.id);
    assert.ok(s.screens.length >= 3, s.id);
    for (const sc of s.screens) { assert.ok((sc.text.match(/[.!?]"?(\s|$)/g) || []).length <= 4, s.id + ' screen too long'); assert.equal(sc.question.choices.filter(c => c.ok).length, 1, s.id); assert.equal(sc.question.choices.length, 3); }
    assert.equal(s.vocab.choices.filter(c => c.ok).length, 1, s.id + ' vocab');
  }
  assert.ok(st.poems.length >= 4);
  st.poems.forEach(p => { assert.equal(p.lines.length, 4, p.id); assert.equal(p.rhymeQuestion.choices.filter(c => c.ok).length, 1, p.id); });
  const calm = readJSON('content/calm.json');
  assert.ok(calm.breathing.length >= 4 && calm.feelings.length >= 9 && calm.stories.length >= 4 && calm.bodyScan.length >= 6);
  calm.stories.forEach(s => { const ch = s.screens.filter(x => x.choice); assert.ok(ch.length >= 1, s.id); ch.forEach(x => assert.equal(x.choice.options.filter(o => o.quality === 'best').length, 1, s.id)); });
  const sc = readJSON('content/scenarios.json');
  assert.ok(sc.scenarios.length >= 15);
  sc.scenarios.forEach(s => { assert.equal(s.choices.length, 3, s.id); assert.equal(s.choices.filter(c => c.quality === 'best').length, 1, s.id); s.choices.forEach(c => assert.ok(c.feedback && c.pic, s.id)); });
});

test('praise.json pools are non-empty and use {name}', () => {
  const p = readJSON('content/praise.json');
  for (const k of ['praise', 'retry', 'greeting', 'reveal']) {
    assert.ok(Array.isArray(p[k]) && p[k].length >= 6, k);
    p[k].forEach(line => assert.ok(line.trim().length > 0));
  }
  assert.ok(p.greeting.some(l => l.includes('{name}')));
});
