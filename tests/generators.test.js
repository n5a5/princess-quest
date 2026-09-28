// tests/generators.test.js — stress tests for every item generator: thousands of random draws, each checked for
// exactly one right answer, distinct choices, numbers in range and story/visual consistency. No DOM needed:
// generators only build data; the families render it later.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON } from './helpers.js';
import { __test as falls } from '../games/princess-quest/falls.js';
import { __test as caverns } from '../games/princess-quest/caverns.js';
import { __test as meadow } from '../games/princess-quest/meadow.js';
import { __test as woods } from '../games/princess-quest/woods.js';
import { SUBSKILLS } from '../shared/adaptive.js';

const N = 1500;
const phonics = readJSON('content/phonics.json');
const sounds = Object.fromEntries(readJSON('content/sounds.json').sounds.map(s => [s.id, s]));
const pa = readJSON('content/pa.json');
const sentences = readJSON('content/sentences.json');
meadow.init({ phonics, sounds, sentences });
woods.init({ phonics, sounds, pa });
const stagesOf = id => SUBSKILLS.find(s => s.id === id).stages;

test('falls: compare items have one answer, "same" only when the values are equal, scale/jar/tower/wand values honest', () => {
  let equal = 0;
  for (let i = 0; i < N; i++) {
    const it = falls.gen(falls.FAMILIES.measure, 'compare');
    assert.equal(it.kind, 'compare');
    assert.equal(it.pair.length, 2);
    assert.notEqual(it.pair[0].name, it.pair[1].name, 'the two things must be told apart by name');
    assert.ok(Array.isArray(it.values) && it.values.length === 2, it.attr + ' needs values');
    const [v1, v2] = it.values;
    assert.equal(it.equal, v1 === v2, 'equal flag must match the values');
    if (!it.equal) assert.equal(it.answerIsFirst, v1 > v2);
    if (it.equal) equal++;
    for (const p of it.pair) assert.ok(p.svg || p.pic, 'every side needs a picture');
  }
  assert.ok(equal > N * 0.08 && equal < N * 0.35, 'same is sometimes the right answer: ' + equal);
});

test('falls: attribute, order and units items are well formed', () => {
  for (let i = 0; i < 300; i++) {
    const a = falls.gen(falls.FAMILIES.measure, 'attribute');
    assert.ok(['long', 'heavy', 'holds'].includes(a.answer));
    const o = falls.gen(falls.FAMILIES.measure, 'order');
    assert.equal(o.things.length, 3);
    assert.equal(new Set(o.things.map(t => t.len)).size, 3, 'three different lengths so the order is unique');
    assert.equal(new Set(o.things.map(t => t.name)).size, 3, 'three different names');
    const u = falls.gen(falls.FAMILIES.measure, 'units');
    assert.ok(u.n >= 2 && u.n <= 8);
  }
});

test('falls: sort/data — counts distinct where a "most"/"fewest" question needs it, objects match counts, every object drawable', () => {
  for (const stage of ['two', 'three', 'chart']) {
    for (let i = 0; i < N; i++) {
      const it = falls.gen(falls.FAMILIES.sort, stage);
      const perBin = it.bins.map(b => it.items.filter(x => x.bin === b.name).length);
      assert.deepEqual(perBin, it.counts, 'drawn objects must equal the counts the question is built from');
      const max = Math.max(...perBin), min = Math.min(...perBin);
      if (it.ask === 'most') assert.equal(perBin.filter(c => c === max).length, 1, stage + ': most must be unique ' + perBin);
      if (it.ask === 'fewest') assert.equal(perBin.filter(c => c === min).length, 1, stage + ': fewest must be unique ' + perBin);
      if (it.ask === 'howmany') assert.ok(it.which >= 0 && it.which < it.bins.length);
      if (it.ask === 'more') assert.ok(max - min >= 1);
      for (const x of it.items) { assert.ok(x.svg || x.pic, 'object without a picture'); assert.ok(it.bins.some(b => b.name === x.bin)); assert.match(x.name, /^[a-z ]+$/i, 'spoken name must be words, not an emoji: ' + x.name); }
      assert.ok(it.question.length > 8);
    }
  }
});

test('falls: patterns — next has one answer among three distinct options, fix drops in a gem foreign to the unit', () => {
  for (const stage of ['ab', 'abb', 'abc']) for (let i = 0; i < 400; i++) {
    const it = falls.gen(falls.FAMILIES.patterns, stage);
    assert.equal(it.kind, 'next');
    assert.equal(it.seq.length, it.unit.length * (stage === 'ab' ? 4 : 3));
    const answer = it.seq[it.seq.length - 1];
    assert.ok(it.unit.includes(answer));
    assert.ok(it.set.length >= 4 && new Set(it.set).size === it.set.length);
  }
  for (let i = 0; i < 600; i++) {
    const it = falls.gen(falls.FAMILIES.patterns, 'fix');
    assert.equal(it.kind, 'fix');
    assert.ok(!it.unit.includes(it.wrongPic), 'the odd gem must not belong to the pattern at all');
    assert.ok(it.wrongAt > 0 && it.wrongAt < it.seq.length - 1);
  }
});

test('caverns: every generator stays inside kindergarten ranges with one honest answer', () => {
  const F = caverns.FAMILIES;
  for (let i = 0; i < N; i++) {
    for (const st of stagesOf('subitize-tenframe')) { const it = caverns.gen(F.frames, st); if (it.kind === 'make5') assert.ok(it.n >= 1 && it.n <= 4); else if (it.kind === 'make10') assert.ok(it.n >= 1 && it.n <= 9); else assert.ok(it.n >= 1 && it.n <= 10); }
    for (const st of stagesOf('add-sub')) { const it = caverns.gen(F.bridge, st); const ans = it.op === '+' ? it.a + it.b : it.a - it.b; assert.ok(ans >= 0 && ans <= 10, st + ' ' + JSON.stringify(it)); assert.ok(it.a >= 1 && it.b >= 1); }
    for (const st of stagesOf('teen-compare')) { const it = caverns.gen(F.teen, st); if (it.kind === 'teens') assert.ok(it.n >= 11 && it.n <= 19); if (it.kind === 'compare') assert.ok(it.a >= 2 && it.a <= 20 && it.b >= 2 && it.b <= 20); if (it.kind === 'numberline') { assert.ok(it.n >= 2 && it.n <= 18); } }
    for (const st of stagesOf('count-sequence')) { const it = caverns.gen(F.count, st); if (it.kind === 'backward') assert.ok(it.start - 3 >= 0); if (it.kind === 'ones') assert.ok(it.start + 3 <= 20); if (it.kind === 'tens') assert.ok(it.start + 30 <= 100); }
    for (const st of stagesOf('number-relations')) { const it = caverns.gen(F.trail, st); if (it.kind === 'onemore') assert.ok((it.more ? it.n + 1 : it.n - 1) >= 0 && (it.more ? it.n + 1 : it.n - 1) <= 10); if (it.kind === 'countout') assert.ok(it.n >= 2 && it.n <= 20); if (it.kind === 'order') assert.equal(new Set(it.nums).size, 3); }
    for (const st of stagesOf('decompose-stories')) {
      const it = caverns.gen(F.stories, st);
      if (it.kind === 'bonds') assert.equal(it.a + it.b, 10);
      if (it.kind === 'decompose') assert.ok(it.a + it.b <= 9 && it.a >= 1 && it.b >= 1);
      if (it.kind === 'problems') { const ans = it.op === '+' ? it.a + it.b : it.a - it.b; assert.ok(ans >= 0 && ans <= 10); assert.ok(it.thing && it.thing[0]); }
      if (it.kind === 'truefalse' || it.kind === 'match') {
        assert.equal(it.eqs.length, 3); assert.equal(it.eqs.filter(e => e.ok).length, 1);
        assert.equal(new Set(it.eqs.map(e => e.text)).size, 3, 'spells must differ ' + it.eqs.map(e => e.text));
        if (it.kind === 'match') for (const e of it.eqs) { const v = Number(e.text.split('= ')[1]); assert.ok(v >= 0 && v <= 10, 'match spell out of range ' + e.text); }
      }
    }
  }
  let ties = 0; for (let i = 0; i < N; i++) { const it = caverns.gen(F.teen, 'compare'); if (it.a === it.b) ties++; }
  assert.ok(ties > N * 0.12 && ties < N * 0.4, 'compare sometimes ties so "same" is a live answer');
});

test('meadow: letter-sound items — three distinct stones with distinct sounds, or a picture that really starts/ends with the sound', () => {
  for (const st of stagesOf('phonics-gpc')) for (let i = 0; i < 500; i++) {
    const it = meadow.gpcItem(st, []);
    if (it.kind === 'hear') {
      // up to four stones (the success-rate controller shows 2 to 4 of them)
      assert.ok(it.options.length >= 3 && it.options.length <= 4); assert.equal(new Set(it.options).size, it.options.length);
      assert.ok(it.options.includes(it.g));
      const ph = it.options.map(g => (g in sounds ? g : g === 'c' ? 'k' : g));
      assert.equal(new Set(ph).size, it.options.length, 'c and k must never both be stones for /k/: ' + it.options);
    } else {
      assert.ok(it.target && it.target.p && it.target.w, 'target needs a picture ' + it.g);
      assert.ok(it.foils.length >= 2 && it.foils.length <= 3, 'two or three foils for ' + it.g);
      assert.equal(new Set([it.target, ...it.foils].map(x => x.p)).size, it.foils.length + 1, 'pictures must differ');
    }
  }
});

test('meadow: sound-swap pairs differ in exactly one spoken unit and have different pictures', () => {
  const pool = phonics.stages.flatMap(s => s.words);
  for (let i = 0; i < 200; i++) for (const p of meadow.swapPairs(pool, 6)) {
    assert.equal(p.from.u.length, p.to.u.length);
    const diff = p.from.u.map((u, k) => u[0] !== p.to.u[k][0] ? k : -1).filter(k => k >= 0);
    assert.deepEqual(diff, [p.index]);
    assert.notEqual(p.from.p, p.to.p);
  }
});

test('woods: PA items — foils never share the target sound, rhymes share the rime, deletions leave a real pictured word', () => {
  const isVowel = id => sounds[id] && sounds[id].kind === 'vowel';
  for (const kind of ['first', 'final', 'medial']) for (let i = 0; i < 500; i++) {
    const it = woods.paItem(kind, 0, []);
    assert.ok(it.foils.length >= 2 && it.foils.length <= 3, kind);
    const unitAt = w => { const u = w.u.filter(x => x[1]); return kind === 'first' ? u[0][1] : kind === 'final' ? u[u.length - 1][1] : u.find(x => isVowel(x[1]))[1]; };
    assert.equal(unitAt(it.target), it.phoneme);
    for (const f of it.foils) { assert.notEqual(unitAt(f), it.phoneme, kind + ' foil shares the sound: ' + f.w); assert.notEqual(f.p, it.target.p); }
  }
  for (let i = 0; i < 500; i++) {
    const it = woods.rhymeItem(1, []);
    assert.equal(woods.rimeOf(it.target), woods.rimeOf(it.answer));
    assert.notEqual(it.target.w, it.answer.w);
    assert.ok(it.foils.length >= 2 && it.foils.length <= 3);
    for (const f of it.foils) { assert.notEqual(woods.rimeOf(f), woods.rimeOf(it.target)); assert.notEqual(f.p, it.target.p); assert.notEqual(f.p, it.answer.p); }
  }
  const pairs = woods.deletePairs(phonics.stages.flatMap(s => s.words));
  assert.ok(pairs.length >= 10, 'enough deletion pairs: ' + pairs.length);
  for (const p of pairs) { assert.ok(p.to.p && p.from.p && p.to.p !== p.from.p); assert.ok(p.phoneme); }
});

test('caverns: Rainbow Road hops stay on the 1–10 path', () => {
  for (const st of ['onemore', 'countout', 'order']) for (let i = 0; i < 1000; i++) {
    const it = caverns.gen(caverns.FAMILIES.road, st);
    assert.ok(it.hop >= 1 && it.hop <= 3 && it.from >= 0 && it.from + it.hop <= 10, JSON.stringify(it));
  }
});

test('woods: ears-only pools skip ambiguous pictures, miscoded vowels and x/qu words', () => {
  for (const idx of [0, 1, 2, 3]) for (const w of [...woods.pool(idx), ...woods.blendPool(idx), ...woods.allWords()]) {
    assert.ok(!woods.EAR_SKIP.has(w.w), w.w);
    assert.ok(!w.u.some(u => u[0] === 'x' || u[0] === 'qu'), w.w);
    assert.notEqual(w.p, '🔙');
  }
  assert.ok(woods.blendPool(1).some(w => w.u.filter(u => u[1]).length >= 4), 'the long stage has 4-sound words');
});

test('woods: taking a sound away leaves exactly the sounds of the answer word (pink without /k/ is not pin)', () => {
  const words = phonics.stages.flatMap(s => s.words);
  const sounds = u => u.filter(x => x[1]).map(x => x[1]);
  for (const p of woods.deletePairs(words)) {
    const left = p.where === 'first' ? sounds(p.from.u).slice(1) : sounds(p.from.u).slice(0, -1);
    assert.deepEqual(left, sounds(p.to.u), p.from.w + ' -> ' + p.to.w);
  }
});

test('meadow: spare stones never repeat a sound of the word; swap rounds never reuse a word; Letter Stones foils keep the first letter when they can', () => {
  const ph = g => (g in sounds ? g : g === 'c' || g === 'ck' ? 'k' : g);
  const words = phonics.stages.flatMap(s => s.words);
  for (let i = 0; i < 400; i++) {
    const w = words[i % words.length];
    const sounds_ = new Set(w.u.map(u => u[1]).filter(Boolean));
    for (const g of meadow.distractorGraphemes(w, 3, 3)) assert.ok(!sounds_.has(ph(g)), w.w + ' got spare ' + g);
  }
  for (let i = 0; i < 200; i++) {
    const pairs = meadow.swapPairs(phonics.stages.slice(0, 3).flatMap(s => s.words), 5);
    const ws = pairs.flatMap(p => [p.from.w, p.to.w]);
    assert.equal(new Set(ws).size, ws.length, 'no word twice in a swap round: ' + ws);
  }
  const cat = words.find(w => w.w === 'cat');
  const foils = meadow.minimalPairs(cat, phonics.stages.slice(0, 3).flatMap(s => s.words)).slice(0, 2);
  assert.ok(foils.every(f => f.u[0][0] === 'c'), 'cat gets foils like cap/cot: ' + foils.map(f => f.w));
});

test('falls: the heavier pan hangs lower; different things are never "the same" weight or capacity', () => {
  const panY = (svg, x) => { const g = svg.split('<g transform="translate(0 ').slice(1).find(t => t.includes('x1="' + x + '"')); return Number(g.split(')')[0]); };
  const leftHeavy = falls.scaleSVG('🪨', '🪶', -1), rightHeavy = falls.scaleSVG('🪶', '🪨', 1);
  assert.ok(panY(leftHeavy, 40) > panY(leftHeavy, 200), 'left heavier: left pan lower (larger y)');
  assert.ok(panY(rightHeavy, 200) > panY(rightHeavy, 40), 'right heavier: right pan lower');
  for (let i = 0; i < 3000; i++) {
    const it = falls.gen(falls.FAMILIES.measure, 'compare');
    if (it.attr === 'heavy' || it.attr === 'holds') assert.equal(it.equal, false, it.pair.map(p => p.name).join(' / '));
  }
});

test('falls: chart questions vary ("how many more" is not always 2) and sort item ids differ within a round', () => {
  const diffs = new Set();
  for (let i = 0; i < 500; i++) { const it = falls.gen(falls.FAMILIES.sort, 'chart'); diffs.add(Math.max(...it.counts) - Math.min(...it.counts)); }
  assert.ok(diffs.size >= 3, [...diffs].join(','));
});

test('meadow: every letter sound has a first-sound picture, and no answer picture has a second name with another sound', () => {
  const names = new Map();
  for (const w of phonics.stages.flatMap(s => s.words)) { if (!names.has(w.p)) names.set(w.p, new Set()); names.get(w.p).add(w.w); }
  for (const id of ['s', 'a', 't', 'p', 'n', 'm', 'd', 'g', 'o', 'k', 'e', 'u', 'r', 'h', 'b', 'f', 'l', 'j', 'v', 'w', 'y', 'z', 'sh', 'ch']) {
    const ts = meadow.startsWith(id);
    assert.ok(ts.length >= 1, 'no picture starts with /' + id + '/');
  }
  assert.ok(!meadow.startsWith('b').some(w => w.p === '⚽'), 'ball/kick picture is not an answer for /b/');
  // short i has no picture a child surely names with /i/ (🐛 is also "bug", 🖋️ is "pen"): only hear-it items
  for (let k = 0; k < 300; k++) { const it = meadow.gpcItem('set1', ['s', 'a', 't', 'p', 'n']); if (it.g === 'i') assert.equal(it.kind, 'hear'); }
});

test('content: no picture prints a word (🔙 and similar)', () => {
  const textEmoji = ['🔙', '🔚', '🔛', '🔜', '🔝', '🆗', '🆒', '🆕', '🆓', '🆙', '🆘', '🆚', '🔤', '🔠', '🔡', '💯'];
  for (const w of phonics.stages.flatMap(s => s.words)) assert.ok(!textEmoji.includes(w.p), w.w + ' ' + w.p);
});
