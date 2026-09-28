// games/princess-quest/well.js — Wishing Well: high-frequency "heart words" (ELA.K.F.1.4).
// Method: orthographic mapping, not flashcards. A word is introduced in sound boxes — regular graphemes
// speak their sounds, the irregular part wears a heart and is "remembered by heart" — then practised with
// hear-it-tap-it (4 word choices with confusable foils) and see-it-say-it (self-check, never scored).
// Scheduling: Leitner boxes 1–5 with 1/2/4/7/15-day intervals; mastered = box 5 after first-try hits on 3 days.
// Wish Notes: once a word's heart is known it turns up inside a short decodable sentence (content/sentences.json)
// and she finds it there, so recognition transfers to connected text.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton, tileBoard } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, cancelled = false, SW = null, SENT = null;
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
const INTERVALS = [0, 1, 2, 4, 7, 15]; // days until due, by box
const NEW_PER_SESSION = 2;

const EMPTY = Object.freeze({ box: 0, firstTryDays: [], introducedDay: null, lastSeen: null });
// Read-only view; only mutate through state() so untouched words never bloat the save.
const peek = word => ctx.economy.save.sightWords[word] || EMPTY;
function state(word) {
  const s = ctx.economy.save.sightWords;
  if (!s[word]) s[word] = { box: 0, firstTryDays: [], introducedDay: null, lastSeen: null };
  return s[word];
}
// Intro order: fully decodable words first, then words with one heart, then the rest; within a group, the
// words whose letters she has already met in the Meadow (lowest phonics stage) come first, so heart words
// track the phonics progression instead of running ahead of it.
const heartCount = w => (SW.words[w] || []).filter(u => u[2]).length;
let PH = null;
function stageNeeded(word) {
  if (!PH) return 0;
  const units = (SW.words[word] || []).filter(u => !u[2] && u[1]);
  const graphemes = units.map(u => u[0]);
  // A long vowel spelled with a magic e (make, like, ride) is only decodable once that stage is taught.
  if (units.some(u => ['ae', 'ee', 'ie', 'oe', 'ue'].includes(u[1]))) return Math.max(0, PH.stages.findIndex(st => st.id === 'f'));
  for (let i = 0; i < PH.stages.length; i++) {
    const pool = new Set(PH.stages.slice(0, i + 1).flatMap(st => st.graphemes));
    if (graphemes.every(g => pool.has(g))) return i;
  }
  return PH.stages.length;
}
// Heart words the first Spell Scroll sentences need (the, is, see, a, I ...) come first, so the scrolls and
// wish notes open up early instead of after 30-odd other words.
let EARLY = null;
function earlyRank(w) {
  if (!EARLY) {
    const n = new Map();
    for (const x of (SENT ? SENT.sentences : []).filter(x => x.stage === 'a')) for (const h of x.hearts) n.set(h, (n.get(h) || 0) + 1);
    EARLY = new Map([...n].sort((a, b) => b[1] - a[1]).map(([h], i) => [h, i]));
  }
  return EARLY.has(w) ? EARLY.get(w) : 999;
}
const orderList = list => [...list].sort((a, b) => earlyRank(a) - earlyRank(b) || heartCount(a) - heartCount(b) || stageNeeded(a) - stageNeeded(b) || list.indexOf(a) - list.indexOf(b));
const allWords = () => [...orderList(SW.lists.prePrimer), ...orderList(SW.lists.primer)];
const introduced = () => allWords().filter(w => peek(w).introducedDay);
const isMastered = w => peek(w).box >= 5 && peek(w).firstTryDays.length >= 3;
function daysSince(day) { if (!day) return 99; const [y, m, d] = day.split('-').map(Number); const [y2, m2, d2] = ctx.economy.today().split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y, m - 1, d)) / 864e5); }
// Due words, most overdue (relative to their interval) first, so high boxes are not starved by low ones.
const overdue = w => daysSince(peek(w).lastSeen) / Math.max(1, INTERVALS[Math.min(5, peek(w).box)]);
function dueWords() {
  return introduced().filter(w => daysSince(peek(w).lastSeen) >= INTERVALS[Math.min(5, peek(w).box)]).sort((a, b) => overdue(b) - overdue(a) || peek(a).box - peek(b).box);
}
// Leitner step for a hear-it-tap-it answer. A word moves up a box only when it was due (spaced), so extra
// practice on the same day cannot rush it to "mastered"; practice that was not due changes nothing, so it
// does not push the next review back. A reveal always moves it down. Help from Luna (👆 or a demo) never moves it up.
function applyTap(word, { misses = 0, revealed = false, helped = false } = {}) {
  const st = state(word);
  const wasDue = daysSince(st.lastSeen) >= INTERVALS[Math.min(5, st.box)];
  if (revealed) { st.box = Math.max(1, st.box - 1); st.lastSeen = ctx.economy.today(); }
  else if (wasDue) {
    st.lastSeen = ctx.economy.today();
    if (!misses && !helped) { st.box = Math.min(5, st.box + 1); if (!st.firstTryDays.includes(ctx.economy.today())) st.firstTryDays.push(ctx.economy.today()); }
  }
  ctx.economy.persist();
}
function introduce(word) {
  const st = state(word);
  st.introducedDay = st.introducedDay || ctx.economy.today(); st.lastSeen = st.lastSeen || ctx.economy.today(); st.box = Math.max(1, st.box);
  ctx.economy.persist();
}
// The parent's focus words (Parent Corner) come first: introduced first, practised first, in the notes first.
const focusWords = () => ((ctx.adaptive && ctx.adaptive.focus && ctx.adaptive.focus()) || {}).words || [];
const focusFirst = list => { const f = focusWords(); return [...list.filter(w => f.includes(w)), ...list.filter(w => !f.includes(w))]; };
function nextNewWords(n) { return focusFirst(allWords().filter(w => !peek(w).introducedDay)).slice(0, n); }
export function masteredWords() { return SW ? allWords().filter(isMastered) : []; }

// Words that sound the same can never be foils for each other: "Which door says two?" has no single answer
// when the doors show to and two.
const HOMOPHONES = [['to', 'two', 'too'], ['for', 'four'], ['no', 'know'], ['there', 'their'], ['here', 'hear'], ['one', 'won'],
  ['be', 'bee'], ['see', 'sea'], ['by', 'buy'], ['new', 'knew'], ['right', 'write'], ['blue', 'blew'], ['our', 'hour'], ['eight', 'ate'], ['red', 'read'], ['I', 'eye']];
export const soundsSame = (a, b) => a.toLowerCase() === b.toLowerCase() || HOMOPHONES.some(g => g.includes(a) && g.includes(b));
function foilsFor(word, n = 3) {
  const pool = introduced().filter(w => !soundsSame(w, word));
  const score = w => (w[0] === word[0] ? 2 : 0) + (w.length === word.length ? 1 : 0) + (w.slice(-1) === word.slice(-1) ? 1 : 0);
  const ranked = shuffle(pool).sort((a, b) => score(b) - score(a));
  const out = ranked.slice(0, n);
  const extra = allWords().filter(w => !soundsSame(w, word) && !out.includes(w));
  while (out.length < n && extra.length) out.push(extra.splice(Math.floor(Math.random() * extra.length), 1)[0]);
  return out;
}

// Sound boxes: one rune per grapheme; hearts on irregular parts.
function soundBoxes(audio, word) {
  const units = SW.words[word];
  const row = el('div', { class: 'row' });
  const runes = units.map(([g, p, heart]) => {
    const r = el('button', { class: 'rune' + (heart ? ' heart' : ''), type: 'button', 'aria-label': (heart ? 'heart part ' : 'sound ') + g }, [el('span', { text: g }), heart ? el('span', { class: 'heart-mark', text: '💜' }) : null]);
    r.addEventListener('click', () => { audio.stop(); if (p) audio.phoneme(p); else audio.say(heart ? 'This part we just remember. ' + word : 'quiet ' + g); });
    row.appendChild(r);
    return r;
  });
  return { row, runes, highlight: i => runes.forEach((r, k) => r.classList.toggle('now', k === i)), clear: () => runes.forEach(r => r.classList.remove('now')) };
}
async function mapWord(audio, word, boxes) {
  const units = SW.words[word];
  const steps = [{ word }, { gap: 300 }];
  units.forEach(([g, p, heart], i) => {
    if (p) steps.push({ phoneme: p, index: i }); else if (heart) steps.push({ say: 'Heart part.', index: i }); else steps.push({ gap: 200, index: i });
    steps.push({ gap: 250 });
  });
  steps.push({ word });
  await audio.sequence(steps, { onStep: s => { if (s.index !== undefined) boxes.highlight(s.index); } });
  boxes.clear();
}

const heartIntro = {
  id: 'heart', subskill: 'sight-words', itemId: w => 'heart:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const boxes = soundBoxes(audio, word);
    const units = SW.words[word];
    const hearts = units.filter(u => u[2]).length;
    const single = hearts === units.length; // "the", "a", "one": the whole word is remembered by heart
    const prompt = single
      ? 'A new wish word: ' + word + '. This little word we just know by heart.'
      : hearts ? 'A new wish word: ' + word + '. Tap the boxes. The purple one we know by heart.'
      : 'A new wish word: ' + word + '. Tap each box to hear its sound.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div', { class: 'word-big', text: word }));
    const done = bigButton('I know it!', () => {}, 'gold');
    done.setAttribute('disabled', ''); done.style.opacity = '0.4';
    const clicked = new Promise(resolve => done.addEventListener('click', resolve, { once: true }));
    stage.setBody(boxes.row, el('div', { class: 'row' }, [done]));
    await audio.say(prompt);
    await mapWord(audio, word, boxes);
    done.removeAttribute('disabled'); done.style.opacity = '1';
    await audio.say(single ? 'Say it with me: ' + word + '. Then tap I know it.' : 'Tap the boxes to hear them. Then tap I know it.');
    await clicked;
    await audio.word(word);
    const st = state(word);
    introduce(word);
    ctx.economy.persist();
    await audio.say(praiseLine());
    return { outcome: 'firstTry', choices: 1, review: true };
  }
};

const hearTap = {
  id: 'heartap', subskill: 'sight-words', itemId: w => 'heartap:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const doors = Math.min(4, ctx.adaptive.choiceCount('sight-words', 4)); // 2 to 4 doors
    const foils = foilsFor(word, doors - 1);
    const items = shuffle([word, ...foils]).map(w => ({ id: w, pic: '', label: w, ok: w === word, say: w, textOnly: true, why: w === word ? null : 'That door says ' + w + '.' }));
    const prompt = 'Which wish door says ' + word + '? Tap it to open it.';
    stage.setPrompt(promptBar(audio, 'Which wish door says the word you hear? Tap it to open it.', { speak: prompt, replay: word }));
    stage.setObject(el('div', { class: 'picture', text: '🚪' }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This door says ' + word + '.' });
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only', 'door'); c.querySelector('.pic')?.remove(); });
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    applyTap(word, { misses: r.misses, revealed: r.revealed, helped: stage.helpUsed });
    if (r.revealed) { const boxes = soundBoxes(audio, word); stage.setBody(boxes.row, grid.el); await mapWord(audio, word, boxes); }
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: doors, gpc: word };
  }
};

const seeSay = {
  id: 'seesay', subskill: 'sight-words', itemId: w => 'seesay:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Read this wish word out loud. Then tap the speaker to check.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    const big = el('div', { class: 'word-big', text: word, style: 'font-size:64px' });
    const check = el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Check', text: '🔊', onclick: () => { audio.stop(); audio.word(word); } });
    const yes = bigButton('👍 I got it', () => {}, 'gold');
    const hmm = bigButton('🤔 Show me', () => {}, 'soft');
    stage.setBody(big, el('div', { class: 'row' }, [check]), el('div', { class: 'row' }, [yes, hmm]));
    await audio.say(prompt);
    const picked = await new Promise(resolve => { yes.addEventListener('click', () => resolve('yes'), { once: true }); hmm.addEventListener('click', () => resolve('hmm'), { once: true }); });
    if (picked === 'hmm') { const boxes = soundBoxes(audio, word); stage.setBody(big, boxes.row); await mapWord(audio, word, boxes); }
    else { await audio.word(word); await audio.say(praiseLine()); }
    return { outcome: 'firstTry', choices: 1, review: true }; // self-report never counts toward mastery
  }
};

// Wish Notes: find a known wish word inside a sentence, then hear the whole note.
function sentenceRow(audio, text) {
  const row = el('div', { class: 'sentence' });
  const buttons = text.split(/\s+/).map(w => {
    const clean = w.replace(/[^A-Za-z']/g, '');
    const b = el('button', { class: 'sword', type: 'button', text: w, 'aria-label': clean });
    b.addEventListener('click', () => { audio.stop(); audio.word(clean.toLowerCase()); });
    row.appendChild(b);
    return { b, clean };
  });
  return { row, buttons };
}
function noteFor(word, avoid = []) {
  if (!SENT) return null;
  const known = w => !!peek(w).introducedDay;
  const has = s => s.text.replace(/[^A-Za-z\s']/g, '').split(/\s+/).map(x => x.toLowerCase()).includes(word.toLowerCase());
  const ok = SENT.sentences.filter(s => has(s) && !avoid.includes(s.id) && s.hearts.every(h => h === word || known(h)));
  return ok.length ? pick(ok) : null;
}
const wishNote = {
  id: 'note', subskill: 'sight-words', itemId: it => 'note:' + it.word + ':' + it.sentence.id,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { word, sentence } = it;
    const prompt = 'Luna wrote a wish note. Find the word ' + word + '. Tap it.';
    stage.setPrompt(promptBar(audio, 'Luna wrote a wish note. Find the word you hear. Tap it.', { speak: prompt, replay: word }));
    stage.setObject(el('div', { class: 'picture', text: '💌' }));
    const sent = sentenceRow(audio, sentence.text);
    const targets = sent.buttons.filter(x => x.clean.toLowerCase() === word.toLowerCase());
    targets.forEach(x => { x.b.dataset.answer = '1'; });
    let misses = 0, settled = false;
    const result = await new Promise(resolve => {
      sent.buttons.forEach(({ b, clean }) => b.addEventListener('click', async () => {
        // once the answer is found (or shown), later taps only read the word aloud
        if (settled || b.classList.contains('right')) return;
        if (clean.toLowerCase() === word.toLowerCase()) {
          settled = true; targets.forEach(x => delete x.b.dataset.answer);
          const outcome = misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed';
          sent.buttons.forEach(x => x.b.classList.remove('glow'));
          b.classList.add('right', 'shimmer');
          if (audio.sfx) audio.sfx.sparkle();
          await audio.say(praiseLine());
          await wait(500);
          resolve({ outcome });
          return;
        }
        misses++;
        b.classList.add('dim');
        stage.luna('think', 900);
        if (misses === 1) { targets.forEach(x => x.b.classList.add('glow')); await audio.say('Look for ' + word + '. It is glowing.'); }
        else { settled = true; const t = targets[0]; t.b.classList.add('right'); await audio.say('Here it is: ' + word + '.'); resolve({ outcome: 'revealed' }); }
      }));
      stage.setBody(sent.row);
    });
    await audio.say('The note says: ' + sentence.text);
    return { outcome: result.outcome, choices: sent.buttons.length, gpc: word };
  }
};

// Spell it from memory: once a word is well known (box 3+), she builds it from its letters without seeing
// it. Recall-by-spelling locks the spelling into memory (orthographic mapping) better than recognition alone.
const spellHeart = {
  id: 'spellheart', subskill: 'sight-words', itemId: w => 'spellheart:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const units = SW.words[word];
    const letters = new Set(units.map(u => u[0]));
    const foil = pick('abcdefghilmnoprstuwy'.split('').filter(c => !letters.has(c)));
    const tiles = shuffle([...units.map((u, i) => ({ id: 'u' + i, grapheme: u[0], phoneme: u[1] || null })), { id: 'd0', grapheme: foil, phoneme: null }]);
    const prompt = 'Spell the wish word ' + word + ' from memory. Put the letters in order.';
    stage.setPrompt(promptBar(audio, 'Spell the wish word you hear from memory. Put the letters in order.', { speak: prompt, replay: word }));
    stage.setObject(el('div', { class: 'picture', text: '💌' }));
    let misses = 0, resolve;
    const done = new Promise(r => { resolve = r; });
    const finish = async outcome => {
      board.lock();
      const boxes = soundBoxes(audio, word);
      stage.setBody(boxes.row);
      await mapWord(audio, word, boxes);
      if (outcome !== 'revealed') await audio.say(praiseLine());
      resolve({ outcome, choices: tiles.length, gpc: word });
    };
    const board = tileBoard({
      audio, tiles, slotCount: units.length, answer: units.map((u, i) => 'u' + i),
      onChange: async slots => {
        if (slots.some(x => x === null)) return;
        const wrong = board.graphemes().map((g, i) => g !== units[i][0] ? i : -1).filter(i => i >= 0);
        if (!wrong.length) { finish(misses === 0 ? 'firstTry' : 'scaffolded'); return; }
        misses++;
        stage.luna('think', 900);
        if (misses === 1) {
          wrong.forEach(i => board.setSlot(i, null));
          board.hintSlot(wrong[0]); board.hintTile('u' + wrong[0]);
          await audio.say('Almost. Look at the glowing letter.');
        } else {
          board.clearHints(); units.forEach((u, i) => board.setSlot(i, 'u' + i));
          await audio.say('Here it is: ' + word + '.');
          finish('revealed');
        }
      }
    });
    stage.setBody(board.el);
    await audio.say(prompt);
    return done;
  }
};

const ROUND_MAX = 9;
function buildRound() {
  // New words wait while many introduced words still sit in the first box (she is not holding them yet).
  const shaky = introduced().filter(w => peek(w).box <= 1).length;
  // and fewer new words on days with many reviews due, so reviews are never crowded out
  const dueN = dueWords().length;
  // a focus word waiting to be introduced always gets in, one a day, even when reviews are piling up
  const waiting = focusWords().filter(w => !peek(w).introducedDay);
  const fresh = introduced().length < 5 ? nextNewWords(5 - introduced().length) : shaky >= 5 || dueN >= 6 ? waiting.slice(0, 1) : nextNewWords(dueN >= 3 ? 1 : NEW_PER_SESSION);
  const strong = shuffle(introduced().filter(w => peek(w).box >= 3 && SW.words[w].length >= 2));
  const spell = strong.length ? [{ family: spellHeart, item: strong[0] }] : [];
  // Wish notes: known words found inside real sentences (connected text), when the hearts are known.
  const notes = [], usedNotes = [];
  for (const w of focusFirst(shuffle(introduced()))) { // every known word is a candidate, so a note is found whenever one exists
    if (notes.length >= (strong.length ? 1 : 2)) break;
    const s = noteFor(w, usedNotes); if (s) { usedNotes.push(s.id); notes.push({ family: wishNote, item: { word: w, sentence: s } }); }
  }
  const sayWord = pick(introduced().length ? introduced() : fresh);
  const say = sayWord ? [{ family: seeSay, item: sayWord }] : [];
  // Notes, spelling and see-it-say-it have reserved places; practice taps fill what is left (up to 4).
  const intros = fresh.map(w => ({ family: heartIntro, item: w }));
  const freshTaps = fresh.map(w => ({ family: hearTap, item: w }));
  const reserved = spell.length + notes.length + say.length;
  // On the very first visits (five new words) some fresh taps give way to the reserved items.
  while (freshTaps.length && intros.length + freshTaps.length + reserved > ROUND_MAX) freshTaps.pop();
  const want = Math.min(4, Math.max(0, ROUND_MAX - intros.length - freshTaps.length - reserved));
  const due = focusFirst(dueWords().filter(w => !fresh.includes(w)));
  const practise = due.length >= want ? due.slice(0, want) : [...due, ...shuffle(introduced().filter(w => !due.includes(w) && !fresh.includes(w))).slice(0, want - due.length)];
  return [...intros, ...practise.map(w => ({ family: hearTap, item: w })), ...freshTaps, ...spell, ...notes, ...say].slice(0, ROUND_MAX);
}

async function startRound() {
  if (roundBusy) return; // BUG-04: one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'well', cabinetId: 'well', items: buildRound() });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const known = introduced().length, mastered = masteredWords().length;
  host.replaceChildren(el('div', { class: 'scene well' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Wishing Well' }), el('div', { class: 'line', text: known ? 'Your wish words are waiting behind the doors.' : 'Every wish word you learn lights the well.' })])]),
    el('div', { class: 'row', style: 'font-size:22px' }, [el('span', { text: '🌷'.repeat(Math.min(12, mastered)) + '🌱'.repeat(Math.min(12, Math.max(0, known - mastered))) })]),
    el('div', { class: 'encounters' }, [
      el('button', { class: 'encounter-btn primary', type: 'button', onclick: () => startRound() }, [el('div', { class: 'icon', text: '🌷' }), el('div', { text: 'Make a wish' })])
    ])
  ]));
  ctx.audio.say('Welcome to the Wishing Well! Tap to make a wish.');
}

export async function mount(h, c) {
  host = h; ctx = c; SW = await ctx.content.load('sight-words');
  try { SENT = await ctx.content.load('sentences'); } catch (e) { console.warn(e); SENT = null; }
  try { PH = await ctx.content.load('phonics'); } catch (e) { console.warn(e); PH = null; }
  // Drop empty placeholder entries an older build wrote, so the save stays small.
  const sw = ctx.economy.save.sightWords;
  for (const [w, v] of Object.entries(sw)) if (!v.introducedDay && !v.box) delete sw[w];
  showMenu();
}
export function unmount() { cancelled = true; host = null; }
// For tests: build rounds against a fake context.
export const __test = { setup(c, sw, sent, ph) { ctx = c; SW = sw; SENT = sent; PH = ph; EARLY = null; }, buildRound, foilsFor, soundsSame, allWords, applyTap, introduce, masteredWords };
