// shared/adaptive.js — per-sub-skill difficulty windows, quest picker, missed items.
// DOM-free; depends only on an economy instance for save/persist/today.
export const SUBSKILLS = [
  { id: 'phonics-encode',    strand: 'ELA.K.F.1.3', cabinet: 'word-builder',   tier: 1, name: 'Phonics: build words',  stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'phonics-decode',    strand: 'ELA.K.F.1.3', cabinet: 'word-builder',   tier: 1, name: 'Phonics: read words',   stages: ['a', 'b', 'c', 'd', 'd2', 'e', 'f'] },
  { id: 'pa-sounds',         strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Hearing sounds',        stages: ['first', 'final', 'medial'] },
  { id: 'pa-blend-segment',  strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Blend and segment',     stages: ['short', 'long'] },
  { id: 'pa-manipulate',     strand: 'ELA.K.F.1.2', cabinet: 'sound-garden',   tier: 1, name: 'Change sounds',         stages: ['delete', 'swap'] },
  { id: 'subitize-tenframe', strand: 'MA.K.NSO.1.1', cabinet: 'number-kingdom', tier: 1, name: 'See how many',          stages: ['small', 'structured', 'make10'] },
  { id: 'teen-compare',      strand: 'MA.K.NSO.2.2', cabinet: 'number-kingdom', tier: 1, name: 'Teens and compare',     stages: ['teens', 'compare', 'numberline'] },
  { id: 'add-sub',           strand: 'MA.K.NSO.3.1', cabinet: 'number-kingdom', tier: 1, name: 'Add and subtract',      stages: ['within5', 'within10', 'related'] },
  { id: 'count-sequence',    strand: 'MA.K.NSO.2.1', cabinet: 'number-kingdom', tier: 2, name: 'Counting on',           stages: ['ones', 'tens', 'backward'] },
  { id: 'decompose-stories', strand: 'MA.K.AR.1.2', cabinet: 'number-stories', tier: 2, name: 'Number stories',        stages: ['bonds', 'decompose', 'problems', 'truefalse'] },
  { id: 'measure',           strand: 'MA.K.M.1.2',  cabinet: 'measure-sort',   tier: 1, name: 'Measuring',             stages: ['attribute', 'compare', 'order', 'units'] },
  { id: 'data-sort',         strand: 'MA.K.DP.1.1', cabinet: 'measure-sort',   tier: 1, name: 'Sorting and data',      stages: ['two', 'three', 'chart'] },
  { id: 'shapes',            strand: 'MA.K.GR.1.1', cabinet: 'measure-sort',   tier: 2, name: 'Shapes',                stages: ['2d', '3d', 'compose'] },
  { id: 'comprehension',     strand: 'ELA.K.R.1.1', cabinet: 'story-garden',   tier: 3, name: 'Understanding stories', stages: ['literary', 'informational', 'poems'] }
];

export const WINDOW = 10;
export const PROMOTE_AT = 8;
export const DEMOTE_AT = 4;
export const MIN_CHOICES = 3;
export const QUEST_GEMS = 10;

export function diffDays(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5);
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
    if (!s.subskills[id]) s.subskills[id] = { stage: 0, window: [], lastPracticed: null, promotions: 0 };
    return s.subskills[id];
  }

  const api = {
    defs: () => SUBSKILLS,
    tier1Ids: () => SUBSKILLS.filter(s => s.tier === 1).map(s => s.id),
    stage: id => def(id).stages[entry(id).stage],
    stageIndex: id => entry(id).stage,

    record({ subskill, ok, choices = 3, retry = false, itemId = null }) {
      const e = entry(subskill);
      const day = economy.today();
      e.lastPracticed = day;
      economy.logResult({ subskill, ok, firstTry: !retry });
      if (!ok && itemId) api.noteMiss(itemId);
      const result = { promoted: false, demoted: false };
      if (retry || choices < MIN_CHOICES) { economy.persist(); return result; }
      e.window.push({ ok: !!ok, day });
      if (e.window.length > WINDOW) e.window.shift();
      const oks = e.window.filter(w => w.ok).length;
      const misses = e.window.filter(w => !w.ok);
      const missDays = new Set(misses.map(w => w.day)).size;
      const maxStage = def(subskill).stages.length - 1;
      if (e.window.length === WINDOW && oks >= PROMOTE_AT) {
        if (e.stage < maxStage) e.stage++;
        e.promotions++;
        e.window = [];
        result.promoted = true;
      } else if (misses.length >= DEMOTE_AT && missDays >= 2) {
        if (e.stage > 0) e.stage--;
        e.window = [];
        result.demoted = true;
      }
      economy.persist();
      return result;
    },

    accuracy(id, n = 20) {
      const rows = save().log.filter(r => r.subskill === id).slice(-n);
      if (!rows.length) return null;
      return rows.filter(r => r.ok).length / rows.length;
    },
    daysSince(id) {
      const e = save().subskills[id];
      if (!e || !e.lastPracticed) return null;
      return diffDays(e.lastPracticed, economy.today());
    },
    itemsOnDay(id, day) { return save().log.filter(r => r.subskill === id && r.day === day).length; },

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

    // Scores each cabinet by its tier-1 sub-skills: low mean accuracy and staleness rank first.
    // Unpracticed sub-skills count as accuracy 0. A cabinet picked on both of the last two days is skipped.
    pickQuestCabinet(availableCabinets = null) {
      const s = save();
      const recent = s.questHistory.slice(-2).map(q => q.cabinet);
      const excluded = recent.length === 2 && recent[0] === recent[1] ? recent[0] : null;
      const byCabinet = new Map();
      for (const sk of SUBSKILLS.filter(x => x.tier === 1)) {
        if (availableCabinets && !availableCabinets.includes(sk.cabinet)) continue;
        if (!byCabinet.has(sk.cabinet)) byCabinet.set(sk.cabinet, []);
        byCabinet.get(sk.cabinet).push(sk);
      }
      const scored = [];
      for (const [cabinet, skills] of byCabinet) {
        const accs = skills.map(sk => api.accuracy(sk.id) ?? 0);
        const meanAcc = accs.reduce((a, b) => a + b, 0) / accs.length;
        const days = skills.map(sk => api.daysSince(sk.id)).filter(d => d !== null);
        const stale = days.length ? Math.min(0.5, Math.min(...days) * 0.1) : 0.5;
        const weakest = skills[accs.indexOf(Math.min(...accs))];
        scored.push({ cabinet, subskill: weakest.id, score: (1 - meanAcc) + stale });
      }
      scored.sort((a, b) => b.score - a.score);
      const best = scored.find(x => x.cabinet !== excluded) || scored[0];
      if (best) return best;
      // No tier-1 cabinet is available yet: fall back to whatever is playable.
      const fallback = (availableCabinets || []).find(c => c !== excluded) || (availableCabinets || [])[0] || 'word-builder';
      return { cabinet: fallback, subskill: null, score: 0 };
    },

    todayQuest(availableCabinets = null) {
      const s = save();
      const day = economy.today();
      if (!s.quest || s.quest.date !== day) {
        const pick = api.pickQuestCabinet(availableCabinets);
        s.quest = { date: day, requiredCabinet: pick.cabinet, requiredSubskill: pick.subskill, requiredDone: false, choiceCabinet: null, choiceDone: false, claimed: false };
        s.questHistory.push({ date: day, cabinet: pick.cabinet });
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
