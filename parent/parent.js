// parent/parent.js — PIN-gated dashboard skeleton: per-sub-skill table, baseline, settings, export/import.
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS } from '../shared/adaptive.js';
import { REGISTRY } from '../games/registry.js';
import { el } from '../shared/ui.js';

const economy = createEconomy({ storage: localStorage });
const adaptive = createAdaptive({ economy });
const app = document.getElementById('app');

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
          [['0.8', 'Slower'], ['0.9', 'Normal'], ['1', 'Quicker']].map(([v, t]) => el('option', { value: v, text: t, ...(String(s.settings.rate) === v ? { selected: '' } : {}) })))
      ])
    ]),
    el('section', {}, [
      el('h2', { text: 'Save data' }),
      el('div', { class: 'row' }, [
        el('button', { type: 'button', text: 'Export JSON', onclick: exportSave }),
        el('label', { class: 'toggle' }, ['Import JSON ', el('input', { type: 'file', accept: 'application/json', onchange: importSave })]),
        el('button', { type: 'button', class: 'danger', text: 'Reset all progress', onclick: () => { if (confirm('Reset ALL progress? This cannot be undone.')) { economy.reset(); render(); } } })
      ]),
      el('p', { class: 'muted', text: 'Devices do not sync. Use export/import to move progress between phone, tablet, and PC.' })
    ])
  );
}

function voiceSelect() {
  const s = economy.save;
  const sel = el('select', { onchange: e => { s.settings.voiceName = e.target.value; economy.persist(); } });
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

// The shell already checked the PIN; skip the gate when it hands us the session flag.
let unlocked = false;
try { unlocked = sessionStorage.getItem('arcade.parentOk') === '1'; } catch {}
if (unlocked) render(); else pinGate();
