// ==================== AMELIA'S PRINCESS WORLD — CONTENT DATA ====================
// Pure data, no logic. Loaded before core.js.

// ---------- PHONICS ----------
// Standard synthetic-phonics teaching order. A new set "blooms" in the garden
// once every letter in the newest open set has 2+ stars.
const PHONICS_SETS = [
  ['s', 'a', 't', 'p'],
  ['i', 'n', 'm', 'd'],
  ['g', 'o', 'c', 'k'],
  ['ck', 'e', 'u', 'r'],
  ['h', 'b', 'f', 'l'],
  ['j', 'v', 'w', 'x'],
  ['y', 'z', 'qu']
];

// Per letter: sound = hand-tuned string the TTS engine says for the *sound*
// (continuants sustained, stops with a light schwa — audit by ear on device),
// hint = "like ..." anchor, words = 3 picture words for variety.
const LETTERS = {
  s:  { sound: 'sss',  words: [{ w: 'sun', e: '☀️' }, { w: 'star', e: '⭐' }, { w: 'sock', e: '🧦' }] },
  a:  { sound: 'aah',  words: [{ w: 'apple', e: '🍎' }, { w: 'ant', e: '🐜' }, { w: 'alligator', e: '🐊' }] },
  t:  { sound: 'tuh',  words: [{ w: 'tiger', e: '🐯' }, { w: 'turtle', e: '🐢' }, { w: 'tooth', e: '🦷' }] },
  p:  { sound: 'puh',  words: [{ w: 'pig', e: '🐷' }, { w: 'pizza', e: '🍕' }, { w: 'princess', e: '👸' }] },
  i:  { sound: 'ih',   words: [{ w: 'insect', e: '🐛' }, { w: 'iguana', e: '🦎' }, { w: 'ink', e: '🖊️' }] },
  n:  { sound: 'nnn',  words: [{ w: 'nose', e: '👃' }, { w: 'nut', e: '🥜' }, { w: 'nest', e: '🐣' }] },
  m:  { sound: 'mmm',  words: [{ w: 'moon', e: '🌙' }, { w: 'mouse', e: '🐭' }, { w: 'mermaid', e: '🧜‍♀️' }] },
  d:  { sound: 'duh',  words: [{ w: 'dog', e: '🐶' }, { w: 'duck', e: '🦆' }, { w: 'dragon', e: '🐉' }] },
  g:  { sound: 'guh',  words: [{ w: 'goat', e: '🐐' }, { w: 'grapes', e: '🍇' }, { w: 'gift', e: '🎁' }] },
  o:  { sound: 'oh',   words: [{ w: 'octopus', e: '🐙' }, { w: 'orange', e: '🍊' }, { w: 'otter', e: '🦦' }] },
  c:  { sound: 'kuh',  words: [{ w: 'cat', e: '🐱' }, { w: 'cake', e: '🎂' }, { w: 'crown', e: '👑' }] },
  k:  { sound: 'kuh',  words: [{ w: 'kite', e: '🪁' }, { w: 'key', e: '🔑' }, { w: 'koala', e: '🐨' }] },
  ck: { sound: 'kuh',  endSound: true, words: [{ w: 'duck', e: '🦆' }, { w: 'sock', e: '🧦' }, { w: 'clock', e: '⏰' }] },
  e:  { sound: 'eh',   words: [{ w: 'egg', e: '🥚' }, { w: 'elephant', e: '🐘' }, { w: 'elf', e: '🧝‍♀️' }] },
  u:  { sound: 'uh',   words: [{ w: 'umbrella', e: '☂️' }, { w: 'up', e: '⬆️' }, { w: 'under', e: '⬇️' }] },
  r:  { sound: 'rrr',  words: [{ w: 'rainbow', e: '🌈' }, { w: 'rabbit', e: '🐰' }, { w: 'ring', e: '💍' }] },
  h:  { sound: 'huh',  words: [{ w: 'heart', e: '💖' }, { w: 'horse', e: '🐴' }, { w: 'hat', e: '🎩' }] },
  b:  { sound: 'buh',  words: [{ w: 'butterfly', e: '🦋' }, { w: 'ball', e: '⚽' }, { w: 'bunny', e: '🐇' }] },
  f:  { sound: 'fff',  words: [{ w: 'fish', e: '🐟' }, { w: 'flower', e: '🌸' }, { w: 'fairy', e: '🧚‍♀️' }] },
  l:  { sound: 'lll',  words: [{ w: 'lion', e: '🦁' }, { w: 'lemon', e: '🍋' }, { w: 'leaf', e: '🍃' }] },
  j:  { sound: 'juh',  words: [{ w: 'juice', e: '🧃' }, { w: 'jewel', e: '💎' }, { w: 'jacket', e: '🧥' }] },
  v:  { sound: 'vvv',  words: [{ w: 'violin', e: '🎻' }, { w: 'volcano', e: '🌋' }, { w: 'van', e: '🚐' }] },
  w:  { sound: 'wuh',  words: [{ w: 'watermelon', e: '🍉' }, { w: 'wave', e: '🌊' }, { w: 'whale', e: '🐳' }] },
  x:  { sound: 'ks',   endSound: true, words: [{ w: 'fox', e: '🦊' }, { w: 'box', e: '📦' }, { w: 'six', e: '6️⃣' }] },
  y:  { sound: 'yuh',  words: [{ w: 'yo-yo', e: '🪀' }, { w: 'yarn', e: '🧶' }, { w: 'yellow', e: '💛' }] },
  z:  { sound: 'zzz',  words: [{ w: 'zebra', e: '🦓' }, { w: 'zipper', e: '🧥' }, { w: 'zigzag', e: '⚡' }] },
  qu: { sound: 'kwuh', words: [{ w: 'queen', e: '👸' }, { w: 'quilt', e: '🛏️' }, { w: 'question', e: '❓' }] }
};

// CVC (and CVCC ck) words for Word Builder, tagged with the earliest set
// (0-based) whose cumulative letters cover the word. Words with an emoji can
// show a picture; the rest are still blendable.
const CVC_WORDS = [
  { word: 'sat', set: 0 }, { word: 'tap', set: 0, e: '👏' }, { word: 'pat', set: 0 }, { word: 'sap', set: 0 },
  { word: 'pin', set: 1, e: '📌' }, { word: 'sit', set: 1, e: '🪑' }, { word: 'pit', set: 1 }, { word: 'nap', set: 1, e: '😴' },
  { word: 'man', set: 1, e: '👨' }, { word: 'mat', set: 1 }, { word: 'map', set: 1, e: '🗺️' }, { word: 'dad', set: 1, e: '👨' },
  { word: 'sad', set: 1, e: '😢' }, { word: 'mad', set: 1, e: '😠' }, { word: 'pan', set: 1, e: '🍳' }, { word: 'tan', set: 1 },
  { word: 'dip', set: 1 }, { word: 'tin', set: 1 },
  { word: 'cat', set: 2, e: '🐱' }, { word: 'dog', set: 2, e: '🐶' }, { word: 'pig', set: 2, e: '🐷' }, { word: 'cap', set: 2, e: '🧢' },
  { word: 'can', set: 2, e: '🥫' }, { word: 'pot', set: 2, e: '🍲' }, { word: 'top', set: 2, e: '👕' }, { word: 'mop', set: 2, e: '🧹' },
  { word: 'dig', set: 2, e: '⛏️' }, { word: 'kid', set: 2, e: '🧒' }, { word: 'cot', set: 2, e: '🛏️' }, { word: 'got', set: 2 },
  { word: 'gap', set: 2 }, { word: 'nod', set: 2 }, { word: 'kit', set: 2, e: '🧰' },
  { word: 'duck', set: 3, e: '🦆', tiles: ['d', 'u', 'ck'] }, { word: 'sock', set: 3, e: '🧦', tiles: ['s', 'o', 'ck'] },
  { word: 'kick', set: 3, e: '⚽', tiles: ['k', 'i', 'ck'] }, { word: 'rock', set: 3, e: '🪨', tiles: ['r', 'o', 'ck'] },
  { word: 'pick', set: 3, tiles: ['p', 'i', 'ck'] }, { word: 'neck', set: 3, tiles: ['n', 'e', 'ck'] },
  { word: 'red', set: 3, e: '🔴' }, { word: 'ten', set: 3, e: '🔟' }, { word: 'pen', set: 3, e: '🖊️' },
  { word: 'net', set: 3, e: '🥅' }, { word: 'pet', set: 3, e: '🐾' }, { word: 'run', set: 3, e: '🏃‍♀️' },
  { word: 'sun', set: 3, e: '☀️' }, { word: 'cup', set: 3, e: '☕' }, { word: 'nut', set: 3, e: '🥜' },
  { word: 'cut', set: 3, e: '✂️' }, { word: 'rat', set: 3, e: '🐀' }, { word: 'rug', set: 3 }, { word: 'men', set: 3 },
  { word: 'hat', set: 4, e: '🎩' }, { word: 'hen', set: 4, e: '🐔' }, { word: 'hop', set: 4, e: '🐰' },
  { word: 'hot', set: 4, e: '🔥' }, { word: 'hug', set: 4, e: '🤗' }, { word: 'bat', set: 4, e: '🦇' },
  { word: 'bed', set: 4, e: '🛏️' }, { word: 'big', set: 4, e: '🐘' }, { word: 'bug', set: 4, e: '🐛' },
  { word: 'bus', set: 4, e: '🚌' }, { word: 'fan', set: 4, e: '🍃' }, { word: 'fin', set: 4, e: '🐟' },
  { word: 'fun', set: 4, e: '🎉' }, { word: 'log', set: 4, e: '🪵' }, { word: 'leg', set: 4, e: '🦵' },
  { word: 'lip', set: 4, e: '👄' }, { word: 'luck', set: 4, e: '🍀', tiles: ['l', 'u', 'ck'] },
  { word: 'jet', set: 5, e: '✈️' }, { word: 'jam', set: 5, e: '🍓' }, { word: 'jog', set: 5, e: '🏃‍♀️' },
  { word: 'van', set: 5, e: '🚐' }, { word: 'vet', set: 5, e: '🩺' }, { word: 'wet', set: 5, e: '💧' },
  { word: 'win', set: 5, e: '🏆' }, { word: 'wig', set: 5, e: '👩‍🦰' }, { word: 'web', set: 5, e: '🕸️' },
  { word: 'box', set: 5, e: '📦' }, { word: 'fox', set: 5, e: '🦊' }, { word: 'six', set: 5, e: '6️⃣' },
  { word: 'mix', set: 5, e: '🥣' }, { word: 'wax', set: 5, e: '🕯️' },
  { word: 'yes', set: 6, e: '✅' }, { word: 'yum', set: 6, e: '😋' }, { word: 'zip', set: 6, e: '🧥' },
  { word: 'zap', set: 6, e: '⚡' }, { word: 'quiz', set: 6, e: '❓', tiles: ['qu', 'i', 'z'] }
];

// ---------- MATH ----------
const SHAPES = [
  { name: 'circle', e: '🔴', world: [{ w: 'cookie', e: '🍪' }, { w: 'ball', e: '⚽' }, { w: 'moon', e: '🌕' }] },
  { name: 'square', e: '🟦', world: [{ w: 'present', e: '🎁' }, { w: 'waffle', e: '🧇' }, { w: 'picture', e: '🖼️' }] },
  { name: 'triangle', e: '🔺', world: [{ w: 'pizza slice', e: '🍕' }, { w: 'tent', e: '⛺' }, { w: 'tree', e: '🎄' }] },
  { name: 'star', e: '⭐', world: [{ w: 'sparkle', e: '✨' }, { w: 'shooting star', e: '🌠' }, { w: 'kite', e: '🪁' }] },
  { name: 'heart', e: '❤️', world: [{ w: 'love heart', e: '💖' }, { w: 'strawberry', e: '🍓' }, { w: 'gift heart', e: '💝' }] },
  { name: 'diamond', e: '🔷', world: [{ w: 'jewel', e: '💎' }, { w: 'ring', e: '💍' }, { w: 'card diamond', e: '♦️' }] },
  { name: 'crescent', e: '🌙', world: [{ w: 'banana', e: '🍌' }, { w: 'croissant', e: '🥐' }, { w: 'night moon', e: '🌛' }] },
  { name: 'oval', e: '🥚', world: [{ w: 'egg', e: '🥚' }, { w: 'melon', e: '🍈' }, { w: 'balloon', e: '🎈' }] }
];

// Pattern themes: pairs/trios used to build AB / ABB / AABB picture patterns.
const PATTERN_THEMES = [
  ['🦄', '🌈'], ['🌷', '🌸'], ['⭐', '🌙'], ['🍓', '🍰'],
  ['🐱', '🐶'], ['👑', '💎'], ['🦋', '🐝'], ['🍎', '🍋'],
  ['🎈', '🎁'], ['🐥', '🐰'], ['🌸', '🍄', '🌷'], ['💖', '💜', '💙']
];

// Objects used for counting / adding / taking away.
const COUNT_OBJECTS = [
  { name: 'unicorns', e: '🦄' }, { name: 'butterflies', e: '🦋' }, { name: 'flowers', e: '🌸' },
  { name: 'stars', e: '⭐' }, { name: 'cupcakes', e: '🧁' }, { name: 'hearts', e: '💖' },
  { name: 'crowns', e: '👑' }, { name: 'bunnies', e: '🐰' }, { name: 'strawberries', e: '🍓' },
  { name: 'jewels', e: '💎' }, { name: 'ducklings', e: '🐥' }, { name: 'balloons', e: '🎈' }
];

// ---------- STICKERS (48 across 6 themes) ----------
const STICKERS = [
  { id: 'pr1', e: '👸', name: 'Princess', theme: 'Royal' }, { id: 'pr2', e: '🤴', name: 'Prince', theme: 'Royal' },
  { id: 'pr3', e: '👑', name: 'Golden Crown', theme: 'Royal' }, { id: 'pr4', e: '💍', name: 'Royal Ring', theme: 'Royal' },
  { id: 'pr5', e: '🏰', name: 'Castle', theme: 'Royal' }, { id: 'pr6', e: '🎀', name: 'Pretty Bow', theme: 'Royal' },
  { id: 'pr7', e: '👗', name: 'Ball Gown', theme: 'Royal' }, { id: 'pr8', e: '👠', name: 'Glass Slipper', theme: 'Royal' },
  { id: 'un1', e: '🦄', name: 'Unicorn', theme: 'Magic' }, { id: 'un2', e: '🌈', name: 'Rainbow', theme: 'Magic' },
  { id: 'un3', e: '⭐', name: 'Gold Star', theme: 'Magic' }, { id: 'un4', e: '✨', name: 'Sparkles', theme: 'Magic' },
  { id: 'un5', e: '🌟', name: 'Glow Star', theme: 'Magic' }, { id: 'un6', e: '💫', name: 'Dizzy Star', theme: 'Magic' },
  { id: 'un7', e: '🔮', name: 'Crystal Ball', theme: 'Magic' }, { id: 'un8', e: '🧚‍♀️', name: 'Fairy', theme: 'Magic' },
  { id: 'ga1', e: '🌷', name: 'Tulip', theme: 'Garden' }, { id: 'ga2', e: '🌸', name: 'Blossom', theme: 'Garden' },
  { id: 'ga3', e: '🌹', name: 'Rose', theme: 'Garden' }, { id: 'ga4', e: '🌻', name: 'Sunflower', theme: 'Garden' },
  { id: 'ga5', e: '🦋', name: 'Butterfly', theme: 'Garden' }, { id: 'ga6', e: '🐝', name: 'Honey Bee', theme: 'Garden' },
  { id: 'ga7', e: '🌳', name: 'Big Tree', theme: 'Garden' }, { id: 'ga8', e: '🍄', name: 'Mushroom', theme: 'Garden' },
  { id: 'tr1', e: '🍰', name: 'Cake', theme: 'Treats' }, { id: 'tr2', e: '🧁', name: 'Cupcake', theme: 'Treats' },
  { id: 'tr3', e: '🍪', name: 'Cookie', theme: 'Treats' }, { id: 'tr4', e: '🍭', name: 'Lollipop', theme: 'Treats' },
  { id: 'tr5', e: '🍓', name: 'Strawberry', theme: 'Treats' }, { id: 'tr6', e: '🍦', name: 'Ice Cream', theme: 'Treats' },
  { id: 'tr7', e: '🎂', name: 'Birthday Cake', theme: 'Treats' }, { id: 'tr8', e: '🍬', name: 'Candy', theme: 'Treats' },
  { id: 'an1', e: '🐰', name: 'Bunny', theme: 'Friends' }, { id: 'an2', e: '🐱', name: 'Kitty', theme: 'Friends' },
  { id: 'an3', e: '🐶', name: 'Puppy', theme: 'Friends' }, { id: 'an4', e: '🦌', name: 'Deer', theme: 'Friends' },
  { id: 'an5', e: '🐥', name: 'Duckling', theme: 'Friends' }, { id: 'an6', e: '🐢', name: 'Turtle', theme: 'Friends' },
  { id: 'an7', e: '🐬', name: 'Dolphin', theme: 'Friends' }, { id: 'an8', e: '🦉', name: 'Owl', theme: 'Friends' },
  { id: 'fu1', e: '🎠', name: 'Carousel', theme: 'Fun' }, { id: 'fu2', e: '🎪', name: 'Circus', theme: 'Fun' },
  { id: 'fu3', e: '🎈', name: 'Balloon', theme: 'Fun' }, { id: 'fu4', e: '🪁', name: 'Kite', theme: 'Fun' },
  { id: 'fu5', e: '🎵', name: 'Music Note', theme: 'Fun' }, { id: 'fu6', e: '🎨', name: 'Paints', theme: 'Fun' },
  { id: 'fu7', e: '📚', name: 'Story Books', theme: 'Fun' }, { id: 'fu8', e: '🧸', name: 'Teddy Bear', theme: 'Fun' }
];

// ---------- CASTLE ----------
const CASTLE_ROOMS = [
  { id: 'throne', name: 'Throne Room', e: '👑', bg: 'linear-gradient(180deg,#fdf2f8 0%,#fce7f3 55%,#fbcfe8 100%)', deco: '🪑' },
  { id: 'bedroom', name: 'Royal Bedroom', e: '🛏️', bg: 'linear-gradient(180deg,#ede9fe 0%,#ddd6fe 55%,#c4b5fd 100%)', deco: '🛏️' },
  { id: 'garden', name: 'Garden Tower', e: '🌷', bg: 'linear-gradient(180deg,#dbeafe 0%,#d1fae5 55%,#a7f3d0 100%)', deco: '⛲' }
];

const DRESSUP = {
  dress: [
    { name: 'pink sparkle dress', e: '💗' }, { name: 'purple dream dress', e: '💜' },
    { name: 'ice blue dress', e: '💙' }, { name: 'garden green dress', e: '💚' },
    { name: 'rainbow dress', e: '🌈' }, { name: 'golden star dress', e: '⭐' }
  ],
  crown: [
    { name: 'golden crown', e: '👑' }, { name: 'flower crown', e: '🌸' },
    { name: 'jewel tiara', e: '💎' }, { name: 'star tiara', e: '⭐' }, { name: 'butterfly clip', e: '🦋' }
  ],
  shoes: [
    { name: 'glass slippers', e: '👠' }, { name: 'sparkly boots', e: '👢' },
    { name: 'ballet shoes', e: '🩰' }, { name: 'rainbow sneakers', e: '👟' }
  ],
  pet: [
    { name: 'unicorn', e: '🦄' }, { name: 'bunny', e: '🐰' },
    { name: 'kitty', e: '🐱' }, { name: 'puppy', e: '🐶' }
  ]
};

// ---------- NARRATION POOLS ({name} is replaced with the child's name) ----------
const PRAISE_LINES = [
  'Amazing, {name}!', 'You did it, {name}!', 'Wonderful!', 'You are so clever!',
  'Hooray for {name}!', 'Beautiful work!', 'That is right!', 'Super job, {name}!',
  'You shine like a star!', 'Brilliant!', 'Yes! Great thinking!', 'The whole castle is cheering for you!'
];

const RETRY_LINES = [
  'Almost! Let’s try another one.', 'Good try, {name}! Have another go.', 'Hmm, not that one. You can do it!',
  'Nearly! Listen one more time.', 'Let’s try together, {name}.', 'Not quite — want a little hint?',
  'Keep going, {name}, you are doing great.', 'Try again — I believe in you!'
];

const GREETING_LINES = [
  'Hello, Princess {name}!', 'Welcome back, {name}!', 'Yay, {name} is here!',
  'Hello {name}! Let’s play!', 'The castle missed you, {name}!', 'Hi {name}! Ready for fun?',
  'Princess {name}, your kingdom awaits!', 'Hooray! It’s {name}!'
];

const IDLE_LINES = [
  'Take your time, {name}.', 'You’ve got this!', 'No hurry — have a look around.',
  'Want to hear it again? Tap the speaker!', 'You’re doing great, {name}.', 'I’m right here with you.'
];

const PRINCESS_SAYINGS = [
  'You’re amazing, {name}!', 'Let’s learn something fun!', 'I believe in you!',
  'You’re so smart!', 'Let’s go on an adventure!', 'I’m proud of you, {name}!',
  'Ready to play?', 'You shine so bright!'
];
