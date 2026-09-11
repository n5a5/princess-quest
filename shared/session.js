// shared/session.js — pure active-time clock behind the "One more or all done?" shaper.
export function createSessionClock({ now = () => Date.now(), idleGapMs = 60000, limitMs = 10 * 60000 } = {}) {
  let active = 0, last = null, fired = false;
  return {
    touch() {
      const t = now();
      if (last !== null && t - last < idleGapMs) active += t - last;
      last = t;
      return active;
    },
    activeMs: () => active,
    due() { if (!fired && active >= limitMs) { fired = true; return true; } return false; },
    reset() { active = 0; last = null; fired = false; }
  };
}
