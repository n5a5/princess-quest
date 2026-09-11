// shared/speech.js — Web Speech wrapper. No voice-name lists, no pause/resume hack on mobile,
// no boundary events (unsupported on Android). speak() returns a promise that resolves on end.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function isMobile() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }

export function createSpeech({ settings, onChange = () => {} }) {
  const synth = globalThis.speechSynthesis;
  let voice = null;
  let seq = 0;

  function englishVoices() { return synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)) : []; }
  function pickVoice() {
    const en = englishVoices();
    if (!en.length) return;
    const byName = settings.voiceName && en.find(v => v.name === settings.voiceName);
    voice = byName
      || en.find(v => v.localService && /en[-_]US/i.test(v.lang))
      || en.find(v => /en[-_]US/i.test(v.lang))
      || en.find(v => v.localService)
      || en[0];
  }
  if (synth) { synth.addEventListener('voiceschanged', pickVoice); pickVoice(); }

  function clean(t) { return String(t).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim(); }
  function chunks(t) { return clean(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || []; }

  function utter(text, rate) {
    return new Promise(resolve => {
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
    stop() { seq++; if (synth) synth.cancel(); },
    async speak(text, { interrupt = true, rate = settings.rate || 0.9 } = {}) {
      if (!synth || settings.muted) return;
      if (interrupt) api.stop();
      const my = ++seq;
      for (const c of chunks(text)) {
        if (my !== seq) return;
        await utter(c, rate);
      }
    },
    speakWord(word) { return api.speak(word, { interrupt: true, rate: 0.85 }); },
    // Builds tappable word spans. Each tap speaks that word alone.
    wordSpans(text) {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach(part => {
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const b = document.createElement('button');
        b.className = 'word'; b.type = 'button'; b.textContent = part;
        b.addEventListener('click', e => { e.stopPropagation(); api.speakWord(part.replace(/[^\w']/g, '')); });
        frag.appendChild(b);
      });
      return frag;
    }
  };
  return api;
}
