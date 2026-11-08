// shell.js — boots services, renders the Kingdom map, lazy-loads places, runs the session shaper.
import { REGISTRY, SQUISHIES } from './games/registry.js';
import { createEconomy } from './shared/economy.js';
import { createAdaptive } from './shared/adaptive.js';
import { createContentLoader } from './shared/content.js';
import { createSessionClock } from './shared/session.js';
import { createSpeech } from './shared/speech.js';
import { createAudioStore } from './shared/audiostore.js';
import { createAudio, createWebAudioPlayer } from './shared/audio.js';
import { createSfx } from './shared/sfx.js';
import { el, bigButton, sheet, toast, confetti, breathingBubble } from './shared/ui.js';
import { lunaSVG, gemSVG, chestSVG, placeArtSVG, svgFrom, starFieldEl } from './shared/characters.js';
import { flyGems } from './shared/encounter.js';
import { daysUntil, countdownHint, countdownSay } from './shared/stage-plan.js';
import { watchUpdates, installedVersion } from './shared/updates.js';

// If the browser refuses to store the save, say so once instead of losing progress silently.
const economy = createEconomy({ storage: localStorage, onSaveError: () => toast('Progress could not be saved on this device. Ask a grown-up to check Parent Corner.', 6000) });
const adaptive = createAdaptive({ economy });
const content = createContentLoader();
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const store = createAudioStore();
const player = createWebAudioPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings });
audio.sfx = createSfx({ settings: economy.save.settings });
const clock = createSessionClock();
// Local testing only (?debug=1 or ?nosw=1): expose the services so a test driver can inspect them.
if (/[?&](debug|nosw)=1/.test(location.search)) window.__pq = { audio, economy, adaptive };

const $ = id => document.getElementById(id);
let current = null;   // { entry, module }
let updates = null;   // shared/updates.js: a new version installed while she played loads when she is back on the map

// Back-button navigation: every screen below the map pushes a history entry with a handler that
// restores the screen above it. The phone's back button pops one level; from the map it exits.
// Entries carry a session id: after a reload the browser still holds this page's older entries with stale
// depths, and landing on one of those must read as depth 0 (the map), not as "still inside a place".
const NAV_SID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nav = {
  stack: [], ignore: 0, waited: 0,
  // A push right after a pop (Star Stage stops its activity, then the PIN pad opens) waits for that pop's popstate,
  // or the pop would land on the new entry and drop it.
  push(handler, tries = 0) {
    if (nav.ignore > 0 && tries < 8) { setTimeout(() => nav.push(handler, tries + 1), 60); return; }
    nav.stack.push(handler); history.pushState({ depth: nav.stack.length, sid: NAV_SID }, '');
  },
  pop() { if (!nav.stack.length) return; nav.ignore++; history.back(); },
  // A tap on Back while a pop is still in flight (e.g. right after "Yay!") waits briefly for that popstate.
  toMap() {
    if (nav.ignore > 0 && nav.waited < 8) { nav.waited++; setTimeout(() => nav.toMap(), 120); return; }
    nav.waited = 0; nav.ignore = 0;
    if (nav.stack.length) history.go(-nav.stack.length); else closeCabinet();
  }
};
history.replaceState({ depth: 0, sid: NAV_SID }, '');
window.addEventListener('popstate', e => {
  const depth = e.state && e.state.sid === NAV_SID ? (e.state.depth || 0) : 0;
  const silent = nav.ignore > 0;
  while (nav.stack.length > depth) { const h = nav.stack.pop(); if (!silent) { try { h(); } catch (err) { console.warn(err); } } }
  if (silent) nav.ignore--;
});
let praise = { praise: ['Great job!'], greeting: ['Hello, {name}!'], retry: [], reveal: [] };

function available() { return REGISTRY.filter(r => !economy.save.settings.modulesOff.includes(r.id)); }
// A place with an event coming (Star Stage before the audition) goes to the top of the map with a countdown.
// a place's countdown on the map, from its spotlight's `from` day (two weeks before the show) to the day itself
const spotlightHint = r => r.spotlight && !(r.spotlight.from && economy.today() < r.spotlight.from) ? countdownHint(daysUntil(economy.today(), r.spotlight.until), r.spotlight.label) : null;
function readyIds() { return available().filter(r => r.ready).map(r => r.id); }

function updateBar() {
  $('gem-count').textContent = economy.save.gems;
  $('mute-btn').textContent = speech.muted ? '🔇' : '🔊';
}

// Where Luna is waiting today, as one line she can read along with, and the one action it asks for.
function homeState() {
  const quest = adaptive.todayQuest(readyIds());
  const next = adaptive.nextStop();
  const req = next && REGISTRY.find(r => r.id === next.cabinet);
  // The audition week: until Star Stage has been practiced today, Luna waits there, and the quest comes after.
  const today = economy.today();
  const spotFirst = available().find(r => r.ready && spotlightHint(r) && r.place === 'stage' && !Object.keys((economy.save.stage.days || {})[today] || {}).length) || null;
  const questDone = adaptive.questDone();
  const dest = spotFirst || (!quest.claimed && !questDone ? req : null);
  const line = spotFirst ? 'Luna is waiting at ' + spotFirst.name + '.' : quest.claimed ? 'Quest done! Play anywhere you like.' : questDone ? 'The chest is ready!' : 'Luna is waiting at ' + (req ? req.name : 'the meadow') + '.';
  const action = quest.claimed ? null : questDone ? 'chest' : 'go';
  return { quest, dest, line, action, spoken: line + (action === 'go' ? ' Tap Go!' : action === 'chest' ? ' Open it!' : '') };
}
function announceHome() { return audio.say('Hello, ' + economy.save.child.name + '! ' + homeState().spoken); }
let announceNext = false; // a trail stop was just finished: when the map shows, Luna says where to go next

function renderHome() {
  const home = $('home');
  const name = economy.save.child.name;
  const comp = economy.companion();
  const { quest, dest, line, action } = homeState();
  const questStars = quest.claimed ? '⭐⭐' : quest.stops.map(st => st.done ? '⭐' : '☆').join('');
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: comp.level }));
  luna.addEventListener('click', () => { luna.className.baseVal = 'companion happy'; setTimeout(() => { luna.className.baseVal = 'companion idle'; }, 1400); announceHome(); });
  // One Go: the place's picture, the written line, and a single big action (Go, or Open when the chest is ready).
  const go = action === 'go' && dest
    ? el('button', { class: 'go ' + dest.place, type: 'button', 'aria-label': 'Go to ' + dest.name, onclick: () => dest.ready ? openCabinet(dest) : soon(dest) },
      [el('div', { class: 'art', html: placeArtSVG(dest.place) }), el('div', { class: 'line', text: line }), el('div', { class: 'word', text: 'Go!' })])
    : action === 'chest'
      ? el('button', { class: 'go chest', type: 'button', 'aria-label': 'Open the chest', onclick: claimQuest },
        [el('div', { class: 'art' }, [svgFrom(chestSVG({ open: false }))]), el('div', { class: 'line', text: line }), el('div', { class: 'word', text: 'Open!' })])
      : el('div', { class: 'go done' }, [el('div', { class: 'line', text: line })]);

  home.replaceChildren(
    el('div', { class: 'map' }, [
      el('div', { class: 'go-card' }, [
        luna,
        el('div', { class: 'greeting' }, [
          el('div', { class: 'hello' }, [el('span', { text: 'Hello, ' + name + '! ' }), el('span', { class: 'stars', 'aria-label': 'quest stars', text: questStars })]),
          go
        ])
      ]),
      el('div', { class: 'places' }, [
        el('div', { class: 'path' }),
        ...available().map(r => ({ r, spot: spotlightHint(r) })).sort((a, b) => !!b.spot - !!a.spot).map(({ r, spot }) => {
          const isToday = !!dest && r === dest;
          const onTrail = !quest.claimed && quest.stops.some(st => st.cabinet === r.id && !st.done);
          // today's stops stay full size; the other places shrink until the quest is claimed, then all are equal
          const compact = !quest.claimed && !isToday && !onTrail && !spot;
          return el('button', { class: 'place ' + r.place + (isToday ? ' today' : '') + (spot ? ' spotlight' : '') + (compact ? ' compact' : '') + (r.ready ? '' : ' soon'), type: 'button', 'aria-label': r.name, onclick: () => r.ready ? openCabinet(r) : soon(r) }, [
            el('div', { class: 'art', html: placeArtSVG(r.place) }),
            el('div', {}, [el('div', { class: 'name', text: r.name }), el('div', { class: 'hint', text: !r.ready ? 'Coming soon' : spot || r.hint })])
          ]);
        })
      ])
    ])
  );
  if (announceNext) { announceNext = false; announceHome(); }
  $('home').hidden = false; $('cabinet').hidden = true; $('back-btn').hidden = true;
  $('title').textContent = 'Princess Quest';
  updateBar();
}

function soon(r) { audio.say(r.name + ' is still growing. Coming soon!'); toast('🌱 ' + r.name + ' is coming soon'); }

function claimQuest() {
  if (!adaptive.claimQuest()) return;
  const o = sheet([
    svgFrom(chestSVG({ open: true })),
    el('h2', { text: 'Quest complete!' }),
    el('div', { class: 'sub', text: 'Ten gems for the kingdom' }),
    bigButton('Hooray!', () => { o.remove(); renderHome(); }, 'gold')
  ]);
  confetti(80);
  flyGems(10);
  if (audio.sfx) audio.sfx.yay();
  audio.say('Quest complete! Ten gems for you, ' + economy.save.child.name + '!');
}

let opening = false, stopsDoneAtOpen = 0;
// A finished round that completed one of today's stops sends her back to the map, where Luna says where to
// go next (or that the chest is ready). Free-play rounds stay in the place's own menu.
function afterRound() {
  const done = adaptive.todayQuest().stops.filter(st => st.done).length;
  if (done <= stopsDoneAtOpen) return false;
  stopsDoneAtOpen = done;
  announceNext = true;
  nav.toMap();
  return true;
}
async function openCabinet(r) {
  if (opening || current) return; // BUG-04: ignore a second tap while a place is opening
  opening = true;
  stopsDoneAtOpen = adaptive.todayQuest().stops.filter(st => st.done).length;
  audio.stop();
  try {
    const mod = await import(r.entry);
    current = { entry: r, module: mod };
    nav.push(() => closeCabinet());
    $('home').hidden = true; $('cabinet').hidden = false; $('back-btn').hidden = false;
    $('title').textContent = r.name.split(' ').pop();
    window.scrollTo(0, 0);
    await mod.mount($('cabinet'), { economy, adaptive, content, audio, speech, store, exit: () => nav.toMap(), afterRound, praise, place: r.place, cabinetId: r.id, refreshBar: updateBar, nav: { push: nav.push, pop: nav.pop } });
  } catch (e) {
    console.error(e);
    toast('This place needs one visit online first.');
    closeCabinet();
  } finally { opening = false; }
}

function closeCabinet() {
  audio.stop();
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  if (current && current.module.unmount) { try { current.module.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  $('cabinet').replaceChildren();
  if (updates && updates.reloadIfReady()) return;
  renderHome();
  if (clock.due()) showShaper();
}

function showShaper() {
  const o = sheet([
    svgFrom(lunaSVG({ state: 'happy', glow: economy.companion().level })),
    el('h2', { text: 'Great job! One more, or all done?' }),
    bigButton('One more', () => o.remove(), 'soft'),
    bigButton('All done ✅', async () => {
      o.remove();
      confetti(80);
      await audio.say('You did wonderful work today, ' + economy.save.child.name + '. Let\'s take three big breaths with Luna.');
      await breathingBubble(audio);
      audio.say('All done. See you next time!');
      clock.reset();
    })
  ]);
  audio.say('Great job! One more, or all done?');
}

function showPin() {
  let entry = '';
  const dots = el('div', { class: 'pin-dots' });
  const render = () => { dots.textContent = '●'.repeat(entry.length) + '○'.repeat(4 - entry.length); };
  render();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k =>
    el('button', { class: 'pin-key', type: 'button', text: k, style: k === '' ? 'visibility:hidden' : '', onclick: () => {
      if (k === '⌫') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += k;
      render();
      if (entry.length === 4) {
        if (entry === economy.save.child.pin) {
          try { sessionStorage.setItem('arcade.parentOk', String(Date.now())); } catch {}
          location.href = 'parent/index.html';
        }
        else { entry = ''; render(); toast('Try again'); }
      }
    } }));
  // a nav level of its own: the phone's Back (or Escape) closes the pad and leaves her where she was
  let open = true;
  const close = () => { if (!open) return; open = false; o.remove(); };
  const o = sheet([el('h2', { text: 'Parent corner' }), dots, el('div', { class: 'pin-grid' }, keys), bigButton('✖ Cancel', () => { if (open) { close(); nav.pop(); } }, 'soft')]);
  o.classList.add('pin-pad');
  nav.push(close);
  audio.say('This is for grown-ups. Tap cancel to keep playing.');
}

// Keyboard play (Chromebooks and laptops): number keys pick the 1st, 2nd, 3rd… thing to tap on screen,
// R or the space bar says the prompt again, Enter presses Done, Escape goes back. Tab and Enter also work
// on every button, with a visible focus ring.
const visible = b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled && b.style.visibility !== 'hidden'; };
function keyTargets() {
  const overlay = document.querySelector('.overlay');
  const scope = overlay || document;
  const groups = overlay ? ['button'] : [
    document.querySelector('.tile.picked') ? '.slot' : null,
    '.choice', '.tile', '.pat', '.sword', '.gem-box', '.ten-frame .cell', '.number-line button', '.rune', '.turn-done', '.encounter-btn', 'button.go, .place', '.garden-spot'
  ].filter(Boolean);
  for (const sel of groups) {
    const list = [...scope.querySelectorAll(sel)].filter(visible);
    if (list.length) return list;
  }
  return [];
}
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  clock.touch();
  if (/^[1-9]$/.test(e.key)) {
    const list = keyTargets();
    const b = list[Number(e.key) - 1];
    // press without leaving focus on the button, so a later Space or Enter replays or presses Done
    // instead of pressing this button again
    if (b) { e.preventDefault(); b.click(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); }
    return;
  }
  if (e.key === 'r' || e.key === 'R' || (e.key === ' ' && (!t || t === document.body))) {
    const sp = document.querySelector('.prompt .speak-btn');
    if (sp) { e.preventDefault(); sp.click(); }
    return;
  }
  if (e.key === 'Enter' && (!t || t === document.body)) {
    // the main button first (gold, e.g. "Yay!" or Star Stage's ✅), and Star Stage's thumbs-up when it waits
    for (const sel of ['.overlay .big-btn.gold', '.overlay .big-btn', '.turn-done:not([hidden])', '.big-btn.gold', '.big-btn']) {
      const done = [...document.querySelectorAll(sel)].find(visible);
      if (done) { e.preventDefault(); done.click(); break; }
    }
    return;
  }
  if (e.key === 'Escape') {
    // like the phone's Back: one level (out of an activity to its place's menu), then the map; a sheet that sits
    // under the top bar (Star Stage's finish sheets) does not block it
    if (document.querySelector('.overlay.pin-pad')) { e.preventDefault(); history.back(); return; }
    const back = $('back-btn');
    if (back.hidden || document.querySelector('.overlay:not(.below-bar)')) return;
    e.preventDefault();
    if (nav.stack.length > 1) history.back(); else back.click();
  }
}

async function loadAudioContent() {
  try {
    const { sounds } = await content.load('sounds');
    audio.setSounds(Object.fromEntries(sounds.map(s => [s.id, s])));
  } catch (e) { console.warn(e); }
  try {
    const manifest = await content.load('audio-manifest');
    audio.setManifest(manifest);
    try { audio.setLines(await content.load('lines-audio')); } catch (e) { console.warn('no story-voice lines', e); }
    player.preload((manifest.phonemes || []).map(id => './assets/audio/phonemes/' + id + '.' + manifest.ext));
  } catch (e) { console.warn('no bundled audio manifest', e); }
  await store.load();
}

async function boot() {
  $('splash-stars').replaceWith(starFieldEl(40));
  $('splash-hero').replaceChildren(svgFrom(lunaSVG({ state: 'idle', glow: economy.companion().level })));
  $('gem-icon').innerHTML = gemSVG(22);
  try { praise = await content.load('praise'); } catch (e) { console.warn(e); }
  const audioReady = loadAudioContent();
  $('start-btn').addEventListener('click', async () => {
    speech.activate();
    if (player.unlock) player.unlock();
    audio.sfx.unlock();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('splash').remove();
    $('topbar').hidden = false;
    renderHome();
    await audioReady;
    await announceHome(); // Luna says where she is waiting; the same words are written on the Go card
    // the show week: Luna says where to go (the card's countdown is text she cannot read)
    const spot = available().filter(r => r.ready && spotlightHint(r)).map(r => countdownSay(daysUntil(economy.today(), r.spotlight.until))).find(Boolean);
    const stageToDo = !Object.keys((economy.save.stage.days || {})[economy.today()] || {}).length; // as spotFirst in renderHome
    if (spot && stageToDo && !current && !opening && !document.querySelector('.overlay')) audio.say(spot);
  });
  $('back-btn').addEventListener('click', () => nav.toMap());
  $('mute-btn').addEventListener('click', () => { speech.toggleMuted(); if (speech.muted) audio.stop(); updateBar(); });
  // a place may be in the middle of something (Star Stage records her): let it stop before the PIN pad opens
  $('gear-btn').addEventListener('click', () => { if (current && current.module.interrupt) current.module.interrupt(); showPin(); });
  document.addEventListener('pointerdown', () => clock.touch(), { passive: true });
  document.addEventListener('keydown', onKey);
  // ?nosw=1 skips the service worker (local testing only: no cache-first surprises while editing files).
  if ('serviceWorker' in navigator && !/[?&]nosw=1/.test(location.search)) {
    updates = watchUpdates({ onSplash: () => !!$('splash'), onMap: () => !current && !opening && !document.querySelector('.overlay') });
    // the version on this device, small at the bottom of the splash (a grown-up checking an update)
    // (asked again a few seconds later if the worker did not answer the first time)
    const showVersion = () => installedVersion().then(v => { const n = $('app-version'); if (v && n) n.textContent = 'Version ' + v; return v; });
    navigator.serviceWorker.ready.then(showVersion).then(v => { if (!v) setTimeout(showVersion, 3000); }).catch(() => {});
  }
}
boot();
