// shared/ui.js — DOM builders and the scaffolded choice grid every cabinet uses.
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
export function speakButton(speech, text) {
  return el('button', { class: 'speak-btn', type: 'button', 'aria-label': 'Hear it again', text: '🔊', onclick: () => speech.speak(text) });
}
export function promptBar(speech, text) {
  const t = el('div', { class: 'text' });
  t.appendChild(speech.wordSpans(text));
  return el('div', { class: 'prompt' }, [t, speakButton(speech, text)]);
}
export function picture(pic) {
  const p = el('div', { class: 'picture' });
  if (pic && pic.svg) p.innerHTML = pic.svg; else p.textContent = pic || '';
  return p;
}
export function roundDots(total, done) {
  return el('div', { class: 'round-dots' }, Array.from({ length: total }, (_, i) => el('span', { class: i < done ? 'done' : '', text: '🌸' })));
}

// Scaffolded choice grid. items: [{ id, pic, label, ok }]. Resolves { firstTry, misses, revealed }.
// Miss 1: tapped choice dims, correct choice glows, prompt re-speaks. Miss 2: reveal + speak answer.
export function choiceGrid({ speech, prompt, items, praise, oneCol = false, revealText = null }) {
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
      const b = el('button', { class: 'choice', type: 'button', 'data-id': it.id }, [
        it.pic && it.pic.svg ? el('span', { html: it.pic.svg }) : el('span', { text: it.pic || '' }),
        it.label ? el('span', { class: 'label', text: it.label }) : null
      ]);
      buttons.set(it, b);
      b.addEventListener('click', async () => {
        if (settled) return;
        if (it.ok) {
          b.classList.add('right');
          confetti(24);
          if (praise) speech.speak(praise);
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
          speech.speak(prompt);
        } else {
          buttons.get(correct).classList.remove('glow');
          buttons.get(correct).classList.add('right');
          await speech.speak(revealText || ('It is ' + (correct.label || correct.say || 'this one') + '.'));
          await wait(600);
          finish({ firstTry: false, misses, revealed: true });
        }
      });
      grid.appendChild(b);
    }
  });
  return { el: grid, done };
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
export async function breathingBubble(speech, { cycles = 3, inMs = 4000, outMs = 4000 } = {}) {
  const bubble = el('div', { class: 'bubble' });
  const label = el('h2', { text: 'Breathe in' });
  const o = sheet([label, bubble]);
  for (let i = 0; i < cycles; i++) {
    label.textContent = 'Breathe in'; speech.speak('Breathe in');
    await wait(50); bubble.classList.remove('out'); bubble.classList.add('in');
    await wait(inMs);
    label.textContent = 'Breathe out'; speech.speak('Breathe out');
    bubble.classList.remove('in'); bubble.classList.add('out');
    await wait(outMs);
  }
  o.remove();
}

// Runs a round of items through choiceGrid, records to adaptive, re-presents second misses two turns later.
// makeItem(item) → { prompt, pic, choices:[{id,pic,label,ok}], subskill, itemId, revealText?, oneCol? }
export async function runRound({ root, speech, adaptive, economy, praiseLines, name, items, makeItem, cabinetId }) {
  const queue = items.slice();
  let firstTries = 0, total = 0, index = 0;
  const retried = new Set();
  while (queue.length) {
    const item = queue.shift();
    const spec = makeItem(item);
    root.replaceChildren(
      roundDots(items.length, Math.min(items.length, index)),
      promptBar(speech, spec.prompt),
      spec.pic !== undefined ? picture(spec.pic) : el('div')
    );
    const grid = choiceGrid({ speech, prompt: spec.prompt, items: spec.choices, praise: withName(pick(praiseLines), name), revealText: spec.revealText, oneCol: spec.oneCol });
    root.appendChild(grid.el);
    await speech.speak(spec.prompt);
    const r = await grid.done;
    const isRetry = retried.has(spec.itemId);
    adaptive.record({ subskill: spec.subskill, ok: r.firstTry, choices: spec.choices.length, retry: isRetry, itemId: spec.itemId });
    if (!isRetry) { total++; if (r.firstTry) firstTries++; index++; }
    if (r.revealed && !isRetry) { retried.add(spec.itemId); queue.splice(Math.min(2, queue.length), 0, item); }
  }
  const ratio = total ? firstTries / total : 1;
  const stars = economy.setStars(cabinetId, ratio);
  adaptive.noteRoundFinished(cabinetId);
  return { stars, ratio };
}

export function roundCelebration(speech, stars, onDone) {
  const o = sheet([
    el('div', { class: 'big-emoji', text: '🎉' }),
    el('h2', { text: 'Round done!' }),
    el('div', { class: 'rank', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) }),
    bigButton('Yay!', () => { o.remove(); onDone(); })
  ]);
  confetti(50);
  speech.speak('Round done! ' + (stars === 3 ? 'Three stars!' : stars === 2 ? 'Two stars!' : 'One star, and you kept going!'));
}
