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
import { mouthSVG } from '../../shared/mouths.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, phonics = null, sounds = null, PA = null, cancelled = false;

// ---------- content helpers ----------
// Ears-only work needs pictures a 6-year-old names one way, and words whose sounds are coded truly:
// - pictures most children call something else (🐕 wag → "dog", 🫙 jam → "jar", ✔️ tick → "check") or that
//   print a word (🔙 back) flip the sound being tested;
// - wash and bush are coded with the vowel of cash and hush, which they do not have;
// - x is two sounds (/k/ /s/) and qu is /k/ /w/, but each is one letter stone, so counting and final sounds go wrong.
const EAR_SKIP = new Set(['wag', 'ram', 'yak', 'yam', 'hen', 'fin', 'mop', 'hop', 'tub', 'cap', 'nut', 'jam', 'pot', 'log', 'shut',
  'thud', 'chug', 'cash', 'rich', 'shop', 'tick', 'nap', 'chin', 'thin', 'back', 'wash', 'bush',
  // later stages (the 'long' blend pool): ⚽ ball, 🦒 giraffe, 🐫 camel, 🖥️ computer, 🛗 elevator, 🥢 chopsticks, 🚛 truck, 🎯 target, 🌷 flower, 🟦 square
  'kick', 'neck', 'hump', 'desk', 'lift', 'stick', 'dump', 'spot', 'stem', 'block', 'ink']);
const earOk = w => !EAR_SKIP.has(w.w) && !w.u.some(u => u[0] === 'x' || u[0] === 'qu');
const allWords = () => phonics.stages.flatMap(s => s.words).filter(earOk);
const spokenUnits = w => unitsOf({ units: w.u }).map((u, i) => ({ g: u[0], p: u[1], i })).filter(u => u.p);
const isVowel = id => sounds[id] && sounds[id].kind === 'vowel';
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
// Pictures only: no label, no printed word. `say` is what the picture speaks when tapped after reveal.
const picChoices = (target, foils, why = null) => shuffle([target, ...foils]).map(x => ({ id: x.w, pic: x.p, ok: x === target, say: x.w, why: why && x !== target ? why(x) : null }));
const soundAt = (w, kind) => { const u = spokenUnits(w); const x = kind === 'first' ? u[0] : kind === 'final' ? u[u.length - 1] : u.find(y => isVowel(y.p)); return x ? x.p : null; };
const vowelIndex = w => w.u.findIndex(u => isVowel(u[1]));
const rimeOf = w => { const v = vowelIndex(w); return v < 0 ? null : w.u.slice(v).map(u => u[0]).join(''); };
const onsetOf = w => { const v = vowelIndex(w); return v <= 0 ? [] : w.u.slice(0, v).filter(u => u[1]).map(u => u[1]); };
// Words a beginner has heard many times: short ones first, longer ones once she is past the first stages.
function pool(stageIdx) { return phonics.stages.slice(0, Math.max(2, stageIdx + 2)).flatMap(s => s.words).filter(earOk); }
// Blending and counting at the 'long' stage: words with blends (4 and 5 sounds), not only three-sound words.
function blendPool(stageIdx) { return stageIdx ? phonics.stages.slice(0, 6).flatMap(s => s.words).filter(earOk) : pool(0); }

// ---------- families ----------
// Sounds that are heard as each other; a foil with one of these makes the item teach the difference.
const CONFUSABLE = { th: ['f', 's', 'd', 'v'], dh: ['d', 'v', 'th'], f: ['th', 'v', 'p'], v: ['f', 'th', 'b'], s: ['th', 'z', 'sh'], z: ['s'], d: ['dh', 'b', 't'], t: ['d', 'k'], sh: ['s', 'ch'], ch: ['sh', 'j'], b: ['p', 'd'], p: ['b'], m: ['n'], n: ['m'] };
// focus: a sound the parent is focusing on; about half the first/last-sound items target it (words drawn up
// to the stage that teaches it), and foils that sound close come first.
function paItem(kind, stageIdx, avoid, focus = null) {
  const unitAt = w => { const u = spokenUnits(w); return kind === 'first' ? u[0] : kind === 'final' ? u[u.length - 1] : u.find(x => isVowel(x.p)); };
  let words = pool(stageIdx).filter(w => !avoid.includes(w.w));
  let target = null;
  if (focus && kind !== 'medial' && Math.random() < 0.5) {
    const wide = phonics.stages.flatMap(s => s.words).filter(earOk).filter(w => !avoid.includes(w.w) && unitAt(w) && unitAt(w).p === focus);
    if (wide.length) { target = pick(wide); words = [...new Set([...words, ...wide])]; }
  }
  if (!target) target = pick(words.filter(w => unitAt(w)));
  const tp = unitAt(target).p;
  const ok = words.filter(w => w.w !== target.w && w.p !== target.p && unitAt(w) && unitAt(w).p !== tp);
  const close = shuffle(ok.filter(w => (CONFUSABLE[tp] || []).includes(unitAt(w).p)));
  const foils = [...close.slice(0, 2), ...shuffle(ok.filter(w => !close.includes(w)))].slice(0, 3);
  return { kind, target, phoneme: tp, foils };
}
const soundSeeds = {
  id: 'seeds', subskill: 'pa-sounds', itemId: it => 'pa-' + it.kind + ':' + it.target.w,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const where = it.kind === 'first' ? 'starts with' : it.kind === 'final' ? 'ends with' : 'has';
    const prompt = it.kind === 'medial' ? 'Listen. Which one has /' + it.phoneme + '/ in the middle?' : 'Listen. Which one ' + where + ' /' + it.phoneme + '/?';
    const mouth = mouthSVG(it.phoneme);
    stage.setObject(mouth ? el('div', { class: 'picture mouth-cue', html: mouth }) : el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const why = x => { const p = soundAt(x, it.kind); return p ? x.w + ' ' + where + ' /' + p + '/.' : 'That is ' + x.w + '.'; };
    const n = ctx.adaptive.choiceCount('pa-sounds');
    const grid = choiceGrid({ audio, prompt, items: picChoices(it.target, it.foils.slice(0, n - 1), why), praise: praiseLine(), revealText: it.target.w + ' ' + where + ' /' + it.phoneme + '/.',
      onMiss: async () => { await audio.say('We need /' + it.phoneme + '/.', { interrupt: false }); } });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: Math.min(n, it.foils.length + 1), gpc: it.phoneme };
  }
};

const blendIt = {
  id: 'blend', subskill: 'pa-blend-segment', itemId: w => 'blend:' + w.w,
  async play(stage, w, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const sIdx = ctx.adaptive.stageIndex('pa-blend-segment');
    const n = ctx.adaptive.choiceCount('pa-blend-segment');
    const foils = shuffle(blendPool(sIdx).filter(x => x.w !== w.w && x.p !== w.p && x.u.length === w.u.length)).slice(0, n - 1);
    const units = spokenUnits(w);
    const soundsText = units.map(u => '/' + u.p + '/').join(' ');
    const prompt = 'Luna says a word in pieces: ' + soundsText + '. Put the sounds together. Which picture is it?';
    stage.setObject(el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const replay = () => audio.sequence(units.flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }]));
    const grid = choiceGrid({ audio, prompt, items: picChoices(w, foils, x => 'That is ' + x.w + '.'), praise: praiseLine(), revealText: soundsText + ' makes ' + w.w + '.',
      onMiss: async () => { await audio.sequence([{ say: 'Listen again and push the sounds together.' }, ...units.flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }])]); } });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.sequence([{ say: 'Luna says a word in pieces. Put the sounds together.' }, ...units.flatMap((u, i) => i ? [{ gap: 500 }, { phoneme: u.p }] : [{ phoneme: u.p }]), { gap: 300 }, { say: 'Which picture is it?' }]);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: foils.length + 1 };
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
    counter.boxes[n - 1].dataset.answer = '1'; check.dataset.done = '1';
    const result = await new Promise(resolve => {
      check.addEventListener('click', async () => {
        if (counter.count() === n) {
          check.setAttribute('disabled', ''); counter.boxes.forEach(x => { delete x.dataset.answer; x.setAttribute('disabled', ''); });
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
    const other = shuffle(pool(ctx.adaptive.stageIndex('pa-blend-segment')).filter(x => x.w !== to.w && x.w !== from.w && x.p !== to.p && x.p !== from.p && x.u.length === from.u.length)).slice(0, 1);
    const prompt = 'Say ' + from.w + '. Now change /' + from.u[index][1] + '/ to /' + to.u[index][1] + '/. What word is it now?';
    stage.setObject(picture(from.p, () => { audio.stop(); audio.word(from.w); }));
    stage.setPrompt(promptBar(audio, 'Say this word. Now change /' + from.u[index][1] + '/ to /' + to.u[index][1] + '/. What word is it now?', { ears: true, speak: prompt }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(to, [from, ...other], x => x === from ? 'That is still ' + from.w + '. We need to change a sound.' : 'That is ' + x.w + '.'), praise: praiseLine(), revealText: 'Now it is ' + to.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// Deletion pairs: taking the first (or last) sound off one word leaves another word we have a picture for.
// The sounds that are left must be the other word's sounds (pink without /k/ is "ping", not pin).
function deletePairs(words) {
  const sounds = u => u.filter(x => x[1]).map(x => x[1]).join(' ');
  const bySounds = {};
  for (const w of words) (bySounds[sounds(w.u)] = bySounds[sounds(w.u)] || w);
  const out = [];
  for (const w of words) {
    const first = w.u[0], last = w.u[w.u.length - 1];
    const rest = bySounds[sounds(w.u.slice(1))];
    if (rest && first[1] && rest.p !== w.p && rest.w !== w.w) out.push({ from: w, to: rest, where: 'first', phoneme: first[1] });
    const head = bySounds[sounds(w.u.slice(0, -1))];
    if (head && last[1] && head.p !== w.p && head.w !== w.w) out.push({ from: w, to: head, where: 'last', phoneme: last[1] });
  }
  return shuffle(out);
}
const takeAway = {
  id: 'takeaway', subskill: 'pa-manipulate', itemId: pair => 'takeaway:' + pair.from.w + '>' + pair.to.w,
  async play(stage, pair, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { from, to, phoneme, where } = pair;
    const other = shuffle(pool(ctx.adaptive.stageIndex('pa-blend-segment')).filter(x => x.w !== to.w && x.w !== from.w && x.p !== to.p && x.p !== from.p && x.u.length === to.u.length)).slice(0, 1);
    const prompt = 'Say ' + from.w + '. Now take away the ' + where + ' sound, /' + phoneme + '/. What word is left?';
    stage.setObject(picture(from.p, () => { audio.stop(); audio.word(from.w); }));
    stage.setPrompt(promptBar(audio, 'Say this word. Now take away the ' + where + ' sound, /' + phoneme + '/. What word is left?', { ears: true, speak: prompt }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(to, [from, ...other], x => x === from ? 'That is still ' + from.w + '. Take a sound away.' : 'That is ' + x.w + '.'), praise: praiseLine(), revealText: from.w + ' without /' + phoneme + '/ is ' + to.w + '.' });
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
  const foils = shuffle(words.filter(w => rimeOf(w) !== rime && w.p !== target.p && w.p !== answer.p)).slice(0, 3);
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
    const rn = ctx.adaptive.choiceCount('pa-rhyme');
    const grid = choiceGrid({ audio, prompt: ask, items: picChoices(it.answer, it.foils.slice(0, rn - 1), x => x.w + ' and ' + it.target.w + ' do not sound the same at the end.'), praise: praiseLine(), revealText: it.target.w + ' and ' + it.answer.w + ' rhyme.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.say(ask);
    const r = await grid.done;
    void prompt;
    return { outcome: outcomeOf(r), choices: Math.min(rn, it.foils.length + 1), gpc: rimeOf(it.target) };
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
    counter.boxes[it.n - 1].dataset.answer = '1'; check.dataset.done = '1';
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
    const foils = shuffle(pool(ctx.adaptive.stageIndex('pa-blend-segment')).filter(x => x.w !== w.w && x.p !== w.p && x.u.length === w.u.length && onsetOf(x)[0] === onset[0])).slice(0, 2);
    const more = foils.length < 2 ? shuffle(pool(ctx.adaptive.stageIndex('pa-blend-segment')).filter(x => x.w !== w.w && x.p !== w.p && !foils.includes(x) && x.u.length === w.u.length)).slice(0, 2 - foils.length) : [];
    const prompt = 'Luna says a word in two parts: ' + onset.map(p => '/' + p + '/').join(' ') + ' then ' + rime.map(p => '/' + p + '/').join(' ') + '. Which picture is it?';
    stage.setObject(el('div', { class: 'picture', text: '👂' }));
    stage.setPrompt(promptBar(audio, prompt, { ears: true }));
    const grid = choiceGrid({ audio, prompt, items: picChoices(w, [...foils, ...more], x => 'That is ' + x.w + '.'), praise: praiseLine(), revealText: 'It is ' + w.w + '.' });
    grid.el.classList.add('three');
    stage.setBody(grid.el);
    await audio.sequence([{ say: 'Luna says a word in two parts.' }, ...onset.map(p => ({ phoneme: p })), { gap: 600 }, { blend: rime }, { gap: 300 }, { say: 'Which picture is it?' }]);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3 };
  }
};

// ---------- rounds ----------
function buildRound(kind) {
  const sIdx = Math.max(ctx.adaptive.stageIndex('pa-blend-segment'), 0);
  const items = [];
  const used = [];
  const take = (family, item) => {
    if (!item) return;
    items.push({ family, item });
    for (const w of [item.w, item.target && item.target.w, item.answer && item.answer.w, item.word, item.from && item.from.w, item.to && item.to.w]) if (w) used.push(w);
  };
  const words = () => pool(sIdx).filter(w => !used.includes(w.w));
  const fresh = pair => !used.includes(pair.from.w) && !used.includes(pair.to.w);
  // at the 'long' stage two of every three blend/count words have four or five sounds
  const blendWord = () => {
    const ws = blendPool(sIdx).filter(w => !used.includes(w.w) && spokenUnits(w).length <= (sIdx ? 5 : 3));
    const long = ws.filter(w => spokenUnits(w).length >= 4);
    return pick(sIdx && long.length && Math.random() < 0.67 ? long : ws);
  };
  const focus = (ctx.adaptive.focus() || {}).sound || null;
  const seed = () => take(soundSeeds, paItem(ctx.adaptive.stage('pa-sounds'), sIdx, used, focus));
  const blend = () => take(blendIt, blendWord());
  const count = () => take(countSounds, blendWord());
  const manip = () => { const st = ctx.adaptive.stage('pa-manipulate'); const d = st === 'delete' ? deletePairs(allWords()).find(fresh) : null; if (d) take(takeAway, d); else { const p = swapPairs(pool(sIdx).filter(w => !used.includes(w.w)), 1).find(fresh); if (p) take(oralSwap, p); else seed(); } };
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
export const __test = { paItem, rhymeItem, CONFUSABLE, deletePairs, swapPairs, onsetOf, rimeOf, pool, blendPool, allWords, EAR_SKIP, init({ phonics: p, sounds: s, pa }) { phonics = p; sounds = s; PA = pa; } };
