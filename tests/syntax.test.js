// tests/syntax.test.js — every browser module must parse as an ES module. `node --check file.js` on a
// .js file without "type": "module" does not reliably report syntax errors, and a broken Parent Corner
// once shipped that way, so each file is copied to a .mjs and checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const files = ['shell.js', 'parent/parent.js',
  ...readdirSync('shared').filter(f => f.endsWith('.js')).map(f => 'shared/' + f),
  ...readdirSync('games').filter(f => f.endsWith('.js')).map(f => 'games/' + f),
  ...readdirSync('games/princess-quest').filter(f => f.endsWith('.js')).map(f => 'games/princess-quest/' + f)];

test('every module parses as an ES module', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pq-syntax-'));
  const bad = [];
  for (const f of files) {
    const copy = join(dir, f.replace(/[\\/]/g, '_') + '.mjs');
    copyFileSync(f, copy);
    try { execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' }); }
    catch (e) { bad.push(f + ': ' + String(e.stderr).split('\n').slice(0, 4).join(' ')); }
  }
  assert.deepEqual(bad, []);
  assert.ok(files.length >= 15);
});
