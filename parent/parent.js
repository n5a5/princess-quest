// parent/parent.js — Parent Corner: is Princess Quest working? Mastery per skill, first-try trend,
// improving / flat / regressing flags, minutes and items per day, next focus, trouble spots, Sound Check,
// settings, export/import. Child-facing screens never show any of this.
// Two kinds of numbers live here and are kept apart on purpose:
//   FORMAL ASSESSMENT RESULTS  — the school's i-Ready and Star reports (typed in below, never computed)
//   APP PRACTICE DATA          — what she did in Princess Quest (Bayesian mastery, first-try rates)
// App mastery is not a Star or i-Ready score and never predicts one.
import { createEconomy } from '../shared/economy.js';
import { createAdaptive, SUBSKILLS, GROUPS, diffDays } from '../shared/adaptive.js';
import { REGISTRY } from '../games/registry.js';
import { el } from '../shared/ui.js';
import { createAudioStore } from '../shared/audiostore.js';
import { createContentLoader } from '../shared/content.js';
import { createSpeech } from '../shared/speech.js';
import { createAudio, createWebAudioPlayer } from '../shared/audio.js';
import { mouthSVG } from '../shared/mouths.js';

const economy = createEconomy({ storage: localStorage, onSaveError: () => alert('This device could not store the save (storage full or blocked). Use Export now to keep a copy.') });
const adaptive = createAdaptive({ economy });
const store = createAudioStore();
const content = createContentLoader({ base: '../content/' });
const speech = createSpeech({ settings: economy.save.settings, onChange: () => economy.persist() });
const player = createWebAudioPlayer();
const audio = createAudio({ speech, store, player, manifest: null, sounds: {}, settings: economy.save.settings, base: '../assets/audio/' });
const app = document.getElementById('app');
let SOUNDS = [], SW = null, AUDITION = null;

// Fall 2026 formal results, typed from the school reports (i-Ready Inform 1, Aug 18/20; Star, Aug 25 / Sep 1).
// Strand → the app skills that practise it. 'read' is the plain-language interpretation used to set tiers.
const FORMAL = {
  reading: { overall: 'i-Ready 396 (Mid K), 94th percentile · Star Early Literacy 777, Level 2, 91st percentile' },
  math: { overall: 'i-Ready 372 (Early K), 93rd percentile · Star Math 799, Level 3, 92nd percentile' }
};
const BASELINE = [
  ['Phonics / word analysis', 'Emerging K', '70', 'weak, both agree', ['phonics-gpc', 'phonics-encode', 'phonics-decode', 'decodable-reading']],
  ['High-frequency words', 'Emerging K', '—', 'weak', ['sight-words']],
  ['Phonological awareness', 'Early/Mid K', '69', 'weak', ['pa-sounds', 'pa-blend-segment', 'pa-manipulate', 'pa-rhyme']],
  ['Number sense', 'Early K', '59', 'weak', ['subitize-tenframe', 'number-relations', 'teen-compare']],
  ['Number operations', 'Early K', '57', 'weak', ['add-sub', 'decompose-stories']],
  ['Measurement & data', 'Emerging K', '66', 'weak, both agree', ['measure', 'data-sort']],
  ['Algebraic thinking / patterns', 'Mid K', '50', 'weak on Star only', ['patterns', 'decompose-stories']],
  ['Counting & cardinality', '—', '78', 'fine', ['count-sequence', 'number-relations']],
  ['Geometry', 'Mid K', '67', 'fine', ['shapes']],
  ['Vocabulary', 'Mid/Late K', '61', 'mixed, light touch', ['comprehension']],
  ['Comprehension (lit / info)', 'Mid/Late K', '82 / 82 (prose & poetry 56)', 'strong, keep warm', ['comprehension']],
  ['Print concepts / fluency', '—', '86 / 83', 'strong', []]
];
const LEVEL_WORD = { emerging: 'Emerging', learning: 'Learning', known: 'Known', mastered: 'Mastered' };

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
    const rows = economy.save.log.filter(r => r.subskill === id && !(r.choices < 2) && diffDays(r.day, today) === i); // introductions and self-checks are not answers
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
  const stops = adaptive.planStops(ready);
  if (!stops.length) return 'Play any place.';
  return stops.map(st => {
    const def = SUBSKILLS.find(s => s.id === st.subskill);
    const place = REGISTRY.find(r => r.id === st.cabinet);
    if (!def) return place ? place.name : st.cabinet;
    const ds = adaptive.daysSince(def.id);
    return `${place ? place.name : st.cabinet} — ${def.name} (${LEVEL_WORD[adaptive.level(def.id)]}, mastery ${pct(adaptive.mastery(def.id))}${ds === null ? ', not practised yet' : ds > 1 ? ', ' + ds + ' days since practice' : ''})`;
  }).join('; then ') + '.';
}
function weakStrong() {
  const practised = SUBSKILLS.filter(d => adaptive.accuracy(d.id) !== null);
  if (practised.length < 3) return { weak: [], strong: [] };
  const byP = [...practised].sort((a, b) => adaptive.mastery(a.id) - adaptive.mastery(b.id));
  return { weak: byP.slice(0, 3), strong: byP.slice(-3).reverse().filter(d => adaptive.mastery(d.id) >= 0.6) };
}

// Two-minute, screen-free games a parent can play tonight, one per skill. Adult involvement was the biggest
// factor in the GraphoGame studies; this turns the dashboard into something to do, not just read.
const TONIGHT = {
  'phonics-gpc': 'Letter hunt: say a sound like /m/; she finds that letter on a cereal box or a book cover.',
  'phonics-encode': 'Say a short word from today (cat, ship, jam). She spells it with magnets or on paper, one sound at a time.',
  'phonics-decode': 'Write three short words. She slides a finger under each letter, says the sounds, then says the word.',
  'decodable-reading': 'Write one short sentence (The cat is in the hat). She reads it, pointing to each word.',
  'pa-sounds': 'I spy with sounds: "I spy something that starts with /m/." Take turns.',
  'pa-blend-segment': 'Robot talk: say a word in pieces, /d/ /o/ /g/, and she says the word. Then she is the robot.',
  'pa-manipulate': 'Silly swaps: "Say cat. Now change /k/ to /h/. What is it?" (hat). Take turns making up swaps.',
  'pa-rhyme': 'Rhyme chain: cat, hat, bat, sat... keep going until someone gets stuck. Clap the beats in her name too.',
  'sight-words': 'Hide three wish-word cards (the, said, was) around the room. She reads each one she finds.',
  'subitize-tenframe': 'Quick peek: show fingers or dots for one second. She says how many without counting.',
  'number-relations': 'Snack math: she counts out exactly 7 grapes. Then one more? Then one less?',
  'teen-compare': 'Make 14 with a group of ten crayons and 4 more. Which is more, 14 or 17?',
  'add-sub': 'Toy stories: 3 cars are in the garage and 2 drive in. How many now? Act it out.',
  'decompose-stories': 'Hide some of 7 coins under a cup. She works out how many are hiding.',
  'count-sequence': 'Count the stairs going up, then count back down. Start counting from 13 sometimes.',
  'measure': 'Which is longer, a spoon or a fork? Line them up to check. Which is heavier, a shoe or a sock?',
  'data-sort': 'Sort the socks by color, count each pile, and ask which pile has the most.',
  'patterns': 'Make a pattern with spoons and forks (spoon, fork, spoon, fork). She says what comes next.',
  'shapes': 'Shape hunt: find three circles and three rectangles in the kitchen.',
  'comprehension': 'Read a picture book together. Ask who was in it, where it happened, and how someone felt.'
};
function tonightCard() {
  const practised = SUBSKILLS.filter(d => adaptive.accuracy(d.id) !== null && d.tier <= 2);
  const pool = practised.length ? practised : SUBSKILLS.filter(d => d.tier === 1);
  const d = [...pool].sort((x, y) => adaptive.mastery(x.id) - adaptive.mastery(y.id))[0];
  return d ? d.name + ': ' + TONIGHT[d.id] : 'Read a picture book together.';
}
function tonightLine() {
  const trouble = adaptive.troubleList(2).slice(0, 3);
  if (!trouble.length) return 'Nothing is stuck. Ask her to read you three wish words from the well.';
  const pretty = id => {
    const [kind, ...rest] = id.split(':');
    const r = rest.join(' ');
    return ({ spell: 'building the word "' + r + '"', read: 'reading the word "' + r + '"', heartap: 'the wish word "' + r + '"', note: 'finding "' + r.split(' ')[0] + '" in a sentence', scroll: 'reading a sentence', 'gpc-hear': 'hearing the sound of "' + r + '"', 'gpc-see': 'the sound of the letter "' + r + '"', swap: 'changing ' + r.replace('>', ' into '), oralswap: 'hearing ' + r.replace('>', ' change to '), takeaway: 'taking a sound off ' + r.split('>')[0], rhyme: 'a rhyme for ' + r.split('>')[0], beats: 'clapping the beats in ' + r, onsetrime: 'putting together ' + r, 'pa-first': 'the first sound in ' + r, 'pa-final': 'the last sound in ' + r, 'pa-medial': 'the middle sound in ' + r, blend: 'blending ' + r, count: 'counting sounds in ' + r, teen: 'teen number ' + r.replace('teens ', ''), bridge: 'the sum ' + r, frames: 'seeing ' + r.replace(/\w+ /, '') + ' gems quickly', trail: r.startsWith('onemore') ? 'one more or one less' : r.startsWith('countout') ? 'counting out ' + r.replace('countout ', '') + ' gems' : 'putting numbers in order', story: 'the story questions', vocab: 'the story word', measure: 'measuring (' + r + ')', sort: 'sorting', pattern: 'the ' + r.split(' ')[0] + ' pattern', shape: 'the ' + r.replace(/\w+ /, '') + ' shape' })[kind] || id;
  };
  const items = trouble.map(t => pretty(t.id)).join('; ');
  return `Two minutes tonight: revisit ${items}. Say it, let her find it, then let her teach it to you.`;
}

function render() {
  const s = economy.save;
  const today = economy.today();
  const sw = SW ? Object.entries(s.sightWords).filter(([, v]) => v.introducedDay) : [];
  const mastered = sw.filter(([, v]) => v.box >= 5 && v.firstTryDays.length >= 3).length;
  app.replaceChildren(
    weekSection(),
    focusSection(),
    el('section', {}, [
      el('h2', { text: 'Is it working?' }),
      el('div', { class: 'kpis' }, [
        kpi('Days played (14d)', daysPlayed(14)), kpi('Items (7d)', itemsInDays(7)), kpi('Minutes (7d, est.)', minutesEstimate(7)),
        kpi('Wish words known', sw.length), kpi('Wish words mastered', mastered), kpi('Squishies freed', s.squishies.rescued.length), kpi('Luna stars', s.companion.stars), kpi('Gems', s.gems)
      ]),
      el('p', {}, [el('strong', { text: 'Tomorrow\'s trail (planner): ' }), nextFocus()]),
      (() => { const { weak, strong } = weakStrong(); return weak.length ? el('p', {}, [el('strong', { text: 'Weakest in the app right now: ' }), weak.map(d => d.name).join(', '), el('span', { text: '. ' }), el('strong', { text: 'Strongest: ' }), strong.length ? strong.map(d => d.name).join(', ') : 'nothing above 60% yet', el('span', { text: '.' })]) : el('p', { class: 'muted', text: 'Weak and strong areas appear after a few days of play.' }); })(),
      el('p', {}, [el('strong', { text: 'Tonight, two minutes, no screen: ' }), tonightCard()]),
      el('p', {}, [el('strong', { text: 'Things she missed more than once: ' }), tonightLine()]),
      el('p', { class: 'muted', text: 'The evidence says adult participation is the biggest lever for app-based phonics (McTigue et al. 2020). Two minutes counts.' })
    ]),
    el('section', {}, [
      el('h2', { text: 'Skills' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Skill', 'Place', 'Priority', 'Level', 'Stage', 'Mastery', 'First-try (20)', 'Trend', '14 days', 'Today', 'Last'].map(h => el('th', { text: h })))]),
        el('tbody', {}, SUBSKILLS.map(d => {
          const ds = adaptive.daysSince(d.id);
          const t = adaptive.trend(d.id);
          const place = REGISTRY.find(r => r.id === d.cabinet);
          return el('tr', { class: (d.tier === 1 ? 'tier1 ' : '') + (adaptive.needsReteach(d.id) ? 'reteach' : '') }, [
            el('td', {}, [d.name + ' ', el('span', { class: 'muted', text: d.strand })]),
            el('td', { text: place ? place.name.replace(/^(Unicorn|Whisper|Wishing|Crystal|Rainbow|Story) /, '') : d.cabinet }),
            el('td', { text: d.tier === 1 ? 'focus' : d.tier === 2 ? 'secondary' : 'strength' }),
            el('td', { text: adaptive.accuracy(d.id) === null ? '—' : LEVEL_WORD[adaptive.level(d.id)] }),
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
      el('p', { class: 'muted', text: 'APP PRACTICE DATA. Mastery is a Bayesian estimate that a skill is known (first-try answers count fully, answers after a hint count half, revealed answers count against). Level: Emerging under 40%, Learning 40–85%, Known above 85%, Mastered = Known at the last stage. A stage advances at 85% mastery with six first-try items on two different days; nothing ever demotes. Rows in rose need re-teaching; the planner already sends more review there. Priority comes from the school assessments below: focus skills get three times the planner weight of strengths.' }),
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
      el('h2', { text: 'FORMAL ASSESSMENT RESULTS (school, Fall 2026) and the app skills that practise each strand' }),
      el('p', {}, [el('strong', { text: 'Reading: ' }), FORMAL.reading.overall, el('br'), el('strong', { text: 'Math: ' }), FORMAL.math.overall]),
      el('p', { class: 'muted', text: 'These numbers come from the school reports and never change inside the app. Star strand scores are model-based estimates tied to one overall score; i-Ready K domain placements rest on few items. The app treats them as a hypothesis its own practice data checks. App mastery (last column) is practice data, not a Star or i-Ready score, and does not predict one.' }),
      el('table', {}, [
        el('thead', {}, [el('tr', {}, ['Strand', 'i-Ready', 'Star (0–100)', 'Read as', 'App skills', 'App mastery now'].map(h => el('th', { text: h })))]),
        el('tbody', {}, BASELINE.map(r => { const ids = r[4]; const ps = ids.map(id => adaptive.mastery(id)); const m = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null; return el('tr', {}, [...r.slice(0, 4).map(c => el('td', { text: String(c) })), el('td', { class: 'muted', text: ids.map(id => (SUBSKILLS.find(s => s.id === id) || {}).name || id).join(', ') || '—' }), el('td', { text: ids.length ? pct(m) : 'not targeted' })]); }))
      ]),
      el('p', { class: 'muted', text: 'School growth targets: i-Ready reading 396 → 439 typical / 450 stretch; math 372 → 396 / 410; Star reading from Level 2 to Level 3 (benchmark near 800). App practice alone moves standardized scores modestly (d ≈ 0.2–0.3 in the literature); a daily ten minutes on the focus strands with you in the loop is the lever. The daily quest is a two-stop trail, one reading stop and one math stop, chosen from the weakest focus skills.' })
    ]),
    voiceSection(),
    soundCheckSection(),
    audioCheckSection(),
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
        el('label', { text: 'PIN ' }), el('input', { id: 'pin', type: 'password', value: '', placeholder: 'new PIN', maxlength: '4', inputmode: 'numeric', autocomplete: 'off' }),
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
        el('button', { type: 'button', text: 'Share progress to another device', onclick: shareSave }),
        el('button', { type: 'button', text: 'Export progress JSON', onclick: exportSave }),
        el('label', { class: 'toggle' }, ['Combine progress from another device ', el('input', { type: 'file', accept: 'application/json,.json', onchange: mergeSave })]),
        el('label', { class: 'toggle' }, ['Replace with a saved file ', el('input', { type: 'file', accept: 'application/json,.json', onchange: importSave })]),
        el('button', { type: 'button', class: 'danger', text: 'Reset all progress', onclick: () => { if (confirm('Reset ALL progress? This cannot be undone.')) { economy.reset(); render(); } } })
      ]),
      el('p', { class: 'muted', text: 'Each device keeps its own progress. To play on both the phone and the Chromebook: on one device tap Share progress (or Export) and send the file to the other device, for example with Nearby Share, Google Drive or email to yourself. On the other device choose Combine progress and pick the file. Combining keeps the further-along progress for every skill and word, never double counts, and is safe to repeat; this device keeps its own name, PIN and settings. Replace overwrites everything on this device. Recorded sounds have their own export in Sound Check.' })
    ])
  );
}
// This week on one screen: time, days, what she practised, what moved up, and what comes next.
// Focus this week: the parent picks a sound and some wish words; for seven days the planner leans on them
// (more of that letter stone and its words in the Meadow, that sound as the target in the Woods, those
// words first in the Well) without switching anything else off.
function focusSection() {
  const s = economy.save;
  const section = el('section', {}, [el('h2', { text: 'Focus this week' })]);
  const active = adaptive.focus();
  const soundName = id => { const x = SOUNDS.find(z => z.id === id); return x ? x.label + ' (' + x.word + ')' : id; };
  if (active) {
    const parts = [];
    if (active.sound) parts.push('the sound ' + soundName(active.sound));
    if (active.words.length) parts.push(active.words.length + ' wish words: ' + active.words.join(', '));
    section.append(
      el('p', {}, [el('strong', { text: 'Focusing on ' + parts.join(' and ') + ' until ' + active.until + '.' })]),
      el('p', { class: 'muted', text: 'Letter Sounds and Whisper Woods draw this sound in almost half their items, Word Spell, Letter Stones and Sound Swap prefer its words, and the focus wish words are introduced and practised first. The planner also sends the trail to those skills more often.' }),
      el('button', { type: 'button', text: 'Stop the focus', onclick: () => { adaptive.clearFocus(); render(); } })
    );
    return section;
  }
  const sel = el('select', {}, [el('option', { value: '', text: 'no sound' }), ...SOUNDS.map(x => el('option', { value: x.id, text: x.label + ' as in ' + x.word }))]);
  const chips = el('div', { class: 'row', style: 'justify-content:flex-start;flex-wrap:wrap;gap:6px' });
  const picked = new Set();
  const allWords = SW ? [...SW.lists.prePrimer, ...SW.lists.primer] : [];
  const refreshChips = () => {
    const snd = SOUNDS.find(x => x.id === sel.value);
    const hits = snd ? allWords.filter(w => w.includes(snd.label)) : [];
    picked.clear(); hits.forEach(w => picked.add(w));
    chips.replaceChildren(...allWords.map(w => {
      const b = el('button', { type: 'button', class: 'chip-toggle' + (picked.has(w) ? ' on' : ''), text: w });
      b.addEventListener('click', () => { if (picked.has(w)) picked.delete(w); else picked.add(w); b.classList.toggle('on', picked.has(w)); });
      return b;
    }));
  };
  sel.addEventListener('change', refreshChips);
  refreshChips();
  section.append(
    el('p', { class: 'muted', text: 'Pick a sound she is finding hard, and any wish words to bring forward. For seven days the app leans on them: that letter stone and its words come up far more often, the Woods listen for that sound, and those wish words are introduced and practised first. Picking a sound pre-selects the wish words spelled with it; tap words to add or remove them.' }),
    el('div', { class: 'row', style: 'justify-content:flex-start' }, [el('label', { text: 'Sound ' }), sel]),
    chips,
    el('div', { class: 'row', style: 'justify-content:flex-start' }, [el('button', { type: 'button', text: 'Start a 7-day focus', onclick: () => { adaptive.setFocus({ sound: sel.value || null, words: [...picked] }); render(); } })])
  );
  return section;
}
function weekSection() {
  const today = economy.today();
  const rows = economy.save.log.filter(r => !r.review && !(r.choices < 2));
  const inWeek = (r, a, b) => { const d = diffDays(r.day, today); return d >= a && d < b; };
  const week = rows.filter(r => inWeek(r, 0, 7)), prev = rows.filter(r => inWeek(r, 7, 14));
  const rate = xs => xs.length ? Math.round(100 * xs.filter(r => r.ok).length / xs.length) + '%' : '—';
  const days = new Set(economy.save.log.filter(r => diffDays(r.day, today) < 7).map(r => r.day)).size;
  const minutes = Math.round(economy.save.log.filter(r => diffDays(r.day, today) < 7).length * 0.5);
  const bySkill = SUBSKILLS.map(d => {
    const w = week.filter(r => r.subskill === d.id);
    const stages = economy.save.log.filter(r => r.subskill === d.id && diffDays(r.day, today) < 7 && typeof r.stage === 'number').map(r => r.stage);
    const before = economy.save.log.filter(r => r.subskill === d.id && diffDays(r.day, today) >= 7 && typeof r.stage === 'number').map(r => r.stage);
    const movedUp = stages.length && Math.max(...stages) > (before.length ? Math.max(...before) : Math.min(...stages));
    return { d, n: w.length, rate: rate(w), movedUp };
  }).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const moved = bySkill.filter(x => x.movedUp).map(x => x.d.name);
  return el('section', {}, [
    el('h2', { text: 'This week' }),
    el('div', { class: 'kpis' }, [kpi('Days played', days), kpi('Minutes (est.)', minutes), kpi('First try, this week', rate(week)), kpi('First try, week before', rate(prev))]),
    el('p', {}, [el('strong', { text: 'Moved up a level: ' }), moved.length ? moved.join(', ') : 'nothing yet this week (levels move after two good days)']),
    bySkill.length ? el('table', {}, [
      el('thead', {}, [el('tr', {}, ['Practised', 'Items', 'First try'].map(h => el('th', { text: h })))]),
      el('tbody', {}, bySkill.map(x => el('tr', {}, [el('td', { text: x.d.name + (x.movedUp ? ' ⬆' : '') }), el('td', { text: String(x.n) }), el('td', { text: x.rate })])))
    ]) : el('p', { class: 'muted', text: 'No practice yet this week.' }),
    el('p', {}, [el('strong', { text: 'Next: ' }), nextFocus()]),
    el('p', { class: 'muted', text: 'App practice data only. First try = answered right without a hint. Minutes are estimated at about 30 seconds per item.' })
  ]);
}
function kpi(label, value) { return el('div', { class: 'kpi' }, [el('div', { class: 'v', text: String(value) }), el('div', { class: 'l', text: label })]); }

// Voice audition: the same words, instructions and story in each shortlisted voice. Choosing Heart turns
// on the story voice right away (it is the voice already recorded for every word, letter sound and fixed
// line). Any other pick is saved and shown here; switching to it needs the app's audio re-rendered.
function voiceSection() {
  const s = economy.save;
  const section = el('section', {}, [el('h2', { text: 'Voice' })]);
  const now = s.settings.voice === 'luna' ? 'Story voice (Heart): words, letter sounds, stories, praise and fixed instructions all use one recorded voice. A line the story voice cannot build from its recordings uses the device voice for that whole line.' : 'Device voice: words and letter sounds use the recorded Heart voice; instructions and stories use this device\'s text-to-speech, which sounds different on a Chromebook, a phone and a PC.';
  section.appendChild(el('p', { text: 'Now: ' + now }));
  section.appendChild(el('div', { class: 'row' }, [
    el('button', { type: 'button', text: s.settings.voice === 'luna' ? '✓ Story voice on' : 'Use the story voice (Heart)', onclick: () => { s.settings.voice = 'luna'; s.settings.voicePick = 'af_heart'; economy.persist(); render(); } }),
    el('button', { type: 'button', text: s.settings.voice === 'luna' ? 'Back to the device voice' : '✓ Device voice on', onclick: () => { s.settings.voice = 'device'; economy.persist(); render(); } })
  ]));
  if (!AUDITION) return section;
  section.appendChild(el('p', { class: 'muted', text: 'Listen and compare. Every voice below says the same ten words, ten instructions and a short story. All run offline once chosen. Pick the one you want Amelia to hear. The samples load from the internet the first time (they are not part of the offline install).' + (s.settings.voicePick ? ' Your pick: ' + (AUDITION.voices.find(v => v.id === s.settings.voicePick) || { label: s.settings.voicePick }).label + '.' : '') }));
  const grid = el('div', { class: 'audition' });
  const play = async (vid, idx) => { audio.stop(); for (const n of idx) { const ok = await player.play('../assets/audio/audition/' + vid + '/' + n + '.ogg'); if (ok !== true) break; await new Promise(r => setTimeout(r, 250)); } };
  const words = AUDITION.items.map((it, n) => it.kind === 'word' ? n : -1).filter(n => n >= 0);
  const lines = AUDITION.items.map((it, n) => it.kind === 'line' ? n : -1).filter(n => n >= 0);
  const story = AUDITION.items.map((it, n) => it.kind === 'story' ? n : -1).filter(n => n >= 0);
  for (const v of AUDITION.voices) {
    const picked = s.settings.voicePick === v.id;
    grid.appendChild(el('div', { class: 'voice' + (picked ? ' picked' : '') }, [
      el('div', {}, [el('strong', { text: v.label }), el('span', { class: 'muted', text: ' · ' + v.license })]),
      el('div', { class: 'muted', text: v.note }),
      el('div', { class: 'row' }, [
        el('button', { type: 'button', text: '▶ Words', onclick: () => play(v.id, words) }),
        el('button', { type: 'button', text: '▶ Instructions', onclick: () => play(v.id, lines) }),
        el('button', { type: 'button', text: '▶ Story', onclick: () => play(v.id, story) }),
        el('button', { type: 'button', text: picked ? '✓ Picked' : 'Pick this voice', onclick: () => {
          s.settings.voicePick = v.id;
          if (v.id === 'af_heart') s.settings.voice = 'luna';
          economy.persist(); render();
          if (v.id !== 'af_heart') alert(v.label + ' is saved as your pick. The recorded audio is still in the Heart voice; switching every word, letter sound and line to ' + v.label + ' needs the audio rebuilt with tools/build-*.py --voice ' + v.id + '.');
        } })
      ])
    ]));
  }
  grid.appendChild(el('div', { class: 'voice' }, [
    el('div', {}, [el('strong', { text: 'This device\'s voice' }), el('span', { class: 'muted', text: ' · built in' })]),
    el('div', { class: 'muted', text: 'What the app uses for instructions now. Different on every device.' }),
    el('div', { class: 'row' }, [
      el('button', { type: 'button', text: '▶ Instructions', onclick: async () => { audio.stop(); for (const n of lines) { await speech.speakText(AUDITION.items[n].text); } } }),
      el('button', { type: 'button', text: '▶ Story', onclick: () => { audio.stop(); speech.speakText(AUDITION.items[story[0]].text); } })
    ])
  ]));
  section.appendChild(grid);
  section.appendChild(el('button', { type: 'button', text: '■ Stop', onclick: () => { audio.stop(); player.stop(); } }));
  return section;
}

// Audio check: a troubleshooting report for a device where letter sounds are silent or click.
// Plays every letter sound in turn and lists what the browser reports, so a parent can copy it and send it.
function audioCheckSection() {
  const out = el('pre', { class: 'muted', style: 'white-space:pre-wrap;font-size:12px;max-height:320px;overflow:auto' });
  const run = async () => {
    audio.stop();
    const lines = [];
    const log = t => { lines.push(t); out.textContent = lines.join(String.fromCharCode(10)); };
    if (player.unlock) player.unlock();
    await new Promise(r => setTimeout(r, 300));
    const inf = player.info ? player.info() : {};
    log('Device: ' + navigator.userAgent);
    log('Audio engine: ' + JSON.stringify(inf));
    log('Muted in app: ' + (economy.save.settings.muted ? 'yes (turn sound on to hear)' : 'no'));
    let ok = 0;
    for (const s of SOUNDS) {
      const src = audio.phonemeSource(s.id);
      const url = audio.phonemeSrc(s.id);
      const probe = url && player.probe ? await player.probe(url) : { ok: false, error: 'no clip' };
      if (probe.ok) ok++;
      log(`/${s.id}/  source=${src}  ${probe.ok ? 'decoded ' + (probe.ms ?? '?') + ' ms' : 'FAILED ' + probe.error}`);
      await audio.phoneme(s.id);
      await new Promise(r => setTimeout(r, 250));
    }
    log(`${ok} of ${SOUNDS.length} letter sounds decoded.`);
    const after = player.info ? player.info() : {};
    log('Audio engine after: ' + JSON.stringify(after));
  };
  return el('section', {}, [
    el('h2', { text: 'Audio check (troubleshooting)' }),
    el('p', { class: 'muted', text: 'If letter sounds are silent or only click on this device, tap Run. Each letter sound plays in turn. Then tap Copy and send the report.' }),
    el('div', { class: 'row' }, [
      el('button', { type: 'button', text: '▶ Run audio check', onclick: run }),
      el('button', { type: 'button', text: '■ Stop', onclick: () => audio.stop() }),
      el('button', { type: 'button', text: 'Copy report', onclick: async () => { try { await navigator.clipboard.writeText(out.textContent); alert('Copied.'); } catch { alert('Select the text and copy it by hand.'); } } })
    ]),
    out
  ]);
}

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
    const mouth = mouthSVG(s.id);
    row.append(el('span', { class: 'chip', text: s.label }), mouth ? el('span', { class: 'mouth-small', html: mouth }) : el('span'), el('div', { class: 'meta' }, [el('span', { text: s.pic + ' ' + s.word + ' · ' }), src, el('span', { class: 'tip', text: s.tip })]), playBtn, recBtn, delBtn);
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
async function shareSave() {
  const name = 'princess-quest-' + economy.today() + '.json';
  const file = new File([economy.exportJSON()], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Princess Quest progress' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  exportSave();
}
function mergeSave(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const r = economy.mergeJSON(t); if (r === true) { alert('Combined. This device now has the progress from both.'); render(); } else if (r === 'full') alert('Combined, but this device could not store the result. Export a copy now.'); else alert('That file is not a Princess Quest save.'); });
}
function importSave(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { if (economy.importJSON(t)) { alert('Imported.'); render(); } else alert('That file is not a valid save.'); });
}

async function start() {
  try { SOUNDS = (await content.load('sounds')).sounds; audio.setSounds(Object.fromEntries(SOUNDS.map(s => [s.id, s]))); } catch (e) { console.warn(e); }
  try { audio.setManifest(await content.load('audio-manifest')); } catch (e) { console.warn('no manifest', e); }
  try { audio.setLines(await content.load('lines-audio')); } catch (e) { console.warn('no lines', e); }
  try { AUDITION = await content.load('audition'); } catch (e) { AUDITION = null; }
  try { SW = await content.load('sight-words'); } catch (e) { console.warn(e); }
  await store.load();
  let unlocked = false;
  // The PIN pad on the map leaves a one-time pass (a timestamp). It is used up here, so Back then Forward,
  // or reopening the tab later, asks for the PIN again.
  try {
    const t = Number(sessionStorage.getItem('arcade.parentOk'));
    sessionStorage.removeItem('arcade.parentOk');
    unlocked = t > 0 && Date.now() - t < 15000;
  } catch {}
  if (unlocked) render(); else pinGate();
}
// Restored from the back/forward cache: lock again.
window.addEventListener('pageshow', e => { if (e.persisted) pinGate(); });
start();
