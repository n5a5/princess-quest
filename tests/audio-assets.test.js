// tests/audio-assets.test.js — every sound the app can ask for has a bundled clip on disk and in the manifest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readJSON } from './helpers.js';

const man = readJSON('content/audio-manifest.json');
const words = new Set(man.words);
const phonemes = new Set(man.phonemes);

test('every phoneme in sounds.json has a bundled clip', () => {
  for (const s of readJSON('content/sounds.json').sounds) {
    assert.ok(phonemes.has(s.id), 'manifest lacks phoneme ' + s.id);
    assert.ok(existsSync(`assets/audio/phonemes/${s.id}.${man.ext}`), 'missing clip for /' + s.id + '/');
  }
});

test('every word the app can speak from content has a bundled clip (TTS is only the fallback)', () => {
  const need = new Set();
  for (const st of readJSON('content/phonics.json').stages) for (const w of st.words) need.add(w.w);
  const sw = readJSON('content/sight-words.json');
  for (const w of [...sw.lists.prePrimer, ...sw.lists.primer]) if (/^[a-z]/.test(w)) need.add(w);
  for (const s of readJSON('content/pa.json').syllables) need.add(s[0]);
  for (const s of readJSON('content/sounds.json').sounds) if (s.word) need.add(s.word);
  for (const s of readJSON('content/sentences.json').sentences) for (const w of s.text.replace(/[^A-Za-z\s']/g, '').split(/\s+/)) if (/^[a-z]/.test(w)) need.add(w.toLowerCase());
  const missing = [...need].filter(w => !words.has(w) || !existsSync(`assets/audio/words/${w}.${man.ext}`));
  assert.deepEqual(missing, [], 'words without a clip');
});
