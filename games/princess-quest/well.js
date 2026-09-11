// games/princess-quest/well.js — Wishing Well: high-frequency "heart words" (ELA.K.F.1.4).
// Method: orthographic mapping, not flashcards. A word is introduced in sound boxes — regular graphemes
// speak their sounds, the irregular part wears a heart and is "remembered by heart" — then practised with
// hear-it-tap-it (4 word choices with confusable foils) and see-it-say-it (self-check, never scored).
// Scheduling: Leitner boxes 1–5 with 1/2/4/7/15-day intervals; mastered = box 5 after first-try hits on 3 days.
// Wish Notes: once a word's heart is known it turns up inside a short decodable sentence (content/sentences.json)
// and she finds it there, so recognition transfers to connected text.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton } from '../../shared/ui.js';
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
  const graphemes = (SW.words[word] || []).filter(u => !u[2] && u[1]).map(u => u[0]);
  for (let i = 0; i < PH.stages.length; i++) {
    const pool = new Set(PH.stages.slice(0, i + 1).flatMap(st => st.graphemes));
    if (graphemes.every(g => pool.has(g))) return i;
  }
  return PH.stages.length;
}
const orderList = list => [...list].sort((a, b) => heartCount(a) - heartCount(b) || stageNeeded(a) - stageNeeded(b) || list.indexOf(a) - list.indexOf(b));
const allWords = () => [...orderList(SW.lists.prePrimer), ...orderList(SW.lists.primer)];
const introduced = () => allWords().filter(w => peek(w).introducedDay);
const isMastered = w => peek(w).box >= 5 && peek(w).firstTryDays.length >= 3;
function daysSince(day) { if (!day) return 99; const [y, m, d] = day.split('-').map(Number); const [y2, m2, d2] = ctx.economy.today().split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y, m - 1, d)) / 864e5); }
function dueWords() {
  return introduced().filter(w => daysSince(peek(w).lastSeen) >= INTERVALS[Math.min(5, peek(w).box)]).sort((a, b) => peek(a).box - peek(b).box || daysSince(peek(b).lastSeen) - daysSince(peek(a).lastSeen));
}
function nextNewWords(n) { return allWords().filter(w => !peek(w).introducedDay).slice(0, n); }
export function masteredWords() { return SW ? allWords().filter(isMastered) : []; }

function foilsFor(word, n = 3) {
  const pool = introduced().filter(w => w !== word);
  const score = w => (w[0] === word[0] ? 2 : 0) + (w.length === word.length ? 1 : 0) + (w.slice(-1) === word.slice(-1) ? 1 : 0);
  const ranked = shuffle(pool).sort((a, b) => score(b) - score(a));
  const out = ranked.slice(0, n);
  const extra = allWords().filter(w => w !== word && !out.includes(w));
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
    if (p) steps.push({ phoneme: p, index: i }); else if (heart) steps.push({ say: 'heart part', index: i }); else steps.push({ gap: 200, index: i });
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
    const single = units.length === 1;
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
    st.introducedDay = st.introducedDay || ctx.economy.today(); st.lastSeen = ctx.economy.today(); st.box = Math.max(1, st.box);
    ctx.economy.persist();
    await audio.say(praiseLine());
    return { outcome: 'firstTry', choices: 1, review: true };
  }
};

const hearTap = {
  id: 'heartap', subskill: 'sight-words', itemId: w => 'heartap:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const foils = foilsFor(word, 3);
    const items = shuffle([word, ...foils]).map(w => ({ id: w, pic: '', label: w, ok: w === word, say: w, textOnly: true }));
    const prompt = 'Four wish doors. Which door says ' + word + '? Tap it to open it.';
    stage.setPrompt(promptBar(audio, 'Four wish doors. Which door says the word you hear? Tap it to open it.', { speak: prompt }));
    stage.setObject(el('div', { class: 'picture', text: '🚪' }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This door says ' + word + '.' });
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only', 'door'); c.querySelector('.pic')?.remove(); });
    stage.setBody(grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    const st = state(word);
    st.lastSeen = ctx.economy.today();
    if (!r.misses) { st.box = Math.min(5, st.box + 1); if (!st.firstTryDays.includes(ctx.economy.today())) st.firstTryDays.push(ctx.economy.today()); }
    else if (r.revealed) st.box = Math.max(1, st.box - 1);
    ctx.economy.persist();
    if (r.revealed) { const boxes = soundBoxes(audio, word); stage.setBody(boxes.row, grid.el); await mapWord(audio, word, boxes); }
    return { outcome: r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry', choices: 4, gpc: word };
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
    state(word).lastSeen = ctx.economy.today(); ctx.economy.persist();
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
    stage.setPrompt(promptBar(audio, 'Luna wrote a wish note. Find the word you hear. Tap it.', { speak: prompt }));
    stage.setObject(el('div', { class: 'picture', text: '💌' }));
    const sent = sentenceRow(audio, sentence.text);
    const targets = sent.buttons.filter(x => x.clean.toLowerCase() === word.toLowerCase());
    let misses = 0;
    const result = await new Promise(resolve => {
      sent.buttons.forEach(({ b, clean }) => b.addEventListener('click', async () => {
        if (b.classList.contains('right')) return;
        if (clean.toLowerCase() === word.toLowerCase()) {
          sent.buttons.forEach(x => x.b.classList.remove('glow'));
          b.classList.add('right', 'shimmer');
          if (audio.sfx) audio.sfx.sparkle();
          await audio.say(praiseLine());
          await wait(500);
          resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed' });
          return;
        }
        misses++;
        b.classList.add('dim');
        stage.luna('think', 900);
        if (misses === 1) { targets.forEach(x => x.b.classList.add('glow')); await audio.say('Look for ' + word + '. It is glowing.'); }
        else { const t = targets[0]; t.b.classList.add('right'); await audio.say('Here it is: ' + word + '.'); resolve({ outcome: 'revealed' }); }
      }));
      stage.setBody(sent.row);
    });
    await audio.say('The note says: ' + sentence.text);
    const st = state(word); st.lastSeen = ctx.economy.today(); ctx.economy.persist();
    return { outcome: result.outcome, choices: sent.buttons.length, gpc: word, review: result.outcome !== 'firstTry' && misses === 0 };
  }
};

function buildRound() {
  const items = [];
  const fresh = introduced().length < 5 ? nextNewWords(5 - introduced().length) : nextNewWords(NEW_PER_SESSION);
  fresh.forEach(w => items.push({ family: heartIntro, item: w }));
  const due = dueWords().filter(w => !fresh.includes(w));
  const practise = due.length >= 4 ? due.slice(0, 4) : [...due, ...shuffle(introduced().filter(w => !due.includes(w) && !fresh.includes(w))).slice(0, 4 - due.length)];
  practise.forEach(w => items.push({ family: hearTap, item: w }));
  fresh.forEach(w => items.push({ family: hearTap, item: w }));
  // Two wish notes: known words found inside real sentences (connected text), when the hearts are known.
  const usedNotes = [];
  for (const w of shuffle(introduced()).slice(0, 8)) {
    if (items.filter(i => i.family === wishNote).length >= 2) break;
    const s = noteFor(w, usedNotes); if (s) { usedNotes.push(s.id); items.push({ family: wishNote, item: { word: w, sentence: s } }); }
  }
  const say = pick(introduced().length ? introduced() : fresh);
  if (say) items.push({ family: seeSay, item: say });
  return items.slice(0, 8);
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
