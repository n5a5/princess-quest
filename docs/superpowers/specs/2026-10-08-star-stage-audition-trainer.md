# Star Stage: the audition trainer (plan, 10/8/2026)

Goal: Amelia (6, kindergarten, not reading) can say line #7 and sing the Hard-Knock Life chorus from memory,
loudly, with the tune, and walks into the Broadway at the J audition on Wed 10/14/2026 confident; she practises
alone about ten minutes a day; a parent can see and hear progress. Evidence behind each design choice is cited in
`games/princess-quest/stage.js` and `shared/stage-plan.js` (verified citations only).

## What changes

| # | Change | Why |
|---|---|---|
| 1 | Daily plan to the audition (`dailyPlan`): days 4+ out: hear the song (until heard), line, song; days 3-1: line, song, mock audition; audition day: a short warm-up only; after: free practice. The menu glows the next planned activity and Luna says it. | Distributed practice; one obvious next action |
| 2 | Cue fading by practice count (`cueLevel`): 1st practice pictures throughout; 2nd: try it from memory first (pictures shown), solo with faded pictures; 3rd+: from memory first behind the curtain, solo behind the curtain | Prompt fading; retrieval practice before re-study |
| 3 | Brave breath (two slow breaths, spoken) before the mock audition and in the audition-day warm-up | Brief paced breathing before performing |
| 4 | Acting cue shown as a picture with the spoken tip | One concrete acting cue per piece |
| 5 | Try another line: the other seven lines from the sheet, heard and echoed chunk by chunk, then whole (no memorising) | The sheet says she may be asked to try another |
| 6 | Audition-day warm-up: stage voice, brave breath, line once, song once, pep talk (about 3 min) | Warm-up only on the day |
| 7 | No silence over 3 s: during her turn a visual and soft-chime nudge at 3.5 s with no voice (the gate ignores the chime); on menus and finish sheets Luna re-prompts after 8 s idle | Never stuck |
| 8 | Muted app: a big unmute button on entering Star Stage | Degrades gracefully |
| 9 | Landscape layout: compact head, pictures and microphone side by side | Fits every orientation |
| 10 | Debug event log (`window.__pqStage`) for measuring session length and dead air in tests | Evidence for the definition of done |
| 11 | All story-voice lines re-rendered at -16.5 LUFS with the look-ahead limiter | One loudness for every Luna line |

## Acceptance criteria (measured, not assumed)

- `node --test tests/*.test.js` passes; new unit tests for `dailyPlan`, `cueLevel`, the gate's nudge and ignore window.
- Headless Chromium with fake-microphone files (speech, silence, constant noise, very quiet, very loud) at 360x640,
  412x915, 800x1280 and 915x412: every activity completes with zero console errors other than the sandbox's blocked
  network; Back and Home at every step return to a working menu.
- Longest dead air (no voice, no song, not her turn, no button waiting with a re-prompt) <= 3.0 s per activity.
- Session length: My Line <= 3 min, My Song <= 4 min, mock audition <= 2.5 min, audition-day warm-up <= 3.5 min.
- Loudness: Star Stage clips and story-voice lines within 1 dB of each other (integrated LUFS), true peak <= -1 dBTP.
- After every activity and every Back: no live microphone track, no open microphone AudioContext.
- Three independent reviews (correctness, usability for a pre-reader from screenshots, red team) with every
  confirmed finding fixed or explicitly accepted, re-run until clean.

## Not verifiable here

The real device (its microphone levels, speaker volume, audio routing while recording), the real child, and the
chorus times inside the cast recording (found by analysis; Parent Corner lets a grown-up check them).
