// games/princess-quest/meadow.js — Unicorn Meadow: the phonics place (letters are always on screen here;
// listening-only work lives in Whisper Woods). Encounter families, in teaching order:
//   letterSound  letter ↔ sound: hear /s/ → tap the stone; see the stone → tap the picture (phonics-gpc)
//   wordSpell    encode: hear the word, build it from letter stones (tap-to-place or drag)
//   readRune     decode: stones show a word; tap each stone to hear it; find the picture
//   soundSwap    change one stone to make a new word (cat → bat)               (logged as encoding)
//   spellScroll  connected reading: a decodable sentence, tap the words, pick its picture
// The magic moment: when a word blends, its stones shimmer and a sparkle plays.
import { el, wait, shuffle, pick, choiceGrid, picture, promptBar, tileBoard, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { unitsOf } from '../../shared/audio.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, phonics = null, sounds = null, SENT = null, cancelled = false;

// ---------- content helpers ----------
function wordsUpTo(stageIdx) { return phonics.stages.slice(0, stageIdx + 1).flatMap(s => s.words); }
function wordsAt(stageIdx) { return phonics.stages[Math.min(stageIdx, phonics.stages.length - 1)].words; }
function graphemePool(stageIdx) { return [...new Set(phonics.stages.slice(0, stageIdx + 1).flatMap(s => s.graphemes))]; }
const spokenUnits = w => unitsOf({ units: w.u }).map((u, i) => ({ g: u[0], p: u[1], i })).filter(u => u.p);
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
const phonemeFor = g => (g in sounds ? g : g === 'c' ? 'k' : g === 'ck' ? 'k' : g.replace(/(.)\1/, '$1'));
const sparkle = () => { if (ctx.audio.sfx) ctx.audio.sfx.sparkle(); };
const shimmer = node => { if (!node) return; node.classList.remove('shimmer'); void node.offsetWidth; node.classList.add('shimmer'); };
// onStep wrapper: highlight per sound, and fire the magic (shimmer + sparkle) once, when the blend begins.
function blendSteps(highlight, node) {
  let fired = false;
  return s => { if (s.index !== undefined) highlight(s.index); if (s.kind === 'blend' && !fired) { fired = true; shimmer(typeof node === 'function' ? node() : node); sparkle(); } };
}

// Pick n words from the current stage, mixing in one review word from earlier stages.
function pickWords(stageIdx, n, { avoid = [] } = {}) {
  const cur = shuffle(wordsAt(stageIdx).filter(w => !avoid.includes(w.w)));
  const out = cur.slice(0, n);
  if (stageIdx > 0 && n >= 3) { const earlier = shuffle(wordsUpTo(stageIdx - 1)); if (earlier[0]) out[out.length - 1] = earlier[0]; }
  return out;
}
// Words whose unit at index i differs by exactly one grapheme from w (minimal pairs). Falls back to same-length words.
function minimalPairs(w, pool) {
  const same = shuffle(pool.filter(x => x.w !== w.w && x.p !== w.p && x.u.length === w.u.length));
  const pairs = same.filter(x => x.u.filter((u, i) => u[0] !== w.u[i][0]).length === 1);
  const rest = same.filter(x => !pairs.includes(x));
  const any = shuffle(pool.filter(x => x.w !== w.w && x.p !== w.p && !same.includes(x)));
  return [...shuffle(pairs), ...rest, ...any];
}
function distractorGraphemes(w, stageIdx, n) {
  const used = new Set(w.u.map(u => u[0]));
  const pool = graphemePool(stageIdx).filter(g => !used.has(g));
  const confusable = { b: ['d', 'p'], d: ['b', 'p'], p: ['b', 'q'], m: ['n', 'w'], n: ['m', 'u'], a: ['e', 'o'], e: ['a', 'i'], i: ['e', 'a'], o: ['a', 'u'], u: ['o', 'a'], c: ['k'], k: ['c'], f: ['t'], t: ['f'] };
  const wanted = [];
  for (const u of w.u) for (const c of (confusable[u[0]] || [])) if (pool.includes(c) && !wanted.includes(c)) wanted.push(c);
  const rest = shuffle(pool.filter(g => !wanted.includes(g)));
  return [...wanted, ...rest].slice(0, n);
}

// ---------- letter sounds (phonics-gpc) ----------
// Sets follow a common synthetic-phonics order; each stage adds a set and keeps the earlier ones as foils.
const GPC_SETS = { set1: ['s', 'a', 't', 'p', 'i', 'n'], set2: ['m', 'd', 'g', 'o', 'c', 'k'], set3: ['e', 'u', 'r', 'h', 'b', 'f'], set4: ['l', 'j', 'v', 'w', 'x', 'y', 'z', 'qu'], digraphs: ['sh', 'ch', 'th', 'ng'] };
const GPC_ORDER = Object.keys(GPC_SETS);
function gpcPool(stageName) { const i = Math.max(0, GPC_ORDER.indexOf(stageName)); return GPC_ORDER.slice(0, i + 1).flatMap(k => GPC_SETS[k]); }
// Pictures that start with a sound: the sound's keyword plus phonics words whose first spoken unit is that sound.
function startsWith(p) {
  // The keyword picture counts only when the word really begins with the sound (kite is the keyword for
  // long i but starts with /k/; cake for long a starts with /k/).
  const spellings = p === 'k' ? ['k', 'c'] : [p];
  const kw = sounds[p] && spellings.some(g => sounds[p].word.startsWith(g)) ? { w: sounds[p].word, p: sounds[p].pic } : null;
  const fromWords = phonics.stages.flatMap(s => s.words).filter(w => spokenUnits(w)[0] && spokenUnits(w)[0].p === p);
  const seen = new Set();
  return [...(kw ? [kw] : []), ...fromWords].filter(w => !seen.has(w.p) && seen.add(w.p));
}
function endsWith(p) { return phonics.stages.flatMap(s => s.words).filter(w => { const u = spokenUnits(w); return u.length && u[u.length - 1].p === p; }); }
function gpcItem(stageName, avoid) {
  const cur = GPC_SETS[stageName] || GPC_SETS.set1;
  const all = gpcPool(stageName);
  const from = (Math.random() < 0.7 ? cur : all).filter(x => !avoid.includes(x));
  const g = pick(from.length ? from : cur);
  const p = phonemeFor(g);
  const kind = Math.random() < 0.5 ? 'hear' : 'see';
  if (kind === 'hear') {
    // Foils carry different sounds from the target and from each other (c and k never share a row).
    const used = new Set([p]);
    const foils = shuffle(all.filter(x => x !== g)).filter(x => !used.has(phonemeFor(x)) && used.add(phonemeFor(x))).slice(0, 2);
    return { kind, g, p, options: shuffle([g, ...foils]) };
  }
  const atEnd = p === 'ng' || p === 'x';
  const targets = atEnd ? endsWith(p) : startsWith(p);
  const target = pick(targets);
  const others = all.map(phonemeFor).filter(x => x !== p);
  const pics = new Set([target.p]);
  const foils = shuffle(others.flatMap(x => (atEnd ? endsWith(x) : startsWith(x)))).filter(w => !pics.has(w.p) && pics.add(w.p)).slice(0, 2);
  return { kind, g, p, target, foils, atEnd };
}
const letterSound = {
  id: 'gpc', subskill: 'phonics-gpc', itemId: it => 'gpc-' + it.kind + ':' + it.g,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'hear') {
      const prompt = 'Listen: /' + it.p + '/. Which letter stone makes that sound?';
      stage.setObject(el('div', { class: 'picture', text: '👂' }));
      stage.setPrompt(promptBar(audio, prompt, { ears: true }));
      const items = it.options.map(g => ({ id: g, pic: '', label: g, ok: g === it.g, say: '/' + phonemeFor(g) + '/', textOnly: true }));
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This stone says /' + it.p + '/.' });
      grid.el.classList.add('three');
      grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
      stage.setBody(grid.el);
      await audio.say('Listen.');
      await audio.phoneme(it.p);
      await audio.say('Which letter stone makes that sound?');
      const r = await grid.done;
      if (!r.revealed) { shimmer(grid.el.querySelector('.right')); sparkle(); }
      return { outcome: outcomeOf(r), choices: 3, gpc: it.g };
    }
    const where = it.atEnd ? 'ends' : 'starts';
    const prompt = 'Tap the stone to hear its sound. Which picture ' + where + ' with that sound?';
    const stone = el('button', { class: 'rune', type: 'button', text: it.g, 'aria-label': 'letter stone ' + it.g, style: 'font-size:56px;min-width:96px;min-height:96px' });
    stone.addEventListener('click', () => { audio.stop(); audio.phoneme(it.p); stone.classList.add('lit'); });
    stage.setObject(stone);
    stage.setPrompt(promptBar(audio, prompt));
    const items = shuffle([it.target, ...it.foils]).map(x => ({ id: x.w, pic: x.p, ok: x === it.target, say: x.w }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: it.g + ' says /' + it.p + '/. ' + it.target.w + ' ' + where + ' with /' + it.p + '/.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say('This stone says');
    await audio.phoneme(it.p);
    await audio.say('Which picture ' + where + ' with /' + it.p + '/?');
    const r = await grid.done;
    if (!r.revealed) { shimmer(stone); sparkle(); }
    return { outcome: outcomeOf(r), choices: 3, gpc: it.g };
  }
};

// ---------- word spell (encode) ----------
const wordSpell = {
  id: 'spell', subskill: 'phonics-encode', itemId: w => 'spell:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const units = w.u;
    const sIdx = ctx.adaptive.stageIndex('phonics-encode');
    const tiles = shuffle([
      ...units.map((u, i) => ({ id: 'u' + i, grapheme: u[0], phoneme: u[1] || null })),
      ...distractorGraphemes(w, sIdx, units.length <= 3 ? 2 : 1).map((g, i) => ({ id: 'd' + i, grapheme: g, phoneme: phonemeFor(g) }))
    ]);
    const shown = 'Build the word you hear. Put the letter stones in order.';
    const prompt = 'Build the word ' + w.w + '. Put the letter stones in order.';
    stage.setObject(picture(w.p, () => { audio.stop(); audio.word(w.w); }));
    stage.setPrompt(promptBar(audio, shown, { speak: prompt, replay: w.w }));
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
          await audio.decode({ word: w.w, units }, { onStep: blendSteps(i => board.highlight(i), () => board.el.querySelector('.slots')) });
          board.clearHighlight();
          await audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: tiles.length, gpc: units.map(u => u[0]).join('') });
          return;
        }
        misses++;
        const slotEls = board.el.querySelectorAll('.slot');
        wrong.forEach(i => { slotEls[i].classList.add('wrong'); setTimeout(() => slotEls[i].classList.remove('wrong'), 600); });
        stage.luna('think', 900);
        if (misses === 1) {
          wrong.forEach(i => board.setSlot(i, null));
          const need = tiles.find(t => t.id === 'u' + wrong[0]);
          board.hintSlot(wrong[0]); board.hintTile(need.id);
          await audio.say('Listen for this sound: ' + (units[wrong[0]][1] ? '/' + units[wrong[0]][1] + '/' : 'the quiet letter ' + units[wrong[0]][0]) + '. Find its stone.');
        } else {
          board.clearHints();
          units.forEach((u, i) => board.setSlot(i, 'u' + i));
          board.lock();
          await audio.say('Here it is. Let us read it together.');
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

// ---------- letter stones (decode) ----------
function runeRow(audio, w, { onTap } = {}) {
  const units = w.u;
  const row = el('div', { class: 'row' });
  const runes = units.map((u, i) => {
    const r = el('button', { class: 'rune', type: 'button', text: u[0], 'aria-label': 'letter stone ' + u[0] });
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
    const prompt = 'Tap each letter stone to hear its sound. Read the word. Then tap its picture.';
    const runes = runeRow(audio, w);
    stage.setObject(el('div'));
    stage.setPrompt(promptBar(audio, prompt));
    const wand = el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Blend it', text: '🪄', onclick: async () => { await audio.decode({ word: w.w, units: w.u }, { onStep: blendSteps(runes.highlight, runes.row) }); runes.clear(); } });
    const grid = choiceGrid({ audio, prompt: 'Which picture matches the word?', items: choices, praise: praiseLine(), revealText: 'The word says ' + w.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(el('div', { class: 'row' }, [runes.row, wand]), grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    await audio.decode({ word: w.w, units: w.u }, { onStep: blendSteps(runes.highlight, runes.row) });
    runes.clear();
    return { outcome: outcomeOf(r), choices: choices.length, gpc: w.u.map(u => u[0]).join('') };
  }
};

// ---------- sound swap (change one stone) ----------
const soundSwap = {
  id: 'swap', subskill: 'phonics-encode', itemId: pair => 'swap:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, index } = pair;
    const oldU = from.u[index], newU = to.u[index];
    const sIdx = ctx.adaptive.stageIndex('phonics-encode');
    const options = shuffle([newU[0], ...distractorGraphemes(to, sIdx, 4).filter(g => g !== oldU[0] && g !== newU[0]).slice(0, 2)]);
    const prompt = 'This says ' + from.w + '. Change /' + oldU[1] + '/ to /' + newU[1] + '/ to make ' + to.w + '.';
    const shown = 'Change one letter stone to make the new word you hear.';
    const runes = runeRow(audio, from);
    stage.setObject(picture(from.p, () => { audio.stop(); audio.word(from.w); }));
    stage.setPrompt(promptBar(audio, shown, { speak: prompt }));
    await audio.say(prompt);
    let misses = 0;
    const result = await new Promise(resolve => {
      const tiles = el('div', { class: 'row' }, options.map(g => {
        const t = el('button', { class: 'tile', type: 'button', text: g, 'aria-label': 'tile ' + g });
        t.addEventListener('click', async () => {
          audio.stop();
          audio.phoneme(phonemeFor(g));
          if (g === newU[0]) {
            tiles.querySelectorAll('.tile').forEach(x => x.setAttribute('disabled', ''));
            runes.runes[index].textContent = g;
            runes.runes[index].classList.add('now');
            stage.setObject(picture(to.p, () => { audio.stop(); audio.word(to.w); }));
            await wait(200);
            await audio.swap({ word: to.w, units: to.u }, index, { onStep: blendSteps(runes.highlight, runes.row) });
            runes.clear();
            await audio.say(praiseLine());
            resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: options.length, gpc: newU[0] });
          } else {
            misses++;
            t.classList.add('wobble'); setTimeout(() => t.classList.remove('wobble'), 600);
            stage.luna('think', 900);
            if (misses === 1) { t.classList.add('used'); t.setAttribute('disabled', ''); const right = [...tiles.querySelectorAll('.tile')].find(x => x.textContent === newU[0]); right.classList.add('glow'); audio.say('We need /' + newU[1] + '/. Tap the glowing stone.'); }
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
function swapPairs(pool, n) {
  const out = [];
  const shuffled = shuffle(pool);
  for (const a of shuffled) {
    for (const b of shuffled) {
      if (a === b || a.u.length !== b.u.length || a.p === b.p) continue;
      const diff = a.u.map((u, i) => u[0] !== b.u[i][0] ? i : -1).filter(i => i >= 0);
      if (diff.length === 1 && a.u[diff[0]][1] && b.u[diff[0]][1]) { out.push({ from: a, to: b, index: diff[0] }); break; }
    }
    if (out.length >= n) break;
  }
  return out;
}

// ---------- spell scroll (connected decodable reading) ----------
export function sentenceRow(audio, text, { onWord = null } = {}) {
  const words = text.split(/\s+/);
  const row = el('div', { class: 'sentence' });
  const buttons = words.map((w, i) => {
    const clean = w.replace(/[^A-Za-z']/g, '');
    const b = el('button', { class: 'sword', type: 'button', text: w, 'aria-label': clean });
    b.addEventListener('click', () => { audio.stop(); audio.word(clean.toLowerCase()); buttons.forEach(x => x.classList.remove('now')); b.classList.add('now'); if (onWord) onWord(clean, i, b); });
    row.appendChild(b);
    return b;
  });
  return { row, buttons, words };
}
function scrollStageIdx() {
  const readIdx = ctx.adaptive.stageIndex('decodable-reading');
  const decIdx = Math.min(3, ctx.adaptive.stageIndex('phonics-decode'));
  return Math.min(readIdx, Math.max(0, decIdx));
}
function pickSentences(n, avoid = []) {
  const idx = scrollStageIdx();
  const ok = SENT.sentences.filter(s => ['a', 'b', 'c', 'd'].indexOf(s.stage) <= idx && !avoid.includes(s.id));
  const known = ctx.economy.save.sightWords;
  const ready = ok.filter(s => s.hearts.every(h => known[h] && known[h].introducedDay));
  const at = xs => xs.filter(s => s.stage === ['a', 'b', 'c', 'd'][idx]);
  const order = [...shuffle(at(ready)), ...shuffle(ready.filter(s => !at(ready).includes(s))), ...shuffle(ok.filter(s => !ready.includes(s)))];
  return order.slice(0, n);
}
const spellScroll = {
  id: 'scroll', subskill: 'decodable-reading', itemId: s => 'scroll:' + s.id,
  async play(stage, s, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Luna found a spell scroll. Tap each word to read it. Then tap the picture that matches.';
    stage.setObject(el('div', { class: 'picture', text: '📜' }));
    stage.setPrompt(promptBar(audio, prompt));
    const sent = sentenceRow(audio, s.text);
    const items = shuffle(s.choices).map(c => ({ id: c.pic, pic: c.pic, ok: c.ok, say: c.ok ? s.text : 'not this one' }));
    const grid = choiceGrid({ audio, prompt: 'Which picture matches the scroll?', items, praise: praiseLine(), revealText: 'The scroll says: ' + s.text });
    grid.el.classList.add('three', 'wide');
    stage.setBody(sent.row, grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    shimmer(sent.row); if (!r.revealed) sparkle();
    await audio.say(s.text);
    return { outcome: outcomeOf(r), choices: 3, gpc: s.stage };
  }
};

// ---------- rounds ----------
function buildRound(kind) {
  const enc = ctx.adaptive.stageIndex('phonics-encode');
  const dec = ctx.adaptive.stageIndex('phonics-decode');
  const gpcStage = ctx.adaptive.stage('phonics-gpc');
  const items = [];
  const used = [];
  const take = (family, item) => { if (!item) return; items.push({ family, item }); if (item && item.w) used.push(item.w); if (item && item.g) used.push(item.g); };
  const fam = {
    gpc: () => take(letterSound, gpcItem(gpcStage, used.filter(x => x.length <= 2))),
    spell: () => take(wordSpell, pickWords(enc, 1, { avoid: used })[0]),
    read: () => take(readRune, pickWords(dec, 1, { avoid: used })[0]),
    swap: () => { const p = swapPairs(wordsUpTo(enc), 1)[0]; if (p) take(soundSwap, p); else fam.spell(); },
    scroll: () => { const s = pickSentences(1, items.filter(i => i.family === spellScroll).map(i => i.item.id))[0]; if (s) take(spellScroll, s); else fam.read(); }
  };
  if (kind === 'spell') pickWords(enc, 6).forEach(w => take(wordSpell, w));
  else if (kind === 'read') pickWords(dec, 6).forEach(w => take(readRune, w));
  else if (kind === 'swap') { swapPairs(wordsUpTo(enc), 6).forEach(p => take(soundSwap, p)); while (items.length < 6) fam.spell(); }
  else if (kind === 'gpc') for (let i = 0; i < 6; i++) fam.gpc();
  else if (kind === 'scroll') { pickSentences(5).forEach(s => take(spellScroll, s)); fam.read(); }
  else {
    // Today's magic: the planner's target twice, one of each other family, the scroll as the finale.
    const target = ctx.adaptive.targetFor('meadow');
    const tKey = { 'phonics-gpc': 'gpc', 'phonics-encode': 'spell', 'phonics-decode': 'read', 'decodable-reading': 'scroll' }[target] || 'spell';
    const others = ['gpc', 'spell', 'read', 'swap'].filter(k => k !== tKey);
    fam[tKey](); fam[others[0]](); fam[others[1]](); fam[tKey](); fam[others[2]]();
    if (tKey !== 'scroll') fam.scroll(); else fam.read();
  }
  return items.slice(0, 6);
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
    { id: 'gpc', icon: '🔊', name: 'Letter Sounds' },
    { id: 'spell', icon: '🧱', name: 'Word Spell' },
    { id: 'read', icon: '🔮', name: 'Letter Stones' },
    { id: 'swap', icon: '🔁', name: 'Sound Swap' },
    { id: 'scroll', icon: '📜', name: 'Spell Scroll' }
  ];
  host.replaceChildren(el('div', { class: 'scene meadow' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Unicorn Meadow' }), el('div', { class: 'line', text: 'The letter stones are glowing. Which magic today?' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Unicorn Meadow! Which magic today?');
}

export async function mount(h, c) {
  host = h; ctx = c;
  phonics = await ctx.content.load('phonics');
  SENT = await ctx.content.load('sentences');
  const s = await ctx.content.load('sounds');
  sounds = Object.fromEntries(s.sounds.map(x => [x.id, x]));
  showMenu();
}

export function unmount() { cancelled = true; host = null; }
export const __test = { gpcItem, swapPairs, minimalPairs, distractorGraphemes, init({ phonics: p, sounds: s, sentences }) { phonics = p; sounds = s; SENT = sentences; } };
