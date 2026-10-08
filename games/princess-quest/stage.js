// games/princess-quest/stage.js — Star Stage: practice for the Annie audition (Broadway at the J, grades K–5).
// She cannot read the audition sheet yet, so everything is by ear, with a picture for each chunk:
//   My Line / My Song: hear it whole, then backward chaining (the last chunk first, then the last two, up to
//     the whole thing; she says each one back), then all of it by herself with the pictures, and from the
//     third practice once more with the pictures hidden. Her take plays back, then Luna's model.
//     The song words are learned as a chant; the tune comes from Watch the orphans.
//   Watch the orphans: the film's number, embedded from YouTube (online only; nothing is copied into the app).
//     If a grown-up loaded the cast recording in Parent Corner (it stays on this device), it becomes Hear the
//     orphans, offline, and My Song uses the real sung chorus: to listen first, to sing along, and after her solo.
//   Audition time!: the real order (say hi, the line, the song, thank you), no coaching in between, then
//     applause and her whole audition played back.
// Whose turn it is always shows: Luna's (an ear, Luna bobbing, each picture lighting up as Luna says it) or hers
// (a red microphone after a chime). The flow is hands-free, so the pictures are not buttons (a tap used to cut
// Luna off and record her as the child's take), and the screen is kept awake while it runs.
// The microphone only listens for her voice: when she starts and stops, and how loud she is (never which
// words). A big voice lights the star, measured against her own warm-up shout, so it works on any device.
// Model clips: assets/audio/stage/ (tools/build-stage-audio.py, durations in content/stage-audio.json). Her
// latest takes, and her first ones, are kept in the audio store (kind 'stage') for Parent Corner.
import { el, wait, pick, bigButton, sheet, confetti, toast } from '../../shared/ui.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';
import { flyGems } from '../../shared/encounter.js';
import { canListen, openMic } from '../../shared/mic.js';
import { createSongPlayer } from '../../shared/songclip.js';
import { clipId, chainSteps, daysUntil, logPractice, bigVoiceThreshold, followTimes, dayStrip } from '../../shared/stage-plan.js';

let host = null, ctx = null, S = null, DUR = {};
let run = null;     // the activity in progress, { live, noMic }; Back, Home or leaving the place turns it off
// This visit (reset in mount): her warm-up shout (the bar for a big voice), the room's quiet level, whether the
// microphone may be used at all (no device, or permission refused), and whether the video failed.
let refDb = null, roomDb = null, micOK = true, watchFailed = false;
let deaf = 0;       // turns in a row in this activity where the microphone heard nothing
let yt = null;      // the YouTube player while Watch is open
let wake = null;    // screen wake lock while an activity runs (it is hands-free for minutes at a time)
let song = null;    // the cast recording from Parent Corner (shared/songclip.js), or null
const CHIME_MS = 350; // the chime is over before recording starts, so it is never in her take or taken for her

const THANKS = { id: 'thanks', chunks: [{ text: 'Thank you!', pic: '🙇' }] };
const BIG = ['Big stage voice!', 'Wow, the back row heard you!', 'Loud and clear. Bravo!'];
const MORE = ['Good! Now even bigger!', 'Nice! Use your big stage voice!'];
const NOMIC = ['Great job!', 'Wonderful!'];
// what Luna says on the menu about the glowing button (she cannot read the labels)
const HINT = {
  watch: 'First, watch the orphans sing. Tap the glowing button!',
  hear: 'First, listen to the orphans sing. Tap the glowing button!',
  line: 'Tap the glowing button to practice your line!',
  song: 'Tap the glowing button to practice your song!',
  audition: 'Tap the glowing button for audition time!',
  none: 'You did everything today. Bravo!'
};

const say = t => ctx.audio.say(t, { story: true }); // Luna's own voice, the one that models the line
const sfx = () => ctx.audio.sfx || { sparkle() {}, yay() {}, ding() {}, applause() {} };
const named = t => t.replace(/\{name\}/g, ctx.economy.save.child.name);
const stage = () => ctx.economy.save.stage;
const alive = r => !!r && r === run && r.live;
const piece = id => S.pieces.find(p => p.id === id);
const blockText = (b, i, j) => named(b.chunks.slice(i, j).map(c => c.text).join(' '));
const estimateMs = text => 3000 + text.split(/\s+/).length * 900;
const clearOverlays = () => document.querySelectorAll('.overlay').forEach(o => o.remove());

function begin() {
  stopRun();
  const r = { live: true, noMic: false };
  run = r; deaf = 0;
  ctx.nav && ctx.nav.push(() => { stopRun(); clearOverlays(); showMenu(); });
  keepAwake();
  return r;
}
function stopRun() {
  if (run) run.live = false;
  run = null;
  if (ctx) ctx.audio.stop();
  if (yt) { try { yt.destroy(); } catch {} yt = null; }
  if (song) song.stop();
  if (wake) { wake.release().catch(() => {}); wake = null; }
}
function leave() { stopRun(); clearOverlays(); ctx.nav && ctx.nav.pop(); showMenu(); }
async function keepAwake() {
  try { if (navigator.wakeLock && !wake) wake = await navigator.wakeLock.request('screen'); } catch { wake = null; }
}
// Home button, app switch or screen off in the middle of an activity: stop (no recording in the background)
// and wait on the menu.
function onVisibility() { if (document.hidden && run) leave(); }

function micGone(e) {
  micOK = false;
  console.warn('mic', e);
  toast('🎤 Ask a grown-up to allow the microphone.', 5000);
  return say('Ask a grown-up to turn on the microphone.');
}

// The room's quiet level, read once at the start of an activity while nothing plays. The first time ever, this
// is also where the browser asks for the microphone.
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
  const timers = v ? followTimes(b.chunks.slice(i, j).map(c => c.text), DUR[id] || 0).map((at, k) => setTimeout(() => v.now(i + k), at)) : [];
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
  return song.play(range); // 'ended' or 'stopped'
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
  const status = el('div', { class: 'mic-status' });
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
    progress(done) { dots.replaceChildren(...Array.from({ length: steps }, (_, n) => el('span', { class: n < done ? 'done' : n === done ? 'current' : '' }))); },
    // 'luna' (listen), 'song' (listen to the orphans), 'sing' (sing along with them), 'you' (her turn),
    // 'big' / 'ok' (how her turn went), 'idle'
    turn(t) {
      mic.dataset.state = t;
      icon.textContent = t === 'you' ? '🎤' : t === 'big' ? '🌟' : t === 'song' || t === 'sing' ? '🎶' : '👂';
      status.textContent = { you: '🎤 Your turn!', luna: '👂 Listen to Luna', song: '🎶 Listen to the orphans', sing: '🎶 Sing along!', big: '⭐ Big voice!', ok: 'Even bigger next time!' }[t] || '';
      luna.classList.toggle('talking', t === 'luna');
    },
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
    const res = await m.listen({ floorDb: roomDb === null ? -60 : roomDb, maxMs, endSilenceMs, noVoiceMs: 7000, onLevel: db => v.level(db, thr), live: () => alive(r) });
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

// ---------- My Line, My Song ----------
async function practice(p) {
  const r = begin();
  const n = p.chunks.length, isSong = p.id === 'song';
  const solos = stage().solos[p.id] || 0, hard = solos >= 2;
  await readRoom(r);
  if (!alive(r)) return;
  await warmUp(r);
  if (!alive(r)) return;
  const real = isSong && !!song && !ctx.audio.muted; // the cast recording is loaded
  const v = view(p, p.title, isSong ? 'The orphans\' song' : 'The orphans\' line', 1 + n + (real ? 1 : 0) + 1 + (hard ? 1 : 0));
  let step = 0;
  v.light(0, n);
  v.turn('luna');
  await say(p.intro);
  if (!alive(r)) return;
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
  v.turn('luna');
  await say(p.tip);
  if (real && alive(r)) {
    // the tune: sing along with the orphans before singing alone
    await say('Now sing along with the orphans!');
    await playSong(r, v, chorus(), 'sing');
    v.progress(++step);
  } else if (isSong && !stage().watched && alive(r)) await say('Watch the orphans sing it to learn the tune. For now, sing it your way!');
  if (!alive(r)) return;
  await say(isSong ? 'Now sing it all by yourself! Look at the pictures.' : 'Now say it all by yourself! Look at the pictures.');
  if (!alive(r)) return;
  const solo = { lead: () => { v.turn('luna'); return say('Ready, set, go!'); }, maxMs: p.maxMs, endSilenceMs: isSong ? 2500 : 1500, waitMs: estimateMs(blockText(p, 0, n)) };
  let res = await turnAgain(r, v, solo);
  await cheer(r, v, res);
  await keepTake(p.id, res);
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
  v.progress(++step);
  if (hard && alive(r)) {
    v.hide(true);
    v.turn('luna');
    await say('Now the hard one. Can you do it with no pictures?');
    if (!alive(r)) return;
    res = await turnAgain(r, v, solo);
    await cheer(r, v, res);
    await keepTake(p.id, res);
    v.hide(false);
    v.progress(++step);
  }
  if (!alive(r)) return;
  stage().solos[p.id] = solos + 1;
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
  say(line + ' You did it!');
}

// ---------- Watch the orphans ----------
let ytLoading = null;
function loadYT() {
  if (globalThis.YT && globalThis.YT.Player) return Promise.resolve(globalThis.YT);
  if (ytLoading) return ytLoading;
  ytLoading = new Promise((resolve, reject) => {
    const fail = err => { ytLoading = null; reject(err); };
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { s.remove(); fail(new Error('YouTube did not load')); };
    document.head.appendChild(s);
    setTimeout(() => fail(new Error('YouTube timed out')), 15000);
  });
  return ytLoading;
}

async function watch() {
  const r = begin();
  const frame = el('div', { class: 'yt loading' }, [el('div', { class: 'yt-wait', text: '🎬' })]);
  const note = el('div', { class: 'line' });
  const markWatched = () => { if (!r.counted && alive(r)) { r.counted = true; stage().watched++; logPractice(stage(), ctx.economy.today(), 'watch'); ctx.economy.persist(); } };
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'happy', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Watch the orphans' }), el('div', { class: 'line', text: 'Annie and the orphans sing It\'s the Hard-Knock Life.' })])]),
    frame, note,
    el('div', { class: 'row' }, [bigButton('All done', leave, 'gold')])
  ]));
  say('Watch the orphans sing! Sing along when you know the words.');
  // she cannot read the note, so Luna says it, and the menu stops pointing at the video for this visit
  const cannot = text => { if (!alive(r)) return; watchFailed = true; note.textContent = text; frame.hidden = true; say(text); };
  if (navigator.onLine === false) return cannot('The video needs the internet. Ask a grown-up to turn on Wi-Fi.');
  let YT;
  try { YT = await loadYT(); } catch { return cannot('The video needs the internet. Ask a grown-up to turn on Wi-Fi.'); }
  if (!alive(r)) return;
  let k = 0;
  const make = () => {
    const slot = el('div');
    frame.replaceChildren(slot);
    yt = new YT.Player(slot, {
      videoId: S.videos[k], width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => frame.classList.remove('loading'),
        onStateChange: e => {
          if (e.data === YT.PlayerState.PLAYING && !r.playing) {
            r.playing = true;
            ctx.audio.stop();
            setTimeout(markWatched, 45000);
          }
          // the end screen suggests other videos that leave the app: replace it with "watch again"
          if (e.data === YT.PlayerState.ENDED && alive(r)) {
            markWatched();
            if (yt) { try { yt.destroy(); } catch {} yt = null; }
            r.playing = false;
            frame.replaceChildren(el('button', { class: 'yt-again', type: 'button', 'aria-label': 'Watch again', text: '▶', onclick: make }));
            say('Great watching! Now practice your song.');
          }
        },
        // a clip that was taken down or cannot be embedded: try the next one
        onError: () => {
          if (yt) { try { yt.destroy(); } catch {} yt = null; }
          k++;
          if (k < S.videos.length && alive(r)) make(); else cannot('The video would not play. Ask a grown-up.');
        }
      }
    });
  };
  make();
}

// Hear the orphans: the whole number from the recording on this device (offline, no YouTube, nothing to tap
// that leaves the app). Big play / stop, a bar that fills, and "just my part" for the audition chorus.
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
    const my = ++token;
    playing = true; big.textContent = '⏹';
    const t0 = Date.now();
    const how = await playSong(r, null, range);
    if (my !== token) return; // a newer play took over
    playing = false; big.textContent = '▶';
    if (!alive(r) || range.to) return;
    if (how === 'ended' || Date.now() - t0 > 45000) markHeard(r);
    if (how === 'ended') say('Great listening! Now practice your song.');
  };
  big.addEventListener('click', () => go({}, true));
  await say('Listen to the orphans sing the whole song! Sing along when you know the words.');
  if (alive(r) && !playing) go({});
}
function markHeard(r) {
  if (r.counted || !alive(r)) return;
  r.counted = true; stage().watched++; logPractice(stage(), ctx.economy.today(), 'watch'); ctx.economy.persist();
}

// ---------- Audition time! ----------
async function audition() {
  const r = begin();
  const s = stage(), firstTimes = s.auditions < 2;
  const curtain = el('div', { class: 'stage-curtain' }, [el('div', { class: 'cl' }), el('div', { class: 'cr' }), el('div', { class: 'spot', text: '⭐' })]);
  host.replaceChildren(el('div', { class: 'scene stage' }, [el('div', { class: 'scene-head' }, [el('div', { class: 'title', text: 'Audition time!' })]), curtain]));
  await wait(80);
  if (!alive(r)) return;
  curtain.classList.add('open');
  await readRoom(r);
  if (!alive(r)) return;
  await say('Audition time! This is just like the real one. Walk to the middle, stand tall, and smile!');
  if (!alive(r)) return;
  await wait(600);
  await warmUp(r);
  if (!alive(r)) return;
  const line = piece('line'), song = piece('song');
  const steps = [
    { b: S.slate, key: 'slate', title: 'Say hi!', intro: firstTimes ? 'First, say hi to the director, like this.' : 'First, say hi to the director.', model: firstTimes, maxMs: 12000, endSilenceMs: 1500 },
    { b: line, key: 'line', title: 'Your line', intro: 'Now your line!', hide: !firstTimes, maxMs: line.maxMs, endSilenceMs: 1500 },
    { b: song, key: 'song', title: 'Your song', intro: 'Now your song! Take a big breath.', hide: !firstTimes, maxMs: song.maxMs, endSilenceMs: 2500 },
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
  const hear = bigButton('▶ Hear my audition', async () => {
    if (playing) return;
    playing = true;
    for (const b of takes) { if (!alive(r)) break; await ctx.audio.clip(b); await wait(350); }
    playing = false;
  }, 'soft');
  const o = sheet([
    svgFrom(lunaSVG({ state: 'yay', glow: e.companion().level })),
    el('h2', { text: 'Bravo!' }),
    el('div', { class: 'sub', text: measured ? 'Big-voice stars: ' + ('⭐'.repeat(bigs) || 'next time!') : 'Take a bow!' }),
    takes.length ? hear : null,
    bigButton('Yay!', () => { o.remove(); leave(); }, 'gold')
  ]);
  await say('Take a bow! You were wonderful!');
}

// ---------- menu ----------
function showMenu() {
  if (!host || !S) return;
  const s = stage(), today = ctx.economy.today(), done = s.days[today] || {};
  const days = daysUntil(today, S.auditionDate);
  const sub = days > 1 ? 'Your Annie audition is in ' + days + ' days.' : days === 1 ? 'Your Annie audition is tomorrow!' : days === 0 ? 'Audition day! You can do it!' : 'Keep shining for the Annie show!';
  // the next thing to do today glows: the clip first (she has never heard the song), then line, song, audition
  const canWatch = !!song || (!watchFailed && navigator.onLine !== false);
  const next = !s.watched && canWatch ? 'watch' : !done.line ? 'line' : !done.song ? 'song' : !done.audition ? 'audition' : null;
  const modes = [
    { id: 'line', icon: '🗣️', name: 'My Line', run: () => practice(piece('line')) },
    { id: 'song', icon: '🎵', name: 'My Song', run: () => practice(piece('song')) },
    song ? { id: 'watch', icon: '🎧', name: 'Hear the orphans', run: hear } : { id: 'watch', icon: '🎬', name: 'Watch the orphans', run: watch },
    { id: 'audition', icon: '⭐', name: 'Audition time!', run: audition }
  ];
  // the days up to the audition, a star on each day she practiced: she counts circles, not "5 days"
  const practiced = new Set(Object.keys(s.days).filter(d => Object.keys(s.days[d]).length));
  const strip = dayStrip(today, S.auditionDate, practiced);
  const ICON = { done: '⭐', missed: '·', today: '✨', future: '', audition: '🎭' };
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Star Stage' }), el('div', { class: 'line', text: sub })])]),
    strip.length ? el('div', { class: 'day-strip', 'aria-label': sub }, strip.map(d => el('div', { class: 'day ' + d.kind + (d.today ? ' is-today' : ''), text: ICON[d.kind] }))) : null,
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.id === next ? ' next-up' : ''), type: 'button', onclick: m.run }, [
      el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name }), done[m.id] ? el('div', { class: 'tick', text: '✓ today' }) : null
    ])))
  ]));
  const hello = days > 0 ? 'Welcome to Star Stage! Let\'s get ready for your Annie audition.' : days === 0 ? 'Today is audition day! You can do it!' : 'Welcome to Star Stage!';
  say(hello + ' ' + HINT[next === 'watch' && song ? 'hear' : next || 'none']);
}

export async function mount(h, c) {
  host = h; ctx = c;
  refDb = null; roomDb = null; micOK = true; watchFailed = false; deaf = 0;
  [S, DUR] = await Promise.all([ctx.content.load('stage'), ctx.content.load('stage-audio').catch(() => ({}))]);
  const rec = ctx.store && ctx.store.get('stage', 'song-audio');
  song = rec ? createSongPlayer(rec) : null;
  document.addEventListener('visibilitychange', onVisibility);
  showMenu();
}
export function unmount() { stopRun(); document.removeEventListener('visibilitychange', onVisibility); if (song) { song.release(); song = null; } host = null; }
