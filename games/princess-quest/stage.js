// games/princess-quest/stage.js — Star Stage: practice for the Annie audition (Broadway at the J, grades K–5).
// She cannot read the audition sheet yet, so everything is by ear, with a picture for each chunk:
//   My Line / My Song: hear it whole, then backward chaining (the last chunk first, then the last two, up to
//     the whole thing; she says each one back), then all of it by herself with the pictures, and from the
//     third practice once more with the pictures hidden. Her take plays back, then Luna's model.
//     The song words are learned as a chant; the tune comes from Watch the orphans.
//   Watch the orphans: the film's number, embedded from YouTube (online only; nothing is copied into the app).
//   Audition time!: the real order (say hi, the line, the song, thank you), no coaching in between, then
//     applause and her whole audition played back.
// The microphone only listens for her voice: when she starts and stops, and how loud she is (never which
// words). A big voice lights the star, measured against her own warm-up shout, so it works on any device.
// Model clips: assets/audio/stage/ (tools/build-stage-audio.py). Her latest takes, and her first ones, are kept
// in the audio store (kind 'stage') for Parent Corner.
import { el, wait, pick, bigButton, sheet, confetti, toast } from '../../shared/ui.js';
import { lunaSVG, svgFrom } from '../../shared/characters.js';
import { flyGems } from '../../shared/encounter.js';
import { canListen, openMic } from '../../shared/mic.js';
import { clipId, chainSteps, daysUntil, logPractice, bigVoiceThreshold } from '../../shared/stage-plan.js';

let host = null, ctx = null, S = null;
let run = null;     // the activity in progress, { live }; Back or leaving the place turns it off
let refDb = null;   // her warm-up shout this visit (dB): the bar for a big voice
let micOK = true;   // false once the microphone is missing, refused or deaf (practice goes on without it)
let deaf = 0;       // turns in a row where the microphone heard nothing
let yt = null;      // the YouTube player while Watch is open

const THANKS = { id: 'thanks', chunks: [{ text: 'Thank you!', pic: '🙇' }] };
const BIG = ['Big stage voice!', 'Wow, the back row heard you!', 'Loud and clear. Bravo!'];
const MORE = ['Good! Now even bigger!', 'Nice! Use your big stage voice!'];
const NOMIC = ['Great job!', 'Wonderful!'];

const say = t => ctx.audio.say(t);
const sfx = () => ctx.audio.sfx || { sparkle() {}, yay() {}, ding() {}, applause() {} };
const named = t => t.replace(/\{name\}/g, ctx.economy.save.child.name);
const stage = () => ctx.economy.save.stage;
const alive = r => !!r && r === run && r.live;
const piece = id => S.pieces.find(p => p.id === id);
const blockText = (b, i, j) => named(b.chunks.slice(i, j).map(c => c.text).join(' '));
const estimateMs = text => 3000 + text.split(/\s+/).length * 900;

function begin() {
  stopRun();
  const r = { live: true };
  run = r;
  ctx.nav && ctx.nav.push(() => { stopRun(); document.querySelectorAll('.overlay').forEach(o => o.remove()); showMenu(); });
  return r;
}
function stopRun() {
  if (run) run.live = false;
  run = null;
  if (ctx) ctx.audio.stop();
  if (yt) { try { yt.destroy(); } catch {} yt = null; }
}
function leave() { stopRun(); ctx.nav && ctx.nav.pop(); showMenu(); }

// Luna's model of chunks i..j-1: the rendered clip, or the device voice if it will not load. The hello clip
// was made with the name Amelia; another name is said by the device voice.
async function model(b, i, j) {
  if (b.id === 'slate' && ctx.economy.save.child.name !== 'Amelia') return say(blockText(b, i, j));
  const r = await ctx.audio.clip('./assets/audio/stage/' + clipId(b.id, i, j) + '.ogg');
  if (r === false) await say(blockText(b, i, j));
}

// The practice screen: Luna, a title, one picture per chunk (tap to hear it), the microphone meter.
function view(b, title, sub = '') {
  let listening = false;
  const cues = b.chunks.map((c, i) => el('button', { class: 'cue', type: 'button', 'aria-label': named(c.text), onclick: () => { if (!listening && b.id !== 'thanks') model(b, i, i + 1); } }, [el('span', { text: c.pic })]));
  const cueRow = el('div', { class: 'cues' }, cues);
  const fill = el('div', { class: 'fill' });
  const star = el('div', { class: 'vstar', text: '⭐' });
  const status = el('div', { class: 'mic-status' });
  const mic = el('div', { class: 'mic' }, [el('div', { class: 'mic-icon', text: '🎤' }), el('div', { class: 'vmeter' }, [fill]), star]);
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: title }), el('div', { class: 'line', text: sub })])]),
    cueRow, mic, status
  ]));
  return {
    light(i, j) { cues.forEach((c, k) => { c.classList.toggle('lit', k >= i && k < j); c.classList.toggle('dim', k < i || k >= j); }); },
    hide(on) { cueRow.classList.toggle('curtain', on); },
    state(st, text = '') { mic.dataset.state = st; status.textContent = text; listening = st === 'live'; },
    level(db, thr) { fill.style.width = Math.round(Math.max(0, Math.min(1, (db + 60) / 50)) * 100) + '%'; star.classList.toggle('on', db >= thr); }
  };
}

// One turn for her. Opens the microphone and reads the room while it is quiet, runs `lead` (Luna's model or
// "Go!"), chimes, then records until she stops. Without a microphone it waits, so the practice still flows.
// Resolves { heard, peakDb (null = no microphone), big, blob } or null if she left.
async function turn(r, v, { lead = null, maxMs, endSilenceMs, waitMs = 4000 }) {
  let m = null;
  if (micOK && canListen()) {
    try { m = await openMic(); }
    catch (e) { micOK = false; console.warn('mic', e); toast('🎤 Ask a grown-up to allow the microphone.', 5000); }
  }
  const quit = () => { if (m) m.close(); return null; };
  if (!alive(r)) return quit();
  const floorDb = m ? await m.floor(250) : -60;
  if (!alive(r)) return quit();
  if (lead) await lead();
  if (!alive(r)) return quit();
  sfx().ding();
  v.state('live', '🎤 Your turn!');
  if (!m) { await wait(waitMs); v.state('idle'); return alive(r) ? { heard: true, peakDb: null, big: false, blob: null } : null; }
  const thr = bigVoiceThreshold(refDb);
  const res = await m.listen({ floorDb, maxMs, endSilenceMs, noVoiceMs: 7000, onLevel: db => v.level(db, thr), live: () => alive(r) });
  m.close();
  v.state('idle');
  v.level(-90, 0);
  if (!alive(r)) return null;
  deaf = res.heard ? 0 : deaf + 1;
  if (deaf >= 3) { micOK = false; toast('🎤 The microphone is not hearing anything. Practice goes on without it.', 5000); }
  return { ...res, big: res.heard && res.peakDb !== null && res.peakDb >= thr };
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
  if (res.big) { v.state('big', '⭐ Big voice!'); sfx().sparkle(); await say(pick(BIG)); }
  else { v.state('ok', 'Even bigger next time!'); await say(pick(MORE)); }
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
  await say('First, let\'s warm up your stage voice. Say hello to everybody, as big as you can!');
  if (!alive(r)) return;
  const res = await turnAgain(r, v, { lead: () => model(S.warmup, 0, 1), maxMs: 5000, endSilenceMs: 900 });
  if (!alive(r) || !res || !res.heard || res.peakDb === null) return;
  refDb = res.peakDb;
  v.state('big', '⭐');
  sfx().sparkle();
  await say('What a big voice! That is your stage voice.');
}

// ---------- My Line, My Song ----------
async function practice(p) {
  const r = begin();
  const n = p.chunks.length, song = p.id === 'song';
  await warmUp(r);
  if (!alive(r)) return;
  const v = view(p, p.title, song ? 'The orphans\' song' : 'The orphans\' line');
  v.light(0, n);
  await say(p.intro);
  if (!alive(r)) return;
  await say('Listen.');
  if (!alive(r)) return;
  await model(p, 0, n);
  for (const [i, j] of chainSteps(n)) {
    if (!alive(r)) return;
    v.light(i, j);
    await say(i === n - 1 ? 'Let\'s learn it from the end. Say it after me.' : 'Now a little more. Say it after me.');
    if (!alive(r)) return;
    const text = blockText(p, i, j);
    const res = await turnAgain(r, v, { lead: () => model(p, i, j), maxMs: estimateMs(text), endSilenceMs: song ? 1500 : 1200, waitMs: estimateMs(text) * 0.6 });
    await cheer(r, v, res);
  }
  if (!alive(r)) return;
  v.light(0, n);
  await say(p.tip);
  if (song && !stage().watched && alive(r)) await say('Watch the orphans sing it to learn the tune. For now, sing it your way!');
  if (!alive(r)) return;
  const solos = stage().solos[p.id] || 0;
  await say(song ? 'Now sing it all by yourself! Look at the pictures.' : 'Now say it all by yourself! Look at the pictures.');
  const solo = { lead: () => say('Ready, set, go!'), maxMs: p.maxMs, endSilenceMs: song ? 2500 : 1500, waitMs: estimateMs(blockText(p, 0, n)) };
  let res = await turnAgain(r, v, solo);
  await cheer(r, v, res);
  await keepTake(p.id, res);
  if (res && res.blob && res.heard && alive(r)) {
    await say('Listen to you!');
    if (alive(r)) await ctx.audio.clip(res.blob);
    if (alive(r)) await say(song ? 'Here are the words again.' : 'And here is Luna.');
    if (alive(r)) await model(p, 0, n);
  }
  if (solos >= 2 && alive(r)) {
    v.hide(true);
    await say('Now the hard one. Can you do it with no pictures?');
    res = await turnAgain(r, v, solo);
    await cheer(r, v, res);
    v.hide(false);
  }
  if (!alive(r)) return;
  stage().solos[p.id] = solos + 1;
  logPractice(stage(), ctx.economy.today(), p.id);
  finish(r, 2, song ? 'You practiced your song!' : 'You practiced your line!');
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
  const frame = el('div', { class: 'yt' });
  const note = el('div', { class: 'line' });
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'happy', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Watch the orphans' }), el('div', { class: 'line', text: 'Annie and the orphans sing It\'s the Hard-Knock Life.' })])]),
    frame, note,
    el('div', { class: 'row' }, [bigButton('All done', leave, 'gold')])
  ]));
  say('Watch the orphans sing! Sing along when you know the words.');
  const cannot = text => { if (!alive(r)) return; note.textContent = text; frame.hidden = true; };
  if (navigator.onLine === false) return cannot('The video needs the internet. Ask a grown-up to turn on Wi-Fi.');
  let YT;
  try { YT = await loadYT(); } catch { return cannot('The video needs the internet. Ask a grown-up to turn on Wi-Fi.'); }
  if (!alive(r)) return;
  let k = 0, counted = false;
  const make = () => {
    const slot = el('div');
    frame.replaceChildren(slot);
    yt = new YT.Player(slot, {
      videoId: S.videos[k], width: '100%', height: '100%', host: 'https://www.youtube-nocookie.com',
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onStateChange: e => {
          if (e.data !== YT.PlayerState.PLAYING || counted) return;
          counted = true;
          ctx.audio.stop();
          setTimeout(() => { if (!alive(r)) return; stage().watched++; logPractice(stage(), ctx.economy.today(), 'watch'); ctx.economy.persist(); }, 45000);
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

// ---------- Audition time! ----------
async function audition() {
  const r = begin();
  const s = stage(), firstTimes = s.auditions < 2;
  const curtain = el('div', { class: 'stage-curtain' }, [el('div', { class: 'cl' }), el('div', { class: 'cr' }), el('div', { class: 'spot', text: '⭐' })]);
  host.replaceChildren(el('div', { class: 'scene stage' }, [el('div', { class: 'scene-head' }, [el('div', { class: 'title', text: 'Audition time!' })]), curtain]));
  await wait(80);
  curtain.classList.add('open');
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
  for (const st of steps) {
    if (!alive(r)) return;
    const n = st.b.chunks.length;
    const v = view(st.b, st.title, 'Audition');
    v.light(0, n);
    if (st.hide) v.hide(true);
    await say(st.intro);
    if (!alive(r)) return;
    const res = await turnAgain(r, v, { lead: st.model ? () => model(st.b, 0, n) : null, maxMs: st.maxMs, endSilenceMs: st.endSilenceMs, waitMs: estimateMs(blockText(st.b, 0, n)) });
    if (!alive(r)) return;
    if (res && res.peakDb !== null) measured = true;
    if (res && res.big) { bigs++; v.state('big', '⭐'); }
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
  const next = !s.watched ? 'watch' : !done.line ? 'line' : !done.song ? 'song' : !done.audition ? 'audition' : null;
  const modes = [
    { id: 'line', icon: '🗣️', name: 'My Line', run: () => practice(piece('line')) },
    { id: 'song', icon: '🎵', name: 'My Song', run: () => practice(piece('song')) },
    { id: 'watch', icon: '🎬', name: 'Watch the orphans', run: watch },
    { id: 'audition', icon: '⭐', name: 'Audition time!', run: audition }
  ];
  host.replaceChildren(el('div', { class: 'scene stage' }, [
    el('div', { class: 'scene-head' }, [svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level })), el('div', {}, [el('div', { class: 'title', text: 'Star Stage' }), el('div', { class: 'line', text: sub })])]),
    el('div', { class: 'encounters' }, modes.map(m => el('button', { class: 'encounter-btn' + (m.id === next ? ' next-up' : ''), type: 'button', onclick: m.run }, [
      el('div', { class: 'icon', text: m.icon }), el('div', { text: m.name }), done[m.id] ? el('div', { class: 'tick', text: '✓ today' }) : null
    ])))
  ]));
  say(days > 0 ? 'Welcome to Star Stage! Let\'s get ready for your Annie audition.' : days === 0 ? 'Today is audition day! You can do it!' : 'Welcome to Star Stage!');
}

export async function mount(h, c) {
  host = h; ctx = c;
  S = await ctx.content.load('stage');
  showMenu();
}
export function unmount() { stopRun(); host = null; }
