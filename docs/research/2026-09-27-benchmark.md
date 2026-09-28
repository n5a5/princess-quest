# Princess Quest competitive benchmark

Research date: 2026-09-27. Scope: best-in-class early-learning apps, benchmarked on eight dimensions for one kindergartener (weak: phonics, phonological awareness, high-frequency words, number sense and operations, measurement and data; strong: comprehension, vocabulary, geometry), plus open-source code and assets a static vanilla-JS PWA can reuse.

## How to read this

- **Scores** are 1–10 and are my judgment from public evidence. I did not hands-on test any app in this pass. Anything I could not confirm from a primary or reputable secondary source is marked **[unverified]**.
- **Evidence strength**: RCT > quasi-experimental > correlational (ESSA Level III) > vendor claim > review or anecdote.
- **Source caveat**: Common Sense Education paused its edtech reviews in January 2026 and said the review content would be removed from its site in February 2026. Many older Common Sense Education links are now dead (the Teach Your Monster review URL now returns the FAQ page). Common Sense *Media* parent reviews still loaded.
- **PQ status** notes come from the Princess Quest README as of v4.1.2. They describe what the README says the app does. I did not test it.

---

## 1. Per-dimension best in class

| # | Dimension | Best in class (score) | Runner-up(s) | Why it wins (evidence) | PQ status per README; gap |
|---|---|---|---|---|---|
| 1 | Teaching method vs research | **onebillion onecourse (9)**; **GraphoGame (9)** for phonics and phonological awareness only | Hooked on Phonics (8, [unverified depth]), Reading.com (8), Teach Your Monster to Read (7), Duolingo ABC (7), Kitkit School (8, math CSA) | onecourse teaches letters in the UK National Literacy Strategy order (s, a, t, n, i, p first), so real words can be blended early. Its phonemic-awareness strand moves from words to syllables to single phonemes. The alphabet (letter names) comes only after letter sounds. Math is taught concrete-first with number lines. RCTs: +0.34 SD literacy (Malawi, about 5.3 extra months) and +3 months maths (EEF, UK). GraphoGame: rime-based SSP with an 80% accuracy gate; UK RCT showed gains on nonword decoding. | Strong already: SSP stages, oral-only phonological awareness, heart-word sound boxes, CRA ten-frames. Gaps: no decodable books beyond sentences; phoneme audio is synthesized. |
| 2 | Personalization and adaptivity | **GraphoGame (8)** | Khan Academy Kids (7), onecourse (7), Lexia Core5 (9, school-only, out of scope) | Its adaptive engine targets about 80% "mastery" and 20% "challenge" trials. Difficulty is tuned through the number of distractors. Below 80%, it contrasts items the child knows with items they don't. onecourse runs a weekly diagnostic followed by 2 days of targeted units. | BKT per skill and per GPC, quest planner. Gap: no explicit success-rate controller; distractor count and similarity not used as the difficulty knob. |
| 3 | Audio quality (pure phonemes, voices) | **Teach Your Monster to Read (8 for UK English, about 6 for a US child)** | onecourse (8, [unverified purity]), Reading.com (8, [unverified by listening]) | Letter sounds are voiced by Mr Thorne, a phonics teacher, not an actor. Caveat: non-rhotic UK accent, and US parents report "noth" for north. Negative examples: Duolingo ABC adds schwa to /l/ and /b/; Endless Alphabet has a heavy schwa on i, g and h. In the Flinders review of 309 apps, pronunciation errors (added vowels on consonants) were among the most common failings. | Good architecture: phonemes are never TTS, parent recordings are supported, blends use connected phonation. Gap: bundled phonemes are Windows SAPI synthesis, the biggest quality risk. |
| 4 | Feedback on mistakes | **onecourse (8)** | GraphoGame (8), Kitkit School (7), Duolingo ABC (6) | For word items, onecourse segments and blends the word as feedback. Its record-yourself activity plays the child back, then the model. GraphoGame replays the target sound and removes all distractors, so the correct answer is the only choice left. Kitkit removes the wrong option and gives a gentle vibration. Research: explanatory feedback plus leveling is a *necessary* condition for highly effective maths apps (Outhwaite 2023 QCA). Explanatory verbal feedback cut preschoolers' errors compared with cheering sounds (Callaghan & Reich 2021). | Two-step scaffold (glow and re-speak, then reveal and re-present). Gap: feedback is not *explanatory*. It never says what the chosen wrong answer was, or models the segment-and-blend of the target. |
| 5 | Delight (without manipulation) | **Endless Alphabet / Endless Reader (9 craft, 4 pedagogy)** | Teach Your Monster to Read (8), Khan Academy Kids (8), Kitkit School (8) | Letter-monsters wiggle, blink and say their sound as they are dragged. Each finished word plays an animation that acts out its meaning (e.g. "water" ripples). TYM: the child *teaches* their own custom monster, with no streaks or aggressive reminders by design. Kitkit uses "proportionate responses" (celebration size matches the achievement) and tactile sounds (pencil scratch while tracing, wooden-puzzle click). | Luna, Squishies, gems, garden. Watch-out: a "day streak" is a Radesky-type lure; keep it non-punitive or parent-facing. |
| 6 | Usability for a 6-year-old alone | **onecourse (9)** | Khan Academy Kids (8), Kitkit School (8) | Built for children working with no adult help. A digital teacher (Anna) demonstrates each new activity with a pointing hand. The instruction repeats if the child is idle, and a Repeat button is always present. Numeracy has almost no on-screen text. A starter lesson teaches tap and drag. Hit areas are larger than the visuals. Short drops snap into place. Tracing auto-completes if the finger lifts near the end. Kitkit avoids audio-only information (animated tutorials, highlighted words). | 64 px targets, auto-play prompts. Gaps: idle re-prompt, first-time "how-to" demo per activity type, drop tolerance for drag [verify in code]. |
| 7 | Craft, polish, performance, offline | **onecourse (9)** | Kitkit School (8), Duolingo ABC (8, offline [unverified]) | Fully offline on low-end tablets. Stated goals: instant audio or visual response and no lag. SVG assets with a custom frame-animation renderer. Locked launcher with child-friendly system messages. Kitkit is also fully offline, with a 15-month field test. | Static PWA with cache-first SW, precache test. Good. |
| 8 | Parent insight | **Khan Academy Kids (7)** | Hooked on Phonics (7), Reading.com (7, co-play) | Progress reports show skills mastered as fractions against standards, plus weekly parent emails. Hooked on Phonics added a "Skills Summary" screen after every lesson (2025). Reading.com scripts the adult's role in each lesson. Consumer apps are generally weak here; Lexia Core5 (school) is the benchmark for actionable reports. | Parent Corner: mastery, trends, next focus, Sound Check, export. Gap: no "do this offline tonight" co-play prompt, although adult interaction is the biggest moderator in the GraphoGame meta-analysis (avg ES 0.48). |

---

## 2. App profiles: specific techniques worth knowing

### onebillion onecourse (XPRIZE co-winner, 2019)
- **Evidence**: Malawi RCT, +0.34 SD literacy (about 5.3 months) and +0.29 SD number identification. EEF UK RCT, +3 months maths (12 weeks, 30 min/day, 4 days/week). XPRIZE Tanzania field test: children able to read a single Swahili word rose from under 10% to 45%, and 30% read full sentences. Sources: https://onebillion.org/impact/evidence/ , https://www.socialscienceregistry.org/trials/3882/history/63711
- **Techniques** (onecourse handbook, https://github.com/XPRIZE/GLEXP-Team-onebillion/blob/master/onecourse_handbook.pdf):
  - Letter order chosen so real words can be built as early as possible (s, a, t, n, i, p). Alphabet letter *names* only after letter sounds.
  - Phonemic awareness moves words → syllables → phonemes. "Sound boxes" also play animal and environmental sounds for same/different discrimination.
  - "Meet the letters": a red listening button hops from letter to letter, the child taps it to hear each sound, then the letters visibly slide together and the blended syllable or word plays.
  - "Segment and blend": a word and its picture segment into graphemes and re-blend, synced to audio.
  - Match what Lisa said: on word items, the feedback segments the word into letters.
  - Drag the label: *no audio until feedback*, so it is a true decoding test.
  - Record yourself: the child's recording plays back, followed by the model audio.
  - No reading required for math; concrete images first; number lines for sequencing and operations.
  - Feedback: a big yellow tick for correct. Wrong gives a sound and "try again". End of unit: a very short summary of what was practised, then a "shooting star" finale.
  - Pacing: "ideally no more than one [letter] a day, with revision days". Daily time limit ("That's enough for today! See you tomorrow!"). A weekly diagnostic leads to 2 days of software-selected support units.
  - Custom typeface with single-storey a and g and a clear I/l distinction. Red is the only highlight colour. White background for reading. Colour-blind-safe palette.

### GraphoGame (University of Jyväskylä)
- **Evidence**: 17 languages. UK GraphoGame Rime RCT gains on TOWRE nonwords (small ES), maintained over summer for younger and under-resourced children. Kyle et al. 2013: reading +34–38%, spelling +40–45% (vendor summary). Meta-analytic average ES 0.48 *when there is high adult interaction*. Effects are stronger on sublexical skills than on transfer to reading. Sources: https://graphogame.com/evidence/ , https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2020.00132/full , https://files.eric.ed.gov/fulltext/EJ1318042.pdf
- **Techniques**: a spoken sound or word is matched to one of several letter targets. 80% accuracy gate. 80/20 mastery/challenge mix. Difficulty is tuned by the number of distractors. On an error, the same sound replays and all distractors disappear, forcing the correct choice. Only positive feedback otherwise. Sessions of 10–15 minutes daily. Rime units (-at) before full CVC.

### Teach Your Monster to Read (Usborne Foundation, free on web)
- **Evidence**: no published efficacy study. Designed with the University of Roehampton; aligned to Letters and Sounds phases 2–5. https://www.teachyourmonster.org/teach-your-monster-to-read/
- **Techniques**: the child creates and names a monster, then *teaches it* to read (a protégé framing that "shifts focus from the child's struggle"). New GPCs appear with a picture prompt ('s' with a sun) to limit cognitive load. The team explicitly rejects streaks and aggressive reminders, and aims for feedback that is positive on success and not shaming on errors. Real-teacher phoneme voice (Mr Thorne). https://www.teachyourmonster.org/monster-news/making-monster-magic-5-finding-the-balance-between-fun-and-learning/
- **Weaknesses**: UK accent for US children (non-rhotic r) [user reports].

### Kitkit School (Enuma; XPRIZE co-winner)
- **Evidence**: highest learning gains among XPRIZE finalists, statistically indistinguishable from onebillion. https://www.xprize.org/news/global-learning-xprize-two-grand-prize-winners
- **Techniques** (Kitkit handbook, https://kitkitschool.com/doc/Kitkit-Handbook_V3a.pdf):
  - Egg Courses: tap an egg to hatch a creature, which grows as the child progresses and gets a crown after the post-course test (≥80% to unlock the next course).
  - Math uses Concrete → Semi-concrete → Abstract. Example: 1+4 shown as one blue bug and four green bugs joining; 10 = 2+8 by assigning fish to two tanks. Representations are faded in later courses.
  - "Ease to success": puzzle pieces snap into place, and a wrong multiple-choice answer is removed from the remaining choices.
  - "Proportionate responses": sparkles for a correct answer, a bigger fanfare for a session, a crown for a course.
  - Skeuomorphic manipulatives with realistic sounds (a pencil scratch while tracing).
  - Short transitions, and the child can quit any activity immediately.
  - No audio-only information: animated tutorials, words highlighted as they are read, subtitles.
  - Child-directed choice within gated courses.
  - Honest caveat: they cite Nir Eyal's "Hooked" variable rewards (coins, Sea World decorations). One child replayed a test 40+ times in a week to collect decorations, which shows the pull of extrinsic loops.

### Khan Academy Kids
- **Evidence**: RCT (UMass Amherst, n=49, low-income 4–5-year-olds) found that children using it ≥1 hour/week moved from the 34th to 47th percentile on TOPEL overall, and from the 23rd to 47th on phonological awareness, in 10 weeks. https://blog.khanacademy.org/khan-academy-kids-improves-pre-literacy-skills-in-preschoolers-research-confirms/
- **Techniques**: Kodi bear guide makes the app navigable without reading. The Learning Path auto-cycles subjects and surfaces content at the child's level. Free, with no ads or upsells. Parent reports show skills mastered as fractions, plus weekly emails. Curriculum built with Stanford GSE. https://khankids.zendesk.com/hc/en-us/articles/360048828572-Learn-more-about-the-Learning-Path

### Duolingo ABC
- **Evidence**: no independent efficacy study found. Common Core alignment document only.
- **Techniques**: tracing with formation feedback, speech-recognition read-aloud, Elkonin boxes for spelling, stories with word highlighting, parent lock on levels.
- **Weaknesses** (phonics.org review, https://www.phonics.org/learn-to-read-duoling-abc-review/):
  - schwa on /l/ and /b/;
  - no continuous-blending model;
  - over-reliance on matching whole spoken words to written words;
  - speech recognition too lenient (accepts wrong answers);
  - scramble words ("monkey", "ostrich") beyond the taught code;
  - few truly decodable books.
  - Common Sense Media: no skip-ahead, so children who already read are forced through early levels. https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read

### Duolingo Math
- Merged into the main Duolingo app in late 2023. Current math content targets about grade 3 and up, so it is not a kindergarten competitor. Useful idea: lessons interleave concrete, representational and abstract forms of the same fact in one lesson. https://duolingo.fandom.com/wiki/Duolingo_Math , https://www.the74million.org/article/duolingo-the-language-learning-app-giant-wants-to-teach-kids-math/

### Reading.com (parent co-play)
- **Techniques**:
  - Blending **slider** under the word: the child moves it slowly, then faster, while saying the sounds.
  - Teaches continuous versus stop sounds.
  - Irregular words get a different-coloured slider segment for the part that is not decodable.
  - **Pictures are revealed only after the child reads**, to prevent guessing.
  - Scripted adult coaching; 99 lessons of 15–20 minutes. https://www.phonics.org/reading-dot-com-app-review/

### Hooked on Phonics
- Songs, per-lesson customized **decodable book using the words just practised** with optional read-along highlighting, a "Skills Summary" after each lesson (2025), and offline downloads. Efficacy evidence not verified. https://www.hookedonphonics.com/access-resources/faqs/ , https://apps.apple.com/us/app/hooked-on-phonics-learning/id588868907

### Endless Alphabet / Endless Reader (Originator)
- Best-in-class animation: meaning is animated for each word, and letter-monsters say their sound while dragged.
- Pedagogy is weak: sight words are taught whole-word, and several letter sounds carry schwa (phonics.org). https://www.phonics.org/endless-alphabet-app-review/ , https://www.hbook.com/story/endless-reader-app-review

### Kahoot! Numbers by DragonBox
- Nooms are creatures worth 1–10, digital Cuisenaire/Montessori rods. The child stacks them (addition), slices them (decomposition), compares them and places them on a number line. Modes: sandbox, ladder and picture puzzles.
- No explicit help by design, and Common Sense notes that this sometimes confuses. Nooms differ only by height, and number sentences are inconsistently voiced. No efficacy study found. https://www.commonsensemedia.org/app-reviews/dragonbox-numbers

### Todo Math (Enuma)
- 2,000+ activities; left-handed mode, help button, dyslexia font. Only observational engagement evidence (Berkeley kindergarten).
- **Cautionary example**: Radesky et al. (JAMA Netw Open 2022) recorded Todo Math showing a character with a large tear while prompting a free-trial sign-up. https://faculty.washington.edu/alexisr/childrenManipulativeDesign.pdf

### Others, briefly
- **Reading Eggs**: ESSA Level III (correlational: more lessons correlated with higher MAP). Parent reports that it sometimes asks for memorized sight words. https://readingeggs.com/articles/reading-eggs-meets-essa-rating-evidence-standards/
- **ABCmouse**: vendor-reported correlational gains. https://www.abcmouse.com/learn/abcmouse/efficacy-studies/23796
- **HOMER**: a "74% increase in 6 weeks" claim with an unclear study design; treat as a vendor claim [unverified]. https://www.beginlearning.com/homer/pdp
- **Lingokids**: highly engaging, broad; no efficacy data. https://www.commonsensemedia.org/app-reviews/lingokids-play-and-learn
- **Starfall**: accurate letter sounds, but blending is modeled for only a few letters. https://www.phonics.org/starfall-abc-app-review/
- **Nessy**: Orton-Gillingham-based and rated highly in the Flinders appraisal. https://www.ilteducation.com/uk/news/nessy-apps-shine-in-a-world-first-literacy-study/
- **Ello** (2024–26 entrant): AI speech-recognition reading coach with 700+ decodables; no peer-reviewed efficacy study found. https://www.edweek.org/technology/ai-tutors-are-now-common-in-early-reading-instruction-do-they-actually-work/2025/11
- **Feed the Monster**: 22 hours of play led to letter-learning gains in the Azraq refugee camp (World Vision evaluation). https://www.livingfirstlanguage.org/feed-the-monster
- **Flinders 2025 appraisal of 309 phonics/PA apps**: only 85 (27.5%) recommended. 81% gave no clear explicit teaching or modelling. Common failures were added vowels on consonants, no logical sequence and weak corrective feedback. Consumer ratings did not correlate with expert ratings. Top-rated apps included Hairy Letters, Initial Code, Chimp Fu Syllables, PocketPhonics Stories and PLD 2P Read 1d. https://news.flinders.edu.au/blog/2025/11/27/kids-reading-apps-failing-to-deliver-educational-value/ , https://pld-literacy.org/not-all-phonics-apps-are-created-equal/

---

## 3. Techniques to adopt, ranked by likely learning impact per unit of effort

Effort for a small static vanilla-JS PWA: **S** is under 1 day, **M** is 1–3 days, **L** is more than 3 days. "Impact" is my estimate for *this* child's weak strands.

| Rank | Technique | Seen in | Research basis | Impact | Effort | Concrete implementation for PQ |
|---|---|---|---|---|---|---|
| 1 | **Human-recorded, pure-phoneme audio set** (replace synthesized phoneme clips; continuants recorded long enough to stretch, stops clipped with no schwa) | TYM (teacher voice), Reading.com; the Flinders review names added-schwa errors as a top failing | Gonzalez-Frey & Ehri 2021 (connected phonation needs stretchable continuants); Ehri (articulatory features aid mapping) | Very high | S (about 1–2 h of guided recording plus QA) | Use the existing Sound Check recorder. Record each continuant for about 1.5 s so the blender can trim it to any length. For stops, record the stop plus a trace of release, never "buh". Add a waveform or length check that flags any stop clip longer than about 120 ms (likely schwa). Wikimedia IPA clips (CC BY-SA 3.0) can serve as a pronunciation *reference* for the parent. |
| 2 | **Explanatory, contrastive error feedback** ("You picked *bat*, /b/. We need /k/: c-a-t, cat.") plus segment-and-blend of the target as feedback | onecourse (segment/blend in feedback), GraphoGame (replay target) | Outhwaite et al. 2023 QCA (explanatory + motivational feedback + programmatic leveling necessary for highly effective apps); Callaghan & Reich 2021 | High | S | In `encounter.js`, on the first miss: speak the chosen foil's word or sound, then the target, then run the existing gapless blend animation on the target. Keep the glow. On the second miss, reveal as now. Short fixed script, no praise words on misses. |
| 3 | **Distractor elimination plus a success-rate controller** (target about 80% first-try success; difficulty knob is distractor count and similarity, e.g. 2 → 3 → 4 foils, far → near foils such as b/d, e/i) | GraphoGame, Kitkit ("wrong answer removed") | GraphoGame 80/20 design; Vygotsky ZPD; Outhwaite (dynamic leveling) | High | S–M | On a miss, fade out the chosen foil (Kitkit), then all foils on the second miss (GraphoGame) before the reveal. In `adaptive.js`, track a rolling 10-item first-try rate per subskill. Below 70%, drop to fewer or farther foils. Above 90%, add a near foil. BKT stays the mastery model; this only sets item difficulty. |
| 4 | **Delayed picture reveal / picture as feedback** in decoding items and decodable sentences | Reading.com; onecourse "Drag the label" (no audio until feedback) | Samuels' focal-attention findings (pictures shown with words reduce word learning); pictures used *as feedback* avoid the penalty | High | S | In Letter Stones and Spell Scroll, show the word or sentence alone, the child blends or reads, then the picture appears as the confirmation. Keep picture-choice items for comprehension, not for decoding. |
| 5 | **Child-driven continuous-blending slider**: the finger slides under the letters and each phoneme sounds *while the finger is on it*, held as long as the finger stays (continuants), connected into the next | Reading.com slider; PocketPhonics; "Toddlers Can Read" slider | Gonzalez-Frey & Ehri 2021 (connected > segmented phonation, kindergarten) | High | M | Pointer-move over letter tiles. Continuants use a looped sustain segment (Web Audio `AudioBufferSourceNode.loop` with loopStart/loopEnd), and crossfade into the next phoneme. Stops play attached to the following vowel. At the right edge, play the whole word fast, then the picture reveal (#4). Needs clips from #1. |
| 6 | **Linear number-board game** (1→10, then 1→20). Roll or spin, move, *say each number landed on* ("5, 6, 7") | Siegler & Ramani "Great Race"; onecourse number lines | Four 15–20 min sessions improved magnitude comparison, number-line estimation, counting and numeral ID in low-income preschoolers; gains held 9 weeks; linear > circular boards | High (number sense) | S–M | A new Crystal Caverns family: horizontal board of numbered gems, a 1–2 spinner, Luna's token hops, and each square's number is spoken and must be tapped in order (count-on). Later: "which is bigger, 7 or 4? Look where they live on the path." |
| 7 | **Spell-it-from-memory step for heart words** (say → tap sounds into boxes → mark heart part → hide → rebuild from tiles → check) | Heart-word routines (UFLI style); onecourse "Make the word you hear" | Ehri 2014: orthographic mapping bonds spelling, pronunciation and meaning; spelling retrieval strengthens it | Med-high (HFW) | S | Wishing Well already has sound boxes and a heart. Add a final retrieval step: the word hides and she rebuilds it from 3–5 tiles including one plausible foil (e.g. "sed" vs "said"). Leitner box promotion only on unaided rebuild. |
| 8 | **Auto-generated decodable micro-books** (3–5 pages) using only mastered GPCs plus known heart words, read with tap-to-hear on any word and the picture revealed after each page | Hooked on Phonics (custom decodable per lesson), onecourse (story modes read-to → shared → alone) | Decodable-text practice is a Flinders quality criterion; transfer from sublexical skill to reading is GraphoGame's weak point | High | M | Template sentences over `phonics.json` words filtered by per-GPC mastery (like the existing sentences.json). Three story modes: Luna reads with highlighting, she reads with help, she reads alone. Reuse CC BY 4.0 African Storybook or StoryWeaver art for covers, or emoji art. |
| 9 | **Articulation (mouth) cues** for phonemes, shown when a sound is introduced and in feedback for confusable pairs (/b/–/p/, /d/–/t/, /f/–/v/, /e/–/i/) | Speech Sounds for Kids, Read Write Inc videos; Ehri recommends articulatory features | Ehri 2014 (teaching articulatory features facilitates orthographic mapping) | Med-high (PA and phonics) | M | About 12 SVG mouth shapes (lips together, teeth on lip, tongue up, open wide, rounded…) mapped per phoneme in `sounds.json`. Show beside Luna's speech bubble. Alternatively, the parent records short mouth videos in Sound Check (larger storage). |
| 10 | **Parent "tonight, try this" co-play card** plus a one-screen session summary in plain words | Hooked on Phonics Skills Summary, Khan Kids reports, Reading.com scripts | GraphoGame meta-analysis: adult interaction is the strongest moderator (avg ES 0.48); Hirsh-Pasek et al. 2015 "socially interactive" pillar; Outhwaite 2023 notes parent-based Bedtime Math d=0.82 | Med-high | S | In Parent Corner, 3 lines: what she practised, the one thing she found hard (e.g. "b vs d"), and a 2-minute offline game for tonight (e.g. "I spy something that starts with /d/"). Generated from BKT and missed items. |
| 11 | **Part-whole number bars and fading representations**, with a count-on explanatory animation after math errors | DragonBox Nooms (stack/split), Kitkit CSA (bugs joining, fish into tanks), Duolingo Math (interleaved representations) | CSA/CRA (Van de Walle); Outhwaite 2023 explanatory feedback | Med-high | M | In Number Spells, 1–10 bars that snap together (7 = 5+2) and split. After an error, animate the objects combining and count on aloud from the larger addend. Fade from objects → ten-frame dots → numerals as mastery rises. |
| 12 | **Record-then-model oral reading** (she reads a word or sentence, hears herself, then hears Luna's model) with no speech recognition | onecourse "Record yourself" | Self-monitoring plus model comparison; avoids the lenient-ASR false positives seen in Duolingo ABC | Medium | S–M | `MediaRecorder` works offline. Keep clips in memory only, or opt-in IndexedDB. This is exposure only and never scores. Needs one microphone permission and a parent toggle. |

**Next tier** (quick usability and delight wins, mostly S):
- **Idle re-prompt**: repeat the instruction after about 8 s of no touch, and pulse the replay button (onecourse).
- **First-time "how-to" demo** per activity type: a ghost hand drags or taps once (onecourse, Kitkit animated tutorials).
- **Drop tolerance and snap**: a drag released overlapping the target slides home (onecourse, Kitkit).
- **Proportionate celebrations**: tiny for an item, medium for a round, big only for mastery milestones (Kitkit).
- **Letter-embedded picture mnemonics** for GPCs, e.g. an s-shaped snake or an h-shaped horse (Ehri; Shmidman & Ehri 2010). Effort M for art.
- **Pacing guard**: at most one new GPC per day, with review days (onecourse).
- **Weekly 2-minute check-up** that re-seeds BKT and schedules 2 days of focus (onecourse).
- **Protégé framing**: "teach Luna the sound" on new GPCs (TYM). Evidence for this in apps is thin [unverified].
- **Animated word meanings** for vocabulary and HFW celebration (Endless Reader). Effort M, delight only.

**Anti-patterns to avoid** (Radesky et al. 2022 found them in 80% of apps used by 3–5-year-olds; https://faculty.washington.edu/alexisr/childrenManipulativeDesign.pdf):
- Parasocial pressure: a character sad or disappointed when the child stops.
- Fabricated time pressure.
- Navigation constraints: auto-advancing with no stop option.
- Lures: daily rewards, streaks, "come back tomorrow to get X".

PQ already avoids timers and penalties. Recommendation: a streak should never be shown as lost to the child, and Luna should never express disappointment at stopping. The onecourse model is Luna saying "That's enough for today!"

---

## 4. Open-source apps and reusable assets

| Project | License (verified where noted) | What's there | Reuse for a static vanilla-JS PWA |
|---|---|---|---|
| **Kitkit School** https://github.com/XPRIZE/GLEXP-Team-KitkitSchool | Code **Apache-2.0**; assets **CC BY 4.0** (repo README); "Kitkit School" and "Enuma" are trademarks | 13 Android apps (Java, cocos2d-x C++). English (US) and Swahili resources are in release v1.0 as very large APKs (KitkitSchool-english 1.49 GB, library-englishUS 1.65 GB). Last push 2019. | Mine the **curriculum framework** (handbook) and **US-English audio and images under CC BY 4.0** (APK is a zip; attribution required; do not use the name or logo). Code is not reusable directly (native). Quality of the US phoneme recordings is [unverified]; listen before use. |
| **onebillion onecourse** https://github.com/XPRIZE/GLEXP-Team-onebillion | Repo **Apache-2.0** (LICENSE file); ATTRIBUTIONS lists third-party stories under CC BY 4.0; per-asset license of audio and art [unverified] | Android app, English and Swahili filesystem images (release v3.0.0), 60+ page handbook PDF. English phonics voiced by Nat Dinham (UK accent). | The **handbook is the best free design spec found** (pedagogy, usability, feedback). Audio is UK-accented, so prefer own recordings for a US child. |
| **Chimple** https://github.com/XPRIZE/GLEXP-Team-Chimple-goa | **Apache-2.0** (GitHub API) | cocos2d-x C++ games plus Java launcher; 60+ games, 70 stories. Last push 2019. | Game ideas; asset licensing per file [unverified]. |
| **Feed the Monster (Unity original)** https://github.com/curiouslearning/FeedTheMonster | Code **BSD-2-Clause**; "all digital content… CC BY 4.0" (LICENSE file, verified) | Unity letter-sound game; monster art, UI and audio in 48+ languages | **Monster art and UI under CC BY 4.0** with attribution to Apps Factory / Curious Learning. |
| **FeedTheMonsterJS** https://github.com/curiouslearning/FeedTheMonsterJS | Code **MIT** (verified); language-pack images and audio Creative Commons (CC BY per the original) | TypeScript + HTML canvas + Webpack + **Workbox PWA**; JSON level definitions per language; active (pushed 2026-09-03) | **Closest architectural sibling.** Study its level JSON, canvas feeding animation and offline packaging. MIT code can be copied with the notice kept. |
| **GCompris** https://github.com/KDE/gcompris , voices https://github.com/gcompris/GCompris-voices | App **AGPL-3.0-only**; voices licensed **per file**: English alphabet clips "Julia Wycherley 2011 / GPL"; word images and voices from Art4Apps **CC BY-SA 3.0** | 150+ activities (Qt/QML), active (pushed 2026-09-26) | Activity ideas only. Do not copy AGPL code into PQ, and GPL clips would impose copyleft. The English alphabet clips are **letter names, not phonemes**. |
| **Art4Apps** https://wiki.sugarlabs.org/go/Art4Apps | **CC BY-SA 3.0** (per GCompris README and Sugar Labs) | Pictures plus spoken-word audio for common words, multiple languages | Picture and word-audio source. Share-alike applies to the assets themselves; keep them as separate files with a credits page. |
| **Wikimedia Commons IPA recordings** (e.g. File:Voiceless_alveolar_sibilant.ogg) | **CC BY-SA 3.0** (verified on 4 files via Commons API) | Isolated phonemes by phoneticians (adult, lab style; some vowels are cardinal, not English) | A **reference** for recording pure phonemes, not a child-facing voice. |
| **Kenney** https://kenney.nl (e.g. /assets/interface-sounds, /ui-audio, /music-jingles, /digital-audio, /impact-sounds, /ui-pack) | **CC0** (verified on the Interface Sounds page) | UI sprites, icons, SFX, short jingles | **Best drop-in source for UI SFX and celebration jingles**, no attribution needed. Convert to .ogg/.m4a and precache. |
| **Freesound** https://freesound.org | Per sound: **CC0**, CC BY, or CC BY-NC | Huge SFX library | Filter by **CC0** only, to avoid attribution bookkeeping. Good for tactile sounds (chalk, wooden click, sparkle). |
| **OpenGameArt** https://opengameart.org | Mixed per asset; filter by **CC0** | Sprites, SFX, music | Same approach as Freesound: CC0 filter. |
| **Twemoji** https://github.com/jdecked/twemoji | Code MIT; graphics **CC BY 4.0** | 3,600+ SVG emoji | Picture-choice art (PQ already uses emoji in `phonics.json`). Bundling SVGs gives consistent rendering across devices. |
| **Microsoft Fluent Emoji** https://github.com/microsoft/fluentui-emoji | **MIT** (GitHub API) | 3D, flat and color SVG/PNG emoji | Permissive alternative with a friendlier 3D style. |
| **OpenMoji** https://github.com/hfg-gmuend/openmoji | **CC BY-SA 4.0** | Line-art emoji | Share-alike; usable but adds obligations. |
| **Noto Emoji** https://github.com/googlefonts/noto-emoji | Font **OFL-1.1**; image assets Apache-2.0 [unverified] | Emoji font and PNG/SVG | Alternative picture source. |
| **Andika** https://github.com/silnrsi/font-andika | **OFL-1.1** | Literacy font (single-storey a/g, distinct I/l) | Already bundled in PQ. |
| **African Storybook / StoryWeaver** (via onecourse ATTRIBUTIONS) | **CC BY 4.0** (per-story, verified in ATTRIBUTIONS) | Leveled illustrated stories | Story Castle read-alouds and illustration reuse; text is not decodable. |
| **Open Source Phonics** https://www.opensourcephonics.org/ | License **[unverified]** (check its Terms page) | 120 lessons, 10 groups of decodable stories, dictation, oral sound play | A scope-and-sequence cross-check and a decodable-text source if the license allows. |
| **Lingua Libre** (word pronunciations) | Generally CC BY-SA **[unverified]** | Crowd-recorded word audio | Word-audio fallback only; accents vary. |

**License bottom line for PQ**:
- CC0 (Kenney, Freesound CC0, OpenGameArt CC0) and MIT (FeedTheMonsterJS, Fluent Emoji, Twemoji code) are frictionless.
- CC BY 4.0 (Kitkit assets, Feed the Monster content, Twemoji graphics, African Storybook) needs a credits screen in Parent Corner and the README.
- CC BY-SA (Art4Apps, OpenMoji, Wikimedia IPA) is fine for separate asset files with attribution, but adapted versions must stay CC BY-SA.
- Avoid pulling in AGPL or GPL code or clips (GCompris).

---

## 5. Sources

Efficacy and research:
- onebillion evidence: https://onebillion.org/impact/evidence/ ; RCT registry: https://www.socialscienceregistry.org/trials/3882/history/63711
- XPRIZE results: https://www.xprize.org/news/global-learning-xprize-two-grand-prize-winners
- GraphoGame: https://graphogame.com/evidence/ ; Rime RCT: https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2020.00132/full ; meta-analysis: https://files.eric.ed.gov/fulltext/EJ1318042.pdf ; error handling and 80/20 design: https://link.springer.com/article/10.1007/s10212-017-0354-9 , https://www.researchgate.net/publication/333799091
- Khan Academy Kids RCT: https://blog.khanacademy.org/khan-academy-kids-improves-pre-literacy-skills-in-preschoolers-research-confirms/
- Reading Eggs ESSA III: https://readingeggs.com/articles/reading-eggs-meets-essa-rating-evidence-standards/
- Outhwaite et al. 2023 (maths app active ingredients): https://discovery.ucl.ac.uk/id/eprint/10170561/1/Outhwaite%20et%20al.%202023.pdf
- Callaghan & Reich 2021: https://bera-journals.onlinelibrary.wiley.com/doi/am-pdf/10.1111/bjet.13055
- Gonzalez-Frey & Ehri 2021 (connected phonation): https://eric.ed.gov/?id=EJ1295469
- Ehri 2014 (orthographic mapping): https://eric.ed.gov/?id=EJ1027413
- Samuels 1967 (pictures and word learning): https://eric.ed.gov/?id=ED014370 ; pictures as feedback: https://www.tandfonline.com/doi/abs/10.1080/0144341950150301
- Siegler & Ramani linear board games: https://siegler.tc.columbia.edu/wp-content/uploads/2019/02/sieg-ram09.pdf
- Hirsh-Pasek et al. 2015 four pillars: https://journals.sagepub.com/doi/abs/10.1177/1529100615569721
- Radesky et al. 2022 manipulative design: https://faculty.washington.edu/alexisr/childrenManipulativeDesign.pdf
- Flinders / Furlong 2025 appraisal of 309 apps: https://news.flinders.edu.au/blog/2025/11/27/kids-reading-apps-failing-to-deliver-educational-value/ , https://pld-literacy.org/not-all-phonics-apps-are-created-equal/
- Computer-supported early literacy meta-analysis (ES 0.28): https://www.sciencedirect.com/science/article/pii/S1747938X1930394X

Design documents and reviews:
- onecourse handbook: https://github.com/XPRIZE/GLEXP-Team-onebillion/blob/master/onecourse_handbook.pdf
- Kitkit handbook: https://kitkitschool.com/doc/Kitkit-Handbook_V3a.pdf
- Teach Your Monster design blog: https://www.teachyourmonster.org/monster-news/making-monster-magic-5-finding-the-balance-between-fun-and-learning/
- Duolingo ABC critique: https://www.phonics.org/learn-to-read-duoling-abc-review/ ; Common Sense Media: https://www.commonsensemedia.org/app-reviews/duolingo-abc-learn-to-read
- Reading.com: https://www.phonics.org/reading-dot-com-app-review/
- Endless Alphabet: https://www.phonics.org/endless-alphabet-app-review/ ; Endless Reader: https://www.hbook.com/story/endless-reader-app-review
- DragonBox Numbers: https://www.commonsensemedia.org/app-reviews/dragonbox-numbers
- Starfall: https://www.phonics.org/starfall-abc-app-review/
- Khan Kids Learning Path: https://khankids.zendesk.com/hc/en-us/articles/360048828572-Learn-more-about-the-Learning-Path
- Duolingo Math history: https://duolingo.fandom.com/wiki/Duolingo_Math

Open source and assets: links inline in section 4.
