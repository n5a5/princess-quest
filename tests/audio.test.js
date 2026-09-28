// tests/audio.test.js — resolution chain, decoding sequence, cancellation. All DOM-free via injected deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, decodeSteps, swapSteps, parseParts, letterName, TIMING, splitSentences, keyOf } from '../shared/audio.js';

function harness({ recorded = [], bundled = { phonemes: [], letters: [], words: [] }, sounds = {}, muted = false } = {}) {
  const log = [];
  const store = { has: (k, id) => recorded.includes(k + ':' + id), get: (k, id) => recorded.includes(k + ':' + id) ? { blobFor: k + ':' + id } : null };
  const player = { play: async src => { log.push(['play', src.blobFor || src]); return true; }, stop: () => log.push(['pstop']) };
  const speech = { speakText: async (t) => { log.push(['tts', t]); }, stop: () => log.push(['sstop']) };
  const audio = createAudio({ speech, store, player, manifest: { ext: 'ogg', ...bundled }, sounds, settings: { muted } });
  return { audio, log };
}

test('phoneme: recording beats bundled beats TTS; TTS only when ttsSafe', async () => {
  const sounds = { m: { tts: 'mmm', ttsSafe: true }, b: { tts: 'buh', ttsSafe: false } };
  let h = harness({ recorded: ['phoneme:m'], bundled: { phonemes: ['m', 'b'] }, sounds });
  await h.audio.phoneme('m');
  assert.deepEqual(h.log, [['play', 'phoneme:m']]);

  h = harness({ bundled: { phonemes: ['m'] }, sounds });
  await h.audio.phoneme('m');
  assert.deepEqual(h.log, [['play', './assets/audio/phonemes/m.ogg']]);

  h = harness({ sounds });
  assert.equal(await h.audio.phoneme('m'), true);
  assert.deepEqual(h.log, [['tts', 'mmm']]);

  h = harness({ sounds });
  assert.equal(await h.audio.phoneme('b'), false, 'stop with no asset stays silent, never "buh"');
  assert.deepEqual(h.log, []);
});

test('phonemeSource reports what will play', () => {
  const sounds = { m: { ttsSafe: true, tts: 'mmm' }, b: { ttsSafe: false } };
  const h = harness({ recorded: ['phoneme:s'], bundled: { phonemes: ['m'] }, sounds });
  assert.equal(h.audio.phonemeSource('s'), 'recorded');
  assert.equal(h.audio.phonemeSource('m'), 'bundled');
  assert.equal(h.audio.phonemeSource('b'), 'none');
  h.audio.setManifest({ ext: 'ogg', phonemes: [] });
  assert.equal(h.audio.phonemeSource('m'), 'tts');
});

test('letter and word fall back to TTS with names/text', async () => {
  const h = harness();
  await h.audio.letter('sh');
  await h.audio.word('cat');
  assert.deepEqual(h.log, [['tts', 'S H'], ['tts', 'cat']]);
  assert.equal(letterName('a'), 'A');
});

test('say routes /id/ tokens to phoneme and text to TTS', async () => {
  const h = harness({ bundled: { phonemes: ['m'] } });
  await h.audio.say('Which one starts with /m/?');
  assert.deepEqual(h.log.filter(x => x[0] !== 'pstop' && x[0] !== 'sstop'), [['tts', 'Which one starts with'], ['play', './assets/audio/phonemes/m.ogg']]);
  assert.deepEqual(parseParts('/k/ /a/ /t/. cat'), [{ sound: 'k' }, { sound: 'a' }, { sound: 't' }, { text: 'cat' }]);
});

test('decodeSteps: sound by sound, pause, one connected blend, word', () => {
  const steps = decodeSteps({ word: 'cat', graphemes: ['c', 'a', 't'], phonemes: ['k', 'a', 't'] });
  const kinds = steps.map(s => s.gap ? 'gap' + s.gap : (s.kind + (s.index ?? '')));
  assert.deepEqual(kinds, [
    'sound0', 'gap' + TIMING.betweenSounds, 'sound1', 'gap' + TIMING.betweenSounds, 'sound2',
    'gap' + TIMING.beforeBlend, 'blend', 'gap' + TIMING.beforeWord, 'word'
  ]);
  const blend = steps.find(s => s.kind === 'blend');
  assert.deepEqual(blend.blend, ['k', 'a', 't']);
  assert.deepEqual(blend.indexes, [0, 1, 2]);
  assert.equal(steps[steps.length - 1].word, 'cat');
  assert.equal(decodeSteps({ word: 'at', phonemes: ['a', 't'] }, { blend: false }).filter(s => s.kind === 'blend').length, 0);
});

test('blend uses the player chain when every sound has a clip, else falls back sound by sound', async () => {
  const chained = [];
  const h = harness({ bundled: { phonemes: ['k', 'a', 't'] } });
  const player = { play: async () => true, stop() {}, chain: async (srcs, o) => { chained.push(srcs); srcs.forEach((_, i) => o.onStart(i)); return true; } };
  const audio = createAudio({ speech: { speakText: async () => {}, stop() {} }, store: { has: () => false, get: () => null }, player, manifest: { ext: 'ogg', phonemes: ['k', 'a', 't'] }, sounds: {}, settings: {} });
  const seen = [];
  await audio.sequence(decodeSteps({ word: 'cat', phonemes: ['k', 'a', 't'] }), { onStep: s => seen.push(s.kind + (s.index ?? '')) });
  assert.equal(chained.length, 1);
  assert.deepEqual(chained[0], ['./assets/audio/phonemes/k.ogg', './assets/audio/phonemes/a.ogg', './assets/audio/phonemes/t.ogg']);
  assert.deepEqual(seen, ['sound0', 'sound1', 'sound2', 'blend0', 'blend1', 'blend2', 'word']);
  // missing clip → per-sound fallback
  const played = [];
  const audio2 = createAudio({ speech: { speakText: async () => {}, stop() {} }, store: { has: () => false, get: () => null }, player: { play: async s => { played.push(s); return true; }, stop() {}, chain: async () => { throw new Error('should not chain'); } }, manifest: { ext: 'ogg', phonemes: ['k', 'a'] }, sounds: { t: { ttsSafe: false } }, settings: {} });
  await audio2.blend(['k', 'a', 't']);
  assert.equal(played.length, 2);
  void h;
});

test('decodeSteps skips silent letters but keeps tile indexes', () => {
  const cake = { word: 'cake', units: [['c', 'k'], ['a', 'ae'], ['k', 'k'], ['e', null]] };
  const sounds = decodeSteps(cake, { blend: false }).filter(s => s.kind === 'sound');
  assert.deepEqual(sounds.map(s => [s.phoneme, s.index]), [['k', 0], ['ae', 1], ['k', 2]]);
});

test('swapSteps: changed phoneme, then blend and new word', () => {
  const steps = swapSteps({ word: 'bat', phonemes: ['b', 'a', 't'] }, 0);
  assert.deepEqual(steps[0], { phoneme: 'b', index: 0, kind: 'sound' });
  assert.deepEqual(steps.find(s => s.kind === 'blend').blend, ['b', 'a', 't']);
  assert.equal(steps[steps.length - 1].word, 'bat');
});

test('sequence fires onStep in order and stop() cancels', async () => {
  const h = harness({ bundled: { phonemes: ['k', 'a', 't'], words: ['cat'] } });
  const seen = [];
  const ok = await h.audio.sequence(decodeSteps({ word: 'cat', phonemes: ['k', 'a', 't'] }, { blend: false }), { onStep: s => seen.push(s.kind + (s.index ?? '')) });
  assert.equal(ok, true);
  assert.deepEqual(seen, ['sound0', 'sound1', 'sound2', 'word']);

  const h2 = harness({ bundled: { phonemes: ['k', 'a', 't'] } });
  const p = h2.audio.sequence([{ phoneme: 'k' }, { gap: 200 }, { phoneme: 'a' }]);
  h2.audio.stop();
  assert.equal(await p, false);
  assert.deepEqual(h2.log.filter(x => x[0] === 'play'), [['play', './assets/audio/phonemes/k.ogg']]);
});

test('muted audio plays nothing', async () => {
  const h = harness({ bundled: { phonemes: ['m'] }, muted: true });
  await h.audio.phoneme('m'); await h.audio.word('cat'); await h.audio.say('hi /m/');
  assert.deepEqual(h.log, []);
});

test('story voice: plays pre-rendered lines only when every sentence has one, else the device voice says it all', async () => {
  const log = [];
  const player = { play: async src => { log.push(['play', src]); return true; }, stop: () => {} };
  const speech = { speakText: async t => { log.push(['tts', t]); }, stop: () => {} };
  const settings = { muted: false, voice: 'luna' };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: [], words: [] }, sounds: {}, settings });
  audio.setLines({ ext: 'ogg', lines: { [keyOf('Great job!')]: 'aa', [keyOf('Which one is longer?')]: 'bb', [keyOf('The scroll says:')]: 'cc', [keyOf('The cat is in the hat.')]: 'dd' } });
  await audio.say('Great job!  Which one is longer?');
  assert.deepEqual(log, [['play', './assets/audio/lines/aa.ogg'], ['play', './assets/audio/lines/bb.ogg']]);
  log.length = 0;
  await audio.say('The scroll says: The cat is in the hat.');
  assert.deepEqual(log.map(x => x[1]), ['./assets/audio/lines/cc.ogg', './assets/audio/lines/dd.ogg']);
  log.length = 0;
  await audio.say('Great job! Luna has 3 gems.');
  assert.deepEqual(log, [['tts', 'Great job! Luna has 3 gems.']], 'a changing sentence means one device voice for the whole line');
  log.length = 0;
  settings.voice = 'device';
  await audio.say('Great job!');
  assert.deepEqual(log, [['tts', 'Great job!']], 'device voice until the parent chooses the story voice');
  assert.deepEqual(splitSentences('Hi! You did it. Yes?'), ['Hi!', 'You did it.', 'Yes?']);
  assert.equal(keyOf('  Luna\u2019s   Gem. '), "luna's gem.");
});

test('story voice: a sentence broken by a letter sound plays the recorded fragment and the recorded sound', async () => {
  const log = [];
  const player = { play: async src => { log.push(src); return true; }, stop: () => {} };
  const speech = { speakText: async t => { log.push('tts:' + t); }, stop: () => {} };
  const settings = { muted: false, voice: 'luna' };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: ['m'], words: [] }, sounds: {}, settings });
  audio.setLines({ ext: 'ogg', lines: { [keyOf('Listen.')]: 'l1', [keyOf('Which one starts with')]: 'w1' } });
  await audio.say('Listen. Which one starts with /m/?');
  assert.deepEqual(log, ['./assets/audio/lines/l1.ogg', './assets/audio/lines/w1.ogg', './assets/audio/phonemes/m.ogg']);
  log.length = 0;
  await audio.say('Which one starts with /s/?');
  assert.deepEqual(log, ['tts:Which one starts with'], 'no recorded /s/: the device voice says it and the sound stays silent (never TTS for a stop)');
});

test('story voice: a sentence with a changing word is spliced from a recorded piece and the word clip', async () => {
  const log = [];
  const player = { play: async src => { log.push(src); return true; }, stop: () => {} };
  const speech = { speakText: async t => { log.push('tts:' + t); }, stop: () => {} };
  const settings = { muted: false, voice: 'luna' };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: [], words: ['big'] }, sounds: {}, settings });
  audio.setLines({ ext: 'ogg', lines: { [keyOf('Which door says')]: 'd1', [keyOf('Luna has')]: 'l1', [keyOf('gems in her pouch.')]: 'g1', '3': 'n3' } });
  await audio.say('Which door says big?');
  assert.deepEqual(log, ['./assets/audio/lines/d1.ogg', './assets/audio/words/big.ogg']);
  log.length = 0;
  await audio.say('Luna has 3 gems in her pouch.');
  assert.deepEqual(log, ['./assets/audio/lines/l1.ogg', './assets/audio/lines/n3.ogg', './assets/audio/lines/g1.ogg']);
  log.length = 0;
  await audio.say('Which door says zebra?');
  assert.deepEqual(log, ['tts:Which door says zebra?'], 'a word with no clip means the device voice says the whole line');
});

// A player whose clips last `ms` and resolve 'stopped' when stop() or a newer clip cuts them, like the real one.
function timedPlayer(log, ms = 30) {
  let cur = null;
  return {
    play: src => new Promise(resolve => {
      if (cur) { const c = cur; cur = null; clearTimeout(c.t); c.resolve('stopped'); }
      log.push(['play', src]);
      const me = { resolve, t: setTimeout(() => { if (cur === me) cur = null; resolve(true); }, ms) };
      cur = me;
    }),
    stop: () => { if (cur) { const c = cur; cur = null; clearTimeout(c.t); c.resolve('stopped'); } }
  };
}

test('a clip cut short by a newer sound is not a failure: the device voice never repeats it', async () => {
  const log = [];
  const player = timedPlayer(log);
  const speech = { speakText: async t => { log.push(['tts', t]); }, stop: () => {} };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: ['m'], words: ['cat'] }, sounds: { m: { ttsSafe: true, tts: 'mmm' } }, settings: { muted: false, voice: 'luna' } });
  audio.setLines({ ext: 'ogg', lines: { [keyOf('Great job!')]: 'aa' } });
  const w = audio.word('cat');
  await new Promise(r => setTimeout(r, 5));
  audio.stop();
  assert.equal(await w, false);
  const p = audio.say('Great job!');
  await new Promise(r => setTimeout(r, 5));
  audio.phoneme('m'); // an intro that is not sequence-aware cuts the praise clip
  await p;
  await new Promise(r => setTimeout(r, 50));
  assert.equal(log.filter(x => x[0] === 'tts').length, 0, 'no device-voice echo: ' + JSON.stringify(log));
});

test('sequence: a {say} step does not cancel the rest of the sequence (heart-word mapping)', async () => {
  const log = [];
  const player = { play: async src => { log.push(['play', src]); return true; }, stop: () => {} };
  const speech = { speakText: async t => { log.push(['tts', t]); }, stop: () => {} };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: ['d', 'n'], words: ['down'] }, sounds: {}, settings: { muted: false } });
  const done = await audio.sequence([{ word: 'down' }, { phoneme: 'd' }, { say: 'heart part' }, { phoneme: 'n' }, { word: 'down' }]);
  assert.equal(done, true);
  assert.deepEqual(log.map(x => x[1]), ['./assets/audio/words/down.ogg', './assets/audio/phonemes/d.ogg', 'heart part', './assets/audio/phonemes/n.ogg', './assets/audio/words/down.ogg']);
});

test('an intro run as one sequence stops when she answers, and is not asked again', async () => {
  const log = [];
  const player = timedPlayer(log);
  const speech = { speakText: t => new Promise(r => { log.push(['tts', t]); setTimeout(r, 30); }), stop: () => {} };
  const audio = createAudio({ speech, store: null, player, manifest: { ext: 'ogg', phonemes: ['m'], words: [] }, sounds: {}, settings: { muted: false } });
  const intro = audio.sequence([{ say: 'This stone says' }, { phoneme: 'm' }, { say: 'Which picture starts with /m/?' }]);
  await new Promise(r => setTimeout(r, 10));
  await audio.say('Great job!'); // she answered during the intro
  await intro;
  await new Promise(r => setTimeout(r, 80));
  const said = log.map(x => x[1]);
  assert.ok(!said.includes('Which picture starts with'), 'the question is not re-asked after the answer: ' + JSON.stringify(said));
  assert.equal(said[said.length - 1], 'Great job!');
});
