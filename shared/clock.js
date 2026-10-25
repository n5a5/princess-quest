// shared/clock.js — the geared clock of Tick-Tock Lagoon, and the time maths behind it.
// The hands are geared like a real teaching clock: turning the long (minute) hand carries the short (hour) hand
// with it, so at three thirty the hour hand sits halfway between the 3 and the 4. A clock whose hands move on their
// own teaches the wrong picture, and that picture is the classic half-past mistake (3:30 read as "four thirty").
// Colours tie the two clocks together: the hour is pink on the hand and in the digital time, the minutes blue.
// Times are 12-hour, with no a.m. or p.m. (Florida B.E.S.T. MA.1.M.2.1 leaves those out).
// The pure functions (no DOM) run under node --test; clockEl() builds the SVG for the game.
const NS = 'http://www.w3.org/2000/svg';
export const HOUR_COLOR = '#D94F7E';
export const MINUTE_COLOR = '#2F7FC0';
const WORD = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const TENS = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty' };
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

// A time is { h: 1..12, m: 0..59 }. `total` counts minutes from 12:00 (0..719), which makes stepping and
// wrapping simple.
export const toTotal = ({ h, m }) => ((h % 12) * 60 + m) % 720;
export const fromTotal = t => { const x = ((Math.round(t) % 720) + 720) % 720; const h = Math.floor(x / 60); return { h: h === 0 ? 12 : h, m: x % 60 }; };
export const sameTime = (a, b) => toTotal(a) === toTotal(b);
// Clockwise degrees from 12 for each hand.
export function handAngles({ h, m }) { return { hour: (h % 12) * 30 + m * 0.5, minute: m * 6 }; }

// How she says it at home: "three o'clock", "three thirty", "three oh five", "three forty-five".
export function phrase({ h, m }) {
  if (m === 0) return WORD[h] + " o'clock";
  if (m < 10) return WORD[h] + ' oh ' + WORD[m];
  if (m < 20) return WORD[h] + ' ' + TEENS[m - 10];
  return WORD[h] + ' ' + TENS[Math.floor(m / 10)] + (m % 10 ? '-' + WORD[m % 10] : '');
}
export const digital = ({ h, m }) => h + ':' + String(m).padStart(2, '0');

// The minute step of each level: the clock snaps to it, and every time in that level is a multiple of it.
export const STAGE_STEP = { hour: 60, half: 30 };
export const stepFor = stage => STAGE_STEP[stage] || 30;

// A time for the level: o'clock only, then half past mixed with some o'clock (so the hours stay fresh).
export function timeFor(stage, rand = Math.random) {
  const h = 1 + Math.floor(rand() * 12);
  if (stage === 'hour') return { h, m: 0 };
  return { h, m: rand() < 0.65 ? 30 : 0 };
}

// Wrong choices are the mistakes children really make:
//   next     the hour hand read as the next number (3:30 → "four thirty"), the classic one
//   minute   the minute hand ignored (3:30 → "three o'clock") or the wrong half (3:00 → "three thirty")
//   swap     the hands swapped (the long hand read as the hour: 3:30 → "six thirty"; 3:00 → "twelve o'clock")
//   near     a near hour (3:00 → "two o'clock" or "four o'clock")
//   across   the number across the face (3:00 → "nine o'clock")
// The first two are always offered (where the level allows), so every card makes her read both hands: at thirty
// "four thirty" (the short hand) and "three o'clock" (the long hand) sit beside "three thirty".
export const KINDS = ['next', 'minute', 'swap', 'near', 'across'];
export function distractors(t, n = 2, stage = 'half', rand = Math.random) {
  const at = (h, m) => ({ h: ((h - 1 + 120) % 12) + 1, m });
  const cands = t.m === 30
    ? [[at(t.h + 1, 30), 'next'], [at(t.h, 0), 'minute'], [at(6, 30), 'swap'], [at(t.h + 1, 0), 'next'], [at(t.h - 1, 30), 'near']]
    : [[at(t.h + 1, 0), 'near'], [at(t.h, 30), 'minute'], [at(t.h - 1, 0), 'near'], [at(12, 0), 'swap'], [at(t.h + 6, 0), 'across']];
  let head = cands.slice(0, 2);
  // with one wrong choice, either of the two (so two-choice cards also ask about the long hand)
  if (n === 1 && stage !== 'hour' && rand() < 0.5) head = [head[1], head[0]];
  const tail = cands.slice(2).map(c => [rand(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const out = [], seen = new Set([toTotal(t)]);
  for (const [time, kind] of [...head, ...tail]) {
    if (seen.has(toTotal(time))) continue;
    // at the o'clock level every choice is an o'clock time: "three thirty" would be a giveaway there
    if (stage === 'hour' && time.m !== 0) continue;
    seen.add(toTotal(time)); out.push({ time, kind });
    if (out.length === n) break;
  }
  return out;
}

// What the long hand means, said after a long-hand mistake.
export const longHandRule = target => target.m === 0 ? 'The long hand points straight up to the twelve for o\'clock.' : 'The long hand points straight down to the six for thirty.';
// What Luna says when she picks a wrong time: what she picked, then the one rule that fixes it, pointing at the
// hand she misread (the card lights that hand up). Spliced from recorded pieces: "That says" + "four thirty."
export function whyLine(kind, target, picked, card = 'read') {
  const said = (card === 'match' ? 'This clock says ' : 'That says ') + phrase(picked) + '.';
  if (kind === 'minute') return said + ' ' + longHandRule(target);
  if (kind === 'swap') return said + ' The short hand shows the hour. The long hand shows the minutes.';
  return said + ' ' + (target.m === 0 ? 'The short hand points to the ' : 'The short hand has just passed the ') + WORD[target.h] + '.';
}
// Which hand a mistake is about, for lighting it up on the clock.
export const HAND_OF = { next: ['hour'], near: ['hour'], across: ['hour'], minute: ['minute'], swap: ['hour', 'minute'] };

// What a wrong clock she set gets told: which hand to fix first. The minute hand comes first because it
// carries the hour hand with it; then the short hand, by name of its number.
export function setHint(target, made) {
  if (made.m !== target.m) return longHandRule(target);
  return (target.m === 0 ? 'Now move the short hand to the ' : 'Now move the short hand just past the ') + WORD[target.h] + '.';
}

// Turning the minute hand. The finger's path is followed continuously (`cont`, minutes, not wrapped), so a
// clockwise turn past the 12 always moves the hour on and an anticlockwise one moves it back, even when the
// clock snaps in half hours (where "the short way round" would be a tie). minuteGrab starts a turn at the
// finger's angle, minuteMove follows it, snap() gives the clock's time.
const wrapTo = (x, half) => ((x + half) % (2 * half) + 2 * half) % (2 * half) - half;
// (a finger exactly opposite the long hand turns it forward: at 2:00 a tap on the 6 makes two thirty)
export const minuteGrab = (total, angle) => { const d = wrapTo(angle / 6 - (((total % 60) + 60) % 60), 30); return total + (d === -30 ? 30 : d); };
export const minuteMove = (cont, prevAngle, angle) => cont + wrapTo(angle - prevAngle, 180) / 6;
export const snap = (cont, step) => ((Math.round(cont / step) * step) % 720 + 720) % 720;
// Turning the short hand changes only the hour: the long hand stays where she put it. `angle` is where the short
// hand should point (the finger, less where on the hand she grabbed it), so a press without moving changes nothing.
export function hourTurn(angle, minutes) {
  const h = ((Math.round((angle - minutes * 0.5) / 30) % 12) + 12) % 12;
  return h * 60 + minutes;
}
// The hand under a finger: past the short hand's tip (half the radius) only the long hand can be there; nearer the
// middle, the hand closer in angle (the short hand when it is clearly closer).
const off = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export function pickHand(angle, dist, total) {
  if (dist > 0.58) return 'minute';
  const a = handAngles(fromTotal(total)), dm = off(angle, a.minute), dh = off(angle, a.hour);
  return dh + 10 < dm || (dist < 0.5 && dh < dm) ? 'hour' : 'minute';
}

// Routine times from Parent Corner ("HH:MM", 24-hour) as clock times; only those the level can show.
export const ROUTINES = [
  { id: 'wake', pic: '🌅', name: 'wake up', line: 'Time to wake up!' },
  { id: 'school', pic: '🏫', name: 'school', line: 'Time for school!' },
  { id: 'lunch', pic: '🥪', name: 'lunch', line: 'Time for lunch!' },
  { id: 'dinner', pic: '🍝', name: 'dinner', line: 'Time for dinner!' },
  { id: 'bath', pic: '🛁', name: 'bath', line: 'Time for a bath!' },
  { id: 'bed', pic: '🛏️', name: 'bed', line: 'Time for bed!' }
];
export function routineTimes(routine, stage) {
  const step = stepFor(stage);
  return ROUTINES.map(r => {
    const v = routine && routine[r.id];
    const mt = typeof v === 'string' && v.match(/^(\d{1,2}):(\d{2})$/);
    if (!mt) return null;
    const H = +mt[1], m = +mt[2];
    if (H > 23 || m > 59 || m % step) return null;
    return { ...r, time: { h: H % 12 === 0 ? 12 : H % 12, m } };
  }).filter(Boolean);
}

// ---------- the SVG (browser only) ----------
// clockEl({ time, size, interactive, step, onChange }) → { el, get(), set(time), animateTo(time), lock() }
// Interactive: drag either hand (the one nearest the finger turns; the minute hand when unsure), or use the
// turn buttons beside it (one step each). Every snap clicks softly through `tick`.
export function clockFace({ time, size = 220, label = '' }) {
  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1, a = n * 30 * Math.PI / 180;
    return `<text x="${100 + 70 * Math.sin(a)}" y="${100 - 70 * Math.cos(a) + 8}" text-anchor="middle" class="num" font-size="19" font-weight="700">${n}</text>`;
  }).join('');
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 88 : 84;
    return `<line x1="${100 + r1 * Math.sin(a)}" y1="${100 - r1 * Math.cos(a)}" x2="${100 + 92 * Math.sin(a)}" y2="${100 - 92 * Math.cos(a)}" stroke="#7DA9C9" stroke-width="${i % 5 ? 1 : 2.5}" stroke-linecap="round"/>`;
  }).join('');
  const { hour, minute } = handAngles(time);
  return `<svg class="clock-face" viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="${NS}" role="img" aria-label="${label || 'clock'}">
  <circle cx="100" cy="100" r="97" fill="#BFE6F2" stroke="#4FB7C2" stroke-width="5"/>
  <circle cx="100" cy="100" r="90" fill="#FFFDF7"/>
  ${ticks}${nums}
  <g class="hand hour" transform="rotate(${hour} 100 100)"><path d="M100 112 L94 100 Q94 60 100 50 Q106 60 106 100 Z" fill="${HOUR_COLOR}" stroke="#A8335C" stroke-width="2" stroke-linejoin="round"/></g>
  <g class="hand minute" transform="rotate(${minute} 100 100)"><path d="M100 114 L97 100 L98.5 24 Q100 18 101.5 24 L103 100 Z" fill="${MINUTE_COLOR}" stroke="#1E5C8E" stroke-width="1.5" stroke-linejoin="round"/></g>
  <circle cx="100" cy="100" r="7" fill="#F9D77B" stroke="#C9971F" stroke-width="2"/>
</svg>`;
}

// The digital time in the clock's colours: pink hour, blue minutes.
export function digitalHTML(t) {
  return `<span class="hh" style="color:${HOUR_COLOR}">${t.h}</span>:<span class="mm" style="color:${MINUTE_COLOR}">${String(t.m).padStart(2, '0')}</span>`;
}

export function clockEl({ time, size = 220, interactive = false, step = 30, onChange = null, tick = null, label = '' }) {
  let total = toTotal(time), locked = false;
  const wrap = document.createElement('div');
  wrap.className = 'clock' + (interactive ? ' interactive' : '');
  wrap.innerHTML = clockFace({ time, size, label });
  const svg = wrap.querySelector('svg');
  const hourG = svg.querySelector('.hand.hour'), minG = svg.querySelector('.hand.minute');
  const draw = () => {
    const a = handAngles(fromTotal(total));
    hourG.setAttribute('transform', `rotate(${a.hour} 100 100)`);
    minG.setAttribute('transform', `rotate(${a.minute} 100 100)`);
    if (!interactive) svg.setAttribute('aria-label', label || 'clock');
  };
  const setTotal = (t, quiet = false) => {
    const nt = ((t % 720) + 720) % 720;
    if (nt === total) return;
    total = nt; draw();
    if (!quiet) { if (tick) tick(); if (onChange) onChange(fromTotal(total)); }
  };
  const api = {
    el: wrap, svg,
    get: () => fromTotal(total),
    set(t) { total = toTotal(t); draw(); },
    lock() { locked = true; wrap.classList.add('locked'); wrap.querySelectorAll('button').forEach(b => b.setAttribute('disabled', '')); },
    // sweeps the hands forward (or back) to `t` the short way round, one step at a time, so she sees the
    // hour hand creep along with the minute hand
    async animateTo(t, ms = 1400) {
      const target = toTotal(t);
      let d = target - total; if (d > 360) d -= 720; if (d < -360) d += 720;
      if (!d) return;
      const frames = Math.max(8, Math.min(60, Math.round(ms / 25))), start = total;
      for (let i = 1; i <= frames; i++) {
        await new Promise(r => setTimeout(r, ms / frames));
        total = ((start + Math.round(d * i / frames)) % 720 + 720) % 720; draw();
      }
      total = target; draw();
    },
    // one step on to the next mark (3:30 → 4:00 in o'clock steps), never a step and a half
    step(dir) { if (!locked) setTotal(dir > 0 ? Math.floor(total / step + 1) * step : Math.ceil(total / step - 1) * step); }
  };
  if (!interactive) return api;
  const angleAt = e => {
    const r = svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    return { angle: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist: Math.hypot(dx, dy) / (r.width / 2) };
  };
  // One finger drives the clock: the newest touch takes over, and only its lift ends the turn (a resting thumb
  // never moves the hands). Letting go of the long hand settles it on the level's step (o'clock at that level).
  let grab = null, cont = 0, prev = 0, hOff = 0, activeId = null;
  svg.addEventListener('pointerdown', e => {
    if (locked) return;
    const { angle, dist } = angleAt(e);
    if (dist > 1.08) return;
    if (activeId !== null && activeId !== e.pointerId) { try { svg.releasePointerCapture(activeId); } catch {} }
    activeId = e.pointerId;
    grab = pickHand(angle, dist, total);
    cont = minuteGrab(total, angle); prev = angle;
    hOff = wrapTo(angle - handAngles(fromTotal(total)).hour, 180);
    wrap.classList.remove('hour', 'minute');
    wrap.classList.add('turning', grab);
    try { svg.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    if (grab === 'minute') move(e);
  });
  const move = e => {
    if (!grab || locked || e.pointerId !== activeId) return;
    const { angle } = angleAt(e);
    if (grab === 'hour') { setTotal(hourTurn(angle - hOff, ((total % 60) + 60) % 60)); return; }
    cont = minuteMove(cont, prev, angle); prev = angle;
    setTotal(snap(cont, Math.min(step, 30)));
  };
  svg.addEventListener('pointermove', move);
  const end = e => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    if (grab === 'minute' && !locked && total % step) setTotal(snap(cont, step));
    if (grab) wrap.classList.remove('turning', 'hour', 'minute');
    grab = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('lostpointercapture', end);
  svg.style.touchAction = 'none';
  // turn buttons: big, on either side, so a small finger never has to drag at all
  const btn = (dir, text, aria) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'turn-btn ' + (dir < 0 ? 'back' : 'fwd'); b.textContent = text; b.setAttribute('aria-label', aria);
    b.addEventListener('click', () => api.step(dir));
    return b;
  };
  api.back = btn(-1, '↺', 'Turn back');
  api.fwd = btn(1, '↻', 'Turn forward');
  wrap.prepend(api.back); wrap.append(api.fwd);
  return api;
}
