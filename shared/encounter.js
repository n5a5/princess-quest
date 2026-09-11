// shared/encounter.js — the one loop every learning item runs through, in every place:
//   set-up (scene + Luna + object) → prompt → child acts → Luna reacts → scaffold ladder → record → next.
// A "family" describes one interaction type: { id, subskill, play(stage, item) → { outcome, choices, gpc? } }.
// Outcome: 'firstTry' | 'scaffolded' | 'revealed'. The runner handles rounds, re-presentation of revealed
// items two turns later, the round celebration, Squishy rescue, companion stars and gems.
import { el, wait, pick, withName, confetti, sheet, bigButton, roundDots } from './ui.js';
import { lunaSVG, squishySVG, svgFrom, SQUISHY_KINDS } from './characters.js';
import { SQUISHIES } from '../games/registry.js';

export function createStage({ host, place, ctx }) {
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const objectArea = el('div', { class: 'object' });
  const dots = el('div', { class: 'round-dots' });
  const promptArea = el('div');
  const body = el('div', { class: 'activity' });
  const root = el('div', { class: 'scene ' + place }, [
    dots,
    el('div', { class: 'stage-row' }, [luna, objectArea]),
    promptArea,
    body
  ]);
  host.replaceChildren(root);
  let faceTimer = null;
  const stage = {
    root, body, promptArea, objectArea,
    luna(state, ms = 1400) {
      clearTimeout(faceTimer);
      luna.className.baseVal = 'companion ' + state;
      if (state !== 'idle') faceTimer = setTimeout(() => { luna.className.baseVal = 'companion idle'; }, ms);
    },
    setObject(node) { objectArea.replaceChildren(node || ''); },
    setPrompt(node) { promptArea.replaceChildren(node || ''); },
    setBody(...nodes) { body.replaceChildren(...nodes); },
    setDots(total, done) { dots.replaceChildren(...roundDots(total, done).childNodes); }
  };
  return stage;
}

// Runs a round. items: [{ family, item }] pairs. Returns { stars, ratio, rescued, companion }.
export async function runEncounterRound({ host, ctx, place, cabinetId, items, review = new Set() }) {
  const stage = createStage({ host, place, ctx });
  const praise = ctx.praise && ctx.praise.praise ? ctx.praise.praise : ['Great job!'];
  const name = ctx.economy.save.child.name;
  const queue = items.slice();
  const retried = new Set();
  let firstTries = 0, total = 0, index = 0, cancelled = false;
  stage.cancel = () => { cancelled = true; };

  while (queue.length && !cancelled) {
    const { family, item } = queue.shift();
    const itemId = family.itemId ? family.itemId(item) : (family.id + ':' + (item.w || item.id || index));
    const isRetry = retried.has(itemId);
    stage.setDots(items.length, Math.min(items.length, index));
    stage.luna('idle');
    let result;
    try { result = await family.play(stage, item, ctx, { praiseLine: () => withName(pick(praise), name), isRetry }); }
    catch (e) { console.error('encounter item failed', e); result = { outcome: 'abandoned', choices: 3 }; }
    if (cancelled) return null;
    const outcome = result.outcome;
    ctx.adaptive.record({ subskill: family.subskill, outcome, choices: result.choices || 3, review: isRetry || review.has(family.subskill), itemId, gpc: result.gpc || null });
    if (outcome === 'firstTry') stage.luna('happy'); else if (outcome === 'revealed') stage.luna('think'); else stage.luna('happy', 900);
    if (!isRetry) { total++; if (outcome === 'firstTry') firstTries++; index++; }
    if (outcome === 'revealed' && !isRetry) { retried.add(itemId); queue.splice(Math.min(2, queue.length), 0, { family, item }); }
    await wait(350);
  }
  if (cancelled) return null;
  const ratio = total ? firstTries / total : 1;
  const stars = ctx.economy.setStars(cabinetId, ratio);
  ctx.adaptive.noteRoundFinished(cabinetId);
  const companion = ctx.economy.addCompanionStars(stars);
  const rescued = ctx.economy.rescueSquishy(place, SQUISHIES[place] || []);
  const gems = 2 + stars;
  ctx.economy.addGems(gems);
  return { stars, ratio, rescued, companion, gems };
}

// Round celebration: Luna jumps, stars, gems fly, Squishy bubble pops. Tap anywhere to continue.
export function celebrateRound(ctx, { stars, rescued, companion, gems }, onDone) {
  const luna = svgFrom(lunaSVG({ state: 'yay', glow: companion.level }));
  const kids = [
    luna,
    el('h2', { text: rescued ? 'You freed a Squishy!' : 'Round done!' }),
    el('div', { class: 'rank', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) })
  ];
  let squishyEl = null;
  if (rescued) {
    const kind = SQUISHY_KINDS.find(k => k.id === rescued);
    squishyEl = svgFrom(squishySVG(kind, { size: 110, bubble: true }));
    kids.push(squishyEl, el('div', { class: 'sub', text: kind.name + ' says thank you!' }));
  }
  if (companion.leveledUp) kids.push(el('div', { class: 'sub', text: '✨ Luna is glowing brighter! ✨' }));
  kids.push(bigButton('Yay!', () => { o.remove(); onDone(); }, 'gold'));
  const o = sheet(kids);
  confetti(60);
  flyGems(gems);
  const line = (stars === 3 ? 'Three stars! ' : stars === 2 ? 'Two stars! ' : 'One star, and you kept going! ')
    + (rescued ? 'You freed ' + SQUISHY_KINDS.find(k => k.id === rescued).name + ' the Squishy! ' : '')
    + (companion.leveledUp ? 'Luna is glowing brighter!' : '');
  ctx.audio.say(line);
  if (squishyEl) setTimeout(() => { const b = squishyEl.querySelector('circle'); if (b) b.remove(); squishyEl.classList.add('wiggle'); }, 900);
}

// Gems fly from the centre of the screen to the counter in the top bar.
export function flyGems(n) {
  const target = document.getElementById('gem-count');
  if (!target) return;
  const t = target.getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 8); i++) {
    const g = el('div', { class: 'fly-gem', html: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 3h12l4 6-10 13L2 9z" fill="#7CC7F0" stroke="#3E8FC9" stroke-width="1.5"/></svg>' });
    const x0 = window.innerWidth / 2 + (Math.random() - 0.5) * 120, y0 = window.innerHeight / 2 + (Math.random() - 0.5) * 80;
    g.style.left = x0 + 'px'; g.style.top = y0 + 'px';
    document.body.appendChild(g);
    setTimeout(() => { g.style.transform = `translate(${t.left + t.width / 2 - x0}px, ${t.top + t.height / 2 - y0}px) scale(0.5)`; g.style.opacity = '0.2'; }, 60 + i * 90);
    setTimeout(() => { g.remove(); if (i === 0) { target.textContent = String(Number(target.textContent) + 0); target.parentElement.classList.add('flash'); setTimeout(() => target.parentElement.classList.remove('flash'), 1200); } }, 1100 + i * 90);
  }
}
