# Princess Quest v3 — Step 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old app with the Amelia's Arcade shell: splash, home, quest card, cabinet registry with lazy loading, speech, economy/save, adaptive engine, content loader, UI kit, session shaper, PWA, and a parent dashboard skeleton — with a tiny "Try It" cabinet so the phone test is meaningful.

**Architecture:** Static site, vanilla ES modules, no build. `shell.js` boots shared services and lazy-imports cabinets from `games/registry.js`. Shared logic (`economy`, `adaptive`, `content`, `session`) is DOM-free and unit-tested with `node --test`; DOM code (`speech`, `ui`, `shell`, `parent`) is verified in the browser. Spec: `docs/superpowers/specs/2026-09-10-princess-quest-v3-design.md`.

**Tech Stack:** HTML/CSS/JS ES modules, Web Speech API, localStorage, service worker, Node 22 `node --test` (zero deps), `npx http-server` for local preview (`.claude/launch.json` already points at port 8765).

---

## File structure

| File | Responsibility |
|---|---|
| `index.html` | Static shell markup: splash, top bar, home, cabinet host, shaper overlay, PIN overlay |
| `shell.js` | Boot, home render, cabinet open/close, quest card, session shaper wiring |
| `shared/theme.css` | Tokens, layout, 64px targets, keyframes |
| `shared/economy.js` | Save schema, migrate, gems, stars, streak, badges, log, export/import |
| `shared/adaptive.js` | Sub-skill table, windows, promote/demote, quest picker, missed items |
| `shared/content.js` | JSON loader with cache |
| `shared/session.js` | Pure active-time clock for the session shaper |
| `shared/speech.js` | TTS wrapper, voice pick, word spans, mute |
| `shared/ui.js` | DOM builders, choice grid with scaffolding, celebrate, breathing bubble, toast |
| `games/registry.js` | Cabinet entries |
| `games/princess-quest/try-it.js` | Temporary demo cabinet (removed in Step 2) |
| `parent/index.html`, `parent/parent.js`, `parent/parent.css` | Dashboard skeleton |
| `content/standards.json` | Verified benchmarks |
| `content/praise.json` | Praise / retry / greeting lines |
| `sw.js`, `manifest.json` | PWA |
| `tests/*.test.js`, `tests/helpers.js` | Unit tests |
| `README.md` | Short, expanded in Step 9 |

---

### Task 1: Clear the old app

**Files:**
- Delete: `castle.js`, `core.js`, `data.js`, `letter-garden.js`, `number-meadow.js`, `parent.js`, `styles.css`, `index.html`, `sw.js`, `manifest.json`
- Keep: `icon-192.png`, `icon-512.png`, `princess.png`, `.claude/launch.json`, `docs/`

- [ ] **Step 1: Remove old files with git**

```bash
git rm -q castle.js core.js data.js letter-garden.js number-meadow.js parent.js styles.css index.html sw.js manifest.json
```

- [ ] **Step 2: Verify only assets remain**

Run: `git ls-files`
Expected: `.claude/launch.json`, `docs/...`, `icon-192.png`, `icon-512.png`, `princess.png`

- [ ] **Step 3: Commit**

```bash
git commit -q -m "Remove Amelia's Princess World files ahead of v3 rebuild

Old builds remain at tag princess-quest-final and commit dd5d375.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Standards content + test helpers + content validation test

**Files:**
- Create: `content/standards.json` (copy of the verified scratchpad file)
- Create: `tests/helpers.js`
- Create: `tests/content.test.js`

- [ ] **Step 1: Write helpers**

```js
// tests/helpers.js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }
  };
}

export function readJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

export function fixedClock(startISO = '2026-09-10T10:00:00') {
  let t = new Date(startISO).getTime();
  return { now: () => new Date(t), advanceDays: n => { t += n * 864e5; }, advanceMs: n => { t += n; } };
}
```

- [ ] **Step 2: Write the failing content test**

```js
// tests/content.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON } from './helpers.js';

test('standards.json has verified K benchmarks', () => {
  const s = readJSON('content/standards.json');
  assert.equal(s.framework, 'Florida B.E.S.T. Kindergarten');
  for (const code of ['ELA.K.F.1.2', 'ELA.K.F.1.3', 'ELA.K.F.1.4', 'ELA.K.R.1.4', 'ELA.K.V.1.3']) {
    assert.ok(s.ela[code], code + ' missing');
    assert.ok(s.ela[code].cpalmsId > 0);
    assert.ok(s.ela[code].text.length > 10);
  }
  for (const code of ['MA.K.NSO.1.1', 'MA.K.NSO.2.2', 'MA.K.NSO.3.1', 'MA.K.AR.1.2', 'MA.K.M.1.3', 'MA.K.DP.1.1', 'MA.K.GR.1.5']) {
    assert.ok(s.math[code], code + ' missing');
  }
  assert.equal(s.ela['ELA.K.R.1.2'], undefined, 'R.1.2 does not exist at K');
});

test('praise.json pools are non-empty and use {name}', () => {
  const p = readJSON('content/praise.json');
  for (const k of ['praise', 'retry', 'greeting', 'reveal']) {
    assert.ok(Array.isArray(p[k]) && p[k].length >= 6, k);
    p[k].forEach(line => assert.ok(line.trim().length > 0));
  }
  assert.ok(p.greeting.some(l => l.includes('{name}')));
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test tests/`
Expected: FAIL, `ENOENT ... content/standards.json`

- [ ] **Step 4: Create content files**

Copy `C:\Users\nkl98\AppData\Local\Temp\claude\...\scratchpad\standards-verified.json` to `content/standards.json` (it is the file produced during the audit; contents are the verified CPALMS benchmarks).

```json
// content/praise.json
{
  "praise": ["Amazing, {name}!", "You did it!", "Wonderful!", "You are so clever!", "Hooray for {name}!", "Beautiful work!", "That is right!", "Super job, {name}!", "You shine like a star!", "Brilliant!", "Yes! Great thinking!", "The whole castle is cheering!"],
  "retry": ["Almost! Look at the glowing one.", "Good try, {name}. Listen again.", "Hmm, not that one. Try the glowing one.", "Nearly! One more time.", "Let's try together, {name}.", "Keep going, you are doing great."],
  "reveal": ["Here it is. Let's remember this one.", "This one! We will see it again soon.", "It's this one. Say it with me.", "Look, {name}, this is the one.", "Good trying. Here is the answer.", "This one. You will get it next time."],
  "greeting": ["Hello, Princess {name}!", "Welcome back, {name}!", "Yay, {name} is here!", "Hello {name}! Let's play!", "The castle missed you, {name}!", "Hi {name}! Ready for fun?", "Princess {name}, your kingdom awaits!", "Hooray! It's {name}!"]
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/`
Expected: 2 pass

- [ ] **Step 6: Commit**

```bash
git add content tests
git commit -q -m "Add verified standards and praise content with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Economy — save, migrate, gems, streak, stars, log

**Files:**
- Create: `shared/economy.js`
- Create: `tests/economy.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/economy.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy, migrate, defaultSave, localDay, starsFromRatio, starRankFromPromotions, SAVE_KEY } from '../shared/economy.js';

test('fresh save has schema 3 and defaults', () => {
  const eco = createEconomy({ storage: memoryStorage() });
  assert.equal(eco.save.schemaVersion, 3);
  assert.equal(eco.save.gems, 0);
  assert.equal(eco.save.child.name, 'Amelia');
});

test('migrate merges missing keys and keeps known ones', () => {
  const s = migrate({ gems: 12, settings: { muted: true } });
  assert.equal(s.gems, 12);
  assert.equal(s.settings.muted, true);
  assert.equal(s.settings.rate, 0.9);
  assert.deepEqual(s.streak, { days: [] });
});

test('corrupt storage falls back to defaults', () => {
  const eco = createEconomy({ storage: memoryStorage({ [SAVE_KEY]: '{not json' }) });
  assert.deepEqual(eco.save.badges, []);
});

test('gems add and spend, persisted', () => {
  const st = memoryStorage();
  const eco = createEconomy({ storage: st });
  eco.addGems(7);
  assert.equal(eco.spendGems(10), false);
  assert.equal(eco.spendGems(5), true);
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).gems, 2);
});

test('streak counts days played and a missed day pauses, never resets', () => {
  const clock = fixedClock();
  const eco = createEconomy({ storage: memoryStorage(), now: clock.now });
  eco.markPlayedToday();
  eco.markPlayedToday();
  assert.equal(eco.streak().count, 1);
  clock.advanceDays(1);
  eco.markPlayedToday();
  clock.advanceDays(3); // missed two days
  eco.markPlayedToday();
  const s = eco.streak();
  assert.equal(s.count, 3);
  assert.equal(s.playedToday, true);
  assert.equal(s.last7.length, 7);
  assert.equal(s.last7[6], true);
  assert.equal(s.last7[5], false);
});

test('stars from first-try ratio', () => {
  assert.equal(starsFromRatio(1), 3);
  assert.equal(starsFromRatio(0.7), 2);
  assert.equal(starsFromRatio(0.2), 1);
  const eco = createEconomy({ storage: memoryStorage() });
  assert.equal(eco.setStars('word-builder', 0.9), 3);
  assert.equal(eco.save.stars['word-builder'], 3);
});

test('star rank from promotions', () => {
  assert.equal(starRankFromPromotions(0), 1);
  assert.equal(starRankFromPromotions(3), 2);
  assert.equal(starRankFromPromotions(30), 5);
});

test('log is capped to 60 days', () => {
  const clock = fixedClock();
  const eco = createEconomy({ storage: memoryStorage(), now: clock.now });
  eco.logResult({ subskill: 'phonics-encode', ok: true });
  clock.advanceDays(61);
  eco.logResult({ subskill: 'phonics-encode', ok: false });
  assert.equal(eco.save.log.length, 1);
  assert.equal(eco.save.log[0].ok, false);
});

test('export/import round trip and reject garbage', () => {
  const eco = createEconomy({ storage: memoryStorage() });
  eco.addGems(3);
  const text = eco.exportJSON();
  const eco2 = createEconomy({ storage: memoryStorage() });
  assert.equal(eco2.importJSON(text), true);
  assert.equal(eco2.save.gems, 3);
  assert.equal(eco2.importJSON('nope'), false);
  assert.equal(eco2.importJSON('[1,2]'), false);
});

test('localDay formats local date', () => {
  assert.equal(localDay(new Date(2026, 0, 5)), '2026-01-05');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/economy.test.js`
Expected: FAIL, cannot find module `shared/economy.js`

- [ ] **Step 3: Implement economy**

```js
// shared/economy.js — save/load, gems, stars, badges, day streak, result log.
// DOM-free. Storage is injected so it runs under node --test.
export const SCHEMA_VERSION = 3;
export const SAVE_KEY = 'arcade.v3';
export const LOG_DAYS = 60;

export function localDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lastNDays(dayStr, n) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(localDay(new Date(y, m - 1, d - i)));
  return out;
}

export function defaultSave() {
  return {
    schemaVersion: SCHEMA_VERSION,
    child: { name: 'Amelia', pin: '1234' },
    gems: 0,
    stars: {},
    badges: [],
    streak: { days: [] },
    subskills: {},
    sightWords: {},
    missed: {},
    vocab: {},
    kingdom: { placed: [], gifts: [] },
    quest: null,
    questHistory: [],
    settings: { muted: false, rate: 0.9, voiceName: '', modulesOff: [] },
    log: []
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function migrate(raw) {
  const base = defaultSave();
  if (!isObj(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (!(k in raw)) continue;
    out[k] = isObj(base[k]) && isObj(raw[k]) ? { ...base[k], ...raw[k] } : raw[k];
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

export function starsFromRatio(r) { return r >= 0.85 ? 3 : r >= 0.6 ? 2 : 1; }
export function starRankFromPromotions(n) { return Math.min(5, 1 + Math.floor(n / 3)); }

export function createEconomy({ storage, key = SAVE_KEY, now = () => new Date() } = {}) {
  let save = load();

  function load() {
    try { return migrate(JSON.parse(storage.getItem(key) || 'null')); }
    catch { return defaultSave(); }
  }
  function persist() { try { storage.setItem(key, JSON.stringify(save)); } catch (e) { console.warn('save failed', e); } }
  function today() { return localDay(now()); }
  function trimLog() {
    const cutoff = localDay(new Date(now().getTime() - LOG_DAYS * 864e5));
    save.log = save.log.filter(e => e.day >= cutoff);
  }

  const api = {
    get save() { return save; },
    persist,
    today,
    addGems(n) { save.gems += n; persist(); return save.gems; },
    spendGems(n) { if (save.gems < n) return false; save.gems -= n; persist(); return true; },
    markPlayedToday() {
      const d = today();
      if (!save.streak.days.includes(d)) { save.streak.days.push(d); persist(); }
      return api.streak();
    },
    streak() {
      const days = save.streak.days;
      const d = today();
      return { count: days.length, playedToday: days.includes(d), last7: lastNDays(d, 7).map(x => days.includes(x)) };
    },
    setStars(cabinetId, ratio) { const s = starsFromRatio(ratio); save.stars[cabinetId] = s; persist(); return s; },
    starRank(subskillIds) {
      let promos = 0;
      for (const id of subskillIds) promos += (save.subskills[id] && save.subskills[id].promotions) || 0;
      return starRankFromPromotions(promos);
    },
    logResult({ subskill, ok, firstTry = true }) {
      save.log.push({ day: today(), subskill, ok: !!ok, firstTry: !!firstTry });
      trimLog();
      persist();
    },
    awardBadge(id) { if (save.badges.includes(id)) return false; save.badges.push(id); persist(); return true; },
    exportJSON() { return JSON.stringify(save, null, 2); },
    importJSON(text) {
      try {
        const parsed = JSON.parse(text);
        if (!isObj(parsed)) return false;
        save = migrate(parsed); persist(); return true;
      } catch { return false; }
    },
    reset() { save = defaultSave(); persist(); }
  };
  return api;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/economy.test.js`
Expected: 10 pass

- [ ] **Step 5: Commit**

```bash
git add shared/economy.js tests/economy.test.js
git commit -q -m "Add economy: versioned save, gems, pause-only streak, stars, log

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Adaptive engine

**Files:**
- Create: `shared/adaptive.js`
- Create: `tests/adaptive.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/adaptive.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStorage, fixedClock } from './helpers.js';
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, diffDays } from '../shared/adaptive.js';

function setup() {
  const clock = fixedClock();
  const economy = createEconomy({ storage: memoryStorage(), now: clock.now });
  return { clock, economy, adaptive: createAdaptive({ economy }) };
}

test('subskill table has 14 entries with stages and cabinets', () => {
  assert.equal(SUBSKILLS.length, 14);
  SUBSKILLS.forEach(s => { assert.ok(s.stages.length >= 2, s.id); assert.ok(s.cabinet); assert.ok([1, 2, 3].includes(s.tier)); });
});

test('promotes after 8 of last 10 first-try correct', () => {
  const { adaptive } = setup();
  let res;
  for (let i = 0; i < 10; i++) res = adaptive.record({ subskill: 'phonics-encode', ok: i !== 3 && i !== 7 });
  assert.equal(res.promoted, true);
  assert.equal(adaptive.stage('phonics-encode'), 'b');
  assert.equal(adaptive.stageIndex('phonics-encode'), 1);
});

test('does not promote at 7 of 10', () => {
  const { adaptive } = setup();
  let res;
  for (let i = 0; i < 10; i++) res = adaptive.record({ subskill: 'phonics-encode', ok: i > 2 });
  assert.equal(res.promoted, false);
  assert.equal(adaptive.stage('phonics-encode'), 'a');
});

test('retries and 2-choice items never enter the window', () => {
  const { adaptive, economy } = setup();
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'add-sub', ok: true, retry: true });
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'add-sub', ok: true, choices: 2 });
  assert.equal(economy.save.subskills['add-sub'].window.length, 0);
  assert.equal(economy.save.log.length, 20, 'still logged for the dashboard');
});

test('demotes only when 4 misses span two days', () => {
  const { adaptive, clock, economy } = setup();
  economy.save.subskills['measure'] = { stage: 2, window: [], lastPracticed: null, promotions: 0 };
  let res;
  for (let i = 0; i < 4; i++) res = adaptive.record({ subskill: 'measure', ok: false });
  assert.equal(res.demoted, false, 'same day');
  clock.advanceDays(1);
  res = adaptive.record({ subskill: 'measure', ok: false });
  assert.equal(res.demoted, true);
  assert.equal(adaptive.stageIndex('measure'), 1);
  assert.equal(economy.save.subskills['measure'].window.length, 0);
});

test('stage never drops below 0 or above max', () => {
  const { adaptive, clock } = setup();
  for (let i = 0; i < 4; i++) adaptive.record({ subskill: 'shapes', ok: false });
  clock.advanceDays(1);
  adaptive.record({ subskill: 'shapes', ok: false });
  assert.equal(adaptive.stageIndex('shapes'), 0);
  for (let round = 0; round < 6; round++) for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'shapes', ok: true });
  assert.equal(adaptive.stageIndex('shapes'), 2);
});

test('accuracy uses last 20 log rows; null when unpracticed', () => {
  const { adaptive } = setup();
  assert.equal(adaptive.accuracy('pa-sounds'), null);
  for (let i = 0; i < 30; i++) adaptive.record({ subskill: 'pa-sounds', ok: i >= 10 });
  assert.equal(adaptive.accuracy('pa-sounds'), 1);
});

test('missed items feed the trouble list at 3', () => {
  const { adaptive } = setup();
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  assert.deepEqual(adaptive.troubleList(), []);
  adaptive.record({ subskill: 'phonics-encode', ok: false, itemId: 'cat' });
  assert.deepEqual(adaptive.troubleList(), [{ id: 'cat', count: 3 }]);
});

test('quest picks the weakest, stalest tier-1 cabinet and avoids three days running', () => {
  const { adaptive, clock, economy } = setup();
  for (let i = 0; i < 10; i++) {
    for (const id of adaptive.tier1Ids()) adaptive.record({ subskill: id, ok: id !== 'measure' });
  }
  let q = adaptive.todayQuest();
  assert.equal(q.requiredCabinet, 'measure-sort');
  assert.equal(q.date, economy.today());
  clock.advanceDays(1);
  q = adaptive.todayQuest();
  assert.equal(q.requiredCabinet, 'measure-sort');
  clock.advanceDays(1);
  q = adaptive.todayQuest();
  assert.notEqual(q.requiredCabinet, 'measure-sort', 'third day in a row is excluded');
});

test('unpracticed subskills are picked first', () => {
  const { adaptive } = setup();
  for (let i = 0; i < 10; i++) adaptive.record({ subskill: 'phonics-encode', ok: true });
  const q = adaptive.todayQuest();
  assert.notEqual(q.requiredCabinet, 'word-builder');
});

test('quest completes with required plus a different choice, then claims once', () => {
  const { adaptive, economy } = setup();
  const q = adaptive.todayQuest();
  const other = q.requiredCabinet === 'word-builder' ? 'sound-garden' : 'word-builder';
  adaptive.noteRoundFinished(q.requiredCabinet);
  assert.equal(adaptive.claimQuest(), false);
  adaptive.noteRoundFinished(other);
  assert.equal(adaptive.todayQuest().choiceDone, true);
  assert.equal(adaptive.claimQuest(), true);
  assert.equal(economy.save.gems, 10);
  assert.equal(adaptive.claimQuest(), false);
  assert.equal(economy.streak().playedToday, true);
});

test('diffDays', () => { assert.equal(diffDays('2026-09-01', '2026-09-10'), 9); });
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/adaptive.test.js`
Expected: FAIL, cannot find module

- [ ] **Step 3: Implement adaptive**

```js
// shared/adaptive.js — per-sub-skill difficulty windows, quest picker, missed items.
// DOM-free; depends only on an economy instance for save/persist/today.
export const SUBSKILLS = [
  { id: 'phonics-encode',    strand: 'ELA.K.F.1.3', cabinet: 'word-builder',   tier: 1, name: 'Phonics: build words',  stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'phonics-decode',    strand: 'ELA.K.F.1.3', cabinet: 'word-builder',   tier: 1, name: 'Phonics: read words',   stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'pa-sounds',         strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Hearing sounds',        stages: ['first', 'final', 'medial'] },
  { id: 'pa-blend-segment',  strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Blend and segment',     stages: ['short', 'long'] },
  { id: 'pa-manipulate',     strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Change sounds',         stages: ['delete', 'swap'] },
  { id: 'subitize-tenframe', strand: 'MA.K.NSO.1.1', cabinet: 'number-kingdom', tier: 1, name: 'See how many',          stages: ['small', 'structured', 'make10'] },
  { id: 'teen-compare',      strand: 'MA.K.NSO.2.2', cabinet: 'number-kingdom', tier: 1, name: 'Teens and compare',     stages: ['teens', 'compare', 'numberline'] },
  { id: 'add-sub',           strand: 'MA.K.NSO.3.1', cabinet: 'number-kingdom', tier: 1, name: 'Add and subtract',      stages: ['within5', 'within10', 'related'] },
  { id: 'count-sequence',    strand: 'MA.K.NSO.2.1', cabinet: 'number-kingdom', tier: 2, name: 'Counting on',           stages: ['ones', 'tens', 'backward'] },
  { id: 'decompose-stories', strand: 'MA.K.AR.1.2', cabinet: 'number-stories', tier: 2, name: 'Number stories',        stages: ['bonds', 'decompose', 'problems', 'truefalse'] },
  { id: 'measure',           strand: 'MA.K.M.1.2',  cabinet: 'measure-sort',   tier: 1, name: 'Measuring',             stages: ['attribute', 'compare', 'order', 'units'] },
  { id: 'data-sort',         strand: 'MA.K.DP.1.1', cabinet: 'measure-sort',   tier: 1, name: 'Sorting and data',      stages: ['two', 'three', 'chart'] },
  { id: 'shapes',            strand: 'MA.K.GR.1.1', cabinet: 'measure-sort',   tier: 2, name: 'Shapes',                stages: ['2d', '3d', 'compose'] },
  { id: 'comprehension',     strand: 'ELA.K.R.1.1', cabinet: 'story-garden',   tier: 3, name: 'Understanding stories', stages: ['literary', 'informational', 'poems'] }
];

export const WINDOW = 10;
export const PROMOTE_AT = 8;
export const DEMOTE_AT = 4;
export const MIN_CHOICES = 3;
export const QUEST_GEMS = 10;

export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5);
}

export function createAdaptive({ economy }) {
  const save = () => economy.save;
  function def(id) {
    const d = SUBSKILLS.find(s => s.id === id);
    if (!d) throw new Error('Unknown subskill ' + id);
    return d;
  }
  function entry(id) {
    def(id);
    const s = save();
    if (!s.subskills[id]) s.subskills[id] = { stage: 0, window: [], lastPracticed: null, promotions: 0 };
    return s.subskills[id];
  }

  const api = {
    defs: () => SUBSKILLS,
    tier1Ids: () => SUBSKILLS.filter(s => s.tier === 1).map(s => s.id),
    stage: id => def(id).stages[entry(id).stage],
    stageIndex: id => entry(id).stage,

    record({ subskill, ok, choices = 3, retry = false, itemId = null }) {
      const e = entry(subskill);
      const day = economy.today();
      e.lastPracticed = day;
      economy.logResult({ subskill, ok, firstTry: !retry });
      if (!ok && itemId) api.noteMiss(itemId);
      const result = { promoted: false, demoted: false };
      if (retry || choices < MIN_CHOICES) { economy.persist(); return result; }
      e.window.push({ ok: !!ok, day });
      if (e.window.length > WINDOW) e.window.shift();
      const oks = e.window.filter(w => w.ok).length;
      const misses = e.window.filter(w => !w.ok);
      const missDays = new Set(misses.map(w => w.day)).size;
      const maxStage = def(subskill).stages.length - 1;
      if (e.window.length === WINDOW && oks >= PROMOTE_AT) {
        if (e.stage < maxStage) e.stage++;
        e.promotions++;
        e.window = [];
        result.promoted = true;
      } else if (misses.length >= DEMOTE_AT && missDays >= 2) {
        if (e.stage > 0) e.stage--;
        e.window = [];
        result.demoted = true;
      }
      economy.persist();
      return result;
    },

    accuracy(id, n = 20) {
      const rows = save().log.filter(r => r.subskill === id).slice(-n);
      if (!rows.length) return null;
      return rows.filter(r => r.ok).length / rows.length;
    },
    daysSince(id) {
      const e = save().subskills[id];
      if (!e || !e.lastPracticed) return null;
      return diffDays(e.lastPracticed, economy.today());
    },
    itemsOnDay(id, day) { return save().log.filter(r => r.subskill === id && r.day === day).length; },

    noteMiss(itemId) {
      const s = save();
      s.missed[itemId] = (s.missed[itemId] || 0) + 1;
      return s.missed[itemId];
    },
    troubleList(min = 3) {
      return Object.entries(save().missed)
        .filter(([, c]) => c >= min)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count);
    },

    pickQuestCabinet(availableCabinets = null) {
      const s = save();
      const recent = s.questHistory.slice(-2).map(q => q.cabinet);
      const excluded = recent.length === 2 && recent[0] === recent[1] ? recent[0] : null;
      const scored = [];
      for (const sk of SUBSKILLS.filter(x => x.tier === 1)) {
        if (availableCabinets && !availableCabinets.includes(sk.cabinet)) continue;
        const acc = api.accuracy(sk.id);
        const ds = api.daysSince(sk.id);
        const stale = ds === null ? 0.5 : Math.min(0.5, ds * 0.1);
        scored.push({ cabinet: sk.cabinet, subskill: sk.id, score: (1 - (acc ?? 0)) + stale });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.find(x => x.cabinet !== excluded) || scored[0] || { cabinet: 'word-builder', subskill: 'phonics-encode', score: 0 };
    },

    todayQuest(availableCabinets = null) {
      const s = save();
      const day = economy.today();
      if (!s.quest || s.quest.date !== day) {
        const pick = api.pickQuestCabinet(availableCabinets);
        s.quest = { date: day, requiredCabinet: pick.cabinet, requiredSubskill: pick.subskill, requiredDone: false, choiceCabinet: null, choiceDone: false, claimed: false };
        s.questHistory.push({ date: day, cabinet: pick.cabinet });
        s.questHistory = s.questHistory.slice(-14);
        economy.persist();
      }
      return s.quest;
    },

    noteRoundFinished(cabinetId) {
      const q = api.todayQuest();
      if (cabinetId === q.requiredCabinet) q.requiredDone = true;
      else if (!q.choiceDone) { q.choiceCabinet = cabinetId; q.choiceDone = true; }
      economy.markPlayedToday();
      economy.persist();
      return q;
    },

    claimQuest() {
      const q = api.todayQuest();
      if (q.claimed || !(q.requiredDone && q.choiceDone)) return false;
      q.claimed = true;
      economy.addGems(QUEST_GEMS);
      economy.markPlayedToday();
      return true;
    }
  };
  return api;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/adaptive.test.js`
Expected: 12 pass

- [ ] **Step 5: Commit**

```bash
git add shared/adaptive.js tests/adaptive.test.js
git commit -q -m "Add adaptive engine: windows, promote/demote, quest picker, trouble list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Content loader and session clock

**Files:**
- Create: `shared/content.js`, `shared/session.js`
- Create: `tests/content-loader.test.js`, `tests/session.test.js`

- [ ] **Step 1: Write failing tests**

```js
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
```

```js
// tests/session.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClock } from '../shared/session.js';

test('accumulates active time between touches, ignores long idle gaps', () => {
  let t = 0;
  const clock = createSessionClock({ now: () => t, idleGapMs: 60000, limitMs: 600000 });
  clock.touch(); t += 30000; clock.touch();
  assert.equal(clock.activeMs(), 30000);
  t += 120000; clock.touch();
  assert.equal(clock.activeMs(), 30000, 'idle gap not counted');
});

test('due fires once at the limit', () => {
  let t = 0;
  const clock = createSessionClock({ now: () => t, idleGapMs: 60000, limitMs: 100000 });
  clock.touch();
  for (let i = 0; i < 5; i++) { t += 30000; clock.touch(); }
  assert.equal(clock.due(), true);
  assert.equal(clock.due(), false);
  clock.reset();
  assert.equal(clock.activeMs(), 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/content-loader.test.js tests/session.test.js`
Expected: FAIL, cannot find modules

- [ ] **Step 3: Implement**

```js
// shared/content.js — fetch-once JSON loader. All game content lives in /content/*.json.
export function createContentLoader({ fetchImpl = u => globalThis.fetch(u), base = './content/' } = {}) {
  const cache = new Map();
  return {
    load(name) {
      if (!cache.has(name)) {
        const p = fetchImpl(base + name + '.json')
          .then(r => { if (!r.ok) throw new Error('Missing content ' + name); return r.json(); })
          .then(j => { if (!j || typeof j !== 'object') throw new Error('Bad content ' + name); return j; })
          .catch(e => { cache.delete(name); throw e; });
        cache.set(name, p);
      }
      return cache.get(name);
    }
  };
}
```

```js
// shared/session.js — pure active-time clock behind the "One more or all done?" shaper.
export function createSessionClock({ now = () => Date.now(), idleGapMs = 60000, limitMs = 10 * 60000 } = {}) {
  let active = 0, last = null, fired = false;
  return {
    touch() {
      const t = now();
      if (last !== null && t - last < idleGapMs) active += t - last;
      last = t;
      return active;
    },
    activeMs: () => active,
    due() { if (!fired && active >= limitMs) { fired = true; return true; } return false; },
    reset() { active = 0; last = null; fired = false; }
  };
}
```

- [ ] **Step 4: Run all tests**

Run: `node --test tests/`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add shared/content.js shared/session.js tests/content-loader.test.js tests/session.test.js
git commit -q -m "Add content loader and session clock

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Theme CSS

**Files:**
- Create: `shared/theme.css`

- [ ] **Step 1: Write the stylesheet**

```css
/* shared/theme.css — Amelia's Arcade tokens and components. Single column, ≥64px targets. */
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
:root {
  --font: 'Segoe UI Rounded', 'Nunito', 'Trebuchet MS', 'Comic Sans MS', ui-rounded, sans-serif;
  --bg: #fdf2f8; --bg2: #ede9fe; --card: #ffffff; --ink: #3b0764; --ink-soft: #6b21a8;
  --purple: #7c3aed; --pink: #ec4899; --gold: #f59e0b; --green: #22c55e; --sky: #38bdf8;
  --shadow: 0 6px 18px rgba(124, 58, 237, 0.18);
  --radius: 22px; --tap: 64px; --bar: 64px;
}
html, body { height: 100%; }
body { font-family: var(--font); background: linear-gradient(170deg, var(--bg), var(--bg2)); color: var(--ink); user-select: none; -webkit-user-select: none; overflow-x: hidden; }
button { font-family: inherit; font-size: inherit; color: inherit; border: none; background: none; cursor: pointer; }
[hidden] { display: none !important; }

/* Layout */
#topbar { position: fixed; top: 0; left: 0; right: 0; height: var(--bar); display: flex; align-items: center; gap: 8px; padding: 0 10px; background: linear-gradient(90deg, #7c3aed, #a855f7); color: #fff; z-index: 50; box-shadow: 0 3px 12px rgba(0,0,0,0.15); }
#topbar .title { flex: 1; text-align: center; font-weight: 800; font-size: 20px; color: #fde68a; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
.bar-btn { min-width: 52px; min-height: 52px; border-radius: 16px; background: rgba(255,255,255,0.2); font-size: 26px; display: flex; align-items: center; justify-content: center; }
.bar-btn:active { transform: scale(0.94); }
.gems { min-height: 52px; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,0.2); font-weight: 800; font-size: 20px; display: flex; align-items: center; gap: 6px; }
main { padding: calc(var(--bar) + 14px) 14px 40px; max-width: 560px; margin: 0 auto; }

/* Splash */
#splash { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: linear-gradient(170deg, #fdf2f8, #ddd6fe); }
#splash .crown { font-size: 120px; animation: floaty 3s ease-in-out infinite; }
#splash h1 { font-size: 30px; color: var(--ink); text-align: center; }

/* Buttons */
.big-btn { min-height: var(--tap); padding: 12px 28px; border-radius: var(--radius); background: linear-gradient(135deg, var(--purple), var(--pink)); color: #fff; font-size: 24px; font-weight: 800; box-shadow: var(--shadow); }
.big-btn.soft { background: #fff; color: var(--ink); border: 3px solid #e9d5ff; }
.big-btn:active { transform: scale(0.96); }
.speak-btn { min-width: var(--tap); min-height: var(--tap); border-radius: 50%; background: #fff; border: 3px solid #e9d5ff; font-size: 30px; box-shadow: var(--shadow); }

/* Home */
.home-head { text-align: center; margin-bottom: 14px; }
.home-head .hello { font-size: 26px; font-weight: 800; }
.home-head .rank { font-size: 28px; letter-spacing: 2px; margin-top: 4px; }
.streak { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; font-size: 22px; }
.streak .dot { width: 18px; height: 18px; border-radius: 50%; background: #e9d5ff; display: inline-block; }
.streak .dot.on { background: var(--gold); box-shadow: 0 0 6px var(--gold); }
.quest { display: flex; align-items: center; gap: 12px; background: #fff7ed; border: 3px solid #fdba74; border-radius: var(--radius); padding: 12px 14px; margin-bottom: 16px; box-shadow: var(--shadow); }
.quest .icon { font-size: 44px; }
.quest .text { flex: 1; font-weight: 800; font-size: 18px; }
.quest .stars { font-size: 22px; }
.quest .claim { min-height: var(--tap); padding: 0 18px; border-radius: 18px; background: linear-gradient(135deg, var(--gold), #f97316); color: #fff; font-weight: 900; font-size: 20px; animation: pulse 1.2s ease-in-out infinite; }
.cabinets { display: flex; flex-direction: column; gap: 14px; }
.cabinet { display: flex; align-items: center; gap: 16px; min-height: 96px; padding: 12px 18px; background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); border: 3px solid transparent; text-align: left; width: 100%; }
.cabinet:active { transform: scale(0.98); border-color: #c4b5fd; }
.cabinet .icon { font-size: 52px; width: 64px; text-align: center; }
.cabinet .name { font-size: 22px; font-weight: 800; flex: 1; }
.cabinet .stars { font-size: 20px; }
.cabinet.soon { opacity: 0.55; }

/* Activity screens */
.activity { display: flex; flex-direction: column; gap: 16px; align-items: stretch; }
.prompt { display: flex; align-items: center; gap: 12px; background: var(--card); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow); font-size: 22px; font-weight: 700; }
.prompt .text { flex: 1; }
.picture { text-align: center; font-size: 96px; line-height: 1.1; min-height: 110px; }
.picture svg { width: 110px; height: 110px; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.choices.one-col { grid-template-columns: 1fr; }
.choice { min-height: 96px; background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); border: 4px solid transparent; font-size: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; transition: transform 0.15s, border-color 0.2s, opacity 0.3s; }
.choice .label { font-size: 22px; font-weight: 800; }
.choice:active { transform: scale(0.96); }
.choice.dim { opacity: 0.35; filter: grayscale(0.6); }
.choice.glow { border-color: var(--gold); animation: glow 1s ease-in-out infinite; }
.choice.right { border-color: var(--green); background: #f0fdf4; }
.choice[disabled] { pointer-events: none; }
.round-dots { display: flex; justify-content: center; gap: 8px; font-size: 22px; }
.round-dots span { opacity: 0.3; }
.round-dots span.done { opacity: 1; }
.word { display: inline-block; padding: 2px 4px; border-radius: 8px; font: inherit; color: inherit; }
.word:active, .word.now { background: #fde68a; }
.tile { min-width: 72px; min-height: 80px; border-radius: 18px; background: #fff; border: 4px solid #ddd6fe; font-size: 40px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center; box-shadow: var(--shadow); touch-action: none; }
.tile.picked { border-color: var(--purple); background: #f5f3ff; }
.slot { min-width: 72px; min-height: 80px; border-radius: 18px; border: 4px dashed #c4b5fd; display: inline-flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 900; }
.slot.filled { border-style: solid; background: #fff; }
.row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

/* Overlays */
.overlay { position: fixed; inset: 0; z-index: 80; background: rgba(59, 7, 100, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sheet { background: #fff; border-radius: 28px; padding: 24px; width: min(100%, 420px); text-align: center; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); animation: pop 0.35s ease-out; }
.sheet h2 { font-size: 26px; }
.sheet .big-emoji { font-size: 72px; }
.bubble { width: 180px; height: 180px; border-radius: 50%; margin: 0 auto; background: radial-gradient(circle at 35% 35%, #e0f2fe, #38bdf8); box-shadow: 0 0 40px rgba(56, 189, 248, 0.6); transition: transform 4s ease-in-out; transform: scale(0.6); }
.bubble.in { transform: scale(1.15); }
.bubble.out { transform: scale(0.6); }
.pin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pin-key { min-height: var(--tap); border-radius: 16px; background: #f3e8ff; font-size: 26px; font-weight: 800; }
.pin-dots { font-size: 30px; letter-spacing: 8px; min-height: 40px; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 12px 20px; border-radius: 16px; font-weight: 700; z-index: 90; animation: pop 0.3s ease-out; }
.confetti { position: fixed; top: -12px; z-index: 95; pointer-events: none; font-size: 16px; animation: fall linear forwards; }

/* Keyframes */
@keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes pop { 0% { transform: scale(0.7); opacity: 0; } 70% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
@keyframes glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); } 50% { box-shadow: 0 0 24px 8px rgba(245, 158, 11, 0.35); } }
@keyframes fall { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }

@media (min-width: 768px) { main { max-width: 640px; } .picture { font-size: 120px; } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 2: Commit**

```bash
git add shared/theme.css
git commit -q -m "Add theme stylesheet with 64px targets and single-column layout

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Speech wrapper

**Files:**
- Create: `shared/speech.js`

Browser-only; verified in Task 12's preview.

- [ ] **Step 1: Write speech.js**

```js
// shared/speech.js — Web Speech wrapper. No name lists, no pause/resume hack on mobile,
// no boundary events (unsupported on Android). speak() returns a promise that resolves on end.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function isMobile() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }

export function createSpeech({ settings, onChange = () => {} }) {
  const synth = globalThis.speechSynthesis;
  let voice = null;
  let seq = 0;

  function englishVoices() { return synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
  function pickVoice() {
    const en = englishVoices();
    if (!en.length) return;
    const byName = settings.voiceName && en.find(v => v.name === settings.voiceName);
    voice = byName
      || en.find(v => v.localService && /en[-_]US/i.test(v.lang))
      || en.find(v => /en[-_]US/i.test(v.lang))
      || en.find(v => v.localService)
      || en[0];
  }
  if (synth) { synth.addEventListener('voiceschanged', pickVoice); pickVoice(); }

  function clean(t) { return String(t).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim(); }
  function chunks(t) { return clean(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || []; }

  function utter(text, rate) {
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = 1.05; u.lang = 'en-US';
      if (voice) u.voice = voice;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
      u.onend = finish; u.onerror = finish;
      const guard = setTimeout(finish, 1500 + text.length * 120);
      synth.speak(u);
    });
  }

  const api = {
    get muted() { return !!settings.muted; },
    setMuted(b) { settings.muted = !!b; if (b) api.stop(); onChange(); },
    toggleMuted() { api.setMuted(!settings.muted); return settings.muted; },
    activate() { if (!synth) return; pickVoice(); try { synth.resume(); } catch {} },
    voices: () => englishVoices().map(v => ({ name: v.name, lang: v.lang, local: v.localService })),
    setVoice(name) { settings.voiceName = name || ''; pickVoice(); onChange(); },
    stop() { seq++; if (synth) synth.cancel(); },
    async speak(text, { interrupt = true, rate = settings.rate || 0.9 } = {}) {
      if (!synth || settings.muted) return;
      if (interrupt) api.stop();
      const my = ++seq;
      for (const c of chunks(text)) {
        if (my !== seq) return;
        await utter(c, rate);
      }
    },
    speakWord(word) { return api.speak(word, { interrupt: true, rate: 0.85 }); },
    // Builds tappable word spans. Each tap speaks that word alone.
    wordSpans(text) {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(part => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const b = document.createElement('button');
        b.className = 'word'; b.type = 'button'; b.textContent = part;
        b.addEventListener('click', e => { e.stopPropagation(); api.speakWord(part.replace(/[^\w']/g, '')); });
        frag.appendChild(b);
      });
      return frag;
    }
  };
  return api;
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/speech.js
git commit -q -m "Add speech wrapper with lang-based voice pick and tappable words

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: UI kit

**Files:**
- Create: `shared/ui.js`

- [ ] **Step 1: Write ui.js**

```js
// shared/ui.js — DOM builders and the scaffolded choice grid every cabinet uses.
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const withName = (t, name) => t.replace(/\{name\}/g, name);

export function bigButton(label, onTap, cls = '') {
  return el('button', { class: 'big-btn ' + cls, type: 'button', onclick: onTap, text: label });
}
export function speakButton(speech, text) {
  return el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Hear it again', text: '🔊', onclick: () => speech.speak(text) });
}
export function promptBar(speech, text) {
  const t = el('div', { class: 'text' });
  t.appendChild(speech.wordSpans(text));
  return el('div', { class: 'prompt' }, [t, speakButton(speech, text)]);
}
export function picture(pic) {
  const p = el('div', { class: 'picture' });
  if (pic && pic.svg) p.innerHTML = pic.svg; else p.textContent = pic || '';
  return p;
}
export function roundDots(total, done) {
  return el('div', { class: 'round-dots' }, Array.from({ length: total }, (_, i) => el('span', { class: i < done ? 'done' : '', text: '🌸' })));
}

// Scaffolded choice grid. items: [{ id, pic, label, ok }]. Resolves { firstTry, misses, revealed }.
// Miss 1: tapped choice dims, correct choice glows, prompt re-speaks. Miss 2: reveal + speak answer.
export function choiceGrid({ speech, prompt, items, praise, oneCol = false, revealText = null }) {
  const grid = el('div', { class: 'choices' + (oneCol ? ' one-col' : '') });
  let misses = 0, settled = false;
  const buttons = new Map();
  const done = new Promise(resolve => {
    const finish = async (result) => {
      if (settled) return; settled = true;
      buttons.forEach(b => b.setAttribute('disabled', ''));
      resolve(result);
    };
    for (const it of items) {
      const b = el('button', { class: 'choice', type: 'button', 'data-id': it.id }, [
        it.pic && it.pic.svg ? el('span', { html: it.pic.svg }) : el('span', { text: it.pic || '' }),
        it.label ? el('span', { class: 'label', text: it.label }) : null
      ]);
      buttons.set(it, b);
      b.addEventListener('click', async () => {
        if (settled) return;
        if (it.ok) {
          b.classList.add('right');
          confetti(24);
          if (praise) speech.speak(praise);
          await wait(700);
          finish({ firstTry: misses === 0, misses, revealed: false });
          return;
        }
        misses++;
        b.classList.add('dim');
        b.setAttribute('disabled', '');
        const correct = items.find(x => x.ok);
        if (misses === 1) {
          buttons.get(correct).classList.add('glow');
          speech.speak(prompt);
        } else {
          buttons.get(correct).classList.remove('glow');
          buttons.get(correct).classList.add('right');
          await speech.speak(revealText || ('It is ' + (correct.label || correct.say || 'this one') + '.'));
          await wait(600);
          finish({ firstTry: false, misses, revealed: true });
        }
      });
      grid.appendChild(b);
    }
  });
  return { el: grid, done };
}

export function confetti(count = 40) {
  const colors = ['#ec4899', '#a855f7', '#38bdf8', '#22c55e', '#f59e0b', '#f43f5e'];
  const shapes = ['●', '■', '▲', '★', '♥', '✦'];
  for (let i = 0; i < count; i++) {
    const c = el('div', { class: 'confetti', text: pick(shapes) });
    c.style.left = Math.random() * 100 + '%';
    c.style.color = pick(colors);
    c.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

export function toast(text, ms = 2200) {
  const t = el('div', { class: 'toast', text });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Modal sheet. Returns the overlay; caller removes it.
export function sheet(children) {
  const o = el('div', { class: 'overlay' }, [el('div', { class: 'sheet' }, children)]);
  document.body.appendChild(o);
  return o;
}

// Breathing bubble used by the session exit and later by Calm Castle. cycles of in/out, animation only.
export async function breathingBubble(speech, { cycles = 3, inMs = 4000, outMs = 4000 } = {}) {
  const bubble = el('div', { class: 'bubble' });
  const label = el('h2', { text: 'Breathe in' });
  const o = sheet([label, bubble]);
  for (let i = 0; i < cycles; i++) {
    label.textContent = 'Breathe in'; speech.speak('Breathe in');
    await wait(50); bubble.classList.remove('out'); bubble.classList.add('in');
    await wait(inMs);
    label.textContent = 'Breathe out'; speech.speak('Breathe out');
    bubble.classList.remove('in'); bubble.classList.add('out');
    await wait(outMs);
  }
  o.remove();
}

// Runs a round of items through choiceGrid, records to adaptive, re-presents second misses two turns later.
// makeItem(item) → { prompt, pic, choices:[{id,pic,label,ok}], praise, subskill, itemId, choices count }
export async function runRound({ root, speech, adaptive, economy, praiseLines, name, items, makeItem, cabinetId }) {
  const queue = items.slice();
  let firstTries = 0, total = 0, index = 0;
  const retried = new Set();
  while (queue.length) {
    const item = queue.shift();
    const spec = makeItem(item);
    root.replaceChildren(
      roundDots(items.length, Math.min(items.length, index)),
      promptBar(speech, spec.prompt),
      spec.pic !== undefined ? picture(spec.pic) : el('div'),
    );
    const grid = choiceGrid({ speech, prompt: spec.prompt, items: spec.choices, praise: withName(pick(praiseLines), name), revealText: spec.revealText, oneCol: spec.oneCol });
    root.appendChild(grid.el);
    await speech.speak(spec.prompt);
    const r = await grid.done;
    const isRetry = retried.has(spec.itemId);
    adaptive.record({ subskill: spec.subskill, ok: r.firstTry, choices: spec.choices.length, retry: isRetry, itemId: spec.itemId });
    if (!isRetry) { total++; if (r.firstTry) firstTries++; index++; }
    if (r.revealed && !isRetry) { retried.add(spec.itemId); queue.splice(Math.min(2, queue.length), 0, item); }
  }
  const ratio = total ? firstTries / total : 1;
  const stars = economy.setStars(cabinetId, ratio);
  adaptive.noteRoundFinished(cabinetId);
  return { stars, ratio };
}

export function roundCelebration(speech, stars, onDone) {
  const o = sheet([
    el('div', { class: 'big-emoji', text: '🎉' }),
    el('h2', { text: 'Round done!' }),
    el('div', { class: 'rank', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) }),
    bigButton('Yay!', () => { o.remove(); onDone(); })
  ]);
  confetti(50);
  speech.speak('Round done! ' + (stars === 3 ? 'Three stars!' : stars === 2 ? 'Two stars!' : 'One star, and you kept going!'));
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/ui.js
git commit -q -m "Add UI kit: scaffolded choice grid, round runner, confetti, bubble

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Registry and the temporary Try It cabinet

**Files:**
- Create: `games/registry.js`
- Create: `games/princess-quest/try-it.js`

- [ ] **Step 1: Write the registry**

```js
// games/registry.js — every cabinet on the home screen. Adding a game = add an entry + its folder.
// `ready: false` shows a 🌱 card that says "coming soon" until the module ships.
export const REGISTRY = [
  { id: 'try-it',          group: 'princess-quest', name: 'Try It',              icon: '🎈', strands: ['ELA.K.F.1.2'], subskills: ['pa-sounds'],                  entry: './games/princess-quest/try-it.js',          minTier: 1, ready: true },
  { id: 'word-builder',    group: 'princess-quest', name: 'Word Builder',        icon: '📚', strands: ['ELA.K.F.1.3'], subskills: ['phonics-encode', 'phonics-decode'], entry: './games/princess-quest/word-builder.js',    minTier: 1, ready: false },
  { id: 'sound-garden',    group: 'princess-quest', name: 'Sound Garden',        icon: '🌻', strands: ['ELA.K.F.1.2'], subskills: ['pa-sounds', 'pa-blend-segment', 'pa-manipulate'], entry: './games/princess-quest/sound-garden.js', minTier: 1, ready: false },
  { id: 'sight-words',     group: 'princess-quest', name: 'Sight Word Meadow',   icon: '🌷', strands: ['ELA.K.F.1.4'], subskills: [],                               entry: './games/princess-quest/sight-words.js',     minTier: 1, ready: false },
  { id: 'number-kingdom',  group: 'princess-quest', name: 'Number Kingdom',      icon: '🧮', strands: ['MA.K.NSO.1.1', 'MA.K.NSO.2.1', 'MA.K.NSO.3.1'], subskills: ['subitize-tenframe', 'teen-compare', 'add-sub', 'count-sequence'], entry: './games/princess-quest/number-kingdom.js', minTier: 1, ready: false },
  { id: 'number-stories',  group: 'princess-quest', name: 'Number Stories',      icon: '🔷', strands: ['MA.K.AR.1.2'], subskills: ['decompose-stories'],            entry: './games/princess-quest/number-stories.js',  minTier: 2, ready: false },
  { id: 'measure-sort',    group: 'princess-quest', name: 'Measure, Sort & Shapes', icon: '📏', strands: ['MA.K.M.1.2', 'MA.K.DP.1.1', 'MA.K.GR.1.1'], subskills: ['measure', 'data-sort', 'shapes'], entry: './games/princess-quest/measure-sort.js', minTier: 1, ready: false },
  { id: 'story-garden',    group: 'princess-quest', name: 'Story Garden',        icon: '📖', strands: ['ELA.K.R.1.1', 'ELA.K.V.1.3'], subskills: ['comprehension'], entry: './games/princess-quest/story-garden.js',    minTier: 3, ready: false },
  { id: 'calm-castle',     group: 'princess-quest', name: 'Calm Castle',         icon: '🫧', strands: [], subskills: [],                                           entry: './games/princess-quest/calm-castle.js',     minTier: 1, ready: false },
  { id: 'uh-oh',           group: 'princess-quest', name: 'Uh-Oh Academy',       icon: '🤗', strands: [], subskills: [],                                           entry: './games/princess-quest/uh-oh.js',           minTier: 1, ready: false },
  { id: 'kingdom-builder', group: 'princess-quest', name: 'Kingdom Builder',     icon: '🏰', strands: [], subskills: [],                                           entry: './games/princess-quest/kingdom-builder.js', minTier: 1, ready: false }
];
```

- [ ] **Step 2: Write the Try It cabinet (first-sound picture game, 5 items)**

```js
// games/princess-quest/try-it.js — temporary Step 1 demo: "Which one starts with /m/?" Removed in Step 2.
import { el, runRound, roundCelebration } from '../../shared/ui.js';

const ITEMS = [
  { id: 'm', sound: 'mmm', ok: { pic: '🌙', word: 'moon' }, others: [{ pic: '☀️', word: 'sun' }, { pic: '🐱', word: 'cat' }] },
  { id: 's', sound: 'sss', ok: { pic: '☀️', word: 'sun' }, others: [{ pic: '🐶', word: 'dog' }, { pic: '🎩', word: 'hat' }] },
  { id: 'f', sound: 'fff', ok: { pic: '🐟', word: 'fish' }, others: [{ pic: '🍎', word: 'apple' }, { pic: '🐰', word: 'bunny' }] },
  { id: 'b', sound: 'buh', ok: { pic: '⚽', word: 'ball' }, others: [{ pic: '🌙', word: 'moon' }, { pic: '🍋', word: 'lemon' }] },
  { id: 'p', sound: 'puh', ok: { pic: '🐷', word: 'pig' }, others: [{ pic: '🦊', word: 'fox' }, { pic: '🐢', word: 'turtle' }] }
];

let root = null;

export async function mount(host, ctx) {
  root = el('div', { class: 'activity' });
  host.replaceChildren(root);
  const praise = await ctx.content.load('praise');
  const { stars } = await runRound({
    root, speech: ctx.speech, adaptive: ctx.adaptive, economy: ctx.economy,
    praiseLines: praise.praise, name: ctx.economy.save.child.name, cabinetId: 'try-it',
    items: ITEMS,
    makeItem: it => ({
      subskill: 'pa-sounds', itemId: 'first-' + it.id,
      prompt: 'Which one starts with ' + it.sound + '?',
      choices: [it.ok, ...it.others].sort(() => Math.random() - 0.5).map(c => ({ id: c.word, pic: c.pic, label: c.word, ok: c === it.ok })),
      revealText: it.ok.word + ' starts with ' + it.sound + '.'
    })
  });
  roundCelebration(ctx.speech, stars, () => ctx.exit());
}

export function unmount() { root = null; }
```

- [ ] **Step 3: Commit**

```bash
git add games
git commit -q -m "Add cabinet registry and temporary Try It cabinet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Shell (index.html + shell.js)

**Files:**
- Create: `index.html`, `shell.js`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Amelia's Arcade</title>
<meta name="theme-color" content="#7c3aed">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="stylesheet" href="shared/theme.css">
</head>
<body>
<div id="splash">
  <div class="crown">👑</div>
  <h1>Amelia's Arcade</h1>
  <button class="big-btn" id="start-btn" type="button">Tap to start</button>
</div>

<header id="topbar" hidden>
  <button class="bar-btn" id="back-btn" type="button" aria-label="Back" hidden>←</button>
  <div class="title" id="title">👑 Amelia's Arcade</div>
  <button class="bar-btn" id="mute-btn" type="button" aria-label="Sound on or off">🔊</button>
  <div class="gems" aria-label="Gems">💎 <span id="gem-count">0</span></div>
  <button class="bar-btn" id="gear-btn" type="button" aria-label="Parent corner">⚙️</button>
</header>

<main>
  <section id="home" hidden></section>
  <section id="cabinet" hidden></section>
</main>

<script type="module" src="shell.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write shell.js**

```js
// shell.js — boots services, renders home, lazy-loads cabinets, runs the session shaper.
import { REGISTRY } from './games/registry.js';
import { createEconomy } from './shared/economy.js';
import { createAdaptive } from './shared/adaptive.js';
import { createContentLoader } from './shared/content.js';
import { createSessionClock } from './shared/session.js';
import { createSpeech } from './shared/speech.js';
import { el, bigButton, sheet, toast, confetti, breathingBubble, withName, pick } from './shared/ui.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const content = createContentLoader();
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const clock = createSessionClock();

const $ = id => document.getElementById(id);
let current = null;   // { entry, module }
let praise = { praise: [], greeting: [], retry: [], reveal: [] };

function available() { return REGISTRY.filter(r => !economy.save.settings.modulesOff.includes(r.id)); }
function readyIds() { return available().filter(r => r.ready).map(r => r.id); }

function updateBar() {
  $('gem-count').textContent = economy.save.gems;
  $('mute-btn').textContent = speech.muted ? '🔇' : '🔊';
}

function renderHome() {
  const home = $('home');
  const name = economy.save.child.name;
  const quest = adaptive.todayQuest(readyIds());
  const streak = economy.streak();
  const rank = economy.starRank(adaptive.tier1Ids());
  const req = REGISTRY.find(r => r.id === quest.requiredCabinet);
  const questDone = quest.requiredDone && quest.choiceDone;
  const questStars = (quest.requiredDone ? '⭐' : '☆') + (quest.choiceDone ? '⭐' : '☆');

  home.replaceChildren(
    el('div', { class: 'home-head' }, [
      el('div', { class: 'hello', text: 'Hello, ' + name + '!' }),
      el('div', { class: 'rank', text: '⭐'.repeat(rank) + '☆'.repeat(5 - rank) }),
      el('div', { class: 'streak' }, [el('span', { text: '🔥' }), ...streak.last7.map(on => el('span', { class: 'dot' + (on ? ' on' : '') }))])
    ]),
    el('div', { class: 'quest' }, [
      el('div', { class: 'icon', text: req ? req.icon : '🌟' }),
      el('div', { class: 'text', text: quest.claimed ? 'Quest done! See you tomorrow.' : 'Play ' + (req ? req.name : 'a game') + ', then one you choose.' }),
      quest.claimed ? el('div', { class: 'stars', text: '⭐⭐' })
        : questDone ? el('button', { class: 'claim', type: 'button', text: 'Claim!', onclick: claimQuest })
        : el('div', { class: 'stars', text: questStars })
    ]),
    el('div', { class: 'cabinets' }, available().map(r => {
      const stars = economy.save.stars[r.id] || 0;
      return el('button', { class: 'cabinet' + (r.ready ? '' : ' soon'), type: 'button', onclick: () => r.ready ? openCabinet(r) : soon(r) }, [
        el('div', { class: 'icon', text: r.ready ? r.icon : '🌱' }),
        el('div', { class: 'name', text: r.name }),
        el('div', { class: 'stars', text: r.ready ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '' })
      ]);
    }))
  );
  $('home').hidden = false; $('cabinet').hidden = true; $('back-btn').hidden = true;
  $('title').textContent = '👑 Amelia\'s Arcade';
  updateBar();
}

function soon(r) { speech.speak(r.name + ' is growing. Coming soon!'); toast('🌱 ' + r.name + ' is coming soon'); }

function claimQuest() {
  if (!adaptive.claimQuest()) return;
  confetti(60);
  speech.speak('Quest complete! Ten gems for you, ' + economy.save.child.name + '!');
  renderHome();
}

async function openCabinet(r) {
  speech.stop();
  try {
    const mod = await import(r.entry);
    current = { entry: r, module: mod };
    $('home').hidden = true; $('cabinet').hidden = false; $('back-btn').hidden = false;
    $('title').textContent = r.icon + ' ' + r.name;
    window.scrollTo(0, 0);
    await mod.mount($('cabinet'), { economy, adaptive, content, speech, exit: closeCabinet, praise });
  } catch (e) {
    console.error(e);
    toast('This game needs one visit online first.');
    closeCabinet();
  }
}

function closeCabinet() {
  speech.stop();
  if (current && current.module.unmount) { try { current.module.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  $('cabinet').replaceChildren();
  renderHome();
  if (clock.due()) showShaper();
}

function showShaper() {
  const o = sheet([
    el('div', { class: 'big-emoji', text: '🌟' }),
    el('h2', { text: 'Great job! One more, or all done?' }),
    bigButton('One more', () => o.remove(), 'soft'),
    bigButton('All done ✅', async () => {
      o.remove();
      confetti(80);
      await speech.speak('You did wonderful work today, ' + economy.save.child.name + '. Let\'s take three big breaths.');
      await breathingBubble(speech);
      speech.speak('All done. See you next time!');
      clock.reset();
    })
  ]);
  speech.speak('Great job! One more, or all done?');
}

function showPin() {
  let entry = '';
  const dots = el('div', { class: 'pin-dots', text: '' });
  const render = () => { dots.textContent = '●'.repeat(entry.length) + '○'.repeat(4 - entry.length); };
  render();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k =>
    el('button', { class: 'pin-key', type: 'button', text: k, style: k === '' ? 'visibility:hidden' : '', onclick: () => {
      if (k === '⌫') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += k;
      render();
      if (entry.length === 4) {
        if (entry === economy.save.child.pin) { location.href = 'parent/index.html'; }
        else { entry = ''; render(); toast('Try again'); }
      }
    } }));
  const o = sheet([el('h2', { text: 'Parent corner' }), dots, el('div', { class: 'pin-grid' }, keys), bigButton('Cancel', () => o.remove(), 'soft')]);
}

async function boot() {
  try { praise = await content.load('praise'); } catch (e) { console.warn(e); }
  $('start-btn').addEventListener('click', async () => {
    speech.activate();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('splash').remove();
    $('topbar').hidden = false;
    renderHome();
    speech.speak(withName(pick(praise.greeting.length ? praise.greeting : ['Hello, {name}!']), economy.save.child.name));
  });
  $('back-btn').addEventListener('click', closeCabinet);
  $('mute-btn').addEventListener('click', () => { speech.toggleMuted(); updateBar(); });
  $('gear-btn').addEventListener('click', showPin);
  document.addEventListener('pointerdown', () => clock.touch(), { passive: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
boot();
```

- [ ] **Step 3: Commit**

```bash
git add index.html shell.js
git commit -q -m "Add arcade shell: splash, home, quest card, lazy cabinets, shaper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Parent dashboard skeleton

**Files:**
- Create: `parent/index.html`, `parent/parent.css`, `parent/parent.js`

- [ ] **Step 1: Write parent/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parent Corner</title>
<link rel="stylesheet" href="parent.css">
</head>
<body>
<header><a href="../index.html" class="back">← Back to arcade</a><h1>Parent Corner</h1></header>
<main id="app"><p>Loading…</p></main>
<script type="module" src="parent.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write parent/parent.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, sans-serif; background: #faf5ff; color: #1f1235; }
header { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: #7c3aed; color: #fff; }
header h1 { font-size: 20px; }
.back { color: #fde68a; text-decoration: none; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; }
main { max-width: 900px; margin: 0 auto; padding: 18px; display: flex; flex-direction: column; gap: 18px; }
section { background: #fff; border-radius: 14px; padding: 16px; box-shadow: 0 2px 10px rgba(124,58,237,0.1); }
h2 { font-size: 18px; margin-bottom: 10px; color: #4c1d95; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ede9fe; vertical-align: top; }
th { color: #6b21a8; }
.muted { color: #6b7280; }
.tier1 { font-weight: 700; }
button, select, input { font: inherit; min-height: 40px; border-radius: 10px; border: 2px solid #ddd6fe; padding: 6px 12px; background: #fff; }
button { background: #f3e8ff; cursor: pointer; font-weight: 700; }
button.danger { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 8px; }
label.toggle { display: flex; align-items: center; gap: 8px; min-height: 40px; }
.pin-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 0; }
.pin-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 10px; }
.pin-grid button { min-height: 64px; font-size: 22px; }
.line { margin: 4px 0; }
```

- [ ] **Step 3: Write parent/parent.js**

```js
// parent/parent.js — PIN-gated dashboard skeleton: per-sub-skill table, baseline, settings, export/import.
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS } from '../shared/adaptive.js';
import { REGISTRY } from '../games/registry.js';
import { el } from '../shared/ui.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const app = document.getElementById('app');

const BASELINE = [
  ['Phonics / word analysis', 'Emerging K', '70', 1], ['High-frequency words', 'Emerging K', '—', 1],
  ['Phonological awareness', 'Early/Mid K', '69', 1], ['Measurement & data', 'Emerging K', '66', 1],
  ['Number sense / operations', 'Early K', '57 / 59', 1], ['Counting & cardinality', 'Early K', '78', 2],
  ['Algebraic thinking', 'Mid K', '50–54', 2], ['Geometry', 'Mid K', '67', 2], ['Vocabulary', 'Mid/Late K', '61', 2],
  ['Print concepts / fluency', '—', '86 / 83', 3], ['Comprehension', 'Mid/Late K', '82 / 82', 3]
];

function pinGate() {
  let entry = '';
  const dots = el('div', { text: '○○○○', style: 'font-size:28px;letter-spacing:6px' });
  const grid = el('div', { class: 'pin-grid' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k =>
    el('button', { type: 'button', text: k, style: k ? '' : 'visibility:hidden', onclick: () => {
      if (k === '⌫') entry = entry.slice(0, -1); else if (entry.length < 4) entry += k;
      dots.textContent = '●'.repeat(entry.length) + '○'.repeat(4 - entry.length);
      if (entry.length === 4) { if (entry === economy.save.child.pin) render(); else { entry = ''; dots.textContent = '○○○○'; } }
    } })));
  app.replaceChildren(el('div', { class: 'pin-wrap' }, [el('h2', { text: 'Enter PIN' }), dots, grid]));
}

function pct(v) { return v === null ? '—' : Math.round(v * 100) + '%'; }
function plain(def) {
  const acc = adaptive.accuracy(def.id);
  const ds = adaptive.daysSince(def.id);
  const stage = adaptive.stage(def.id);
  if (acc === null) return def.name + ': not practiced yet.';
  return `${def.name}: stage ${stage}, ${pct(acc)} last 20, last practiced ${ds === 0 ? 'today' : ds + ' day' + (ds === 1 ? '' : 's') + ' ago'}.`;
}

function render() {
  const s = economy.save;
  const today = economy.today();
  app.replaceChildren(
    el('section', {}, [
      el('h2', { text: 'Today' }),
      el('p', { text: `Gems: ${s.gems}. Days played: ${s.streak.days.length}. Played today: ${s.streak.days.includes(today) ? 'yes' : 'no'}. Badges: ${s.badges.length}.` })
    ]),
    el('section', {}, [
      el('h2', { text: 'Skills' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Skill', 'Tier', 'Stage', 'Last 20', 'Today', 'Last practiced'].map(h => el('th', { text: h })))]),
        el('tbody', {}, SUBSKILLS.map(d => {
          const ds = adaptive.daysSince(d.id);
          return el('tr', { class: d.tier === 1 ? 'tier1' : '' }, [
            el('td', { text: d.name + ' ' }, [el('span', { class: 'muted', text: d.strand })]),
            el('td', { text: String(d.tier) }),
            el('td', { text: adaptive.stage(d.id) }),
            el('td', { text: pct(adaptive.accuracy(d.id)) }),
            el('td', { text: String(adaptive.itemsOnDay(d.id, today)) }),
            el('td', { text: ds === null ? 'never' : ds === 0 ? 'today' : ds + 'd ago' })
          ]);
        }))
      ]),
      el('div', { style: 'margin-top:10px' }, SUBSKILLS.map(d => el('p', { class: 'line', text: plain(d) })))
    ]),
    el('section', {}, [
      el('h2', { text: 'Trouble spots (missed 3+ times)' }),
      el('p', { text: adaptive.troubleList().map(t => `${t.id} (${t.count})`).join(', ') || 'None yet.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Fall 2026 baseline' }),
      el('p', { class: 'muted', text: 'Star domain scores are model-based estimates tied to the overall scaled score; i-Ready K domain placements rest on few items. Treat this as a hypothesis the table above checks.' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Strand', 'i-Ready', 'Star', 'Tier'].map(h => el('th', { text: h })))]),
        el('tbody', {}, BASELINE.map(r => el('tr', {}, r.map(c => el('td', { text: String(c) })))))
      ]),
      el('p', { class: 'muted', text: 'Targets: i-Ready reading 396 → 439 typical / 450 stretch; math 372 → 396 / 410.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Modules' }),
      el('div', { class: 'row' }, REGISTRY.map(r => el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', ...(s.settings.modulesOff.includes(r.id) ? {} : { checked: '' }), onchange: e => {
          const off = new Set(s.settings.modulesOff);
          if (e.target.checked) off.delete(r.id); else off.add(r.id);
          s.settings.modulesOff = [...off]; economy.persist();
        } }),
        el('span', { text: r.icon + ' ' + r.name })
      ])))
    ]),
    el('section', {}, [
      el('h2', { text: 'Settings' }),
      el('div', { class: 'row' }, [
        el('label', { text: 'Child name ' }), el('input', { id: 'name', value: s.child.name, maxlength: '20' }),
        el('button', { type: 'button', text: 'Save', onclick: () => { const v = document.getElementById('name').value.trim(); if (v) { s.child.name = v; economy.persist(); render(); } } })
      ]),
      el('div', { class: 'row' }, [
        el('label', { text: 'PIN ' }), el('input', { id: 'pin', value: s.child.pin, maxlength: '4', inputmode: 'numeric' }),
        el('button', { type: 'button', text: 'Save PIN', onclick: () => { const v = document.getElementById('pin').value.trim(); if (/^\d{4}$/.test(v)) { s.child.pin = v; economy.persist(); render(); } } })
      ]),
      el('div', { class: 'row' }, [
        el('label', { text: 'Voice ' }), voiceSelect(),
        el('label', { text: 'Speed ' }), el('select', { onchange: e => { s.settings.rate = Number(e.target.value); economy.persist(); } },
          [['0.8', 'Slower'], ['0.9', 'Normal'], ['1', 'Quicker']].map(([v, t]) => el('option', { value: v, text: t, ...(String(s.settings.rate) === v ? { selected: '' } : {}) })))
      ])
    ]),
    el('section', {}, [
      el('h2', { text: 'Save data' }),
      el('div', { class: 'row' }, [
        el('button', { type: 'button', text: 'Export JSON', onclick: exportSave }),
        el('label', { class: 'toggle' }, ['Import JSON ', el('input', { type: 'file', accept: 'application/json', onchange: importSave })]),
        el('button', { type: 'button', class: 'danger', text: 'Reset all progress', onclick: () => { if (confirm('Reset ALL progress? This cannot be undone.')) { economy.reset(); render(); } } })
      ]),
      el('p', { class: 'muted', text: 'Devices do not sync. Use export/import to move progress between phone, tablet, and PC.' })
    ])
  );
}

function voiceSelect() {
  const s = economy.save;
  const sel = el('select', { onchange: e => { s.settings.voiceName = e.target.value; economy.persist(); } });
  const fill = () => {
    const voices = ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^en/i.test(v.lang));
    sel.replaceChildren(el('option', { value: '', text: 'Automatic (en-US)' }), ...voices.map(v => el('option', { value: v.name, text: v.name + ' (' + v.lang + (v.localService ? ', offline' : '') + ')', ...(s.settings.voiceName === v.name ? { selected: '' } : {}) })));
  };
  fill();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', fill);
  return sel;
}

function exportSave() {
  const blob = new Blob([economy.exportJSON()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'amelia-arcade-' + economy.today() + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
}
function importSave(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { if (economy.importJSON(t)) { alert('Imported.'); render(); } else alert('That file is not a valid save.'); });
}

pinGate();
```

- [ ] **Step 4: Commit**

```bash
git add parent
git commit -q -m "Add parent dashboard skeleton: skills table, baseline, settings, export/import

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: PWA — manifest, service worker, precache test

**Files:**
- Create: `manifest.json`, `sw.js`, `tests/precache.test.js`

- [ ] **Step 1: Write the failing precache test**

```js
// tests/precache.test.js — sw.js must precache every shipped file, and nothing that does not exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.js';

const SKIP = /^(docs\/|tests\/|\.claude\/|README\.md$|\.gitignore$|sw\.js$)/;

test('sw.js ASSETS matches tracked files', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'ASSETS array not found');
  const listed = new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1].replace(/^\.\//, '')));
  const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').map(s => s.trim()).filter(Boolean).filter(f => !SKIP.test(f));
  const missing = tracked.filter(f => !listed.has(f));
  const extra = [...listed].filter(f => f !== '' && !tracked.includes(f));
  assert.deepEqual(missing, [], 'files not precached');
  assert.deepEqual(extra, [], 'precached files that do not exist');
});
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "name": "Amelia's Arcade",
  "short_name": "Arcade",
  "description": "Princess Quest and friends: gentle kindergarten reading and math practice.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fdf2f8",
  "theme_color": "#7c3aed",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: Write sw.js**

```js
// sw.js — cache-first with a versioned precache. Bump VERSION on every release.
const VERSION = 'arcade-v3.0.1';
const ASSETS = [
  '',
  'index.html',
  'shell.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'princess.png',
  'shared/theme.css',
  'shared/economy.js',
  'shared/adaptive.js',
  'shared/content.js',
  'shared/session.js',
  'shared/speech.js',
  'shared/ui.js',
  'games/registry.js',
  'games/princess-quest/try-it.js',
  'parent/index.html',
  'parent/parent.css',
  'parent/parent.js',
  'content/standards.json',
  'content/praise.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const clone = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
  );
});
```

Note: the precache list uses paths relative to the SW scope; `''` resolves to the directory root.

- [ ] **Step 4: Run tests**

Run: `node --test tests/`
Expected: all pass, including precache (after `git add` of the new files, since the test reads `git ls-files` — stage first).

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js tests/precache.test.js
git commit -q -m "Add PWA manifest, cache-first service worker, precache test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: README (short) and browser verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# Amelia's Arcade — Princess Quest v3

Gentle kindergarten reading and math practice for one child, built as an offline PWA. Design spec: `docs/superpowers/specs/2026-09-10-princess-quest-v3-design.md`.

## Run locally
```
npx http-server . -p 8765 -c-1
```
Open http://localhost:8765/. Tests: `node --test tests/`.

## Layout
- `index.html`, `shell.js` — launcher shell (splash, home, quest, cabinets)
- `shared/` — economy (save), adaptive (difficulty), speech, ui, content loader, session clock, theme
- `games/registry.js` — one entry per cabinet; `games/princess-quest/*.js` — cabinet modules
- `content/*.json` — all words, stories, problems, standards
- `parent/` — PIN-gated dashboard
- `sw.js` — precache list; bump `VERSION` on release; `tests/precache.test.js` keeps the list honest

## Adding a cabinet
1. Create `games/<group>/<id>.js` exporting `mount(root, ctx)` and `unmount()`.
2. Add one entry to `games/registry.js` with `ready: true`.
3. Add the file to `ASSETS` in `sw.js` and bump `VERSION`.

Full save schema, content formats, and word/story authoring guide arrive in Step 9.
```

- [ ] **Step 2: Add README to precache SKIP (already skipped) and commit**

```bash
git add README.md
git commit -q -m "Add README with layout and cabinet how-to

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 3: Browser verification (in-app preview, server `princess-quest` on port 8765)**

Checks, in order:
1. Load `/`. Splash shows; console has no errors. Tap "Tap to start": splash removed, top bar and home render, greeting speaks (desktop Chrome).
2. Home shows: Hello, ⭐☆☆☆☆, streak dots, quest card naming a ready cabinet (Try It), 11 cabinet cards, 10 with 🌱.
3. Tap a 🌱 card: toast + speech "coming soon".
4. Tap Try It: prompt speaks, 3 picture choices ≥ 96px tall. Tap a wrong one: it dims, correct glows, prompt re-speaks, no red. Tap wrong again: correct turns green, answer spoken, item re-queued 2 later. Finish 5 items: celebration sheet with stars, Yay returns home, Try It card shows stars, quest card shows ⭐☆.
5. Tap ⚙: PIN sheet; 1234 → parent page; skills table shows pa-sounds accuracy and today's count; export downloads a JSON; back link returns.
6. Resize to 360×740: single column, no horizontal scroll, all buttons ≥ 64px tall (measure `.choice`, `.cabinet`, `.big-btn` via getComputedStyle).
7. Resize to 1024×768: content centered, max 640px.
8. `navigator.serviceWorker.getRegistration()` resolves; Application → cache `arcade-v3.0.1` contains the ASSETS.

Fix anything that fails, re-run `node --test tests/`, commit.

---

## Self-review

- Spec coverage for Step 1: shell §3.2 ✔ (splash, top bar, home, quest, shaper, PIN gear); speech §3.3 ✔ (no name lists, no boundary, mobile hack skipped, word spans); economy §3.4 ✔; adaptive §3.5 ✔ (14 sub-skills, 8/10, 4-in-2-days, ≥3 choices, quest picker with exclusion, trouble list); content loader ✔; UI kit §3.6 ✔ (choiceGrid scaffold, celebrate, bubble, sessionShaper via session.js; `slotRow`/`tileTray`/`sortBins` deferred to the cabinets that need them in Steps 2 and 6); PWA §3.8 ✔ incl. precache test and offline import fallback; dashboard §7 skeleton ✔ (sparklines, badges gallery, sound kit recorder deferred to Step 9 per spec §9). Sound kit §3.7 deferred to Step 2 with Word Builder.
- Placeholders: none. Every file has full code.
- Consistency: `runRound` in ui.js calls `adaptive.record({subskill, ok, choices, retry, itemId})`, `economy.setStars`, `adaptive.noteRoundFinished` — all defined in Tasks 3–4 with those names. `ctx` passed by shell = `{ economy, adaptive, content, speech, exit, praise }`, consumed by try-it.js. `speech.speak` returns a promise; `runRound` awaits it before enabling choices.
