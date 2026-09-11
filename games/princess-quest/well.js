// games/princess-quest/well.js — Wishing Well: high-frequency "heart words" (ELA.K.F.1.4).
// Method: orthographic mapping, not flashcards. A word is introduced in sound boxes — regular graphemes
// speak their sounds, the irregular part wears a heart and is "remembered by heart" — then practised with
// hear-it-tap-it (4 word choices with confusable foils) and see-it-say-it (self-check, never scored).
// Scheduling: Leitner boxes 1–5 with 1/2/4/7/15-day intervals; mastered = box 5 after first-try hits on 3 days.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, cancelled = false, SW = null;
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
// Intro order (BUG-10): fully decodable words first, then words with one heart, then the rest, within each list.
const heartCount = w => (SW.words[w] || []).filter(u => u[2]).length;
const orderList = list => [...list].sort((a, b) => heartCount(a) - heartCount(b) || SW.words[b].length - SW.words[a].length || list.indexOf(a) - list.indexOf(b));
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
  await audio.word(word);
  await wait(300);
  for (let i = 0; i < units.length; i++) {
    const [g, p, heart] = units[i];
    boxes.highlight(i);
    if (p) await audio.phoneme(p); else if (heart) await audio.say('heart part'); else await wait(200);
    await wait(250);
  }
  boxes.clear();
  await audio.word(word);
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
    audio.say(praiseLine());
    return { outcome: 'firstTry', choices: 1, review: true };
  }
};

const hearTap = {
  id: 'heartap', subskill: 'sight-words', itemId: w => 'heartap:' + w,
  async play(stage, word, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const foils = foilsFor(word, 3);
    const items = shuffle([word, ...foils]).map(w => ({ id: w, pic: '', label: w, ok: w === word, say: w, textOnly: true }));
    const prompt = 'Find the word: ' + word + '.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This one says ' + word + '.' });
    grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
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
    const check = el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Check', text: '🔊', onclick: () => audio.word(word) });
    const yes = bigButton('👍 I got it', () => {}, 'gold');
    const hmm = bigButton('🤔 Show me', () => {}, 'soft');
    stage.setBody(big, el('div', { class: 'row' }, [check]), el('div', { class: 'row' }, [yes, hmm]));
    await audio.say(prompt);
    const picked = await new Promise(resolve => { yes.addEventListener('click', () => resolve('yes'), { once: true }); hmm.addEventListener('click', () => resolve('hmm'), { once: true }); });
    if (picked === 'hmm') { const boxes = soundBoxes(audio, word); stage.setBody(big, boxes.row); await mapWord(audio, word, boxes); }
    else { await audio.word(word); audio.say(praiseLine()); }
    state(word).lastSeen = ctx.economy.today(); ctx.economy.persist();
    return { outcome: 'firstTry', choices: 1, review: true }; // self-report never counts toward mastery
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
  const say = pick(introduced().length ? introduced() : fresh);
  if (say) items.push({ family: seeSay, item: say });
  return items.slice(0, 7);
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
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Wishing Well' }), el('div', { class: 'line', text: known ? 'Your wish words are waiting.' : 'Every wish word you learn lights the well.' })])]),
    el('div', { class: 'row', style: 'font-size:22px' }, [el('span', { text: '🌷'.repeat(Math.min(12, mastered)) + '🌱'.repeat(Math.min(12, Math.max(0, known - mastered))) })]),
    el('div', { class: 'encounters' }, [
      el('button', { class: 'encounter-btn primary', type: 'button', onclick: () => startRound() }, [el('div', { class: 'icon', text: '🌷' }), el('div', { text: 'Make a wish' })])
    ])
  ]));
  ctx.audio.say('Welcome to the Wishing Well! Tap to make a wish.');
}

export async function mount(h, c) {
  host = h; ctx = c; SW = await ctx.content.load('sight-words');
  // Drop empty placeholder entries an older build wrote, so the save stays small.
  const sw = ctx.economy.save.sightWords;
  for (const [w, v] of Object.entries(sw)) if (!v.introducedDay && !v.box) delete sw[w];
  showMenu();
}
export function unmount() { cancelled = true; host = null; }
