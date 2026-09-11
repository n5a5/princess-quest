// tests/content-loader.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContentLoader } from '../shared/content.js';

function fakeFetch(map) {
  const calls = [];
  const f = url => { calls.push(url); const body = map[url]; return Promise.resolve(body === undefined ? { ok: false, status: 404 } : { ok: true, json: () => Promise.resolve(body) }); };
  f.calls = calls;
  return f;
}

test('loads and caches JSON by name', async () => {
  const fetchImpl = fakeFetch({ './content/praise.json': { praise: ['hi'] } });
  const loader = createContentLoader({ fetchImpl });
  const a = await loader.load('praise');
  const b = await loader.load('praise');
  assert.equal(a, b);
  assert.equal(fetchImpl.calls.length, 1);
});

test('missing content rejects with a friendly error and is not cached', async () => {
  const fetchImpl = fakeFetch({});
  const loader = createContentLoader({ fetchImpl });
  await assert.rejects(() => loader.load('nope'), /Missing content nope/);
  await assert.rejects(() => loader.load('nope'));
  assert.equal(fetchImpl.calls.length, 2);
});
