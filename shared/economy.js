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
    quest: null,
    questHistory: [],
    settings: { muted: false, rate: 0.9, voiceName: '', modulesOff: [] },
    log: []
  };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function migrate(raw) {
  const base = defaultSave();
  if (!isObj(raw)) return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (!(k in raw)) continue;
    out[k] = isObj(base[k]) && isObj(raw[k]) ? { ...base[k], ...raw[k] } : raw[k];
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

export function starsFromRatio(r) { return r >= 0.85 ? 3 : r >= 0.6 ? 2 : 1; }
export function starRankFromPromotions(n) { return Math.min(5, 1 + Math.floor(n / 3)); }

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
    logResult({ subskill, ok, firstTry = true }) {
      save.log.push({ day: today(), subskill, ok: !!ok, firstTry: !!firstTry });
      trimLog();
      persist();
    },
    awardBadge(id) { if (save.badges.includes(id)) return false; save.badges.push(id); persist(); return true; },
    exportJSON() { return JSON.stringify(save, null, 2); },
    importJSON(text) {
      try {
        const parsed = JSON.parse(text);
        if (!isObj(parsed)) return false;
        save = migrate(parsed); persist(); return true;
      } catch { return false; }
    },
    reset() { save = defaultSave(); persist(); }
  };
  return api;
}
