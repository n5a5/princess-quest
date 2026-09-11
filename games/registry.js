// games/registry.js — the five places of the kingdom. Each place is one cabinet module hosting
// several encounter families. Adding a place = add an entry + its module; the map reads this list.
// `ready: false` shows the place greyed with "coming soon".
export const REGISTRY = [
  { id: 'meadow',  place: 'meadow',  name: 'Unicorn Meadow',  hint: 'Sounds and word magic',   icon: '🦄', strands: ['ELA.K.F.1.2', 'ELA.K.F.1.3'], subskills: ['phonics-encode', 'phonics-decode', 'pa-sounds', 'pa-blend-segment', 'pa-manipulate'], entry: './games/princess-quest/meadow.js',  minTier: 1, ready: true },
  { id: 'well',    place: 'well',    name: 'Wishing Well',    hint: 'Heart words',             icon: '🌷', strands: ['ELA.K.F.1.4'], subskills: ['sight-words'], entry: './games/princess-quest/well.js', minTier: 1, ready: true },
  { id: 'caverns', place: 'caverns', name: 'Crystal Caverns', hint: 'Gems and numbers',        icon: '💎', strands: ['MA.K.NSO.1.1', 'MA.K.NSO.2.1', 'MA.K.NSO.3.1', 'MA.K.AR.1.1'], subskills: ['subitize-tenframe', 'teen-compare', 'add-sub', 'count-sequence', 'decompose-stories'], entry: './games/princess-quest/caverns.js', minTier: 1, ready: true },
  { id: 'falls',   place: 'falls',   name: 'Rainbow Falls',   hint: 'Measure, sort, shapes',   icon: '🌈', strands: ['MA.K.M.1.2', 'MA.K.DP.1.1', 'MA.K.GR.1.1'], subskills: ['measure', 'data-sort', 'shapes'], entry: './games/princess-quest/falls.js', minTier: 1, ready: true },
  { id: 'castle',  place: 'castle',  name: 'Story Castle',    hint: 'Stories, poems and calm', icon: '🏰', strands: ['ELA.K.R.1.1', 'ELA.K.R.1.4'], subskills: ['comprehension'], entry: './games/princess-quest/castle.js', minTier: 3, ready: true }
];

// Squishies trapped in bubbles, three per place. Rescued in order as rounds are completed there.
export const SQUISHIES = {
  meadow: ['rosie', 'minty', 'sunny'],
  well: ['sky', 'plummy', 'peach'],
  caverns: ['berry', 'leaf', 'cloud'],
  falls: ['lilac', 'coral', 'lemon'],
  castle: ['teal', 'blush', 'moss']
};
