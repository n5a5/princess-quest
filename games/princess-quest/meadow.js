// games/princess-quest/meadow.js — Unicorn Meadow: the phonics place.
// Encounter families (all content-driven from content/phonics.json + content/sounds.json):
//   wordSpell   encode: hear the word, build it from rune tiles (tap-to-place or drag)
//   readRune    decode: runes show a word; tap runes to hear sounds; find the picture
//   soundSwap   change one rune to make a new word (cat → bat)
//   soundSeeds  phonological awareness: first / final / medial sound, oral blending, counting sounds, oral swap
import { el, wait, shuffle, pick, choiceGrid, picture, promptBar, tileBoard, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { unitsOf } from '../../shared/audio.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, phonics = null, sounds = null, cancelled = false;

// ---------- content helpers ----------
const stageIndex = id => phonics.stages.findIndex(s => s.id === id);
function wordsUpTo(stageIdx) { return phonics.stages.slice(0, stageIdx + 1).flatMap(s => s.words); }
function wordsAt(stageIdx) { return phonics.stages[Math.min(stageIdx, phonics.stages.length - 1)].words; }
function graphemePool(stageIdx) { return [...new Set(phonics.stages.slice(0, stageIdx + 1).flatMap(s => s.graphemes))]; }
const spokenUnits = w => unitsOf({ units: w.u }).map((u, i) => ({ g: u[0], p: u[1], i })).filter(u => u.p);
const soundLabel = id => (sounds[id] && sounds[id].label) || id;
const isVowel = id => sounds[id] && sounds[id].kind === 'vowel';

// Pick n words from the current stage, mixing in one review word from earlier stages.
function pickWords(stageIdx, n, { avoid = [] } = {}) {
  const cur = shuffle(wordsAt(stageIdx).filter(w => !avoid.includes(w.w)));
  const out = cur.slice(0, n);
  if (stageIdx > 0 && n >= 3) { const earlier = shuffle(wordsUpTo(stageIdx - 1)); if (earlier[0]) out[out.length - 1] = earlier[0]; }
  return out;
}
// Words whose unit at index i differs by exactly one grapheme from w (minimal pairs). Falls back to same-length words.
function minimalPairs(w, pool) {
  const same = shuffle(pool.filter(x => x.w !== w.w && x.u.length === w.u.length));
  const pairs = same.filter(x => x.u.filter((u, i) => u[0] !== w.u[i][0]).length === 1);
  const rest = same.filter(x => !pairs.includes(x));
  const any = shuffle(pool.filter(x => x.w !== w.w && !same.includes(x)));
  return [...shuffle(pairs), ...rest, ...any]; // minimal pairs first, then same length, then anything
}
function distractorGraphemes(w, stageIdx, n) {
  const used = new Set(w.u.map(u => u[0]));
  const pool = graphemePool(stageIdx).filter(g => !used.has(g));
  // prefer visually/aurally confusable letters
  const confusable = { b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'q'], m: ['n', 'w'], n: ['m', 'u'], a: ['e', 'o'], e: ['a', 'i'], i: ['e', 'a'], o: ['a', 'u'], u: ['o', 'a'], c: ['k'], k: ['c'], f: ['t'], t: ['f'] };
  const wanted = [];
  for (const u of w.u) for (const c of (confusable[u[0]] || [])) if (pool.includes(c) && !wanted.includes(c)) wanted.push(c);
  const rest = shuffle(pool.filter(g => !wanted.includes(g)));
  return [...wanted, ...rest].slice(0, n);
}

// ---------- families ----------
const wordSpell = {
  id: 'spell', subskill: 'phonics-encode', itemId: w => 'spell:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const units = w.u;
    const sIdx = ctx.adaptive.stageIndex('phonics-encode');
    const tiles = shuffle([
      ...units.map((u, i) => ({ id: 'u' + i, grapheme: u[0], phoneme: u[1] || null })),
      ...distractorGraphemes(w, sIdx, units.length <= 3 ? 2 : 1).map((g, i) => ({ id: 'd' + i, grapheme: g, phoneme: g in sounds ? g : (g === 'c' ? 'k' : g === 'ck' ? 'k' : g.replace(/(.)\1/, '$1')) }))
    ]);
    const prompt = 'Build the word ' + w.w + '.';
    stage.setObject(picture(w.p, () => audio.word(w.w)));
    stage.setPrompt(promptBar(audio, prompt));
    let misses = 0, resolve;
    const done = new Promise(r => { resolve = r; });
    const board = tileBoard({
      audio, tiles, slotCount: units.length,
      onChange: async slots => {
        if (slots.some(s => s === null)) return;
        const got = board.graphemes();
        const wrong = got.map((g, i) => g !== units[i][0] ? i : -1).filter(i => i >= 0);
        if (!wrong.length) {
          board.lock(); board.clearHints();
          await audio.decode({ word: w.w, units }, { onStep: s => { if (s.index !== undefined) board.highlight(s.index); } });
          board.clearHighlight();
          audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: tiles.length, gpc: units.map(u => u[0]).join('') });
          return;
        }
        misses++;
        const slotEls = board.el.querySelectorAll('.slot');
        wrong.forEach(i => { slotEls[i].classList.add('wrong'); setTimeout(() => slotEls[i].classList.remove('wrong'), 600); });
        stage.luna('think', 900);
        if (misses === 1) {
          // Scaffold: clear the wrong slots, glow the right tile for the first wrong slot, replay the sound.
          wrong.forEach(i => board.setSlot(i, null));
          const need = tiles.find(t => t.id === 'u' + wrong[0]);
          board.hintSlot(wrong[0]); board.hintTile(need.id);
          await audio.say('Listen. ' + (units[wrong[0]][1] ? '/' + units[wrong[0]][1] + '/' : 'the quiet letter ' + units[wrong[0]][0]) + '. Try again.');
        } else {
          // Reveal: place every tile correctly and decode it together.
          board.clearHints();
          units.forEach((u, i) => board.setSlot(i, 'u' + i));
          board.lock();
          await audio.say('Here it is.');
          await audio.decode({ word: w.w, units }, { onStep: s => { if (s.index !== undefined) board.highlight(s.index); } });
          board.clearHighlight();
          resolve({ outcome: 'revealed', choices: tiles.length, gpc: units.map(u => u[0]).join('') });
        }
      }
    });
    stage.setBody(board.el);
    await audio.say(prompt);
    await audio.word(w.w);
    return done;
  }
};

function runeRow(audio, w, { onTap } = {}) {
  const units = w.u;
  const row = el('div', { class: 'row' });
  const runes = units.map((u, i) => {
    const r = el('button', { class: 'rune', type: 'button', text: u[0], 'aria-label': 'rune ' + u[0] });
    r.addEventListener('click', () => { audio.stop(); if (u[1]) audio.phoneme(u[1]); else audio.say('quiet ' + u[0]); r.classList.add('lit'); if (onTap) onTap(i); });
    row.appendChild(r);
    return r;
  });
  return { row, runes, highlight: i => runes.forEach((r, k) => r.classList.toggle('now', k === i)), clear: () => runes.forEach(r => r.classList.remove('now')) };
}

const readRune = {
  id: 'read', subskill: 'phonics-decode', itemId: w => 'read:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const sIdx = ctx.adaptive.stageIndex('phonics-decode');
    const foils = shuffle(minimalPairs(w, wordsUpTo(sIdx))).slice(0, 2);
    const choices = shuffle([w, ...foils]).map(x => ({ id: x.w, pic: x.p, ok: x === w, say: x.w }));
    const prompt = 'Tap the runes. Read the word. Then find its picture.';
    const runes = runeRow(audio, w);
    stage.setObject(el('div'));
    stage.setPrompt(promptBar(audio, prompt));
    const wand = el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Blend it', text: '🪄', onclick: async () => { await audio.decode({ word: w.w, units: w.u }, { onStep: s => { if (s.index !== undefined) runes.highlight(s.index); } }); runes.clear(); } });
    const grid = choiceGrid({ audio, prompt: 'Find the picture for the word.', items: choices, praise: praiseLine(), revealText: 'It says ' + w.w + '.' });
    stage.setBody(el('div', { class: 'row' }, [runes.row, wand]), grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    await audio.decode({ word: w.w, units: w.u }, { onStep: s => { if (s.index !== undefined) runes.highlight(s.index); } });
    runes.clear();
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: choices.length, gpc: w.u.map(u => u[0]).join('') };
  }
};

const soundSwap = {
  id: 'swap', subskill: 'pa-manipulate', itemId: pair => 'swap:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, index } = pair;
    const oldU = from.u[index], newU = to.u[index];
    const sIdx = ctx.adaptive.stageIndex('phonics-encode');
    const options = shuffle([newU[0], ...distractorGraphemes(to, sIdx, 4).filter(g => g !== oldU[0] && g !== newU[0]).slice(0, 2)]);
    const prompt = 'Change /' + oldU[1] + '/ to /' + newU[1] + '/ to make ' + to.w + '.';
    const runes = runeRow(audio, from);
    stage.setObject(picture(from.p, () => audio.word(from.w)));
    stage.setPrompt(promptBar(audio, prompt));
    let misses = 0;
    const result = await new Promise(resolve => {
      const tiles = el('div', { class: 'row' }, options.map(g => {
        const t = el('button', { class: 'tile', type: 'button', text: g, 'aria-label': 'tile ' + g });
        t.addEventListener('click', async () => {
          audio.stop();
          const pid = g in sounds ? g : g === 'c' ? 'k' : g;
          audio.phoneme(pid);
          if (g === newU[0]) {
            tiles.querySelectorAll('.tile').forEach(x => x.setAttribute('disabled', ''));
            runes.runes[index].textContent = g;
            runes.runes[index].classList.add('now');
            stage.setObject(picture(to.p, () => audio.word(to.w)));
            await wait(200);
            await audio.swap({ word: to.w, units: to.u }, index, { onStep: s => { if (s.index !== undefined) runes.highlight(s.index); } });
            runes.clear();
            audio.say(praiseLine());
            resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: options.length, gpc: newU[0] });
          } else {
            misses++;
            t.classList.add('wobble'); setTimeout(() => t.classList.remove('wobble'), 600);
            stage.luna('think', 900);
            if (misses === 1) { t.classList.add('used'); t.setAttribute('disabled', ''); const right = [...tiles.querySelectorAll('.tile')].find(x => x.textContent === newU[0]); right.classList.add('glow'); audio.say('We need /' + newU[1] + '/. Tap the glowing rune.'); }
            else { const right = [...tiles.querySelectorAll('.tile')].find(x => x.textContent === newU[0]); right.click(); }
          }
        });
        return t;
      }));
      runes.runes[index].classList.add('glow');
      stage.setBody(el('div', { class: 'row' }, [runes.row]), tiles);
    });
    return result;
  }
};

// Phonological awareness items are generated from the phonics words so every sound has a picture.
function paItem(kind, stageIdx, avoid) {
  const pool = wordsUpTo(Math.max(stageIdx, 1)).filter(w => !avoid.includes(w.w));
  const pos = kind === 'first' ? 0 : kind === 'final' ? -1 : 'mid';
  const unitAt = w => { const u = spokenUnits(w); return pos === 0 ? u[0] : pos === -1 ? u[u.length - 1] : u.find(x => isVowel(x.p)); };
  const target = pick(pool.filter(w => unitAt(w)));
  const tp = unitAt(target).p;
  const foils = shuffle(pool.filter(w => w.w !== target.w && unitAt(w) && unitAt(w).p !== tp)).slice(0, 2);
  return { kind, target, phoneme: tp, foils };
}

const soundSeeds = {
  id: 'seeds', subskill: 'pa-sounds', itemId: it => 'pa-' + it.kind + ':' + it.target.w,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const where = it.kind === 'first' ? 'starts with' : it.kind === 'final' ? 'ends with' : 'has';
    const prompt = it.kind === 'medial' ? 'Which one has /' + it.phoneme + '/ in the middle?' : 'Which one ' + where + ' /' + it.phoneme + '/?';
    const choices = shuffle([it.target, ...it.foils]).map(x => ({ id: x.w, pic: x.p, label: x.w, ok: x === it.target, say: x.w }));
    stage.setObject(el('div'));
    stage.setPrompt(promptBar(audio, prompt));
    const grid = choiceGrid({ audio, prompt, items: choices, praise: praiseLine(), revealText: it.target.w + ' ' + where + ' /' + it.phoneme + '/.' });
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: 3, gpc: it.phoneme };
  }
};

const blendIt = {
  id: 'blend', subskill: 'pa-blend-segment', itemId: w => 'blend:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const sIdx = ctx.adaptive.stageIndex('pa-blend-segment');
    const foils = shuffle(minimalPairs(w, wordsUpTo(Math.max(sIdx, 1)))).slice(0, 2);
    const choices = shuffle([w, ...foils]).map(x => ({ id: x.w, pic: x.p, label: x.w, ok: x === w, say: x.w }));
    const soundsText = spokenUnits(w).map(u => '/' + u.p + '/').join(' ');
    const prompt = 'Listen: ' + soundsText + '. Which picture?';
    stage.setObject(el('div'));
    stage.setPrompt(promptBar(audio, prompt));
    const grid = choiceGrid({ audio, prompt, items: choices, praise: praiseLine(), revealText: soundsText + ' makes ' + w.w + '.' });
    stage.setBody(grid.el);
    await audio.say('Listen.');
    await audio.sequence(spokenUnits(w).flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }]));
    await audio.say('Which picture?');
    const r = await grid.done;
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: 3 };
  }
};

const countSounds = {
  id: 'count', subskill: 'pa-blend-segment', itemId: w => 'count:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const n = spokenUnits(w).length;
    const prompt = 'How many sounds in ' + w.w + '? Tap one gem for each sound.';
    stage.setObject(picture(w.p, () => audio.word(w.w)));
    stage.setPrompt(promptBar(audio, prompt));
    let on = 0, misses = 0;
    const boxes = Array.from({ length: 5 }, (_, i) => el('button', { class: 'gem-box', type: 'button', 'aria-label': 'gem ' + (i + 1), text: '' }));
    const row = el('div', { class: 'gem-row' }, boxes);
    const check = bigButton('Done', () => {}, 'gold');
    const result = await new Promise(resolve => {
      boxes.forEach((b, i) => b.addEventListener('click', () => { on = i + 1; boxes.forEach((x, k) => { x.classList.toggle('on', k < on); x.textContent = k < on ? '💎' : ''; }); audio.stop(); audio.word(w.w); }));
      check.addEventListener('click', async () => {
        if (on === n) {
          check.setAttribute('disabled', '');
          await audio.sequence(spokenUnits(w).flatMap((u, i) => i ? [{ gap: 400 }, { phoneme: u.p }] : [{ phoneme: u.p }]), { onStep: s => { /* no tiles */ } });
          audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 4 });
        } else {
          misses++;
          stage.luna('think', 900);
          if (misses === 1) { await audio.say('Listen and count.'); await audio.sequence(spokenUnits(w).flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }])); }
          else { on = n; boxes.forEach((x, k) => { x.classList.toggle('on', k < n); x.textContent = k < n ? '💎' : ''; }); await audio.say(w.w + ' has ' + n + ' sounds.'); check.click(); }
        }
      });
      stage.setBody(row, el('div', { class: 'row' }, [check]));
    });
    return result;
  }
};

const oralSwap = {
  id: 'oralswap', subskill: 'pa-manipulate', itemId: pair => 'oralswap:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, index } = pair;
    const other = shuffle(minimalPairs(from, wordsUpTo(6)).filter(x => x.w !== to.w)).slice(0, 1);
    const choices = shuffle([to, from, ...other]).map(x => ({ id: x.w, pic: x.p, label: x.w, ok: x === to, say: x.w }));
    const prompt = 'Say ' + from.w + '. Change /' + from.u[index][1] + '/ to /' + to.u[index][1] + '/. What is it now?';
    stage.setObject(picture(from.p, () => audio.word(from.w)));
    stage.setPrompt(promptBar(audio, prompt));
    const grid = choiceGrid({ audio, prompt, items: choices, praise: praiseLine(), revealText: 'Now it is ' + to.w + '.' });
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: choices.length };
  }
};

// Sound Swap pairs: two words in the pool differing in exactly one spoken unit at the same index.
function swapPairs(pool, n) {
  const out = [];
  const shuffled = shuffle(pool);
  for (const a of shuffled) {
    for (const b of shuffled) {
      if (a === b || a.u.length !== b.u.length) continue;
      const diff = a.u.map((u, i) => u[0] !== b.u[i][0] ? i : -1).filter(i => i >= 0);
      if (diff.length === 1 && a.u[diff[0]][1] && b.u[diff[0]][1]) { out.push({ from: a, to: b, index: diff[0] }); break; }
    }
    if (out.length >= n) break;
  }
  return out;
}

// ---------- rounds ----------
function buildRound(kind) {
  const enc = ctx.adaptive.stageIndex('phonics-encode');
  const dec = ctx.adaptive.stageIndex('phonics-decode');
  const pa = ctx.adaptive.stage('pa-sounds');
  const items = [];
  const used = [];
  const take = (family, item) => { items.push({ family, item }); if (item && item.w) used.push(item.w); };
  if (kind === 'spell') pickWords(enc, 6).forEach(w => take(wordSpell, w));
  else if (kind === 'read') pickWords(dec, 6).forEach(w => take(readRune, w));
  else if (kind === 'swap') swapPairs(wordsUpTo(enc), 6).forEach(p => take(soundSwap, p));
  else if (kind === 'seeds') {
    for (let i = 0; i < 6; i++) {
      const k = i < 3 ? pa : i === 3 ? 'blend' : i === 4 ? 'count' : 'oralswap';
      if (k === 'blend') take(blendIt, pickWords(dec, 1, { avoid: used })[0]);
      else if (k === 'count') take(countSounds, pickWords(enc, 1, { avoid: used })[0]);
      else if (k === 'oralswap') { const p = swapPairs(wordsUpTo(Math.max(enc, 1)), 1)[0]; if (p) take(oralSwap, p); else take(soundSeeds, paItem('first', enc, used)); }
      else take(soundSeeds, paItem(k, enc, used));
    }
  } else {
    // Today's mix: weighted toward the planner's target skill, always encode + decode + one PA + one swap.
    const target = ctx.adaptive.todayQuest().requiredSubskill;
    const w = pickWords(enc, 4);
    take(wordSpell, w[0]);
    take(readRune, pickWords(dec, 1, { avoid: used })[0]);
    take(soundSeeds, paItem(pa, enc, used));
    const sp = swapPairs(wordsUpTo(enc), 1)[0]; if (sp) take(soundSwap, sp); else take(wordSpell, w[1]);
    take(target === 'phonics-decode' ? readRune : target === 'pa-blend-segment' ? blendIt : wordSpell, pickWords(target === 'phonics-decode' ? dec : enc, 1, { avoid: used })[0]);
    take(target === 'pa-sounds' ? soundSeeds : target === 'pa-blend-segment' ? countSounds : readRune, target === 'pa-sounds' ? paItem(pa, enc, used) : pickWords(dec, 1, { avoid: used })[0]);
  }
  return items;
}

async function startRound(kind) {
  if (roundBusy) return; // BUG-04: one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'meadow', cabinetId: 'meadow', items: buildRound(kind), review: new Set(ctx.adaptive.reviewSkills('meadow')) });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const comp = ctx.economy.companion();
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: comp.level }));
  const modes = [
    { id: 'mix', icon: '🪄', name: "Today's magic", primary: true },
    { id: 'spell', icon: '🧱', name: 'Word Spell' },
    { id: 'read', icon: '🔮', name: 'Read the Rune' },
    { id: 'swap', icon: '🔁', name: 'Sound Swap' },
    { id: 'seeds', icon: '🌱', name: 'Sound Seeds' }
  ];
  host.replaceChildren(el('div', { class: 'scene meadow' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Unicorn Meadow' }), el('div', { class: 'line', text: 'The runes are waiting. Which magic today?' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Unicorn Meadow! Which magic today?');
}

export async function mount(h, c) {
  host = h; ctx = c;
  phonics = await ctx.content.load('phonics');
  const s = await ctx.content.load('sounds');
  sounds = Object.fromEntries(s.sounds.map(x => [x.id, x]));
  showMenu();
}

export function unmount() { cancelled = true; host = null; }
