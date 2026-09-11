# Princess Quest — priorities rebuilt from Amelia's September 2026 assessments

## 1. What the assessments say

Amelia sits at the 91st–94th percentile overall in both reading and math. The problem is unevenness, not
ability. Two independent systems (i-Ready Inform 1, Renaissance Star) agree on where the dips are.

| Area | i-Ready (Aug 2026) | Star (Aug/Sep 2026) | Read |
|---|---|---|---|
| Phonics / word analysis | Emerging K (below) | 70 developing | **weak, both agree** |
| High-frequency words | Emerging K (below) | — | **weak** |
| Phonological awareness | Early/Mid K | 69 developing | **weak** |
| Print concepts, fluency | — | 86, 83 secure | strong |
| Comprehension (lit / info) | Mid/Late K | 82, 82 secure (prose & poetry 56) | strong, keep warm |
| Vocabulary | Mid/Late K | 61 developing | mixed, light touch |
| Number sense | Early K | 59 beginning | **weak** |
| Number operations | Early K | 57 beginning | **weak** |
| Algebraic thinking | Mid K | 50 beginning | weak on Star only |
| Measurement & data | Emerging K (below) | 66 developing | **weak, both agree** |
| Counting & cardinality | — | 78 developing | fine |
| Geometry | Mid K | 67 developing | fine |

Star strand scores are model estimates tied to one overall score, and i-Ready K placements rest on few items,
so the app treats them as a hypothesis its own practice data confirms or corrects.

## 2. What that means for the app

Build the highest-value ten minutes for this child, not a general kindergarten app.

Reading order of emphasis: phonics → phonological awareness → high-frequency words → connected decodable reading.
Math order: number sense → number operations → measurement/data → patterns and algebraic thinking.
Strengths (comprehension, vocabulary, geometry, counting) stay as reward and transfer activities, never the
bulk of a session.

## 3. Gaps found in the current build

1. **No letter-sound stage.** Phonics started at CVC building. "Emerging K" phonics means letter-sound
   correspondence itself needs practice. → new `phonics-gpc` subskill and Letter Sounds family.
2. **No connected reading.** Words never appeared in sentences. → decodable sentence content and the
   Spell Scroll family (read a sentence, pick its picture); heart words found inside sentences at the Well.
3. **PA and phonics were the same place** and PA choices showed the printed word under each picture.
   → PA moves to its own place, Whisper Woods, where nothing shows letters: pictures only, sound tokens
   render as ear buttons. Adds rhyme, syllables, onset-rime, and sound deletion, which were missing.
4. **Number sense had no one-more / one-less, no count-out, no ordering.** → `number-relations` subskill
   and the Gem Trail family.
5. **Number operations never asked her to match a picture to its number sentence.** → `match` stage.
6. **Measurement compared emoji by world knowledge** (rock vs feather). → a real balance scale, jars with
   fill levels, and Squishy towers for height; data charts now ask how many and how many more.
7. **No patterns anywhere.** → `patterns` subskill and Rainbow Path at the Falls (light, tier 2).
8. **Daily quest was one planned stop plus a free choice**, so a session could be all reading or all math.
   → the quest is now a two-stop trail: one reading stop and one math stop, each chosen by the planner,
   then free play.
9. **Parent corner mixed formal results with app data.** → separate sections, plain-language levels
   (Emerging / Learning / Known / Mastered), weakest and strongest lists.

## 4. Adaptive engine

Per-skill Bayesian Knowledge Tracing stays. Priority weights: tier 1 = 3, tier 2 = 1.6, tier 3 = 0.7.
Planner score = weight × (1 − mastery) × recency × variety, per cabinet group. Variety avoids the same
place or the same target skill three days running. Nothing demotes; stages promote at 85% mastery with six
first-try items on two different days, so she keeps moving up when she shows mastery.

## 5. Session shape (about 10 minutes)

Map → Luna waits at reading stop → round of 6 → Luna moves to math stop → round of 6 → chest (10 gems)
→ free play anywhere → "One more, or all done?" at ten active minutes → three breaths with Luna.
