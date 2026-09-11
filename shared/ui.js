// shared/ui.js — DOM builders, the scaffolded choice grid, tiles and slots, rounds, celebrations.
// Every function that speaks takes `audio` (shared/audio.js), never TTS directly.
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const withName = (t, name) => t.replace(/\{name\}/g, name);

export function bigButton(label, onTap, cls = '') {
  return el('button', { class: 'big-btn ' + cls, type: 'button', onclick: onTap, text: label });
}
export function speakButton(audio, text) {
  return el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Hear it again', text: '🔊', onclick: () => audio.say(text) });
}
export function promptBar(audio, text) {
  const t = el('div', { class: 'text' });
  t.appendChild(audio.spans(text));
  return el('div', { class: 'prompt' }, [t, speakButton(audio, text)]);
}
export function picture(pic, onTap) {
  const p = el('div', { class: 'picture' + (onTap ? ' tappable' : '') });
  if (pic && pic.svg) p.innerHTML = pic.svg; else p.textContent = pic || '';
  if (onTap) p.addEventListener('click', onTap);
  return p;
}
export function roundDots(total, done) {
  return el('div', { class: 'round-dots' }, Array.from({ length: total }, (_, i) => el('span', { class: i < done ? 'done' : '', text: '🌸' })));
}

// Scaffolded choice grid. items: [{ id, pic, label, ok, say? }]. Resolves { firstTry, misses, revealed }.
// Miss 1: tapped choice dims, correct choice glows, prompt re-speaks. Miss 2: reveal + speak answer.
export function choiceGrid({ audio, prompt, items, praise, oneCol = false, revealText = null }) {
  const grid = el('div', { class: 'choices' + (oneCol ? ' one-col' : '') });
  let misses = 0, settled = false;
  const buttons = new Map();
  const done = new Promise(resolve => {
    const finish = (result) => {
      if (settled) return; settled = true;
      buttons.forEach(b => b.setAttribute('disabled', ''));
      resolve(result);
    };
    for (const it of items) {
      const b = el('button', { class: 'choice', type: 'button', 'data-id': it.id, 'aria-label': it.label || it.say || String(it.id) }, [
        it.pic && it.pic.svg ? el('span', { html: it.pic.svg }) : el('span', { class: 'pic', text: it.pic || '' }),
        it.label ? el('span', { class: 'label', text: it.label }) : null
      ]);
      buttons.set(it, b);
      b.addEventListener('click', async () => {
        if (settled) return;
        if (it.ok) {
          buttons.forEach(x => x.setAttribute('disabled', '')); // BUG-03: no stray taps after a correct answer
          b.classList.add('right');
          confetti(24);
          if (praise) audio.say(praise);
          await wait(700);
          finish({ firstTry: misses === 0, misses, revealed: false });
          return;
        }
        misses++;
        b.classList.add('dim');
        b.setAttribute('disabled', '');
        const correct = items.find(x => x.ok);
        if (misses === 1) {
          buttons.get(correct).classList.add('glow');
          audio.say(prompt);
        } else {
          buttons.get(correct).classList.remove('glow');
          buttons.get(correct).classList.add('right');
          await audio.say(revealText || ('It is ' + (correct.say || correct.label || 'this one') + '.'));
          await wait(600);
          finish({ firstTry: false, misses, revealed: true });
        }
      });
      grid.appendChild(b);
    }
  });
  return { el: grid, done };
}

// Tiles and slots for word building. Tap a tile then a slot (primary), or drag (pointer events).
// tiles: [{ id, grapheme }]. slots: n. onFill(slotIndex, tile) / onClear(slotIndex).
export function tileBoard({ audio, tiles, slotCount, onChange }) {
  const slotsEl = el('div', { class: 'row slots' });
  const trayEl = el('div', { class: 'row tray' });
  const slots = Array.from({ length: slotCount }, () => null); // tile ids
  const tileEls = new Map();
  let picked = null;

  const render = () => {
    slotsEl.replaceChildren(...slots.map((tid, i) => {
      const t = tiles.find(x => x.id === tid);
      const s = el('button', { class: 'slot' + (t ? ' filled' : ''), type: 'button', 'data-slot': i, text: t ? t.grapheme : '', 'aria-label': 'slot ' + (i + 1) });
      s.addEventListener('click', () => {
        if (picked !== null) { place(picked, i); return; }
        if (t) { slots[i] = null; picked = null; render(); onChange(slots.slice()); audio.stop(); audio.phoneme(t.phoneme); }
      });
      return s;
    }));
    trayEl.replaceChildren(...tiles.map(t => {
      const used = slots.includes(t.id);
      const b = el('button', { class: 'tile' + (picked === t.id ? ' picked' : '') + (used ? ' used' : ''), type: 'button', 'data-tile': t.id, text: t.grapheme, 'aria-label': 'tile ' + t.grapheme, ...(used ? { disabled: '' } : {}) });
      tileEls.set(t.id, b);
      b.addEventListener('click', () => {
        audio.stop(); audio.phoneme(t.phoneme);
        picked = picked === t.id ? null : t.id;
        render();
      });
      enableDrag(b, t);
      return b;
    }));
  };
  const place = (tileId, slotIndex) => {
    const prev = slots.indexOf(tileId);
    if (prev >= 0) slots[prev] = null;
    slots[slotIndex] = tileId;
    picked = null;
    render();
    onChange(slots.slice());
  };
  function enableDrag(b, t) {
    let ghost = null, startX = 0, startY = 0, dragging = false;
    b.addEventListener('pointerdown', e => {
      startX = e.clientX; startY = e.clientY; dragging = false;
      try { b.setPointerCapture(e.pointerId); } catch {}
    });
    b.addEventListener('pointermove', e => {
      if (!b.hasPointerCapture(e.pointerId)) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 12) {
        dragging = true;
        ghost = b.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost);
      }
      if (dragging) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    });
    const end = e => {
      if (!dragging) return;
      dragging = false;
      ghost.remove(); ghost = null;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const slot = target && target.closest('.slot');
      if (slot) { place(t.id, Number(slot.dataset.slot)); e.preventDefault(); }
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', () => { if (ghost) ghost.remove(); ghost = null; dragging = false; });
  }
  render();
  return {
    el: el('div', { class: 'board' }, [slotsEl, trayEl]),
    slots: () => slots.slice(),
    graphemes: () => slots.map(id => { const t = tiles.find(x => x.id === id); return t ? t.grapheme : null; }),
    highlight(i) { slotsEl.querySelectorAll('.slot').forEach((s, k) => s.classList.toggle('now', k === i)); },
    clearHighlight() { slotsEl.querySelectorAll('.slot').forEach(s => s.classList.remove('now')); },
    setSlot(i, tileId) { place(tileId, i); },
    lock() { slotsEl.querySelectorAll('button').forEach(b => b.setAttribute('disabled', '')); trayEl.querySelectorAll('button').forEach(b => b.setAttribute('disabled', '')); },
    hintSlot(i) { const s = slotsEl.querySelectorAll('.slot')[i]; if (s) s.classList.add('glow'); },
    hintTile(id) { const t = tileEls.get(id); if (t) t.classList.add('glow'); },
    clearHints() { slotsEl.querySelectorAll('.glow').forEach(x => x.classList.remove('glow')); trayEl.querySelectorAll('.glow').forEach(x => x.classList.remove('glow')); }
  };
}

export function confetti(count = 40) {
  const colors = ['#ec4899', '#a855f7', '#38bdf8', '#22c55e', '#f59e0b', '#f43f5e'];
  const shapes = ['●', '■', '▲', '★', '♥', '✦'];
  for (let i = 0; i < count; i++) {
    const c = el('div', { class: 'confetti', text: pick(shapes) });
    c.style.left = Math.random() * 100 + '%';
    c.style.color = pick(colors);
    c.style.animationDuration = (1.4 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

export function toast(text, ms = 2200) {
  const t = el('div', { class: 'toast', text });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// Modal sheet. Returns the overlay; caller removes it.
export function sheet(children) {
  const o = el('div', { class: 'overlay' }, [el('div', { class: 'sheet' }, children)]);
  document.body.appendChild(o);
  return o;
}

// Breathing bubble used by the session exit and later by Calm Castle. Cycles of in/out, animation only.
export async function breathingBubble(audio, { cycles = 3, inMs = 4000, outMs = 4000 } = {}) {
  const bubble = el('div', { class: 'bubble' });
  const label = el('h2', { text: 'Breathe in' });
  const o = sheet([label, bubble]);
  for (let i = 0; i < cycles; i++) {
    label.textContent = 'Breathe in'; audio.say('Breathe in');
    await wait(50); bubble.classList.remove('out'); bubble.classList.add('in');
    await wait(inMs);
    label.textContent = 'Breathe out'; audio.say('Breathe out');
    bubble.classList.remove('in'); bubble.classList.add('out');
    await wait(outMs);
  }
  o.remove();
}

// Runs a round of picture-choice items, records to adaptive, re-presents second misses two turns later.
// makeItem(item) → { prompt, pic, choices:[{id,pic,label,ok}], subskill, itemId, revealText?, oneCol? }
export async function runRound({ root, audio, adaptive, economy, praiseLines, name, items, makeItem, cabinetId, subskillForStars }) {
  const queue = items.slice();
  let firstTries = 0, total = 0, index = 0, lastGood = null;
  const retried = new Set();
  while (queue.length) {
    const item = queue.shift();
    const spec = makeItem(item);
    root.replaceChildren(
      roundDots(items.length, Math.min(items.length, index)),
      promptBar(audio, spec.prompt),
      spec.pic !== undefined ? picture(spec.pic, spec.picSay ? () => audio.say(spec.picSay) : null) : el('div')
    );
    const grid = choiceGrid({ audio, prompt: spec.prompt, items: spec.choices, praise: withName(pick(praiseLines), name), revealText: spec.revealText, oneCol: spec.oneCol });
    root.appendChild(grid.el);
    await audio.say(spec.prompt);
    const r = await grid.done;
    const isRetry = retried.has(spec.itemId);
    adaptive.record({ subskill: spec.subskill, ok: r.firstTry, choices: spec.choices.length, retry: isRetry, itemId: spec.itemId });
    if (!isRetry) { total++; if (r.firstTry) firstTries++; index++; }
    if (r.revealed && !isRetry) { retried.add(spec.itemId); if (queue.length < 2 && lastGood) queue.push(lastGood); queue.splice(Math.min(2, queue.length), 0, item); }
    else if (r.firstTry && !isRetry) lastGood = item;
  }
  return finishRound({ economy, adaptive, cabinetId, firstTries, total });
}

export function finishRound({ economy, adaptive, cabinetId, firstTries, total }) {
  const ratio = total ? firstTries / total : 1;
  const stars = economy.setStars(cabinetId, ratio);
  adaptive.noteRoundFinished(cabinetId);
  return { stars, ratio };
}

export function roundCelebration(audio, stars, onDone) {
  const o = sheet([
    el('div', { class: 'big-emoji', text: '🎉' }),
    el('h2', { text: 'Round done!' }),
    el('div', { class: 'rank', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) }),
    bigButton('Yay!', () => { o.remove(); onDone(); })
  ]);
  confetti(50);
  audio.say('Round done! ' + (stars === 3 ? 'Three stars!' : stars === 2 ? 'Two stars!' : 'One star, and you kept going!'));
}

// Simple mode menu for a cabinet: big cards, one per mode.
export function modeMenu(modes, onPick) {
  return el('div', { class: 'cabinets' }, modes.map(m => el('button', { class: 'cabinet', type: 'button', onclick: () => onPick(m) }, [
    el('div', { class: 'icon', text: m.icon }),
    el('div', { class: 'name' }, [m.name, m.sub ? el('div', { class: 'sub', text: m.sub }) : null])
  ])));
}
