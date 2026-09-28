// shared/adaptive.js — mastery estimates, stage progression, the daily planner, missed items.
// v3: subskill table rebuilt from Amelia's Sept 2026 i-Ready + Star profile (see
// docs/superpowers/specs/2026-09-11-assessment-driven-priorities.md). Per-skill Bayesian Knowledge
// Tracing (BKT step adapted from Phono StoryForge, Apache-2.0) with explicit outcome types.
// The daily quest is a two-stop trail: one reading stop and one math stop, each the place hosting the
// highest-priority weak skill, so every session touches both domains where the assessments dipped.
//
// Outcome types recorded per item:
//   firstTry    correct on the first attempt                  → full evidence of knowing
//   scaffolded  correct after the glow hint (second attempt)  → no evidence of knowing (the hint did the work)
//   revealed    answer shown after two misses                 → evidence of not knowing
//   abandoned   left the encounter mid-item                   → ignored for mastery, logged
// Items with fewer than 3 choices move the estimate very little (p_guess = 1/choices).
//
// Tier = priority from the assessments: 1 = documented weakness (both systems or a clear dip),
// 2 = secondary target, 3 = strength kept warm through play. Weights below.
import { localDay } from './economy.js';

export const SUBSKILLS = [
  // ---- reading: phonics (Unicorn Meadow) ----
  { id: 'phonics-gpc',       strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 1, name: 'Letter sounds',          stages: ['set1', 'set2', 'set3', 'set4', 'digraphs'] },
  { id: 'phonics-encode',    strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 1, name: 'Build words',            stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'phonics-decode',    strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 1, name: 'Read words',             stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'decodable-reading', strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 2, name: 'Read sentences',         stages: ['a', 'b', 'c', 'd'] },
  // ---- reading: phonological awareness, ears only (Whisper Woods) ----
  { id: 'pa-sounds',         strand: 'ELA.K.F.1.2', cabinet: 'woods',   tier: 1, name: 'Hear first, last, middle sounds', stages: ['first', 'final', 'medial'] },
  { id: 'pa-blend-segment',  strand: 'ELA.K.F.1.2', cabinet: 'woods',   tier: 1, name: 'Blend and count sounds', stages: ['short', 'long'] },
  { id: 'pa-manipulate',     strand: 'ELA.K.F.1.2', cabinet: 'woods',   tier: 1, name: 'Change and take away sounds', stages: ['swap', 'delete'] },
  { id: 'pa-rhyme',          strand: 'ELA.K.F.1.2', cabinet: 'woods',   tier: 1, name: 'Rhymes and syllables',   stages: ['rhyme', 'syllables', 'onset-rime'] },
  // ---- reading: high-frequency words (Wishing Well) ----
  { id: 'sight-words',       strand: 'ELA.K.F.1.4', cabinet: 'well',    tier: 1, name: 'Wish words',             stages: ['pre-primer', 'primer'] },
  // ---- math: number sense and operations (Crystal Caverns) ----
  { id: 'subitize-tenframe', strand: 'MA.K.NSO.1.1', cabinet: 'caverns', tier: 1, name: 'See how many',          stages: ['small', 'structured', 'make10'] },
  { id: 'number-relations',  strand: 'MA.K.NSO.1.2', cabinet: 'caverns', tier: 1, name: 'One more, count out, order', stages: ['onemore', 'countout', 'order', 'countout20'] },
  { id: 'teen-compare',      strand: 'MA.K.NSO.2.2', cabinet: 'caverns', tier: 1, name: 'Teens and compare',     stages: ['teens', 'compare', 'numberline'] },
  { id: 'add-sub',           strand: 'MA.K.NSO.3.1', cabinet: 'caverns', tier: 1, name: 'Add and take away',     stages: ['within5', 'within10', 'related'] },
  { id: 'decompose-stories', strand: 'MA.K.AR.1.2', cabinet: 'caverns', tier: 1, name: 'Number stories',        stages: ['bonds', 'decompose', 'problems', 'truefalse', 'match'] },
  { id: 'count-sequence',    strand: 'MA.K.NSO.2.1', cabinet: 'caverns', tier: 2, name: 'Counting on',           stages: ['ones', 'tens', 'backward'] },
  // ---- math: measurement, data, patterns, shapes (Rainbow Falls) ----
  { id: 'measure',           strand: 'MA.K.M.1.2',  cabinet: 'falls',   tier: 1, name: 'Measuring',             stages: ['attribute', 'compare', 'order', 'units'] },
  { id: 'data-sort',         strand: 'MA.K.DP.1.1', cabinet: 'falls',   tier: 1, name: 'Sorting and data',      stages: ['two', 'three', 'chart'] },
  { id: 'patterns',          strand: 'MA.K.AR.1.2', cabinet: 'falls',   tier: 2, name: 'Patterns',              stages: ['ab', 'abb', 'abc', 'fix'] },
  { id: 'shapes',            strand: 'MA.K.GR.1.1', cabinet: 'falls',   tier: 3, name: 'Shapes',                stages: ['2d', '3d', 'compose'] },
  // ---- strengths kept warm (Story Castle) ----
  { id: 'comprehension',     strand: 'ELA.K.R.1.1', cabinet: 'castle',  tier: 3, name: 'Understanding stories', stages: ['literary', 'informational', 'poems'] }
];

// Cabinet groups for the two-stop quest trail. The castle is free play (strength), never a planned stop
// unless nothing else is available.
export const GROUPS = { reading: ['meadow', 'woods', 'well'], math: ['caverns', 'falls'] };

// pTransit was 0.15: with half credit for hinted answers that promoted a child who never answered unaided.
export const BKT = { pInit: 0.25, pTransit: 0.05, pSlip: 0.10 };
// recent: of the last `of` scored items at this stage, at least `need` must be unaided first tries.
export const PROMOTE = { minP: 0.85, minFirstTry: 6, minDays: 2, recent: { need: 7, of: 8 } };
export const RETEACH_P = 0.4;
export const FOCUS_DAYS = 7;
export const FOCUS_BOOST = 1.6; // planner weight for the skills a parent focus touches
export const QUEST_GEMS = 10;
const TIER_WEIGHT = { 1: 3, 2: 1.6, 3: 0.7 };

// Plain-language level for the parent corner. Never shown to the child.
export function levelOf(p, stageIndex, stageCount) {
  if (p >= PROMOTE.minP && stageIndex >= stageCount - 1) return 'mastered';
  if (p >= PROMOTE.minP) return 'known';
  if (p >= RETEACH_P) return 'learning';
  return 'emerging';
}

export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5);
}

// One BKT update. `correct` may be 1, 0.5 (scaffolded) or 0. pGuess depends on the number of choices.
export function bktStep(p, correct, pGuess) {
  const { pTransit, pSlip } = BKT;
  const pRightGivenKnown = 1 - pSlip;
  const pRightGivenUnknown = pGuess;
  // Blend the two likelihoods for fractional evidence.
  const likeKnown = correct * pRightGivenKnown + (1 - correct) * (1 - pRightGivenKnown);
  const likeUnknown = correct * pRightGivenUnknown + (1 - correct) * (1 - pRightGivenUnknown);
  const posterior = (p * likeKnown) / (p * likeKnown + (1 - p) * likeUnknown || 1e-9);
  return posterior + (1 - posterior) * pTransit;
}

export function createAdaptive({ economy }) {
  const save = () => economy.save;
  function def(id) {
    const d = SUBSKILLS.find(s => s.id === id);
    if (!d) throw new Error('Unknown subskill ' + id);
    return d;
  }
  function entry(id) {
    const d = def(id);
    const s = save();
    if (!s.subskills[id]) s.subskills[id] = { stage: 0, p: BKT.pInit, firstTryDays: {}, lastPracticed: null, promotions: 0, gpc: {} };
    const e = s.subskills[id];
    if (e.p === undefined) { e.p = BKT.pInit; e.firstTryDays = {}; e.gpc = {}; delete e.window; }
    if (e.stage > d.stages.length - 1) e.stage = d.stages.length - 1; // a stage list may shrink between versions
    return e;
  }
  // Quest history entries: v3 { date, stops: [{ cabinet, subskill }] }; older { date, cabinet, subskill }.
  const historyStops = () => save().questHistory.map(q => q.stops ? q.stops : [{ cabinet: q.cabinet, subskill: q.subskill }]);

  const api = {
    defs: () => SUBSKILLS,
    tier1Ids: () => SUBSKILLS.filter(s => s.tier === 1).map(s => s.id),
    stage: id => def(id).stages[entry(id).stage],
    stageIndex: id => entry(id).stage,
    mastery: id => entry(id).p,
    level: id => levelOf(entry(id).p, entry(id).stage, def(id).stages.length),
    gpcMastery(id, gpc) { const e = entry(id); return (e.gpc[gpc] && e.gpc[gpc].p) ?? BKT.pInit; },

    // Records one item. Returns { promoted, reteach }.
    record({ subskill, outcome, choices = 3, review = false, retry = false, itemId = null, gpc = null, fam = null }) {
      const e = entry(subskill);
      const day = economy.today();
      const ok = outcome === 'firstTry';
      e.lastPracticed = day;
      economy.logResult({ subskill, ok, firstTry: ok, outcome, review: review || retry || choices < 2, stage: e.stage, choices, fam });
      if (outcome === 'revealed' && itemId) api.noteMiss(itemId);
      const result = { promoted: false, reteach: false };
      if (outcome === 'abandoned') { economy.persist(); return result; }
      // An introduction or a self-check has one "choice": it is exposure, not evidence. Log it, do not score it.
      if (choices < 2) { economy.persist(); return result; }
      // A retry comes straight after the answer was shown: getting it right then says nothing new.
      if (retry) { economy.persist(); return result; }
      const evidence = outcome === 'firstTry' ? 1 : 0;
      // children also guess by elimination, so a lucky guess is a little likelier than 1 in `choices`
      const pGuess = Math.min(0.6, 1 / Math.max(2, choices) + 0.1);
      e.p = bktStep(e.p, evidence, pGuess);
      if (gpc) {
        const g = e.gpc[gpc] || (e.gpc[gpc] = { p: BKT.pInit, n: 0 });
        g.p = bktStep(g.p, evidence, pGuess); g.n++;
      }
      if (ok && !review) e.firstTryDays[day] = (e.firstTryDays[day] || 0) + 1;
      const firstTries = Object.values(e.firstTryDays).reduce((a, b) => a + b, 0);
      const days = Object.keys(e.firstTryDays).length;
      const maxStage = def(subskill).stages.length - 1;
      // two-choice items (the controller's easy mode) are half guessable: they never count toward promotion
      const lately = save().log.filter(r => r.subskill === subskill && r.stage === e.stage && !r.review && r.choices >= 3).slice(-PROMOTE.recent.of);
      const recentOk = lately.length >= PROMOTE.recent.of && lately.filter(r => r.ok).length >= PROMOTE.recent.need;
      if (e.p >= PROMOTE.minP && recentOk && firstTries >= PROMOTE.minFirstTry && days >= PROMOTE.minDays && e.stage < maxStage) {
        e.stage++; e.promotions++; e.firstTryDays = {}; e.p = 0.5; e.gpc = {};
        result.promoted = true;
      }
      if (e.p < RETEACH_P) result.reteach = true;
      economy.persist();
      return result;
    },

    // Success-rate controller (after GraphoGame): keep first-try success near 80% by changing how many
    // choices an item offers. Struggling (under 60% on the last 8 real items) → one fewer look-alike;
    // cruising (90%+ on 6 or more) → one more. The count is logged with each item so evidence stays honest.
    choiceCount(id, base = 3) {
      def(id);
      const rows = save().log.filter(r => r.subskill === id && !r.review).slice(-8);
      if (rows.length < 4) return base;
      const rate = rows.filter(r => r.ok).length / rows.length;
      if (rate < 0.6) return Math.max(2, base - 1);
      if (rate >= 0.9 && rows.length >= 6) return base + 1;
      return base;
    },
    accuracy(id, n = 20) {
      const rows = save().log.filter(r => r.subskill === id && !(r.choices < 2)).slice(-n);
      if (!rows.length) return null;
      return rows.filter(r => r.ok).length / rows.length;
    },
    // Trend over 14 days: first-try rate of the last 7 days minus the 7 before. null when too little data.
    trend(id) {
      const today = economy.today();
      const rows = save().log.filter(r => r.subskill === id && !(r.choices < 2) && diffDays(r.day, today) < 14);
      const recent = rows.filter(r => diffDays(r.day, today) < 7), earlier = rows.filter(r => diffDays(r.day, today) >= 7);
      if (recent.length < 5 || earlier.length < 5) return null;
      const rate = xs => xs.filter(r => r.ok).length / xs.length;
      return rate(recent) - rate(earlier);
    },
    daysSince(id) {
      const e = save().subskills[id];
      if (!e || !e.lastPracticed) return null;
      return diffDays(e.lastPracticed, economy.today());
    },
    itemsOnDay(id, day) { return save().log.filter(r => r.subskill === id && r.day === day).length; },
    needsReteach: id => entry(id).p < RETEACH_P && !!entry(id).lastPracticed,
    // The parent's "focus this week" (Parent Corner): { sound, words, until } while it is still running, else null.
    focus() {
      const f = save().settings.focus;
      if (!f || !f.until || f.until < economy.today()) return null;
      if (!f.sound && !(f.words || []).length) return null;
      return { sound: f.sound || null, words: f.words || [], until: f.until };
    },
    setFocus({ sound = null, words = [] } = {}) {
      const [y, m, d] = economy.today().split('-').map(Number);
      const until = localDay(new Date(y, m - 1, d + FOCUS_DAYS));
      save().settings.focus = sound || words.length ? { sound, words, until } : null;
      economy.persist();
      return save().settings.focus;
    },
    clearFocus() { save().settings.focus = null; economy.persist(); },

    noteMiss(itemId) {
      const s = save();
      s.missed[itemId] = (s.missed[itemId] || 0) + 1;
      return s.missed[itemId];
    },
    troubleList(min = 3) {
      return Object.entries(save().missed)
        .filter(([, c]) => c >= min)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count);
    },

    // Planner score: priority × weakness × recency × variety. Higher = pick first.
    // Variety: a skill that was the planned target the last two days is halved, so one weak skill
    // never gets hammered every day.
    skillScore(id) {
      const d = def(id);
      const e = entry(id);
      const ds = api.daysSince(id);
      const recency = ds === null ? 1.5 : 1 + Math.min(0.6, ds * 0.15);
      const recent = historyStops().slice(-2);
      const targeted = recent.length === 2 && recent.every(stops => stops.some(st => st.subskill === id));
      const variety = targeted ? 0.5 : 1;
      const f = api.focus();
      const focused = f && ((f.sound && (id === 'phonics-gpc' || id === 'pa-sounds')) || (f.words.length && id === 'sight-words'));
      return TIER_WEIGHT[d.tier] * (1 - e.p) * recency * variety * (focused ? FOCUS_BOOST : 1);
    },
    // Best stop inside a set of cabinets: the place hosting the highest-scoring skill, avoiding a
    // cabinet that was the stop for this group the last two days. Returns { cabinet, subskill, score }.
    pickStop(cabinets, { exclude = null } = {}) {
      const scored = SUBSKILLS.filter(x => cabinets.includes(x.cabinet) && x.tier <= 2)
        .map(x => ({ cabinet: x.cabinet, subskill: x.id, score: api.skillScore(x.id) }))
        .sort((a, b) => b.score - a.score);
      return scored.find(x => x.cabinet !== exclude) || scored[0] || null;
    },
    // Kept for callers that want one place: the best stop across every available cabinet.
    pickQuestCabinet(availableCabinets = null) {
      const avail = availableCabinets || SUBSKILLS.map(s => s.cabinet);
      const stop = api.pickStop(avail) || api.pickStop(avail.length ? avail : ['meadow']);
      if (stop) return stop;
      const fallback = avail[0] || 'meadow';
      return { cabinet: fallback, subskill: null, score: 0 };
    },
    // The day's trail: one reading stop, one math stop (each the weakest, stalest priority skill's place).
    planStops(availableCabinets = null) {
      const avail = availableCabinets || [...GROUPS.reading, ...GROUPS.math, 'castle'];
      const recent = historyStops().slice(-2);
      const stops = [];
      for (const key of ['reading', 'math']) {
        const cabs = GROUPS[key].filter(c => avail.includes(c));
        if (!cabs.length) continue;
        const lastTwo = recent.map(stops => stops.find(st => cabs.includes(st.cabinet))).filter(Boolean).map(st => st.cabinet);
        const exclude = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null;
        const stop = api.pickStop(cabs, { exclude });
        if (stop) stops.push({ cabinet: stop.cabinet, subskill: stop.subskill, done: false });
      }
      if (!stops.length) {
        const c = avail[0] || 'meadow';
        const stop = api.pickStop([c]);
        stops.push({ cabinet: c, subskill: stop ? stop.subskill : null, done: false });
      }
      return stops;
    },
    // Review picks: skills in this cabinet already mastered at their last stage (nothing left to promote),
    // never today's target, least recently practised first. Marking a skill still being taught as review
    // would stop its first tries counting toward promotion.
    reviewSkills(cabinet, n = 2) {
      const target = api.targetFor(cabinet);
      return SUBSKILLS.filter(s => s.cabinet === cabinet && s.id !== target && entry(s.id).p >= PROMOTE.minP && entry(s.id).stage >= s.stages.length - 1)
        .sort((a, b) => (api.daysSince(b.id) ?? 99) - (api.daysSince(a.id) ?? 99))
        .slice(0, n).map(s => s.id);
    },

    todayQuest(availableCabinets = null) {
      const s = save();
      const day = economy.today();
      if (!s.quest || s.quest.date !== day || !Array.isArray(s.quest.stops)) {
        const stops = api.planStops(availableCabinets);
        s.quest = { date: day, stops, extraRounds: 0, claimed: false };
        s.questHistory.push({ date: day, stops: stops.map(st => ({ cabinet: st.cabinet, subskill: st.subskill })) });
        s.questHistory = s.questHistory.slice(-14);
        economy.persist();
      }
      return s.quest;
    },
    // The planned target skill for a place today (null when the place is free play).
    targetFor(cabinetId) {
      const q = api.todayQuest();
      const st = q.stops.find(x => x.cabinet === cabinetId);
      return st ? st.subskill : null;
    },
    nextStop() { return api.todayQuest().stops.find(st => !st.done) || null; },
    noteRoundFinished(cabinetId) {
      const q = api.todayQuest();
      const st = q.stops.find(x => x.cabinet === cabinetId && !x.done);
      if (st) st.done = true; else q.extraRounds = (q.extraRounds || 0) + 1;
      economy.markPlayedToday();
      economy.persist();
      return q;
    },
    questDone() { return api.todayQuest().stops.every(st => st.done); },
    claimQuest() {
      const q = api.todayQuest();
      if (q.claimed || !api.questDone()) return false;
      q.claimed = true;
      economy.addGems(QUEST_GEMS);
      economy.markPlayedToday();
      return true;
    }
  };
  return api;
}
