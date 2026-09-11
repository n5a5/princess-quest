// parent/parent.js — Parent Corner: is Princess Quest working? Mastery per skill, first-try trend,
// improving / flat / regressing flags, minutes and items per day, next focus, trouble spots, Sound Check,
// settings, export/import. Child-facing screens never show any of this.
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, diffDays } from '../shared/adaptive.js';
import { REGISTRY } from '../games/registry.js';
import { el } from '../shared/ui.js';
import { createAudioStore } from '../shared/audiostore.js';
import { createContentLoader } from '../shared/content.js';
import { createSpeech } from '../shared/speech.js';
import { createAudio, createWebAudioPlayer } from '../shared/audio.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const store = createAudioStore();
const content = createContentLoader({ base: '../content/' });
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const player = createWebAudioPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings, base: '../assets/audio/' });
const app = document.getElementById('app');
let SOUNDS = [], SW = null;

const BASELINE = [
  ['Phonics / word analysis', 'Emerging K', '70', 1, ['phonics-encode', 'phonics-decode']], ['High-frequency words', 'Emerging K', '—', 1, ['sight-words']],
  ['Phonological awareness', 'Early/Mid K', '69', 1, ['pa-sounds', 'pa-blend-segment', 'pa-manipulate']], ['Measurement & data', 'Emerging K', '66', 1, ['measure', 'data-sort']],
  ['Number sense / operations', 'Early K', '57 / 59', 1, ['subitize-tenframe', 'teen-compare', 'add-sub']], ['Counting & cardinality', 'Early K', '78', 2, ['count-sequence']],
  ['Algebraic thinking', 'Mid K', '50–54', 2, ['decompose-stories']], ['Geometry', 'Mid K', '67', 2, ['shapes']], ['Vocabulary', 'Mid/Late K', '61', 2, ['comprehension']],
  ['Print concepts / fluency', '—', '86 / 83', 3, []], ['Comprehension', 'Mid/Late K', '82 / 82', 3, ['comprehension']]
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

const pct = v => v === null || v === undefined ? '—' : Math.round(v * 100) + '%';
const trendWord = t => t === null ? 'not enough data yet' : t > 0.1 ? 'improving ↑' : t < -0.1 ? 'slipping ↓' : 'steady →';
const trendClass = t => t === null ? '' : t > 0.1 ? 'up' : t < -0.1 ? 'down' : '';

function daysPlayed(n) {
  const today = economy.today();
  const days = new Set(economy.save.log.map(r => r.day));
  return [...days].filter(d => diffDays(d, today) < n).length;
}
function itemsInDays(n, id = null) {
  const today = economy.today();
  return economy.save.log.filter(r => diffDays(r.day, today) < n && (!id || r.subskill === id)).length;
}
function minutesEstimate(n) { return Math.round(itemsInDays(n) * 0.5); } // ~30 s per item

function sparkline(id) {
  // 14-day first-try rate, one bar per day
  const today = economy.today();
  const bars = [];
  for (let i = 13; i >= 0; i--) {
    const rows = economy.save.log.filter(r => r.subskill === id && diffDays(r.day, today) === i);
    bars.push(rows.length ? rows.filter(r => r.ok).length / rows.length : null);
  }
  const w = 140, h = 34, bw = w / 14;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${bars.map((v, i) => v === null ? `<rect x="${i * bw + 2}" y="${h - 3}" width="${bw - 4}" height="2" fill="#ddd"/>` : `<rect x="${i * bw + 2}" y="${h - 4 - v * (h - 6)}" width="${bw - 4}" height="${v * (h - 6) + 2}" rx="2" fill="${v >= 0.8 ? '#4DB6A4' : v >= 0.6 ? '#E9B949' : '#E2688F'}"/>`).join('')}</svg>`;
}

function plain(def) {
  const acc = adaptive.accuracy(def.id);
  const ds = adaptive.daysSince(def.id);
  const stage = adaptive.stage(def.id);
  const p = adaptive.mastery(def.id);
  if (acc === null) return `${def.name}: not practised yet.`;
  return `${def.name}: stage ${stage}, mastery ${pct(p)}, first-try ${pct(acc)} on the last 20, ${trendWord(adaptive.trend(def.id))}, last practised ${ds === 0 ? 'today' : ds + ' day' + (ds === 1 ? '' : 's') + ' ago'}.`;
}

function nextFocus() {
  const ready = REGISTRY.filter(r => r.ready && !economy.save.settings.modulesOff.includes(r.id)).map(r => r.id);
  const pick = adaptive.pickQuestCabinet(ready);
  const def = SUBSKILLS.find(s => s.id === pick.subskill);
  const place = REGISTRY.find(r => r.id === pick.cabinet);
  if (!def) return 'Play any place.';
  const p = adaptive.mastery(def.id);
  const ds = adaptive.daysSince(def.id);
  return `${place ? place.name : pick.cabinet} — ${def.name} (mastery ${pct(p)}${ds === null ? ', not practised yet' : ds > 1 ? ', ' + ds + ' days since practice' : ''}).`;
}

function tonightLine() {
  const trouble = adaptive.troubleList(2).slice(0, 3);
  if (!trouble.length) return 'Nothing is stuck. Ask her to read you three wish words from the well.';
  const items = trouble.map(t => t.id.replace(/^[a-z-]+:/, '').replace(/[:>]/g, ' → ')).join(', ');
  return `Two minutes tonight: revisit ${items}. Say the sound, let her find it, then let her teach it to you.`;
}

function render() {
  const s = economy.save;
  const today = economy.today();
  const sw = SW ? Object.entries(s.sightWords).filter(([, v]) => v.introducedDay) : [];
  const mastered = sw.filter(([, v]) => v.box >= 5 && v.firstTryDays.length >= 3).length;
  app.replaceChildren(
    el('section', {}, [
      el('h2', { text: 'Is it working?' }),
      el('div', { class: 'kpis' }, [
        kpi('Days played (14d)', daysPlayed(14)), kpi('Items (7d)', itemsInDays(7)), kpi('Minutes (7d, est.)', minutesEstimate(7)),
        kpi('Wish words known', sw.length), kpi('Wish words mastered', mastered), kpi('Squishies freed', s.squishies.rescued.length), kpi('Luna stars', s.companion.stars), kpi('Gems', s.gems)
      ]),
      el('p', {}, [el('strong', { text: 'Next focus: ' }), nextFocus()]),
      el('p', {}, [el('strong', { text: 'Do this with her tonight: ' }), tonightLine()]),
      el('p', { class: 'muted', text: 'The evidence says adult participation is the biggest lever for app-based phonics (McTigue et al. 2020). Two minutes counts.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Skills' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Skill', 'Tier', 'Stage', 'Mastery', 'First-try (20)', 'Trend', '14 days', 'Today', 'Last'].map(h => el('th', { text: h })))]),
        el('tbody', {}, SUBSKILLS.map(d => {
          const ds = adaptive.daysSince(d.id);
          const t = adaptive.trend(d.id);
          return el('tr', { class: (d.tier === 1 ? 'tier1 ' : '') + (adaptive.needsReteach(d.id) ? 'reteach' : '') }, [
            el('td', {}, [d.name + ' ', el('span', { class: 'muted', text: d.strand })]),
            el('td', { text: String(d.tier) }),
            el('td', { text: adaptive.stage(d.id) }),
            el('td', { text: pct(adaptive.mastery(d.id)) }),
            el('td', { text: pct(adaptive.accuracy(d.id)) }),
            el('td', { class: trendClass(t), text: trendWord(t) }),
            el('td', { html: sparkline(d.id) }),
            el('td', { text: String(adaptive.itemsOnDay(d.id, today)) }),
            el('td', { text: ds === null ? 'never' : ds === 0 ? 'today' : ds + 'd ago' })
          ]);
        }))
      ]),
      el('p', { class: 'muted', text: 'Mastery is a Bayesian estimate that a skill is known (first-try answers count fully, answers after a hint count half, revealed answers count against). A stage advances at 85% mastery with six first-try items on two different days. Rows in rose need re-teaching; the planner already sends more review there.' }),
      el('div', { style: 'margin-top:10px' }, SUBSKILLS.map(d => el('p', { class: 'line', text: plain(d) })))
    ]),
    el('section', {}, [
      el('h2', { text: 'Trouble spots (missed 3+ times, shown after two misses on one item)' }),
      el('p', { text: adaptive.troubleList().map(t => `${t.id} (${t.count})`).join(', ') || 'None yet.' }),
      el('h2', { text: 'Wish words by box', style: 'margin-top:12px' }),
      el('p', { text: [1, 2, 3, 4, 5].map(b => `box ${b}: ${sw.filter(([, v]) => v.box === b).map(([w]) => w).join(' ') || '—'}`).join('  ·  ') || 'No words introduced yet.' }),
      el('h2', { text: 'Feelings check-ins', style: 'margin-top:12px' }),
      el('p', { text: (s.feelingsLog || []).slice(-10).map(f => f.day.slice(5) + ' ' + f.feeling).join(', ') || 'None yet.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Fall 2026 baseline and what the app is doing about each strand' }),
      el('p', { class: 'muted', text: 'Star domain scores are model-based estimates tied to the overall scaled score; i-Ready K domain placements rest on few items. Treat this as a hypothesis the Skills table checks.' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Strand', 'i-Ready', 'Star', 'Tier', 'App mastery now'].map(h => el('th', { text: h })))]),
        el('tbody', {}, BASELINE.map(r => { const ids = r[4]; const ps = ids.map(id => adaptive.mastery(id)); const m = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null; return el('tr', {}, [...r.slice(0, 4).map(c => el('td', { text: String(c) })), el('td', { text: ids.length ? pct(m) : 'not targeted' })]); }))
      ]),
      el('p', { class: 'muted', text: 'Targets: i-Ready reading 396 → 439 typical / 450 stretch; math 372 → 396 / 410. Expect app practice alone to move standardized scores modestly (d ≈ 0.2–0.3 in the literature); daily practice on tier-1 strands with you in the loop is the lever.' })
    ]),
    soundCheckSection(),
    el('section', {}, [
      el('h2', { text: 'Places' }),
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
        el('button', { type: 'button', text: '▶ Test voice', onclick: () => audio.say('Hello! I am the story voice. The cat sat on the mat.') }),
        el('button', { type: 'button', text: '▶ Test a word clip', onclick: () => audio.word('cat') })
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
function kpi(label, value) { return el('div', { class: 'kpi' }, [el('div', { class: 'v', text: String(value) }), el('div', { class: 'l', text: label })]); }

// Sound Check: every phoneme with its current source, play, optional recording, decode demos.
function soundCheckSection() {
  const section = el('section', {}, [el('h2', { text: 'Sound Check (letter sounds)' })]);
  const recorded = store.count('phoneme');
  const bundledCount = SOUNDS.filter(s => ['bundled', 'recorded'].includes(audio.phonemeSource(s.id))).length;
  section.appendChild(el('p', { class: 'muted', text:
    `The app never asks text-to-speech to say a bare letter sound (that is where "buh" comes from). Each sound plays a recorded clip if you made one, otherwise a bundled default. ` +
    `${bundledCount} of ${SOUNDS.length} sounds have a clip; ${recorded} recorded in your voice on this device. ` +
    `Tap ▶ to hear what she hears. If a default sounds wrong, record it: tap Record, say just the sound once, clean and short. Continuants (s, m, f) can be stretched; stops (b, p, t) must be clipped with no "uh". Priority if short on time: a e i o u, then s m f t p n k b d, then sh ch th.` }));
  section.appendChild(el('div', { class: 'row' }, [
    el('button', { type: 'button', text: '▶ Decode demo: cat', onclick: () => audio.decode({ word: 'cat', units: [['c', 'k'], ['a', 'a'], ['t', 't']] }) }),
    el('button', { type: 'button', text: '▶ Decode demo: ship', onclick: () => audio.decode({ word: 'ship', units: [['sh', 'sh'], ['i', 'i'], ['p', 'p']] }) }),
    el('button', { type: 'button', text: '▶ Decode demo: cake', onclick: () => audio.decode({ word: 'cake', units: [['c', 'k'], ['a', 'ae'], ['k', 'k'], ['e', null]] }) }),
    el('button', { type: 'button', text: '■ Stop', onclick: () => audio.stop() })
  ]));
  const grid = el('div', { class: 'kit' });
  section.appendChild(grid);
  const canRecord = store.canRecord();
  for (const s of SOUNDS) {
    const row = el('div', { class: 'snd' });
    const src = el('span', { class: 'src' });
    const refresh = () => { const kind = audio.phonemeSource(s.id); src.textContent = { recorded: '🎙 your voice', bundled: '📦 default', tts: '🤖 tts', none: '⚠ silent' }[kind]; row.className = 'snd ' + kind; };
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
        session = null; recBtn.classList.remove('live'); recBtn.textContent = 'Record';
        if (blob.size < 200) { alert('That recording was empty. Try again.'); return; }
        await store.save('phoneme', s.id, blob);
        delBtn.removeAttribute('disabled'); refresh(); audio.phoneme(s.id);
      } catch (e) { session = null; recBtn.classList.remove('live'); recBtn.textContent = 'Record'; alert('Microphone not available: ' + (e && e.message ? e.message : e)); }
    });
    delBtn.addEventListener('click', async () => { await store.remove('phoneme', s.id); delBtn.setAttribute('disabled', ''); refresh(); });
    row.append(el('span', { class: 'chip', text: s.label }), el('div', { class: 'meta' }, [el('span', { text: s.pic + ' ' + s.word + ' · ' }), src, el('span', { class: 'tip', text: s.tip })]), playBtn, recBtn, delBtn);
    grid.appendChild(row);
  }
  section.appendChild(el('div', { class: 'row' }, [
    el('button', { type: 'button', text: 'Export recordings', onclick: async () => { const blob = new Blob([await store.exportJSON()], { type: 'application/json' }); const a = el('a', { href: URL.createObjectURL(blob), download: 'amelia-sound-kit.json' }); document.body.appendChild(a); a.click(); a.remove(); } }),
    el('label', { class: 'toggle' }, ['Import recordings ', el('input', { type: 'file', accept: 'application/json', onchange: async e => { const f = e.target.files[0]; if (!f) return; try { const n = await store.importJSON(await f.text()); alert('Imported ' + n + ' recordings.'); render(); } catch (err) { alert('Not a sound kit file.'); } } })])
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
  const a = el('a', { href: URL.createObjectURL(blob), download: 'princess-quest-' + economy.today() + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
}
function importSave(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { if (economy.importJSON(t)) { alert('Imported.'); render(); } else alert('That file is not a valid save.'); });
}

async function start() {
  try { SOUNDS = (await content.load('sounds')).sounds; audio.setSounds(Object.fromEntries(SOUNDS.map(s => [s.id, s]))); } catch (e) { console.warn(e); }
  try { audio.setManifest(await content.load('audio-manifest')); } catch (e) { console.warn('no manifest', e); }
  try { SW = await content.load('sight-words'); } catch (e) { console.warn(e); }
  await store.load();
  let unlocked = false;
  try { unlocked = sessionStorage.getItem('arcade.parentOk') === '1'; } catch {}
  if (unlocked) render(); else pinGate();
}
start();
