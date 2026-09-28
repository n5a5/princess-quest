// shared/mouths.js — small mouth drawings for the sounds children mix up (th/f/s/d, and their voiced twins).
// Original line art, no third-party assets. mouthSVG(id) returns an SVG string or null when a sound has no
// cue; the same drawing serves a voiced and voiceless pair (th/dh, f/v, s/z, t/d), with a small "voice on"
// wave for the voiced one. DOM-free so it can be unit-tested.
const LIPS = '#C0395B', SKIN = '#FFE3CF', TEETH = '#FFFFFF', TONGUE = '#F28BA8', LINE = '#33254F';
const frame = (body, voiced) => `<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="40" cy="40" r="36" fill="${SKIN}"/>${body}
  ${voiced ? `<path d="M52 66 q3 -5 6 0 t6 0 t6 0" stroke="${LINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` : ''}
</svg>`;
// tongue tip between the teeth (th as in thumb / this)
const th = `<path d="M18 42 q22 -10 44 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M18 42 q22 12 44 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="26" y="40" width="28" height="7" rx="2" fill="${TEETH}" stroke="${LINE}" stroke-width="1"/>
  <path d="M32 47 q8 6 16 0 v-8 q-8 -4 -16 0 z" fill="${TONGUE}" stroke="${LINE}" stroke-width="1"/>`;
// top teeth resting on the lower lip (f / v)
const f = `<path d="M18 40 q22 -12 44 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="27" y="38" width="26" height="9" rx="2" fill="${TEETH}" stroke="${LINE}" stroke-width="1"/>
  <path d="M20 50 q20 -6 40 0 q-20 10 -40 0 z" fill="${LIPS}"/>`;
// teeth together, lips in a small smile (s / z)
const s = `<path d="M16 42 q24 -10 48 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M16 42 q24 14 48 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="24" y="41" width="32" height="5" rx="1.5" fill="${TEETH}" stroke="${LINE}" stroke-width="1"/>
  <line x1="24" y1="46" x2="56" y2="46" stroke="${LINE}" stroke-width="1"/>`;
// mouth open a little, tongue tip up behind the top teeth (t / d)
const t = `<ellipse cx="40" cy="44" rx="18" ry="11" fill="${LINE}"/>
  <rect x="26" y="33" width="28" height="6" rx="2" fill="${TEETH}" stroke="${LINE}" stroke-width="1"/>
  <path d="M30 52 q10 -18 20 -12 q-2 8 -20 12 z" fill="${TONGUE}"/>
  <path d="M22 40 q18 -12 36 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M22 46 q18 16 36 0" stroke="${LIPS}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
// lips pushed forward in a small round (sh / ch)
const sh = `<ellipse cx="40" cy="44" rx="11" ry="12" fill="${LINE}"/>
  <ellipse cx="40" cy="44" rx="15" ry="16" stroke="${LIPS}" stroke-width="5" fill="none"/>
  <rect x="31" y="34" width="18" height="5" rx="2" fill="${TEETH}"/>`;
const MOUTHS = { th: [th, false], dh: [th, true], f: [f, false], v: [f, true], s: [s, false], z: [s, true], t: [t, false], d: [t, true], sh: [sh, false], ch: [sh, false] };

export const MOUTH_IDS = Object.keys(MOUTHS);
export function mouthSVG(id) {
  const m = MOUTHS[id];
  return m ? frame(m[0], m[1]) : null;
}
