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

export function lunaSVG({ state = 'idle', glow = 0 } = {}) {
  const c = LUNA_COLORS;
  const g = Math.max(0, Math.min(3, glow));
  return `
<svg class="companion ${state}" viewBox="0 0 120 120" xmlns="${NS}" aria-label="Luna the unicorn" role="img">
  <defs>
    <linearGradient id="mane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.mane1}"/><stop offset="0.5" stop-color="${c.mane2}"/><stop offset="1" stop-color="${c.mane3}"/></linearGradient>
    <radialGradient id="hornglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF3C4" stop-opacity="0.9"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="body">
    ${g >= 1 ? '<circle cx="66" cy="22" r="18" fill="url(#hornglow)"/>' : ''}
    ${g >= 2 ? '<path d="M26 70 C10 60 12 42 30 44 C22 56 26 64 34 68 Z" fill="#E4D6FF" stroke="#B9A7E6" stroke-width="2"/><path d="M94 70 C110 60 108 42 90 44 C98 56 94 64 86 68 Z" fill="#E4D6FF" stroke="#B9A7E6" stroke-width="2"/>' : ''}
    <ellipse cx="60" cy="112" rx="34" ry="5" fill="#33254F" opacity="0.08"/>
    <path d="M30 100 L30 84 Q30 62 52 60 L86 60 Q100 62 100 78 L100 100 Q100 106 94 106 L92 106 Q88 106 88 100 L88 90 L72 90 L72 100 Q72 106 66 106 L64 106 Q60 106 60 100 L60 92 L46 92 L46 100 Q46 106 40 106 L36 106 Q30 106 30 100 Z" fill="${c.body}" stroke="#D8CCEB" stroke-width="2.5"/>
    <path d="M86 62 Q108 60 106 74 Q104 86 90 82" fill="url(#mane)" opacity="0.9"/>
    <path d="M46 26 Q34 30 34 46 L34 66 Q34 76 46 76 L64 76 Q78 76 78 62 L78 46 Q78 26 62 24 Z" fill="${c.body}" stroke="#D8CCEB" stroke-width="2.5"/>
    <path d="M56 24 L66 4 L72 26 Z" fill="${c.horn}" stroke="#C9971F" stroke-width="2" stroke-linejoin="round"/>
    <path d="M60 18 L66 10 M63 22 L69 14" stroke="#FFF3C4" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M40 30 Q44 16 52 24 Q48 30 44 34 Z" fill="${c.body}" stroke="#D8CCEB" stroke-width="2"/>
    <path d="M42 30 Q44 22 49 26 Q46 30 44 32 Z" fill="${c.cheek}"/>
    <path d="M46 26 Q30 24 26 44 Q22 62 30 70 Q34 56 36 44 Q40 32 52 30 Z" fill="url(#mane)"/>
    <path d="M30 70 Q24 80 30 92 Q34 82 36 74 Z" fill="url(#mane)" opacity="0.85"/>
    <circle cx="39" cy="60" r="6" fill="${c.cheek}" opacity="0.8"/>
    <g class="face-idle">
      <ellipse cx="50" cy="50" rx="4.5" ry="6" fill="${c.eye}"/><circle cx="51.5" cy="47.5" r="1.6" fill="#fff"/>
      <ellipse cx="68" cy="50" rx="4.5" ry="6" fill="${c.eye}"/><circle cx="69.5" cy="47.5" r="1.6" fill="#fff"/>
      <path d="M52 66 Q59 70 66 66" stroke="${c.eye}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <g class="face-happy">
      <path d="M45 50 Q50 44 55 50" stroke="${c.eye}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M63 50 Q68 44 73 50" stroke="${c.eye}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M50 64 Q59 74 68 64" stroke="${c.eye}" stroke-width="2.5" fill="#FFB8CB" stroke-linecap="round"/>
    </g>
    <g class="face-think">
      <ellipse cx="50" cy="51" rx="4.5" ry="5" fill="${c.eye}"/><circle cx="52" cy="49" r="1.5" fill="#fff"/>
      <ellipse cx="68" cy="51" rx="4.5" ry="5" fill="${c.eye}"/><circle cx="70" cy="49" r="1.5" fill="#fff"/>
      <path d="M44 42 Q50 40 55 43" stroke="${c.eye}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M53 67 Q59 65 65 67" stroke="${c.eye}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </g>
    <g class="face-yay">
      <path d="M44 48 L50 44 L56 48" stroke="${c.eye}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M62 48 L68 44 L74 48" stroke="${c.eye}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M48 62 Q59 78 70 62 Z" fill="#FFB8CB" stroke="${c.eye}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M22 40 l3 -6 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 Z" fill="${c.horn}"/>
      <path d="M96 30 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 Z" fill="${c.mane3}"/>
    </g>
    ${g >= 3 ? '<path d="M50 8 L54 14 L60 12 L58 18 L64 22 L57 23 L56 30 L52 25 L46 27 L48 21 L42 18 L48 16 Z" fill="#E9B949" stroke="#C9971F" stroke-width="1.5" stroke-linejoin="round"/>' : ''}
  </g>
</svg>`;
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
  { id: 'moss', color: '#CFE8B8', dark: '#94C070', name: 'Moss' }
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
