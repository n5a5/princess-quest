// games/princess-quest/woods.js — Whisper Woods: phonological awareness, EARS ONLY.
// Nothing here shows a letter. Choices are pictures with no printed word; sound tokens in the prompt
// render as ear buttons (audio.spans ears mode) so the child solves every item by listening.
// Families:
//   soundSeeds  first / final / middle sound: "Which one starts with /m/?"          (pa-sounds)
//   blendIt     oral blending: /k/ /a/ /t/ → which picture?                          (pa-blend-segment)
//   countSounds oral segmenting: light one gem per sound                              (pa-blend-segment)
//   oralSwap    change a sound: "Say box. Change /b/ to /f/."                         (pa-manipulate)
//   takeAway    delete a sound: "Say snap. Take away /s/. What is left?"              (pa-manipulate)
//   rhymeIt     "Which one rhymes with cat?"                                          (pa-rhyme)
//   beats       syllables: tap one gem per beat                                       (pa-rhyme)
//   onsetRime   "/k/ ... /at/. Which picture?"                                        (pa-rhyme)
// Every spoken word comes from content/phonics.json (pictures + bundled clips) or content/pa.json.
import { el, wait, shuffle, pick, choiceGrid, picture, promptBar, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { unitsOf } from '../../shared/audio.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, phonics = null, sounds = null, PA = null, cancelled = false;

// ---------- content helpers ----------
const allWords = () => phonics.stages.flatMap(s => s.words);
const spokenUnits = w => unitsOf({ units: w.u }).map((u, i) => ({ g: u[0], p: u[1], i })).filter(u => u.p);
const isVowel = id => sounds[id] && sounds[id].kind === 'vowel';
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
// Pictures only: no label, no printed word. `say` is what the picture speaks when tapped after reveal.
const picChoices = (target, foils) => shuffle([target, ...foils]).map(x => ({ id: x.w, pic: x.p, ok: x === target, say: x.w }));
const vowelIndex = w => w.u.findIndex(u => isVowel(u[1]));
const rimeOf = w => { const v = vowelIndex(w); return v < 0 ? null : w.u.slice(v).map(u => u[0]).join(''); };
const onsetOf = w => { const v = vowelIndex(w); return v <= 0 ? [] : w.u.slice(0, v).filter(u => u[1]).map(u => u[1]); };
// Words a beginner has heard many times: short ones first, longer ones once she is past the first stages.
function pool(stageIdx) { return phonics.stages.slice(0, Math.max(2, stageIdx + 2)).flatMap(s => s.words); }

// ---------- families ----------
function paItem(kind, stageIdx, avoid) {
  const words = pool(stageIdx).filter(w => !avoid.includes(w.w));
  const unitAt = w => { const u = spokenUnits(w); return kind === 'first' ? u[0] : kind === 'final' ? u[u.length - 1] : u.find(x => isVowel(x.p)); };
  const target = pick(words.filter(w => unitAt(w)));
  const tp = unitAt(target).p;
  const foils = shuffle(words.filter(w => w.w !== target.w && w.p !== target.p && unitAt(w) && unitAt(w).p !== tp)).slice(0, 2);
  return { kind, target, phoneme: tp, foils };
}
const soundSeeds = {
  id: 'seeds', subskill: 'pa-sounds', itemId: it => 'pa-' + it.kind + ':' + it.target.w,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const where = it.kind === 'first' ? 'starts with' : it.kind === 'final' ? 'ends with' : 'has';
    const prompt = it.kind === 'medial' ? 'Listen. Which one has /' + it.phoneme + '/ in the middle?' : 'Listen. Which one ' + where + ' /' + it.phoneme + '/?';
    stage.setObject(el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(it.target, it.foils), praise: praiseLine(), revealText: it.target.w + ' ' + where + ' /' + it.phoneme + '/.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: it.phoneme };
  }
};

const blendIt = {
  id: 'blend', subskill: 'pa-blend-segment', itemId: w => 'blend:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const sIdx = ctx.adaptive.stageIndex('pa-blend-segment');
    const foils = shuffle(pool(sIdx).filter(x => x.w !== w.w && x.p !== w.p && x.u.length === w.u.length)).slice(0, 2);
    const units = spokenUnits(w);
    const soundsText = units.map(u => '/' + u.p + '/').join(' ');
    const prompt = 'Luna says a word in pieces: ' + soundsText + '. Put the sounds together. Which picture is it?';
    stage.setObject(el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(w, foils), praise: praiseLine(), revealText: soundsText + ' makes ' + w.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say('Luna says a word in pieces. Put the sounds together.');
    await audio.sequence(units.flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }]));
    await audio.say('Which picture is it?');
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// Gem row: tap the nth gem to light 1..n. Used for counting sounds and counting beats.
function gemCounter(audio, max, onTap) {
  const boxes = Array.from({ length: max }, (_, i) => el('button', { class: 'gem-box', type: 'button', 'aria-label': 'gem ' + (i + 1), text: '' }));
  const row = el('div', { class: 'gem-row' }, boxes);
  let on = 0;
  const set = n => { on = n; boxes.forEach((x, k) => { x.classList.toggle('on', k < on); x.textContent = k < on ? '💎' : ''; }); };
  boxes.forEach((b, i) => b.addEventListener('click', () => { set(i + 1); onTap && onTap(on); }));
  return { row, boxes, count: () => on, set };
}

const countSounds = {
  id: 'count', subskill: 'pa-blend-segment', itemId: w => 'count:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const units = spokenUnits(w);
    const n = units.length;
    const prompt = 'Say ' + w.w + ' slowly. How many sounds do you hear? Light one gem for each sound.';
    stage.setObject(picture(w.p, () => { audio.stop(); audio.word(w.w); }));
    stage.setPrompt(promptBar(audio, 'Say the word slowly. How many sounds do you hear? Light one gem for each sound.', { ears: true, speak: prompt, replay: w.w }));
    await audio.say(prompt);
    let misses = 0;
    const counter = gemCounter(audio, 5, () => { audio.stop(); audio.word(w.w); });
    const check = bigButton('Done', () => {}, 'gold');
    const result = await new Promise(resolve => {
      check.addEventListener('click', async () => {
        if (counter.count() === n) {
          check.setAttribute('disabled', '');
          await audio.sequence(units.flatMap((u, i) => i ? [{ gap: 400 }, { phoneme: u.p }] : [{ phoneme: u.p }]));
          await audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 4 });
        } else {
          misses++;
          stage.luna('think', 900);
          if (misses === 1) { await audio.say('Listen and count each sound.'); await audio.sequence(units.flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }])); }
          else { counter.set(n); await audio.say(w.w + ' has ' + n + ' sounds.'); check.click(); }
        }
      });
      stage.setBody(counter.row, el('div', { class: 'row' }, [check]));
    });
    return result;
  }
};

// Two words differing in exactly one spoken unit at the same position (cat → bat, pin → pan).
function swapPairs(words, n) {
  const out = [];
  const shuffled = shuffle(words);
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
const oralSwap = {
  id: 'oralswap', subskill: 'pa-manipulate', itemId: pair => 'oralswap:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, index } = pair;
    const other = shuffle(allWords().filter(x => x.w !== to.w && x.w !== from.w && x.p !== to.p && x.p !== from.p && x.u.length === from.u.length)).slice(0, 1);
    const prompt = 'Say ' + from.w + '. Now change /' + from.u[index][1] + '/ to /' + to.u[index][1] + '/. What word is it now?';
    stage.setObject(picture(from.p, () => { audio.stop(); audio.word(from.w); }));
    stage.setPrompt(promptBar(audio, 'Say this word. Now change /' + from.u[index][1] + '/ to /' + to.u[index][1] + '/. What word is it now?', { ears: true, speak: prompt }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(to, [from, ...other]), praise: praiseLine(), revealText: 'Now it is ' + to.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// Deletion pairs: taking the first (or last) sound off one word leaves another word we have a picture for.
function deletePairs(words) {
  const byWord = Object.fromEntries(words.map(w => [w.w, w]));
  const out = [];
  for (const w of words) {
    const rest = w.u.slice(1).map(u => u[0]).join('');
    if (byWord[rest] && w.u[0][1] && byWord[rest].p !== w.p) out.push({ from: w, to: byWord[rest], where: 'first', phoneme: w.u[0][1] });
    const head = w.u.slice(0, -1).map(u => u[0]).join('');
    const last = w.u[w.u.length - 1];
    if (byWord[head] && last[1] && byWord[head].p !== w.p) out.push({ from: w, to: byWord[head], where: 'last', phoneme: last[1] });
  }
  return shuffle(out);
}
const takeAway = {
  id: 'takeaway', subskill: 'pa-manipulate', itemId: pair => 'takeaway:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, phoneme, where } = pair;
    const other = shuffle(allWords().filter(x => x.w !== to.w && x.w !== from.w && x.p !== to.p && x.p !== from.p && x.u.length === to.u.length)).slice(0, 1);
    const prompt = 'Say ' + from.w + '. Now take away the ' + where + ' sound, /' + phoneme + '/. What word is left?';
    stage.setObject(picture(from.p, () => { audio.stop(); audio.word(from.w); }));
    stage.setPrompt(promptBar(audio, 'Say this word. Now take away the ' + where + ' sound, /' + phoneme + '/. What word is left?', { ears: true, speak: prompt }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(to, [from, ...other]), praise: praiseLine(), revealText: from.w + ' without /' + phoneme + '/ is ' + to.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// Rhyme: target word plus one true rhyme (same rime) and two non-rhymes.
function rhymeItem(stageIdx, avoid) {
  const words = pool(stageIdx).filter(w => !avoid.includes(w.w) && rimeOf(w));
  const groups = {};
  for (const w of words) (groups[rimeOf(w)] = groups[rimeOf(w)] || []).push(w);
  const rime = pick(Object.keys(groups).filter(r => groups[r].length >= 2));
  const [target, answer] = shuffle(groups[rime]).slice(0, 2);
  const foils = shuffle(words.filter(w => rimeOf(w) !== rime && w.p !== target.p && w.p !== answer.p)).slice(0, 2);
  return { target, answer, foils };
}
const rhymeIt = {
  id: 'rhyme', subskill: 'pa-rhyme', itemId: it => 'rhyme:' + it.target.w + '>' + it.answer.w,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Rhymes sound the same at the end: ' + it.target.w + ', ' + it.answer.w + '. Which one rhymes with ' + it.target.w + '?';
    const ask = 'Which one rhymes with ' + it.target.w + '?';
    stage.setObject(picture(it.target.p, () => { audio.stop(); audio.word(it.target.w); }));
    stage.setPrompt(promptBar(audio, 'Which one rhymes with this one?', { ears: true, speak: ask, replay: it.target.w }));
    const grid = choiceGrid({ audio, prompt: ask, items: picChoices(it.answer, it.foils), praise: praiseLine(), revealText: it.target.w + ' and ' + it.answer.w + ' rhyme.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(ask);
    const r = await grid.done;
    void prompt;
    return { outcome: outcomeOf(r), choices: 3, gpc: rimeOf(it.target) };
  }
};

const beats = {
  id: 'beats', subskill: 'pa-rhyme', itemId: it => 'beats:' + it.word,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Say ' + it.word + '. Clap the beats. How many beats? Light one gem for each beat.';
    stage.setObject(picture(it.pic, () => { audio.stop(); audio.word(it.word); }));
    stage.setPrompt(promptBar(audio, 'Say the word. Clap the beats. How many beats? Light one gem for each beat.', { ears: true, speak: prompt, replay: it.word }));
    await audio.say(prompt);
    let misses = 0;
    const counter = gemCounter(audio, 4, () => { audio.stop(); audio.word(it.word); });
    const check = bigButton('Done', () => {}, 'gold');
    const result = await new Promise(resolve => {
      check.addEventListener('click', async () => {
        if (counter.count() === it.n) {
          check.setAttribute('disabled', '');
          await audio.say(it.word + '. ' + it.n + (it.n === 1 ? ' beat.' : ' beats.'));
          await audio.say(praiseLine());
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 4 });
        } else {
          misses++;
          stage.luna('think', 900);
          if (misses === 1) { await audio.say('Say it slowly and clap each part. ' + it.word + '.'); }
          else { counter.set(it.n); await audio.say(it.word + ' has ' + it.n + (it.n === 1 ? ' beat.' : ' beats.')); check.click(); }
        }
      });
      stage.setBody(counter.row, el('div', { class: 'row' }, [check]));
    });
    return result;
  }
};

const onsetRime = {
  id: 'onsetrime', subskill: 'pa-rhyme', itemId: w => 'onsetrime:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const onset = onsetOf(w);
    const rime = w.u.slice(vowelIndex(w)).filter(u => u[1]).map(u => u[1]);
    const foils = shuffle(allWords().filter(x => x.w !== w.w && x.p !== w.p && x.u.length === w.u.length && onsetOf(x)[0] === onset[0])).slice(0, 2);
    const more = foils.length < 2 ? shuffle(allWords().filter(x => x.w !== w.w && x.p !== w.p && !foils.includes(x) && x.u.length === w.u.length)).slice(0, 2 - foils.length) : [];
    const prompt = 'Luna says a word in two parts: ' + onset.map(p => '/' + p + '/').join(' ') + ' ... ' + rime.map(p => '/' + p + '/').join('') + '. Which picture is it?';
    stage.setObject(el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(w, [...foils, ...more]), praise: praiseLine(), revealText: 'It is ' + w.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say('Luna says a word in two parts.');
    await audio.sequence([...onset.map(p => ({ phoneme: p })), { gap: 600 }, { blend: rime }]);
    await audio.say('Which picture is it?');
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// ---------- rounds ----------
function buildRound(kind) {
  const sIdx = Math.max(ctx.adaptive.stageIndex('pa-blend-segment'), 0);
  const items = [];
  const used = [];
  const take = (family, item) => { if (!item) return; items.push({ family, item }); const w = item.w || (item.target && item.target.w) || item.word; if (w) used.push(w); };
  const words = () => pool(sIdx).filter(w => !used.includes(w.w));
  const seed = () => take(soundSeeds, paItem(ctx.adaptive.stage('pa-sounds'), sIdx, used));
  const blend = () => take(blendIt, pick(words().filter(w => spokenUnits(w).length <= (sIdx ? 5 : 3))));
  const count = () => take(countSounds, pick(words().filter(w => spokenUnits(w).length <= (sIdx ? 5 : 3))));
  const manip = () => { const st = ctx.adaptive.stage('pa-manipulate'); const d = st === 'delete' ? deletePairs(allWords())[0] : null; if (d) take(takeAway, d); else { const p = swapPairs(pool(sIdx), 1)[0]; if (p) take(oralSwap, p); else seed(); } };
  const rhyme = () => { const st = ctx.adaptive.stage('pa-rhyme'); if (st === 'syllables') { const [word, n, pic] = pick(PA.syllables.filter(s => !used.includes(s[0]))); take(beats, { word, n, pic }); } else if (st === 'onset-rime') take(onsetRime, pick(words().filter(w => onsetOf(w).length >= 1))); else take(rhymeIt, rhymeItem(sIdx, used)); };
  const by = { seeds: seed, blend: () => (items.length % 2 ? blend : count)(), swap: manip, rhyme };
  if (by[kind]) { for (let i = 0; i < 6; i++) by[kind](); return items; }
  // Today's whisper: the planner's target skill twice, then one of each other family.
  const target = ctx.adaptive.targetFor('woods') || 'pa-sounds';
  const fnFor = { 'pa-sounds': seed, 'pa-blend-segment': blend, 'pa-manipulate': manip, 'pa-rhyme': rhyme }[target] || seed;
  fnFor(); seed(); rhyme(); fnFor(); blend(); manip();
  return items.slice(0, 6);
}

async function startRound(kind) {
  if (roundBusy) return;
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'woods', cabinetId: 'woods', items: buildRound(kind), review: new Set(ctx.adaptive.reviewSkills('woods')) });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'mix', icon: '👂', name: "Today's whispers", primary: true },
    { id: 'seeds', icon: '🌱', name: 'Sound Seeds' },
    { id: 'blend', icon: '🫧', name: 'Sound Bubbles' },
    { id: 'rhyme', icon: '🎶', name: 'Rhyme Time' },
    { id: 'swap', icon: '🍃', name: 'Whisper Swap' }
  ];
  host.replaceChildren(el('div', { class: 'scene woods' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Whisper Woods' }), el('div', { class: 'line', text: 'Close your eyes and listen. The woods whisper in sounds.' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Whisper Woods! Listen closely. What shall we hear today?');
}

export async function mount(h, c) {
  host = h; ctx = c;
  phonics = await ctx.content.load('phonics');
  PA = await ctx.content.load('pa');
  const s = await ctx.content.load('sounds');
  sounds = Object.fromEntries(s.sounds.map(x => [x.id, x]));
  showMenu();
}
export function unmount() { cancelled = true; host = null; }
export const __test = { paItem, rhymeItem, deletePairs, swapPairs, onsetOf, rimeOf, pool, init({ phonics: p, sounds: s, pa }) { phonics = p; sounds = s; PA = pa; } };
