// tests/audio.test.js — resolution chain, decoding sequence, cancellation. All DOM-free via injected deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, decodeSteps, swapSteps, parseParts, letterName, TIMING } from '../shared/audio.js';

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

test('decodeSteps: sound by sound, pause, blend, word', () => {
  const steps = decodeSteps({ word: 'cat', graphemes: ['c', 'a', 't'], phonemes: ['k', 'a', 't'] });
  const kinds = steps.map(s => s.gap ? 'gap' + s.gap : (s.kind + (s.index ?? '')));
  assert.deepEqual(kinds, [
    'sound0', 'gap' + TIMING.betweenSounds, 'sound1', 'gap' + TIMING.betweenSounds, 'sound2',
    'gap' + TIMING.beforeBlend,
    'blend0', 'gap' + TIMING.blendGap, 'blend1', 'gap' + TIMING.blendGap, 'blend2',
    'gap' + TIMING.beforeWord, 'word'
  ]);
  assert.equal(steps[steps.length - 1].word, 'cat');
  assert.equal(decodeSteps({ word: 'at', phonemes: ['a', 't'] }, { blend: false }).filter(s => s.kind === 'blend').length, 0);
});

test('decodeSteps skips silent letters but keeps tile indexes', () => {
  const cake = { word: 'cake', units: [['c', 'k'], ['a', 'ae'], ['k', 'k'], ['e', null]] };
  const sounds = decodeSteps(cake, { blend: false }).filter(s => s.kind === 'sound');
  assert.deepEqual(sounds.map(s => [s.phoneme, s.index]), [['k', 0], ['ae', 1], ['k', 2]]);
});

test('swapSteps: changed phoneme, then blend and new word', () => {
  const steps = swapSteps({ word: 'bat', phonemes: ['b', 'a', 't'] }, 0);
  assert.deepEqual(steps[0], { phoneme: 'b', index: 0, kind: 'sound' });
  assert.equal(steps.filter(s => s.kind === 'blend').length, 3);
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
