// games/registry.js — the five places of the kingdom. Each place is one cabinet module hosting
// several encounter families. Adding a place = add an entry + its module; the map reads this list.
// `ready: false` shows the place greyed with "coming soon".
export const REGISTRY = [
  { id: 'meadow',  place: 'meadow',  name: 'Unicorn Meadow',  hint: 'Letter stones and word magic', icon: '🦄', strands: ['ELA.K.F.1.3'], subskills: ['phonics-gpc', 'phonics-encode', 'phonics-decode', 'decodable-reading'], entry: './games/princess-quest/meadow.js',  minTier: 1, ready: true },
  { id: 'woods',   place: 'woods',   name: 'Whisper Woods',   hint: 'Listen for sounds',        icon: '👂', strands: ['ELA.K.F.1.2'], subskills: ['pa-sounds', 'pa-blend-segment', 'pa-manipulate', 'pa-rhyme'], entry: './games/princess-quest/woods.js', minTier: 1, ready: true },
  { id: 'well',    place: 'well',    name: 'Wishing Well',    hint: 'Heart words',             icon: '🌷', strands: ['ELA.K.F.1.4'], subskills: ['sight-words'], entry: './games/princess-quest/well.js', minTier: 1, ready: true },
  { id: 'caverns', place: 'caverns', name: 'Crystal Caverns', hint: 'Gems and numbers',        icon: '💎', strands: ['MA.K.NSO.1.1', 'MA.K.NSO.2.1', 'MA.K.NSO.3.1', 'MA.K.AR.1.1'], subskills: ['subitize-tenframe', 'number-relations', 'teen-compare', 'add-sub', 'decompose-stories', 'count-sequence'], entry: './games/princess-quest/caverns.js', minTier: 1, ready: true },
  { id: 'falls',   place: 'falls',   name: 'Rainbow Falls',   hint: 'Measure, sort, shapes',   icon: '🌈', strands: ['MA.K.M.1.2', 'MA.K.DP.1.1', 'MA.K.AR.1.2', 'MA.K.GR.1.1'], subskills: ['measure', 'data-sort', 'patterns', 'shapes'], entry: './games/princess-quest/falls.js', minTier: 1, ready: true },
  { id: 'castle',  place: 'castle',  name: 'Story Castle',    hint: 'Stories, poems and calm', icon: '🏰', strands: ['ELA.K.R.1.1', 'ELA.K.R.1.4'], subskills: ['comprehension'], entry: './games/princess-quest/castle.js', minTier: 3, ready: true },
  { id: 'garden',  place: 'garden',  name: 'Squishy Garden',  hint: 'Your Squishies and gems',  icon: '🏡', strands: [], subskills: [], entry: './games/princess-quest/garden.js', minTier: 1, ready: true, reward: true }
];

// Squishies trapped in bubbles, three per place. Rescued in order as rounds are completed there.
export const SQUISHIES = {
  meadow: ['rosie', 'minty', 'sunny'],
  woods: ['fern', 'dawn', 'pebble'],
  well: ['sky', 'plummy', 'peach'],
  caverns: ['berry', 'leaf', 'cloud'],
  falls: ['lilac', 'coral', 'lemon'],
  castle: ['teal', 'blush', 'moss']
};
