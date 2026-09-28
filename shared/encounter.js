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

// Idle nudge: if she has not touched anything and nothing has been said for 15 s, Luna tilts her head and
// the prompt plays again (at most twice per item). No timers are ever shown and nothing is scored.
function idleNudge(stage, audio) {
  let lastTouch = Date.now(), nudges = 0;
  const touch = () => { lastTouch = Date.now(); };
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('keydown', touch, true);
  let stop = null;
  const iv = setInterval(() => {
    if (!stage.root.isConnected) { stop(); return; } // she left the place mid-item: never talk over the map
    if (document.hidden || document.querySelector('.overlay')) { lastTouch = Date.now(); return; }
    const quiet = Math.min(Date.now() - lastTouch, audio.quietFor ? audio.quietFor() : Infinity);
    if (quiet > 15000 && nudges < 2) {
      nudges++; lastTouch = Date.now();
      stage.luna('think', 1400);
      const b = stage.promptArea.querySelector('.speak-btn');
      if (b) b.click();
    }
  }, 1000);
  stop = () => { clearInterval(iv); document.removeEventListener('pointerdown', touch, true); document.removeEventListener('keydown', touch, true); };
  return stop;
}

// ---------- First-time demo and "show me" ----------
// The first time an activity appears, Luna's pointing hand shows one practice item, unscored (after
// onecourse's demo-first design). A 👆 button then stays beside Luna: it points at the answer, and an
// item answered after pointing counts as "not known yet". Families opt in by marking the answer with
// data-answer (and data-order on tiles, data-done on a Done button); the marker is never shown.
const DEMO_FAMILIES = new Set(['gpc', 'spell', 'read', 'swap', 'scroll', 'seeds', 'blend', 'count', 'cavecount', 'oralswap', 'takeaway', 'rhyme', 'beats',
  'onsetrime', 'heartap', 'spellheart', 'note', 'frames', 'trail', 'road', 'bridge', 'teen', 'stories', 'measure', 'patterns', 'shapes']);
function answerTarget(root) {
  if (root.querySelector('.tile.picked')) return root.querySelector('.slot:not(.filled)');
  const tile = [...root.querySelectorAll('.tile[data-order]:not([disabled]):not(.used)')].sort((a, b) => a.dataset.order - b.dataset.order)[0];
  if (tile) return tile;
  const ans = [...root.querySelectorAll('[data-answer]')].find(x => !x.disabled && !x.dataset.answerDone && !x.classList.contains('gone'));
  if (ans) return ans;
  return [...root.querySelectorAll('[data-done]')].find(x => !x.disabled) || null;
}
function handAt(hand, target) {
  const r = target.getBoundingClientRect();
  hand.style.left = (r.left + r.width / 2) + 'px';
  hand.style.top = (r.top + r.height * 0.55) + 'px';
  hand.classList.add('show');
}
async function runDemo(stage, ctx, playing) {
  let finished = false;
  playing.then(() => { finished = true; }, () => { finished = true; });
  const hand = el('div', { class: 'demo-hand', text: '👆', 'aria-hidden': 'true' });
  document.body.appendChild(hand);
  const quiet = async () => { for (let i = 0; i < 50 && ctx.audio.isBusy() && !finished && stage.root.isConnected; i++) await wait(200); };
  await quiet();
  // An activity with nothing to point at (no answer marker) gets no demo, and Luna does not promise one.
  let first = null;
  for (let k = 0; k < 8 && !first && !finished && stage.root.isConnected; k++) { first = answerTarget(stage.root); if (!first) await wait(400); }
  if (!first) { hand.remove(); return false; }
  if (!finished && stage.root.isConnected) await ctx.audio.say('Watch. Luna will show you how.');
  let found = 0;
  for (let step = 0; step < 16 && !finished && stage.root.isConnected; step++) {
    await quiet();
    const t = answerTarget(stage.root);
    if (!t) { if (step > 5 && !found) break; await wait(500); continue; }
    if (!stage.root.isConnected) break;
    found++;
    handAt(hand, t);
    await wait(900);
    t.dataset.answerDone = '1';
    t.click();
    await wait(450);
  }
  hand.remove();
  return found > 0;
}
function showMeButton(stage) {
  const b = el('button', { class: 'show-me', type: 'button', 'aria-label': 'Show me', text: '👆' });
  b.addEventListener('click', async () => {
    const t = answerTarget(stage.root);
    if (!t) { const sp = stage.promptArea.querySelector('.speak-btn'); if (sp) sp.click(); return; }
    // after the item is solved there is nothing to help with: the tap is not counted as help
    if (!stage.root.querySelector('.choice.right, .sword.right')) stage.helpUsed = true;
    const hand = el('div', { class: 'demo-hand', text: '👆', 'aria-hidden': 'true' });
    document.body.appendChild(hand);
    handAt(hand, t);
    setTimeout(() => hand.remove(), 2200);
  });
  return b;
}

// Runs a round. items: [{ family, item }] pairs. Returns { stars, ratio, rescued, companion }.
export async function runEncounterRound({ host, ctx, place, cabinetId, items, review = new Set() }) {
  const stage = createStage({ host, place, ctx });
  const praise = ctx.praise && ctx.praise.praise ? ctx.praise.praise : ['Great job!'];
  const name = ctx.economy.save.child.name;
  const queue = items.slice();
  const retried = new Set();
  let firstTries = 0, total = 0, index = 0, cancelled = false, lastGood = null;
  stage.cancel = () => { cancelled = true; };
  // Back to the menu or map replaces the stage: the round is over, nothing more is said or credited.
  const gone = () => cancelled || !stage.root.isConnected;

  const demos = ctx.economy.save.demos || (ctx.economy.save.demos = {});
  let demoCount = 0;
  const showMe = showMeButton(stage);
  stage.root.querySelector('.stage-row').appendChild(showMe);
  while (queue.length && !gone()) {
    const { family, item } = queue.shift();
    const itemId = family.itemId ? family.itemId(item) : (family.id + ':' + (item.w || item.id || index));
    const isRetry = retried.has(itemId);
    stage.setDots(items.length - demoCount, Math.min(items.length - demoCount, index));
    stage.luna('idle');
    stage.helpUsed = false;
    const helpers = { praiseLine: () => withName(pick(praise), name), isRetry };
    // First time this activity appears: a demo on this item, unscored; she practises it with Luna.
    // Experience is counted per activity (rows carry the family id), so an activity that shares a skill
    // with one she already knows still gets its own demo.
    if (!demos[family.id] && ctx.economy.save.log.filter(r => r.fam === family.id).length >= 10) demos[family.id] = 'experienced';
    let result = null;
    if (!isRetry && DEMO_FAMILIES.has(family.id) && !demos[family.id]) {
      showMe.hidden = true;
      stage.helpUsed = true; // anything done during a demo is Luna's, never evidence
      let playing;
      try { playing = family.play(stage, item, ctx, helpers); } catch (e) { playing = Promise.resolve(null); }
      const shown = await runDemo(stage, ctx, playing);
      let res = null;
      try { res = await playing; } catch {}
      showMe.hidden = false;
      if (gone()) return null;
      if (shown) {
        demos[family.id] = ctx.economy.today(); ctx.economy.persist(); await ctx.audio.say('Now you try!');
        demoCount++;
        continue; // the demo item is never scored
      }
      // nothing to point at: this activity has no demo; the item she just did is scored as usual
      demos[family.id] = 'none'; ctx.economy.persist();
      stage.helpUsed = false;
      result = res || { outcome: 'abandoned', choices: 3 };
    }
    showMe.hidden = !DEMO_FAMILIES.has(family.id);
    if (!result) {
      const stopNudge = idleNudge(stage, ctx.audio);
      try { result = await family.play(stage, item, ctx, helpers); }
      catch (e) { console.error('encounter item failed', e); result = { outcome: 'abandoned', choices: 3 }; }
      finally { stopNudge(); }
    }
    if (gone()) return null;
    // Asking Luna to show the answer means it is not known yet (and it will come back later in the round).
    if (stage.helpUsed && (result.outcome === 'firstTry' || result.outcome === 'scaffolded')) result = { ...result, outcome: 'revealed' };
    const outcome = result.outcome;
    const scored = (result.choices || 3) >= 2; // introductions and self-checks are exposure, not answers
    ctx.adaptive.record({ subskill: family.subskill, outcome, choices: result.choices || 3, review: review.has(family.subskill), retry: isRetry, itemId, gpc: result.gpc || null, fam: family.id });
    if (outcome === 'firstTry') stage.luna('happy'); else if (outcome === 'revealed') stage.luna('think'); else stage.luna('happy', 900);
    if (!isRetry) { if (scored) { total++; if (outcome === 'firstTry') firstTries++; } index++; }
    if (outcome === 'revealed' && !isRetry && !family.noRequeue) {
      retried.add(itemId);
      if (queue.length < 2 && lastGood) queue.push(lastGood); // BUG-13: never re-present immediately
      queue.splice(Math.min(2, queue.length), 0, { family, item });
    } else if (outcome === 'firstTry' && !isRetry && !family.noRequeue) lastGood = { family, item };
    await wait(350);
  }
  if (gone()) return null;
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
    el('h2', { text: rescued ? 'You freed a Squishy!' : 'You did it!' }),
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
  if (ctx.audio.sfx) ctx.audio.sfx.yay();
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
