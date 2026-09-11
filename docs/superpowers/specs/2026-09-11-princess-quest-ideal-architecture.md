# Princess Quest — Ideal Architecture (research synthesis and build decisions)

Date: 2026-09-11. Supersedes the parts of `2026-09-10-princess-quest-v3-design.md` it contradicts (home screen, reward loop, Word Builder, adaptive rules, audio). Everything else in the v3 spec still holds.

Evidence grades used throughout: **A** strong evidence / research-supported, **B** established practice, **C** professional heuristic, **D** design hypothesis. Sources are in the four research reports summarized in §1; primary URLs are listed at the end.

## 0. Where I disagree with the brief

- "Dad records everything." **I disagree with this assumption because** the only thing TTS cannot do is isolated phonemes. Words and sentences from a modern TTS voice are intelligible and consistent; recording 300+ words and hundreds of instructions costs hours, drifts in level and tone between sessions, is per-device, and must be redone on every content change. Record the 34 phonemes (5 minutes), optionally the 12 most confusable words. Nothing else.
- "Professional human audio is better than Dad's voice." True for a product; not for this child. For a single 6-year-old, a parent's voice for the sounds she practises is at least as good (familiar, warm) and free. Professional recording would only matter if the parent's clips are inconsistent; the Sound Check page exists to catch that.
- "Child speech recognition." **Not before December.** Chrome on Android sends Web Speech audio to Google's servers (no offline), on-device alternatives are 40 MB to 1.2 GB, and no browser model is validated for a 6-year-old's clipped /p/. The likely failure is telling her she is wrong when she is right. Roadmap item only (§10).
- "Nine module cards on home." I proposed this on day one; **I now disagree with my own decision.** Every product that works with this age uses a path or a world for the learning spine and a hub for free play (TYM islands, Reading Eggs map, Nessy islands, Feed the Monster's creature hub). A list of nine labelled cards is a menu, and a menu is a worksheet's table of contents.
- "Gems as the reward." Keep gems for decorating, but the emotional loop should be **relational, not transactional** (Feed the Monster): a creature reacts to every item and a growth meter that only rises. Gems are a ledger; a companion is a relationship.
- "Karaoke word highlighting", "sparkle everything", "magic blending animation". Blending should be *heard* as connected phonation with tiles lighting in time; a swirling-letters animation adds nothing the evidence supports and delays the next item. Keep the tile glow, drop the swirl.
- "40 words per stage": already cut to 24–32 with minimal pairs.
- Patterns module: already replaced by Number Stories (no patterns benchmark exists in B.E.S.T. K).

## 1. What the research says (condensed)

**Reading science (grades in brackets)**
- Continuous ("connected") phonation beats sound-by-sound blending for beginners; transfers to stop-initial words. [A: Gonzalez-Frey & Ehri 2021; Weisberg & Savard 1993]
- Spelling/encoding instruction with letter tiles improves reading, not just spelling. [A: Graham & Santangelo 2014 meta-analysis ES .44 reading; Weiser & Mathes 2011]
- Continuants can be held; stops must be clipped with no "uh"; teach the clipped form and attach it quickly to the vowel. [B: UFLI glossary, Reading Rockets, Moats]
- Articulation pictures next to letters help preschoolers who already know letters learn to read words. [A but modest: Boyer & Ehri 2011]
- Heart-word (orthographic mapping) routine for irregular high-frequency words instead of flashcards. [B: Reading Rockets HFW model; Ehri 2014]
- Mastery gate of about 80% and, on failure, contrasting the confusable pair rather than repeating. [B: GraphoGame adaptive rule; Lexia error ladder]
- Adult participation is the only moderator that made GraphoGame effective in a 28-study synthesis. [A: McTigue et al. 2020] Implication: the parent dashboard and the exit summary must invite two minutes of adult involvement.
- No published efficacy data for Teach Your Monster or Fast Phonics; Nessy has vendor-run studies; Lexia Core5 ES +0.16 (moderate). Expect app practice alone to move i-Ready modestly; the lever is *targeted daily practice on the two weakest strands with the parent in the loop*. [C]

**Product mechanics worth borrowing** [B unless noted]
- A path for the learning spine, a hub for free play, visually distinct.
- Child *owns/teaches* a creature (TYM, Feed the Monster); the creature's growth is the progress display. [B for engagement, D for learning gain]
- Per-item creature reaction: happy chew on right, spit-and-shrug on wrong, nothing lost; 3-star pass per round; growth meter only rises.
- Auto-play prompt after ~2 s, tap-to-replay; "hidden prompt" (audio-only) as the harder tier.
- Explicit per-item foils (b/d, a/e, m/n) instead of random distractors. [C]
- Big single-action screens, icons not text, celebrations short and skippable, no sad faces.

**Open-source code decisions**
- Phono StoryForge (Apache-2.0): port `decompose()` (grapheme decomposition + decodability check) and the BKT mastery step to JS. Keep NOTICE attribution.
- FeedTheMonsterJS (MIT code, CC-BY media): borrow the JSON shape `{target, foils, prompt:{text,audio}, promptMode}` and the reaction loop. Do not use the monster art. Audio clips rejected (inconsistent levels, duplicate files, would mix voices).
- Open Phonics: no LICENSE grant; use only as a cross-check word bank, never copy records.
- phonics-ai, PhonixQuest: unlicensed, nothing reusable.
- G2P for content validation: CMUdict cross-check at test time (BSD) is enough; no runtime G2P.

**Visual research** (see License table in the research report)
- Fonts: Fredoka (display), Andika (any text the child decodes; single-storey a/g, distinct I/l/1), Nunito (UI chrome). All OFL, bundled locally, ≈90 KB.
- Palette: Ink #33254F, Plum #5B3E8F, Violet #7C5CC4, Rose #E2688F (buttons #C9497A), Gold #E9B949, Mint #4DB6A4, Cream #FFF8EE, Lavender #EFE7FF, Night #2A1E45. Magic from lavender→cream and night→plum gradients and soft glows, not neon.
- Characters as inline SVG symbols with swappable face groups (idle, happy, thinking, celebrate), 5–8 KB each.
- CC0 sources if ever needed: Kenney UI/Particle/Emotes packs, pzUH Free Fantasy GUI (SVG). Plan: 100% original inline SVG + CSS for v3; no third-party art in the first release (consistency beats quantity).

## 2. Ideal architecture

```
INSTRUCTIONAL SCIENCE  UFLI-style GPC sequence, encode+decode, connected blending, heart words, CRA math
        ↓
CONTENT ENGINE         content/*.json: words as [grapheme, phoneme] units, foils, stage, decodability;
                       stories constrained by mastered GPC set; math items with representation level
        ↓
ADAPTIVE ENGINE        per-GPC / per-skill mastery estimate (BKT), session planner: target + review + variety
        ↓
GAME ENGINE            encounter runner: prompt → child act → creature reaction → scaffold ladder → record
        ↓
WORLD                  one kingdom map with 5 places; each place hosts one strand's encounters
        ↓
CHARACTERS             Princess (player), Luna the unicorn (companion who learns with her), Squishies (collectibles), Owl (guide)
        ↓
REWARDS                creature growth (never decreases), stars per quest, gems → decorations, Squishy rescue
        ↓
AUDIO                  phoneme clips (recorded → bundled), words/instructions TTS, SFX local, connected blend via Web Audio
        ↓
PARENT ANALYTICS       mastery per GPC/skill, first-try trend, stagnation flags, next focus, export
```

### 2.1 World and navigation (replaces the nine-card home)

One screen, the **Kingdom map**, portrait, single column of five places top-to-bottom with a winding path, each place a large illustrated tile (≥120 px tall) with the companion standing at "today's" place:

| Place | Strand(s) | Encounter families |
|---|---|---|
| 🦄 Unicorn Meadow | phonics, phonological awareness | Word Spell (encode), Read the Rune (decode), Sound Swap, Sound Seeds (PA) |
| 🌷 Wishing Well | high-frequency words | Heart Words, Word Wishes (hear-tap), read-it-myself scrolls |
| 💎 Crystal Caverns | number sense, operations, counting | Gem Frames (ten-frame), Crystal Bridge (make 10, bonds), Cave Count (hundreds path, teens) |
| 📏 Rainbow Falls | measurement, data, geometry | Measure the Falls, Sort the Squishies (bins → chart), Shape Stones |
| 🏰 Story Castle | comprehension, poems, calm | Read-to-me, Poems, Calm tower, Uh-Oh courtyard |

Today's quest = the path lights up at one place (the adaptive target) plus "anywhere you like" afterwards. Tapping any place is always allowed. The old cabinet registry stays as the implementation unit; the map is a different *view* of the same registry (`place` field per cabinet).

### 2.2 The encounter (the atomic learning unit)

Every learning item, in any strand, runs through one runner:

1. **Set-up** (≤1 s): the place's scene, the companion, and the *problem object* (a rune stone, a gem bridge, a Squishy in a bubble).
2. **Prompt** auto-plays; 🔊 replays; every word tappable.
3. **Child acts** (tap/drag).
4. **Reaction** (≤700 ms): companion happy + object responds (rune glows, bridge segment appears, bubble pops and the Squishy waves). Wrong: companion "thinking", the wrong tile wobbles, correct region glows, prompt replays. Second wrong: reveal + say + the item returns two turns later.
5. **Record**: firstTry / correctedAfterScaffold / revealed, latency, and whether it was a review item.
6. **Round of 6** ends with a short celebration (stars 1–3, creature growth tick, gems).

The encounter never shows a number, timer, or percentage.

### 2.3 Phonics progression for Amelia (UFLI-aligned, compressed)

Order of GPC stages (`content/phonics.json`): **a** short a CVC → **b** all short vowels → **c** sh/ch/th → **d** final blends → **d2** -ck, FLOSS, -ng/-nk → **e** initial blends → **f** VCe. Heart words run in parallel from the Dolch pre-primer list, five at a time, always introduced with the sound-box routine.

Per session in Unicorn Meadow (about 4 minutes): 1 encode item (Word Spell), 1 decode item (Read the Rune), 1 Sound Swap, 2 PA items (first/final/medial sound or segment), 1 review item from an earlier stage. Encode:decode ≈ 40:60 across a week. [B]

Decoding audio sequence, from content units: sound → sound → sound (450 ms apart) → pause → **connected blend** (gapless, 60 ms crossfade) → whole word. Tiles light in time. Sound Swap: the new phoneme → connected blend → new word.

Phonemes never taught in isolation by TTS: stops, affricates, glides, vowels. Bundled clips exist for all 34; parent recordings override. Mouth-shape icon next to the chip: **P2** (evidence modest but positive and cheap).

### 2.4 Math progression (Crystal Caverns and Rainbow Falls)

CRA order enforced per skill: concrete objects she moves → structured visuals (ten-frame, number rack) → numerals alongside → numerals alone. Subitizing 1–4 scattered, 5–10 only in structured arrangements. Teen numbers as ten + ones on a full frame plus extras. Make-10 and bonds with gems that physically split. Counting on from a random start; backward within 20. Measurement: attribute → compare → order → non-standard units. Data: sort into 2–3 bins that become a bar chart; most/fewest/how many more. Geometry light: identify in any orientation, 3D solids, compose. (Details and evidence grades will be amended from the math research report.)

### 2.5 Adaptive engine v2

Replace the single 8/10 window with a **per-skill Bayesian Knowledge Tracing estimate** plus explicit outcome types (ported from Phono StoryForge, Apache-2.0):

- Outcome types recorded per item: `firstTry`, `correctedAfterScaffold`, `revealed`, `abandoned`, plus flags `review` (item from an earlier stage) and `hidden` (audio-only prompt).
- BKT update per GPC/skill with `p_init .25, p_transit .15, p_slip .10, p_guess` = 1/choices (so 2-choice items barely move the estimate). `correctedAfterScaffold` counts as 0.5 evidence; `revealed` as incorrect.
- Stage promotion when every GPC in the stage has p ≥ 0.85 **and** at least 6 first-try items on 2 different days; demotion never automatic, only a "reteach" flag that raises review density.
- Session planner score per skill = `importance (tier weight 3/2/1) × (1 − p) × recency boost (days since, capped) × readiness (prerequisites p ≥ .6) × variety penalty (same skill 2 days running ×0.6)`; pick the top skill for today's lit place, then 2 review items from mastered skills (least-recently-seen first) so mastery does not decay. [B: spaced review; C: the weights]
- Missed item re-presentation two turns later stays. Items missed 3+ times feed the parent's trouble list with the contrast pair (b/d) named.

### 2.6 Reward and companion loop

- **Luna the unicorn** stands with the princess in every encounter and reacts to every item. Her **glow meter** (mane colour bands) fills with stars and never empties; at 12 / 38 / 63 stars she gains a visible feature (horn glow → wings → crown). [B for engagement]
- **Squishies**: each place has 3 Squishies trapped in bubbles; finishing a round pops one bubble; rescued Squishies live in the castle garden and can be tapped for a wiggle. 15 total, no duplicates, no randomness.
- **Gems** stay the spendable currency for Kingdom Builder decorations and the two prosocial gifts. Costs shown as gem rows, not numerals.
- Quest complete: Luna jumps, a chest opens, gems fly to the counter (≤1.5 s, tap to skip).
- No streak pressure: the streak flame counts days played and pauses.

### 2.7 Audio architecture (final)

| Channel | Source | Rationale |
|---|---|---|
| Phonemes (34) | parent recording → bundled SAPI clip → safe TTS for continuants only → silent | only channel TTS cannot do; consistency of one voice across a blend |
| Letter names | TTS | TTS says letter names correctly |
| Words | TTS (Google en-US on Android); optional parent recording for a curated confusable list (~12) | intelligible, cheap, content-driven slot exists |
| Sentences / instructions | TTS | hundreds of dynamic strings |
| Praise / character lines | TTS now; **P2**: 8 recorded parent lines ("Amazing, Amelia!") for warmth | cheap, high emotional value |
| SFX | local synthesized-once files (pop, sparkle, chime, whoosh), ≤6 files | no network, no oscillator music loops |

Blend = Web Audio chain, gapless, crossfade 60 ms; instant stop on any tap; preloaded and decoded at start.

**Recording spec for Dad (34 clips):** quiet room, phone 20 cm away, Chrome, Parent Corner → Sound Check. Continuants (s m f l n r v z sh th ng) held ~0.8 s at even volume. Stops (b d g k p t ch j) and h: one clipped burst, mouth closed after, no vowel. Glides (w y): short, end quickly. Vowels: the short sound only, as in the example word, ~0.5 s. Long vowels ā ē ī ō ū say the letter name. Re-record anything with a trailing "uh". Order of priority if time is short: a e i o u, then s m f t p n c/k b d, then sh ch th, then the rest. Format is handled by the app (webm/opus, normalized on playback). Words: not needed for the first release.

### 2.8 Ideal 10-minute session

| Time | What she sees | What the engine does |
|---|---|---|
| 0:00–0:20 | Map, Luna waiting at today's place, greeting | plan: target skill + 2 review items |
| 0:20–1:00 | 2 quick review items at the place (things she already knows) | spaced retrieval |
| 1:00–4:30 | Core encounter round (6 items) at the lit place | target skill, scaffold ladder |
| 4:30–5:00 | Bubble pops, Squishy rescued, stars, growth tick | reward |
| 5:00–8:00 | "Anywhere you like" round (her choice) | choice slot, still recorded |
| 8:00–8:40 | Quest chest, gems fly, Luna jumps | quest claim |
| 8:40–10:00 | Kingdom Builder or Squishy garden free play, or "one more?" | shaper; exit through breathing bubble |

### 2.9 Parent dashboard v2

Per skill: mastery estimate p, first-try rate last 20, trend arrow over 14 days (improving / flat / regressing), items and minutes per day, days since practised, review vs new split. Global: minutes this week, places visited, next recommended focus (the planner's top pick with its reason), trouble list with contrast pairs, baseline table. Export/import stays. Two-minute "do this with her tonight" line generated from the trouble list (adult involvement is the evidence-backed lever).

## 3. Priorities

**P0 (must ship for December value)**
1. Kingdom map home with five places, Luna, path, today's lit place.
2. Component system and theme: fonts, palette, tiles, chips, encounter frame, reaction states, celebration, chest.
3. Unicorn Meadow encounters: Word Spell (encode), Read the Rune (decode), Sound Swap, Sound Seeds (PA: first/final/medial, segment with gem boxes, deletion).
4. Adaptive v2 (BKT + planner + outcome types) and the per-item record.
5. Companion growth meter and Squishy rescue.
6. Crystal Caverns: ten-frame, make-10/bonds, teen builder, count-on/back.

**P1**
7. Wishing Well heart words + read-it-myself scrolls from the decodable engine (decompose port + sentence frames).
8. Rainbow Falls measurement/data/shapes.
9. Parent dashboard v2 with trends and next focus.
10. Story Castle read-to-me + poems; Calm tower and Uh-Oh courtyard rebuilt from existing content.
11. Kingdom Builder decorations (12 items) and prosocial gifts.

**P2**: mouth-shape icons, 8 recorded praise lines, curated word recordings, SFX polish, badges gallery.
**P3**: speech recognition (whole-word, closed vocabulary, Vosk) after December; multi-device sync via export reminders.

## 4. Sources (primary)
Gonzalez-Frey & Ehri 2021 https://eric.ed.gov/?id=EJ1295469 · Graham & Santangelo 2014 https://eric.ed.gov/?id=EJ1041016 · Weiser & Mathes 2011 https://eric.ed.gov/?id=EJ923791 · Boyer & Ehri 2011 https://eric.ed.gov/?id=EJ933946 · McTigue et al. 2020 https://ila.onlinelibrary.wiley.com/doi/abs/10.1002/rrq.256 · Ahmed et al. 2020 GraphoGame RCT https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2020.00132/full · UFLI glossary and toolbox https://ufli.education.ufl.edu/foundations/apps · Reading Rockets HFW model https://www.readingrockets.org/topics/phonics-and-decoding/articles/new-model-teaching-high-frequency-words · Lexia Core5 ESSA https://www.evidenceforessa.org/program/lexia-core5-reading/ · MDN SpeechRecognition (server-side on Chrome) https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition · Kid-Whisper child ASR https://arxiv.org/html/2309.07927 · FeedTheMonsterJS https://github.com/curiouslearning/FeedTheMonsterJS · phono-storyforge https://github.com/tanner-griffith/phono-storyforge · Duolingo shape language https://blog.duolingo.com/shape-language-duolingos-art-style/ · Andika design https://software.sil.org/andika/design/ · CPALMS benchmarks (ids in content/standards.json).
