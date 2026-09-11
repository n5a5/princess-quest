// shared/adaptive.js — mastery estimates, stage progression, the daily planner, missed items.
// v2: per-skill Bayesian Knowledge Tracing (BKT step adapted from Phono StoryForge, Apache-2.0)
// with explicit outcome types, instead of a single 8-of-10 window. DOM-free; uses an economy instance.
//
// Outcome types recorded per item:
//   firstTry    correct on the first attempt                  → full evidence of knowing
//   scaffolded  correct after the glow hint (second attempt)  → half evidence
//   revealed    answer shown after two misses                 → evidence of not knowing
//   abandoned   left the encounter mid-item                   → ignored for mastery, logged
// Items with fewer than 3 choices move the estimate very little (p_guess = 1/choices).
export const SUBSKILLS = [
  { id: 'phonics-encode',    strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 1, name: 'Phonics: build words',  stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'phonics-decode',    strand: 'ELA.K.F.1.3', cabinet: 'meadow',  tier: 1, name: 'Phonics: read words',   stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'pa-sounds',         strand: 'ELA.K.F.1.2', cabinet: 'meadow',  tier: 1, name: 'Hearing sounds',        stages: ['first', 'final', 'medial'] },
  { id: 'pa-blend-segment',  strand: 'ELA.K.F.1.2', cabinet: 'meadow',  tier: 1, name: 'Blend and segment',     stages: ['short', 'long'] },
  { id: 'pa-manipulate',     strand: 'ELA.K.F.1.2', cabinet: 'meadow',  tier: 1, name: 'Change sounds',         stages: ['swap', 'delete'] },
  { id: 'sight-words',       strand: 'ELA.K.F.1.4', cabinet: 'well',    tier: 1, name: 'Heart words',           stages: ['pre-primer', 'primer'] },
  { id: 'subitize-tenframe', strand: 'MA.K.NSO.1.1', cabinet: 'caverns', tier: 1, name: 'See how many',          stages: ['small', 'structured', 'make10'] },
  { id: 'teen-compare',      strand: 'MA.K.NSO.2.2', cabinet: 'caverns', tier: 1, name: 'Teens and compare',     stages: ['teens', 'compare', 'numberline'] },
  { id: 'add-sub',           strand: 'MA.K.NSO.3.1', cabinet: 'caverns', tier: 1, name: 'Add and subtract',      stages: ['within5', 'within10', 'related'] },
  { id: 'count-sequence',    strand: 'MA.K.NSO.2.1', cabinet: 'caverns', tier: 2, name: 'Counting on',           stages: ['ones', 'tens', 'backward'] },
  { id: 'decompose-stories', strand: 'MA.K.AR.1.2', cabinet: 'caverns', tier: 2, name: 'Number stories',        stages: ['bonds', 'decompose', 'problems', 'truefalse'] },
  { id: 'measure',           strand: 'MA.K.M.1.2',  cabinet: 'falls',   tier: 1, name: 'Measuring',             stages: ['attribute', 'compare', 'order', 'units'] },
  { id: 'data-sort',         strand: 'MA.K.DP.1.1', cabinet: 'falls',   tier: 1, name: 'Sorting and data',      stages: ['two', 'three', 'chart'] },
  { id: 'shapes',            strand: 'MA.K.GR.1.1', cabinet: 'falls',   tier: 2, name: 'Shapes',                stages: ['2d', '3d', 'compose'] },
  { id: 'comprehension',     strand: 'ELA.K.R.1.1', cabinet: 'castle',  tier: 3, name: 'Understanding stories', stages: ['literary', 'informational', 'poems'] }
];

export const BKT = { pInit: 0.25, pTransit: 0.15, pSlip: 0.10 };
export const PROMOTE = { minP: 0.85, minFirstTry: 6, minDays: 2 };
export const RETEACH_P = 0.4;
export const QUEST_GEMS = 10;
const TIER_WEIGHT = { 1: 3, 2: 2, 3: 1 };

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
    def(id);
    const s = save();
    if (!s.subskills[id]) s.subskills[id] = { stage: 0, p: BKT.pInit, firstTryDays: {}, lastPracticed: null, promotions: 0, gpc: {} };
    const e = s.subskills[id];
    if (e.p === undefined) { e.p = BKT.pInit; e.firstTryDays = {}; e.gpc = {}; delete e.window; }
    return e;
  }

  const api = {
    defs: () => SUBSKILLS,
    tier1Ids: () => SUBSKILLS.filter(s => s.tier === 1).map(s => s.id),
    stage: id => def(id).stages[entry(id).stage],
    stageIndex: id => entry(id).stage,
    mastery: id => entry(id).p,
    gpcMastery(id, gpc) { const e = entry(id); return (e.gpc[gpc] && e.gpc[gpc].p) ?? BKT.pInit; },

    // Records one item. Returns { promoted, reteach }.
    record({ subskill, outcome, choices = 3, review = false, itemId = null, gpc = null }) {
      const e = entry(subskill);
      const day = economy.today();
      const ok = outcome === 'firstTry';
      e.lastPracticed = day;
      economy.logResult({ subskill, ok, firstTry: ok, outcome, review, stage: e.stage });
      if (outcome === 'revealed' && itemId) api.noteMiss(itemId);
      const result = { promoted: false, reteach: false };
      if (outcome === 'abandoned') { economy.persist(); return result; }
      const evidence = outcome === 'firstTry' ? 1 : outcome === 'scaffolded' ? 0.5 : 0;
      const pGuess = Math.min(0.5, 1 / Math.max(2, choices));
      e.p = bktStep(e.p, evidence, pGuess);
      if (gpc) {
        const g = e.gpc[gpc] || (e.gpc[gpc] = { p: BKT.pInit, n: 0 });
        g.p = bktStep(g.p, evidence, pGuess); g.n++;
      }
      if (ok && !review) e.firstTryDays[day] = (e.firstTryDays[day] || 0) + 1;
      const firstTries = Object.values(e.firstTryDays).reduce((a, b) => a + b, 0);
      const days = Object.keys(e.firstTryDays).length;
      const maxStage = def(subskill).stages.length - 1;
      if (e.p >= PROMOTE.minP && firstTries >= PROMOTE.minFirstTry && days >= PROMOTE.minDays && e.stage < maxStage) {
        e.stage++; e.promotions++; e.firstTryDays = {}; e.p = 0.5; e.gpc = {};
        result.promoted = true;
      }
      if (e.p < RETEACH_P) result.reteach = true;
      economy.persist();
      return result;
    },

    accuracy(id, n = 20) {
      const rows = save().log.filter(r => r.subskill === id).slice(-n);
      if (!rows.length) return null;
      return rows.filter(r => r.ok).length / rows.length;
    },
    // Trend over 14 days: first-try rate of the last 7 days minus the 7 before. null when too little data.
    trend(id) {
      const today = economy.today();
      const rows = save().log.filter(r => r.subskill === id && diffDays(r.day, today) < 14);
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

    // Planner score: importance × weakness × recency × readiness × variety. Higher = pick first.
    skillScore(id) {
      const d = def(id);
      const e = entry(id);
      const ds = api.daysSince(id);
      const recency = ds === null ? 1.5 : 1 + Math.min(0.6, ds * 0.15);
      const readiness = 1; // prerequisites are the stage order inside each skill
      const recent = save().questHistory.slice(-2).map(q => q.subskill);
      const variety = recent.length === 2 && recent[0] === id && recent[1] === id ? 0.6 : 1;
      return TIER_WEIGHT[d.tier] * (1 - e.p) * recency * readiness * variety;
    },
    // Today's cabinet: the place hosting the highest-scoring tier-1 skill among ready cabinets.
    pickQuestCabinet(availableCabinets = null) {
      const s = save();
      const recent = s.questHistory.slice(-2).map(q => q.cabinet);
      const excluded = recent.length === 2 && recent[0] === recent[1] ? recent[0] : null;
      const scored = SUBSKILLS.filter(x => x.tier === 1)
        .filter(x => !availableCabinets || availableCabinets.includes(x.cabinet))
        .map(x => ({ cabinet: x.cabinet, subskill: x.id, score: api.skillScore(x.id) }))
        .sort((a, b) => b.score - a.score);
      const best = scored.find(x => x.cabinet !== excluded) || scored[0];
      if (best) return best;
      const fallback = (availableCabinets || []).find(c => c !== excluded) || (availableCabinets || [])[0] || 'meadow';
      return { cabinet: fallback, subskill: null, score: 0 };
    },
    // Review picks: mastered-ish skills in this cabinet, least recently practised first.
    reviewSkills(cabinet, n = 2) {
      return SUBSKILLS.filter(s => s.cabinet === cabinet && entry(s.id).p >= 0.6)
        .sort((a, b) => (api.daysSince(b.id) ?? 99) - (api.daysSince(a.id) ?? 99))
        .slice(0, n).map(s => s.id);
    },

    todayQuest(availableCabinets = null) {
      const s = save();
      const day = economy.today();
      if (!s.quest || s.quest.date !== day) {
        const pick = api.pickQuestCabinet(availableCabinets);
        s.quest = { date: day, requiredCabinet: pick.cabinet, requiredSubskill: pick.subskill, requiredDone: false, choiceCabinet: null, choiceDone: false, claimed: false };
        s.questHistory.push({ date: day, cabinet: pick.cabinet, subskill: pick.subskill });
        s.questHistory = s.questHistory.slice(-14);
        economy.persist();
      }
      return s.quest;
    },
    noteRoundFinished(cabinetId) {
      const q = api.todayQuest();
      if (cabinetId === q.requiredCabinet) q.requiredDone = true;
      else if (!q.choiceDone) { q.choiceCabinet = cabinetId; q.choiceDone = true; }
      economy.markPlayedToday();
      economy.persist();
      return q;
    },
    claimQuest() {
      const q = api.todayQuest();
      if (q.claimed || !(q.requiredDone && q.choiceDone)) return false;
      q.claimed = true;
      economy.addGems(QUEST_GEMS);
      economy.markPlayedToday();
      return true;
    }
  };
  return api;
}
