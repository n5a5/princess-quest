# Star Stage: the show (plan, 10/25/2026)

Amelia (6, kindergarten, an early reader) was cast in Annie (Broadway at the J, show 2/21/2027) as **Kate**, one
of the orphans, and **Sandy**, the dog, in the same show. Star Stage switches from the audition trainer (audition
was 10/14/2026) to a show trainer. Source: the production's script (`Annie_script_combined.pdf`, 24 pages, kept in
the parent's Dropbox; the repo and site are public, so only her own parts and the cue before each are in the app,
as the parent chose on 10/25/2026).

## Her part

- **Kate, spoken:** "Annie, whatta ya doin'?" (Scene 1, straight after everyone sings the last "Maybe"; the app
  practices the two together).
- **Kate, sung (Hard-Knock Life):** with Tessie, "Don't it seem like there's never any light!"; with Molly, "No one
  cares if you grow or if you shrink!"
- **The orphans together, spoken:** the note ("So that when we come back for her you will know that she's our
  baby."), "Good luck, Annie. 'Bye, Annie!" (all except Pepper), "Yes, Miss Hannigan.", "Good morning, Miss
  Hannigan.", "I love you." (one at a time, as the stage direction says), "Mornin', Bundles!", "Annie ain't here.",
  a cheer (the script gives no words; the app uses "Hooray!" and says any cheer is fine), "Annie! Annie! Hi,
  Annie!", "Hooray!"
- **The orphans together, sung:** Maybe (the "Betcha they're young" verse, the last "Maybe"), Hard-Knock Life (every
  orphans / all part), You're Never Fully Dressed Without a Smile (the "all orphans" parts), Tomorrow (the
  finale reprise: the script names no singer; assumed to be everyone, to confirm with the director).
- **Sandy (Scene 2):** wanders on while Annie looks around; sings "Tomorrow! Tomorrow! I love ya, tomorrow! You're
  always a day away!" with Annie (twice; the script gives it to "Annie & Sandy"); waits while Annie stalls the
  officer and crosses to Annie only on "Here, Sandy. Here, boy."; stays with her ("Good Sandy. Good old Sandy").
  No other blocking is invented: the director gives it.

## What she practices (the menu after the audition date)

| Tile | Content | Flow |
|---|---|---|
| 🗣️ Kate | her 3 Kate lines | per line: the cue in that character's voice with the speaker's picture, then her turn; new: Luna models it and she echoes; from the 2nd practice: cue, she tries from memory, then Luna's model as feedback |
| 👭 Orphan lines | the 10 spoken group lines, in script order | the same cue-then-line flow, 5 lines a visit (alternating halves) |
| 🎵 Orphan songs | 17 sections of at most 4 pieces (Maybe 2, Hard-Knock Life 8, Smile 3, Tomorrow 4, one of them the Scene 2 Annie & Sandy chorus), least practiced first | a section still new gets the visit (from memory after its cue from the 2nd time, hear the words, echo in pieces with backward chaining, the acting cue, then the cue and all of it alone with fading pictures); learned sections go two or three a visit in a short form (cue, from memory, the words as the answer). Luna cannot sing: without the recording she says "Here are the words"; only the first chorus plays the cast recording |
| 🐶 Sandy | Scene 2 in order | Luna narrates; Annie's and the officer's cues in their voices; two moves (wander on; go to Annie only when she calls) as thumbs-up turns, a "stay" hold while Annie and the officer talk, and the two sung "Tomorrow" choruses (microphone) |
| ⭐ Run my lines | every spoken Kate and orphan line in script order | cues only, no models, the curtain on the pictures; her takes played back (the mock audition, for the show) |
| 🎧 Hear the orphans | the cast recording loaded on this device | unchanged |

Daily plan: Kate and the songs tile every day; orphan lines and Sandy on alternate days, with Run my lines in their
place every third day and every day in the last week (three tiles, about 8-10 minutes). The day strip shows a week
back and a week ahead, then the show. Soft parts (the Maybe verse, the whispered "Good luck, Annie") are praised for
soft and clear, never asked to be bigger. The map's countdown starts two weeks before the show.

Review (10/25/2026): script fidelity, child learning and engineering reviews; every confirmed finding is applied
above (cues that gave away the answer or repeat in the song, soft-part praise, picture collisions, Sandy's stay,
section sizes, one release for content, audio and code). Not done yet, worth doing: per-section ranges in the cast
recording (or the production's rehearsal tracks) so every song section is heard sung; a parent "knew it / needed
help" tap to thin out what she knows; a "rehearsing this week" setting.

## Content and audio

- `content/stage.json` gains `show`: `voices` (Kokoro voice per character, never Luna's), `kate`, `lines`, `songs`,
  `sandy`; each block `{ id, cue: { who, pic, text, say? }, chunks: [{ text, pic, say? }], sing, act, tip }`.
- `tools/build-stage-audio.py` renders each block's chunk ranges in Luna's voice (as now) and each cue as
  `<id>-cue.ogg` in the speaker's voice, all at -16.5 LUFS, with the tail-hiss trim.
- The audition material (Tessie's line, the slate, the other lines, the audition-day warm-up) leaves the menu; its
  code and clips are removed.

## Acceptance (measured)

- Tests: every clip referenced exists, nothing stale; cue voices are not Luna's; `dailyPlan` for show mode; the
  text a cue shows matches the script excerpt.
- Headless Chromium, fake microphone, 360x640, 412x915, 800x1280, 915x412, 640x360: every tile completes; no errors;
  no microphone left open; longest dead air <= 3 s; sessions <= 4 min; the words switch still shows words only
  while she listens.
- Reviews (correctness, child usability, red team) until clean; deploy only after the parent says so.
