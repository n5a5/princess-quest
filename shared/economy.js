// shared/economy.js — save/load, gems, stars, badges, day streak, result log.
// DOM-free. Storage is injected so it runs under node --test.
export const SCHEMA_VERSION = 3;
export const SAVE_KEY = 'arcade.v3';
export const LOG_DAYS = 60;

export function localDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lastNDays(dayStr, n) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(localDay(new Date(y, m - 1, d - i)));
  return out;
}

export function defaultSave() {
  return {
    schemaVersion: SCHEMA_VERSION,
    child: { name: 'Amelia', pin: '1234' },
    gems: 0,
    stars: {},
    badges: [],
    streak: { days: [] },
    subskills: {},
    sightWords: {},
    missed: {},
    vocab: {},
    kingdom: { placed: [], gifts: [] },
    companion: { stars: 0 },
    squishies: { rescued: [] },
    quest: null,
    questHistory: [],
    settings: { muted: false, rate: 0.9, voiceName: '', modulesOff: [] },
    log: []
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Every field is checked against the type of its default; anything else falls back to the default
// (BUG-02: a hand-edited or badly imported save must never crash the map).
function sameKind(a, b) {
  if (Array.isArray(a)) return Array.isArray(b);
  if (isObj(a)) return isObj(b);
  if (typeof a === 'number') return typeof b === 'number' && Number.isFinite(b);
  if (typeof a === 'boolean') return typeof b === 'boolean';
  if (typeof a === 'string') return typeof b === 'string';
  return true;
}
export function migrate(raw) {
  const base = defaultSave();
  if (!isObj(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (k === 'quest') { out[k] = isObj(v) || v === null ? v : null; continue; }
    if (!sameKind(base[k], v)) continue;
    if (isObj(base[k])) {
      const merged = { ...base[k] };
      for (const [kk, vv] of Object.entries(v)) if (!(kk in base[k]) || sameKind(base[k][kk], vv)) merged[kk] = vv;
      out[k] = merged;
    } else out[k] = v;
  }
  out.log = out.log.filter(r => isObj(r) && typeof r.day === 'string' && typeof r.subskill === 'string');
  out.badges = out.badges.filter(b => typeof b === 'string');
  out.streak.days = Array.isArray(out.streak.days) ? out.streak.days.filter(d => typeof d === 'string') : [];
  for (const [id, e] of Object.entries(out.subskills)) if (!isObj(e)) delete out.subskills[id];
  for (const [w, e] of Object.entries(out.sightWords)) if (!isObj(e)) delete out.sightWords[w];
  if (!/^\d{4}$/.test(String(out.child.pin))) out.child.pin = '1234';
  if (typeof out.child.name !== 'string' || !out.child.name.trim()) out.child.name = 'Amelia';
  if (!Array.isArray(out.squishies.rescued)) out.squishies.rescued = [];
  if (typeof out.companion.stars !== 'number') out.companion.stars = 0;
  if (!Array.isArray(out.kingdom.placed)) out.kingdom.placed = [];
  if (!Array.isArray(out.settings.modulesOff)) out.settings.modulesOff = [];
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

export function starsFromRatio(r) { return r >= 0.85 ? 3 : r >= 0.6 ? 2 : 1; }
export function starRankFromPromotions(n) { return Math.min(5, 1 + Math.floor(n / 3)); }

// Companion growth: stars only ever accumulate. Levels at 12 / 38 / 63 stars (horn glow, wings, crown).
export const COMPANION_LEVELS = [12, 38, 63];
export function companionLevel(stars) { return COMPANION_LEVELS.filter(t => stars >= t).length; }
export function companionProgress(stars) {
  const lvl = companionLevel(stars);
  const lo = lvl === 0 ? 0 : COMPANION_LEVELS[lvl - 1];
  const hi = COMPANION_LEVELS[lvl] ?? (lo + 30);
  return { level: lvl, fraction: Math.min(1, (stars - lo) / (hi - lo)), next: hi };
}

export function createEconomy({ storage, key = SAVE_KEY, now = () => new Date() } = {}) {
  let save = load();

  function load() {
    try { return migrate(JSON.parse(storage.getItem(key) || 'null')); }
    catch { return defaultSave(); }
  }
  function persist() { try { storage.setItem(key, JSON.stringify(save)); } catch (e) { console.warn('save failed', e); } }
  function today() { return localDay(now()); }
  function trimLog() {
    const cutoff = localDay(new Date(now().getTime() - LOG_DAYS * 864e5));
    save.log = save.log.filter(e => e.day >= cutoff);
  }

  const api = {
    get save() { return save; },
    persist,
    today,
    addGems(n) { save.gems += n; persist(); return save.gems; },
    spendGems(n) { if (save.gems < n) return false; save.gems -= n; persist(); return true; },
    markPlayedToday() {
      const d = today();
      if (!save.streak.days.includes(d)) { save.streak.days.push(d); persist(); }
      return api.streak();
    },
    streak() {
      const days = save.streak.days;
      const d = today();
      return { count: days.length, playedToday: days.includes(d), last7: lastNDays(d, 7).map(x => days.includes(x)) };
    },
    setStars(cabinetId, ratio) { const s = starsFromRatio(ratio); save.stars[cabinetId] = s; persist(); return s; },
    starRank(subskillIds) {
      let promos = 0;
      for (const id of subskillIds) promos += (save.subskills[id] && save.subskills[id].promotions) || 0;
      return starRankFromPromotions(promos);
    },
    logResult({ subskill, ok, firstTry = true, outcome = null, review = false, stage = null }) {
      const row = { day: today(), subskill, ok: !!ok, firstTry: !!firstTry };
      if (outcome) row.outcome = outcome;
      if (review) row.review = true;
      if (stage !== null) row.stage = stage;
      save.log.push(row);
      trimLog();
      persist();
    },
    awardBadge(id) { if (save.badges.includes(id)) return false; save.badges.push(id); persist(); return true; },
    // Adds round stars to the companion meter. Returns { stars, level, leveledUp }.
    addCompanionStars(n) {
      const before = companionLevel(save.companion.stars);
      save.companion.stars += n;
      const level = companionLevel(save.companion.stars);
      persist();
      return { stars: save.companion.stars, level, leveledUp: level > before };
    },
    companion() { return { stars: save.companion.stars, ...companionProgress(save.companion.stars) }; },
    // Rescues the next trapped Squishy at a place. Returns its id or null when all are free.
    rescueSquishy(place, ids) {
      const next = ids.find(id => !save.squishies.rescued.includes(id));
      if (!next) return null;
      save.squishies.rescued.push(next);
      persist();
      return next;
    },
    rescuedAt(place, ids) { return ids.filter(id => save.squishies.rescued.includes(id)); },
    exportJSON() { return JSON.stringify(save, null, 2); },
    importJSON(text) {
      try {
        const parsed = JSON.parse(text);
        if (!isObj(parsed) || !('schemaVersion' in parsed) || !('gems' in parsed)) return false; // not a Princess Quest save
        save = migrate(parsed); persist(); return true;
      } catch { return false; }
    },
    reset() { save = defaultSave(); persist(); }
  };
  return api;
}
