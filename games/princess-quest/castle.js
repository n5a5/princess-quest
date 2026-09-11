// games/princess-quest/castle.js — Story Castle: read-to-me stories and poems (comprehension, vocabulary),
// the Calm Tower (feelings check-in, breathing, calm stories, body scan) and the Uh-Oh Courtyard (scenarios).
// Reading is never a gate: every word is tappable, every line is read aloud, answers are pictures.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton, sheet, confetti, withName } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';

let roundBusy = false;
let host = null, ctx = null, cancelled = false, STORIES = null, CALM = null, SCEN = null;
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';

function tappableLine(audio, text) {
  const line = el('div', { class: 'story-line' });
  line.appendChild(audio.spans(text));
  return line;
}

// ---------- Read to me ----------
const readStory = {
  id: 'story', subskill: 'comprehension', itemId: it => 'story:' + it.story.id + ':' + it.index,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const { story, screen } = it;
    stage.setObject(el('div', { class: 'picture', text: screen.pic }));
    const page = el('div', { class: 'story-page' }, [tappableLine(audio, screen.text), el('div', { class: 'row' }, [el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Read it again', text: '🔊', onclick: () => audio.say(screen.text) })])]);
    stage.setPrompt(el('div', { class: 'story-title', text: story.title }));
    stage.setBody(page);
    await audio.say(screen.text);
    await wait(400);
    const q = screen.question;
    const items = shuffle(q.choices).map(c => ({ id: c.label, pic: c.pic, label: c.label, ok: c.ok, say: c.label }));
    const grid = choiceGrid({ audio, prompt: q.prompt, items, praise: praiseLine(), revealText: 'It is ' + q.choices.find(c => c.ok).label + '.' });
    grid.el.classList.add('three');
    stage.setBody(page, promptBar(audio, q.prompt), grid.el);
    await audio.say(q.prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: story.kind };
  }
};

const vocabRecall = {
  id: 'vocab', subskill: 'comprehension', itemId: it => 'vocab:' + it.story.id,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const v = it.story.vocab;
    const prompt = 'Remember the word ' + v.word + '? ' + v.word + ' means ' + v.meaning + '. ' + v.question;
    stage.setObject(el('div', { class: 'picture', text: v.pic }));
    stage.setPrompt(promptBar(audio, prompt));
    const items = shuffle(v.choices).map(c => ({ id: c.pic, pic: c.pic, ok: c.ok, say: c.ok ? v.word : 'not this one' }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This one shows ' + v.word + '.' });
    grid.el.classList.add('three');
    stage.setBody(el('div', { class: 'word-big', text: v.word }), grid.el);
    await audio.say(prompt);
    const r = await grid.done;
    const s = ctx.economy.save; s.vocab[v.word] = { storyId: it.story.id, learnedDay: s.vocab[v.word]?.learnedDay || ctx.economy.today(), recalled: !r.misses }; ctx.economy.persist();
    return { outcome: outcomeOf(r), choices: 3, gpc: 'vocab' };
  }
};

const readPoem = {
  id: 'poem', subskill: 'comprehension', itemId: it => 'poem:' + it.id,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    stage.setObject(el('div', { class: 'picture', text: '📜' }));
    stage.setPrompt(el('div', { class: 'story-title', text: it.title }));
    const page = el('div', { class: 'story-page' }, it.lines.map(l => tappableLine(audio, l)));
    stage.setBody(page);
    for (const l of it.lines) { await audio.say(l, { interrupt: false }); await wait(150); }
    const q = it.rhymeQuestion;
    const items = shuffle(q.choices).map(c => ({ id: c.label, pic: c.pic, label: c.label, ok: c.ok, say: c.label }));
    const grid = choiceGrid({ audio, prompt: q.prompt, items, praise: praiseLine(), revealText: q.choices.find(c => c.ok).label + ' rhymes.' });
    grid.el.classList.add('three');
    stage.setBody(page, promptBar(audio, q.prompt), grid.el);
    await audio.say(q.prompt);
    const r = await grid.done;
    return { outcome: outcomeOf(r), choices: 3, gpc: 'rhyme' };
  }
};

function buildReadRound() {
  const s = ctx.economy.save;
  const stageName = ctx.adaptive.stage('comprehension');
  const kind = stageName === 'informational' ? 'informational' : 'literary';
  const items = [];
  // A vocabulary word learned on an earlier day comes back first (next-day recall).
  const due = Object.entries(s.vocab).find(([, v]) => v.learnedDay !== ctx.economy.today() && !v.recalled);
  if (due) { const st = STORIES.stories.find(x => x.id === due[1].storyId); if (st) items.push({ family: vocabRecall, item: { story: st } }); }
  const story = pick(STORIES.stories.filter(x => x.kind === kind));
  story.screens.forEach((screen, index) => items.push({ family: readStory, item: { story, screen, index } }));
  if (!s.vocab[story.vocab.word]) items.push({ family: vocabRecall, item: { story } });
  if (stageName === 'poems' || Math.random() < 0.5) items.push({ family: readPoem, item: pick(STORIES.poems) });
  return items.slice(0, 7);
}

async function startReadRound() {
  if (roundBusy) return; // BUG-04: one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'castle', cabinetId: 'castle', items: buildReadRound() });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

// ---------- Calm Tower ----------
async function calmTower() {
  const audio = ctx.audio;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const feelings = CALM.feelings;
  host.replaceChildren(el('div', { class: 'scene castle' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Calm Tower' }), el('div', { class: 'line', text: 'How do you feel right now?' })])]),
    el('div', { class: 'choices three' }, feelings.map(f => el('button', { class: 'choice', type: 'button', 'aria-label': f.name, onclick: () => pickFeeling(f) }, [el('span', { class: 'pic', text: f.pic }), el('span', { class: 'label', text: f.name })])))
  ]));
  await audio.say('How do you feel right now? Tap the face that matches.');
  async function pickFeeling(f) {
    audio.stop();
    const s = ctx.economy.save; s.feelingsLog = s.feelingsLog || []; s.feelingsLog.push({ day: ctx.economy.today(), feeling: f.id }); ctx.economy.persist();
    await audio.say(f.tip);
    if (f.route === 'breathing') breathe(pick(CALM.breathing));
    else if (f.route === 'bodyscan') bodyScan();
    else calmStory(pick(CALM.stories));
  }
}

async function breathe(pattern) {
  const audio = ctx.audio;
  const bubble = el('div', { class: 'bubble' });
  const label = el('h2', { text: pattern.name });
  const o = sheet([label, bubble, bigButton('Stop', () => { stop = true; o.remove(); calmMenu(); }, 'soft')]);
  let stop = false;
  await audio.say(pattern.line);
  for (let i = 0; i < pattern.cycles && !stop; i++) {
    label.textContent = 'Breathe in'; audio.say('Breathe in');
    await wait(50); bubble.classList.remove('out'); bubble.classList.add('in'); bubble.style.transitionDuration = pattern.inMs + 'ms';
    await wait(pattern.inMs); if (stop) return;
    label.textContent = 'Breathe out'; audio.say('Breathe out');
    bubble.classList.remove('in'); bubble.classList.add('out'); bubble.style.transitionDuration = pattern.outMs + 'ms';
    await wait(pattern.outMs);
  }
  if (stop) return;
  o.remove();
  ctx.economy.addCompanionStars(1); ctx.refreshBar && ctx.refreshBar();
  await audio.say('Lovely breathing. Luna feels calm too.');
  calmMenu();
}

async function bodyScan() {
  const audio = ctx.audio;
  let stop = false;
  const pic = el('div', { class: 'big-emoji', text: '🦶' });
  const line = el('h2', { text: 'Body scan' });
  const o = sheet([pic, line, bigButton('Stop', () => { stop = true; o.remove(); calmMenu(); }, 'soft')]);
  for (const part of CALM.bodyScan) {
    if (stop) return;
    pic.textContent = part.pic; line.textContent = 'Squeeze your ' + part.part;
    await audio.say(part.squeeze); await wait(2500); if (stop) return;
    line.textContent = 'Let go';
    await audio.say(part.release); await wait(2000);
  }
  if (stop) return;
  o.remove();
  ctx.economy.addCompanionStars(1); ctx.refreshBar && ctx.refreshBar();
  await audio.say('Your whole body is soft and calm now.');
  calmMenu();
}

async function calmStory(story) {
  const audio = ctx.audio;
  host.replaceChildren();
  for (const screen of story.screens) {
    const page = el('div', { class: 'scene castle' }, [
      el('div', { class: 'scene-head' }, [el('div', { class: 'picture', text: screen.pic, style: 'font-size:64px;min-height:0' }), el('div', { class: 'title', text: story.title })]),
      tappableLine(audio, screen.text)
    ]);
    host.replaceChildren(page);
    await audio.say(screen.text);
    if (screen.choice) {
      const items = shuffle(screen.choice.options).map(o => ({ id: o.text, pic: o.pic, label: o.text, ok: o.quality === 'best', say: o.text, feedback: o.feedback }));
      const grid = choiceGrid({ audio, prompt: screen.choice.prompt, items, praise: items.find(i => i.ok).feedback, revealText: items.find(i => i.ok).feedback });
      grid.el.classList.add('one-col');
      page.append(promptBar(audio, screen.choice.prompt), grid.el);
      await audio.say(screen.choice.prompt);
      await grid.done;
    } else {
      const next = bigButton('Next', () => {}, 'gold');
      page.appendChild(el('div', { class: 'row' }, [next]));
      await new Promise(r => next.addEventListener('click', r, { once: true }));
    }
  }
  ctx.economy.addCompanionStars(1); ctx.refreshBar && ctx.refreshBar();
  await audio.say('The end. Naming a feeling makes it smaller.');
  calmMenu();
}

function calmMenu() {
  if (!calmMenu.pushed) { calmMenu.pushed = true; ctx.nav && ctx.nav.push(() => { calmMenu.pushed = false; ctx.audio.stop(); showMenu(); }); }
  const luna = svgFrom(lunaSVG({ state: 'happy', glow: ctx.economy.companion().level }));
  const modes = [
    { icon: '💜', name: 'How do I feel?', run: calmTower },
    { icon: '🫧', name: 'Bubble breath', run: () => breathe(CALM.breathing[0]) },
    { icon: '🦄', name: 'Unicorn breath', run: () => breathe(CALM.breathing[2]) },
    { icon: '🧘', name: 'Squeeze and relax', run: bodyScan },
    { icon: '📖', name: 'Calm story', run: () => calmStory(pick(CALM.stories)) },
    { icon: '🏰', name: 'Back to the castle', run: () => { calmMenu.pushed = false; ctx.nav && ctx.nav.pop(); showMenu(); } }
  ];
  host.replaceChildren(el('div', { class: 'scene castle' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Calm Tower' }), el('div', { class: 'line', text: 'A quiet place at the top of the castle.' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn', type: 'button', onclick: m.run }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
}

// ---------- Uh-Oh Courtyard ----------
async function courtyard() {
  const audio = ctx.audio;
  let left = false;
  ctx.nav && ctx.nav.push(() => { left = true; ctx.audio.stop(); showMenu(); });
  const s = ctx.economy.save; s.scenariosSeen = s.scenariosSeen || [];
  const fresh = SCEN.scenarios.filter(x => !s.scenariosSeen.includes(x.id));
  const set = shuffle(fresh.length >= 3 ? fresh : SCEN.scenarios).slice(0, 3);
  for (const sc of set) {
    const page = el('div', { class: 'scene castle' }, [
      el('div', { class: 'scene-head' }, [el('div', { class: 'picture', text: sc.pic, style: 'font-size:64px;min-height:0' }), el('div', { class: 'title', text: 'What would you do?' })]),
      tappableLine(audio, sc.text)
    ]);
    host.replaceChildren(page);
    await audio.say(sc.text + ' What would you do?');
    const items = shuffle(sc.choices).map(c => ({ id: c.text, pic: c.pic, label: c.text, ok: c.quality === 'best', say: c.text }));
    const grid = choiceGrid({ audio, prompt: 'What would you do?', items, praise: sc.choices.find(c => c.quality === 'best').feedback, revealText: sc.choices.find(c => c.quality === 'best').feedback });
    grid.el.classList.add('one-col');
    // Every option speaks its own warm feedback when tapped, even the not-great ones.
    grid.el.querySelectorAll('.choice').forEach((b, i) => b.addEventListener('click', () => { const c = sc.choices.find(x => x.text === items[i].id); if (c && c.quality !== 'best') setTimeout(() => audio.say(c.feedback), 100); }, { capture: true }));
    page.appendChild(grid.el);
    await grid.done;
    if (left) return;
    s.scenariosSeen.push(sc.id); ctx.economy.persist();
    await wait(1200);
  }
  if (left) return;
  ctx.economy.addCompanionStars(1); ctx.economy.addGems(3); ctx.refreshBar && ctx.refreshBar();
  confetti(40);
  await audio.say('Three kind choices. The courtyard is happy.');
  ctx.nav && ctx.nav.pop();
  showMenu();
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'read', icon: '📖', name: 'Read to me', primary: true, run: startReadRound },
    { id: 'calm', icon: '🫧', name: 'Calm Tower', run: calmMenu },
    { id: 'uhoh', icon: '🤗', name: 'Uh-Oh Courtyard', run: courtyard }
  ];
  host.replaceChildren(el('div', { class: 'scene castle' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Story Castle' }), el('div', { class: 'line', text: 'Stories, poems, and a quiet tower.' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: m.run }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Story Castle! What shall we do?');
}

export async function mount(h, c) {
  host = h; ctx = c;
  [STORIES, CALM, SCEN] = await Promise.all([ctx.content.load('stories'), ctx.content.load('calm'), ctx.content.load('scenarios')]);
  showMenu();
}
export function unmount() { cancelled = true; host = null; }
