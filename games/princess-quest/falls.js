// games/princess-quest/falls.js — Rainbow Falls: measurement, data and shapes.
// Order follows the learning trajectory evidence (Sarama et al. 2021): name the attribute → direct
// comparison → order three → non-standard units. Data: sort into bins that become a bar chart.
// Geometry (tier 3, light): identify shapes in any orientation, 3D solids, compose from parts.
// Patterns (tier 2): the Rainbow Path — AB / ABB / ABC repeating gems, what comes next, find the odd one.
// Measurement is honest: a balance scale tips toward the heavier side, jars show their fill, towers show height.
import { el, wait, shuffle, pick, choiceGrid, promptBar, bigButton } from '../../shared/ui.js';
import { runEncounterRound, celebrateRound } from '../../shared/encounter.js';
import { lunaSVG, svgFrom, squishySVG, SQUISHY_KINDS } from '../../shared/characters.js';

let roundBusy = false;
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
// Balance scale: the heavier pan sits lower. left/right are emoji; tilt = -1 (left heavier), 1 (right heavier).
function scaleSVG(left, right, tilt) {
  const dy = tilt * 16;
  return `<svg viewBox="0 0 240 150" width="240" height="150" xmlns="http://www.w3.org/2000/svg" aria-label="balance scale">
    <rect x="112" y="40" width="16" height="90" rx="6" fill="#9A7FD6"/><rect x="70" y="126" width="100" height="12" rx="6" fill="#7C5CC4"/>
    <g transform="rotate(${tilt * 9} 120 44)"><rect x="20" y="40" width="200" height="8" rx="4" fill="#C9971F"/></g>
    <g transform="translate(0 ${dy})"><line x1="40" y1="46" x2="40" y2="84" stroke="#C9971F" stroke-width="3"/><path d="M12 84 h56 l-8 22 h-40 z" fill="#E9B949"/><text x="40" y="82" font-size="34" text-anchor="middle">${left}</text></g>
    <g transform="translate(0 ${-dy})"><line x1="200" y1="46" x2="200" y2="84" stroke="#C9971F" stroke-width="3"/><path d="M172 84 h56 l-8 22 h-40 z" fill="#E9B949"/><text x="200" y="82" font-size="34" text-anchor="middle">${right}</text></g>
  </svg>`;
}
// Jar with a fill level 0..1.
function jarSVG(fill, color, label) {
  const h = 90, top = 20 + (1 - fill) * h;
  return `<svg viewBox="0 0 80 130" width="80" height="130" xmlns="http://www.w3.org/2000/svg" aria-label="${label}"><rect x="14" y="20" width="52" height="${h}" rx="10" fill="rgba(255,255,255,0.7)" stroke="#9A7FD6" stroke-width="3"/><rect x="17" y="${top}" width="46" height="${20 + h - top}" rx="8" fill="${color}"/><rect x="24" y="8" width="32" height="14" rx="5" fill="#9A7FD6"/></svg>`;
}
// Tower of stacked blocks with a Squishy face on top: height in blocks.
function towerSVG(blocks, color, label) {
  const bh = 22, h = blocks * bh + 30;
  const rects = Array.from({ length: blocks }, (_, i) => `<rect x="14" y="${h - (i + 1) * bh - 4}" width="52" height="${bh - 3}" rx="6" fill="${color}" stroke="rgba(0,0,0,0.12)"/>`).join('');
  return `<svg viewBox="0 0 80 ${h}" width="80" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-label="${label}">${rects}<ellipse cx="40" cy="${h - blocks * bh - 14}" rx="22" ry="14" fill="#FFF8EE" stroke="#D8CCEB" stroke-width="2"/><circle cx="33" cy="${h - blocks * bh - 16}" r="2.5" fill="#33254F"/><circle cx="47" cy="${h - blocks * bh - 16}" r="2.5" fill="#33254F"/><path d="M34 ${h - blocks * bh - 9} q6 5 12 0" stroke="#33254F" stroke-width="2" fill="none"/></svg>`;
}

const measure = {
  id: 'measure', subskill: 'measure', itemId: it => 'measure:' + it.kind + ':' + it.key,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'attribute') {
      const prompt = it.question + ' What can we measure? How long, how heavy, or how much it holds?';
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
      const prompt = (it.attr === 'long' ? 'Luna needs the longer one to reach across the falls. Which one is longer?'
        : it.attr === 'heavy' ? 'Luna put them on the scale. The heavy side goes down. Which one is heavier?'
        : it.attr === 'tall' ? 'The Squishies built towers. Which tower is taller?'
        : it.attr === 'fill' ? 'Luna poured juice. Which jar has more?'
        : 'Luna is thirsty. Which one holds more water?') + ' Or are they the same?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(it.attr === 'heavy' ? el('div', { html: scaleSVG(a.pic, b.pic, it.equal ? 0 : it.answerIsFirst ? -1 : 1) }) : el('div'));
      const word = { long: 'is longer', heavy: 'is heavier', tall: 'is taller', fill: 'has more', holds: 'holds more' }[it.attr];
      const sameWord = { long: 'are the same length', heavy: 'weigh the same', tall: 'are the same height', fill: 'have the same', holds: 'hold the same' }[it.attr];
      // "same" is a real third answer (sometimes the right one), so a tap on it counts like any other choice.
      const items = [
        ...[a, b].map(x => ({ id: x.name, pic: x.svg ? { svg: x.svg } : x.pic, label: x.name, ok: !it.equal && x === (it.answerIsFirst ? a : b), say: x.name })),
        { id: 'same', pic: '', label: 'same', ok: !!it.equal, say: 'the same', textOnly: true }
      ];
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: it.equal ? 'They ' + sameWord + '.' : 'The ' + (it.answerIsFirst ? a.name : b.name) + ' ' + word + '.' });
      grid.el.classList.add(it.attr === 'long' ? 'one-col' : 'three');
      grid.el.querySelectorAll('.choice').forEach((c, i) => { if (items[i].textOnly) { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); } });
      stage.setBody(grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      return { outcome: outcomeOf(r), choices: 3, gpc: 'compare-' + it.attr };
    }
    if (it.kind === 'order') {
      const prompt = it.attr === 'tall' ? 'Line up the towers from shortest to tallest. Tap the shortest one first.' : 'Luna wants her ' + it.plural + ' lined up from shortest to longest. Tap the shortest one first.';
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
            if (t === sorted[next]) { b.setAttribute('disabled', ''); b.classList.add('right'); target.appendChild(el('span', { text: ['1st', '2nd', '3rd'][next], class: 'word-big' })); next++; if (next === sorted.length) { await audio.say((it.attr === 'tall' ? 'Shortest to tallest! ' : 'Shortest to longest! ') + praiseLine()); resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: 3, gpc: 'order' }); } }
            else { misses++; b.classList.add('wobble'); setTimeout(() => b.classList.remove('wobble'), 500); stage.luna('think', 900); const right = [...tray.querySelectorAll('.choice:not([disabled])')].find(x => x.getAttribute('aria-label') === sorted[next].name); if (misses === 1) { right.classList.add('glow'); await audio.say('Which one is the shortest of these?'); } else right.click(); }
          });
          return b;
        }));
        stage.setBody(tray, target);
      });
      return result;
    }
    // units: how many gems long is the wand?
    const prompt = 'Luna lines up gems along her ' + it.thing + ' to measure it. How many gems long is it?';
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
  { attr: 'color', bins: [['pink', '#F5A3BD'], ['green', '#8FDCCB'], ['yellow', '#F9D77B']] },
  { attr: 'kind', bins: [['flowers', ['🌷', '🌸', '🌼']], ['bugs', ['🐛', '🐝', '🦋']], ['fruit', ['🍎', '🍓', '🍋']]] }
];
const dataSort = {
  id: 'sort', subskill: 'data-sort', itemId: it => 'sort:' + it.attr + ':' + it.items.length,
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    const prompt = it.attr === 'color' ? 'The Squishies got mixed up! Help Luna sort them by color. Tap a Squishy, then tap its basket.' : 'Help Luna tidy the garden. Tap a thing, then tap the basket where it belongs.';
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
          if (!picked) { audio.say('Tap something first, then tap a basket.'); return; }
          const item = picked;
          if (item.bin === bin.name) {
            bin.count++;
            const chip = item.svg ? el('span', { html: item.svg, style: 'display:inline-block;width:26px;height:26px;line-height:0' }) : el('span', { text: item.pic, style: 'font-size:22px;line-height:1' });
            if (item.svg) { const svg = chip.querySelector('svg'); if (svg) { svg.setAttribute('width', '26'); svg.setAttribute('height', '26'); } }
            cell.querySelector('.stack').appendChild(chip);
            const ie = itemEls[it.items.indexOf(item)]; ie.setAttribute('disabled', ''); ie.classList.remove('picked'); ie.style.visibility = 'hidden'; picked = null; placed++;
            if (placed === it.items.length) {
              await audio.say('All sorted! Look, the baskets make a chart. ' + it.question);
              // bar chart from the bins + a 3-choice question
              const max = Math.max(...bins.map(b => b.count));
              const chart = el('div', { class: 'row', style: 'align-items:flex-end;gap:18px' }, bins.map(b => el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' }, [el('div', { style: `width:44px;height:${20 + b.count * 22}px;border-radius:10px 10px 4px 4px;background:${b.color || '#C7B4F0'};border:2px solid #9A7FD6` }), el('div', { class: 'label', text: b.name, style: 'font-weight:700' })])));
              const min = Math.min(...bins.map(x => x.count));
              let items, revealText;
              if (it.ask === 'most' || it.ask === 'fewest') {
                const answerBin = it.ask === 'most' ? bins.find(b => b.count === max) : bins.find(b => b.count === min);
                items = bins.map(b => ({ id: b.name, pic: b.pic || '', label: b.name, ok: b === answerBin, say: b.name }));
                revealText = answerBin.name + ' has the ' + it.ask + '. ' + answerBin.count + '.';
              } else {
                const answer = it.ask === 'howmany' ? bins[it.which].count : bins.find(b => b.count === max).count - bins.find(b => b.count === min).count;
                const set = new Set([answer]); while (set.size < 3) set.add(Math.max(0, answer + pick([-2, -1, 1, 2])));
                items = shuffle([...set]).map(v => ({ id: String(v), pic: '', label: String(v), ok: v === answer, say: String(v), textOnly: true }));
                revealText = it.ask === 'howmany' ? 'There are ' + answer + ' in the ' + bins[it.which].name + ' basket.' : 'There are ' + answer + ' more.';
              }
              const grid = choiceGrid({ audio, prompt: it.question, items, praise: praiseLine(), revealText });
              grid.el.classList.add('three');
              grid.el.querySelectorAll('.choice').forEach((c, i) => { if (items[i].textOnly) { c.classList.add('text-only'); c.querySelector('.pic')?.remove(); } });
              stage.setBody(chart, grid.el);
              const r = await grid.done;
              resolve({ outcome: misses === 0 && !r.misses ? 'firstTry' : (misses <= 1 && !r.revealed) ? 'scaffolded' : 'revealed', choices: 3, gpc: 'sort-' + it.attr });
            }
          } else {
            misses++; cell.classList.add('wobble'); setTimeout(() => cell.classList.remove('wobble'), 500); stage.luna('think', 900);
            const right = bins.find(b => b.name === item.bin).el;
            if (misses === 1) { right.classList.add('glow'); setTimeout(() => right.classList.remove('glow'), 2500); await audio.say(item.name + ' goes in the ' + item.bin + ' basket.'); }
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

// ---------- patterns (Rainbow Path) ----------
// Four elements per set: a unit uses two or three, so "find the odd one" can always drop in a gem that is
// clearly foreign to the pattern instead of a neighbour's colour (which would make two gems look wrong).
const PATTERN_SETS = [['🩷', '💙', '💛', '💚'], ['🌷', '🌼', '🌸', '🍀'], ['💎', '⭐', '🌙', '🔥'], ['🟣', '🟢', '🟠', '🔵']];
function patternFor(stageName) {
  const set = shuffle(pick(PATTERN_SETS));
  const unit = stageName === 'ab' ? [set[0], set[1]] : stageName === 'abb' ? [set[0], set[1], set[1]] : [set[0], set[1], set[2]];
  const reps = stageName === 'ab' ? 4 : 3;
  const seq = Array.from({ length: unit.length * reps }, (_, i) => unit[i % unit.length]);
  return { set, unit, seq };
}
const patterns = {
  id: 'patterns', subskill: 'patterns', itemId: it => 'pattern:' + it.kind + ':' + it.unit.join(''),
  async play(stage, it, ctx, { praiseLine }) {
    const audio = ctx.audio;
    if (it.kind === 'next') {
      const prompt = 'Luna is laying a rainbow path. Say the pattern out loud. What comes next?';
      stage.setPrompt(promptBar(audio, prompt));
      stage.setObject(el('div'));
      const shown = it.seq.slice(0, -1);
      const row = el('div', { class: 'pattern-row' }, [...shown.map(p => el('div', { class: 'pat', text: p })), el('div', { class: 'pat hole', text: '?' })]);
      const answer = it.seq[it.seq.length - 1];
      const options = [answer, ...it.set.filter(x => x !== answer)].slice(0, 3);
      const items = shuffle(options).map(p => ({ id: p, pic: p, ok: p === answer, say: p === answer ? 'this one' : 'not this one' }));
      const grid = choiceGrid({ audio, prompt, items, praise: praiseLine(), revealText: 'The pattern goes ' + it.unit.join(', ') + ', again and again. This comes next.' });
      grid.el.classList.add('three');
      stage.setBody(row, grid.el);
      await audio.say(prompt);
      const r = await grid.done;
      row.lastElementChild.textContent = answer; row.lastElementChild.classList.remove('hole');
      return { outcome: outcomeOf(r), choices: 3, gpc: it.unit.length === 2 ? 'ab' : 'abc' };
    }
    // fix: one gem in the path is wrong; tap it
    const prompt = 'Oh no, one gem is in the wrong place! Say the pattern. Tap the gem that does not belong.';
    stage.setPrompt(promptBar(audio, prompt));
    stage.setObject(el('div'));
    let misses = 0;
    const result = await new Promise(resolve => {
      const row = el('div', { class: 'pattern-row' });
      const buttons = it.seq.map((p, i) => {
        const b = el('button', { class: 'pat', type: 'button', text: i === it.wrongAt ? it.wrongPic : p, 'aria-label': 'gem ' + (i + 1) });
        b.addEventListener('click', async () => {
          if (b.hasAttribute('disabled')) return;
          audio.stop();
          if (i === it.wrongAt) {
            buttons.forEach(x => x.setAttribute('disabled', ''));
            b.textContent = p; b.classList.add('glow');
            await audio.say('That one! Now the path goes ' + it.unit.join(', ') + ', again and again. ' + praiseLine());
            resolve({ outcome: misses === 0 ? 'firstTry' : misses === 1 ? 'scaffolded' : 'revealed', choices: it.seq.length, gpc: 'fix' });
          } else {
            misses++; b.classList.add('wobble'); setTimeout(() => b.classList.remove('wobble'), 500); stage.luna('think', 900);
            if (misses === 1) { buttons[it.wrongAt].classList.add('glow'); await audio.say('Say it slowly: ' + it.unit.join(', ') + '. Which gem breaks the pattern?'); }
            else buttons[it.wrongAt].click();
          }
        });
        row.appendChild(b);
        return b;
      });
      stage.setBody(row);
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
      const prompt = 'Find the ' + it.name + '. Careful, it might be turned around!';
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
      const prompt = 'Luna is looking for a ' + it.name + '. Which one is it?';
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
    const prompt = 'Luna wants to build this ' + it.name + '. Which two pieces fit together to make it?';
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
        { thing: ['the wand', '🪄'], answer: 'long', question: 'Luna lays her wand on the table to see how far it reaches.' },
        { thing: ['the pumpkin', '🎃'], answer: 'heavy', question: 'Luna tries to lift the pumpkin. Oof, it is hard to pick up!' },
        { thing: ['the bucket', '🪣'], answer: 'holds', question: 'Luna fills the bucket with water from the falls.' },
        { thing: ['the ribbon', '🎀'], answer: 'long', question: 'Luna stretches a ribbon along the castle door.' },
        { thing: ['the rock', '🪨'], answer: 'heavy', question: 'Rosie tries to lift a big rock. It will not budge!' },
        { thing: ['the cup', '☕'], answer: 'holds', question: 'Minty pours juice into a cup until it is full.' }
      ]);
      return { kind: 'attribute', key: q.thing[0], ...q };
    }
    if (stageName === 'compare') {
      const attr = pick(['long', 'tall', 'heavy', 'heavy', 'fill', 'holds']);
      if (attr === 'tall') {
        const [o1, o2] = shuffle(OBJECTS).slice(0, 2); const h1 = rand(2, 6); let h2 = rand(2, 6); if (h2 === h1) h2 = h1 + (h1 < 6 ? 1 : -1);
        const [k1, k2] = shuffle(SQUISHY_KINDS).slice(0, 2);
        if (Math.random() < 0.2) h2 = h1;
        return { kind: 'compare', attr, key: 'tower' + h1 + h2, values: [h1, h2], equal: h1 === h2, pair: [{ name: k1.name + '\'s tower', svg: towerSVG(h1, k1.color, k1.name + '\'s tower') }, { name: k2.name + '\'s tower', svg: towerSVG(h2, k2.color, k2.name + '\'s tower') }], answerIsFirst: h1 > h2 };
      }
      if (attr === 'fill') {
        const f1 = pick([0.25, 0.45, 0.65, 0.9]); let f2 = pick([0.25, 0.45, 0.65, 0.9]); if (f2 === f1) f2 = f1 < 0.9 ? f1 + 0.25 : 0.25;
        if (Math.random() < 0.2) f2 = f1;
        return { kind: 'compare', attr, key: 'jar' + f1 + f2, values: [f1, f2], equal: f1 === f2, pair: [{ name: 'pink jar', svg: jarSVG(f1, '#F5A3BD', 'pink jar') }, { name: 'green jar', svg: jarSVG(f2, '#8FDCCB', 'green jar') }], answerIsFirst: f1 > f2 };
      }
      if (attr === 'long') {
        const [o1, o2] = shuffle(OBJECTS).slice(0, 2); const l1 = rand(2, 6); let l2 = rand(2, 6); if (l2 === l1) l2 = l1 + (l1 < 6 ? 1 : -1);
        if (Math.random() < 0.2) l2 = l1;
        return { kind: 'compare', attr, key: o1.name + o2.name, values: [l1, l2], equal: l1 === l2, pair: [{ name: o1.name, svg: wandSVG(l1, o1.color, o1.name) }, { name: o2.name, svg: wandSVG(l2, o2.color, o2.name) }], answerIsFirst: l1 > l2 };
      }
      const pool = attr === 'heavy' ? HEAVY : HOLDS;
      let [x, y] = shuffle(pool).slice(0, 2);
      if (Math.random() < 0.2) { const twin = pool.find(p => p !== x && p[2] === x[2]); if (twin) y = twin; }
      if (x[2] === y[2] && Math.random() >= 0.2) y = pool.find(p => p[2] !== x[2]);
      return { kind: 'compare', attr, key: x[0] + y[0], values: [x[2], y[2]], equal: x[2] === y[2], pair: [{ name: x[0], pic: x[1] }, { name: y[0], pic: y[1] }], answerIsFirst: x[2] > y[2] };
    }
    if (stageName === 'order') {
      const objs = shuffle(OBJECTS).slice(0, 3); const lens = shuffle([2, 4, 6]);
      if (Math.random() < 0.4) return { kind: 'order', attr: 'tall', key: 'towers' + lens.join(''), plural: 'towers', things: objs.map((o, i) => ({ name: o.name + ' tower', len: lens[i], svg: towerSVG(lens[i], o.color, o.name + ' tower') })) };
      return { kind: 'order', key: objs.map(o => o.name).join(''), plural: 'wands', things: objs.map((o, i) => ({ name: o.name, len: lens[i], svg: wandSVG(lens[i], o.color, o.name) })) };
    }
    return { kind: 'units', key: String(rand(1, 99)), thing: pick(['wand', 'ribbon', 'vine']), n: rand(2, 8) };
  }
  if (family === dataSort) {
    const st = stageName; const set = st === 'two' ? SORT_SETS[0] : pick(SORT_SETS);
    const ask = st === 'chart' ? pick(['most', 'fewest', 'howmany', 'more']) : st === 'three' ? pick(['most', 'fewest', 'howmany']) : 'most';
    const binCount = st === 'two' ? 2 : 3;
    const bins = set.bins.slice(0, binCount).map(([name, v]) => ({ name, color: typeof v === 'string' ? v : null, pic: Array.isArray(v) ? v[0] : '' }));
    const items = [];
    // Counts are made distinct BEFORE the objects are drawn, so "most" and "fewest" always have one answer.
    const counts = binCount === 2 ? [rand(2, 4), rand(2, 4)] : shuffle([2, 3, 4]);
    if (binCount === 2 && counts[0] === counts[1]) counts[1] = counts[1] === 4 ? 3 : counts[1] + 1;
    bins.forEach((b, i) => { const v = set.bins[i][1]; for (let k = 0; k < counts[i]; k++) items.push(typeof v === 'string' ? { name: b.name + ' Squishy', bin: b.name, pic: '', svg: squishySVG({ ...SQUISHY_KINDS[0], color: v, dark: '#33254F' }, { size: 44 }) } : { name: v[k % v.length], bin: b.name, pic: v[k % v.length] }); });
    const which = rand(0, bins.length - 1);
    const question = ask === 'howmany' ? 'How many are in the ' + bins[which].name + ' basket?' : ask === 'more' ? 'How many more are in the biggest basket than the smallest?' : 'Which basket has the ' + ask + '?';
    return { attr: set.attr, bins, counts, items: shuffle(items), ask, which, question };
  }
  if (family === patterns) {
    if (stageName === 'fix') {
      const p = patternFor(pick(['ab', 'abb', 'abc']));
      const wrongAt = rand(1, p.seq.length - 2);
      const wrongPic = p.set.find(x => !p.unit.includes(x));
      return { kind: 'fix', ...p, wrongAt, wrongPic };
    }
    return { kind: 'next', ...patternFor(stageName) };
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
const FAMILIES = { measure, sort: dataSort, patterns, shapes };

function buildRound(kind) {
  const items = [];
  const take = f => items.push({ family: f, item: gen(f, ctx.adaptive.stage(f.subskill)) });
  if (FAMILIES[kind]) { for (let i = 0; i < 6; i++) take(FAMILIES[kind]); return items; }
  // Today's rainbow: the planner's target twice, measuring and sorting always, one pattern, shapes only as a treat.
  const target = ctx.adaptive.targetFor('falls');
  const tf = Object.values(FAMILIES).find(f => f.subskill === target) || measure;
  const others = [measure, dataSort, patterns].filter(f => f !== tf);
  take(tf); take(others[0]); take(others[1]); take(tf); take(others[0]); take(Math.random() < 0.5 ? shapes : others[1]);
  return items;
}

async function startRound(kind) {
  if (roundBusy) return; // BUG-04: one round at a time
  roundBusy = true;
  cancelled = false;
  ctx.nav && ctx.nav.push(() => { cancelled = true; ctx.audio.stop(); showMenu(); });
  const result = await runEncounterRound({ host, ctx, place: 'falls', cabinetId: 'falls', items: buildRound(kind), review: new Set(ctx.adaptive.reviewSkills('falls')) });
  if (!result || cancelled) return;
  ctx.refreshBar && ctx.refreshBar();
  celebrateRound(ctx, result, () => { ctx.nav && ctx.nav.pop(); showMenu(); });
}

function showMenu() {
  roundBusy = false;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const modes = [
    { id: 'mix', icon: '💧', name: "Today's rainbow", primary: true },
    { id: 'measure', icon: '📏', name: 'Measure the Falls' },
    { id: 'sort', icon: '🧺', name: 'Sort the Squishies' },
    { id: 'patterns', icon: '🌈', name: 'Rainbow Path' },
    { id: 'shapes', icon: '🔷', name: 'Shape Stones' }
  ];
  host.replaceChildren(el('div', { class: 'scene falls' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Rainbow Falls' }), el('div', { class: 'line', text: 'Luna is measuring and sorting by the falls. What first?' })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.primary ? ' primary' : ''), type: 'button', onclick: () => startRound(m.id) }, [el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name })])))
  ]));
  ctx.audio.say('Welcome to Rainbow Falls! What first?');
}

export async function mount(h, c) { host = h; ctx = c; showMenu(); }
export function unmount() { cancelled = true; host = null; }
// Generators exposed for the stress tests in tests/generators.test.js (no DOM needed to generate).
export const __test = { gen, FAMILIES, patternFor };
