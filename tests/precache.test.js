// tests/precache.test.js — sw.js must precache every shipped file, and nothing that does not exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.js';

const SKIP = /^(docs\/|tests\/|\.claude\/|README\.md$|\.gitignore$|\.gitattributes$|sw\.js$|tools\/)/;

test('sw.js ASSETS matches tracked files', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'ASSETS array not found');
  const listed = new Set([...m[1].matchAll(/'([^']*)'/g)].map(x => x[1].replace(/^\.\//, '')).filter(Boolean));
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').map(s => s.trim()).filter(Boolean).filter(f => !SKIP.test(f));
  const missing = tracked.filter(f => !listed.has(f));
  const extra = [...listed].filter(f => !tracked.includes(f));
  assert.deepEqual(missing, [], 'files not precached');
  assert.deepEqual(extra, [], 'precached files that do not exist');
});
