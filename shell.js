// shell.js — boots services, renders home, lazy-loads cabinets, runs the session shaper.
import { REGISTRY } from './games/registry.js';
import { createEconomy } from './shared/economy.js';
import { createAdaptive } from './shared/adaptive.js';
import { createContentLoader } from './shared/content.js';
import { createSessionClock } from './shared/session.js';
import { createSpeech } from './shared/speech.js';
import { createAudioStore } from './shared/audiostore.js';
import { createAudio, createHtmlPlayer } from './shared/audio.js';
import { el, bigButton, sheet, toast, confetti, breathingBubble, withName, pick } from './shared/ui.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const content = createContentLoader();
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const store = createAudioStore();
const player = createHtmlPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings });
const clock = createSessionClock();

const $ = id => document.getElementById(id);
let current = null;   // { entry, module }
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
  const streak = economy.streak();
  const rank = economy.starRank(adaptive.tier1Ids());
  const req = REGISTRY.find(r => r.id === quest.requiredCabinet);
  const questDone = quest.requiredDone && quest.choiceDone;
  const questStars = (quest.requiredDone ? '⭐' : '☆') + (quest.choiceDone ? '⭐' : '☆');

  home.replaceChildren(
    el('div', { class: 'home-head' }, [
      el('div', { class: 'hello', text: 'Hello, ' + name + '!' }),
      el('div', { class: 'rank', text: '⭐'.repeat(rank) + '☆'.repeat(5 - rank) }),
      el('div', { class: 'streak' }, [el('span', { text: '🔥' }), ...streak.last7.map(on => el('span', { class: 'dot' + (on ? ' on' : '') }))])
    ]),
    el('div', { class: 'quest' }, [
      el('div', { class: 'icon', text: req ? req.icon : '🌟' }),
      el('div', { class: 'text', text: quest.claimed ? 'Quest done! See you tomorrow.' : 'Play ' + (req ? req.name : 'a game') + ', then one you choose.' }),
      quest.claimed ? el('div', { class: 'stars', text: '⭐⭐' })
        : questDone ? el('button', { class: 'claim', type: 'button', text: 'Claim!', onclick: claimQuest })
        : el('div', { class: 'stars', text: questStars })
    ]),
    el('div', { class: 'cabinets' }, available().map(r => {
      const stars = economy.save.stars[r.id] || 0;
      return el('button', { class: 'cabinet' + (r.ready ? '' : ' soon'), type: 'button', onclick: () => r.ready ? openCabinet(r) : soon(r) }, [
        el('div', { class: 'icon', text: r.ready ? r.icon : '🌱' }),
        el('div', { class: 'name', text: r.name }),
        el('div', { class: 'stars', text: r.ready ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '' })
      ]);
    }))
  );
  $('home').hidden = false; $('cabinet').hidden = true; $('back-btn').hidden = true;
  $('title').textContent = '👑 Amelia\'s Arcade';
  updateBar();
}

function soon(r) { audio.say(r.name + ' is growing. Coming soon!'); toast('🌱 ' + r.name + ' is coming soon'); }

function claimQuest() {
  if (!adaptive.claimQuest()) return;
  confetti(60);
  audio.say('Quest complete! Ten gems for you, ' + economy.save.child.name + '!');
  renderHome();
}

async function openCabinet(r) {
  audio.stop();
  try {
    const mod = await import(r.entry);
    current = { entry: r, module: mod };
    $('home').hidden = true; $('cabinet').hidden = false; $('back-btn').hidden = false;
    $('title').textContent = r.icon + ' ' + r.name;
    window.scrollTo(0, 0);
    await mod.mount($('cabinet'), { economy, adaptive, content, audio, speech, exit: closeCabinet, praise });
  } catch (e) {
    console.error(e);
    toast('This game needs one visit online first.');
    closeCabinet();
  }
}

function closeCabinet() {
  audio.stop();
  if (current && current.module.unmount) { try { current.module.unmount(); } catch (e) { console.warn(e); } }
  current = null;
  $('cabinet').replaceChildren();
  renderHome();
  if (clock.due()) showShaper();
}

function showShaper() {
  const o = sheet([
    el('div', { class: 'big-emoji', text: '🌟' }),
    el('h2', { text: 'Great job! One more, or all done?' }),
    bigButton('One more', () => o.remove(), 'soft'),
    bigButton('All done ✅', async () => {
      o.remove();
      confetti(80);
      await audio.say('You did wonderful work today, ' + economy.save.child.name + '. Let\'s take three big breaths.');
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
  try { praise = await content.load('praise'); } catch (e) { console.warn(e); }
  const audioReady = loadAudioContent();
  $('start-btn').addEventListener('click', async () => {
    speech.activate();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    $('splash').remove();
    $('topbar').hidden = false;
    renderHome();
    await audioReady;
    audio.say(withName(pick(praise.greeting), economy.save.child.name));
  });
  $('back-btn').addEventListener('click', closeCabinet);
  $('mute-btn').addEventListener('click', () => { speech.toggleMuted(); if (speech.muted) audio.stop(); updateBar(); });
  $('gear-btn').addEventListener('click', showPin);
  document.addEventListener('pointerdown', () => clock.touch(), { passive: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
}
boot();
