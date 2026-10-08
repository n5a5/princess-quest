// shared/audio.js — the instructional audio layer. Four channels, each resolved in priority order:
//   phoneme(id)  : parent recording → bundled clip → TTS only if the sound is marked ttsSafe (continuants) → silent
//   letter(g)    : parent recording → bundled clip → TTS letter name
//   word(text)   : parent recording → bundled clip → TTS word
//   say(sentence): TTS text, with /id/ tokens routed to phoneme()
// Games never choose audio sources; they describe what to teach (graphemes, phonemes, word) and call
// decodeSteps()/swapSteps(). Recordings and bundled files can be added without touching game code.
//
// Dependencies are injected so the resolution logic runs under node --test:
//   speech  : { speakText(text, {rate}) → Promise, stop() }
//   store   : { has(kind,id), get(kind,id) → Blob }            (audiostore.js)
//   player  : { play(src) → Promise<boolean>, stop() }         (src = URL string or Blob)
//   manifest: { ext:'ogg', phonemes:[ids], letters:[ids], words:[ids] }
//   sounds  : { [id]: { label, tts, ttsSafe, ... } }           (content/sounds.json)
const SOUND_TOKEN = /\/([a-z_-]+)\//gi;

export function parseParts(text) {
  const parts = [];
  let last = 0, m;
  const re = new RegExp(SOUND_TOKEN.source, 'gi');
  const pushText = t => { const s = t.replace(/^[\s.,!?;:]+/, '').trim(); if (/[a-z0-9]/i.test(s)) parts.push({ text: s }); };
  while ((m = re.exec(text))) {
    if (m.index > last) pushText(text.slice(last, m.index));
    parts.push({ sound: m[1] });
    last = re.lastIndex;
  }
  if (last < text.length) pushText(text.slice(last));
  return parts;
}

// Sentence keys shared with tools/collect-lines.py: split on . ! ? :, straighten quotes, collapse spaces,
// lower case. A pre-rendered line is found by its key.
const SENTENCE = /[^.!?:]+[.!?:]+["”']?|[^.!?:]+$/g;
export function splitSentences(text) { return (String(text).match(SENTENCE) || []).map(s => s.trim()).filter(Boolean); }
export function keyOf(sentence) {
  return String(sentence).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

const LETTER_NAMES = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', h: 'H', i: 'I', j: 'J', k: 'K', l: 'L', m: 'M', n: 'N', o: 'O', p: 'P', q: 'Q', r: 'R', s: 'S', t: 'T', u: 'U', v: 'V', w: 'W', x: 'X', y: 'Y', z: 'Z' };
export function letterName(grapheme) {
  return grapheme.split('').map(c => LETTER_NAMES[c.toLowerCase()] || c).join(' ');
}

// Timing (ms) for the decoding sequence. Tuned for a 6-year-old: slow first pass, then CONNECTED
// phonation for the blend (sounds run together with no silence; Gonzalez-Frey & Ehri 2021), then the word.
export const TIMING = { betweenSounds: 450, beforeBlend: 650, blendGap: 0, blendCrossfade: 60, beforeWord: 350 };

// A word is a list of units [grapheme, phoneme|null]; null marks a silent letter (the e in cake).
// Items may give `units` directly (content/phonics.json) or `phonemes` (+ optional `graphemes`).
export function unitsOf(item) {
  if (item.units) return item.units;
  return item.phonemes.map((p, i) => [(item.graphemes && item.graphemes[i]) || p, p]);
}
const spoken = item => unitsOf(item).map((u, i) => ({ p: u[1], index: i })).filter(x => x.p);

// grapheme → phoneme → … → (pause) → blend → whole word. `index` is the unit (tile) to highlight.
export function decodeSteps(item, { blend = true } = {}) {
  const steps = [];
  const units = spoken(item);
  units.forEach((u, n) => {
    if (n > 0) steps.push({ gap: TIMING.betweenSounds });
    steps.push({ phoneme: u.p, index: u.index, kind: 'sound' });
  });
  if (blend) {
    steps.push({ gap: TIMING.beforeBlend });
    steps.push({ blend: units.map(u => u.p), indexes: units.map(u => u.index), kind: 'blend' });
  }
  steps.push({ gap: TIMING.beforeWord });
  steps.push({ word: item.word, kind: 'word' });
  return steps;
}

// Sound Swap: the changed grapheme's phoneme, then blend and say the new word.
export function swapSteps(newItem, changedIndex) {
  const units = spoken(newItem);
  const changed = units.find(u => u.index === changedIndex) || units[0];
  return [
    { phoneme: changed.p, index: changed.index, kind: 'sound' },
    { gap: TIMING.beforeBlend },
    { blend: units.map(u => u.p), indexes: units.map(u => u.index), kind: 'blend' },
    { gap: TIMING.beforeWord },
    { word: newItem.word, kind: 'word' }
  ];
}

export function createAudio({ speech, store, player, manifest, sounds, settings, base = './assets/audio/' }) {
  let seq = 0;
  let soundMap = sounds || {};
  let man = manifest || { ext: 'ogg', phonemes: [], letters: [], words: [] };
  let lines = null; // { voice, ext, lines: { key: id } } from content/lines-audio.json
  // One voice per utterance: when the parent has chosen the story voice and EVERY sentence of what is
  // about to be said has a pre-rendered clip, play the clips; otherwise the device voice says all of it.
  const lineUrl = id => base + 'lines/' + id + '.' + (lines.ext || 'ogg');
  // A sentence with a changing word ("Which door says big?") is spliced from recorded pieces: the fewest
  // spans that are each a recorded line/fragment, a single bundled word, or a recorded number.
  function wordSrc(w) {
    if (!w) return null;
    for (const c of [w, w.toLowerCase()]) {
      const rec = store && store.get('word', c);
      if (rec) return rec;
      const url = bundled('words', c);
      if (url) return url;
    }
    return null;
  }
  function segment(sentence) {
    const words = String(sentence).trim().split(/\s+/);
    const n = words.length;
    const best = Array(n + 1).fill(null); best[0] = [];
    for (let i = 0; i < n; i++) {
      if (!best[i]) continue;
      for (let j = n; j > i; j--) {
        if (best[j] && best[j].length <= best[i].length + 1) continue;
        const span = words.slice(i, j).join(' ');
        let src = null;
        const id = lines.lines[keyOf(span)];
        if (id) src = lineUrl(id);
        else if (j === i + 1) {
          const bare = span.replace(/[^A-Za-z0-9']/g, '');
          const rec = lines.lines[keyOf(bare)]; // numbers ("7") and recorded slot words ("circle", "Rosie")
          src = rec ? lineUrl(rec) : wordSrc(bare);
        }
        if (src) best[j] = [...best[i], { src, text: span }];
      }
    }
    return best[n];
  }
  // story: use the story voice whenever it has every sentence, whatever the setting (Star Stage: Luna's
  // instructions must sound like the Luna who models the line).
  function lineClips(parts, story = false) {
    if (!lines || !settings || (settings.voice !== 'luna' && !story)) return null;
    const out = [];
    for (const part of parts) {
      if (part.sound) {
        // letter sounds inside a sentence ("Which one starts with /m/?") are recorded in the same voice
        const src = api.phonemeSrc(part.sound);
        if (!src) return null;
        out.push({ src, sound: part.sound });
        continue;
      }
      for (const sn of splitSentences(part.text)) {
        const id = lines.lines[keyOf(sn)];
        if (id) { out.push({ src: lineUrl(id), text: sn }); continue; }
        const pieces = segment(sn);
        if (!pieces) return null;
        pieces.forEach((pc, k) => out.push({ ...pc, splice: k > 0 }));
      }
    }
    return out.length ? out : null;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const bundled = (kind, id) => (man[kind] || []).includes(id) ? base + kind + '/' + encodeURIComponent(id) + '.' + (man.ext || 'ogg') : null;

  // Player results: true = played to the end, 'stopped' = interrupted by stop() or a newer clip (NOT a
  // failure: never fall back to the device voice for it), false = the clip could not be loaded or played.
  async function fromStoreOrBundle(kind, id) {
    const rec = store && store.get(kind.slice(0, -1), id); // store kinds are singular: phoneme/letter/word
    if (rec) return player.play(rec);
    const url = bundled(kind, id);
    if (url) return player.play(url);
    return false;
  }
  // Says text, stopping as soon as live() turns false. Shared by say() and the {say} steps of sequence(),
  // so a sequence's own say step never cancels the sequence (the heart-word bug).
  async function speak(text, live, story = false) {
    const parts = parseParts(String(text));
    const clips = lineClips(parts, story);
    if (clips) {
      for (let i = 0; i < clips.length; i++) {
        if (!live()) return;
        if (i) await wait(clips[i].splice ? 15 : clips[i].sound || clips[i - 1].sound ? 60 : 110);
        if (!live()) return;
        const r = await player.play(clips[i].src);
        if (r === 'stopped' || !live()) return;
        if (r !== true) { // a clip failed to load: say the rest with the device voice
          for (const c of clips.slice(i)) { if (!live()) return; if (c.sound) await api.phoneme(c.sound); else await speech.speakText(c.text); }
          return;
        }
      }
      return;
    }
    for (const part of parts) {
      if (!live()) return;
      if (part.sound) await api.phoneme(part.sound);
      else await speech.speakText(part.text);
    }
  }

  // Activity tracking for the idle nudge: is anything being said, and when did the last line end?
  let busy = 0, lastEnd = Date.now();
  const track = fn => async (...a) => { busy++; try { return await fn(...a); } finally { busy--; lastEnd = Date.now(); } };
  const api = {
    get muted() { return !!(settings && settings.muted); },
    isBusy: () => busy > 0,
    quietFor: () => (busy > 0 ? 0 : Date.now() - lastEnd),
    setSounds(map) { soundMap = map || {}; },
    setManifest(m) { man = m; },
    setLines(l) { lines = l && l.lines ? l : null; },
    // For the parent corner: would this text play in the story voice right now?
    usesStoryVoice(text) { return !!lineClips(parseParts(String(text))); },
    soundLabel: id => (soundMap[id] && soundMap[id].label) || id,
    // Which source will phoneme(id) use right now? For the parent's Sound Check page.
    phonemeSource(id) {
      if (store && store.has('phoneme', id)) return 'recorded';
      if (bundled('phonemes', id)) return 'bundled';
      return soundMap[id] && soundMap[id].ttsSafe ? 'tts' : 'none';
    },
    stop() { seq++; player.stop(); speech.stop(); },

    async phoneme(id) {
      if (api.muted) return false;
      const r = await fromStoreOrBundle('phonemes', id);
      if (r === true) return true;
      if (r === 'stopped') return false;
      const s = soundMap[id];
      if (s && s.ttsSafe && s.tts) { await speech.speakText(s.tts, { rate: 0.8 }); return true; }
      return false; // never let TTS invent a schwa for a stop or glide
    },
    async letter(grapheme) {
      if (api.muted) return false;
      const r = await fromStoreOrBundle('letters', grapheme);
      if (r === true) return true;
      if (r === 'stopped') return false;
      await speech.speakText(letterName(grapheme), { rate: 0.85 });
      return true;
    },
    async word(text) {
      if (api.muted) return false;
      const r = await fromStoreOrBundle('words', text);
      if (r === true) return true;
      if (r === 'stopped') return false;
      await speech.speakText(text, { rate: 0.85 });
      return true;
    },
    // A ready-made clip outside the four channels (a URL or a recorded Blob): Star Stage's model lines and her
    // own takes. Results as the player: true = played, 'stopped' = interrupted, false = muted or would not load.
    async clip(src) {
      if (api.muted) return false;
      api.stop();
      const my = ++seq;
      const r = await player.play(src);
      return my === seq ? r : 'stopped';
    },
    async say(text, { interrupt = true, story = false } = {}) {
      if (api.muted) return;
      if (interrupt) api.stop();
      const my = ++seq;
      await speak(text, () => my === seq, story);
    },
    // Source for one phoneme without playing it: a Blob (recording), a URL (bundled), or null.
    phonemeSrc(id) {
      const rec = store && store.get('phoneme', id);
      if (rec) return rec;
      return bundled('phonemes', id);
    },
    // Connected phonation: all sounds of a word run together with a short crossfade and no silence.
    // Falls back to back-to-back playback when the player cannot chain or a sound has no clip.
    // onSound(i) fires as the i-th sound starts, so tiles can light up in time with the audio.
    async blend(phonemes, { onSound = () => {} } = {}) {
      if (api.muted) return false;
      const srcs = phonemes.map(api.phonemeSrc);
      if (player.chain && srcs.every(Boolean)) {
        return player.chain(srcs, { gapMs: TIMING.blendGap, crossfadeMs: TIMING.blendCrossfade, onStart: onSound });
      }
      for (let i = 0; i < phonemes.length; i++) { onSound(i); await api.phoneme(phonemes[i]); }
      return true;
    },
    // Plays steps in order; onStep(step) fires as each sound/word starts. Cancelled by stop().
    async sequence(steps, { onStep = () => {} } = {}) {
      api.stop();
      const my = ++seq;
      for (const step of steps) {
        if (my !== seq) return false;
        if (step.gap) { await wait(step.gap); continue; }
        if (step.blend) {
          await api.blend(step.blend, { onSound: i => { if (my === seq) onStep({ kind: 'blend', phoneme: step.blend[i], index: step.indexes ? step.indexes[i] : i }); } });
          continue;
        }
        onStep(step);
        if (step.phoneme) await api.phoneme(step.phoneme);
        else if (step.letter) await api.letter(step.letter);
        else if (step.word) await api.word(step.word);
        else if (step.say) await speak(step.say, () => my === seq);
      }
      return my === seq;
    },
    decode(item, opts) { return api.sequence(decodeSteps(item, opts), opts); },
    swap(newItem, changedIndex, opts) { return api.sequence(swapSteps(newItem, changedIndex), opts); },

    // Tappable spans for a prompt: words speak themselves, /id/ tokens become letter chips that play the sound.
    spans(text, { ears = false } = {}) {
      const frag = document.createDocumentFragment();
      String(text).split(/(\s+)/).forEach(part => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const sm = part.match(/^\/([a-z_-]+)\/([?.!,]*)$/i);
        const b = document.createElement('button');
        b.type = 'button';
        if (sm) {
          b.className = 'sound-chip' + (ears ? ' ear' : '');
          b.textContent = ears ? '👂' : api.soundLabel(sm[1]);
          b.setAttribute('aria-label', 'sound ' + sm[1]);
          b.addEventListener('click', e => { e.stopPropagation(); api.stop(); api.phoneme(sm[1]); });
          frag.appendChild(b);
          if (sm[2]) frag.appendChild(document.createTextNode(sm[2]));
          return;
        }
        b.className = 'word'; b.textContent = part;
        b.addEventListener('click', e => { e.stopPropagation(); api.stop(); api.word(part.replace(/[^\w']/g, '')); });
        frag.appendChild(b);
      });
      return frag;
    }
  };
  api.say = track(api.say);
  api.clip = track(api.clip);
  api.sequence = track(api.sequence);
  return api;
}

// Parent recordings come off the microphone raw: the browser's automatic gain control pulls the level
// down partway through a held sound ("sss" fades to a whisper), there is silence either side, and the
// level differs between takes. This evens the level (a gentle upward leveller: quiet-but-active parts are
// lifted toward the loud part, at most 4x), trims the silence, normalises the peak and adds short fades.
// Pure function over samples, so it is unit-tested; the Web Audio player runs it on every recorded clip.
export function conditionClip(x, sr) {
  const n = x.length;
  const win = Math.max(1, Math.round(sr * 0.02)), hop = Math.max(1, Math.round(sr * 0.01));
  const rms = [];
  for (let i = 0; i + win <= n; i += hop) { let s = 0; for (let k = i; k < i + win; k++) s += x[k] * x[k]; rms.push(Math.sqrt(s / win)); }
  if (rms.length < 3) return x;
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)], loud = sorted[Math.floor(sorted.length * 0.9)];
  const thr = Math.max(floor * 3, loud * 0.08, 1e-4);
  const active = rms.map(r => r > thr);
  const first = active.indexOf(true), last = active.lastIndexOf(true);
  if (first < 0) return x;
  const pad = Math.round(sr * 0.015);
  const s0 = Math.max(0, first * hop - pad), s1 = Math.min(n, last * hop + win + pad);
  const target = loud * 0.85;
  const g = rms.map((r, i) => active[i] ? Math.min(4, Math.max(1, target / r)) : 1);
  const sm = g.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 4); k <= Math.min(g.length - 1, i + 4); k++) { s += g[k]; c++; } return s / c; });
  const out = new Float32Array(s1 - s0);
  for (let i = s0; i < s1; i++) {
    const f = Math.max(0, Math.min(sm.length - 1, (i - win / 2) / hop));
    const lo = Math.floor(f), hi = Math.min(sm.length - 1, lo + 1), t = f - lo;
    out[i - s0] = x[i] * (sm[lo] * (1 - t) + sm[hi] * t);
  }
  let mx = 0; for (let i = 0; i < out.length; i++) mx = Math.max(mx, Math.abs(out[i]));
  if (mx > 0) { const k = 0.9 / mx; for (let i = 0; i < out.length; i++) out[i] *= k; }
  const fi = Math.min(out.length >> 2, Math.round(sr * 0.005)), fo = Math.min(out.length >> 1, Math.round(sr * 0.025));
  for (let i = 0; i < fi; i++) out[i] *= i / fi;
  for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo;
  return out;
}

// Web Audio player: decoded buffers cached in memory, sample-accurate chaining with crossfade for
// connected-phonation blending, instant stop. Falls back to the HTML player if AudioContext is missing.
export function createWebAudioPlayer() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return createHtmlPlayer();
  let ctx = null;
  const buffers = new Map(); // URL → Promise<AudioBuffer>
  // Recordings by Blob, held only as long as the Blob is: Star Stage plays back a new take every few minutes,
  // and a Map kept every one of them decoded until the app was closed.
  const blobBuffers = new WeakMap();
  let playing = [];          // active source nodes
  let timers = [];
  let waiters = [];          // resolvers of in-flight play()/chain() promises; settled false on stop
  let lastError = null;
  let gen = 0;               // bumped by every stop, so a play() still loading knows it was overtaken
  const keyOf = src => (src instanceof Blob ? src : String(src));
  // Laptops and Chromebooks power their audio output down when nothing is playing; waking it takes
  // ~100–200 ms, which used to swallow short letter sounds. A silent source keeps the output awake for
  // as long as the page is open, and the context is resumed whenever the page comes back into view.
  let keepAlive = null;
  function context() {
    if (!ctx) {
      ctx = new AC({ latencyHint: 'interactive' });
      try {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination);
        const src = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
        src.connect(g); src.start(); keepAlive = src;
      } catch { keepAlive = null; }
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {}); });
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // Wait (briefly) until the context is really running before scheduling, so a clip is not scheduled
  // against a frozen clock and its promise does not settle before the sound has played.
  async function running() {
    const c = context();
    if (c.state === 'running') return c;
    try { await Promise.race([c.resume(), new Promise(r => setTimeout(r, 400))]); } catch {}
    return c;
  }
  function decode(src) {
    const k = keyOf(src);
    const cache = src instanceof Blob ? blobBuffers : buffers;
    if (!cache.has(k)) {
      const p = (src instanceof Blob ? src.arrayBuffer() : fetch(src).then(r => { if (!r.ok) throw new Error('audio ' + r.status); return r.arrayBuffer(); }))
        .then(ab => context().decodeAudioData(ab))
        .then(buf => (src instanceof Blob ? conditioned(buf) : buf))
        .catch(e => { cache.delete(k); throw e; });
      cache.set(k, p);
    }
    return cache.get(k);
  }
  // A recording (Blob) is levelled, trimmed and normalised once, when it is decoded.
  function conditioned(buf) {
    try {
      const n = buf.length, ch = buf.numberOfChannels;
      const mono = new Float32Array(n);
      for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / ch; }
      const y = conditionClip(mono, buf.sampleRate);
      const out = context().createBuffer(1, y.length, buf.sampleRate);
      out.copyToChannel(y, 0);
      return out;
    } catch (e) { console.warn('recording not conditioned', e); return buf; }
  }
  // Every clip gets a short gain envelope (a few ms in, a dozen ms out) and an interrupted clip is
  // faded, not chopped: a hard edge at sample level is the "click" laptop speakers reveal.
  const FADE_IN = 0.006, FADE_OUT = 0.014, CUT = 0.012;
  function stopAll() {
    gen++;
    const now = ctx ? ctx.currentTime : 0;
    for (const { src, g } of playing) {
      try {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + CUT);
        src.stop(now + CUT + 0.005);
      } catch { try { src.stop(); } catch {} }
    }
    playing = [];
    for (const t of timers) clearTimeout(t);
    timers = [];
    const w = waiters; waiters = [];
    for (const resolve of w) resolve('stopped'); // BUG-01: never leave an awaiting caller hanging
  }
  function settleLater(ms) {
    return new Promise(resolve => {
      const done = v => { waiters = waiters.filter(r => r !== done); resolve(v); };
      waiters.push(done);
      timers.push(setTimeout(() => done(true), Math.max(0, ms)));
    });
  }
  function schedule(buffer, at, fadeIn, fadeOut) {
    const c = context();
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buffer;
    src.connect(g); g.connect(c.destination);
    const end = at + buffer.duration;
    const fi = Math.max(fadeIn || 0, FADE_IN), fo = Math.max(fadeOut || 0, FADE_OUT);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + fi);
    g.gain.setValueAtTime(1, Math.max(at + fi, end - fo));
    g.gain.linearRampToValueAtTime(0, end);
    src.start(at);
    playing.push({ src, g });
    return end;
  }
  return {
    async play(src) {
      const g0 = gen;
      let buffer;
      try { buffer = await decode(src); } catch (e) { console.warn('audio missing', src, e); lastError = String(e && e.message || e); return false; }
      if (gen !== g0) return 'stopped'; // stop() or a newer clip came while this one loaded
      stopAll();
      const mine = gen;
      const c = await running();
      if (gen !== mine) return 'stopped';
      const end = schedule(buffer, c.currentTime + 0.01, 0, 0.01);
      return settleLater((end - c.currentTime) * 1000);
    },
    // Plays clips back to back. gapMs adds silence; crossfadeMs overlaps the tail of one clip with the head of the next.
    async chain(srcs, { gapMs = 0, crossfadeMs = 60, onStart = () => {} } = {}) {
      const g0 = gen;
      let bufs;
      try { bufs = await Promise.all(srcs.map(decode)); } catch (e) { console.warn('audio missing in chain', e); lastError = String(e && e.message || e); return false; }
      if (gen !== g0) return 'stopped';
      stopAll();
      const mine = gen;
      const c = await running();
      if (gen !== mine) return 'stopped';
      const xf = crossfadeMs / 1000;
      let at = c.currentTime + 0.02;
      const t0 = c.currentTime;
      bufs.forEach((b, i) => {
        const startAt = at;
        timers.push(setTimeout(() => onStart(i), Math.max(0, (startAt - t0) * 1000)));
        const end = schedule(b, startAt, i > 0 ? xf : 0, i < bufs.length - 1 ? xf : 0.01);
        at = end - (i < bufs.length - 1 ? xf : 0) + gapMs / 1000;
      });
      return settleLater((at - c.currentTime) * 1000);
    },
    stop() { stopAll(); },
    preload(srcs) { srcs.forEach(s => decode(s).catch(() => {})); },
    unlock() { context(); },
    // For the Parent Corner audio check.
    info() {
      const c = context();
      return { engine: 'webaudio', state: c.state, sampleRate: c.sampleRate, baseLatency: c.baseLatency ?? null, outputLatency: c.outputLatency ?? null, keepAlive: !!keepAlive, lastError };
    },
    async probe(src) {
      try { const b = await decode(src); return { ok: true, ms: Math.round(b.duration * 1000), sampleRate: b.sampleRate, channels: b.numberOfChannels }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    }
  };
}

// Browser player for URLs and Blobs with a small object-URL cache for bundled files.
export function createHtmlPlayer() {
  let current = null, gen = 0;
  const cache = new Map(); // url → Promise<objectURL>
  async function resolveSrc(src) {
    if (src instanceof Blob) return URL.createObjectURL(src);
    if (!cache.has(src)) {
      cache.set(src, fetch(src).then(r => { if (!r.ok) throw new Error('audio ' + r.status); return r.blob(); }).then(b => URL.createObjectURL(b)).catch(e => { cache.delete(src); throw e; }));
    }
    return cache.get(src);
  }
  return {
    async play(src) {
      const g0 = ++gen;
      if (current) { const c = current; current = null; try { c.el.pause(); } catch {} c.done('stopped'); }
      let url;
      try { url = await resolveSrc(src); } catch (e) { console.warn('audio missing', src, e); return false; }
      if (gen !== g0) return 'stopped';
      return new Promise(resolve => {
        const a = new Audio(url);
        const done = ok => { if (src instanceof Blob) URL.revokeObjectURL(url); if (current && current.el === a) current = null; resolve(ok); };
        current = { el: a, done };
        a.onended = () => done(true);
        a.onerror = () => done(false);
        a.play().catch(() => done(false));
      });
    },
    stop() { gen++; if (current) { const c = current; current = null; try { c.el.pause(); c.el.currentTime = 0; } catch {} c.done('stopped'); } },
    preload(urls) { urls.forEach(u => resolveSrc(u).catch(() => {})); },
    info() { return { engine: 'html-audio', state: 'n/a' }; },
    async probe(src) { try { await resolveSrc(src); return { ok: true }; } catch (e) { return { ok: false, error: String(e && e.message || e) }; } }
  };
}
