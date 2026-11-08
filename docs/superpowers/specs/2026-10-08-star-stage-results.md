# Star Stage: results of the review rounds (10/8/2026)

Plan and acceptance criteria: `2026-10-08-star-stage-audition-trainer.md`. This file records what was measured,
what was only analysed, and what cannot be checked here.

## Review rounds

1. **First round.** Three independent reviews ran at commit 5790cbd: correctness, usability for a pre-reader from
   screenshots, and a red team in headless Chromium with fake microphones. They produced 39 findings, 29 after
   duplicates were merged. All 29 were fixed in 1249b11–939d186.
2. **Second round.** The same three reviews ran again at 939d186. Each re-checked the 29 findings and looked for
   new ones.
   - All but a few earlier findings were confirmed fixed. The partial ones were fixed in the same round.
   - The correctness and usability reviewers found 17 new findings. A skeptic tried to refute 13 of the medium or
     high ones, and all 13 were confirmed.
   - The red team found 7 more. These were checked by re-running the red team's own scripts before and after
     each fix.
   - Every finding was fixed, in e7f8953–bb78ec1 (see the commit messages). Among them:
     - a knock near the microphone could count as her turn;
     - no-microphone turns were too quiet;
     - a dead microphone repeated its failures in every activity;
     - a double tap on "Yay!" started an activity;
     - a damaged recording earned listening credit.
3. **Third round.** A correctness review and a red team ran on the changes since the second round
   (939d186..bb78ec1). Their findings were fixed in 5240f60 and 6144e75; a skeptic confirmed the high one:
   - a quiet "Thank you!" / "Hey there." was no longer heard (high);
   - a knock split across two analyser readings was praised as her voice (high);
   - double taps on the Hear tile or the PIN pad's Cancel landed on what appeared under her finger;
   - the menu stayed quiet after the PIN pad when the app had been in the background;
   - the warm-up's star bar;
   - a slow microphone's repeated line;
   - the map's countdown after she had practiced.
4. **Re-checks.** After each round, fixes were re-checked in the browser with the same scripted attacks the
   reviewers used, plus new ones.

## Measured (headless Chromium, fake microphone, build 6144e75)

Every activity, at 360x640, 412x915, 800x1280 and 915x412:

| Activity | 360x640 | 412x915 | 800x1280 | 915x412 | Longest silence |
|---|---|---|---|---|---|
| My Line (1st practice) | 95 s | 95 s | 94 s | 95 s | 0.4 s |
| My Line (3rd practice) | 81 s | 81 s | 81 s | 81 s | 0.4 s |
| My Song (1st, with the recording) | 157 s | 158 s | 158 s | 158 s | 0.4 s |
| My Song (4th) | 128 s | 128 s | 128 s | 128 s | 0.4 s |
| Hear the orphans (12 s, then ✅) | 12 s | 12 s | 12 s | 12 s | 0.0 s |
| Audition time! | 84 s | 84 s | 84 s | 84 s | 2.1 s |
| Try another line | 112 s | 113 s | 113 s | 113 s | 0.4 s |
| Audition day warm-up | 72 s | 73 s | 73 s | 73 s | 2.1 s |

Session lengths are within the plan's limits: My Line ≤ 3 min, My Song ≤ 4 min, mock audition ≤ 2.5 min, warm-up ≤ 3.5 min.

- **Longest silence.** "Dead air" means nothing playing, not her turn, and no button waiting with a spoken
  re-prompt. Its maximum is 2.1 s, during the brave breath (the quiet breathing after "Smell the flower" /
  "Blow out the candle"). Everywhere else it is 0.4 s or less.
- **Leaks.** After every activity and after Back, there are no live microphone tracks and no open microphone
  AudioContexts. The wake lock is released.
- **Errors.** Zero console errors, page errors or failed app requests.
- **Back.** It returns to a working menu.

Microphone and edge cases (scripted, 412x915 unless noted):

| Case | Result |
|---|---|
| Quiet child (speech 24 dB down) | Heard on every turn ("Good! Now even bigger!"); the microphone is kept. Before the fixes it was dropped within a minute. |
| Loud TV with no voice (steady −25 dB) | Not taken for her voice. She is coached ("say it nice and loud"), the microphone is kept, and the practice finishes in 2.5 min. |
| Speech in noise | Heard on every turn |
| Knock near the microphone (impact with room echo, incl. one split across two readings) | Never counted as her turn or praised; the take keeps listening for her. Exception: a knock loud enough to clip the input, at some window phases. |
| Soft short phrases ("Thank you!", "Hey there.", "Yes!" at −41 dB) | Heard, as they were before the knock rules |
| Double tap on Hear tile / PIN pad Cancel / "Yay!" | The second tap is ignored; a deliberate tap 0.6 s later works |
| Silent child (room noise only) | The microphone is kept; she gets two tries per step, then "That's okay. Let's keep going."; done in 2 min |
| Dead microphone (digital silence) | Set aside after two takes, with one "keep going" line, then thumbs-up turns. The next activity skips the warm-up and sets it aside after one take. |
| Double tap on "Yay!" | The second tap does not start an activity |
| Damaged recording (jumps to its end) | "The song stopped early. Ask a grown-up…"; no listening credit |
| Permission question never answered | "Ask a grown-up to tap Allow" is said at 0.4 s and every ~4 s, then at 10 s "Let's keep going without the microphone." The longest silence is 1.4 s (it was 10 s). |
| Allowed but slow microphone (3.5 s to open) | It waits quietly for 2.5 s, then says "Ask a grown-up to turn on the microphone." Never "tap Allow", and never cut off. |
| No microphone device | "Ask a grown-up to turn on the microphone." Thumbs-up turns follow, with the button in the panel, on screen at every size. |
| Her "yay!" during the room reading | Only the first warm-up try is missed; the retry and every later turn and activity are heard. Before the fixes she was deaf for the whole visit. |
| Mute mid-activity | No new microphone, no credit, and the sound-on screen within 0.3 s |
| Home mid-activity | Nothing is said in the background; on return Luna says what is next |
| Hear the orphans: 50 s, then the music note, then ✅ / Back / stop | Counted as heard |
| Back while her take plays back | The practice still counts |
| Corrupt song file | The Hear tile is greyed; My Song uses Luna's chant |
| Short song file | No "just my part" button |
| Gear (PIN pad) mid-activity, then phone Back | The activity stops, the pad is spoken, and Back returns to the Star Stage menu |
| Glowing tile and thumbs-up position | On screen with no scrolling at 360x640, 412x915, 800x1280, 915x412 and 640x360, including audition day |

Loudness, every story-voice clip (1,148 lines) and Star Stage model clip (59), measured on the encoded files with
EBU R128 (short clips looped to 3 s):

- Median −16.51 LUFS, range −16.69 to −16.36: a spread of 0.33 dB.
- Highest true peak −1.0 dBTP.

Tests: `node --test tests/*.test.js` passes (136 tests). These rounds added tests for:

- the voice gate: a soft voice, the bump, a soft syllable that keeps the take open, a knock with a room echo
  (including half caught), and short words with a hard start
- the room floor and the room level learned from each take
- digital silence
- the song player's second-play race (against a stand-in audio element)
- Luna's horn glow
- the map countdown lines, and that each has a clip

## Analysed, not measured

- **Chorus timing.** The chorus inside the cast recording (10.8–27.0 s of the 3:41.9 "Full Clip") was found by
  analysis, not by ear. The pictures follow it in proportion to the letters, as they do for Luna's clips. Parent
  Corner's "Play my part" and ±½ s buttons let a grown-up check and correct it.
- **No-microphone turns.** The pictures light one by one at the pace of Luna's model (or of the chorus, when she
  sings with the recording), with a soft chime at 3 s. When she should be done, Luna says "Tap the thumbs up when
  you finish.", and 4 s later it moves on. The quiet stretches are her own performance time; they were measured
  at 9–13 s per turn for My Line, without a tap.
- **Real-device thresholds.** The big-voice bar (−30 dBFS) and the dead-microphone rule (below −90 dBFS) are
  sensible for raw phone microphones, but they were not measured on her device.

## Not verifiable here

- Her device: microphone sensitivity, speaker volume, audio routing while recording, permission behaviour, and
  how long the microphone takes to open.
- The real child: attention, how loud she is, and whether the pictures mean to her what they are meant to.
- The cast recording on her device, which a parent loads; it is never committed (the repo and site are public).
- The service worker update on a real device. Its code path is covered by review; the tests run with `?nosw=1`.

## 5-minute parent checklist (once, on the device she uses)

1. **Update (30 s).** Open the app. The splash shows "Version 4.7.0"; if it shows an older number, reload once.
2. **Microphone (1 min).** Gear ⚙️ → PIN → Parent Corner → Star Stage → "🎤 Test the microphone". Tap Allow when
   the browser asks, then shout "Hello, everybody!". This grants the permission, so she never meets the browser's
   text question alone.
3. **Song (1.5 min).** In the same section tap "Load the song" and pick the "It's the Hard Knock Life" Full Clip
   MP3. Tap "▶ Play my part": it should start at "It's the hard-knock life for us" and end after "It's the
   hard-knock life!". If not, use Start/End −½ s / +½ s.
4. **One practice together (2 min).** Map → Star Stage → the glowing tile. On her turn, check the ding and the red
   microphone. The star lights when she is loud, and "Listen to you!" plays her back. Then, in Parent Corner →
   Star Stage → Takes, "Line, practice" plays her take at its true loudness.
5. **Device.** Media volume around 70 %, the mute switch off, and the device charged (the screen stays awake
   during an activity).

On audition day, 10/14/2026, do "Audition day warm-up" (about 1.5 min, with three brave breaths) in the car or
the hallway.
