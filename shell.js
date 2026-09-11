// shell.js — boots services, renders the Kingdom map, lazy-loads places, runs the session shaper.
import { REGISTRY, SQUISHIES } from './games/registry.js';
import { createEconomy } from './shared/economy.js';
import { createAdaptive } from './shared/adaptive.js';
import { createContentLoader } from './shared/content.js';
import { createSessionClock } from './shared/session.js';
import { createSpeech } from './shared/speech.js';
import { createAudioStore } from './shared/audiostore.js';
import { createAudio, createWebAudioPlayer } from './shared/audio.js';
import { el, bigButton, sheet, toast, confetti, breathingBubble, withName, pick } from './shared/ui.js';
import { lunaSVG, gemSVG, chestSVG, placeArtSVG, svgFrom, starFieldEl } from './shared/characters.js';
import { flyGems } from './shared/encounter.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const content = createContentLoader();
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const store = createAudioStore();
const player = createWebAudioPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings });
const clock = createSessionClock();

const $ = id => document.getElementById(id);
let current = null;   // { entry, module }

// Back-button navigation: every screen below the map pushes a history entry with a handler that
// restores the screen above it. The phone's back button pops one level; from the map it exits.
const nav = {
  stack: [], ignore: 0,
  push(handler) { nav.stack.push(handler); history.pushState({ depth: nav.stack.length }, ''); },
  pop() { if (!nav.stack.length) return; nav.ignore++; history.back(); },
  toMap() { if (nav.stack.length) history.go(-nav.stack.length); else closeCabinet(); }
};
window.addEventListener('popstate', e => {
  const depth = (e.state && e.state.depth) || 0;
  const silent = nav.ignore > 0;
  while (nav.stack.length > depth) { const h = nav.stack.pop(); if (!silent) { try { h(); } catch (err) { console.warn(err); } } }
  if (silent) nav.ignore--;
});
let praise = { praise: ['Great job!'], greeting: ['Hello, {name}!'], retry: [], reveal: [] };

function available() { return REGISTRY.filter(r => !economy.save.settings.modulesOff.includes(r.id)); }
function readyIds() { return available().filter(r => r.ready).map(r => r.id); }

function updateBar() {
  $('gem-count').textContent = economy.save.gems;
  $('mute-btn').textContent = speech.muted ? '🔇' : '🔊';
}

function renderHome() {
  const home = $('home');
  const name = economy.save.child.name;
  const quest = adaptive.todayQuest(readyIds());
  const comp = economy.companion();
  const req = REGISTRY.find(r => r.id === quest.requiredCabinet);
  const questDone = quest.requiredDone && quest.choiceDone;
  const questStars = (quest.requiredDone ? '⭐' : '☆') + (quest.choiceDone ? '⭐' : '☆');
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: comp.level }));
  luna.addEventListener('click', () => { luna.className.baseVal = 'companion happy'; setTimeout(() => { luna.className.baseVal = 'companion idle'; }, 1400); audio.say(withName(pick(praise.greeting), name)); });

  home.replaceChildren(
    el('div', { class: 'map' }, [
      el('div', { class: 'map-head' }, [
        luna,
        el('div', { class: 'greeting' }, [
          el('div', { class: 'hello', text: 'Hello, ' + name + '!' }),
          el('div', { class: 'sub', text: quest.claimed ? 'Quest done! Play anywhere you like.' : 'Luna is waiting at ' + (req ? req.name : 'the meadow') + '.' }),
          el('div', { class: 'meter', 'aria-label': 'Luna glow' }, [el('span', { class: 'star', text: '⭐' }), el('div', { class: 'track' }, [el('div', { class: 'fill', style: 'width:' + Math.round(comp.fraction * 100) + '%' })])])
        ])
      ]),
      el('div', { class: 'quest' }, [
        el('div', { class: 'icon', text: quest.claimed ? '✅' : '🗺️' }),
        el('div', { class: 'text', text: quest.claimed ? 'Today\'s quest is done!' : 'Today: ' + (req ? req.name : 'a place') + ', then one you choose.' }),
        quest.claimed ? el('div', { class: 'stars', text: '⭐⭐' })
          : questDone ? el('button', { class: 'claim', type: 'button', text: 'Open chest!', onclick: claimQuest })
          : el('div', { class: 'stars', text: questStars })
      ]),
      el('div', { class: 'places' }, [
        el('div', { class: 'path' }),
        ...available().map(r => {
          const rescued = economy.rescuedAt(r.place, SQUISHIES[r.place] || []);
          const isToday = !quest.claimed && r.id === quest.requiredCabinet;
          const btn = el('button', { class: 'place ' + r.place + (isToday ? ' today' : '') + (r.ready ? '' : ' soon'), type: 'button', 'aria-label': r.name, onclick: () => r.ready ? openCabinet(r) : soon(r) }, [
            el('div', { class: 'art', html: placeArtSVG(r.place) }),
            el('div', {}, [el('div', { class: 'name', text: r.name }), el('div', { class: 'hint', text: r.ready ? r.hint : 'Coming soon' })]),
            el('div', { class: 'side' }, [
              el('div', { class: 'bubbles' }, (SQUISHIES[r.place] || []).map(id => el('span', { class: rescued.includes(id) ? 'free' : '', text: rescued.includes(id) ? '😊' : '' })))
            ])
          ]);
          if (isToday) btn.appendChild(svgFrom(lunaSVG({ state: 'idle', glow: comp.level }), 'luna-here'));
          return btn;
        })
      ])
    ])
  );
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
  audio.say('Quest complete! Ten gems for you, ' + economy.save.child.name + '!');
}

async function openCabinet(r) {
  audio.stop();
  try {
    const mod = await import(r.entry);
    current = { entry: r, module: mod };
    nav.push(() => closeCabinet());
    $('home').hidden = true; $('cabinet').hidden = false; $('back-btn').hidden = false;
    $('title').textContent = r.name;
    window.scrollTo(0, 0);
    await mod.mount($('cabinet'), { economy, adaptive, content, audio, speech, exit: () => nav.toMap(), praise, place: r.place, cabinetId: r.id, refreshBar: updateBar, nav: { push: nav.push, pop: nav.pop } });
  } catch (e) {
    console.error(e);
    toast('This place needs one visit online first.');
    closeCabinet();
  }
}

function closeCabinet() {
  audio.stop();
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  if (current && current.module.unmount) { try { current.module.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  $('cabinet').replaceChildren();
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
          try { sessionStorage.setItem('arcade.parentOk', '1'); } catch {}
          location.href = 'parent/index.html';
        }
        else { entry = ''; render(); toast('Try again'); }
      }
    } }));
  const o = sheet([el('h2', { text: 'Parent corner' }), dots, el('div', { class: 'pin-grid' }, keys), bigButton('Cancel', () => o.remove(), 'soft')]);
}

async function loadAudioContent() {
  try {
    const { sounds } = await content.load('sounds');
    audio.setSounds(Object.fromEntries(sounds.map(s => [s.id, s])));
  } catch (e) { console.warn(e); }
  try {
    const manifest = await content.load('audio-manifest');
    audio.setManifest(manifest);
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
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('splash').remove();
    $('topbar').hidden = false;
    renderHome();
    await audioReady;
    audio.say(withName(pick(praise.greeting), economy.save.child.name));
  });
  $('back-btn').addEventListener('click', () => nav.toMap());
  $('mute-btn').addEventListener('click', () => { speech.toggleMuted(); if (speech.muted) audio.stop(); updateBar(); });
  $('gear-btn').addEventListener('click', showPin);
  document.addEventListener('pointerdown', () => clock.touch(), { passive: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
boot();
