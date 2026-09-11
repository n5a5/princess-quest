// games/registry.js — every cabinet on the home screen. Adding a game = add an entry + its folder.
// `ready: false` shows a 🌱 card that says "coming soon" until the module ships.
export const REGISTRY = [
  { id: 'try-it',          group: 'princess-quest', name: 'Try It',                 icon: '🎈', strands: ['ELA.K.F.1.2'], subskills: ['pa-sounds'], entry: './games/princess-quest/try-it.js', minTier: 1, ready: true },
  { id: 'word-builder',    group: 'princess-quest', name: 'Word Builder',           icon: '📚', strands: ['ELA.K.F.1.3'], subskills: ['phonics-encode', 'phonics-decode'], entry: './games/princess-quest/word-builder.js', minTier: 1, ready: false },
  { id: 'sound-garden',    group: 'princess-quest', name: 'Sound Garden',           icon: '🌻', strands: ['ELA.K.F.1.2'], subskills: ['pa-sounds', 'pa-blend-segment', 'pa-manipulate'], entry: './games/princess-quest/sound-garden.js', minTier: 1, ready: false },
  { id: 'sight-words',     group: 'princess-quest', name: 'Sight Word Meadow',      icon: '🌷', strands: ['ELA.K.F.1.4'], subskills: [], entry: './games/princess-quest/sight-words.js', minTier: 1, ready: false },
  { id: 'number-kingdom',  group: 'princess-quest', name: 'Number Kingdom',         icon: '🧮', strands: ['MA.K.NSO.1.1', 'MA.K.NSO.2.1', 'MA.K.NSO.3.1'], subskills: ['subitize-tenframe', 'teen-compare', 'add-sub', 'count-sequence'], entry: './games/princess-quest/number-kingdom.js', minTier: 1, ready: false },
  { id: 'number-stories',  group: 'princess-quest', name: 'Number Stories',         icon: '🔷', strands: ['MA.K.AR.1.2'], subskills: ['decompose-stories'], entry: './games/princess-quest/number-stories.js', minTier: 2, ready: false },
  { id: 'measure-sort',    group: 'princess-quest', name: 'Measure, Sort & Shapes', icon: '📏', strands: ['MA.K.M.1.2', 'MA.K.DP.1.1', 'MA.K.GR.1.1'], subskills: ['measure', 'data-sort', 'shapes'], entry: './games/princess-quest/measure-sort.js', minTier: 1, ready: false },
  { id: 'story-garden',    group: 'princess-quest', name: 'Story Garden',           icon: '📖', strands: ['ELA.K.R.1.1', 'ELA.K.V.1.3'], subskills: ['comprehension'], entry: './games/princess-quest/story-garden.js', minTier: 3, ready: false },
  { id: 'calm-castle',     group: 'princess-quest', name: 'Calm Castle',            icon: '🫧', strands: [], subskills: [], entry: './games/princess-quest/calm-castle.js', minTier: 1, ready: false },
  { id: 'uh-oh',           group: 'princess-quest', name: 'Uh-Oh Academy',          icon: '🤗', strands: [], subskills: [], entry: './games/princess-quest/uh-oh.js', minTier: 1, ready: false },
  { id: 'kingdom-builder', group: 'princess-quest', name: 'Kingdom Builder',        icon: '🏰', strands: [], subskills: [], entry: './games/princess-quest/kingdom-builder.js', minTier: 1, ready: false }
];
