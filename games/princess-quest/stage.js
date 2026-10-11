// games/princess-quest/stage.js — Star Stage: the audition trainer for the Annie audition (Broadway at the J,
// grades K–5, Wed 10/14/2026). Amelia is six and only starting to read (slowly, a few words), so everything is by
// ear, with a picture for each chunk, and every instruction is spoken. A grown-up can turn on the words under the
// pictures (Parent Corner); they show only while she listens, never on her turns or in the auditions (showsWords).
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
// Evidence (sources checked one by one; strength noted, because little of it is on six-year-olds memorising lines):
//   - spaced practice, a little each day: Vlach & Sandhofer 2012, Child Dev 83:1137 (ages 5-7)
//   - recall attempts with the answer right after, once early success is in place: Kliegl, Abel & Bäuml 2018,
//     Front Psychol 9:1446; Fritz et al. 2007, Q J Exp Psychol 60:991; Káldi et al. 2025, Child Dev 96:1934;
//     review: Fazio & Marsh 2019, Curr Dir Psychol Sci 28:111
//   - clause-sized chunks: Gilchrist, Cowan & Naveh-Benjamin 2009, J Exp Child Psychol 104:252
//   - pictures that show what the words mean help young children remember what they hear: Greenhoot & Semb 2008,
//     J Exp Child Psychol 99:271; fading them from the end: Krantz & McClannahan 1993, JABA 26:121
//   - backward chaining only as a scaffold (mixed evidence): Slocum & Tiger 2011, JABA 44:793; Smith 1999
//   - praise for what she did, not who she is: Kamins & Dweck 1999, Dev Psychol 35:835 (ages 5-6); Zentall &
//     Morris 2010, J Exp Child Psychol 107:155 (kindergarten)
//   - pitch is never judged: whole-song pitch matching develops through ages 5-7, well after the words (Welch,
//     Sergeant & White 1998, Res Stud Music Educ 10:67; Demorest et al. 2018, Psychol Music 46:488)
//   - a brief slow-breathing ritual before performing: Khng 2017, Cogn Emot 31:1502 (ages 10-11)
import { el, wait, pick, bigButton, sheet, confetti, toast } from '../../shared/ui.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';
import { flyGems } from '../../shared/encounter.js';
import { canListen, openMic } from '../../shared/mic.js';
import { createSongPlayer } from '../../shared/songclip.js';
import { clipId, chainSteps, daysUntil, logPractice, bigVoiceThreshold, micGain, followTimes, dayStrip, dailyPlan, hiddenFromEnd, quietFloor, deadMic, showsWords } from '../../shared/stage-plan.js';

let host = null, ctx = null, S = null, DUR = {};
let run = null;     // the activity in progress, { live, noMic }; Back, Home or leaving the place turns it off
// This visit (reset in mount): her warm-up shout (the bar for a big voice), the room's quiet level readings
// (shared/stage-plan.js quietFloor), and whether the microphone may be used at all (no device, or permission refused).
let refDb = null, rooms = [], micOK = true, micOpened = false, micDead = false, slowTold = false; // micDead: set aside once this visit
let deaf = 0;       // turns in a row in this activity where the microphone delivered digital silence (deadMic)
let wake = null;    // screen wake lock while an activity runs (it is hands-free for minutes at a time)
let song = null;    // the cast recording from Parent Corner (shared/songclip.js), or null when absent or unplayable
let chorusOK = false; // the recording is long enough to hold the chorus (else My Song uses Luna's model)
let idle = null, idleText = null, idleN = 0; // the re-prompt while a button waits (see idleNudge)
let menuToken = 0, greeted = false, mutedShown = false, mountToken = 0;
// Double taps: a second tap within 0.45 s of a tap on a sheet or pad ("Yay!", ✅, the PIN pad's Cancel) or of the
// tile that opened a screen is not a choice: it would land on whatever just appeared under her finger.
let overlayTapAt = 0, guardUntil = 0;
const guarded = () => Date.now() < guardUntil; // the long hello once a visit; the sound-on screen is up
let muteWatch = null; // muted in the middle of an activity: stop it (Luna cannot talk; nothing should record silently)
const CHIME_MS = 350;  // the chime is over before recording starts, so it is never in her take or taken for her
const NUDGE_MS = 3000; // her turn, no voice yet: a soft reminder (never more than 3 s of silence without a cue)
const IDLE_MS = 8000;  // a button waiting: Luna says it again after 8 s, then less and less often

const THANKS = { id: 'thanks', chunks: [{ text: 'Thank you!', pic: '🙇' }] };
const BIG = ['Big stage voice!', 'Wow, the back row heard you!', 'Loud and clear. Bravo!'];
const MORE = ['Good! Now even bigger!', 'Nice! Use your big stage voice!'];
const ICON = { hear: '🎧', line: '🗣️', song: '🎵', audition: '⭐', dayof: '🌟', other: '🎭' };
// what Luna says on the menu about the glowing button (she cannot read the labels yet)
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
// still running: not left, and not muted (Luna cannot talk, so nothing may go on or record unheard)
const alive = r => !!r && r === run && r.live && !ctx.audio.muted;
const piece = id => S.pieces.find(p => p.id === id);
const blockText = (b, i, j) => named(b.chunks.slice(i, j).map(c => c.say || c.text).join(' '));
const estimateMs = text => 3000 + text.split(/\s+/).length * 900;
// How long she takes to say chunks i..j-1: Luna's model clip, or the chorus when she sings with the real song.
const expectFor = (b, i, j) => (b.id === 'song' && i === 0 && j === b.chunks.length && song && chorusOK ? (chorus().to - chorus().from) * 1000 : DUR[clipId(b.id, i, j)] || estimateMs(blockText(b, i, j)) * 0.5);
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
  if (run && run.onStop) { try { run.onStop(); } catch (e) { console.warn(e); } } // e.g. credit for listening so far
  if (run) run.live = false;
  run = null;
  stopIdle();
  if (ctx) ctx.audio.stop();
  if (song) song.stop();
  if (probe) probe.song = false;
  rest();
}
function leave() { stopRun(); clearOverlays(); ctx.nav && ctx.nav.pop(); showMenu({ afterTap: true }); }
// The screen stays awake while an activity runs by itself, and may sleep again whenever it waits for a tap.
async function keepAwake() {
  if (wake || !navigator.wakeLock) return;
  const r = run;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (wake || !run || run !== r) lock.release().catch(() => {}); // two taps at once, or she already left
    else wake = lock;
  } catch {}
}
function rest() { if (wake) { wake.release().catch(() => {}); wake = null; } }
// Home button, app switch or screen off: stop (no recording and no talking in the background) and wait on the
// menu without a word; back in view, Luna says what is next.
function onVisibility() {
  if (!host) return;
  if (document.hidden) {
    stopIdle(); ctx.audio.stop();
    if (run) { stopRun(); clearOverlays(); ctx.nav && ctx.nav.pop(); showMenu({ quiet: true }); }
  } else if (!run) showMenu();
}
function stopIdle() { clearTimeout(idle); idle = null; idleText = null; }
// A button waiting for her: Luna says what to tap after 8 s, then again less and less often (8, 12, 18, 27, 40,
// 61 s; six times, about 3 minutes in all). A tap that starts nothing (a picture, the background) restarts the wait
// and keeps the reminder; a button that does something calls stopIdle.
function idleNudge(text) { stopIdle(); idleText = text; idleN = 0; armIdle(); }
function armIdle() {
  clearTimeout(idle); idle = null;
  if (!idleText || idleN >= 6) return;
  const text = idleText;
  idle = setTimeout(() => {
    idle = null;
    if (!host || idleText !== text || document.hidden) return;
    if (padOpen()) { armIdle(); return; } // the grown-ups' PIN pad covers the screen: keep the reminder for later
    idleN++;
    say(text).then(() => { if (idleText === text && !idle) armIdle(); });
  }, Math.round(IDLE_MS * 1.5 ** idleN));
}
const onTap = e => { if (e && e.target && e.target.closest && e.target.closest('.overlay')) overlayTapAt = Date.now(); if (idleText) armIdle(); };
const padOpen = () => !!document.querySelector('.overlay.pin-pad');

function micGone(e) {
  micOK = false;
  console.warn('mic', e);
  toast(e && e.name === 'TimeoutError' ? '🎤 The microphone did not start. Practice goes on without it.' : '🎤 Ask a grown-up to allow the microphone.', 5000);
  // nobody answered the browser's question (Luna already asked for a grown-up), or it is blocked or missing
  return say(e && e.name === 'TimeoutError' ? 'Let\'s keep going without the microphone.' : 'Ask a grown-up to turn on the microphone.');
}

// Opens the microphone. When the browser has to ask (the first time on a device), its question is text she cannot
// read: the screen shows a microphone and a grown-up, and Luna asks for one at once and again every few seconds,
// so it is never silent; after 10 s with no answer it goes on without the microphone (openMic's timeout, micGone).
// Already allowed (or opened before in this visit) but slow to start: nothing for 2.5 s, then "ask a grown-up to
// turn on the microphone" (a device stuck opening it), never "tap Allow"; once a visit, and after that only
// onSlow() (the turn panel's microphone bounces) while it opens.
async function askMic(r, { scene = true, onSlow = () => {} } = {}) {
  let pending = true, saying = null;
  const p = openMic();
  p.then(() => { micOpened = true; }, () => {});
  (async () => {
    let state = null;
    try { state = (await navigator.permissions.query({ name: 'microphone' })).state; } catch {}
    if (state === 'denied') return; // refused for good: openMic fails at once
    const asking = state === 'prompt' || (state === null && !micOpened); // not known: the first time is likely a question
    if (state !== 'prompt') await Promise.race([p.catch(() => {}), wait(asking ? 1200 : 2500)]);
    if (!pending || !alive(r)) return;
    if (!asking && slowTold) { while (pending && alive(r)) { onSlow(); await wait(1500); } return; }
    if (!asking) slowTold = true;
    const line = asking ? 'Ask a grown-up to tap Allow for the microphone.' : 'Ask a grown-up to turn on the microphone.';
    if (scene) host.replaceChildren(el('div', { class: 'scene stage breath' }, [
      el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'think', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Microphone' })])]),
      el('div', { class: 'ask-mic', 'aria-label': 'Ask a grown-up to allow the microphone', text: '🎤🧑' })
    ]));
    while (pending && alive(r)) { mark('luna'); saying = say(line); await saying; if (pending) await wait(1500); }
  })();
  // the microphone opened while Luna was asking: she finishes her sentence (never cut off by the chime, and never
  // in the room reading or her take)
  try { return await p; }
  finally { pending = false; if (saying) await saying; }
}

// The room's quiet level at the start of an activity, while nothing plays (another reading comes before each
// turn; see quietFloor). The first time ever, this is also where the browser asks for the microphone (Parent
// Corner's microphone test asks first).
async function readRoom(r) {
  if (!micOK || !canListen()) return;
  let m = null;
  try { m = await askMic(r); if (alive(r)) { const f = await m.floor(400, null); if (f !== null) rooms.push(f); } }
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
// Resolves 'ended', 'stopped' or 'error' (this device would not play it; the caller falls back to Luna).
// With a block `b` and a range, each picture lights as the orphans reach it: the same proportional timing as
// Luna's clips (followTimes), over the chorus (found by analysis, not by ear).
async function playSong(r, v, range = {}, state = 'song', b = null) {
  if (!song || ctx.audio.muted || !alive(r)) return 'error';
  ctx.audio.stop();
  if (v) v.turn(state);
  if (probe) probe.song = true;
  let follow = null;
  if (v && b && range.to) {
    const at = followTimes(b.chunks.map(c => c.say || c.text), (range.to - range.from) * 1000);
    follow = setInterval(() => { const ms = (song.currentTime() - range.from) * 1000; let k = -1; at.forEach((x, n) => { if (ms >= x) k = n; }); v.now(k); }, 100);
  }
  try { return await song.play({ ...range, shouldStop: () => !alive(r) }); }
  finally { if (follow) { clearInterval(follow); v.now(-1); } if (probe) probe.song = false; }
}

// The practice screen: Luna, a title, progress dots, one picture per chunk, the turn panel (ear or microphone,
// loudness bar, star). The pictures are not buttons: the flow runs by itself.
// With the grown-up's words switch on (and `words` not false: the auditions pass false), a fixed-height strip
// under the pictures shows the words of the picture lit right now while she listens (shared/stage-plan.js
// showsWords). With the switch off nothing is added, so the screen is exactly as before.
function view(b, title, sub = '', steps = 0, { words = true } = {}) {
  const cues = b.chunks.map(c => {
    const cue = el('div', { class: 'cue', 'aria-label': named(c.text) }, [el('span', { text: c.pic })]);
    cue.addEventListener('pointerdown', () => { cue.classList.remove('wiggle'); void cue.offsetWidth; cue.classList.add('wiggle'); });
    return cue;
  });
  const cueRow = el('div', { class: 'cues' }, cues);
  const wordsOn = words && stage().words === true;
  const cap = wordsOn ? el('div', { class: 'stage-words', 'aria-hidden': 'true' }) : null;
  let state = 'idle';
  const caption = k => {
    if (!cap) return;
    const show = showsWords({ on: true, state, k, gone: k >= 0 && !!cues[k] && cues[k].classList.contains('gone'), curtain: cueRow.classList.contains('curtain') });
    const text = show && b.chunks[k] ? named(b.chunks[k].text) : '';
    // a long chunk gets smaller letters inside the strip; the strip itself never changes size
    cap.replaceChildren(...(text ? [el('span', { class: text.length > 34 ? 'long' : '', text })] : []));
  };
  const dots = el('div', { class: 'round-dots' });
  const fill = el('div', { class: 'fill' });
  const star = el('div', { class: 'vstar', text: '⭐' });
  const icon = el('div', { class: 'mic-icon', text: '👂' });
  const status = el('div', { class: 'mic-status', 'aria-live': 'polite' });
  const doneBtn = el('button', { class: 'turn-done', type: 'button', 'aria-label': 'I am done', text: '👍', hidden: '' });
  // the thumbs-up sits in the panel, in place of the meter and star, so it is never below the fold
  const mic = el('div', { class: 'mic', 'data-state': 'idle' }, [icon, el('div', { class: 'vmeter' }, [fill]), star, doneBtn]);
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  host.replaceChildren(el('div', { class: 'scene stage practice' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: title }), el('div', { class: 'line', text: sub })])]),
    steps ? dots : null, cueRow, cap, mic, status
  ]));
  const v = {
    light(i, j) { cues.forEach((c, k) => { c.classList.toggle('lit', k >= i && k < j); c.classList.toggle('dim', k < i || k >= j); }); },
    now(k) { cues.forEach((c, n) => c.classList.toggle('now', n === k)); caption(k); },
    hide(on) { cueRow.classList.toggle('curtain', on); caption(-1); },
    // the last h pictures hidden (a question mark each); all of them: the curtain
    hideLast(h) { cues.forEach((c, k) => c.classList.toggle('gone', h > 0 && k >= cues.length - h)); cueRow.classList.toggle('curtain', h >= cues.length && h > 0); caption(-1); },
    progress(done) { dots.replaceChildren(...Array.from({ length: steps }, (_, n) => el('span', { class: n < done ? 'done' : n === done ? 'current' : '' }))); },
    // 'luna' (listen), 'song' (listen to the orphans), 'sing' (sing along with them), 'you' (her turn, the
    // microphone on), 'tap' (her turn, no microphone: the thumbs-up), 'me' (her own take playing back),
    // 'big' / 'ok' (how her turn went), 'idle'
    turn(t) {
      state = t;
      caption(-1); // a new turn starts with no words up; the next lit picture brings its own
      mic.dataset.state = t;
      mic.classList.remove('nudge');
      status.classList.remove('act');
      icon.textContent = { you: '🎤', tap: '🎤', sing: '🎤', big: '🌟', song: '🎶', me: '👧' }[t] || '👂';
      status.textContent = { you: '🎤 Your turn!', tap: '🎤 Your turn!', luna: '👂 Listen to Luna', song: '🎶 Listen to the orphans', sing: '🎤🎶 Sing along!', me: '👂 That was you!', big: '⭐ Big voice!', ok: 'Even bigger next time!' }[t] || '';
      luna.classList.toggle('talking', t === 'luna');
      mark(t);
    },
    // no microphone: a thumbs-up she taps when she has finished (resolves on the tap)
    done() { doneBtn.hidden = false; return new Promise(res => { doneBtn.onclick = () => { doneBtn.hidden = true; res(); }; }); },
    hideDone() { doneBtn.hidden = true; doneBtn.onclick = null; },
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

// One turn for her: Luna's `lead` (the model, or "Ready, set, go!"), then the microphone opens, the room is read
// for a moment, the chime sounds, and it records until she stops. Without a microphone she taps the thumbs-up
// (or it moves on by itself), so the practice still flows.
// Resolves { heard, peakDb (null = no microphone), big, blob, noMic } or null if she left.
async function turn(r, v, { lead = null, maxMs, endSilenceMs, waitMs = 4000, follow = null }) {
  if (lead) await lead();
  if (!alive(r)) return null;
  ctx.audio.stop();
  let m = null;
  if (micOK && !r.noMic && canListen()) {
    try { m = await askMic(r, { scene: false, onSlow: () => v.nudge() }); } // the practice screen stays
    catch (e) { if (alive(r)) await micGone(e); }
  }
  try {
    if (!alive(r)) return null;
    if (m) { const f = await m.floor(300, null); if (f !== null) rooms.push(f); if (!alive(r)) return null; }
    sfx().ding();
    v.turn(m ? 'you' : 'tap');
    await wait(CHIME_MS);
    if (!alive(r)) return null;
    if (!m) {
      // No microphone: she taps the thumbs-up (in the panel, where the microphone was) when she has finished. The
      // pictures light one by one at the pace she should say them (a guide she can follow, like Luna's model); a
      // soft chime at 3 s, as with the microphone; when she should be done, Luna says to tap the thumbs-up; a few
      // seconds later it moves on by itself.
      const tapped = v.done();
      if (!r.toldDone) { r.toldDone = true; await say('Tap the thumbs up when you finish.'); if (!alive(r)) return null; }
      const expect = Math.max(1500, follow ? expectFor(...follow) : waitMs * 0.5);
      const remindAt = Math.max(NUDGE_MS + 1500, expect + 1500);
      const timers = [
        setTimeout(() => { if (alive(r)) { sfx().ding(); v.nudge(); } }, NUDGE_MS),
        setTimeout(() => { if (alive(r)) { v.nudge(); say('Tap the thumbs up when you finish.'); } }, remindAt)
      ];
      if (follow) {
        const [b, i, j] = follow;
        followTimes(b.chunks.slice(i, j).map(c => c.say || c.text), expect).forEach((at, k) => timers.push(setTimeout(() => { if (alive(r)) v.now(i + k); }, at)));
      }
      await Promise.race([wait(remindAt + 4000), tapped]);
      timers.forEach(clearTimeout);
      v.now(-1);
      v.hideDone();
      return alive(r) ? { heard: true, noMic: true, peakDb: null, big: false, blob: null } : null;
    }
    const thr = bigVoiceThreshold(refDb, micGain(quietFloor(rooms)));
    const res = await m.listen({
      floorDb: quietFloor(rooms, refDb), maxMs, endSilenceMs, noVoiceMs: 7000,
      nudgeMs: NUDGE_MS, onNudge: () => { sfx().ding(); v.nudge(); },
      onLevel: db => v.level(db, thr), live: () => alive(r)
    });
    if (!alive(r)) return null;
    if (res.quietDb !== null && res.quietDb !== undefined) rooms.push(res.quietDb); // the room as heard during her take
    // Set the microphone aside only when it delivers digital silence (a muted or dead input) two takes running, or
    // once in a later activity of the same visit. A quiet child or a noisy room is never a reason: she gets "say it
    // nice and loud" instead.
    deaf = deadMic(res) ? deaf + 1 : 0;
    if (deaf >= (micDead ? 1 : 2)) {
      r.noMic = true; micDead = true; // the next activity tries the microphone once more
      toast('🎤 The microphone is not hearing anything. Practice goes on without it.', 5000);
      await say('Let\'s keep going without the microphone.');
      return alive(r) ? { ...res, heard: true, noMic: true, peakDb: null, big: false, blob: null } : null;
    }
    return { ...res, big: res.heard && res.peakDb !== null && res.peakDb >= thr };
  } finally {
    if (m) m.close();
    v.level(-90, 0);
    if (v && alive(r)) v.turn('idle');
  }
}

// A turn with one more try when nothing was heard (not once the microphone has been set aside).
async function turnAgain(r, v, opts) {
  let res = await turn(r, v, opts);
  if (res && !res.heard && !r.noMic && alive(r)) {
    await say('I did not hear you. After the ding, say it nice and loud!');
    if (alive(r)) res = await turn(r, v, opts);
  }
  return res;
}

// Praise for effort and loudness only: the app never judges the words or the pitch.
async function cheer(r, v, res) {
  if (!res || !alive(r)) return;
  if (res.noMic) { sfx().sparkle(); return; } // nothing was measured: no praise for what nobody heard
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
// `words` false: no words under the picture (the mock audition and audition day).
async function warmUp(r, { words = true } = {}) {
  if (refDb !== null || !micOK || micDead || !canListen()) return;
  const v = view(S.warmup, 'Warm up!', 'Get your stage voice ready.', 0, { words });
  v.light(0, 1);
  v.turn('luna');
  await say('First, let\'s warm up your stage voice. Say hello to everybody, as big as you can!');
  if (!alive(r)) return;
  const res = await turnAgain(r, v, { lead: () => model(S.warmup, 0, 1, v), maxMs: 5000, endSilenceMs: 900 });
  if (!alive(r) || !res || !res.heard || res.peakDb === null) return;
  // Praise the loudness only when it was loud (-30 dB: a warm-up quieter than that does not lift the star's bar,
  // see bigVoiceThreshold). A quiet warm-up is praised for trying and asked for more, and on stage the star then
  // needs at least her warm-up's loudness (bar = her peak), never less than she was asked to beat.
  const gain = micGain(quietFloor(rooms));
  if (res.peakDb >= -30 + gain) { refDb = res.peakDb; v.turn('big'); sfx().sparkle(); await say('What a big voice! That is your stage voice.'); }
  else { refDb = res.peakDb + 6; v.turn('ok'); await say('Good warm-up! Let\'s make it even bigger on stage.'); }
}

// Three slow breaths, smell the flower and blow out the candle, with a bubble that grows and shrinks: a short calm
// ritual before every mock audition (and in the hallway on the day), never scored. Deep breaths just before a test
// lowered children's state anxiety and raised performance (Khng 2017, Cogn Emot 31:1502, ages 10-11); children of
// five or six can learn slow breathing (Zuanazzi Cruz et al. 2020, Altern Ther Health Med 26:14).
async function braveBreath(r) {
  const bubble = el('div', { class: 'bubble' });
  const label = el('div', { class: 'breath-cue', text: '🫧' });
  host.replaceChildren(el('div', { class: 'scene stage breath' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Brave breath' })])]),
    bubble, label
  ]));
  mark('luna');
  await say('Let\'s take three brave breaths.');
  for (let i = 0; i < 3 && alive(r); i++) {
    bubble.style.transitionDuration = '3000ms'; bubble.classList.remove('out'); bubble.classList.add('in'); label.textContent = '🌸';
    await Promise.all([say('Smell the flower.'), wait(3000)]); // ~2 s of quiet breathing after each cue, never more
    if (!alive(r)) return;
    bubble.style.transitionDuration = '3200ms'; bubble.classList.remove('in'); bubble.classList.add('out'); label.textContent = '🕯️';
    await Promise.all([say('Blow out the candle.'), wait(3200)]);
  }
  if (alive(r)) await say('Nice slow breaths. You can do this before every audition.');
}

// ---------- My Line, My Song ----------
async function practice(p) {
  const r = begin();
  const n = p.chunks.length, isSong = p.id === 'song';
  const done = stage().solos[p.id] || 0;
  const hidden = hiddenFromEnd(done, n); // pictures gone from the end, one more each practice
  const chain = done < 2;                // backward chaining only while it is new (see chainSteps)
  await readRoom(r);
  if (!alive(r)) return;
  await warmUp(r);
  if (!alive(r)) return;
  const real = isSong && !!song && chorusOK && !ctx.audio.muted; // the cast recording is loaded and playable
  const v = view(p, p.title, isSong ? 'The orphans\' song' : 'The orphans\' line', (done ? 1 : 0) + 1 + (chain ? n : 1) + (real ? 1 : 0) + 1);
  let step = 0;
  const soloOpts = lead => ({ lead, maxMs: p.maxMs, endSilenceMs: isSong ? 2500 : 1500, waitMs: estimateMs(blockText(p, 0, n)), follow: [p, 0, n] });
  v.light(0, n);
  v.turn('luna');
  await say(p.intro);
  if (!alive(r)) return;
  // From the second practice: try it from memory first, then hear it as feedback. Recall practice helps young
  // children when it is cued and followed straight away by the answer (Kliegl, Abel & Bäuml 2018, Front Psychol
  // 9:1446; Fritz et al. 2007, Q J Exp Psychol 60:991, preschoolers) and once they have had early success
  // (Káldi, Szőllősi & Racsmány 2025, Child Dev 96:1934, ages 5-6), so never in the first practice.
  if (done) {
    v.hideLast(hidden);
    v.turn('luna');
    await say(isSong ? 'Can you sing it before the orphans do? Try it from memory!' : 'Can you say it before Luna does? Try it from memory!');
    if (!alive(r)) return;
    const res = await turnAgain(r, v, soloOpts(null));
    await cheer(r, v, res);
    v.hideLast(0);
    v.progress(++step);
  }
  if (!alive(r)) return;
  v.turn('luna');
  if (real) await say('Listen to the orphans sing it.');
  if (!real || (alive(r) && await playSong(r, v, chorus(), 'song', p) === 'error')) {
    if (alive(r)) await say('Listen.');
    if (!alive(r)) return;
    await model(p, 0, n, v);
  }
  v.progress(++step);
  // Echo in clause-sized chunks: at six, a clause is one chunk and the limit is how many chunks (Gilchrist, Cowan
  // & Naveh-Benjamin 2009, J Exp Child Psychol 104:252; Cowan et al. 2010, Dev Psychol 46:1119).
  const echoes = chain ? chainSteps(n) : [[0, n]];
  for (const [i, j] of echoes) {
    if (!alive(r)) return;
    v.light(i, j);
    v.turn('luna');
    await say(!chain ? 'Say it all after me.' : i === n - 1 ? 'Let\'s learn it from the end. Say it after me.' : 'Now a little more. Say it after me.');
    if (!alive(r)) return;
    const text = blockText(p, i, j);
    const res = await turnAgain(r, v, { lead: () => model(p, i, j, v), maxMs: estimateMs(text), endSilenceMs: isSong ? 1500 : 1200, waitMs: estimateMs(text) * 0.6, follow: [p, i, j] });
    await cheer(r, v, res);
    v.progress(++step);
  }
  if (!alive(r)) return;
  v.light(0, n);
  v.act(p.act);
  await say(p.tip);
  // The words and the tune together: sing along, then alone (Welch, Sergeant & White 1998, Res Stud Music Educ
  // 10:67: at 5-7 the words come well before the pitch; Persellin 2006, Bull Counc Res Music Educ 169:39).
  if (real && alive(r)) {
    await say('Now sing along with the orphans!');
    await playSong(r, v, chorus(), 'sing', p);
    v.progress(++step);
  } else if (isSong && !song && alive(r)) await say('Sing it your way. A grown-up can add the real song for you.');
  if (!alive(r)) return;
  // her solo, with the pictures she still has; all gone, it is from memory
  v.hideLast(hidden);
  v.turn('luna');
  await say(hidden >= n ? (isSong ? 'Now sing it all by yourself, from memory!' : 'Now say it all by yourself, from memory!')
    : (isSong ? 'Now sing it all by yourself! Look at the pictures.' : 'Now say it all by yourself! Look at the pictures.'));
  if (!alive(r)) return;
  const res = await turnAgain(r, v, soloOpts(() => { v.turn('luna'); return say('Ready, set, go!'); }));
  // the practice counts once her solo is done, even if she leaves while it plays back
  if (res && alive(r)) { stage().solos[p.id] = done + 1; logPractice(stage(), ctx.economy.today(), p.id); ctx.economy.persist(); }
  await cheer(r, v, res);
  await keepTake(p.id, res);
  v.hideLast(0);
  if (res && res.blob && res.heard && alive(r)) {
    v.turn('luna');
    await say('Listen to you!');
    if (alive(r)) { v.turn('me'); await ctx.audio.clip(res.blob); }
    if (real && alive(r)) { v.turn('luna'); await say('Here are the orphans.'); if (await playSong(r, v, chorus(), 'song', p) === 'error' && alive(r)) await model(p, 0, n, v); }
    else {
      if (alive(r)) { v.turn('luna'); await say(isSong ? 'Here are the words again.' : 'And here is Luna.'); }
      if (alive(r)) await model(p, 0, n, v);
    }
  }
  if (!alive(r)) return;
  v.progress(++step);
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
  o.classList.add('below-bar');
  confetti(60); flyGems(gems); sfx().yay();
  mark('waiting');
  rest();
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
  // "just my part" only when the recording holds the chorus (else it would play nothing, or half of it)
  const part = chorusOK ? bigButton('🎵', () => { if (!guarded()) go(chorus()); }, 'soft') : null;
  if (part) part.setAttribute('aria-label', 'Just my part');
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'happy', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Hear the orphans' }), el('div', { class: 'line', text: 'Annie and the orphans sing It\'s the Hard-Knock Life.' })])]),
    el('div', { class: 'song-box' }, [big, bar]), el('div', { class: 'row hear-row' }, [part, bigButton('✅', () => { if (!guarded()) leave(); }, 'gold')])
  ]));
  let token = 0, dur = 1, since = 0, whole = false, heardMs = 0;
  // 45 s of the whole song in all counts as heard, however she leaves (Back, Home, the ✅) and whatever she taps
  // in between (the music note to hear her part starts a new play)
  const tally = () => { if (playing && whole) { heardMs += Date.now() - since; since = Date.now(); } if (heardMs >= 45000) markHeard(r); };
  r.onStop = tally;
  const go = async (range, toggle = false) => {
    if (toggle && playing) { song.stop(); return; }
    stopIdle();
    tally();
    const my = ++token;
    playing = true; big.textContent = '⏹';
    keepAwake();
    since = Date.now(); whole = !range.to;
    const how = await playSong(r, null, range);
    if (my !== token) return; // a newer play took over (and tallied this one)
    if (!alive(r)) return;
    tally();
    // ended: credit only if most of it was heard (a damaged file can jump to its end after a few seconds)
    const early = whole && how === 'ended' && heardMs < Math.min(45000, dur * 800);
    if (whole && how === 'ended' && !early) markHeard(r);
    playing = false; big.textContent = '▶';
    mark('waiting');
    rest();
    if (how === 'error') { say('The song will not play. Ask a grown-up to check it in Parent Corner.'); return; }
    if (early) { await say('The song stopped early. Ask a grown-up to check it in Parent Corner.'); if (alive(r) && !playing) idleNudge('Tap the big button to hear it again, or tap the yellow button when you are done.'); return; }
    if (how === 'ended' && !range.to) await say('Great listening!'); // the menu says what is next
    else if (how === 'ended') await say('That is your part!');
    if (alive(r) && !playing) idleNudge('Tap the big button to hear it again, or tap the yellow button when you are done.');
  };
  big.addEventListener('click', () => { if (!guarded()) go({}, true); });
  dur = await song.duration() || 1;
  const tick = setInterval(() => { if (!alive(r)) return clearInterval(tick); fill.style.width = Math.min(100, song.currentTime() / dur * 100) + '%'; }, 250);
  await say('Listen to the orphans sing the whole song! Sing along when you know the words.');
  if (part && alive(r)) await say('Tap the music note to hear just your part.');
  if (alive(r) && !playing) go({});
}
function markHeard(r) {
  if (r.counted) return;
  r.counted = true; stage().watched++; logPractice(stage(), ctx.economy.today(), 'hear'); ctx.economy.persist();
}

// ---------- Audition time! ----------
async function audition() {
  const r = begin();
  const s = stage(), firstTimes = s.auditions < 2;
  await readRoom(r); // first: the browser may have to ask for the microphone
  if (!alive(r)) return;
  const curtain = el('div', { class: 'stage-curtain' }, [el('div', { class: 'cl' }), el('div', { class: 'cr' }), el('div', { class: 'spot', text: '⭐' })]);
  host.replaceChildren(el('div', { class: 'scene stage' }, [el('div', { class: 'scene-head' }, [el('div', { class: 'title', text: 'Audition time!' })]), curtain]));
  mark('luna');
  await wait(80);
  if (!alive(r)) return;
  curtain.classList.add('open');
  await say('Audition time! This is just like the real one. Walk to the middle, stand tall, and smile!');
  if (!alive(r)) return;
  await warmUp(r, { words: false });
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
    const v = view(st.b, st.title, 'Audition', steps.length, { words: false });
    v.progress(k);
    v.light(0, n);
    if (st.hide) v.hide(true);
    v.turn('luna');
    await say(st.intro);
    if (!alive(r)) return;
    const res = await turnAgain(r, v, { lead: st.model ? () => model(st.b, 0, n, v) : null, maxMs: st.maxMs, endSilenceMs: st.endSilenceMs, waitMs: estimateMs(blockText(st.b, 0, n)), follow: [st.b, 0, n] });
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
  const playTakes = async () => {
    if (playing) return;
    playing = true; stopIdle();
    for (const b of takes) { if (!alive(r)) break; await ctx.audio.clip(b); await wait(350); }
    playing = false;
    if (alive(r)) idleNudge('Tap the yellow button!');
  };
  const hearBtn = bigButton('▶ 👧', playTakes, 'soft');
  hearBtn.setAttribute('aria-label', 'Hear my audition');
  const o = sheet([
    svgFrom(lunaSVG({ state: 'yay', glow: e.companion().level })),
    el('h2', { text: 'Bravo!' }),
    el('div', { class: 'sub', text: measured ? 'Big-voice stars: ' + ('⭐'.repeat(bigs) || 'next time!') : 'Take a bow!' }),
    takes.length ? hearBtn : null,
    bigButton('Yay!', () => { o.remove(); leave(); }, 'gold')
  ]);
  o.classList.add('below-bar');
  mark('waiting');
  rest();
  await say('Take a bow! You did the whole audition!');
  // her whole audition, played straight back (the replay button stays for later)
  if (takes.length && alive(r)) { await say('Listen to you!'); if (alive(r)) await playTakes(); }
  else if (alive(r)) idleNudge('Tap the yellow button!');
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
  if (!alive(r)) return;
  v.turn('luna');
  await say('Now say it after me, one little piece at a time.');
  for (let i = 0; i < n; i++) {
    if (!alive(r)) return;
    v.light(i, i + 1);
    const text = blockText(b, i, i + 1);
    const res = await turnAgain(r, v, { lead: () => model(b, i, i + 1, v), maxMs: estimateMs(text), endSilenceMs: 1200, waitMs: estimateMs(text) * 0.6, follow: [b, i, i + 1] });
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
  const res = await turnAgain(r, v, { lead: () => model(b, 0, n, v), maxMs: estimateMs(whole) + 2000, endSilenceMs: 1500, waitMs: estimateMs(whole) * 0.6, follow: [b, 0, n] });
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
  await warmUp(r, { words: false });
  if (!alive(r)) return;
  await braveBreath(r);
  if (!alive(r)) return;
  const line = piece('line'), songPiece = piece('song');
  let v = view(line, 'Your line', 'Audition day', 3, { words: false });
  v.light(0, line.chunks.length);
  v.hide(true);
  v.turn('luna');
  await say('Say your line one time, from memory.');
  if (!alive(r)) return;
  let res = await turnAgain(r, v, { maxMs: line.maxMs, endSilenceMs: 1500, waitMs: estimateMs(blockText(line, 0, line.chunks.length)), follow: [line, 0, line.chunks.length] });
  await cheer(r, v, res);
  if (!alive(r)) return;
  v = view(songPiece, 'Your song', 'Audition day', 3, { words: false });
  v.progress(1);
  v.light(0, songPiece.chunks.length);
  v.turn('luna');
  if (song && chorusOK && !ctx.audio.muted) {
    await say('Sing along with the orphans one time.');
    await playSong(r, v, chorus(), 'sing', songPiece);
  } else {
    await say('Sing your song one time, in your big stage voice.');
    if (!alive(r)) return;
    res = await turnAgain(r, v, { maxMs: songPiece.maxMs, endSilenceMs: 2500, waitMs: estimateMs(blockText(songPiece, 0, songPiece.chunks.length)), follow: [songPiece, 0, songPiece.chunks.length] });
    await cheer(r, v, res);
  }
  if (!alive(r)) return;
  logPractice(stage(), ctx.economy.today(), 'dayof'); // done once she has sung; the pep talk is a bonus
  ctx.economy.persist();
  v.progress(2);
  v.turn('luna');
  await say('You know your line and your song. Use your big stage voice, smile, and have fun. Luna is so proud of you!');
  if (!alive(r)) return;
  v.progress(3);
  finish(r, 3, 'You are ready!');
}

// ---------- menu ----------
// Muted: Luna cannot talk, so the menu is replaced by one big "sound on" button.
function showMuted() {
  stopIdle();
  mutedShown = true;
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'think', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Star Stage' }), el('div', { class: 'line', text: 'Luna needs the sound on.' })])]),
    el('button', { class: 'unmute', type: 'button', 'aria-label': 'Turn the sound on', text: '🔇 ➜ 🔊', onclick: () => { ctx.speech.setMuted(false); ctx.refreshBar && ctx.refreshBar(); showMenu(); } })
  ]));
  mark('waiting');
}

function noSong() {
  toast('🎧 A grown-up can add the song in Parent Corner.', 5000);
  return say('Ask a grown-up to add the song.');
}

// quiet: draw it without a word (the app just went into the background). afterTap: a button just closed the
// screen above it ("Yay!", ✅), so the second tap of a double tap would land on a tile: taps in the first 0.45 s
// are not choices.
function showMenu({ quiet = false, afterTap = false } = {}) {
  if (!host || !S) return;
  stopIdle();
  if (ctx.audio.muted) return showMuted();
  mutedShown = false;
  const my = ++menuToken;
  let launched = false; // two fingers on two buttons at once start one activity, not two
  const shownAt = afterTap ? Date.now() : 0;
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
    plan.length > 1 ? el('div', { class: 'plan-strip', 'aria-label': 'Today' }, plan.map(id => el('div', { class: 'plan-item' + (done[id] ? ' done' : '') + (id === next ? ' next' : '') }, [el('span', { text: ICON[id] }), done[id] ? el('b', { text: '✓' }) : null]))) : null,
    el('div', { class: 'encounters' }, tiles.map(m => el('button', { class: 'encounter-btn' + (m.id === next ? ' next-up' : '') + (m.wide ? ' primary' : '') + (m.off ? ' off' : ''), type: 'button', onclick: () => {
      if (launched || Date.now() - Math.max(shownAt, overlayTapAt) < 450) return;
      // the grey tile starts nothing: Luna explains, and the reminder about the glowing tile carries on
      if (m.off) { stopIdle(); m.run().then(() => { if (my === menuToken && !run && next) idleNudge(hint); }); return; }
      stopIdle(); launched = true; guardUntil = Date.now() + 450; m.run();
    } }, [
      el('div', { class: 'icon', text: ICON[m.id] }), el('div', { text: m.name }), done[m.id] ? el('div', { class: 'tick', text: '✓ today' }) : null
    ])))
  ]));
  mark('waiting');
  const glow = host.querySelector('.next-up');
  if (glow && glow.scrollIntoView) glow.scrollIntoView({ block: 'nearest' }); // the glowing tile is always on screen
  const hello = days > 0 ? 'Welcome to Star Stage! Let\'s get ready for your Annie audition.' : days === 0 ? 'Today is audition day! You can do it!' : 'Welcome to Star Stage!';
  const hint = HINT[next || (days < 0 ? 'free' : 'none')];
  if (quiet) return;
  if (padOpen()) { if (next) idleNudge(hint); return; } // held while the grown-ups' pad is up, said once it is gone
  const first = !greeted; greeted = true; // the long hello once a visit; back from an activity, just what is next
  say(first ? hello + ' ' + hint : hint).then(() => { if (my === menuToken && !run && next) idleNudge(hint); });
}

export async function mount(h, c) {
  host = h; ctx = c;
  const me = ++mountToken; // Back while this is still loading: unmount ran first, so stop and release here
  const gone = () => me !== mountToken;
  refDb = null; rooms = []; micOK = true; deaf = 0; mutedShown = false;
  probe = globalThis.__pq ? (globalThis.__pqStage = { state: 'menu', song: false, events: [] }) : null;
  [S, DUR] = await Promise.all([ctx.content.load('stage'), ctx.content.load('stage-audio').catch(() => ({}))]);
  if (gone()) return;
  refDb = null; greeted = false; chorusOK = false; micOpened = false; micDead = false; slowTold = false;
  const rec = ctx.store && ctx.store.get('stage', 'song-audio');
  let player = rec ? createSongPlayer(rec) : null;
  if (player) {
    // a file this device cannot play is set aside (Parent Corner says so); a short one is used only whole
    const d = await player.duration();
    if (gone()) { player.release(); return; }
    if (!d) { player.release(); player = null; }
    else chorusOK = d >= chorus().to;
  }
  song = player;
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', onTap);
  // the sound turned off (the top bar's button): stop what runs (alive() already stops it at its next step) and
  // show the sound-on screen; turned back on from the top bar: the menu again
  muteWatch = setInterval(() => {
    if (!host) return;
    if (ctx.audio.muted) { if (run) leave(); else if (!mutedShown) showMuted(); }
    else if (mutedShown) showMenu();
  }, 300);
  showMenu();
}
// Parent Corner's PIN pad opened over an activity: stop it, so nothing keeps talking or recording underneath.
export function interrupt() { if (run) leave(); }
export function unmount() {
  mountToken++;
  stopRun();
  clearInterval(muteWatch); muteWatch = null;
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('pointerdown', onTap);
  if (song) { song.release(); song = null; }
  host = null;
}
