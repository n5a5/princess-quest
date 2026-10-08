// shared/songclip.js — plays the cast recording a grown-up loaded in Parent Corner (kept on this device only,
// in the audio store as stage:song-audio; never part of the app or the public site). Star Stage plays the whole
// number (Hear the orphans) or the audition chorus inside it (content/stage.json songCut, adjustable in
// Parent Corner). An <audio> element, not Web Audio: decoding a 3.5-minute song into memory takes ~85 MB.
// play({ from, to }) fades in and out and resolves 'ended' or 'stopped'.
export function createSongPlayer(blob) {
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.preload = 'auto';
  let timer = null, done = null;
  const settle = v => { if (timer) { clearInterval(timer); timer = null; } const d = done; done = null; if (d) d(v); };
  const api = {
    // seconds, once the browser has read the file's header
    duration: () => new Promise(res => {
      if (Number.isFinite(a.duration) && a.duration > 0) return res(a.duration);
      a.addEventListener('loadedmetadata', () => res(a.duration), { once: true });
      a.addEventListener('error', () => res(null), { once: true });
    }),
    currentTime: () => a.currentTime,
    play({ from = 0, to = null, fadeIn = 0.15, fadeOut = 0.6 } = {}) {
      api.stop();
      return new Promise(resolve => {
        done = resolve;
        a.currentTime = from;
        a.volume = 0;
        a.play().catch(() => settle('stopped'));
        timer = setInterval(() => {
          const t = a.currentTime, end = to === null ? a.duration : to;
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
