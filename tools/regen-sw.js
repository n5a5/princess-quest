// tools/regen-sw.js — regenerates the ASSETS precache list in sw.js from `git ls-files`, using the same
// SKIP rule as tests/precache.test.js, and sets VERSION. New files must be `git add`ed first.
// Usage (from the repo root): node tools/regen-sw.js arcade-vX.Y.Z
const fs = require('fs'), cp = require('child_process');
const src = fs.readFileSync('tests/precache.test.js', 'utf8');
const m = src.match(/const SKIP = (\/.*\/);/);
const SKIP = eval(m[1]);
const files = cp.execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean).filter(f => !SKIP.test(f));
let s = fs.readFileSync('sw.js', 'utf8');
if (process.argv[2]) s = s.replace(/const VERSION = 'arcade-v[\d.]+'/, "const VERSION = '" + process.argv[2] + "'");
s = s.replace(/const ASSETS = \[[\s\S]*?\];/, 'const ASSETS = [\n' + [''].concat(files).map(f => "  '" + f + "'").join(',\n') + '\n];');
fs.writeFileSync('sw.js', s);
const size = files.reduce((a, f) => a + fs.statSync(f).size, 0);
console.log('precache', files.length, 'files,', (size / 1e6).toFixed(1), 'MB');
