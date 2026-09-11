# Princess Quest v3 inside Amelia's Arcade — Design Spec

Date: 2026-09-10. Status: approved for build ("Go, let's get it done").

This spec is the source of truth for the v3 rebuild. It merges the original v3 prompt with the red-team review corrections. Where the two conflict, this document wins.

## 1. Purpose

A 6-year-old kindergartener (Amelia) tested top ~8% nationally on Fall 2026 i-Ready and Star/FAST, with the same soft spots on both systems. v3 exists to move the tier-1 strands before the December–January window. Every academic module maps to a Florida B.E.S.T. K benchmark verified on CPALMS. Anything that does not serve a strand or the emotional-regulation content does not ship.

Baseline (shown on the parent dashboard so growth reads against it):

| Strand | Fall placement | Star (0–100) | Tier |
|---|---|---|---|
| Phonics / word analysis | Emerging K | 70 | 1 |
| High-frequency words | Emerging K | — | 1 |
| Phonological awareness | Early/Mid K | 69 | 1 |
| Measurement & data | Emerging K | 66 | 1 |
| Number sense / operations | Early K | 57 / 59 | 1 |
| Counting & cardinality | Early K | 78 | 2 |
| Algebraic thinking | Mid K | 50–54 | 2 |
| Geometry | Mid K | 67 | 2 |
| Vocabulary | Mid/Late K | 61 | 2 |
| Print concepts / fluency | — | 86 / 83 | 3 |
| Comprehension | Mid/Late K | 82 / 82 | 3 |

Growth targets: i-Ready reading 396 → 439 typical / 450 stretch; math 372 → 396 / 410.

Caveat recorded for the parent: Star domain/skill scores are model-based mastery estimates tied to the overall scaled score, and i-Ready K domain placements rest on few items each. The table is a hypothesis; the dashboard measures her directly.

## 2. Hard rules (child-facing)

1. Speech everywhere. Every instruction, story line, and feedback line speaks on display and has a 🔊 button. First launch shows a "Tap to start" splash because Chrome blocks speech before user activation.
2. Tap any word to hear it. Every word in a story or instruction is a tappable span.
3. Reading is scaffolded, never a gate. Answers are pictures, tiles, or drags. One line per instruction, three lines max per story screen.
4. No visible timers, countdowns, or progress numbers.
5. Tap targets ≥ 64px. Single column. Tap-to-place is the primary interaction; drag is an optional enhancement, never required.
6. Wrong answers scaffold. First miss: highlight the correct region, re-speak the prompt. Second miss: show and say the answer, re-present the item two turns later (the retry does not feed the adaptive window). Never a red X, buzzer, shake, or gem loss.
7. Playable independently. Nothing requires an adult.
8. Child sees stars ⭐⭐☆ and a 💎 gem count (currency, not a score). No percentages, XP, or item counts.
9. No background sparkle animation, no parallax, no oscillator music. Confetti on correct answers only.

## 3. Architecture

Static site, vanilla ES modules, no build step, no framework, no runtime network calls, no analytics. Deployed on GitHub Pages under `/princess-quest/`; all paths relative so any base works.

```
index.html                 shell: splash, top bar, home, cabinet host
shell.js                   boots economy/speech/adaptive, renders home, lazy-imports cabinets
sw.js                      cache-first, versioned precache list (tested against file tree)
manifest.json
shared/theme.css           tokens, 64px targets, single column, keyframes (confetti, pop, glow)
shared/speech.js           speak(), speakWord(), speakSound(), wordSpans(), mute, voice pick
shared/economy.js          save/load/migrate, gems, stars, badges, day streak, export/import, log
shared/adaptive.js         per-sub-skill windows, promote/demote, quest picker, missed-item queue
shared/ui.js               bigButton, choiceGrid, tile, slotRow, sortBins, celebrate, sessionShaper
shared/content.js          loadContent(name) → cached JSON; validates required keys
shared/soundkit.js         parent-recorded phoneme clips in IndexedDB, TTS fallback
games/registry.js          array of cabinet entries
games/princess-quest/      one file per cabinet (see §6)
parent/index.html, parent/parent.js, parent/parent.css
content/*.json             every word list, story, poem, problem set, scenario, standard
tests/*.test.js            node --test, zero deps
README.md
```

### 3.1 Cabinet registry

```js
{ id, group: 'princess-quest', name, icon, strands: ['ELA.K.F.1.3'], subskills: ['phonics-encode'], entry: './games/princess-quest/word-builder.js', minTier: 1 }
```

Each cabinet module exports `mount(root, ctx)` and `unmount()`. `ctx` = `{ economy, speech, adaptive, ui, content, exit() }`. Adding a game = new folder + one registry entry; the shell never changes.

### 3.2 Shell

- Splash: full-screen 👑 "Tap to start" (speaks greeting on tap, warms voices, requests `navigator.storage.persist()`).
- Top bar: ← back, title, 🔊/🔇 mute, 💎 count, small ⚙ gear (parent PIN → `/parent/`).
- Home: "Hello, Amelia" + star rank (⭐ of 5), 🔥 streak flame with day dots, Today's Quest card (icon + one line + ⭐⭐☆ + big Claim! when done), single column of large cabinet cards from the registry, filtered by `settings.modulesOff`.
- Session shaper: after 10 minutes of active play, a soft "Great job! One more or all done?" screen. Done → celebration → Calm Castle breathing bubble → home. No lock, no nag, fires once per session.
- Badge popups on award; badge gallery lives only on the parent dashboard.

### 3.3 Speech (`shared/speech.js`)

- `speak(text, {interrupt=true})` cancels current speech, strips emoji, chunks at sentence boundaries, queues utterances. Rate 0.9, en-US.
- Voice: filter `lang` starts with `en`, prefer `localService`, prefer en-US, then a parent-chosen voice name from settings. No name lists.
- No pause/resume keep-alive on mobile (detected by `navigator.userAgentData?.mobile` or UA). Desktop keeps sentence chunking only.
- No `boundary`-event karaoke (unsupported on Android). Story lines highlight the current sentence; each word is tappable.
- `speakSound(phoneme)` plays a recorded clip from the sound kit if present, else a continuant-safe TTS fallback string from `content/phonics.json`.
- `wordSpans(text)` returns a DocumentFragment of `<button class="w">` per word; tap speaks that word.
- Mute toggle persists in settings; mute silences speech but never hides 🔊 buttons.

### 3.4 Economy and save (`shared/economy.js`)

Single localStorage key `arcade.v3`, JSON, `schemaVersion: 3`, `migrate(save)` runs on load. Fresh start; no migration from `princessQuest2` or `ameliaWorld1`.

```js
{
  schemaVersion: 3,
  child: { name: 'Amelia', pin: '1234' },
  gems: 0,
  stars: { [cabinetId]: 0..3 },
  badges: ['id'],
  streak: { days: ['2026-09-10'], current: 0 },
  subskills: { [id]: { stage: 0, window: [{ok:true, day:'2026-09-10'}], lastPracticed: '2026-09-10', promotions: 0 } },
  sightWords: { [word]: { box: 1, firstTryDays: [], introducedDay: '' } },
  missed: { [itemId]: 3 },
  vocab: { [word]: { storyId, learnedDay, recalled: false } },
  kingdom: { placed: [{ itemId, x, y }], gifts: [{ to, itemId, day }] },
  quest: { date, requiredCabinet, choiceCabinet, requiredDone, choiceDone, claimed },
  session: { startedAt, activeMs, shaperShown },
  settings: { muted: false, rate: 0.9, voiceName: '', modulesOff: [] },
  log: [{ day, subskill, ok, firstTry }]  // capped at 60 days
}
```

- Day streak: `days` holds ISO dates played. `current` = length of the trailing run of consecutive days ending today or yesterday. A missed day pauses the count (current stays), never resets to 0.
- Stars per cabinet: best of last session, 1–3, from first-try ratio (≥0.85 → 3, ≥0.6 → 2, else 1).
- Star rank on home: 1 + floor(total promotions across tier-1 sub-skills / 3), capped at 5.
- Export/import: parent dashboard downloads/uploads the whole object as JSON; sound kit exported separately.
- Devices do not sync. README states: pick one primary device.

### 3.5 Adaptive engine (`shared/adaptive.js`)

Sub-skills (14) tracked with a rolling window of the last 10 **first-try** results from items with **≥ 3 choices**. Retries and 2-choice items give feedback but never enter the window.

| id | Strand | Owner cabinet | Stages |
|---|---|---|---|
| phonics-encode | ELA.K.F.1.3 | Word Builder | a b c d d2 e f |
| phonics-decode | ELA.K.F.1.3 | Word Builder | same |
| pa-sounds | ELA.K.F.1.2 | Sound Garden | first → final → medial |
| pa-blend-segment | ELA.K.F.1.2 | Sound Garden | 2–3 sounds → 4 |
| pa-manipulate | ELA.K.F.1.2 | Sound Garden | delete → swap |
| subitize-tenframe | MA.K.NSO.1.1 | Number Kingdom | 1–4 → structured 5–10 → make-10 |
| teen-compare | MA.K.NSO.2.2/2.3/1.4 | Number Kingdom | teens → compare groups → number line |
| add-sub | MA.K.NSO.3.1/3.2 | Number Kingdom | within 5 → within 10 → related facts |
| count-sequence | MA.K.NSO.2.1 | Number Kingdom | next by 1s → by 10s → backward within 20 |
| decompose-stories | MA.K.AR.1.1–1.3, AR.2.1 | Number Stories | bonds → decompose → word problems → true/false |
| measure | MA.K.M.1.1–1.3 | Measure Sort Shapes | attribute → compare → order → units |
| data-sort | MA.K.DP.1.1, ELA.K.V.1.3 | Measure Sort Shapes + Story Garden | 2 bins → 3 bins → chart questions |
| shapes | MA.K.GR.1.1–1.5 | Measure Sort Shapes | 2D → 3D → compose |
| comprehension | ELA.K.R.1.1, R.1.4, R.2.2 | Story Garden | literary → informational → poems |

Rules:
- Promote: 8 of last 10 ok → `stage + 1`, window cleared, `promotions + 1`.
- Demote: ≥ 4 misses in the window **and** the misses span ≥ 2 distinct days → `stage − 1`, window cleared. Never below stage 0.
- Missed-item queue: an item missed twice is re-presented two turns later; an item missed 3+ times total goes on the parent trouble list.
- Quest picker (daily, seeded by date): among tier-1 sub-skills, score = `(1 − accuracy) + min(0.5, daysSincePracticed × 0.1)`; unpracticed counts as accuracy 0. Exclude a cabinet chosen on both of the previous two days if any alternative exists. Required cabinet = owner of the winner. Choice slot = any cabinet she opens and finishes a round in. Claiming pays 10 gems and marks the day for the streak.

Sight words use Leitner boxes instead of windows (see §6.3).

### 3.6 UI kit (`shared/ui.js`)

- `bigButton(label, onTap)` ≥ 64px, speaks label on long-press.
- `choiceGrid(items, onPick)` 3–4 picture/tile choices, single column or 2×2, all ≥ 64px.
- `slotRow(n)` + `tileTray(tiles)`: tap a tile then tap a slot (primary) or drag (pointer events, `touch-action: none`, `setPointerCapture`). Tiles speak on tap.
- `sortBins(items, bins)`: tap item then bin, or drag.
- `scaffold(el, correctEl, prompt)`: first miss glow + re-speak; second miss reveal + speak answer.
- `celebrate()` confetti + praise line; `speakThenEnable()` disables choices until prompt finishes speaking.
- `sessionShaper` accumulates active ms; fires once at 10 min.

### 3.7 Sound kit (`shared/soundkit.js`)

Parent records the ~44 phoneme clips once from the dashboard (MediaRecorder, 1.5 s max each, trimmed by silence threshold), stored in IndexedDB `arcade-soundkit`. `speakSound()` uses the clip when present. Fallback TTS strings avoid added schwa for stops where possible (`t`, `k`, `p` rendered as the letter said crisply is still imperfect; the kit is the fix). Dashboard shows which sounds are recorded.

### 3.8 PWA

`sw.js` precaches every shell file, shared module, cabinet module, content JSON, and icon. Cache name includes a version string bumped on every release. Navigation falls back to `index.html`. A node test asserts the precache list equals the tracked file tree minus docs/tests. Lazy `import()` of a missing module offline shows "This game needs one visit online first" instead of a blank screen.

## 4. Standards

`content/standards.json` holds the verified CPALMS benchmarks (ids 14896–14921 ELA, 15232–15253 math) with verbatim text, fetched 2026-09-10. ELA.K.R.1.2 and ELA.K.R.2.3 do not exist at K. Every content item carries a `strand` code from this file.

## 5. Content formats (`content/*.json`)

All content is human-readable JSON, fully populated, no placeholders. Pictures are emoji or inline SVG strings (`{"svg": "<svg …>"}`); no external images. Kid-safe, princess/castle themed.

- `phonics.json`: `{ stages: [{ id:'a', name, pattern, graphemes:[…], words:[{ word, tiles:['c','a','t'], pic:'🐱', minimalPairOf:'bat' }] }], sounds: { 'a': { tts:'aah', kit:'a' } } }`. 25–30 picturable words per stage; minimal pairs isolate the vowel.
- `sound-garden.json`: `{ firstSound:[{ prompt:'m', choices:[{pic,word,ok}] }], finalSound, medialVowel, blend:[{ sounds:['d','o','g'], choices }], segment:[{ word, pic, count }], delete:[{ word, remove:'k', answer:'at', choices }], swap:[…], rhyme, syllables }` ≥ 20 per game.
- `sight-words.json`: `{ lists: { prePrimer:[…40], primer:[…52] }, words: { the: { irregular:['th'→'heart'], graphemes:['th','e'], confusables:['then','they'] } } }`.
- `number-kingdom.json`: structured arrangements for subitizing, ten-frame targets, teen sets, comparison pairs, sequence prompts.
- `number-stories.json`: bonds, decompositions, 40+ picture word problems `{ text, pic, a, b, op, answerChoices }`, true/false equations.
- `measure-sort.json`: object pairs with attribute + answer, ordering triples, sort sets, unit-measure items, shape sets (2D, 3D, compose).
- `stories.json`: `{ id, title, level, kind:'literary'|'informational', screens:[{ text, pic, question:{ prompt, choices:[{pic,ok}] } }], vocab:{ word, meaning, pic } }`.
- `poems.json`: short rhyming poems with a "which word rhymes with…" picture question.
- `story-frames.json`: sentence templates for generated decodable stories (`"The {cvc} sat."`).
- `calm.json`: breathing patterns, feelings, calm stories, body scan parts (no numeric countdowns; timing is animation only).
- `scenarios.json`: ≥ 16 scenarios `{ text, pic, choices:[{ text, pic, quality:'best'|'ok'|'notgreat', feedback }] }`, shuffled at render.
- `shop.json`: cosmetic items with cost; two prosocial items `{ prosocial:true, thanks:'Ryan says thank you!' }`.
- `badges.json`, `praise.json`.

## 6. Cabinets (build order; each shippable alone)

### 6.1 📚 Word Builder — ELA.K.F.1.3 (tier 1)
- Encode: picture + spoken word → fill slots from a tray of the word's tiles plus 1–2 distractors. Tile speaks its sound; completed word speaks itself. Scaffold per §2.6.
- Decode twin: word shown in tiles, prompt "Read it, then tap the picture," 3–4 picture choices; 🔊 says the sounds one by one on request, never the whole word until answered.
- Sound Swap: show *cat*, say "make it *bat*," swap one tile. Feeds `pa-manipulate` (swap stage) too.
- Stages a CVC short-a → b all short vowels → c initial digraphs sh/ch/th → d final blends -nd/-st/-mp → d2 -ck, FLOSS, -ng/-nk → e initial blends → f CVCe.
- Rounds of 6 items; a round alternates encode/decode.

### 6.2 🌻 Sound Garden — ELA.K.F.1.2 (tier 1)
Picture-only, spoken prompts, tap to answer, no reading. Games: first sound, final sound, medial vowel, oral blending, segmenting with gem boxes (tap one gem per sound), phoneme deletion, rhyme, syllable clap. Rhyme and syllable are untracked warm-ups; the rest feed the three PA sub-skills.

### 6.3 🌷 Sight Word Meadow — ELA.K.F.1.4 (tier 1)
- Lists: Dolch pre-primer then primer, ordered to prefer words decodable at her current phonics stage.
- Intro (heart-word): word in sound boxes; regular graphemes speak their sounds; the irregular part shows a 💜 and is said "this part we just remember."
- Hear-it-tap-it: 4 choices with confusable distractors from the word entry. Feeds Leitner.
- See-it-say-it: self-report 👍/🤔, never feeds mastery.
- Leitner boxes 1–5, 5 new words at a time; mastered = box 5 after 3 first-try recognitions on 3 separate days; a miss after mastery drops one box.
- "I read it myself" stories: generated from `story-frames.json` using mastered sight words + current stage words only, 3 sentences each, each sentence ends with "tap the matching picture."

### 6.4 🧮 Number Kingdom — MA.K.NSO.1–3 (tier 1)
- Subitize: 1–4 scattered gems flashed (no visible timer); 5–10 in dice/ten-frame arrangements or two groups.
- Ten-frame: "show me 7" by tapping cells; "how many more to make 10."
- Teen builder: a full ten-frame plus ones, "this is 14: one ten and four."
- Compare: two groups to 20, tap greater/less/equal pictures; number line 0–20 hop.
- Add/subtract within 10 with manipulatives always visible; related subtraction facts after addition.
- Hundreds chart: tap to count by 1s and 10s; "what comes next" from a random start; count backward within 20.

### 6.5 🔷 Number Stories — MA.K.AR.1.1–1.3, AR.2.1 (tier 2, replaces Patterns)
Make-10 pairs, decompose "5 is 2 and ▢" with gems splitting, picture word problems with manipulatives, "is this true?" equation cards with objects. AB/ABB pattern extension exists as a 2-minute warm-up only, untracked.

### 6.6 📏 Measure, Sort & Shapes — MA.K.M.1, DP.1, GR.1 (tier 1 + geometry tier 2)
- Attribute: "what can we measure about the wand? how long / how heavy / how much it holds."
- Compare two objects with animations (bar grows, scale tips, water fills).
- Order three by length (tap-to-place, drag optional).
- Sort 6–9 objects into 2–3 bins → bar chart → "which has the most / fewest / how many more."
- Non-standard units: lay gems end to end; count.
- Shapes: identify 2D/3D in any orientation, sort shapes, compose a target from triangles and squares.

### 6.7 📖 Story Garden — ELA.K.R.1–2, V.1 (tier 3 + vocab tier 2)
- Read-to-me shelf: literary and informational stories, sentence highlight, one picture question per screen, one vocab word per story recalled next day via a picture question.
- Poems shelf: short rhyming poems; "which word rhymes with…" picture answers.
- Word Sort: category sorting (animals/food/clothes…) reusing `sortBins`, feeds `data-sort`.
- I-read-it-myself shelf from §6.3.

### 6.8 🫧 Calm Castle (carry over, rebuilt)
Feelings check-in on entry (9 feelings, routed), breathing bubble (4 patterns, animation only, no numbers), calm stories with shuffled picture choices (no color coding, no pre-marked best), body scan with metaphors (no countdown), all spoken. Also the exit path for the session shaper.

### 6.9 🤗 Uh-Oh Academy (carry over, rebuilt)
≥ 16 scenarios, spoken, picture answers shuffled, all three choices get warm spoken feedback, best choice gets confetti. No negative sound.

### 6.10 🏰 Kingdom Builder (reward loop)
Shop of ~12 cosmetic pieces, tap-to-place on a castle/garden scene, drag optional. Two prosocial spends: "send a flower to Ryan" and "give gems to the castle garden," each with a thank-you animation. Costs shown as gem icons in rows of five, not numerals.

## 7. Parent dashboard (`/parent/`)

4-digit PIN. Per strand: rolling accuracy (last 20), stage, items per day, days since last practiced, 30-day inline SVG sparkline, plain-language line ("Phonics: stage c, 82% last 20, practiced 4 of last 7 days"). Baseline table from §1 with the caveat. Trouble list (items missed 3+). Badge gallery. Export/import save JSON. Reset PIN. Module on/off toggles. Voice picker. Sound kit recorder. No child-facing link back except the ← button.

## 8. Testing

- `node --test tests/` covers economy (streak pause, stars, migrate), adaptive (promote/demote/2-day rule/2-choice exclusion/quest picker), Leitner, story generator, precache list vs file tree, content JSON validation (required keys, counts, no empty strings).
- Manual in-app browser checks at 360×740 and 1024×768 after each step; console must be clean.
- Phone test by the parent after each build step before the next begins.

## 9. Build order

1. Shell + theme + speech + economy + adaptive + content loader + PWA skeleton + dashboard skeleton + tests.
2. Word Builder.
3. Sound Garden.
4. Sight Word Meadow incl. generated stories.
5. Number Kingdom.
6. Measure, Sort & Shapes.
7. Number Stories + Story Garden.
8. Calm Castle + Uh-Oh Academy.
9. Kingdom Builder, badges, quest polish, PWA precache audit, README.
10. Final UX consistency, animation polish, edge cases, Lighthouse.

## 10. Out of scope

Supabase or any sync, accounts, analytics, typed answers, background music, parallax, XP, visible timers, Patterns as a tracked module, migration of old saves.
