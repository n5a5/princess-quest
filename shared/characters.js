// shared/characters.js — the cast as inline SVG (original artwork, no external files).
// Luna the unicorn: states idle | happy | think | yay (face groups toggled by CSS class).
// Squishies: soft blob creatures in palette colours. Gem, star, chest, bubble icons.
const NS = 'http://www.w3.org/2000/svg';

export function svgFrom(markup, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const node = t.content.firstElementChild;
  if (cls) node.classList.add(...cls.split(' ').filter(Boolean));
  return node;
}

export const LUNA_COLORS = { body: '#FFF8EE', mane1: '#E2688F', mane2: '#7C5CC4', mane3: '#4DB6A4', horn: '#E9B949', cheek: '#FFC7D6', eye: '#33254F' };

// Luna, redrawn 10/2026 as a kawaii chibi foal (big sparkly eyes, a rainbow cloud mane, a swirl horn): chosen
// from four styles by three judges for a six-year-old's appeal, readability at 52 px and fit with the app.
// Each Luna gets her own gradient ids: with one shared id, every Luna drawn while another copy was hidden
// (display: none) lost her rainbow mane, because the reference resolved to the hidden one.
let lunaCount = 0;
export function lunaSVG({ state = 'idle', glow = 0 } = {}) {
  const u = ++lunaCount;
  const g = Math.max(0, Math.min(3, glow | 0));
  const OL = '#B8A2DE', BODY = '#FFF8EE', FAR = '#EDE3F5', EYE = '#33254F', CHEEK = '#FFC7D6', HORN = '#E9B949', HORN_OL = '#C9971F';
  const P = '#E2688F', V = '#7C5CC4', T = '#4DB6A4';
  const S = `stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"`;
  // Mane curls: one outline layer underneath, then solid colour bands (pink top, purple middle, teal bottom).
  const cloud = (cs) => cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 1.3}" fill="${OL}"/>`).join('') + cs.map(([x, y, r, f]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`).join('');
    const sparkle = (x, y, s, f, st = '') => `<path d="M${+(x).toFixed(2)} ${+(y - s).toFixed(2)}Q${+(x + s * .2).toFixed(2)} ${+(y - s * .2).toFixed(2)} ${+(x + s).toFixed(2)} ${+(y).toFixed(2)}Q${+(x + s * .2).toFixed(2)} ${+(y + s * .2).toFixed(2)} ${+(x).toFixed(2)} ${+(y + s).toFixed(2)}Q${+(x - s * .2).toFixed(2)} ${+(y + s * .2).toFixed(2)} ${+(x - s).toFixed(2)} ${+(y).toFixed(2)}Q${+(x - s * .2).toFixed(2)} ${+(y - s * .2).toFixed(2)} ${+(x).toFixed(2)} ${+(y - s).toFixed(2)}Z" fill="${f}"${st}/>`;
  // Eye: dark oval, purple gloss and two highlights; (dx, dy) moves the gaze (gloss and highlights move with it).
  const eye = (x, y, dx = 0, dy = 0) => `<ellipse cx="${x}" cy="${y}" rx="6.4" ry="7.8" fill="${EYE}"/><ellipse cx="${x + dx * .6}" cy="${y + 3.3 + dy}" rx="4.1" ry="3" fill="${V}" opacity=".7"/><circle cx="${x + 2 + dx}" cy="${y - 3 + dy}" r="2.8" fill="#fff"/><circle cx="${x - 2.1 + dx * .5}" cy="${y + 3.2 + dy * .5}" r="1.25" fill="#fff"/>`;
  // Pill leg with a coloured hoof; drawn before the body so the belly covers its top.
  const leg = (x, top, b, fill, hoof) => `<rect x="${x}" y="${top}" width="11" height="${b - top}" rx="5.5" fill="${fill}"/><path d="M${x} ${b - 5.5}h11a5.5 5.5 0 0 1-11 0z" fill="${hoof}"/><rect x="${x}" y="${top}" width="11" height="${b - top}" rx="5.5" fill="none" ${S}/>`;
  const line = (d, c = EYE, w = 2.4) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shine = (d) => `<path d="${d}" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // Round float noise from the gaze/sparkle maths so the markup stays short.
  return `<svg class="companion ${state}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="Luna the unicorn" role="img">
<defs>
<linearGradient id="hn-${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F8DC86"/><stop offset="1" stop-color="${HORN}"/></linearGradient>
<radialGradient id="gl-${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD24D" stop-opacity=".95"/><stop offset=".45" stop-color="#FFDB70" stop-opacity=".6"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>
</defs>
<g class="body">
<ellipse cx="66" cy="111" rx="36" ry="4.5" fill="${EYE}" opacity=".12"/>
${g >= 1 ? `<ellipse cx="50" cy="19" rx="23" ry="19" fill="url(#gl-${u})"/>` : ''}
${g >= 2 ? `<path d="M82 66C83 52 92 41 108 35C107 41 104 44 100 46C103 49 100 53 96 54C97 58 93 61 88 61Z" fill="#C3ADF0" ${S}/>
<path d="M84 80C84 63 95 49 114 42C114 49 110 53 106 55C110 58 107 63 102 64C105 68 101 72 96 72C97 77 92 81 86 81Z" fill="#D6C4FA" stroke="#9C86D6" stroke-width="2.4" stroke-linejoin="round"/>${line('M90 72Q96 62 107 51', '#A993DA', 1.8)}${line('M93 77Q98 70 103 65', '#A993DA', 1.6)}` : ''}
${leg(58, 86, 107.5, FAR, '#A993DA')}${leg(72, 86, 107.5, FAR, '#A993DA')}
<g transform="translate(-6 9)"><path d="M98 72C106 64 116 68 115 78C114 86 108 88 110 96C111 101 116 102 117 100C114 106 104 104 103 96C102 90 106 84 104 79C102 75 100 76 98 77Z" fill="${P}" ${S}/>
<path d="M99 75C104 72 109 75 108 81C107 87 102 90 103 96C99 92 98 86 101 82C102 79 101 77 99 77Z" fill="${V}"/>
<path d="M104 91C104 98 110 101 114 99C110 98 108 94 108 88Z" fill="${T}"/>${shine('M106 69C111 69 113 73 112.5 77')}</g>
${leg(45, 86, 110.5, BODY, '#B9A3E3')}${leg(84, 86, 110.5, BODY, '#B9A3E3')}
<ellipse cx="70" cy="87" rx="26" ry="12" fill="${BODY}" ${S}/>
${cloud([[66, 27, 8, P], [76, 30, 9, P], [84, 40, 9.5, P], [88, 52, 9, V], [86, 64, 8.5, V], [80, 75, 7.5, T]])}
${shine('M79 34q5 0 6 5')}${shine('M86 58q4 2 4 6')}
<path d="M65 32C66 25 70 19 78.5 15C80.5 22 79 29 75 35Z" fill="${BODY}" ${S}/><path d="M69 30C70 26 72.5 22.5 76.5 20C77.3 24 76.2 27.5 74.3 30.8Z" fill="${CHEEK}"/>
<path d="M32 37C26 31 24.5 24 26.5 17C34 19.5 40 25 42 32Z" fill="${BODY}" ${S}/><path d="M33 31C30 27.5 29 24 29.5 21C33.5 23 36 25.5 37.5 29Z" fill="${CHEEK}"/>
<ellipse cx="54" cy="55" rx="30" ry="27" fill="${BODY}" ${S}/><ellipse cx="39" cy="70" rx="14" ry="10" ${S}/><ellipse cx="54" cy="55" rx="30" ry="27" fill="${BODY}"/><ellipse cx="39" cy="70" rx="14" ry="10" fill="#FFE9E4"/>
<path d="M43.5 31.5L49.4 4.5Q50 3.6 50.6 4.6L57.5 31.5Z" fill="url(#hn-${u})" stroke="${HORN_OL}" stroke-width="2" stroke-linejoin="round"/>
${line('M44.9 27Q50 25 55.6 20M46.3 20.3Q50 18.4 53.7 13.8M47.8 13.4Q50 12.4 51.9 8.8', HORN_OL, 1.8)}
<path d="M62 31C62 24 54 22 47 25C38 27 31 33 30 42C30 47 34 50 37 47C36 42 39 38 45 37C52 36 59 36 62 31Z" fill="${P}" ${S}/>
<path d="M60.5 33.5C56 36 49 35.5 43 37.5C39 39 36.5 42.5 37 47C34 48.5 31 46 31 42.5C32.5 37 38 34.5 45 34C51 33.5 57 34 60.5 33.5Z" fill="${V}"/>
<g transform="translate(73 41)"><circle cy="-3" r="2.6" fill="#FF9EBB"/><circle cx="2.9" cy="-.9" r="2.6" fill="#FF9EBB"/><circle cx="1.8" cy="2.5" r="2.6" fill="#FF9EBB"/><circle cx="-1.8" cy="2.5" r="2.6" fill="#FF9EBB"/><circle cx="-2.9" cy="-.9" r="2.6" fill="#FF9EBB"/><circle r="1.8" fill="${HORN}"/></g>
<ellipse cx="30" cy="67" rx="1.3" ry="1.6" fill="#C7A3C8"/>
<ellipse cx="64.5" cy="62" rx="5.4" ry="3.5" fill="${CHEEK}"/>
<g class="face-idle">${eye(37, 53)}${eye(58, 53)}
${line('M31.1 50.6l-2.8-1.4M64 50.6l2.8-1.4', EYE, 1.9)}
<g transform="translate(-8 .5)">${line('M44 70.5Q48.5 75 53 70.5', EYE, 2.4)}</g></g>
<g class="face-happy">${line('M31 55Q37 47 43 55M52 55Q58 47 64 55', EYE, 3)}
<g transform="translate(-8 .5)"><path d="M43 69.5Q48.5 71 54 69.5Q53.6 77.5 48.5 77.5Q43.4 77.5 43 69.5Z" fill="#E25478" stroke="${EYE}" stroke-width="2.1" stroke-linejoin="round"/><path d="M45.3 75.2Q48.5 72.6 51.7 75.2Q50.4 76.6 48.5 76.6Q46.6 76.6 45.3 75.2Z" fill="#FF9BB6"/></g></g>
<g class="face-think">${eye(37, 53, 1.6, -3)}${eye(58, 53, 1.6, -3)}
${line('M31.5 43.5Q37 42.5 42.5 43.5', EYE, 2.6)}${line('M52.5 41Q58 35.5 64 39', EYE, 2.6)}
<ellipse cx="45" cy="72.5" rx="3" ry="3.2" fill="#E25478" stroke="${EYE}" stroke-width="2"/></g>
<g class="face-yay">${line('M31 56L37 49L43 56M52 56L58 49L64 56', EYE, 3.2)}
<g transform="translate(-8 -.5)"><path d="M42 68.5Q48.5 70.5 55 68.5Q54.2 79 48.5 79Q42.8 79 42 68.5Z" fill="#E25478" stroke="${EYE}" stroke-width="2.2" stroke-linejoin="round"/><path d="M44.7 76.4Q48.5 72.9 52.3 76.4Q50.6 78.4 48.5 78.4Q46.4 78.4 44.7 76.4Z" fill="#FF9BB6"/></g>
${sparkle(14, 40, 7, HORN)}${sparkle(104, 18, 6, T)}${sparkle(16, 86, 5, P)}</g>
${g >= 1 ? sparkle(50, 5.4, 4.4, '#fff', ` stroke="${HORN_OL}" stroke-width=".9" stroke-linejoin="round"`) : ''}
${g >= 3 ? `<path d="M92 25l2.8 5.6 6.1.9-4.4 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="${HORN}" stroke="${HORN_OL}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="92" cy="34.5" r="1.8" fill="${P}"/>` : ''}
</g>
</svg>`.replace(/\d+\.\d{3,}/g, (n) => String(+(+n).toFixed(2)));
}

export const SQUISHY_KINDS = [
  { id: 'rosie', color: '#F5A3BD', dark: '#D97A97', name: 'Rosie' },
  { id: 'minty', color: '#8FDCCB', dark: '#4DB6A4', name: 'Minty' },
  { id: 'sunny', color: '#F9D77B', dark: '#E9B949', name: 'Sunny' },
  { id: 'sky', color: '#9FD3F2', dark: '#5FAEDC', name: 'Skye' },
  { id: 'plummy', color: '#C7B4F0', dark: '#9A7FD6', name: 'Plummy' },
  { id: 'peach', color: '#FFC4A3', dark: '#F09A6C', name: 'Peach' },
  { id: 'berry', color: '#E68FBF', dark: '#C55C99', name: 'Berry' },
  { id: 'leaf', color: '#B8E39A', dark: '#7FC25B', name: 'Leaf' },
  { id: 'cloud', color: '#EDEAF7', dark: '#C3BAE0', name: 'Cloud' },
  { id: 'lilac', color: '#D9C9FF', dark: '#A88BE8', name: 'Lilac' },
  { id: 'coral', color: '#FFB0A0', dark: '#E5786A', name: 'Coral' },
  { id: 'lemon', color: '#FFF0A6', dark: '#E0C24A', name: 'Lemon' },
  { id: 'teal', color: '#9EE0E6', dark: '#4FB7C2', name: 'Teal' },
  { id: 'blush', color: '#FFD1DC', dark: '#EE9AB0', name: 'Blush' },
  { id: 'moss', color: '#CFE8B8', dark: '#94C070', name: 'Moss' },
  { id: 'fern', color: '#A9DFC6', dark: '#5FB894', name: 'Fern' },
  { id: 'dawn', color: '#FFD9B8', dark: '#F0A870', name: 'Dawn' },
  { id: 'pebble', color: '#C9D6E8', dark: '#8FA6C4', name: 'Pebble' }
];

export function squishySVG(kind, { size = 64, bubble = false, sleepy = false } = {}) {
  const k = typeof kind === 'string' ? SQUISHY_KINDS.find(s => s.id === kind) || SQUISHY_KINDS[0] : kind;
  return `
<svg class="squishy" viewBox="0 0 80 80" width="${size}" height="${size}" xmlns="${NS}" aria-label="${k.name} the Squishy" role="img">
  ${bubble ? '<circle cx="40" cy="40" r="37" fill="rgba(160,210,255,0.35)" stroke="rgba(255,255,255,0.9)" stroke-width="2.5"/><path d="M18 26 Q24 16 34 14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>' : ''}
  <g class="blob">
    <ellipse cx="40" cy="70" rx="22" ry="4" fill="#33254F" opacity="0.08"/>
    <path d="M16 52 Q12 26 40 22 Q68 26 64 52 Q62 68 40 68 Q18 68 16 52 Z" fill="${k.color}" stroke="${k.dark}" stroke-width="2.5"/>
    <ellipse cx="30" cy="34" rx="7" ry="5" fill="#fff" opacity="0.55"/>
    ${sleepy
      ? `<path d="M30 44 Q34 47 38 44 M42 44 Q46 47 50 44" stroke="#33254F" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<circle cx="33" cy="44" r="3.5" fill="#33254F"/><circle cx="34.3" cy="42.8" r="1.2" fill="#fff"/><circle cx="47" cy="44" r="3.5" fill="#33254F"/><circle cx="48.3" cy="42.8" r="1.2" fill="#fff"/>`}
    <path d="M35 54 Q40 58 45 54" stroke="#33254F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="26" cy="51" r="3.5" fill="#FF9FB8" opacity="0.7"/><circle cx="54" cy="51" r="3.5" fill="#FF9FB8" opacity="0.7"/>
  </g>
</svg>`;
}

export function gemSVG(size = 22) {
  return `<svg class="gem-icon" viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="${NS}" aria-hidden="true"><path d="M6 3h12l4 6-10 13L2 9z" fill="#7CC7F0" stroke="#3E8FC9" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 9h20M6 3l4 6 2-6 2 6 4-6M10 9l2 13 2-13" stroke="#fff" stroke-width="1.2" opacity="0.8" fill="none"/></svg>`;
}

export function chestSVG({ open = false } = {}) {
  return `<svg class="chest" viewBox="0 0 150 120" xmlns="${NS}" aria-hidden="true">
  <rect x="20" y="52" width="110" height="56" rx="10" fill="#A0663A" stroke="#6E4222" stroke-width="3"/>
  <rect x="20" y="52" width="110" height="14" fill="#8A5530"/>
  ${open
    ? '<path d="M20 52 Q22 12 75 12 Q128 12 130 52 L118 52 Q116 26 75 26 Q34 26 32 52 Z" fill="#B87543" stroke="#6E4222" stroke-width="3"/><ellipse cx="75" cy="52" rx="48" ry="10" fill="#FFE9A8"/><path d="M50 52 l6-12 l6 12 M70 52 l5-16 l5 16 M92 52 l6-10 l6 10" fill="#7CC7F0" stroke="#3E8FC9" stroke-width="2" stroke-linejoin="round"/>'
    : '<path d="M20 52 Q20 22 75 22 Q130 22 130 52 Z" fill="#B87543" stroke="#6E4222" stroke-width="3"/>'}
  <rect x="66" y="58" width="18" height="18" rx="4" fill="#E9B949" stroke="#C9971F" stroke-width="2"/>
  <circle cx="75" cy="67" r="3" fill="#6E4222"/>
</svg>`;
}

export function placeArtSVG(id) {
  const arts = {
    meadow: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><ellipse cx="32" cy="52" rx="28" ry="8" fill="#9CD67C"/><path d="M12 52 Q20 30 32 34 Q44 30 52 52 Z" fill="#B8E39A"/><circle cx="20" cy="40" r="5" fill="#F5A3BD"/><circle cx="44" cy="38" r="5" fill="#F9D77B"/><circle cx="32" cy="46" r="4" fill="#C7B4F0"/><path d="M32 12 l3 7 h7 l-6 4 l2 7 l-6 -4 l-6 4 l2 -7 l-6 -4 h7 z" fill="#E9B949"/></svg>`,
    well: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><rect x="16" y="30" width="32" height="22" rx="4" fill="#B9A7E6"/><rect x="12" y="26" width="40" height="8" rx="4" fill="#9A7FD6"/><path d="M20 26 L32 10 L44 26 Z" fill="#E2688F"/><rect x="30" y="8" width="4" height="20" fill="#8A5530"/><circle cx="32" cy="44" r="6" fill="#7CC7F0"/><path d="M26 44 Q32 38 38 44" stroke="#fff" stroke-width="2" fill="none"/></svg>`,
    caverns: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><path d="M6 56 L14 22 L24 40 L32 10 L40 40 L50 20 L58 56 Z" fill="#9A7FD6"/><path d="M22 56 L28 34 L36 56 Z" fill="#C7B4F0"/><path d="M24 30 l4 -6 l4 6 l-4 8 z" fill="#7CC7F0" stroke="#3E8FC9" stroke-width="1.5"/><path d="M42 36 l3 -5 l3 5 l-3 6 z" fill="#F5A3BD" stroke="#D97A97" stroke-width="1.5"/></svg>`,
    falls: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><path d="M6 40 Q32 6 58 40" stroke="#E2688F" stroke-width="5" fill="none"/><path d="M10 40 Q32 12 54 40" stroke="#E9B949" stroke-width="5" fill="none"/><path d="M14 40 Q32 18 50 40" stroke="#4DB6A4" stroke-width="5" fill="none"/><path d="M18 40 Q32 24 46 40" stroke="#7CC7F0" stroke-width="5" fill="none"/><rect x="26" y="34" width="12" height="20" rx="4" fill="#9FD3F2"/><ellipse cx="32" cy="56" rx="18" ry="5" fill="#7CC7F0"/></svg>`,
    garden: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><ellipse cx="32" cy="50" rx="28" ry="9" fill="#B8E39A"/><path d="M14 44 Q14 24 32 22 Q50 24 50 44 Q48 56 32 56 Q16 56 14 44 Z" fill="#F5A3BD" stroke="#D97A97" stroke-width="2"/><circle cx="26" cy="38" r="3" fill="#33254F"/><circle cx="38" cy="38" r="3" fill="#33254F"/><path d="M27 46 Q32 50 37 46" stroke="#33254F" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="30" r="5" fill="#F9D77B"/><circle cx="52" cy="28" r="5" fill="#8FDCCB"/><path d="M8 20 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" fill="#E9B949"/></svg>`,
    woods: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><ellipse cx="32" cy="54" rx="28" ry="7" fill="#7FC2A5"/><path d="M14 52 L22 26 L30 52 Z" fill="#4DB6A4"/><path d="M26 52 L36 14 L46 52 Z" fill="#3A9C89"/><path d="M40 52 L48 30 L56 52 Z" fill="#5FB894"/><rect x="34" y="46" width="4" height="8" fill="#8A5530"/><path d="M8 20 q4 -6 8 0 q-4 6 -8 0 z" fill="#FFF8EE" opacity="0.9"/><path d="M6 24 q3 -3 6 0" stroke="#33254F" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M4 22 q2 -2 4 0 M8 19 q2 -2 4 0" stroke="#7C5CC4" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.8"/><circle cx="50" cy="16" r="3" fill="#F9D77B"/><circle cx="56" cy="24" r="2" fill="#F9D77B"/><circle cx="12" cy="40" r="2" fill="#F5A3BD"/></svg>`,
    stage: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><rect x="4" y="48" width="56" height="10" rx="2" fill="#B07A45"/><ellipse cx="32" cy="49" rx="16" ry="3.5" fill="#F9D77B" opacity="0.7"/><rect x="4" y="6" width="56" height="7" rx="2" fill="#B83A5E"/><path d="M4 13 Q16 13 18 22 Q12 34 14 48 L4 48 Z" fill="#E2688F"/><path d="M60 13 Q48 13 46 22 Q52 34 50 48 L60 48 Z" fill="#E2688F"/><path d="M8 16 Q10 30 8 46 M56 16 Q54 30 56 46" stroke="#C9466E" stroke-width="2" fill="none"/><path d="M32 20 l3.5 7.5 h8 l-6.5 4.8 l2.5 7.7 l-7.5 -4.8 l-7.5 4.8 l2.5 -7.7 l-6.5 -4.8 h8 z" fill="#E9B949" stroke="#C99A2E" stroke-width="1"/></svg>`,
    castle: `<svg viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true"><rect x="12" y="28" width="40" height="28" rx="3" fill="#F3D9A4"/><rect x="8" y="20" width="12" height="36" rx="2" fill="#E9C27E"/><rect x="44" y="20" width="12" height="36" rx="2" fill="#E9C27E"/><path d="M8 20 L14 8 L20 20 Z" fill="#E2688F"/><path d="M44 20 L50 8 L56 20 Z" fill="#E2688F"/><path d="M26 32 Q32 22 38 32 L38 56 L26 56 Z" fill="#7C5CC4"/><rect x="28" y="12" width="8" height="12" fill="#F3D9A4"/><path d="M28 12 L32 4 L36 12 Z" fill="#E9B949"/></svg>`
  };
  return arts[id] || arts.meadow;
}

export function starFieldEl(count = 40) {
  const f = document.createElement('div');
  f.className = 'star-field';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animation = `twinkle ${2 + Math.random() * 3}s ease-in-out ${Math.random() * 3}s infinite`;
    f.appendChild(s);
  }
  return f;
}
