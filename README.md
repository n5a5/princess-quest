# Princess Quest

A magical kindergarten adventure for one child, Amelia, built as a static offline PWA. Luna the unicorn guides her through a kingdom of six places (plus the Squishy Garden); each place hides rigorous practice for the strands her fall 2026 i-Ready and Star assessments flagged (phonics, phonological awareness, high-frequency words, number sense and operations, measurement and data, patterns), while her strengths stay warm through stories and play. Priorities and the reasoning: `docs/superpowers/specs/2026-09-11-assessment-driven-priorities.md`. Live at https://n5a5.github.io/princess-quest/.

Design documents: `docs/superpowers/specs/2026-09-11-princess-quest-ideal-architecture.md` (research synthesis, evidence grades, decisions) and `docs/superpowers/specs/2026-09-10-princess-quest-v3-design.md` (original v3 spec).

## Run locally

```
npx http-server . -p 8765 -c-1
```

Open http://localhost:8765/. Tests: `node --test tests/*.test.js` (42 tests, no dependencies). Parent Corner: tap ⚙ on the map, PIN `1234`.

## The kingdom

| Place | Strands | What she does |
|---|---|---|
| 🦄 Unicorn Meadow | ELA.K.F.1.3 | Phonics, letters always on screen: Letter Sounds (hear a sound → tap the stone; see a stone → tap the picture), Word Spell (build words from letter stones, tap or drag), Letter Stones (decode, find the picture, wand blends with a shimmer), Sound Swap (cat → bat), Spell Scroll (decodable sentences from content/sentences.json, tap the words, pick the picture) |
| 👂 Whisper Woods | ELA.K.F.1.2 | Phonological awareness, ears only (no letters, pictures without labels, sound tokens are ear buttons): Sound Seeds (first/final/middle sound), Sound Bubbles (oral blending, count the sounds), Rhyme Time (rhymes, clap the beats, onset + rime), Whisper Swap (change a sound, take a sound away) |
| 🌷 Wishing Well | ELA.K.F.1.4 | Wish words: Dolch pre-primer and primer, decodable-first order that follows the phonics stages, introduced in sound boxes with a 💜 on the irregular part; wish doors (hear it, tap it) with confusable foils; Wish Notes (find a known word inside a sentence); see-it-say-it self-check; Leitner boxes 1–5 |
| 💎 Crystal Caverns | MA.K.NSO.1–3, AR.1 | Quick Peek (subitize, make 5, make 10), Gem Trail (one more / one less, count out n gems, order numbers), Gem Pouch (add / take away with Luna's ten-pocket pouch), Big Gem Piles (ten and ones, compare, number line), Cave Steps (by ones, tens, backward), Number Spells (bonds, decompose, picture problems, true spells, match the spell to the picture) |
| 🌈 Rainbow Falls | MA.K.M.1, DP.1, AR.1, GR.1 | Measure the Falls (name the attribute; compare length, height with Squishy towers, weight on a balance scale that tips, capacity with jars that show their fill; order three; gems as units), Sort the Squishies (sort into baskets that become a chart: most, fewest, how many, how many more), Rainbow Path (AB / ABB / ABC patterns, what comes next, find the odd one), Shape Stones (2D, 3D, compose) |
| 🏰 Story Castle | ELA.K.R.1–2, V.1 | Read-to-me stories with picture questions and next-day vocabulary recall, rhyming poems, Calm Tower (feelings, breathing, calm stories, body scan), Uh-Oh Courtyard (what would you do?) |
| 🏡 Squishy Garden | reward | Rescued Squishies live here; gems buy decorations; two gifts say thank you |

Every learning item runs through one loop (`shared/encounter.js`): prompt auto-plays with a 🔊 button and tappable words → she taps or drags → Luna reacts → first miss glows the right answer and re-speaks → second miss reveals, and the item comes back two turns later. A round of six ends with stars, gems flying to the counter, a Squishy freed from its bubble, and a tick on Luna's glow meter (which never goes down). Today's Quest lights one place chosen by the planner; finishing it plus any other place opens the chest.

## Layout

```
index.html, shell.js          splash, kingdom map, place loading, session shaper, PIN
shared/theme.css              art direction (Fredoka / Andika / Nunito bundled, warm lavender palette)
shared/characters.js          Luna (4 expressions), 18 Squishies, chest, gem, place art — inline SVG
shared/encounter.js           the encounter runner, round celebration, gem flight
shared/audio.js               phoneme / letter / word / sentence channels, connected-phonation blend (Web Audio)
shared/audiostore.js          parent recordings in IndexedDB with export/import
shared/speech.js              text-to-speech primitive only (never used for bare phonemes)
shared/adaptive.js            20 subskills with assessment tiers, BKT mastery per skill and per GPC, outcome types, stage promotion, two-stop quest planner
shared/economy.js             versioned save, gems, stars, day streak, companion meter, Squishies
shared/ui.js                  buttons, scaffolded choice grid, tile board (tap or drag), sheets, confetti
games/registry.js             the seven places; games/princess-quest/<place>.js
content/*.json                all words, stories, sounds, standards; nothing is hard-coded in games
assets/audio/phonemes/*.ogg   34 bundled phoneme clips (tools/build-phoneme-audio.ps1)
assets/audio/words/*.ogg      204 bundled word clips, Kokoro af_heart, Apache-2.0 (tools/build-word-audio.py)
assets/fonts/*.woff2          Fredoka, Andika, Nunito (SIL OFL 1.1)
parent/                       Parent Corner: mastery, trends, next focus, Sound Check, settings, export
sw.js                         cache-first precache; tests/precache.test.js keeps the list equal to the tree
```

## Audio

Isolated phonemes never come from text-to-speech (that is where "buh" comes from). `audio.phoneme(id)` resolves recording in the parent's voice → bundled clip → TTS only for continuants marked `ttsSafe` → silence. Words resolve recording → bundled Kokoro clip → TTS. Sentences and instructions are TTS. Blending plays clips gaplessly with a 60 ms crossfade (connected phonation). Record replacements in Parent Corner → Sound Check; they live in IndexedDB on that device and can be exported.

## Content formats

- `phonics.json`: stages a, b, c, d, d2, e, f; each word `{ "w": "cat", "u": [["c","k"],["a","a"],["t","t"]], "p": "🐱" }` — units are `[grapheme, phonemeId|null]`, null is a silent letter.
- `sight-words.json`: `words[w] = [[grapheme, phonemeId|null, heart?]]`; `heart: true` marks the part remembered by heart.
- `sounds.json`: phoneme inventory with `ipa`, `kind`, `ttsSafe`, example word and recording tip.
- `stories.json`: stories with screens `{ text, pic, question }` and one `vocab` word; poems with a rhyme question.
- `calm.json`, `scenarios.json`, `shop.json`, `praise.json`, `standards.json` (verified CPALMS benchmarks).

## Save schema (localStorage `arcade.v3`)

`{ schemaVersion, child, gems, stars, badges, streak.days, subskills[id] = { stage, p, firstTryDays, lastPracticed, promotions, gpc }, sightWords[word] = { box, firstTryDays, introducedDay, lastSeen }, missed, vocab, kingdom.placed, companion.stars, squishies.rescued, quest, questHistory, settings, log (60 days) }`. Devices do not sync; Parent Corner exports and imports the JSON.

## Adding a place

1. Create `games/princess-quest/<id>.js` exporting `mount(host, ctx)` and `unmount()`; build rounds with `runEncounterRound` and families `{ id, subskill, itemId(item), play(stage, item, ctx, helpers) → { outcome, choices, gpc } }`.
2. Add one entry to `games/registry.js` (`place`, `subskills`, `entry`, `ready: true`) and its Squishies.
3. Regenerate the precache list in `sw.js` (see the node one-liner in git history or run the tests to see what is missing) and bump `VERSION`.

## Licenses of bundled third-party material

Fonts: Fredoka, Andika, Nunito — SIL Open Font License 1.1. Word audio: generated with Kokoro-82M (Apache-2.0). Phoneme audio: synthesized with Windows SAPI (program output). Everything else is original.
