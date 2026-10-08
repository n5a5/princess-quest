// shared/songclip.js — plays the cast recording a grown-up loaded in Parent Corner (kept on this device only,
// in the audio store as stage:song-audio; never part of the app or the public site). Star Stage plays the whole
// number (Hear the orphans) or the audition chorus inside it (content/stage.json songCut, adjustable in
// Parent Corner). An <audio> element, not Web Audio: decoding a 3.5-minute song into memory takes ~85 MB.
// duration() resolves the length in seconds, or null when this device cannot play the file (checked once, with
// listeners attached before the file is set, so an early error is never missed; 4 s at most).
// play({ from, to, shouldStop }) fades in and out and resolves 'ended', 'stopped' or 'error' (cannot play).
export function createSongPlayer(blob) {
  const url = URL.createObjectURL(blob);
  const a = new Audio();
  let ok = null; // null: not known yet, true / false
  const ready = new Promise(resolve => {
    const settle = d => { if (ok !== null) return; ok = !!d; resolve(d || null); };
    const t = setTimeout(() => settle(null), 4000);
    a.addEventListener('loadedmetadata', () => { clearTimeout(t); settle(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null); }, { once: true });
    a.addEventListener('error', () => { clearTimeout(t); settle(null); }, { once: true });
  });
  a.preload = 'auto';
  a.src = url;
  let timer = null, done = null;
  const settle = v => { if (timer) { clearInterval(timer); timer = null; } const d = done; done = null; if (d) d(v); };
  const api = {
    duration: () => ready,
    currentTime: () => a.currentTime,
    play({ from = 0, to = null, fadeIn = 0.15, fadeOut = 0.6, shouldStop = () => false } = {}) {
      api.stop();
      if (ok === false) return Promise.resolve('error');
      return new Promise(resolve => {
        done = resolve;
        try { a.currentTime = from; } catch {}
        a.volume = 0;
        a.play().catch(() => settle('error'));
        timer = setInterval(() => {
          if (shouldStop()) { a.pause(); return settle('stopped'); }
          const t = a.currentTime, end = to === null ? a.duration : Math.min(to, a.duration || to);
          const v = Math.min(1, (t - from) / fadeIn, Math.max(0, (end - t) / fadeOut));
          a.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
          if (a.ended || t >= end) { a.pause(); settle('ended'); }
        }, 40);
        a.onended = () => settle('ended');
      });
    },
    stop() { if (!a.paused) a.pause(); settle('stopped'); },
    release() { api.stop(); a.removeAttribute('src'); a.load(); URL.revokeObjectURL(url); }
  };
  return api;
}
