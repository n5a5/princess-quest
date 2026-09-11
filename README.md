# Princess Quest

A magical kindergarten adventure for one child, Amelia, built as a static offline PWA. Luna the unicorn guides her through a kingdom of five places; each place hides rigorous practice for the strands her fall assessments flagged (phonics, phonological awareness, high-frequency words, number sense and operations, measurement and data). Live at https://n5a5.github.io/princess-quest/.

Design documents: `docs/superpowers/specs/2026-09-11-princess-quest-ideal-architecture.md` (research synthesis, evidence grades, decisions) and `docs/superpowers/specs/2026-09-10-princess-quest-v3-design.md` (original v3 spec).

## Run locally

```
npx http-server . -p 8765 -c-1
```

Open http://localhost:8765/. Tests: `node --test tests/*.test.js` (42 tests, no dependencies). Parent Corner: tap ⚙ on the map, PIN `1234`.

## The kingdom

| Place | Strands | What she does |
|---|---|---|
| 🦄 Unicorn Meadow | ELA.K.F.1.2, F.1.3 | Word Spell (build words from rune tiles, tap or drag), Read the Rune (decode, find the picture, wand blends), Sound Swap (cat → bat), Sound Seeds (first/final/middle sound, oral blending, count the sounds with gems, oral swap) |
| 🌷 Wishing Well | ELA.K.F.1.4 | Heart words: Dolch pre-primer and primer introduced in sound boxes with a 💜 on the irregular part; hear-it-tap-it with confusable foils; see-it-say-it self-check; Leitner boxes 1–5 |
| 💎 Crystal Caverns | MA.K.NSO.1–3, AR.1 | Gem Frames (subitize, make 10), Crystal Bridge (add/subtract with gems on screen), Teen Tower (ten and ones, compare, number line), Cave Count (by ones, tens, backward), Number Stories (bonds, decompose, picture problems, true equations) |
| 🌈 Rainbow Falls | MA.K.M.1, DP.1, GR.1 | Name the attribute, compare, order three by length, gems as units, sort into bins that become a bar chart, shapes in any orientation, 3D solids, compose |
| 🏰 Story Castle | ELA.K.R.1–2, V.1 | Read-to-me stories with picture questions and next-day vocabulary recall, rhyming poems, Calm Tower (feelings, breathing, calm stories, body scan), Uh-Oh Courtyard (what would you do?) |
| 🏡 Squishy Garden | reward | Rescued Squishies live here; gems buy decorations; two gifts say thank you |

Every learning item runs through one loop (`shared/encounter.js`): prompt auto-plays with a 🔊 button and tappable words → she taps or drags → Luna reacts → first miss glows the right answer and re-speaks → second miss reveals, and the item comes back two turns later. A round of six ends with stars, gems flying to the counter, a Squishy freed from its bubble, and a tick on Luna's glow meter (which never goes down). Today's Quest lights one place chosen by the planner; finishing it plus any other place opens the chest.

## Layout

```
index.html, shell.js          splash, kingdom map, place loading, session shaper, PIN
shared/theme.css              art direction (Fredoka / Andika / Nunito bundled, warm lavender palette)
shared/characters.js          Luna (4 expressions), 15 Squishies, chest, gem, place art — inline SVG
shared/encounter.js           the encounter runner, round celebration, gem flight
shared/audio.js               phoneme / letter / word / sentence channels, connected-phonation blend (Web Audio)
shared/audiostore.js          parent recordings in IndexedDB with export/import
shared/speech.js              text-to-speech primitive only (never used for bare phonemes)
shared/adaptive.js            BKT mastery per skill and per GPC, outcome types, stage promotion, planner
shared/economy.js             versioned save, gems, stars, day streak, companion meter, Squishies
shared/ui.js                  buttons, scaffolded choice grid, tile board (tap or drag), sheets, confetti
games/registry.js             the six places; games/princess-quest/<place>.js
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
