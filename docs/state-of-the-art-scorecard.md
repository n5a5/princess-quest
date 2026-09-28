# Princess Quest — state-of-the-art scorecard and roadmap (2026-09-27, v4.2.0)

Goal: a private, offline, ten-minute daily app that closes one child's specific foundational gaps while
feeling like a magical game she chooses to play. "State of the art" means matching or beating the best
children's learning apps on each dimension below, with evidence, not having more features.

Benchmark research (public materials, efficacy studies, reviews) compared onebillion onecourse,
GraphoGame, Teach Your Monster to Read, Khan Academy Kids, Duolingo ABC and Math, Endless Alphabet and
Reader, DragonBox Numbers, Todo Math, Kitkit School, Reading Eggs and others. Competitor scores are
judgments from public evidence, not hands-on testing. Princess Quest scores are from testing the running app.

## Scorecard (1–10)

| Dimension | Best competitor | Princess Quest before (v4.1.2) | Princess Quest now (v4.2.0) | What changed / what is left |
|---|---|---|---|---|
| Teaching method | onecourse 9, GraphoGame 9 (phonics) | 7 | 8 | Added: number-path board game (Siegler & Ramani), spell-from-memory for known heart words, explanations that model the skill. Left: decodable mini-books beyond single sentences, blending by finger-drag. |
| Personalization | GraphoGame 8 | 6 | 6 | Fixed: introductions and self-checks no longer raise mastery. Left: a success-rate controller (~80% success by adding or removing look-alike choices), as GraphoGame does. |
| Audio | Teach Your Monster 8 (6 for a US child) | 3 | 7 | Letter sounds were ~30 ms blips (the Chromebook click); rebuilt at teachable length in the word voice. Leading "uh" trimmed from 169 words. Story voice covers ~95% of spoken lines once chosen. Left: human ear check; optional human recordings. |
| Feedback on mistakes | onecourse 8 | 5 | 7 | A wrong pick says what it was ("Fox starts with /f/."), then Luna blends the word or counts the gems. Left: remove look-alike choices on a second try instead of revealing. |
| Delight | Endless Alphabet 9 (craft) | 6 | 6 | Sparkle and shimmer on blends, Rainbow Road. Left: a first-time demo per activity, richer finish animations, proportionate celebrations. |
| Usability for a 6-year-old alone | onecourse 9 | 6 | 7 | Idle nudge replays the prompt, keyboard play for the Chromebook, 64 px targets verified at seven screen sizes, the word to build is never printed. Left: a pointing-hand demo the first time each activity appears. |
| Craft, performance, offline | onecourse 9 | 6 | 8 | P0 fixed (Word Spell hung after a second wrong build). Every activity completes under random tapping. Offline install verified live: 1,391 files cached, 6.1 MB. Syntax and generator stress tests guard regressions. |
| Parent insight | Khan Academy Kids 7 | 6 | 8 | School results kept apart from app data, plain-language levels, tomorrow's trail, a screen-free two-minute game for the weakest skill, audio check, combine progress across devices. |

## Roadmap (ranked by value to Amelia against effort)

1. **Pick a voice** (parent, 5 minutes): Parent Corner → Voice. Heart turns on the story voice at once.
2. **Success-rate controller** (small–medium): per skill, add or remove look-alike choices to hold first-try success near 80%, and remove the wrong choice rather than reveal on the second try.
3. **First-time demo** (medium): the first time an activity appears, a hand shows one practice item. Replay available.
4. **Decodable mini-books** (medium): three- to five-page stories built only from the sounds and heart words she has mastered, read aloud one word at a time on tap.
5. **Blend by dragging a finger** (medium): sliding across the letter stones stretches each sound while the finger rests on it.
6. **Mouth pictures for confusable sounds** (medium, needs original or CC0 art): b/p, d/t, f/v, short e/i.
7. **Math bars that snap and split** (medium): number bonds with bars fading from objects to dots to numerals.
8. **Record and compare** (small–medium): she reads a word aloud, hears herself, then hears Luna; stored only on the device.
9. **Story voice to ~100%** (small): record the remaining reveal-only lines ("3 and 2 more is 5").
10. **Human letter sounds** (research, small): Feed the Monster's letter sounds are candidates; their licence files and README disagree (MIT/BSD vs CC-BY), so confirm with Curious Learning and attribute before use. The parent can already record any sound in Sound Check.

## Deliberately not changed

- The streak dots stay. They never reset, never show a loss, and never nag. The benchmark flags streaks as a common manipulative lure; this one is kept purely as a quiet record.
- Voice default stays the device voice until the parent chooses in Parent Corner, as requested.
- No speech recognition: children's speech recognition is still unreliable at this age, and it would need a microphone and model on the device.
