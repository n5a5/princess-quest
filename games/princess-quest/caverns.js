// games/princess-quest/caverns.js — Crystal Caverns: number sense and operations.
// Representations follow the CRA order: gems she can see and tap → ten-frames → numerals alongside.
// Families:
//   gemFrames    subitize (1–4 scattered; 5–10 only in structured frames) and "how many more to make 10"
//   crystalBridge add/subtract within 5 then 10 with gems always visible; quick n+1 / n−1 facts (Dyson & Jordan 2015)
//   teenTower    teen numbers as a full ten-frame plus ones; compare two groups; number line to 20
//   caveCount    what comes next by ones and by tens; counting backward within 20
//   numberStories bonds and decompositions ("5 is 2 and ▢"), picture word problems, is-this-true
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, cancelled = false;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const GEM = '💎';
const gems = n => n + (n === 1 ? ' gem' : ' gems');

// ---------- visual builders ----------
function gemCluster(n, { scattered = false } = {}) {
  const box = el('div', { class: 'row', style: 'min-height:70px;font-size:36px;gap:6px;max-width:320px;margin:0 auto' });
  for (let i = 0; i < n; i++) {
    const g = el('span', { text: GEM });
    if (scattered) g.style.transform = `translate(${rand(-6, 6)}px, ${rand(-10, 10)}px) rotate(${rand(-20, 20)}deg)`;
    box.appendChild(g);
  }
  return box;
}
function tenFrame(filled, { tappable = false, onChange = null, fixedCount = 0 } = {}) {
  const cells = [];
  const frame = el('div', { class: 'ten-frame', role: 'group', 'aria-label': 'ten frame' });
  const state = Array.from({ length: 10 }, (_, i) => i < filled);
  for (let i = 0; i < 10; i++) {
    const c = el('button', { class: 'cell' + (state[i] ? (i < fixedCount ? ' fixed' : ' on') : ''), type: 'button', text: state[i] ? GEM : '', 'aria-label': 'cell ' + (i + 1), ...(tappable && i >= fixedCount ? {} : { disabled: '' }) });
    if (tappable) c.addEventListener('click', () => { if (i < fixedCount) return; state[i] = !state[i]; c.classList.toggle('on', state[i]); c.textContent = state[i] ? GEM : ''; onChange && onChange(state.filter(Boolean).length); });
    cells.push(c); frame.appendChild(c);
  }
  return { el: frame, count: () => state.filter(Boolean).length, cells };
}
function numeralChoices(answer, { min = 0, max = 10, n = 3 } = {}) {
  const set = new Set([answer]);
  const near = [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3, answer - 3].filter(x => x >= min && x <= max);
  for (const v of near) { if (set.size >= n) break; set.add(v); }
  while (set.size < n) set.add(rand(min, max));
  return shuffle([...set]).map(v => ({ id: String(v), label: String(v), ok: v === answer, say: String(v), textOnly: true }));
}
function choiceRound(stage, audio, prompt, items, praiseLine, revealText, { three = false } = {}) {
  const grid = choiceGrid({ audio, prompt, items: items.map(i => ({ ...i, pic: i.textOnly ? '' : i.pic })), praise: praiseLine, revealText });
  if (three) grid.el.classList.add('three');
  grid.el.querySelectorAll('.choice').forEach((c, i) => { if (items[i].textOnly) { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); } });
  stage.setBody(grid.el);
  return grid.done;
}
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
const sayNum = n => String(n);

// ---------- families ----------
const gemFrames = {
  id: 'frames', subskill: 'subitize-tenframe', itemId: it => 'frames:' + it.kind + ':' + it.n,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'small' || it.kind === 'structured') {
      const prompt = 'How many gems? Look quickly!';
      stage.setPrompt(promptBar(audio, prompt));
      const vis = it.kind === 'small' ? gemCluster(it.n, { scattered: true }) : tenFrame(it.n).el;
      stage.setObject(el('div'));
      stage.setBody(vis);
      await audio.say(prompt);
      await wait(it.kind === 'small' ? 900 : 1300);
      const hidden = el('div', { class: 'picture', text: '✨' });
      stage.setBody(hidden);
      const peek = el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Peek again', text: '👀', onclick: async () => { stage.setBody(vis); await wait(900); stage.setBody(hidden, el('div', { class: 'row' }, [peek]), grid.el); } });
      const grid = choiceGrid({ audio, prompt: 'How many gems?', items: numeralChoices(it.n, { min: 1, max: 10 }), praise: praiseLine(), revealText: 'There were ' + gems(it.n) + '.' });
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(hidden, el('div', { class: 'row' }, [peek]), grid.el);
      const r = await grid.done;
      stage.setBody(vis, grid.el);
      return { outcome: outcomeOf(r), choices: 3, gpc: 'n' + it.n };
    }
    // make10: frame shows n gems; tap the empty cells until the frame is full, then Done.
    const prompt = gems(it.n) + '. How many more to make 10? Tap the empty spots.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    let misses = 0;
    const result = await new Promise(resolve => {
      const frame = tenFrame(it.n, { tappable: true, fixedCount: it.n, onChange: () => {} });
      const done = bigButton('Done', async () => {
        const added = frame.count() - it.n;
        if (frame.count() === 10) {
          done.setAttribute('disabled', '');
          await audio.say(it.n + ' and ' + added + ' make 10!');
          audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 4, gpc: 'make10-' + it.n });
        } else {
          misses++; stage.luna('think', 900);
          if (misses === 1) { frame.cells.forEach((c, i) => { if (i >= it.n) c.classList.add('glow'); }); await audio.say('Fill every empty spot. Count as you tap.'); }
          else { frame.cells.forEach((c, i) => { if (i >= it.n && !c.classList.contains('on')) c.click(); }); await audio.say(it.n + ' and ' + (10 - it.n) + ' make 10.'); done.click(); }
        }
      }, 'gold');
      stage.setBody(frame.el, el('div', { class: 'row' }, [done]));
    });
    return result;
  }
};

const crystalBridge = {
  id: 'bridge', subskill: 'add-sub', itemId: it => 'bridge:' + it.a + (it.op === '+' ? '+' : '-') + it.b,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { a, b, op } = it;
    const answer = op === '+' ? a + b : a - b;
    const prompt = op === '+'
      ? 'The bridge has ' + gems(a) + '. ' + b + ' more come. How many gems now?'
      : 'The bridge has ' + gems(a) + '. ' + b + ' fall' + (b === 1 ? 's' : '') + ' off. How many gems are left?';
    stage.setPrompt(promptBar(audio, prompt));
    const groupA = gemCluster(a);
    const groupB = gemCluster(b);
    groupB.style.opacity = '0.35';
    const bridge = el('div', { class: 'bridge' }, Array.from({ length: 10 }, (_, i) => el('span', { class: i < a ? 'on' : '' })));
    stage.setObject(el('div'));
    const vis = el('div', { class: 'board' }, [bridge, el('div', { class: 'row' }, [groupA, el('span', { class: 'word-big', text: op }), groupB])]);
    stage.setBody(vis);
    await audio.say(prompt);
    // animate the change on the bridge so the quantity is visible before answering
    if (op === '+') { for (let i = a; i < a + b; i++) { bridge.children[i].classList.add('on'); await wait(220); } groupB.style.opacity = '1'; }
    else { for (let i = a - 1; i >= a - b; i--) { bridge.children[i].classList.remove('on'); await wait(220); } groupB.style.opacity = '1'; groupB.style.filter = 'grayscale(1)'; }
    const grid = choiceGrid({ audio, prompt: 'How many gems?', items: numeralChoices(answer, { min: 0, max: 10 }), praise: praiseLine(), revealText: 'It is ' + answer + '. ' + a + ' ' + (op === '+' ? 'plus' : 'take away') + ' ' + b + ' is ' + answer + '.' });
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
    stage.setBody(vis, grid.el);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: (op === '+' ? 'add' : 'sub') + (a + b > 5 ? '10' : '5') };
  }
};

const teenTower = {
  id: 'teen', subskill: 'teen-compare', itemId: it => 'teen:' + it.kind + ':' + (it.n ?? it.a + 'v' + it.b),
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'teens') {
      const ones = it.n - 10;
      const prompt = 'A full frame is ten. Ten and ' + ones + ' more. How many gems?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const vis = el('div', { class: 'board' }, [tenFrame(10).el, gemCluster(ones)]);
      const grid = choiceGrid({ audio, prompt: 'How many gems?', items: numeralChoices(it.n, { min: 10, max: 20 }), praise: praiseLine(), revealText: 'Ten and ' + ones + ' is ' + it.n + '.' });
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(vis, grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'teen' + it.n };
    }
    if (it.kind === 'compare') {
      const prompt = 'Which pile has more gems? Or are they the same?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const items = [
        { id: 'left', pic: '', label: String(it.a), ok: it.a > it.b, say: 'the pile of ' + it.a },
        { id: 'same', pic: '', label: '=', ok: it.a === it.b, say: 'the same', textOnly: true },
        { id: 'right', pic: '', label: String(it.b), ok: it.b > it.a, say: 'the pile of ' + it.b }
      ];
      const vis = el('div', { class: 'row' }, [gemCluster(it.a), el('span', { class: 'word-big', text: '?' }), gemCluster(it.b)]);
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: it.a === it.b ? 'They are the same.' : Math.max(it.a, it.b) + ' is more than ' + Math.min(it.a, it.b) + '.' });
      grid.el.classList.add('three');
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(vis, grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'compare' };
    }
    // numberline: tap the number after/before n on a 0–20 line
    const target = it.after ? it.n + 1 : it.n - 1;
    const prompt = 'Tap the number that comes ' + (it.after ? 'after' : 'before') + ' ' + it.n + '.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    let misses = 0;
    const result = await new Promise(resolve => {
      const lo = Math.max(0, target - 4), hi = Math.min(20, lo + 8);
      const line = el('div', { class: 'number-line' }, Array.from({ length: hi - lo + 1 }, (_, k) => {
        const v = lo + k;
        const b = el('button', { type: 'button', text: String(v), class: v === it.n ? 'on' : '', 'aria-label': String(v) });
        b.addEventListener('click', async () => {
          audio.stop();
          if (v === target) { b.classList.add('on'); await audio.say(target + '! ' + praiseLine()); resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 4, gpc: 'line' }); }
          else { misses++; b.classList.add('wobble'); setTimeout(() => b.classList.remove('wobble'), 500); stage.luna('think', 900); if (misses === 1) { const right = [...line.children].find(x => x.textContent === String(target)); right.classList.add('glow'); await audio.say(it.n + '. ' + (it.after ? 'What comes next?' : 'What comes just before?')); } else { const right = [...line.children].find(x => x.textContent === String(target)); right.click(); } }
        });
        return b;
      }));
      stage.setBody(line);
    });
    return result;
  }
};

const caveCount = {
  id: 'count', subskill: 'count-sequence', itemId: it => 'count:' + it.kind + ':' + it.start,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const seq = it.kind === 'tens' ? [0, 1, 2, 3].map(k => it.start + k * 10) : it.kind === 'backward' ? [0, 1, 2, 3].map(k => it.start - k) : [0, 1, 2, 3].map(k => it.start + k);
    const shown = seq.slice(0, 3), answer = seq[3];
    const prompt = (it.kind === 'backward' ? 'Count back. ' : it.kind === 'tens' ? 'Count by tens. ' : 'Count on. ') + shown.join(', ') + ', and then?';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    const path = el('div', { class: 'number-line' }, [...shown.map(v => el('button', { type: 'button', class: 'on', text: String(v), disabled: '' })), el('button', { type: 'button', text: '?', disabled: '' })]);
    const max = it.kind === 'tens' ? 100 : 20;
    const grid = choiceGrid({ audio, prompt, items: numeralChoices(answer, { min: 0, max, n: 3 }).map(c => it.kind === 'tens' ? { ...c } : c), praise: praiseLine(), revealText: 'It is ' + answer + '.' });
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
    stage.setBody(path, grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: it.kind };
  }
};

const STORY_THINGS = [['unicorns', '🦄'], ['Squishies', '🧸'], ['flowers', '🌷'], ['stars', '⭐'], ['cupcakes', '🧁'], ['butterflies', '🦋'], ['crowns', '👑'], ['bunnies', '🐰']];
const numberStories = {
  id: 'stories', subskill: 'decompose-stories', itemId: it => 'story:' + it.kind + ':' + it.a + ':' + it.b,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'bonds' || it.kind === 'decompose') {
      const whole = it.a + it.b;
      const prompt = gems(whole) + '. ' + it.a + (it.a === 1 ? ' goes' : ' go') + ' in this pile. How many go in the other pile?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const vis = el('div', { class: 'row' }, [gemCluster(it.a), el('span', { class: 'word-big', text: 'and' }), el('span', { class: 'word-big', text: '?' })]);
      const grid = choiceGrid({ audio, prompt, items: numeralChoices(it.b, { min: 0, max: 10 }), praise: praiseLine(), revealText: whole + ' is ' + it.a + ' and ' + it.b + '.' });
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(el('div', { class: 'word-big', text: String(whole) }), vis, grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'bond' + whole };
    }
    if (it.kind === 'problems') {
      const [name, pic] = it.thing;
      const answer = it.op === '+' ? it.a + it.b : it.a - it.b;
      const prompt = it.op === '+' ? it.a + ' ' + name + ' are playing. ' + it.b + ' more come. How many ' + name + ' now?' : it.a + ' ' + name + ' are playing. ' + it.b + ' go home. How many ' + name + ' are left?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const vis = el('div', { class: 'row', style: 'font-size:38px' }, [el('span', { text: pic.repeat(it.a) }), el('span', { class: 'word-big', text: it.op }), el('span', { text: pic.repeat(it.b), style: it.op === '-' ? 'filter:grayscale(1);opacity:.5' : '' })]);
      const grid = choiceGrid({ audio, prompt, items: numeralChoices(answer, { min: 0, max: 10 }), praise: praiseLine(), revealText: 'There are ' + answer + '.' });
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(vis, grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'problem' };
    }
    // truefalse: three choices (true / false / "not sure" is not offered; use equation cards: which one is true?)
    const eqs = it.eqs; // [{ text, ok }]
    const prompt = 'Which one is true? Count the gems.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    const grid = choiceGrid({ audio, prompt, items: eqs.map(e => ({ id: e.text, pic: '', label: e.text, ok: e.ok, say: e.text.replace('+', 'plus').replace('=', 'equals'), textOnly: true })), praise: praiseLine(), revealText: eqs.find(e => e.ok).text.replace('+', 'plus').replace('=', 'equals') + ' is true.' });
    grid.el.classList.add('three');
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); c.style.fontSize = '30px'; });
    stage.setBody(gemCluster(it.a), el('div', { class: 'row' }, [el('span', { class: 'word-big', text: '+' })]), gemCluster(it.b), grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: 'equation' };
  }
};

// ---------- item generators (stage-aware) ----------
function gen(family, stageName) {
  switch (family.id) {
    case 'frames': {
      if (stageName === 'small') return { kind: 'small', n: rand(1, 4) };
      if (stageName === 'structured') return { kind: 'structured', n: rand(5, 10) };
      return { kind: 'make10', n: rand(1, 9) };
    }
    case 'bridge': {
      if (stageName === 'within5') { const add = Math.random() < 0.6; const a = rand(1, 4); const b = add ? rand(1, 5 - a) : rand(1, a); return { a, b, op: add ? '+' : '-' }; }
      if (stageName === 'within10') { const add = Math.random() < 0.6; const a = rand(2, 8); const b = add ? rand(1, 10 - a) : rand(1, a - 1); return { a, b, op: add ? '+' : '-' }; }
      const a = rand(2, 7), b = rand(1, 10 - a); return Math.random() < 0.5 ? { a, b, op: '+' } : { a: a + b, b, op: '-' };
    }
    case 'teen': {
      if (stageName === 'teens') return { kind: 'teens', n: rand(11, 19) };
      if (stageName === 'compare') { const a = rand(2, 12); const b = Math.random() < 0.25 ? a : rand(2, 12); return { kind: 'compare', a, b }; }
      return { kind: 'numberline', n: rand(2, 18), after: Math.random() < 0.6 };
    }
    case 'count': {
      if (stageName === 'ones') return { kind: 'ones', start: rand(1, 16) };
      if (stageName === 'tens') return { kind: 'tens', start: pick([10, 20, 30, 40, 50, 60]) };
      return { kind: 'backward', start: rand(6, 20) };
    }
    case 'stories': {
      if (stageName === 'bonds') { const a = rand(1, 9); return { kind: 'bonds', a, b: 10 - a }; }
      if (stageName === 'decompose') { const whole = rand(3, 9); const a = rand(1, whole - 1); return { kind: 'decompose', a, b: whole - a }; }
      if (stageName === 'problems') { const add = Math.random() < 0.6; const a = rand(1, 6); const b = add ? rand(1, 10 - a) : rand(1, a); return { kind: 'problems', a, b, op: add ? '+' : '-', thing: pick(STORY_THINGS) }; }
      const a = rand(1, 5), b = rand(1, 5); const s = a + b;
      const wrong1 = s + pick([1, 2]), wrong2 = Math.max(0, s - pick([1, 2]));
      return { kind: 'truefalse', a, b, eqs: shuffle([{ text: a + ' + ' + b + ' = ' + s, ok: true }, { text: a + ' + ' + b + ' = ' + wrong1, ok: false }, { text: a + ' + ' + b + ' = ' + (wrong2 === s ? s + 3 : wrong2), ok: false }]) };
    }
  }
}
const FAMILIES = { frames: gemFrames, bridge: crystalBridge, teen: teenTower, count: caveCount, stories: numberStories };

function buildRound(kind) {
  const stageOf = f => ctx.adaptive.stage(f.subskill);
  const items = [];
  const take = f => items.push({ family: f, item: gen(f, stageOf(f)) });
  if (FAMILIES[kind]) { for (let i = 0; i < 6; i++) take(FAMILIES[kind]); return items; }
  // Today's crystals: planner's target ×3, plus one each of the others (frames, bridge, teen, count/stories).
  const target = ctx.adaptive.todayQuest().requiredSubskill;
  const tf = Object.values(FAMILIES).find(f => f.subskill === target) || crystalBridge;
  take(tf); take(gemFrames); take(tf); take(crystalBridge); take(teenTower); take(tf === numberStories ? caveCount : numberStories);
  return items.slice(0, 6);
}

async function startRound(kind) {
  if (roundBusy) return; // BUG-04: one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'caverns', cabinetId: 'caverns', items: buildRound(kind), review: new Set(ctx.adaptive.reviewSkills('caverns')) });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'mix', icon: '💎', name: "Today's crystals", primary: true },
    { id: 'frames', icon: '🔟', name: 'Gem Frames' },
    { id: 'bridge', icon: '🌉', name: 'Crystal Bridge' },
    { id: 'teen', icon: '🗼', name: 'Teen Tower' },
    { id: 'count', icon: '🪜', name: 'Cave Count' },
    { id: 'stories', icon: '📜', name: 'Number Stories' }
  ];
  host.replaceChildren(el('div', { class: 'scene caverns' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Crystal Caverns' }), el('div', { class: 'line', text: 'The crystals need counting. Which cave today?' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to the Crystal Caverns! Which cave today?');
}

export async function mount(h, c) { host = h; ctx = c; showMenu(); }
export function unmount() { cancelled = true; host = null; }
