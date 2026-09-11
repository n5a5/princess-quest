// parent/parent.js — PIN-gated dashboard: per-sub-skill table, baseline, Sound Check, settings, export/import.
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS } from '../shared/adaptive.js';
import { REGISTRY } from '../games/registry.js';
import { el } from '../shared/ui.js';
import { createAudioStore } from '../shared/audiostore.js';
import { createContentLoader } from '../shared/content.js';
import { createSpeech } from '../shared/speech.js';
import { createAudio, createHtmlPlayer, decodeSteps } from '../shared/audio.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const store = createAudioStore();
const content = createContentLoader({ base: '../content/' });
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const player = createHtmlPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings, base: '../assets/audio/' });
const app = document.getElementById('app');
let SOUNDS = [];

const BASELINE = [
  ['Phonics / word analysis', 'Emerging K', '70', 1], ['High-frequency words', 'Emerging K', '—', 1],
  ['Phonological awareness', 'Early/Mid K', '69', 1], ['Measurement & data', 'Emerging K', '66', 1],
  ['Number sense / operations', 'Early K', '57 / 59', 1], ['Counting & cardinality', 'Early K', '78', 2],
  ['Algebraic thinking', 'Mid K', '50–54', 2], ['Geometry', 'Mid K', '67', 2], ['Vocabulary', 'Mid/Late K', '61', 2],
  ['Print concepts / fluency', '—', '86 / 83', 3], ['Comprehension', 'Mid/Late K', '82 / 82', 3]
];

function pinGate() {
  let entry = '';
  const dots = el('div', { text: '○○○○', style: 'font-size:28px;letter-spacing:6px' });
  const grid = el('div', { class: 'pin-grid' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k =>
    el('button', { type: 'button', text: k, style: k ? '' : 'visibility:hidden', onclick: () => {
      if (k === '⌫') entry = entry.slice(0, -1); else if (entry.length < 4) entry += k;
      dots.textContent = '●'.repeat(entry.length) + '○'.repeat(4 - entry.length);
      if (entry.length === 4) { if (entry === economy.save.child.pin) render(); else { entry = ''; dots.textContent = '○○○○'; } }
    } })));
  app.replaceChildren(el('div', { class: 'pin-wrap' }, [el('h2', { text: 'Enter PIN' }), dots, grid]));
}

function pct(v) { return v === null ? '—' : Math.round(v * 100) + '%'; }
function plain(def) {
  const acc = adaptive.accuracy(def.id);
  const ds = adaptive.daysSince(def.id);
  const stage = adaptive.stage(def.id);
  if (acc === null) return def.name + ': not practiced yet.';
  return `${def.name}: stage ${stage}, ${pct(acc)} last 20, last practiced ${ds === 0 ? 'today' : ds + ' day' + (ds === 1 ? '' : 's') + ' ago'}.`;
}

function render() {
  const s = economy.save;
  const today = economy.today();
  app.replaceChildren(
    el('section', {}, [
      el('h2', { text: 'Today' }),
      el('p', { text: `Gems: ${s.gems}. Days played: ${s.streak.days.length}. Played today: ${s.streak.days.includes(today) ? 'yes' : 'no'}. Badges: ${s.badges.length}.` })
    ]),
    el('section', {}, [
      el('h2', { text: 'Skills' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Skill', 'Tier', 'Stage', 'Last 20', 'Today', 'Last practiced'].map(h => el('th', { text: h })))]),
        el('tbody', {}, SUBSKILLS.map(d => {
          const ds = adaptive.daysSince(d.id);
          return el('tr', { class: d.tier === 1 ? 'tier1' : '' }, [
            el('td', {}, [d.name + ' ', el('span', { class: 'muted', text: d.strand })]),
            el('td', { text: String(d.tier) }),
            el('td', { text: adaptive.stage(d.id) }),
            el('td', { text: pct(adaptive.accuracy(d.id)) }),
            el('td', { text: String(adaptive.itemsOnDay(d.id, today)) }),
            el('td', { text: ds === null ? 'never' : ds === 0 ? 'today' : ds + 'd ago' })
          ]);
        }))
      ]),
      el('div', { style: 'margin-top:10px' }, SUBSKILLS.map(d => el('p', { class: 'line', text: plain(d) })))
    ]),
    el('section', {}, [
      el('h2', { text: 'Trouble spots (missed 3+ times)' }),
      el('p', { text: adaptive.troubleList().map(t => `${t.id} (${t.count})`).join(', ') || 'None yet.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Fall 2026 baseline' }),
      el('p', { class: 'muted', text: 'Star domain scores are model-based estimates tied to the overall scaled score; i-Ready K domain placements rest on few items. Treat this as a hypothesis the table above checks.' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Strand', 'i-Ready', 'Star', 'Tier'].map(h => el('th', { text: h })))]),
        el('tbody', {}, BASELINE.map(r => el('tr', {}, r.map(c => el('td', { text: String(c) })))))
      ]),
      el('p', { class: 'muted', text: 'Targets: i-Ready reading 396 → 439 typical / 450 stretch; math 372 → 396 / 410.' })
    ]),
    soundCheckSection(),
    el('section', {}, [
      el('h2', { text: 'Modules' }),
      el('div', { class: 'row' }, REGISTRY.map(r => el('label', { class: 'toggle' }, [
        el('input', { type: 'checkbox', ...(s.settings.modulesOff.includes(r.id) ? {} : { checked: '' }), onchange: e => {
          const off = new Set(s.settings.modulesOff);
          if (e.target.checked) off.delete(r.id); else off.add(r.id);
          s.settings.modulesOff = [...off]; economy.persist();
        } }),
        el('span', { text: r.icon + ' ' + r.name })
      ])))
    ]),
    el('section', {}, [
      el('h2', { text: 'Settings' }),
      el('div', { class: 'row' }, [
        el('label', { text: 'Child name ' }), el('input', { id: 'name', value: s.child.name, maxlength: '20' }),
        el('button', { type: 'button', text: 'Save', onclick: () => { const v = document.getElementById('name').value.trim(); if (v) { s.child.name = v; economy.persist(); render(); } } })
      ]),
      el('div', { class: 'row' }, [
        el('label', { text: 'PIN ' }), el('input', { id: 'pin', value: s.child.pin, maxlength: '4', inputmode: 'numeric' }),
        el('button', { type: 'button', text: 'Save PIN', onclick: () => { const v = document.getElementById('pin').value.trim(); if (/^\d{4}$/.test(v)) { s.child.pin = v; economy.persist(); render(); } } })
      ]),
      el('div', { class: 'row' }, [
        el('label', { text: 'Voice ' }), voiceSelect(),
        el('label', { text: 'Speed ' }), el('select', { onchange: e => { s.settings.rate = Number(e.target.value); economy.persist(); } },
          [['0.8', 'Slower'], ['0.9', 'Normal'], ['1', 'Quicker']].map(([v, t]) => el('option', { value: v, text: t, ...(String(s.settings.rate) === v ? { selected: '' } : {}) }))),
        el('button', { type: 'button', text: '▶ Test voice', onclick: () => audio.say('Hello! I am the story voice. The cat sat on the mat.') })
      ])
    ]),
    el('section', {}, [
      el('h2', { text: 'Save data' }),
      el('div', { class: 'row' }, [
        el('button', { type: 'button', text: 'Export progress JSON', onclick: exportSave }),
        el('label', { class: 'toggle' }, ['Import progress ', el('input', { type: 'file', accept: 'application/json', onchange: importSave })]),
        el('button', { type: 'button', class: 'danger', text: 'Reset all progress', onclick: () => { if (confirm('Reset ALL progress? This cannot be undone.')) { economy.reset(); render(); } } })
      ]),
      el('p', { class: 'muted', text: 'Devices do not sync. Use export/import to move progress between phone, tablet, and PC. Recorded sounds have their own export in Sound Check.' })
    ])
  );
}

// Sound Check: every phoneme with its current source (recorded / bundled / TTS / none), a play button,
// an optional recording in the parent's voice, and a "decode demo" so the blend timing can be judged by ear.
function soundCheckSection() {
  const section = el('section', {}, [el('h2', { text: 'Sound Check (letter sounds)' })]);
  const recorded = store.count('phoneme');
  const bundledCount = SOUNDS.filter(s => audio.phonemeSource(s.id) !== 'none' && audio.phonemeSource(s.id) !== 'tts').length;
  section.appendChild(el('p', { class: 'muted', text:
    `The app never asks text-to-speech to say a bare letter sound (that is where "buh" comes from). Each sound plays a recorded clip if you made one, otherwise a bundled default clip. ` +
    `${bundledCount} of ${SOUNDS.length} sounds have a bundled default; ${recorded} recorded in your voice on this device. ` +
    `Tap ▶ to hear the version she will hear. If a default sounds wrong, record it: tap Record, say just the sound once, clean and short. Continuants (s, m, f) can be stretched; stops (b, p, t) must be clipped with no "uh".` }));
  const demoRow = el('div', { class: 'row' }, [
    el('button', { type: 'button', text: '▶ Decode demo: cat', onclick: () => audio.decode({ word: 'cat', units: [['c', 'k'], ['a', 'a'], ['t', 't']] }) }),
    el('button', { type: 'button', text: '▶ Decode demo: ship', onclick: () => audio.decode({ word: 'ship', units: [['sh', 'sh'], ['i', 'i'], ['p', 'p']] }) }),
    el('button', { type: 'button', text: '▶ Decode demo: cake', onclick: () => audio.decode({ word: 'cake', units: [['c', 'k'], ['a', 'ae'], ['k', 'k'], ['e', null]] }) }),
    el('button', { type: 'button', text: '■ Stop', onclick: () => audio.stop() })
  ]);
  section.appendChild(demoRow);
  const grid = el('div', { class: 'kit' });
  section.appendChild(grid);
  const canRecord = store.canRecord();
  for (const s of SOUNDS) {
    const row = el('div', { class: 'snd' });
    const src = el('span', { class: 'src' });
    const refresh = () => {
      const kind = audio.phonemeSource(s.id);
      src.textContent = { recorded: '🎙 your voice', bundled: '📦 default', tts: '🤖 tts', none: '⚠ silent' }[kind];
      row.className = 'snd ' + kind;
    };
    refresh();
    const playBtn = el('button', { type: 'button', text: '▶', 'aria-label': 'Play', onclick: () => { audio.stop(); audio.phoneme(s.id); } });
    const recBtn = el('button', { type: 'button', class: 'rec', text: 'Record', ...(canRecord ? {} : { disabled: '' }) });
    const delBtn = el('button', { type: 'button', text: '✕', 'aria-label': 'Delete recording', ...(store.has('phoneme', s.id) ? {} : { disabled: '' }) });
    let session = null;
    recBtn.addEventListener('click', async () => {
      if (session) { session.stop(); return; }
      try {
        session = await store.record(2000);
        recBtn.textContent = '■ Stop'; recBtn.classList.add('live');
        const blob = await session.blob;
        session = null;
        recBtn.classList.remove('live'); recBtn.textContent = 'Record';
        if (blob.size < 200) { alert('That recording was empty. Try again.'); return; }
        await store.save('phoneme', s.id, blob);
        delBtn.removeAttribute('disabled');
        refresh();
        audio.phoneme(s.id);
      } catch (e) {
        session = null; recBtn.classList.remove('live'); recBtn.textContent = 'Record';
        alert('Microphone not available: ' + (e && e.message ? e.message : e));
      }
    });
    delBtn.addEventListener('click', async () => { await store.remove('phoneme', s.id); delBtn.setAttribute('disabled', ''); refresh(); });
    row.append(
      el('span', { class: 'chip', text: s.label }),
      el('div', { class: 'meta' }, [el('span', { text: s.pic + ' ' + s.word + ' · ' }), src, el('span', { class: 'tip', text: s.tip })]),
      playBtn, recBtn, delBtn
    );
    grid.appendChild(row);
  }
  section.appendChild(el('div', { class: 'row' }, [
    el('button', { type: 'button', text: 'Export recordings', onclick: async () => {
      const blob = new Blob([await store.exportJSON()], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'amelia-sound-kit.json' });
      document.body.appendChild(a); a.click(); a.remove();
    } }),
    el('label', { class: 'toggle' }, ['Import recordings ', el('input', { type: 'file', accept: 'application/json', onchange: async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const n = await store.importJSON(await f.text()); alert('Imported ' + n + ' recordings.'); render(); } catch (err) { alert('Not a sound kit file.'); }
    } })])
  ]));
  return section;
}

function voiceSelect() {
  const s = economy.save;
  const sel = el('select', { onchange: e => { speech.setVoice(e.target.value); } });
  const fill = () => {
    const voices = ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^en/i.test(v.lang));
    sel.replaceChildren(el('option', { value: '', text: 'Automatic (en-US)' }), ...voices.map(v => el('option', { value: v.name, text: v.name + ' (' + v.lang + (v.localService ? ', offline' : '') + ')', ...(s.settings.voiceName === v.name ? { selected: '' } : {}) })));
  };
  fill();
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', fill);
  return sel;
}

function exportSave() {
  const blob = new Blob([economy.exportJSON()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'amelia-arcade-' + economy.today() + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
}
function importSave(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { if (economy.importJSON(t)) { alert('Imported.'); render(); } else alert('That file is not a valid save.'); });
}

async function start() {
  try { SOUNDS = (await content.load('sounds')).sounds; audio.setSounds(Object.fromEntries(SOUNDS.map(s => [s.id, s]))); } catch (e) { console.warn(e); }
  try { audio.setManifest(await content.load('audio-manifest')); } catch (e) { console.warn('no manifest', e); }
  await store.load();
  let unlocked = false;
  try { unlocked = sessionStorage.getItem('arcade.parentOk') === '1'; } catch {}
  if (unlocked) render(); else pinGate();
}
start();
