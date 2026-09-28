# Princess Quest — state-of-the-art scorecard and roadmap (2026-09-27, v4.3.0)

Goal: a private, offline, ten-minute daily app that closes one child's specific foundational gaps while
feeling like a magical game she chooses to play. "State of the art" means matching or beating the best
children's learning apps on each dimension below, with evidence, not having more features.

Benchmark research (public materials, efficacy studies, reviews) compared onebillion onecourse,
GraphoGame, Teach Your Monster to Read, Khan Academy Kids, Duolingo ABC and Math, Endless Alphabet and
Reader, DragonBox Numbers, Todo Math, Kitkit School, Reading Eggs and others. Competitor scores are
judgments from public evidence, not hands-on testing. Princess Quest scores are from testing the running app.

v4.3.0 came from a multi-agent review (nine read-only reviewers, each finding adversarially verified;
134 confirmed findings: 1 P0, 20 P1, 46 P2, the rest P3). The P0, every P1 and most P2 were fixed with
regression tests, then seven roadmap features were built and the result re-verified.

## Scorecard (1–10)

| Dimension | Best competitor | v4.2.0 | v4.3.0 | What changed / what is left |
|---|---|---|---|---|
| Teaching method | onecourse 9, GraphoGame 9 (phonics) | 8 | 9 | Eight decodable Little Books built only from taught sounds and heart words; blend by sliding a finger across the letter stones; Letter Stones foils now keep the first letter (cat/cap) so she must read the whole word; heart words the first sentences need come first; Leitner spacing enforced. Left: mouth pictures for confusable sounds. |
| Personalization | GraphoGame 8 | 6 | 8 | Success-rate controller: 2 to 4 choices per skill to hold first-try success near 80%. Mastery no longer counts hinted, retried, wand-assisted or read-to-me answers as knowing; promotion needs recent unaided success. Left: act on "reteach" by stepping back a stage. |
| Audio | Teach Your Monster 8 (6 for a US child) | 7 | 8 | No more device-voice echo when a clip is cut; intros stop when she answers; heart-word mapping finishes; short i rebuilt from real words (it sounded like "ee"); sentence clips no longer lose their first words; "bed" re-rendered. Left: human ear check on the Chromebook. |
| Feedback on mistakes | onecourse 8 | 7 | 8 | Second miss removes the wrong choices and she taps the answer herself; story and courtyard choices speak their own warm feedback in order; patterns are named aloud. |
| Delight | Endless Alphabet 9 (craft) | 6 | 7 | Luna's pointing-hand demo the first time each activity appears, then "Now you try!"; Little Books with a picture per page. Left: richer finish animations. |
| Usability for a 6-year-old alone | onecourse 9 | 7 | 8 | 👆 show-me button on every activity; ears-only Woods now skips pictures with two common names and shows no letters; sorting baskets show their colour or picture; Quick Peek asks first, then flashes. |
| Craft, performance, offline | onecourse 9 | 8 | 8 | Save no longer grows on every device sync (P0); a full storage is reported; Back ends a round cleanly; first install no longer precaches the voice audition. Every activity completes in an automated browser play-through. |
| Parent insight | Khan Academy Kids 7 | 8 | 9 | This-week view (days, minutes, first-try rate against last week, what moved up, what is next); feelings and courtyard history are kept; exposure items no longer inflate accuracy; PIN asked again after Back. |

## Roadmap (ranked by value to Amelia against effort)

1. **Pick a voice** (parent, 5 minutes): Parent Corner → Voice. Heart turns on the story voice at once.
2. **Ear check** (parent, 10 minutes): on the Chromebook, Parent Corner → Sound Check, play short i, and a few Letter Stones words.
3. **Mouth pictures for confusable sounds** (medium, needs original or CC0 art): b/p, d/t, f/v, short e/i.
4. **Math bars that snap and split** (medium): number bonds with bars fading from objects to dots to numerals.
5. **Record and compare** (small–medium): she reads a word aloud, hears herself, then hears Luna; stored only on the device.
6. **Reteach step-back** (small): when a skill's estimate falls below the reteach line, add easier items for a day.
7. **Human letter sounds** (research, small): Feed the Monster's letter sounds are candidates; their licence files and README disagree (MIT/BSD vs CC-BY), so confirm with Curious Learning and attribute before use. The parent can already record any sound in Sound Check.

## Deliberately not changed

- The streak dots stay. They never reset, never show a loss, and never nag. The benchmark flags streaks as a common manipulative lure; this one is kept purely as a quiet record.
- Voice default stays the device voice until the parent chooses in Parent Corner, as requested.
- No speech recognition: children's speech recognition is still unreliable at this age, and it would need a microphone and model on the device.
