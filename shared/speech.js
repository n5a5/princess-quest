// shared/speech.js — Web Speech wrapper. No voice-name lists, no pause/resume hack on mobile,
// no boundary events (unsupported on Android). speak() returns a promise that resolves on end.
// Phonemes are written as /id/ in any text (e.g. "Which one starts with /m/?") and play from the
// parent-recorded sound kit when a clip exists, else a TTS fallback string from content/sounds.json.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const SOUND_TOKEN = /\/([a-z_-]+)\//gi;

export function isMobile() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }

// "Which one starts with /m/?" → [{text:'Which one starts with'}, {sound:'m'}]
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

export function createSpeech({ settings, onChange = () => {}, soundkit = null, sounds = {} }) {
  const synth = globalThis.speechSynthesis;
  let voice = null;
  let seq = 0;
  let soundMap = sounds;

  function englishVoices() { return synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
  function pickVoice() {
    const en = englishVoices();
    if (!en.length) return;
    const byName = settings.voiceName && en.find(v => v.name === settings.voiceName);
    const us = v => /en[-_]US/i.test(v.lang);
    // Soft preference for voices commonly shipped as female; falls through if none exist.
    const softFemale = /zira|aria|jenny|ana\b|samantha|karen|moira|female|google us english/i;
    voice = byName
      || en.find(v => v.localService && us(v) && softFemale.test(v.name))
      || en.find(v => us(v) && softFemale.test(v.name))
      || en.find(v => v.localService && us(v))
      || en.find(v => us(v))
      || en.find(v => v.localService)
      || en[0];
  }
  if (synth) { synth.addEventListener('voiceschanged', pickVoice); pickVoice(); }

  function clean(t) { return String(t).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim(); }
  function chunks(t) { return clean(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || []; }

  function utter(text, rate) {
    return new Promise(resolve => {
      if (!synth) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = 1.05; u.lang = 'en-US';
      if (voice) u.voice = voice;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
      u.onend = finish; u.onerror = finish;
      const guard = setTimeout(finish, 1500 + text.length * 120);
      synth.speak(u);
    });
  }

  const api = {
    get muted() { return !!settings.muted; },
    setMuted(b) { settings.muted = !!b; if (b) api.stop(); onChange(); },
    toggleMuted() { api.setMuted(!settings.muted); return settings.muted; },
    activate() { if (!synth) return; pickVoice(); try { synth.resume(); } catch {} },
    voices: () => englishVoices().map(v => ({ name: v.name, lang: v.lang, local: v.localService })),
    setVoice(name) { settings.voiceName = name || ''; pickVoice(); onChange(); },
    setSounds(map) { soundMap = map || {}; },
    soundLabel(id) { return (soundMap[id] && soundMap[id].label) || id; },
    stop() { seq++; if (synth) synth.cancel(); },
    // Plays one phoneme: recorded clip if present, else the TTS fallback string.
    async speakSound(id) {
      if (settings.muted) return;
      if (soundkit && soundkit.has(id)) { if (await soundkit.play(id)) return; }
      const fallback = (soundMap[id] && soundMap[id].tts) || id;
      await utter(fallback, 0.8);
    },
    async speak(text, { interrupt = true, rate = settings.rate || 0.9 } = {}) {
      if (settings.muted) return;
      if (interrupt) api.stop();
      const my = ++seq;
      for (const part of parseParts(String(text))) {
        if (my !== seq) return;
        if (part.sound) { await api.speakSound(part.sound); continue; }
        for (const c of chunks(part.text)) {
          if (my !== seq) return;
          await utter(c, rate);
        }
      }
    },
    speakWord(word) { return api.speak(word, { interrupt: true, rate: 0.85 }); },
    // Builds tappable word spans. Each tap speaks that word alone; /id/ tokens become sound chips.
    wordSpans(text) {
      const frag = document.createDocumentFragment();
      String(text).split(/(\s+)/).forEach(part => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const sm = part.match(/^\/([a-z_-]+)\/([?.!,]*)$/i);
        const b = document.createElement('button');
        b.type = 'button';
        if (sm) {
          b.className = 'sound-chip';
          b.textContent = api.soundLabel(sm[1]);
          b.setAttribute('aria-label', 'sound ' + sm[1]);
          b.addEventListener('click', e => { e.stopPropagation(); api.stop(); api.speakSound(sm[1]); });
          frag.appendChild(b);
          if (sm[2]) frag.appendChild(document.createTextNode(sm[2]));
          return;
        }
        b.className = 'word'; b.textContent = part;
        b.addEventListener('click', e => { e.stopPropagation(); api.speakWord(part.replace(/[^\w']/g, '')); });
        frag.appendChild(b);
      });
      return frag;
    }
  };
  return api;
}
