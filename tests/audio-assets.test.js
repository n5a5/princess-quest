// tests/audio-assets.test.js — every sound the app can ask for has a bundled clip on disk and in the manifest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
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
  for (const b of readJSON('content/books.json').books) for (const p of b.pages) for (const w of p.text.replace(/[^A-Za-z\s']/g, '').split(/\s+/)) if (/^[a-z]/i.test(w) && w !== 'I') need.add(w.toLowerCase());
  const missing = [...need].filter(w => !words.has(w) || !existsSync(`assets/audio/words/${w}.${man.ext}`));
  assert.deepEqual(missing, [], 'words without a clip');
});

// The first letter-sound set held ~30 ms of real sound per clip, which laptop and Chromebook speakers turn
// into a click. content/phoneme-stats.json is written by tools/build-phonemes.py from the encoded files.
test('letter sounds are long enough to hear, loud enough, start softly, and stats match the files on disk', () => {
  const stats = readJSON('content/phoneme-stats.json');
  const STOPS = ['b', 'd', 'g', 'p', 't', 'k'];
  const SHORT = ['h', 'w', 'y', 'j', 'ch', 'qu'];
  for (const s of readJSON('content/sounds.json').sounds) {
    const st = stats[s.id];
    assert.ok(st, 'no stats for /' + s.id + '/ — run tools/build-phonemes.py');
    assert.equal(statSync(`assets/audio/phonemes/${s.id}.ogg`).size, st.bytes, `/${s.id}/ clip changed since its stats were measured`);
    assert.ok(st.active_rms_db >= -24, `/${s.id}/ too quiet: ${st.active_rms_db} dB`);
    assert.ok(st.start_amp <= 0.05, `/${s.id}/ starts abruptly (clicks): ${st.start_amp}`);
    if (STOPS.includes(s.id)) {
      assert.ok(st.active_ms >= 40, `/${s.id}/ burst too short to hear: ${st.active_ms} ms`);
      assert.ok(st.ms <= 180, `/${s.id}/ too long for a stop, it would say "uh": ${st.ms} ms`);
    } else if (SHORT.includes(s.id)) {
      assert.ok(st.active_ms >= 80, `/${s.id}/ too short: ${st.active_ms} ms`);
    } else {
      assert.ok(st.active_ms >= 300, `/${s.id}/ is a sound you can hold; it needs at least 300 ms, has ${st.active_ms} ms`);
    }
  }
});

test('short i is the vowel of pig/kid/fish, not "ee": the clip F1 matches the word vowels and sits well above ee', () => {
  const st = readJSON('content/phoneme-stats.json').i;
  assert.equal(st.method, 'word_vowel');
  assert.ok(st.ref_F1 > 0);
  assert.ok(Math.abs(st.F1 - st.ref_F1) / st.ref_F1 < 0.3, `F1 ${st.F1} vs words ${st.ref_F1}`);
  assert.ok(st.F1 > 450, '"ee" has F1 near 300 Hz; short i is higher: ' + st.F1);
});
