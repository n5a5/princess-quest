# Tick-Tock Lagoon: telling time (plan and phase 1, 10/25/2026)

A new map place in the spirit of the Squishy Time Rescue board game (an ocean, squishy sea friends, a geared clock,
a rainbow path), with original art and no borrowed names. Asked for by the parent on 10/25/2026; choices made then:
the name and ocean theme, times said as "three thirty" (not "half past three"), her real routine times in a "My
day" card, and no physical teaching clock for now.

## Standards and level

Florida B.E.S.T. puts telling time in grade 1: MA.1.M.2.1, "Using analog and digital clocks, tell and write time in
hours and half-hours" (CPALMS 15271; no a.m./p.m. or 24-hour time at this level). Kindergarten has no time benchmark
(MA.K.M.1.3 is measuring length, see content/standards.json), so the whole place is a stretch for Amelia (K). It is
free play: never a quest stop (not in `GROUPS`), never in Star Stage's daily plan. Later grades, for later phases:
MA.2.M.2.1 (nearest five minutes, quarter past/to), MA.3.M.2.1 and 2.2 (nearest minute, elapsed time).

## The clock (shared/clock.js)

- Geared: the hour hand angle is 30 x h + 0.5 x m, so at three thirty it sits halfway from 3 to 4. A clock whose
  hands move on their own teaches the wrong picture, and that picture is the classic slip (3:30 read as "four
  thirty").
- Colours join the two clocks: the hour is pink on the hand and in the digital time, the minutes blue.
- Turning: drag either hand (the one nearest the finger), or the two big turn buttons (one step each), so a small
  finger never has to drag. The minute hand follows the finger's path continuously, so turning clockwise past the 12
  always moves the hour on, even when the clock snaps in half hours.
- Pure maths (no DOM) is tested in tests/lagoon.test.js.

## Cards (games/princess-quest/lagoon.js), through the shared encounter engine

| Card | She does | Wrong answers |
|---|---|---|
| Read the clock | picks the time (digital, in colour) for a clock | the real mistakes: the next-hour slip at half past, the long hand ignored, the hands swapped, a near hour, the number across |
| Match the clocks | picks the clock for a time Luna says (the digital time shows too) | the same mistakes, as clocks |
| Set the clock | turns the hands to a time, taps Done | 1st: "Your clock says four thirty." and which hand to fix (the long hand first, it carries the short one); 2nd: Luna turns the hands slowly to the answer |
| My day | Read or Set with her routine times from Parent Corner ("Time for bed!") | as above |

- Levels (adaptive engine, subskill `time-tell`, tier 2): o'clock, then o'clock and thirty. At the o'clock level every
  choice is an o'clock time (a "thirty" would give the answer away). Promotion is the app's usual rule.
- A round is six cards on a reef path of six stones; the trapped sea Squishy (Finn, Pinchy, Inky) waits at the end
  and is freed by the round. The first visit opens with "How a clock works" (the short hand, the long hand, a full
  turn moving the hour on), which stays on the menu.
- First-time demos and the 👆 button work as everywhere: on a Set card they point at the turn button that brings the
  clock closer, then at Done.
- Every spoken sentence is a Luna recording, whole or spliced ("Make the clock say" + "three thirty."); the test
  checks every time and prompt.

## Parent Corner

Level, first-try rate and mastery; her mistakes by kind (for example "reads the next hour at half past x3"); the
routine times (wake, school, lunch, dinner, bath, bed; kept on the device; times the current level cannot show wait
for later levels).

## Not in phase 1

Quarter past/to and five-minute times (grade 2), the exact minute and elapsed time (grade 3), a.m./p.m.

## Acceptance (measured)

- Unit tests: time maths, turning past the 12 both ways, wrong choices (distinct, never the answer, o'clock only at
  the o'clock level, the next-hour slip always offered at half past), generators, routine times, save cleaning and
  merging, voice coverage for every sentence.
- Headless Chromium at 360x640, 412x915, 800x1280, 915x412, 640x360: every mode completes with a real mouse drag on
  Set cards; no page scroll; nothing off screen; no errors; right and wrong paths (scaffold, reveal) both run.

## Review (10/25/2026)

Two review rounds (correctness, child learning, layout and touch, red team; every finding checked by a skeptic): 33
confirmed in the first, 9 in the second (0 rejected), all applied. The main ones:

- Touch: a finger out at the numbers always turns the long hand; turning the short hand changes only the hour; at
  the o'clock level letting go settles on o'clock; a resting thumb never moves the hands (a second touch drives only
  once it really moves).
- Teaching: every Read/Match card offers the next-hour slip and a long-hand mistake, so she reads both hands; Luna
  says what she picked, the one rule that fixes it, and lights that hand; Set hints are one step at a time (long
  hand, then the short hand by its number), so following them always reaches the time; right answers say the time
  back; the thirty level opens with its own short intro ("halfway between the three and the four").
- My day: each routine time once as Read and once as Set, ordinary cards fill the rest; no two cards share an id.
- Shared engine: a re-presented card is recognised by its queue entry (not its id or its word), so two cards with
  the same id, or one Wishing Well word in two activities, are each scored.
- Layout: Kindle Fire 7 and Fire HD landscape, Chromebook, four-choice cards, bigger Match clocks on tall phones.

Measured after the fixes: 155 unit tests; headless Chromium at 360x640, 412x915, 800x1280, 915x412, 640x360,
1024x600 and 1280x800, every mode with wrong answers on purpose: no scroll, nothing off screen, no errors, every
clip found, a Squishy freed each round, rounds of 60-80 s; touch checks (tap on a number, short-hand turn, resting
thumb); one round each in Wishing Well, Meadow, Falls, Caverns and Whisper Woods with reveals.
