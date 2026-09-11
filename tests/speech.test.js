// tests/speech.test.js — the pure part of speech.js: /id/ token parsing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseParts } from '../shared/speech.js';
import { readJSON } from './helpers.js';

test('parseParts splits text and sound tokens, dropping bare punctuation', () => {
  assert.deepEqual(parseParts('Which one starts with /m/?'), [{ text: 'Which one starts with' }, { sound: 'm' }]);
  assert.deepEqual(parseParts('/sh/ ... /i/ ... /p/. Which picture?'), [{ sound: 'sh' }, { sound: 'i' }, { sound: 'p' }, { text: 'Which picture?' }]);
  assert.deepEqual(parseParts('moon starts with /m/.'), [{ text: 'moon starts with' }, { sound: 'm' }]);
  assert.deepEqual(parseParts('Plain sentence.'), [{ text: 'Plain sentence.' }]);
});

test('sounds.json ids are unique and every entry is complete', () => {
  const { sounds } = readJSON('content/sounds.json');
  assert.ok(sounds.length >= 30);
  const ids = new Set();
  for (const s of sounds) {
    for (const k of ['id', 'label', 'word', 'pic', 'tts', 'tip']) assert.ok(s[k] && String(s[k]).trim(), s.id + ' missing ' + k);
    assert.ok(!ids.has(s.id), 'duplicate ' + s.id);
    ids.add(s.id);
  }
  for (const id of ['s', 'm', 'a', 'e', 'i', 'o', 'u', 'sh', 'ch', 'th', 'ae']) assert.ok(ids.has(id), id);
});
