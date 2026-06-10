// ==================== AMELIA'S PRINCESS WORLD — CORE ====================
// State, speech, sound, celebrations, navigation, rewards. Loaded after data.js.

// ---------- MODULE REGISTRY ----------
const Modules = {};
function registerModule(name, mod) { Modules[name] = mod; if (mod.init) mod.init(); }

// ---------- TIMER REGISTRY ----------
let activityTimers = [];
function addTimer(id) { activityTimers.push(id); return id; }
function setActivityTimer(fn, delay) { return addTimer(setTimeout(fn, delay)); }
function clearAllTimers() { activityTimers.forEach(id => clearTimeout(id)); activityTimers = []; }

// ---------- STATE ----------
const STATE_KEY = 'ameliaWorld1';
const DEFAULT_STATE = {
  name: 'Amelia',
  parentPin: '1234',
  narrationOn: true,
  speechRate: 0.82,
  letterStars: {},        // letter -> 0..3 (shown as flowers in the garden)
  activityStars: {},      // activityId -> best 1..3
  activityPlays: {},      // activityId -> times completed
  lettersPracticed: [],   // unique letters interacted with
  numbersPracticed: [],   // unique numerals answered correctly
  stickers: [],           // earned sticker ids (duplicates allowed when complete)
  rooms: { throne: [], bedroom: [], garden: [] },  // [{id, x, y}] in % of room
  unicorn: { fed: 0, brushed: 0, hugged: 0 },
  dressup: { dress: 0, crown: 0, shoes: 0, pet: 0 },
  totalActivities: 0,
  activeDays: [],
  startDate: new Date().toISOString()
};

let state;
try {
  state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || JSON.parse(JSON.stringify(DEFAULT_STATE));
} catch (e) {
  console.warn('State corrupted, starting fresh:', e);
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
}
Object.keys(DEFAULT_STATE).forEach(k => {
  if (!(k in state)) {
    state[k] = typeof DEFAULT_STATE[k] === 'object' && DEFAULT_STATE[k] !== null
      ? JSON.parse(JSON.stringify(DEFAULT_STATE[k]))
      : DEFAULT_STATE[k];
  }
});

function saveState() {
  const todayISO = new Date().toISOString().slice(0, 10);
  if (!state.activeDays.includes(todayISO)) state.activeDays.push(todayISO);
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed:', e); }
  updateStickerCount();
}

function kidName() { return state.name || 'Princess'; }
function withName(text) { return text.replace(/\{name\}/g, kidName()); }
function pickLine(pool) { return withName(pool[Math.floor(Math.random() * pool.length)]); }

function updateStickerCount() {
  const el = document.getElementById('sticker-count');
  if (el) el.textContent = state.stickers.length;
}

// ---------- SOUND ----------
let soundMuted = localStorage.getItem('aw-sound-muted') === 'true';
let musicMuted = localStorage.getItem('aw-music-muted') === 'true';
let audioCtx;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNote(ctx, freq, type, startTime, duration, volume) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o2.connect(g2); g2.connect(ctx.destination);
  o.frequency.value = freq;
  o.type = type || 'triangle';
  o2.frequency.value = freq * 2;
  o2.type = 'sine';
  const t = startTime;
  const vol = volume || 0.08;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.12);
  g.gain.linearRampToValueAtTime(vol * 0.4, t + duration * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(vol * 0.15, t + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.8);
  o.start(t); o.stop(t + duration + 0.05);
  o2.start(t); o2.stop(t + duration + 0.05);
}

function playSound(type) {
  if (soundMuted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    if (type === 'correct') {
      [523, 659, 784, 1047].forEach((freq, i) => playNote(ctx, freq, 'triangle', t + i * 0.09, 0.35, 0.07));
    } else if (type === 'module-enter') {
      [392, 523, 659].forEach((freq, i) => playNote(ctx, freq, 'sine', t + i * 0.12, 0.4, 0.06));
    } else if (type === 'gentle') {
      // Soft, neutral "hmm" — deliberately NOT a sad/failure sound.
      playNote(ctx, 440, 'sine', t, 0.25, 0.04);
      playNote(ctx, 494, 'sine', t + 0.18, 0.3, 0.04);
    } else if (type === 'reward') {
      [523, 659, 784].forEach((freq, i) => playNote(ctx, freq, 'triangle', t + i * 0.08, 0.4, 0.06));
      playNote(ctx, 1047, 'sine', t + 0.3, 0.5, 0.08);
      playNote(ctx, 1318, 'sine', t + 0.4, 0.45, 0.05);
    } else if (type === 'pop') {
      playNote(ctx, 660 + Math.random() * 220, 'triangle', t, 0.15, 0.06);
    } else if (type === 'click') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(800, t);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      o.type = 'sine';
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t); o.stop(t + 0.1);
    }
  } catch (e) {}
}

function toggleSound() {
  soundMuted = !soundMuted;
  localStorage.setItem('aw-sound-muted', soundMuted);
  updateSoundButtons();
  if (!soundMuted) playSound('click');
}

function toggleMusic() {
  musicMuted = !musicMuted;
  localStorage.setItem('aw-music-muted', musicMuted);
  updateSoundButtons();
  if (musicMuted) stopBgMusic();
  else startBgMusic();
}

function updateSoundButtons() {
  const sb = document.getElementById('sound-btn');
  const mb = document.getElementById('music-btn');
  if (sb) { sb.textContent = soundMuted ? '🔇' : '🔊'; sb.classList.toggle('muted', soundMuted); }
  if (mb) { mb.textContent = musicMuted ? '🎵' : '🎶'; mb.classList.toggle('muted', musicMuted); }
}

// ---------- BACKGROUND MUSIC ----------
let bgMusicCtx, bgMusicTimer, bgMusicPlaying = false;

function startBgMusic() {
  if (musicMuted || bgMusicPlaying) return;
  try {
    if (!bgMusicCtx) bgMusicCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bgMusicGain = bgMusicCtx.createGain();
    bgMusicGain.gain.setValueAtTime(0.03, bgMusicCtx.currentTime);
    bgMusicGain.connect(bgMusicCtx.destination);
    const notes = [262, 330, 392, 523, 392, 330];
    let noteIdx = 0;
    bgMusicPlaying = true;
    function playBgNote() {
      if (!bgMusicPlaying || musicMuted) return;
      const osc = bgMusicCtx.createOscillator();
      const noteGain = bgMusicCtx.createGain();
      osc.connect(noteGain); noteGain.connect(bgMusicGain);
      osc.frequency.value = notes[noteIdx % notes.length];
      osc.type = 'sine';
      noteGain.gain.setValueAtTime(0.08, bgMusicCtx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.001, bgMusicCtx.currentTime + 2.5);
      osc.start(); osc.stop(bgMusicCtx.currentTime + 2.8);
      noteIdx++;
      bgMusicTimer = setTimeout(playBgNote, 2400);
    }
    playBgNote();
  } catch (e) {}
}

function stopBgMusic() { bgMusicPlaying = false; clearTimeout(bgMusicTimer); }

document.addEventListener('click', function initMusic() {
  if (!musicMuted) startBgMusic();
  document.removeEventListener('click', initMusic);
}, { once: true });

// ---------- SPEECH ----------
let selectedVoice = null;
function loadVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  const prioritized = ['google us english', 'google uk english female', 'jenny', 'aria', 'ana', 'samantha', 'karen', 'moira', 'zira', 'hazel', 'female'];
  for (const pref of prioritized) {
    const match = voices.find(v => v.name.toLowerCase().includes(pref) && v.lang.startsWith('en'));
    if (match) { selectedVoice = match; return; }
  }
  const english = voices.filter(v => v.lang.startsWith('en'));
  const notMale = english.filter(v => !/(david|mark|james|daniel|george|richard|guy)/i.test(v.name));
  selectedVoice = notMale[0] || english[0] || voices[0];
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoice;
  setTimeout(loadVoice, 100);
  loadVoice();
}

let speakQueue = [];
let speakPoll = null;
let chromeKeepAlive = null;

function speak(text) {
  if (!('speechSynthesis' in window) || state.narrationOn === false) return;
  speechSynthesis.cancel();
  speakQueue = [];
  clearInterval(speakPoll);
  clearInterval(chromeKeepAlive);
  const cleanText = withName(text)
    .replace(/[\u{1F300}-\u{1FAF8}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  if (!cleanText) return;
  const chunks = cleanText.match(/[^.!?,;:—]+[.!?,;:—]+|[^.!?,;:—]+$/g) || [cleanText];
  speakQueue = chunks.map(s => s.trim()).filter(s => s);
  speakNext();
}

function speakNext() {
  clearInterval(speakPoll);
  clearInterval(chromeKeepAlive);
  if (!speakQueue.length) return;
  const s = speakQueue.shift();
  const u = new SpeechSynthesisUtterance(s);
  u.rate = state.speechRate || 0.82; u.pitch = 1.08; u.volume = 0.92;
  if (selectedVoice) u.voice = selectedVoice;
  speechSynthesis.speak(u);
  // Chrome keepalive: pause/resume to prevent 15s cutoff
  chromeKeepAlive = setInterval(() => {
    if (speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); }
  }, 10000);
  speakPoll = setInterval(() => {
    if (!speechSynthesis.speaking) {
      clearInterval(speakPoll);
      clearInterval(chromeKeepAlive);
      speakNext();
    }
  }, 200);
}

function stopSpeech() {
  speakQueue = [];
  clearInterval(speakPoll);
  clearInterval(chromeKeepAlive);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// Speak a letter's sound: "mmm! m says mmm, like moon."
function speakSound(letterKey, wordIdx) {
  const ld = LETTERS[letterKey];
  if (!ld) return;
  const w = ld.words[wordIdx != null ? wordIdx : Math.floor(Math.random() * ld.words.length)];
  const where = ld.endSound ? 'at the end of' : 'like';
  speak(ld.sound + '! ' + letterKey + ' says ' + ld.sound + ', ' + where + ' ' + w.w + '.');
}

// ---------- CELEBRATIONS ----------
function createSparkles(count) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = ['✨', '⭐', '💎', '🌟', '💫', '💖'][Math.floor(Math.random() * 6)];
    s.style.left = (20 + Math.random() * 60) + '%';
    s.style.top = (15 + Math.random() * 50) + '%';
    s.style.fontSize = (22 + Math.random() * 24) + 'px';
    s.style.animationDelay = (Math.random() * 0.3) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}

function createConfetti(count) {
  const existing = document.querySelectorAll('[data-celebration]');
  if (existing.length > 60) existing.forEach((el, i) => { if (i < existing.length - 30) el.remove(); });
  const colors = ['#ec4899', '#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const shapes = ['●', '■', '▲', '♦', '★', '♥', '✦'];
  for (let i = 0; i < (count || 40); i++) {
    const c = document.createElement('div');
    c.setAttribute('data-celebration', '1');
    c.style.cssText = 'position:fixed;top:-10px;left:' + Math.random() * 100 + '%;z-index:2500;pointer-events:none;font-size:' + (10 + Math.random() * 16) + 'px;color:' + colors[Math.floor(Math.random() * colors.length)] + ';animation:confettiFall ' + (1.5 + Math.random() * 2) + 's ease-in forwards;animation-delay:' + Math.random() * 0.5 + 's;opacity:0;';
    c.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

function createStarBurst(x, y, count) {
  const emojis = ['⭐', '✨', '💫', '🌟', '💖'];
  for (let i = 0; i < (count || 8); i++) {
    const s = document.createElement('div');
    const angle = (i / (count || 8)) * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    s.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:2500;pointer-events:none;font-size:' + (18 + Math.random() * 14) + 'px;transition:all 0.6s ease-out;opacity:1;';
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.body.appendChild(s);
    requestAnimationFrame(() => { s.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(0.3)'; s.style.opacity = '0'; });
    setTimeout(() => s.remove(), 700);
  }
}

function createHeartFloat(x, y) {
  const hearts = ['💖', '💕', '💗', '💝', '❤️'];
  for (let i = 0; i < 5; i++) {
    const h = document.createElement('div');
    h.style.cssText = 'position:fixed;left:' + (x - 15 + Math.random() * 30) + 'px;top:' + y + 'px;z-index:2500;pointer-events:none;font-size:' + (16 + Math.random() * 12) + 'px;animation:heartFloat ' + (0.8 + Math.random() * 0.6) + 's ease-out forwards;animation-delay:' + i * 0.1 + 's;';
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1600);
  }
}

function burstAtElement(el, count) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  createStarBurst(r.left + r.width / 2, r.top + r.height / 2, count || 8);
}

// ---------- REACTION BUBBLE ----------
let reactionTimer;
function showReaction(type) {
  const bubble = document.getElementById('reaction-bubble');
  const emoji = document.getElementById('reaction-emoji');
  const text = document.getElementById('reaction-text');
  if (!bubble) return;
  clearTimeout(reactionTimer);
  const reactions = {
    correct: [
      { emoji: '👸', text: 'Amazing!' }, { emoji: '🦄', text: 'You got it!' },
      { emoji: '⭐', text: 'Brilliant!' }, { emoji: '👑', text: 'So smart!' },
      { emoji: '🌟', text: 'Wonderful!' }
    ],
    retry: [
      { emoji: '👸', text: 'Almost!' }, { emoji: '🦄', text: 'Try again!' },
      { emoji: '💪', text: 'You can do it!' }, { emoji: '💖', text: 'Good try!' }
    ],
    celebrate: [
      { emoji: '🎉', text: 'YAYYY!' }, { emoji: '👸', text: 'Princess power!' },
      { emoji: '🏆', text: 'Champion!' }, { emoji: '💖', text: 'SO proud!' }
    ]
  };
  const pool = reactions[type] || reactions.correct;
  const r = pool[Math.floor(Math.random() * pool.length)];
  emoji.textContent = r.emoji;
  text.textContent = r.text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  reactionTimer = setTimeout(() => bubble.classList.remove('show'), 2000);
}

// ---------- GENTLE FEEDBACK (the anti-anxiety core) ----------
// Right answer: glow + starburst + praise. Never a buzzer, shake, or red flash.
function markCorrect(el) {
  playSound('correct');
  haptic('success');
  if (el) {
    el.classList.add('glow-right');
    burstAtElement(el, 8);
  }
  showReaction('correct');
}

// Wrong answer: soft chime, option gently dims, encouraging spoken hint.
function gentleNo(el, hint) {
  playSound('gentle');
  haptic('soft');
  if (el) el.classList.add('dimmed');
  showReaction('retry');
  speak(hint || pickLine(RETRY_LINES));
}

// ---------- STARS & PHONICS PROGRESSION ----------
function letterStars(l) { return state.letterStars[l] || 0; }

function addLetterStar(l) {
  const cur = letterStars(l);
  if (cur < 3) { state.letterStars[l] = cur + 1; }
  if (!state.lettersPracticed.includes(l)) state.lettersPracticed.push(l);
  saveState();
}

function practiceLetter(l) {
  if (!state.lettersPracticed.includes(l)) { state.lettersPracticed.push(l); saveState(); }
}

// Sets 0..n are open; the next set opens when every letter in the newest open
// set has 2+ stars. Always presented as new flowers blooming, never as locks.
function openSetCount() {
  let open = 1;
  for (let i = 0; i < PHONICS_SETS.length - 1; i++) {
    const done = PHONICS_SETS[i].every(l => letterStars(l) >= 2);
    if (done) open = i + 2; else break;
  }
  return Math.min(open, PHONICS_SETS.length);
}

function availableLetters() {
  const n = openSetCount();
  let letters = [];
  for (let i = 0; i < n; i++) letters = letters.concat(PHONICS_SETS[i]);
  return letters;
}

// ---------- STICKER REWARDS ----------
function awardSticker() {
  const owned = {};
  state.stickers.forEach(id => { owned[id] = true; });
  const missing = STICKERS.filter(s => !owned[s.id]);
  const pick = missing.length
    ? missing[Math.floor(Math.random() * missing.length)]
    : STICKERS[Math.floor(Math.random() * STICKERS.length)];
  state.stickers.push(pick.id);
  saveState();
  return { sticker: pick, duplicate: !missing.length };
}

// Called once when a child finishes an activity round.
// retries: how many gentle-retries happened (drives 1-3 stars, always >= 1).
function completeActivity(activityId, retries) {
  state.totalActivities++;
  state.activityPlays[activityId] = (state.activityPlays[activityId] || 0) + 1;
  const stars = retries <= 0 ? 3 : retries <= 2 ? 2 : 1;
  if ((state.activityStars[activityId] || 0) < stars) state.activityStars[activityId] = stars;
  const award = awardSticker();
  haptic('success');
  showStickerReward(award.sticker, stars, award.duplicate);
  return stars;
}

function showStickerReward(sticker, stars, duplicate) {
  const popup = document.getElementById('reward-popup');
  document.getElementById('reward-emoji').textContent = sticker.e;
  document.getElementById('reward-text').textContent = duplicate
    ? 'Another ' + sticker.name + '!'
    : 'New sticker: ' + sticker.name + '!';
  const starsEl = document.getElementById('reward-stars');
  starsEl.textContent = '⭐'.repeat(stars);
  popup.classList.add('show');
  playSound('reward');
  createConfetti(35);
  showReaction('celebrate');
  speak(pickLine(PRAISE_LINES) + ' You earned a ' + sticker.name + ' sticker for your castle!');
}

function closeReward() {
  document.getElementById('reward-popup').classList.remove('show');
  const mod = currentModuleName();
  if (Modules[mod] && Modules[mod].afterReward) Modules[mod].afterReward();
}

// ---------- HAPTICS ----------
const hapticPatterns = { tap: [10], soft: [15], success: [20, 50, 20], levelup: [30, 50, 30, 50, 30, 100, 50] };
function haptic(pattern) { if (navigator.vibrate && hapticPatterns[pattern]) navigator.vibrate(hapticPatterns[pattern]); }

// ---------- NAVIGATION ----------
function transitionScreens(fromScreen, toScreen, cb) {
  window.scrollTo(0, 0);
  if (fromScreen) {
    let done = false;
    function finish() {
      if (done) return; done = true;
      fromScreen.classList.remove('active', 'exiting');
      toScreen.classList.add('active');
      window.scrollTo(0, 0);
      if (cb) cb();
    }
    fromScreen.classList.add('exiting');
    fromScreen.addEventListener('animationend', function handler() {
      fromScreen.removeEventListener('animationend', handler);
      finish();
    }, { once: true });
    setTimeout(finish, 400);
  } else {
    toScreen.classList.add('active');
    if (cb) cb();
  }
}

function currentModuleName() {
  const cur = document.querySelector('.screen.active');
  return cur ? cur.id.replace('-screen', '') : '';
}

function openModule(mod) {
  haptic('tap');
  playSound('module-enter');
  const currentScreen = document.querySelector('.screen.active');
  const nextScreen = document.getElementById(mod + '-screen');
  if (!nextScreen) return;
  transitionScreens(currentScreen, nextScreen, () => {
    document.getElementById('back-btn').style.display = 'block';
    if (Modules[mod] && Modules[mod].open) Modules[mod].open();
  });
}

function goHome() {
  playSound('click');
  const currentScreen = document.querySelector('.screen.active');
  const mapScreen = document.getElementById('map-screen');
  const activeModName = currentModuleName();
  if (Modules[activeModName] && Modules[activeModName].close) Modules[activeModName].close();
  transitionScreens(currentScreen, mapScreen, () => {
    document.getElementById('back-btn').style.display = 'none';
    renderHome();
  });
  clearAllTimers();
  clearHintTimer();
  stopSpeech();
}

// ---------- HOME SCREEN ----------
function renderHome() {
  const greet = document.getElementById('home-greeting');
  if (greet) greet.textContent = '💖 Hello, ' + kidName() + '! 💖';
  updateStickerCount();
}

function greetOnLoad() {
  renderHome();
  // Speak only after first interaction (browsers block audio before a gesture).
  document.addEventListener('click', function firstTap() {
    document.removeEventListener('click', firstTap);
  }, { once: true });
}

function princessTap() {
  haptic('tap');
  const bubble = document.getElementById('princess-speech');
  const msg = pickLine(PRINCESS_SAYINGS);
  bubble.textContent = msg;
  bubble.className = 'speech-bubble';
  bubble.style.display = 'block';
  speak(msg);
  const emojiEl = document.querySelector('.home-princess .princess-emoji');
  if (emojiEl) { emojiEl.style.animation = 'princessBounce 0.5s ease-out'; setTimeout(() => emojiEl.style.animation = 'float 3s ease-in-out infinite', 500); }
  setTimeout(() => { bubble.style.display = 'none'; }, 3000);
}

function greetTap() {
  haptic('tap');
  speak(pickLine(GREETING_LINES));
}

// ---------- IDLE ENCOURAGEMENT ----------
let idleTimer = null;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  const mapScreen = document.getElementById('map-screen');
  if (mapScreen && mapScreen.classList.contains('active')) return;
  idleTimer = setTimeout(showIdleHint, 30000);
}
function showIdleHint() {
  const mapScreen = document.getElementById('map-screen');
  if (mapScreen && mapScreen.classList.contains('active')) return;
  const msg = pickLine(IDLE_LINES);
  const hint = document.createElement('div');
  hint.className = 'tutorial-hint';
  hint.textContent = msg;
  document.body.appendChild(hint);
  speak(msg);
  setTimeout(() => { if (hint.parentNode) hint.remove(); }, 4000);
  resetIdleTimer();
}
document.addEventListener('click', resetIdleTimer);
document.addEventListener('touchstart', resetIdleTimer);

// ---------- HINT TIMER ----------
let hintTimer = null;
function startHintTimer(hintText) {
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    speak(hintText || 'Take your time! You can do it!');
  }, 8000);
}
function clearHintTimer() { clearTimeout(hintTimer); hintTimer = null; }

// ---------- HELPERS ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n) { return shuffle(arr).slice(0, n); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// Round-progress flowers shown during a 5-question activity.
function roundProgressHtml(done, total) {
  let html = '<div class="round-progress">';
  for (let i = 0; i < total; i++) html += '<span class="' + (i < done ? 'done' : '') + '">🌸</span>';
  return html + '</div>';
}

// ---------- BACKGROUND SPARKLES ----------
(function () {
  const container = document.getElementById('bg-sparkles');
  if (!container) return;
  const symbols = ['✨', '⭐', '💫', '🌟', '💖', '🦋'];
  for (let i = 0; i < 20; i++) {
    const star = document.createElement('div');
    star.className = 'bg-star';
    star.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    star.style.left = (Math.random() * 100) + '%';
    star.style.top = (Math.random() * 100) + '%';
    star.style.setProperty('--dur', (3 + Math.random() * 5) + 's');
    star.style.setProperty('--size', (14 + Math.random() * 18) + 'px');
    star.style.animationDelay = (Math.random() * 5) + 's';
    container.appendChild(star);
  }
})();

// ---------- SERVICE WORKER + BOOT ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed:', e));
  });
}

window.addEventListener('online', () => { const el = document.getElementById('offline-indicator'); if (el) el.classList.remove('show'); });
window.addEventListener('offline', () => { const el = document.getElementById('offline-indicator'); if (el) el.classList.add('show'); });

document.addEventListener('DOMContentLoaded', () => {
  updateSoundButtons();
  greetOnLoad();
  saveState();
});
