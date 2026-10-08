// games/princess-quest/stage.js — Star Stage: the audition trainer for the Annie audition (Broadway at the J,
// grades K–5, Wed 10/14/2026). Amelia is six and cannot read yet, so everything is by ear, with a picture for each
// chunk, and every instruction is spoken.
//   My Line / My Song: from the second practice she first tries it from memory; then she hears it whole; then
//     backward chaining (the last chunk first, then the last two, up to the whole; she says each back); one
//     acting cue; the song is sung along with the orphans (the cast recording, if loaded); then all of it by
//     herself, with the pictures, faded pictures, or the curtain as her practice count grows. Her take plays
//     back, then the model.
//   Hear the orphans: the whole number from the cast recording a grown-up loaded in Parent Corner (kept on the
//     device only; the app and its public site never contain it). Offline, no ads, nothing that leaves the app.
//   Audition time!: a brave breath, then the real order (say hi, the line, the song, thank you) with no
//     coaching in between, applause, and her whole audition played back.
//   Try another line: the other seven lines from the audition sheet, heard and echoed chunk by chunk (the sheet
//     says she may be asked to try another). Nothing to memorise.
//   Audition day warm-up: on the day, only a short warm-up.
// The daily plan (shared/stage-plan.js dailyPlan) decides which tile glows; Luna says which one.
// Whose turn it is always shows: Luna's (an ear, Luna bobbing, each picture lighting up as Luna says it) or hers
// (a red microphone after a chime; a soft reminder after 3 s of quiet). The flow is hands-free: the pictures are
// not buttons, and the screen is kept awake while it runs.
// The microphone opens only for her turn and only listens for her voice: when she starts and stops, and how
// loud she is. Feedback is about effort and loudness, never about the words or the pitch. A big voice lights the
// star, measured against her own warm-up shout, so it works on any device.
// Model clips: assets/audio/stage/ (tools/build-stage-audio.py, durations in content/stage-audio.json). Her
// latest takes, and her first ones, are kept in the audio store (kind 'stage') for Parent Corner.
// EVIDENCE (filled in from verified sources only)
import { el, wait, pick, bigButton, sheet, confetti, toast } from '../../shared/ui.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';
import { flyGems } from '../../shared/encounter.js';
import { canListen, openMic } from '../../shared/mic.js';
import { createSongPlayer } from '../../shared/songclip.js';
import { clipId, chainSteps, daysUntil, logPractice, bigVoiceThreshold, followTimes, dayStrip, dailyPlan, cueLevel } from '../../shared/stage-plan.js';

let host = null, ctx = null, S = null, DUR = {};
let run = null;     // the activity in progress, { live, noMic }; Back, Home or leaving the place turns it off
// This visit (reset in mount): her warm-up shout (the bar for a big voice), the room's quiet level, and whether
// the microphone may be used at all (no device, or permission refused).
let refDb = null, roomDb = null, micOK = true;
let deaf = 0;       // turns in a row in this activity where the microphone heard nothing
let wake = null;    // screen wake lock while an activity runs (it is hands-free for minutes at a time)
let song = null;    // the cast recording from Parent Corner (shared/songclip.js), or null
let idle = null, menuToken = 0; // the re-prompt when nothing is tapped for a while
const CHIME_MS = 350;  // the chime is over before recording starts, so it is never in her take or taken for her
const NUDGE_MS = 3000; // her turn, no voice yet: a soft reminder (never more than 3 s of silence without a cue)
const IDLE_MS = 8000;  // a button waiting: Luna says it again

const THANKS = { id: 'thanks', chunks: [{ text: 'Thank you!', pic: '🙇' }] };
const BIG = ['Big stage voice!', 'Wow, the back row heard you!', 'Loud and clear. Bravo!'];
const MORE = ['Good! Now even bigger!', 'Nice! Use your big stage voice!'];
const NOMIC = ['Great job!', 'Wonderful!'];
const ICON = { hear: '🎧', line: '🗣️', song: '🎵', audition: '⭐', dayof: '🌟', other: '🎭' };
// what Luna says on the menu about the glowing button (she cannot read the labels)
const HINT = {
  hear: 'First, listen to the orphans sing. Tap the glowing button!',
  line: 'Tap the glowing button to practice your line!',
  song: 'Tap the glowing button to practice your song!',
  audition: 'Tap the glowing button for audition time!',
  dayof: 'Tap the glowing button to get ready for your audition!',
  none: 'You did everything today. Bravo!',
  free: 'Pick anything you like!'
};

const say = t => ctx.audio.say(t, { story: true }); // Luna's own voice, the one that models the line
const sfx = () => ctx.audio.sfx || { sparkle() {}, yay() {}, ding() {}, applause() {} };
const named = t => t.replace(/\{name\}/g, ctx.economy.save.child.name);
const stage = () => ctx.economy.save.stage;
const alive = r => !!r && r === run && r.live;
const piece = id => S.pieces.find(p => p.id === id);
const blockText = (b, i, j) => named(b.chunks.slice(i, j).map(c => c.say || c.text).join(' '));
const estimateMs = text => 3000 + text.split(/\s+/).length * 900;
const clearOverlays = () => document.querySelectorAll('.overlay').forEach(o => o.remove());

// Tests only (?debug=1 exposes window.__pq): what is happening right now, so a test can measure how long each
// activity takes and the longest stretch with nothing to hear and nothing to do.
let probe = null;
const mark = state => { if (probe) { probe.state = state; probe.events.push([Date.now(), state]); } };

function begin() {
  stopRun();
  const r = { live: true, noMic: false };
  run = r; deaf = 0;
  ctx.nav && ctx.nav.push(() => { stopRun(); clearOverlays(); showMenu(); });
  keepAwake();
  mark('run');
  return r;
}
function stopRun() {
  if (run) run.live = false;
  run = null;
  stopIdle();
  if (ctx) ctx.audio.stop();
  if (song) song.stop();
  if (probe) probe.song = false;
  if (wake) { wake.release().catch(() => {}); wake = null; }
}
function leave() { stopRun(); clearOverlays(); ctx.nav && ctx.nav.pop(); showMenu(); }
async function keepAwake() {
  try { if (navigator.wakeLock && !wake) wake = await navigator.wakeLock.request('screen'); } catch { wake = null; }
}
// Home button, app switch or screen off in the middle of an activity: stop (no recording in the background)
// and wait on the menu.
function onVisibility() { if (document.hidden && run) leave(); }
function stopIdle() { clearTimeout(idle); idle = null; }
function idleNudge(text) { stopIdle(); idle = setTimeout(() => { idle = null; if (host) say(text); }, IDLE_MS); }

function micGone(e) {
  micOK = false;
  console.warn('mic', e);
  toast('🎤 Ask a grown-up to allow the microphone.', 5000);
  return say('Ask a grown-up to turn on the microphone.');
}

// The room's quiet level, read once at the start of an activity while nothing plays. The first time ever, this
// is also where the browser asks for the microphone (Parent Corner's microphone test asks first).
async function readRoom(r) {
  if (!micOK || !canListen() || roomDb !== null) return;
  let m = null;
  try { m = await openMic(); roomDb = await m.floor(400); }
  catch (e) { if (alive(r)) await micGone(e); }
  finally { if (m) m.close(); }
}

// Luna's model of chunks i..j-1: the rendered clip, or the device voice if it will not load. The hello clip was
// made with the name Amelia; another name is said by the device voice. With a view, it shows Luna's turn and
// lights each picture as she says it.
async function model(b, i, j, v = null) {
  if (v) v.turn('luna');
  if (b.id === 'slate' && ctx.economy.save.child.name !== 'Amelia') return say(blockText(b, i, j));
  const id = clipId(b.id, i, j);
  const timers = v ? followTimes(b.chunks.slice(i, j).map(c => c.say || c.text), DUR[id] || 0).map((at, k) => setTimeout(() => v.now(i + k), at)) : [];
  const r = await ctx.audio.clip('./assets/audio/stage/' + id + '.ogg');
  timers.forEach(clearTimeout);
  if (v) v.now(-1);
  if (r === false) await say(blockText(b, i, j));
}

// The real singing: the audition chorus (where a grown-up set it, or content/stage.json songCut), or the whole number.
const chorus = () => { const c = stage().songCut || S.songCut; return { from: c.start, to: c.end }; };
async function playSong(r, v, range = {}, state = 'song') {
  if (!song || ctx.audio.muted || !alive(r)) return;
  ctx.audio.stop();
  if (v) v.turn(state);
  if (probe) probe.song = true;
  try { return await song.play(range); } // 'ended' or 'stopped'
  finally { if (probe) probe.song = false; }
}

// The practice screen: Luna, a title, progress dots, one picture per chunk, the turn panel (ear or microphone,
// loudness bar, star). The pictures are not buttons: the flow runs by itself.
function view(b, title, sub = '', steps = 0) {
  const cues = b.chunks.map(c => {
    const cue = el('div', { class: 'cue', 'aria-label': named(c.text) }, [el('span', { text: c.pic })]);
    cue.addEventListener('pointerdown', () => { cue.classList.remove('wiggle'); void cue.offsetWidth; cue.classList.add('wiggle'); });
    return cue;
  });
  const cueRow = el('div', { class: 'cues' }, cues);
  const dots = el('div', { class: 'round-dots' });
  const fill = el('div', { class: 'fill' });
  const star = el('div', { class: 'vstar', text: '⭐' });
  const icon = el('div', { class: 'mic-icon', text: '👂' });
  const status = el('div', { class: 'mic-status', 'aria-live': 'polite' });
  const mic = el('div', { class: 'mic', 'data-state': 'idle' }, [icon, el('div', { class: 'vmeter' }, [fill]), star]);
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  host.replaceChildren(el('div', { class: 'scene stage practice' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: title }), el('div', { class: 'line', text: sub })])]),
    steps ? dots : null, cueRow, mic, status
  ]));
  const v = {
    light(i, j) { cues.forEach((c, k) => { c.classList.toggle('lit', k >= i && k < j); c.classList.toggle('dim', k < i || k >= j); }); },
    now(k) { cues.forEach((c, n) => c.classList.toggle('now', n === k)); },
    hide(on) { cueRow.classList.toggle('curtain', on); },
    fade(on) { cueRow.classList.toggle('faded', on); },
    progress(done) { dots.replaceChildren(...Array.from({ length: steps }, (_, n) => el('span', { class: n < done ? 'done' : n === done ? 'current' : '' }))); },
    // 'luna' (listen), 'song' (listen to the orphans), 'sing' (sing along with them), 'you' (her turn),
    // 'big' / 'ok' (how her turn went), 'idle'
    turn(t) {
      mic.dataset.state = t;
      mic.classList.remove('nudge');
      status.classList.remove('act');
      icon.textContent = t === 'you' ? '🎤' : t === 'big' ? '🌟' : t === 'song' || t === 'sing' ? '🎶' : '👂';
      status.textContent = { you: '🎤 Your turn!', luna: '👂 Listen to Luna', song: '🎶 Listen to the orphans', sing: '🎶 Sing along!', big: '⭐ Big voice!', ok: 'Even bigger next time!' }[t] || '';
      luna.classList.toggle('talking', t === 'luna');
      mark(t);
    },
    // her turn and still quiet: the microphone bounces (the soft chime plays alongside)
    nudge() { mic.classList.remove('nudge'); void mic.offsetWidth; mic.classList.add('nudge'); },
    // the acting cue as a picture, while Luna says it
    act(emoji) { if (!emoji) return; v.turn('luna'); status.textContent = emoji; status.classList.add('act'); },
    level(db, thr) {
      const f = Math.max(0, Math.min(1, (db + 60) / 50));
      fill.style.width = Math.round(f * 100) + '%';
      star.style.transform = 'scale(' + (0.8 + f * 0.6).toFixed(2) + ')';
      star.classList.toggle('on', db >= thr);
    }
  };
  if (steps) v.progress(0);
  return v;
}

// One turn for her: Luna's `lead` (the model, or "Ready, set, go!"), then the microphone opens, the chime
// sounds, and it records until she stops. Without a microphone it waits, so the practice still flows.
// Resolves { heard, peakDb (null = no microphone), big, blob } or null if she left.
async function turn(r, v, { lead = null, maxMs, endSilenceMs, waitMs = 4000 }) {
  if (lead) await lead();
  if (!alive(r)) return null;
  ctx.audio.stop();
  let m = null;
  if (micOK && !r.noMic && canListen()) {
    try { m = await openMic(); }
    catch (e) { if (alive(r)) await micGone(e); }
  }
  try {
    if (!alive(r)) return null;
    sfx().ding();
    v.turn('you');
    await wait(CHIME_MS);
    if (!alive(r)) return null;
    if (!m) { await wait(waitMs); return alive(r) ? { heard: true, peakDb: null, big: false, blob: null } : null; }
    const thr = bigVoiceThreshold(refDb);
    const res = await m.listen({
      floorDb: roomDb === null ? -60 : roomDb, maxMs, endSilenceMs, noVoiceMs: 7000,
      nudgeMs: NUDGE_MS, onNudge: () => { sfx().ding(); v.nudge(); },
      onLevel: db => v.level(db, thr), live: () => alive(r)
    });
    if (!alive(r)) return null;
    deaf = res.heard ? 0 : deaf + 1;
    if (deaf >= 3) {
      r.noMic = true; // this activity only; the next one tries the microphone again
      toast('🎤 The microphone is not hearing anything. Practice goes on without it.', 5000);
      await say('Let\'s keep going without the microphone.');
    }
    return { ...res, big: res.heard && res.peakDb !== null && res.peakDb >= thr };
  } finally {
    if (m) m.close();
    v.level(-90, 0);
    if (v && alive(r)) v.turn('idle');
  }
}

// A turn with one more try when nothing was heard.
async function turnAgain(r, v, opts) {
  let res = await turn(r, v, opts);
  if (res && !res.heard && alive(r)) {
    await say('I did not hear you. Let\'s try again, nice and loud!');
    if (alive(r)) res = await turn(r, v, opts);
  }
  return res;
}

// Praise for effort and loudness only: the app never judges the words or the pitch.
async function cheer(r, v, res) {
  if (!res || !alive(r)) return;
  if (res.peakDb === null) { if (res.heard) await say(pick(NOMIC)); return; }
  if (!res.heard) { await say('That\'s okay. Let\'s keep going.'); return; }
  if (res.big) { v.turn('big'); sfx().sparkle(); await say(pick(BIG)); }
  else { v.turn('ok'); await say(pick(MORE)); }
}

async function keepTake(id, res) {
  if (!res || !res.blob || !res.heard || !ctx.store) return;
  try {
    if (!ctx.store.has('stage', id + '-first')) await ctx.store.save('stage', id + '-first', res.blob);
    await ctx.store.save('stage', id, res.blob);
  } catch (e) { console.warn('take not saved', e); }
}

// Once a visit: "Hello, everybody!" as big as she can. Its loudness sets the bar for the big-voice star.
async function warmUp(r) {
  if (refDb !== null || !micOK || !canListen()) return;
  const v = view(S.warmup, 'Warm up!', 'Get your stage voice ready.');
  v.light(0, 1);
  v.turn('luna');
  await say('First, let\'s warm up your stage voice. Say hello to everybody, as big as you can!');
  if (!alive(r)) return;
  const res = await turnAgain(r, v, { lead: () => model(S.warmup, 0, 1, v), maxMs: 5000, endSilenceMs: 900 });
  if (!alive(r) || !res || !res.heard || res.peakDb === null) return;
  refDb = res.peakDb;
  v.turn('big');
  sfx().sparkle();
  await say('What a big voice! That is your stage voice.');
}

// Two slow breaths with a bubble that grows and shrinks, before performing.
async function braveBreath(r) {
  const bubble = el('div', { class: 'bubble' });
  const label = el('div', { class: 'mic-status', text: '🫧' });
  host.replaceChildren(el('div', { class: 'scene stage breath' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Brave breath' })])]),
    bubble, label
  ]));
  mark('luna');
  await say('Let\'s take two brave breaths.');
  for (let i = 0; i < 2 && alive(r); i++) {
    bubble.style.transitionDuration = '3000ms'; bubble.classList.remove('out'); bubble.classList.add('in'); label.textContent = '🫧 ⬆️';
    say('Breathe in');
    await wait(3000);
    if (!alive(r)) return;
    bubble.style.transitionDuration = '3500ms'; bubble.classList.remove('in'); bubble.classList.add('out'); label.textContent = '🫧 ⬇️';
    say('Breathe out');
    await wait(3500);
  }
  if (alive(r)) await say('You feel calm and brave.');
}

// ---------- My Line, My Song ----------
async function practice(p) {
  const r = begin();
  const n = p.chunks.length, isSong = p.id === 'song';
  const done = stage().solos[p.id] || 0, level = cueLevel(done);
  await readRoom(r);
  if (!alive(r)) return;
  await warmUp(r);
  if (!alive(r)) return;
  const real = isSong && !!song && !ctx.audio.muted; // the cast recording is loaded
  const v = view(p, p.title, isSong ? 'The orphans\' song' : 'The orphans\' line', (level ? 1 : 0) + 1 + n + (real ? 1 : 0) + 1);
  let step = 0;
  const soloOpts = lead => ({ lead, maxMs: p.maxMs, endSilenceMs: isSong ? 2500 : 1500, waitMs: estimateMs(blockText(p, 0, n)) });
  v.light(0, n);
  v.turn('luna');
  await say(p.intro);
  if (!alive(r)) return;
  // From the second practice: try it from memory first, before hearing it again (retrieval before re-study).
  if (level) {
    v.hide(level === 2);
    v.turn('luna');
    await say(isSong ? 'Can you sing it before the orphans do? Try it from memory!' : 'Can you say it before Luna does? Try it from memory!');
    if (!alive(r)) return;
    const res = await turnAgain(r, v, soloOpts(null));
    await cheer(r, v, res);
    v.hide(false);
    v.progress(++step);
  }
  if (!alive(r)) return;
  v.turn('luna');
  if (real) {
    await say('Listen to the orphans sing it.');
    await playSong(r, v, chorus());
  } else {
    await say('Listen.');
    if (!alive(r)) return;
    await model(p, 0, n, v);
  }
  v.progress(++step);
  for (const [i, j] of chainSteps(n)) {
    if (!alive(r)) return;
    v.light(i, j);
    v.turn('luna');
    await say(i === n - 1 ? 'Let\'s learn it from the end. Say it after me.' : 'Now a little more. Say it after me.');
    if (!alive(r)) return;
    const text = blockText(p, i, j);
    const res = await turnAgain(r, v, { lead: () => model(p, i, j, v), maxMs: estimateMs(text), endSilenceMs: isSong ? 1500 : 1200, waitMs: estimateMs(text) * 0.6 });
    await cheer(r, v, res);
    v.progress(++step);
  }
  if (!alive(r)) return;
  v.light(0, n);
  v.act(p.act);
  await say(p.tip);
  if (real && alive(r)) {
    // the tune: sing along with the orphans before singing alone
    await say('Now sing along with the orphans!');
    await playSong(r, v, chorus(), 'sing');
    v.progress(++step);
  } else if (isSong && !song && alive(r)) await say('Sing it your way. A grown-up can add the real song for you.');
  if (!alive(r)) return;
  // her solo, with the pictures, with faded pictures, or behind the curtain as her practice count grows
  v.fade(level === 1);
  v.hide(level === 2);
  v.turn('luna');
  await say(level === 2 ? (isSong ? 'Now sing it all by yourself, from memory!' : 'Now say it all by yourself, from memory!')
    : (isSong ? 'Now sing it all by yourself! Look at the pictures.' : 'Now say it all by yourself! Look at the pictures.'));
  if (!alive(r)) return;
  const res = await turnAgain(r, v, soloOpts(() => { v.turn('luna'); return say('Ready, set, go!'); }));
  await cheer(r, v, res);
  await keepTake(p.id, res);
  v.fade(false);
  v.hide(false);
  if (res && res.blob && res.heard && alive(r)) {
    v.turn('luna');
    await say('Listen to you!');
    if (alive(r)) await ctx.audio.clip(res.blob);
    if (real) { if (alive(r)) await say('Here are the orphans.'); await playSong(r, v, chorus()); }
    else {
      if (alive(r)) await say(isSong ? 'Here are the words again.' : 'And here is Luna.');
      if (alive(r)) await model(p, 0, n, v);
    }
  }
  if (!alive(r)) return;
  v.progress(++step);
  stage().solos[p.id] = done + 1;
  logPractice(stage(), ctx.economy.today(), p.id);
  finish(r, 2, isSong ? 'You practiced your song!' : 'You practiced your line!');
}

function finish(r, gems, line) {
  if (!alive(r)) return;
  const e = ctx.economy;
  e.addGems(gems); e.addCompanionStars(1); e.markPlayedToday();
  ctx.refreshBar && ctx.refreshBar();
  const o = sheet([
    svgFrom(lunaSVG({ state: 'yay', glow: e.companion().level })),
    el('h2', { text: 'You did it!' }),
    el('div', { class: 'sub', text: line }),
    bigButton('Yay!', () => { o.remove(); leave(); }, 'gold')
  ]);
  confetti(60); flyGems(gems); sfx().yay();
  mark('waiting');
  say(line + ' You did it!').then(() => { if (alive(r)) idleNudge('Tap the yellow button!'); });
}

// ---------- Hear the orphans ----------
// The whole number from the recording on this device: a big play / stop, a bar that fills, and "just my part"
// for the audition chorus.
async function hear() {
  const r = begin();
  const fill = el('div', { class: 'fill' });
  const bar = el('div', { class: 'song-bar' }, [fill]);
  let playing = false;
  const big = el('button', { class: 'song-play', type: 'button', 'aria-label': 'Play the song', text: '▶' });
  const part = bigButton('🎵 Just my part', () => go(chorus()), 'soft');
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'happy', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Hear the orphans' }), el('div', { class: 'line', text: 'Annie and the orphans sing It\'s the Hard-Knock Life.' })])]),
    el('div', { class: 'song-box' }, [big, bar]), el('div', { class: 'row' }, [part, bigButton('All done', leave, 'gold')])
  ]));
  const dur = await song.duration() || 1;
  const tick = setInterval(() => { if (!alive(r)) return clearInterval(tick); fill.style.width = Math.min(100, song.currentTime() / dur * 100) + '%'; }, 250);
  let token = 0;
  const go = async (range, toggle = false) => {
    if (toggle && playing) { song.stop(); return; }
    stopIdle();
    const my = ++token;
    playing = true; big.textContent = '⏹';
    const t0 = Date.now();
    const how = await playSong(r, null, range);
    if (my !== token) return; // a newer play took over
    playing = false; big.textContent = '▶';
    if (!alive(r)) return;
    mark('waiting');
    if (!range.to && (how === 'ended' || Date.now() - t0 > 45000)) markHeard(r);
    if (how === 'ended' && !range.to) await say('Great listening! Now practice your song.');
    else if (how === 'ended') await say('That is your part!');
    if (alive(r) && !playing) idleNudge('Tap the big button to hear it again, or tap the yellow button when you are done.');
  };
  big.addEventListener('click', () => go({}, true));
  await say('Listen to the orphans sing the whole song! Sing along when you know the words.');
  if (alive(r) && !playing) go({});
}
function markHeard(r) {
  if (r.counted || !alive(r)) return;
  r.counted = true; stage().watched++; logPractice(stage(), ctx.economy.today(), 'hear'); ctx.economy.persist();
}

// ---------- Audition time! ----------
async function audition() {
  const r = begin();
  const s = stage(), firstTimes = s.auditions < 2;
  const curtain = el('div', { class: 'stage-curtain' }, [el('div', { class: 'cl' }), el('div', { class: 'cr' }), el('div', { class: 'spot', text: '⭐' })]);
  host.replaceChildren(el('div', { class: 'scene stage' }, [el('div', { class: 'scene-head' }, [el('div', { class: 'title', text: 'Audition time!' })]), curtain]));
  mark('luna');
  await wait(80);
  if (!alive(r)) return;
  curtain.classList.add('open');
  await readRoom(r);
  if (!alive(r)) return;
  await say('Audition time! This is just like the real one. Walk to the middle, stand tall, and smile!');
  if (!alive(r)) return;
  await warmUp(r);
  if (!alive(r)) return;
  await braveBreath(r);
  if (!alive(r)) return;
  const line = piece('line'), songPiece = piece('song');
  const steps = [
    { b: S.slate, key: 'slate', title: 'Say hi!', intro: firstTimes ? 'First, say hi to the director, like this.' : 'First, say hi to the director.', model: firstTimes, maxMs: 12000, endSilenceMs: 1500 },
    { b: line, key: 'line', title: 'Your line', intro: 'Now your line!', hide: !firstTimes, maxMs: line.maxMs, endSilenceMs: 1500 },
    { b: songPiece, key: 'song', title: 'Your song', intro: 'Now your song! Take a big breath.', hide: !firstTimes, maxMs: songPiece.maxMs, endSilenceMs: 2500 },
    { b: THANKS, key: 'thanks', title: 'Thank you!', intro: 'Last, say thank you!', maxMs: 5000, endSilenceMs: 900 }
  ];
  const takes = [];
  let bigs = 0, measured = false;
  for (const [k, st] of steps.entries()) {
    if (!alive(r)) return;
    const n = st.b.chunks.length;
    const v = view(st.b, st.title, 'Audition', steps.length);
    v.progress(k);
    v.light(0, n);
    if (st.hide) v.hide(true);
    v.turn('luna');
    await say(st.intro);
    if (!alive(r)) return;
    const res = await turnAgain(r, v, { lead: st.model ? () => model(st.b, 0, n, v) : null, maxMs: st.maxMs, endSilenceMs: st.endSilenceMs, waitMs: estimateMs(blockText(st.b, 0, n)) });
    if (!alive(r)) return;
    if (res && res.peakDb !== null) measured = true;
    if (res && res.big) { bigs++; v.turn('big'); }
    if (res && res.blob && res.heard) takes.push(res.blob);
    await keepTake('audition-' + st.key, res);
    await wait(500);
  }
  if (!alive(r)) return;
  s.auditions++;
  logPractice(s, ctx.economy.today(), 'audition');
  const e = ctx.economy;
  e.addGems(3); e.addCompanionStars(1); e.markPlayedToday();
  ctx.refreshBar && ctx.refreshBar();
  sfx().applause(); confetti(90); flyGems(3);
  let playing = false;
  const hearBtn = bigButton('▶ Hear my audition', async () => {
    if (playing) return;
    playing = true; stopIdle();
    for (const b of takes) { if (!alive(r)) break; await ctx.audio.clip(b); await wait(350); }
    playing = false;
  }, 'soft');
  const o = sheet([
    svgFrom(lunaSVG({ state: 'yay', glow: e.companion().level })),
    el('h2', { text: 'Bravo!' }),
    el('div', { class: 'sub', text: measured ? 'Big-voice stars: ' + ('⭐'.repeat(bigs) || 'next time!') : 'Take a bow!' }),
    takes.length ? hearBtn : null,
    bigButton('Yay!', () => { o.remove(); leave(); }, 'gold')
  ]);
  mark('waiting');
  await say('Take a bow! You were wonderful!');
  if (alive(r)) idleNudge('Tap the yellow button!');
}

// ---------- Try another line ----------
// One of the other seven lines on the sheet, in turn: hear it, echo each chunk, the acting cue, echo it whole.
async function anotherLine() {
  const r = begin();
  const k = stage().solos.other || 0, b = S.others[k % S.others.length], n = b.chunks.length;
  await readRoom(r);
  if (!alive(r)) return;
  await warmUp(r);
  if (!alive(r)) return;
  const v = view(b, b.pic + ' ' + b.role, 'Try another line', 1 + n + 1);
  let step = 0;
  v.light(0, n);
  v.turn('luna');
  await say('The director might ask you to try a different line. Let\'s try one!');
  if (!alive(r)) return;
  await say(b.intro);
  if (!alive(r)) return;
  await model(b, 0, n, v);
  v.progress(++step);
  for (let i = 0; i < n; i++) {
    if (!alive(r)) return;
    v.light(i, i + 1);
    const text = blockText(b, i, i + 1);
    const res = await turnAgain(r, v, { lead: () => model(b, i, i + 1, v), maxMs: estimateMs(text), endSilenceMs: 1200, waitMs: estimateMs(text) * 0.6 });
    await cheer(r, v, res);
    v.progress(++step);
  }
  if (!alive(r)) return;
  v.light(0, n);
  v.act(b.act);
  await say(b.tip);
  if (!alive(r)) return;
  v.turn('luna');
  await say('Now say the whole line after me.');
  if (!alive(r)) return;
  const whole = blockText(b, 0, n);
  const res = await turnAgain(r, v, { lead: () => model(b, 0, n, v), maxMs: estimateMs(whole) + 2000, endSilenceMs: 1500, waitMs: estimateMs(whole) * 0.6 });
  await cheer(r, v, res);
  await keepTake('other', res);
  if (!alive(r)) return;
  v.progress(++step);
  stage().solos.other = k + 1;
  logPractice(stage(), ctx.economy.today(), 'other');
  finish(r, 1, 'You tried a new line!');
}

// ---------- Audition day warm-up ----------
// On the day: stage voice, two brave breaths, the line once from memory, the song once, and a pep talk.
async function dayOf() {
  const r = begin();
  await readRoom(r);
  if (!alive(r)) return;
  refDb = null; // a fresh warm-up shout on the day
  await warmUp(r);
  if (!alive(r)) return;
  await braveBreath(r);
  if (!alive(r)) return;
  const line = piece('line'), songPiece = piece('song');
  let v = view(line, 'Your line', 'Audition day', 3);
  v.light(0, line.chunks.length);
  v.hide(true);
  v.turn('luna');
  await say('Say your line one time, from memory.');
  if (!alive(r)) return;
  let res = await turnAgain(r, v, { maxMs: line.maxMs, endSilenceMs: 1500, waitMs: estimateMs(blockText(line, 0, line.chunks.length)) });
  await cheer(r, v, res);
  if (!alive(r)) return;
  v = view(songPiece, 'Your song', 'Audition day', 3);
  v.progress(1);
  v.light(0, songPiece.chunks.length);
  v.turn('luna');
  if (song && !ctx.audio.muted) {
    await say('Sing along with the orphans one time.');
    await playSong(r, v, chorus(), 'sing');
  } else {
    await say('Sing your song one time, in your big stage voice.');
    if (!alive(r)) return;
    res = await turnAgain(r, v, { maxMs: songPiece.maxMs, endSilenceMs: 2500, waitMs: estimateMs(blockText(songPiece, 0, songPiece.chunks.length)) });
    await cheer(r, v, res);
  }
  if (!alive(r)) return;
  v.progress(2);
  v.turn('luna');
  await say('You know your line and your song. Use your big stage voice, smile, and have fun. Luna is so proud of you!');
  if (!alive(r)) return;
  v.progress(3);
  logPractice(stage(), ctx.economy.today(), 'dayof');
  finish(r, 3, 'You are ready!');
}

// ---------- menu ----------
// Muted: Luna cannot talk, so the menu is replaced by one big "sound on" button.
function showMuted() {
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'think', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Star Stage' }), el('div', { class: 'line', text: 'Luna needs the sound on.' })])]),
    el('button', { class: 'unmute', type: 'button', 'aria-label': 'Turn the sound on', text: '🔇 ➜ 🔊', onclick: () => { ctx.speech.setMuted(false); ctx.refreshBar && ctx.refreshBar(); showMenu(); } })
  ]));
  mark('waiting');
}

function noSong() {
  toast('🎧 A grown-up can add the song in Parent Corner.', 5000);
  say('Ask a grown-up to add the song.');
}

function showMenu() {
  if (!host || !S) return;
  stopIdle();
  if (ctx.audio.muted) return showMuted();
  const my = ++menuToken;
  const s = stage(), today = ctx.economy.today(), done = s.days[today] || {};
  const days = daysUntil(today, S.auditionDate);
  const sub = days > 1 ? 'Your Annie audition is in ' + days + ' days.' : days === 1 ? 'Your Annie audition is tomorrow!' : days === 0 ? 'Audition day! You can do it!' : 'Keep shining for the Annie show!';
  const plan = dailyPlan(today, S.auditionDate, { heard: s.watched > 0, canHear: !!song });
  const next = plan.find(id => !done[id]) || null;
  const tiles = [
    days === 0 ? { id: 'dayof', name: 'Audition day warm-up', run: dayOf, wide: true } : null,
    { id: 'line', name: 'My Line', run: () => practice(piece('line')) },
    { id: 'song', name: 'My Song', run: () => practice(piece('song')) },
    { id: 'hear', name: 'Hear the orphans', run: song ? hear : noSong, off: !song },
    { id: 'audition', name: 'Audition time!', run: audition },
    { id: 'other', name: 'Try another line', run: anotherLine }
  ].filter(Boolean);
  // the days up to the audition, a star on each day she practiced: she counts circles, not "5 days"
  const practiced = new Set(Object.keys(s.days).filter(d => Object.keys(s.days[d]).length));
  const strip = dayStrip(today, S.auditionDate, practiced);
  const DAY = { done: '⭐', missed: '·', today: '✨', future: '', audition: '🎭' };
  host.replaceChildren(el('div', { class: 'scene stage menu' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Star Stage' }), el('div', { class: 'line', text: sub })])]),
    strip.length ? el('div', { class: 'day-strip', 'aria-label': sub }, strip.map(d => el('div', { class: 'day ' + d.kind + (d.today ? ' is-today' : ''), text: DAY[d.kind] }))) : null,
    // today's plan as pictures with a tick on each one done
    plan.length ? el('div', { class: 'plan-strip', 'aria-label': 'Today' }, plan.map(id => el('div', { class: 'plan-item' + (done[id] ? ' done' : '') + (id === next ? ' next' : '') }, [el('span', { text: ICON[id] }), done[id] ? el('b', { text: '✓' }) : null]))) : null,
    el('div', { class: 'encounters' }, tiles.map(m => el('button', { class: 'encounter-btn' + (m.id === next ? ' next-up' : '') + (m.wide ? ' primary' : '') + (m.off ? ' off' : ''), type: 'button', onclick: () => { stopIdle(); m.run(); } }, [
      el('div', { class: 'icon', text: ICON[m.id] }), el('div', { text: m.name }), done[m.id] ? el('div', { class: 'tick', text: '✓ today' }) : null
    ])))
  ]));
  mark('waiting');
  const hello = days > 0 ? 'Welcome to Star Stage! Let\'s get ready for your Annie audition.' : days === 0 ? 'Today is audition day! You can do it!' : 'Welcome to Star Stage!';
  const hint = HINT[next || (days < 0 ? 'free' : 'none')];
  say(hello + ' ' + hint).then(() => { if (my === menuToken && !run && next) idleNudge(hint); });
}

export async function mount(h, c) {
  host = h; ctx = c;
  refDb = null; roomDb = null; micOK = true; deaf = 0;
  probe = globalThis.__pq ? (globalThis.__pqStage = { state: 'menu', song: false, events: [] }) : null;
  [S, DUR] = await Promise.all([ctx.content.load('stage'), ctx.content.load('stage-audio').catch(() => ({}))]);
  const rec = ctx.store && ctx.store.get('stage', 'song-audio');
  song = rec ? createSongPlayer(rec) : null;
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', stopIdle);
  showMenu();
}
export function unmount() {
  stopRun();
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('pointerdown', stopIdle);
  if (song) { song.release(); song = null; }
  host = null;
}
