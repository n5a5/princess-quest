// games/princess-quest/lagoon.js — Tick-Tock Lagoon: telling time on a geared clock (shared/clock.js).
// Sea Squishies are stuck in bubbles; each round is six clock cards along a reef path, and the sixth frees one.
// Cards: Read the clock (pick the time), Match the clocks (pick the clock for a time), Set the clock (turn the
// hands), and My day (the same cards with her real routine times from Parent Corner). Levels follow the adaptive
// engine: o'clock, then half past ("three thirty", as she says it at home). Telling time is a grade 1 benchmark in
// Florida (MA.1.M.2.1), so all of it is a stretch above kindergarten; the place is free play, never a quest stop.
// A wrong answer never moves her back: Luna names the mistake (the next-hour slip at half past, the hands mixed up)
// and the right answer glows; a second miss shows it, and the card comes back later in the round.
import { el, wait, shuffle, pick, choiceGrid, promptBar, confetti } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom, squishySVG, SQUISHY_KINDS } from '../../shared/characters.js';
import { SQUISHIES } from '../registry.js';
import { clockEl, clockFace, digitalHTML, phrase, digital, timeFor, distractors, WHY, setHint, stepFor, toTotal, fromTotal, sameTime, routineTimes } from '../../shared/clock.js';

let roundBusy = false;
let host = null, ctx = null, cancelled = false;
const SKILL = 'time-tell';
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';
const clockSave = () => ctx.economy.save.clock;
function noteMistake(kind) {
  const m = clockSave().mistakes;
  m[kind] = (m[kind] || 0) + 1;
  ctx.economy.persist();
}
const card = t => el('div', { class: 'time-card', 'aria-label': phrase(t), html: digitalHTML(t) });
// the routine picture beside Luna for My day cards, the digital time otherwise (when the card shows one)
const sideOf = (it, showTime) => it.routine ? el('div', { class: 'picture routine', text: it.routine.pic }) : showTime ? card(it.time) : el('div');

const readIt = {
  id: 'clockread', subskill: SKILL, itemId: it => 'read:' + digital(it.time) + (it.routine ? ':' + it.routine.id : ''),
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = [it.routine && it.routine.line, 'What time does the clock say?'].filter(Boolean).join(' ');
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(sideOf(it, false));
    const clock = clockEl({ time: it.time, label: 'clock' });
    const items = shuffle([{ time: it.time, kind: null }, ...it.wrong]).map(o => ({
      id: digital(o.time), pic: { svg: `<span class="digital">${digitalHTML(o.time)}</span>` }, say: phrase(o.time), ok: !o.kind, kind: o.kind, why: o.kind ? WHY[o.kind] : null
    }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'It is ' + phrase(it.time) + '.', onMiss: async picked => noteMistake(picked.kind) });
    grid.el.classList.add('times');
    stage.setBody(el('div', { class: 'clock-play' }, [clock.el, grid.el]));
    await audio.say(prompt);
    return { outcome: outcomeOf(await grid.done), choices: items.length, gpc: it.time.m ? 'half' : 'hour' };
  }
};

const matchIt = {
  id: 'clockmatch', subskill: SKILL, itemId: it => 'match:' + digital(it.time),
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Which clock says ' + phrase(it.time) + '?';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(card(it.time));
    const items = shuffle([{ time: it.time, kind: null }, ...it.wrong]).map(o => ({
      id: digital(o.time), pic: { svg: clockFace({ time: o.time, size: 120, label: 'clock' }) }, say: phrase(o.time), ok: !o.kind, kind: o.kind, why: o.kind ? WHY[o.kind] : null
    }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This clock says ' + phrase(it.time) + '.', onMiss: async picked => noteMistake(picked.kind) });
    grid.el.classList.add('clocks');
    stage.setBody(grid.el);
    await audio.say(prompt);
    return { outcome: outcomeOf(await grid.done), choices: items.length, gpc: it.time.m ? 'half' : 'hour' };
  }
};

const setIt = {
  id: 'clockset', subskill: SKILL, itemId: it => 'set:' + digital(it.time) + (it.routine ? ':' + it.routine.id : ''),
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = [it.routine && it.routine.line, 'Make the clock say ' + phrase(it.time) + '.'].join(' ').trim();
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(sideOf(it, true));
    if (it.routine) stage.objectArea.appendChild(card(it.time));
    const step = it.step;
    const done = el('button', { class: 'big-btn gold done-btn', type: 'button', 'aria-label': 'Done', text: '✓ Done' });
    let clock = null;
    // The demo and the 👆 button point at the turn button that brings the clock closer, then at Done.
    const mark = () => {
      const d = ((toTotal(it.time) - toTotal(clock.get())) % 720 + 720) % 720;
      for (const b of [clock.back, clock.fwd]) { delete b.dataset.answer; delete b.dataset.answerDone; }
      if (d) (d <= 360 ? clock.fwd : clock.back).dataset.answer = '1';
      if (d) delete done.dataset.done; else done.dataset.done = '1';
    };
    clock = clockEl({ time: it.start, interactive: true, step, label: 'clock you can turn', tick: () => audio.sfx && audio.sfx.tick && audio.sfx.tick(), onChange: () => mark() });
    mark();
    stage.setBody(el('div', { class: 'clock-play set' }, [clock.el, done]));
    await audio.say(prompt);
    let misses = 0;
    const r = await new Promise(resolve => {
      let busy = false;
      done.addEventListener('click', async () => {
        if (busy) return;
        busy = true; audio.stop();
        const made = clock.get();
        if (sameTime(made, it.time)) {
          clock.lock(); done.setAttribute('disabled', ''); done.classList.add('right');
          confetti(24); if (audio.sfx) audio.sfx.sparkle();
          await audio.say(praiseLine());
          resolve({ misses, revealed: false });
          return;
        }
        misses++;
        stage.luna('think', 1200);
        if (misses === 1) {
          noteMistake(made.m !== it.time.m ? 'set-minute' : 'set-hour');
          await audio.say('Your clock says ' + phrase(made) + '. ' + setHint(it.time, made));
          busy = false;
          return;
        }
        // second miss: Luna turns the hands to the time, slowly, so she sees the short hand go along
        clock.lock(); done.setAttribute('disabled', '');
        await audio.say('Watch the hands.');
        await clock.animateTo(it.time, 1800);
        await audio.say('It is ' + phrase(it.time) + '.');
        resolve({ misses, revealed: true });
      });
    });
    return { outcome: outcomeOf(r), choices: 3, gpc: it.time.m ? 'half' : 'hour' };
  }
};
const FAMILIES = { read: readIt, match: matchIt, set: setIt };

// One card. stage: 'hour' | 'half'. routine: a { id, pic, line, time } from routineTimes(), for My day.
export function gen(family, stage, { choices = 3, routine = null, rand = Math.random } = {}) {
  const time = routine ? routine.time : timeFor(stage, rand);
  const it = { time, stage, routine };
  if (family === setIt) {
    const step = stepFor(stage);
    // she starts two or three steps away, either way round: a few turns, never a whole lap
    const k = (2 + Math.floor(rand() * 2)) * (rand() < 0.5 ? -1 : 1);
    return { ...it, step, start: fromTotal(toTotal(time) + k * step) };
  }
  return { ...it, wrong: distractors(time, Math.max(1, choices - 1), stage, rand) };
}

function routinesNow() { return routineTimes(ctx.economy.save.settings.routine, ctx.adaptive.stage(SKILL)); }

function buildRound(kind) {
  const stage = ctx.adaptive.stage(SKILL);
  const choices = ctx.adaptive.choiceCount(SKILL, 3);
  const days = routinesNow();
  const items = [], ids = new Set();
  const take = (f, routine = null) => {
    let item = gen(f, stage, { choices, routine });
    for (let k = 0; k < 8 && ids.has(f.itemId(item)); k++) item = gen(f, stage, { choices, routine: routine ? pick(days) : null });
    ids.add(f.itemId(item)); items.push({ family: f, item });
  };
  if (kind === 'day' && days.length) { for (let i = 0; i < 6; i++) take(i % 2 ? setIt : readIt, days[i % days.length]); return items; }
  if (FAMILIES[kind]) { for (let i = 0; i < 6; i++) take(FAMILIES[kind]); return items; }
  // Today's tide: read, match and set twice each; one My day card when Parent Corner has her times
  take(readIt); take(matchIt); take(setIt); take(readIt); take(setIt);
  if (days.length) take(Math.random() < 0.5 ? readIt : setIt, pick(days)); else take(matchIt);
  return items;
}

// The reef path: one stone per card, lit as she goes, and the trapped Squishy waiting at the end.
function trail(total, done) {
  const ids = SQUISHIES.lagoon || [];
  const next = ids.find(id => !ctx.economy.save.squishies.rescued.includes(id)) || pick(ids);
  const kind = SQUISHY_KINDS.find(k => k.id === next) || SQUISHY_KINDS[0];
  const colors = ['#F5A3BD', '#F9D77B', '#B8E39A', '#9EE0E6', '#9FD3F2', '#C7B4F0'];
  return el('div', { class: 'reef', 'aria-label': done + ' of ' + total }, [
    ...Array.from({ length: total }, (_, i) => el('i', { class: 'stone' + (i < done ? ' lit' : i === done ? ' now' : ''), style: '--c:' + colors[i % colors.length] })),
    el('b', { class: 'goal', html: squishySVG(kind, { size: 40, bubble: true }) })
  ]);
}

// First visit: what the two hands do, on a clock that turns by itself.
async function handsIntro() {
  const audio = ctx.audio;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const clock = clockEl({ time: { h: 3, m: 0 }, label: 'clock' });
  const back = el('div', { class: 'scene lagoon intro' }, [el('div', { class: 'stage-row' }, [luna]), el('div', { class: 'clock-play' }, [clock.el])]);
  host.replaceChildren(back);
  const live = () => !cancelled && back.isConnected;
  const say = async (line, cls) => { clock.el.classList.remove('show-hour', 'show-minute'); if (cls) clock.el.classList.add(cls); if (live()) await audio.say(line); };
  await say('This is the short hand. It shows the hour.', 'show-hour');
  await say('This is the long hand. It shows the minutes.', 'show-minute');
  await say('Watch! When the long hand goes all the way around, the short hand moves to the next number.', 'show-minute');
  if (live()) await clock.animateTo({ h: 4, m: 0 }, 3200);
  await say('Now it is four o\'clock.', 'show-hour');
  if (!live()) return false;
  clockSave().intro = ctx.economy.today(); ctx.economy.persist();
  await wait(300);
  return live();
}

async function startRound(kind) {
  if (roundBusy) return; // one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  if (kind === 'hands' || !clockSave().intro) {
    const ok = await handsIntro();
    if (kind === 'hands') { if (ok) { ctx.nav && ctx.nav.pop(); showMenu(); } return; }
    if (!ok) return;
  }
  const result = await runEncounterRound({ host, ctx, place: 'lagoon', cabinetId: 'lagoon', items: buildRound(kind), trail });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'mix', icon: '🌊', name: "Today's tide", primary: true },
    { id: 'read', icon: '🕰️', name: 'Read the clock' },
    { id: 'set', icon: '👆', name: 'Set the clock' },
    { id: 'match', icon: '🔢', name: 'Match the clocks' },
    ...(routinesNow().length ? [{ id: 'day', icon: '🌅', name: 'My day' }] : [])
  ];
  // "How a clock works" sits beside the title, so the menu keeps the usual five tiles and fits a small phone
  const help = el('button', { class: 'help-btn', type: 'button', 'aria-label': 'How a clock works', text: '❓', onclick: () => startRound('hands') });
  host.replaceChildren(el('div', { class: 'scene lagoon' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Tick-Tock Lagoon' }), el('div', { class: 'line', text: 'Tell the time to free the sea Squishies!' })]), help]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Tick-Tock Lagoon! Tell the time to free the sea Squishies!');
}

export async function mount(h, c) { host = h; ctx = c; showMenu(); }
export function unmount() { cancelled = true; host = null; }
// Generators exposed for tests/lagoon.test.js (no DOM needed to generate).
export const __test = { gen, FAMILIES };
