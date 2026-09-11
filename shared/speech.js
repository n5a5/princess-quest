// shared/speech.js — the text-to-speech primitive only. Words and sentences go through here;
// phonemes never do (see shared/audio.js). No voice-name lists, no pause/resume hack on mobile,
// no boundary events (unsupported on Android). speakText() resolves when the utterance ends.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function isMobile() { return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); }

export function createSpeech({ settings, onChange = () => {} }) {
  let lastCancel = 0;
  const synth = globalThis.speechSynthesis;
  let voice = null;
  let seq = 0;

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
    available: () => !!synth && englishVoices().length > 0,
    voices: () => englishVoices().map(v => ({ name: v.name, lang: v.lang, local: v.localService })),
    setVoice(name) { settings.voiceName = name || ''; pickVoice(); onChange(); },
    stop() { seq++; lastCancel = Date.now(); if (synth) synth.cancel(); },
    async speakText(text, { rate = settings.rate || 0.9 } = {}) {
      if (settings.muted) return;
      const my = ++seq;
      const since = Date.now() - lastCancel;
      if (since < 160) await new Promise(r => setTimeout(r, 160 - since));
      if (my !== seq) return;
      for (const c of chunks(text)) {
        if (my !== seq) return;
        await utter(c, rate);
      }
    }
  };
  return api;
}
