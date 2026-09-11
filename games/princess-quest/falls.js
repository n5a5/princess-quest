// games/princess-quest/falls.js — Rainbow Falls: measurement, data and shapes.
// Order follows the learning trajectory evidence (Sarama et al. 2021): name the attribute → direct
// comparison → order three → non-standard units. Data: sort into bins that become a bar chart.
// Geometry (tier 2, light): identify shapes in any orientation, 3D solids, compose from parts.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom, squishySVG, SQUISHY_KINDS } from '../../shared/characters.js';

let host = null, ctx = null, cancelled = false;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const outcomeOf = r => r.revealed ? 'revealed' : r.misses ? 'scaffolded' : 'firstTry';

// Objects drawn as simple SVG bars so length differences are honest and scalable.
function wandSVG(len, color, label) {
  const w = 40 + len * 26;
  return `<svg viewBox="0 0 ${w + 20} 44" width="${Math.min(w + 20, 330)}" height="44" xmlns="http://www.w3.org/2000/svg" aria-label="${label}"><rect x="10" y="16" width="${w}" height="12" rx="6" fill="${color}"/><path d="M${w + 4} 6 l4 8 l8 2 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -2 z" fill="#E9B949"/></svg>`;
}
const OBJECTS = [
  { name: 'wand', color: '#7C5CC4' }, { name: 'ribbon', color: '#E2688F' }, { name: 'vine', color: '#4DB6A4' }, { name: 'scarf', color: '#7CC7F0' }, { name: 'ladder', color: '#E9B949' }
];
const HEAVY = [['a rock', '🪨', 3], ['a feather', '🪶', 1], ['a pumpkin', '🎃', 3], ['a leaf', '🍃', 1], ['a book', '📚', 2], ['a balloon', '🎈', 1], ['a gem', '💎', 2], ['a cloud', '☁️', 1]];
const HOLDS = [['a bucket', '🪣', 3], ['a cup', '☕', 1], ['a bathtub', '🛁', 3], ['a spoon', '🥄', 1], ['a jug', '🫗', 2], ['a bottle', '🍼', 1]];

const measure = {
  id: 'measure', subskill: 'measure', itemId: it => 'measure:' + it.kind + ':' + it.key,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'attribute') {
      const prompt = 'What can we measure about ' + it.thing[0] + '? ' + it.question;
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div', { class: 'picture', text: it.thing[1] }));
      const items = shuffle([
        { id: 'long', pic: '📏', label: 'how long', ok: it.answer === 'long', say: 'how long' },
        { id: 'heavy', pic: '⚖️', label: 'how heavy', ok: it.answer === 'heavy', say: 'how heavy' },
        { id: 'holds', pic: '🪣', label: 'how much it holds', ok: it.answer === 'holds', say: 'how much it holds' }
      ]);
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'We can measure ' + { long: 'how long it is', heavy: 'how heavy it is', holds: 'how much it holds' }[it.answer] + '.' });
      grid.el.classList.add('three');
      stage.setBody(grid.el);
      await audio.say(prompt);
      return { outcome: outcomeOf(await grid.done), choices: 3, gpc: 'attribute' };
    }
    if (it.kind === 'compare') {
      const [a, b] = it.pair;
      const prompt = it.attr === 'long' ? 'Which one is longer?' : it.attr === 'heavy' ? 'Which one is heavier?' : 'Which one holds more?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const items = [a, b].map(x => ({ id: x.name, pic: x.pic, label: x.name, ok: x === (it.answerIsFirst ? a : b), say: x.name, svg: x.svg }));
      const grid = choiceGrid({ audio, prompt, items: items.map(i => ({ ...i, pic: i.svg ? { svg: i.svg } : i.pic })), praise: praiseLine(), revealText: 'The ' + (it.answerIsFirst ? a.name : b.name) + ' ' + (it.attr === 'long' ? 'is longer' : it.attr === 'heavy' ? 'is heavier' : 'holds more') + '.' });
      grid.el.classList.add('one-col');
      // Third option keeps it a real 3-choice item: "the same"
      const same = el('button', { class: 'choice text-only', type: 'button', 'aria-label': 'the same', text: '=' });
      same.addEventListener('click', () => { same.classList.add('dim'); same.setAttribute('disabled', ''); audio.say('Look again. One is ' + (it.attr === 'long' ? 'longer' : it.attr === 'heavy' ? 'heavier' : 'bigger') + '.'); stage.luna('think', 900); });
      grid.el.appendChild(same);
      stage.setBody(grid.el);
      if (it.attr === 'heavy') { await audio.say(prompt + ' Think about which one would tip the scale.'); } else await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'compare-' + it.attr };
    }
    if (it.kind === 'order') {
      const prompt = 'Put the ' + it.plural + ' in order: shortest first. Tap them shortest to longest.';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      let misses = 0, next = 0;
      const result = await new Promise(resolve => {
        const sorted = [...it.things].sort((a, b) => a.len - b.len);
        const target = el('div', { class: 'row', style: 'min-height:50px' });
        const tray = el('div', { class: 'board' }, shuffle(it.things).map(t => {
          const b = el('button', { class: 'choice', type: 'button', 'aria-label': t.name, html: t.svg, style: 'min-height:64px;padding:8px' });
          b.addEventListener('click', async () => {
            audio.stop();
            if (t === sorted[next]) { b.setAttribute('disabled', ''); b.classList.add('right'); target.appendChild(el('span', { text: ['1st', '2nd', '3rd'][next], class: 'word-big' })); next++; if (next === sorted.length) { await audio.say('Shortest to longest! ' + praiseLine()); resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 3, gpc: 'order' }); } }
            else { misses++; b.classList.add('wobble'); setTimeout(() => b.classList.remove('wobble'), 500); stage.luna('think', 900); const right = [...tray.querySelectorAll('.choice:not([disabled])')].find(x => x.getAttribute('aria-label') === sorted[next].name); if (misses === 1) { right.classList.add('glow'); await audio.say('Which one is the shortest of these?'); } else right.click(); }
          });
          return b;
        }));
        stage.setBody(tray, target);
      });
      return result;
    }
    // units: how many gems long is the wand?
    const prompt = 'How many gems long is the ' + it.thing + '? Count the gems.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    const gemsRow = el('div', { class: 'row', style: 'gap:0;font-size:28px;justify-content:flex-start;padding-left:10px' }, Array.from({ length: it.n }, () => el('span', { text: '💎', style: 'width:26px;text-align:center' })));
    const vis = el('div', { class: 'board' }, [el('div', { html: wandSVG(it.n, '#7C5CC4', it.thing), style: 'padding-left:0' }), gemsRow]);
    const set = new Set([it.n]); while (set.size < 3) set.add(Math.max(1, it.n + pick([-2, -1, 1, 2])));
    const items = shuffle([...set]).map(v => ({ id: String(v), pic: '', label: String(v), ok: v === it.n, say: String(v) }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'It is ' + it.n + ' gems long.' });
    grid.el.classList.add('three'); grid.el.querySelectorAll('.choice').forEach(c => { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); });
    stage.setBody(vis, grid.el);
    await audio.say(prompt);
    return { outcome: outcomeOf(await grid.done), choices: 3, gpc: 'units' };
  }
};

const SORT_SETS = [
  { attr: 'colour', bins: [['pink', '#F5A3BD'], ['mint', '#8FDCCB'], ['sunny', '#F9D77B']] },
  { attr: 'kind', bins: [['flowers', ['🌷', '🌸', '🌼']], ['bugs', ['🐛', '🐝', '🦋']], ['fruit', ['🍎', '🍓', '🍋']]] }
];
const dataSort = {
  id: 'sort', subskill: 'data-sort', itemId: it => 'sort:' + it.attr + ':' + it.items.length,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = 'Sort the ' + (it.attr === 'colour' ? 'Squishies by colour' : 'things into their groups') + '. Tap one, then tap its bin.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    let misses = 0, picked = null, placed = 0;
    const result = await new Promise(resolve => {
      const bins = it.bins.map(b => ({ ...b, count: 0, el: null }));
      const tray = el('div', { class: 'row' });
      const binRow = el('div', { class: 'row', style: 'align-items:flex-end' });
      const itemEls = it.items.map(item => {
        const b = el('button', { class: 'tile', type: 'button', 'aria-label': item.name, style: 'min-width:64px;font-size:32px;padding:0 6px' });
        if (item.svg) b.innerHTML = item.svg; else b.textContent = item.pic;
        b.addEventListener('click', () => { if (b.hasAttribute('disabled')) return; audio.stop(); itemEls.forEach(x => x.classList.remove('picked')); picked = item; b.classList.add('picked'); audio.say(item.name); });
        tray.appendChild(b); return b;
      });
      bins.forEach(bin => {
        const cell = el('button', { class: 'choice', type: 'button', 'aria-label': bin.name + ' bin', style: 'min-height:96px;min-width:90px;flex-direction:column;justify-content:flex-end' }, [el('div', { class: 'stack', style: 'display:flex;flex-direction:column-reverse;gap:2px;min-height:60px' }), el('div', { class: 'label', text: bin.name })]);
        bin.el = cell;
        cell.addEventListener('click', async () => {
          if (!picked) { audio.say('Tap a thing first.'); return; }
          const item = picked;
          if (item.bin === bin.name) {
            bin.count++; cell.querySelector('.stack').appendChild(el('span', { text: item.pic, style: 'font-size:22px;line-height:1' }));
            const ie = itemEls[it.items.indexOf(item)]; ie.setAttribute('disabled', ''); ie.classList.remove('picked'); ie.style.visibility = 'hidden'; picked = null; placed++;
            if (placed === it.items.length) {
              await audio.say('All sorted! Now the chart. ' + it.question);
              // bar chart from the bins + a 3-choice question
              const max = Math.max(...bins.map(b => b.count));
              const chart = el('div', { class: 'row', style: 'align-items:flex-end;gap:18px' }, bins.map(b => el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' }, [el('div', { style: `width:44px;height:${20 + b.count * 22}px;border-radius:10px 10px 4px 4px;background:${b.color || '#C7B4F0'};border:2px solid #9A7FD6` }), el('div', { class: 'label', text: b.name, style: 'font-weight:700' })])));
              const answerBin = it.ask === 'most' ? bins.find(b => b.count === max) : bins.find(b => b.count === Math.min(...bins.map(x => x.count)));
              const items = bins.map(b => ({ id: b.name, pic: b.pic || '', label: b.name + ' ' + '💎'.repeat(0), ok: b === answerBin, say: b.name }));
              const grid = choiceGrid({ audio, prompt: it.question, items, praise: praiseLine(), revealText: answerBin.name + ' has the ' + it.ask + '.' });
              grid.el.classList.add('three');
              stage.setBody(chart, grid.el);
              const r = await grid.done;
              resolve({ outcome: misses === 0 && !r.misses ? 'firstTry' : (misses <= 1 && !r.revealed) ? 'scaffolded' : 'revealed', choices: 3, gpc: 'sort-' + it.attr });
            }
          } else {
            misses++; cell.classList.add('wobble'); setTimeout(() => cell.classList.remove('wobble'), 500); stage.luna('think', 900);
            const right = bins.find(b => b.name === item.bin).el;
            if (misses === 1) { right.classList.add('glow'); setTimeout(() => right.classList.remove('glow'), 2500); await audio.say(item.name + ' goes in the ' + item.bin + ' bin.'); }
            else right.click();
          }
        });
        binRow.appendChild(cell);
      });
      stage.setBody(tray, binRow);
    });
    return result;
  }
};

const SHAPES2D = [
  { name: 'circle', svg: r => `<circle cx="40" cy="40" r="30" fill="${r}"/>` },
  { name: 'square', svg: r => `<rect x="12" y="12" width="56" height="56" rx="6" fill="${r}"/>` },
  { name: 'triangle', svg: r => `<path d="M40 10 L72 68 L8 68 Z" fill="${r}" stroke-linejoin="round"/>` },
  { name: 'rectangle', svg: r => `<rect x="6" y="22" width="68" height="36" rx="6" fill="${r}"/>` }
];
const SHAPES3D = [['sphere', '🏀'], ['cube', '🎲'], ['cone', '🍦'], ['cylinder', '🥫']];
const COLORS = ['#7C5CC4', '#E2688F', '#4DB6A4', '#E9B949', '#7CC7F0'];
const shapeSVG = (s, color, rot) => `<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${rot} 40 40)">${s.svg(color)}</g></svg>`;

const shapes = {
  id: 'shapes', subskill: 'shapes', itemId: it => 'shape:' + it.kind + ':' + it.name,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === '2d') {
      const prompt = 'Find the ' + it.name + '. It can be turned any way.';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const items = shuffle([it.name, ...it.foils]).map(n => { const s = SHAPES2D.find(x => x.name === n); return { id: n, pic: { svg: shapeSVG(s, pick(COLORS), rand(0, 359)) }, ok: n === it.name, say: n }; });
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This is the ' + it.name + '.' });
      grid.el.classList.add('three');
      stage.setBody(grid.el);
      await audio.say(prompt);
      return { outcome: outcomeOf(await grid.done), choices: 3, gpc: it.name };
    }
    if (it.kind === '3d') {
      const prompt = 'Which one is a ' + it.name + '?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const items = shuffle([it.name, ...it.foils]).map(n => { const s = SHAPES3D.find(x => x[0] === n); return { id: n, pic: s[1], label: n, ok: n === it.name, say: n }; });
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'This is the ' + it.name + '.' });
      grid.el.classList.add('three');
      stage.setBody(grid.el);
      await audio.say(prompt);
      return { outcome: outcomeOf(await grid.done), choices: 3, gpc: it.name };
    }
    // compose: which two shapes make this one? (square from two triangles, rectangle from two squares)
    const prompt = 'Which two pieces make this ' + it.name + '?';
    stage.setPrompt(promptBar(audio, prompt));
    const target = SHAPES2D.find(s => s.name === it.name);
    stage.setObject(el('div', { html: shapeSVG(target, '#7C5CC4', 0) }));
    const items = shuffle(it.options).map(o => ({ id: o.label, pic: { svg: `<svg viewBox="0 0 160 80" width="150" height="75" xmlns="http://www.w3.org/2000/svg">${o.svg}</svg>` }, ok: o.ok, say: o.label }));
    const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: it.options.find(o => o.ok).label + ' make a ' + it.name + '.' });
    grid.el.classList.add('one-col');
    stage.setBody(grid.el);
    await audio.say(prompt);
    return { outcome: outcomeOf(await grid.done), choices: 3, gpc: 'compose' };
  }
};

// ---------- generators ----------
function gen(family, stageName) {
  if (family === measure) {
    if (stageName === 'attribute') {
      const q = pick([
        { thing: ['the wand', '🪄'], answer: 'long', question: 'Is it how long, how heavy, or how much it holds?' },
        { thing: ['the pumpkin', '🎃'], answer: 'heavy', question: 'It is very heavy to lift. What do we measure?' },
        { thing: ['the bucket', '🪣'], answer: 'holds', question: 'We fill it with water. What do we measure?' },
        { thing: ['the ribbon', '🎀'], answer: 'long', question: 'We stretch it out. What do we measure?' },
        { thing: ['the rock', '🪨'], answer: 'heavy', question: 'We lift it up. What do we measure?' },
        { thing: ['the cup', '☕'], answer: 'holds', question: 'We pour juice in. What do we measure?' }
      ]);
      return { kind: 'attribute', key: q.thing[0], ...q };
    }
    if (stageName === 'compare') {
      const attr = pick(['long', 'long', 'heavy', 'holds']);
      if (attr === 'long') {
        const [o1, o2] = shuffle(OBJECTS).slice(0, 2); const l1 = rand(2, 6); let l2 = rand(2, 6); if (l2 === l1) l2 = l1 + (l1 < 6 ? 1 : -1);
        return { kind: 'compare', attr, key: o1.name + o2.name, pair: [{ name: o1.name, svg: wandSVG(l1, o1.color, o1.name) }, { name: o2.name, svg: wandSVG(l2, o2.color, o2.name) }], answerIsFirst: l1 > l2 };
      }
      const pool = attr === 'heavy' ? HEAVY : HOLDS;
      let [x, y] = shuffle(pool).slice(0, 2); if (x[2] === y[2]) y = pool.find(p => p[2] !== x[2]);
      return { kind: 'compare', attr, key: x[0] + y[0], pair: [{ name: x[0], pic: x[1] }, { name: y[0], pic: y[1] }], answerIsFirst: x[2] > y[2] };
    }
    if (stageName === 'order') {
      const objs = shuffle(OBJECTS).slice(0, 3); const lens = shuffle([2, 4, 6]);
      return { kind: 'order', key: objs.map(o => o.name).join(''), plural: 'wands', things: objs.map((o, i) => ({ name: o.name, len: lens[i], svg: wandSVG(lens[i], o.color, o.name) })) };
    }
    return { kind: 'units', key: String(rand(1, 99)), thing: pick(['wand', 'ribbon', 'vine']), n: rand(2, 8) };
  }
  if (family === dataSort) {
    const st = stageName; const set = st === 'two' ? SORT_SETS[0] : pick(SORT_SETS);
    const binCount = st === 'two' ? 2 : 3;
    const bins = set.bins.slice(0, binCount).map(([name, v]) => ({ name, color: typeof v === 'string' ? v : null, pic: Array.isArray(v) ? v[0] : '' }));
    const items = [];
    const counts = shuffle(binCount === 2 ? [rand(2, 4), rand(2, 4)] : [2, 3, 4]);
    bins.forEach((b, i) => { const v = set.bins[i][1]; for (let k = 0; k < counts[i]; k++) items.push(typeof v === 'string' ? { name: b.name + ' Squishy', bin: b.name, pic: '', svg: squishySVG({ ...SQUISHY_KINDS[0], color: v, dark: '#33254F' }, { size: 44 }) } : { name: v[k % v.length], bin: b.name, pic: v[k % v.length] }); });
    if (counts[0] === counts[1] && binCount === 2) counts[1]++;
    const ask = st === 'chart' ? pick(['most', 'fewest']) : 'most';
    return { attr: set.attr, bins, items: shuffle(items), ask, question: 'Which group has the ' + ask + '?' };
  }
  if (family === shapes) {
    if (stageName === '2d') { const names = SHAPES2D.map(s => s.name); const name = pick(names); return { kind: '2d', name, foils: shuffle(names.filter(n => n !== name)).slice(0, 2) }; }
    if (stageName === '3d') { const names = SHAPES3D.map(s => s[0]); const name = pick(names); return { kind: '3d', name, foils: shuffle(names.filter(n => n !== name)).slice(0, 2) }; }
    const tri = c => `<path d="M0 60 L60 60 L60 0 Z" fill="${c}"/>`;
    const options = [
      { label: 'two triangles', ok: true, svg: `<g transform="translate(10,10)">${tri('#E2688F')}</g><g transform="translate(90,10) rotate(180 30 30)">${tri('#7CC7F0')}</g>` },
      { label: 'two circles', ok: false, svg: `<circle cx="40" cy="40" r="28" fill="#4DB6A4"/><circle cx="120" cy="40" r="28" fill="#E9B949"/>` },
      { label: 'a circle and a triangle', ok: false, svg: `<circle cx="40" cy="40" r="28" fill="#4DB6A4"/><g transform="translate(90,10)">${tri('#E2688F')}</g>` }
    ];
    return { kind: 'compose', name: 'square', options };
  }
}
const FAMILIES = { measure, sort: dataSort, shapes };

function buildRound(kind) {
  const items = [];
  const take = f => items.push({ family: f, item: gen(f, ctx.adaptive.stage(f.subskill)) });
  if (FAMILIES[kind]) { for (let i = 0; i < 6; i++) take(FAMILIES[kind]); return items; }
  const target = ctx.adaptive.todayQuest().requiredSubskill;
  const tf = Object.values(FAMILIES).find(f => f.subskill === target) || measure;
  take(tf); take(measure); take(dataSort); take(tf); take(shapes); take(tf === measure ? dataSort : measure);
  return items;
}

async function startRound(kind) {
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'falls', cabinetId: 'falls', items: buildRound(kind), review: new Set(ctx.adaptive.reviewSkills('falls')) });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'mix', icon: '🌈', name: "Today's rainbow", primary: true },
    { id: 'measure', icon: '📏', name: 'Measure the Falls' },
    { id: 'sort', icon: '🧺', name: 'Sort the Squishies' },
    { id: 'shapes', icon: '🔷', name: 'Shape Stones' }
  ];
  host.replaceChildren(el('div', { class: 'scene falls' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Rainbow Falls' }), el('div', { class: 'line', text: 'The rainbow needs measuring. What first?' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Rainbow Falls! What first?');
}

export async function mount(h, c) { host = h; ctx = c; showMenu(); }
export function unmount() { cancelled = true; host = null; }
