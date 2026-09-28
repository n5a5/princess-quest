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
    // Gems earned and spent, per device: { deviceId: { earned, spent } }. Combining two devices keeps each
    // device's larger totals, so every gem spent on either device stays spent and none is counted twice.
    wallet: {},
    stars: {},
    badges: [],
    streak: { days: [] },
    subskills: {},
    sightWords: {},
    missed: {},
    vocab: {},
    books: {},      // Little Books read: { id: { reads, last } }
    demos: {},      // activities whose first-time demo has been shown: { familyId: day }
    kingdom: { placed: [], gifts: [] },
    companion: { stars: 0 },
    squishies: { rescued: [] },
    quest: null,
    questHistory: [],
    feelingsLog: [],    // Calm Tower check-ins: { day, feeling }
    scenariosSeen: [],  // Uh-Oh Courtyard scenario ids already shown
    // voice: 'device' = the device's text-to-speech for instructions; 'luna' = the pre-recorded story voice
    // (the same voice as the words and letter sounds). Stays 'device' until the parent picks in Parent Corner.
    // focus: what the parent asked the app to lean on for a week: { sound, words: [], until: 'YYYY-MM-DD' } or null
    settings: { muted: false, rate: 0.9, voiceName: '', modulesOff: [], voice: 'device', focus: null },
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
  out.kingdom.placed = out.kingdom.placed.filter(p => isObj(p) && typeof p.itemId === 'string' && Number.isInteger(p.spot));
  out.kingdom.gifts = capGifts(Array.isArray(out.kingdom.gifts) ? out.kingdom.gifts : []);
  out.feelingsLog = out.feelingsLog.filter(f => isObj(f) && typeof f.day === 'string');
  out.scenariosSeen = out.scenariosSeen.filter(x => typeof x === 'string');
  // saves from before the wallet: everything she has now counts as earned
  if (!isObj(raw.wallet)) out.wallet = { legacy: { earned: out.gems, spent: 0 } };
  for (const [id, w] of Object.entries(out.wallet)) if (!isObj(w) || typeof w.earned !== 'number' || typeof w.spent !== 'number') delete out.wallet[id];
  if (!Array.isArray(out.settings.modulesOff)) out.settings.modulesOff = [];
  if (!['device', 'luna'].includes(out.settings.voice)) out.settings.voice = 'device';
  const f = out.settings.focus;
  if (!isObj(f) || typeof f.until !== 'string' || (f.sound !== null && f.sound !== undefined && typeof f.sound !== 'string')) out.settings.focus = null;
  else out.settings.focus = { sound: f.sound || null, words: Array.isArray(f.words) ? f.words.filter(w => typeof w === 'string') : [], until: f.until };
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

// Gifts are { id, day }. Buying the same gift twice in a day is allowed, so rows can repeat; a repeat count
// above GIFT_CAP for one gift on one day can only come from the old merge bug that doubled gifts on every sync.
const GIFT_CAP = 10;
function capGifts(gifts) {
  const n = new Map();
  return gifts.filter(g => {
    if (!isObj(g) || typeof g.id !== 'string') return false;
    const k = g.id + '|' + g.day; n.set(k, (n.get(k) || 0) + 1);
    return n.get(k) <= GIFT_CAP;
  });
}
// Multiset union keyed by JSON value: a row keeps the larger of its two counts, so merging is idempotent.
function unionRows(a, b) {
  const count = rows => rows.reduce((m, r) => { const k = JSON.stringify(r); m.set(k, (m.get(k) || 0) + 1); return m; }, new Map());
  const ca = count(a), out = a.slice();
  for (const [k, n] of count(b)) for (let i = ca.get(k) || 0; i < n; i++) out.push(JSON.parse(k));
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

export function createEconomy({ storage, key = SAVE_KEY, now = () => new Date(), onSaveError = null } = {}) {
  let save = load();

  function load() {
    try { return migrate(JSON.parse(storage.getItem(key) || 'null')); }
    catch { return defaultSave(); }
  }
  // Returns false when the browser refused to store the save (storage full or blocked); onSaveError is told once per failure run.
  let failing = false;
  function persist() {
    try { storage.setItem(key, JSON.stringify(save)); failing = false; return true; }
    catch (e) { console.warn('save failed', e); if (!failing && onSaveError) onSaveError(e); failing = true; return false; }
  }
  function today() { return localDay(now()); }
  // This device's id for the wallet. Kept outside the save, so Replace or Combine never copies it.
  let me = null;
  try { me = storage.getItem(key + '.device'); } catch {}
  if (!me) { me = 'd' + now().getTime().toString(36) + Math.random().toString(36).slice(2, 7); try { storage.setItem(key + '.device', me); } catch {} }
  const mine = () => save.wallet[me] || (save.wallet[me] = { earned: 0, spent: 0 });
  function trimLog() {
    const cutoff = localDay(new Date(now().getTime() - LOG_DAYS * 864e5));
    save.log = save.log.filter(e => e.day >= cutoff);
  }

  const api = {
    get save() { return save; },
    persist,
    today,
    addGems(n) { save.gems += n; mine().earned += n; persist(); return save.gems; },
    spendGems(n) { if (save.gems < n) return false; save.gems -= n; mine().spent += n; persist(); return true; },
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
    logResult({ subskill, ok, firstTry = true, outcome = null, review = false, stage = null, choices = null, fam = null }) {
      // t: when it happened (ms). Makes each row unique so combining two devices' saves never double-counts.
      const row = { day: today(), t: now().getTime(), subskill, ok: !!ok, firstTry: !!firstTry };
      if (outcome) row.outcome = outcome;
      if (review) row.review = true;
      if (stage !== null) row.stage = stage;
      if (choices !== null) row.choices = choices;
      if (fam) row.fam = fam; // which activity (family) it came from: per-activity demos
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
    // Combine another device's progress into this one (phone + Chromebook). Nothing is lost and running it
    // twice changes nothing: every skill keeps its further-along copy, wish words keep the higher box, logs are
    // united (a row seen on both devices counts once), gems and stars keep the larger number. This device's
    // settings, name, PIN and today's quest stay as they are. Returns false if the text is not a save.
    mergeJSON(text) {
      let other;
      try { other = JSON.parse(text); } catch { return false; }
      if (!isObj(other) || !('schemaVersion' in other) || !('gems' in other)) return false;
      const b = migrate(other), a = save;
      for (const [id, eb] of Object.entries(b.subskills)) {
        const ea = a.subskills[id];
        if (!ea) { a.subskills[id] = eb; continue; }
        const further = (eb.stage || 0) > (ea.stage || 0) || ((eb.stage || 0) === (ea.stage || 0) && (eb.p || 0) > (ea.p || 0));
        const keep = further ? { ...eb } : { ...ea };
        keep.lastPracticed = [ea.lastPracticed, eb.lastPracticed].filter(Boolean).sort().pop() || null;
        keep.promotions = Math.max(ea.promotions || 0, eb.promotions || 0);
        a.subskills[id] = keep;
      }
      for (const [w, wb] of Object.entries(b.sightWords)) {
        const wa = a.sightWords[w];
        if (!wa) { a.sightWords[w] = wb; continue; }
        a.sightWords[w] = {
          box: Math.max(wa.box || 0, wb.box || 0),
          firstTryDays: [...new Set([...(wa.firstTryDays || []), ...(wb.firstTryDays || [])])].sort(),
          introducedDay: [wa.introducedDay, wb.introducedDay].filter(Boolean).sort()[0] || null,
          lastSeen: [wa.lastSeen, wb.lastSeen].filter(Boolean).sort().pop() || null
        };
      }
      for (const [k, n] of Object.entries(b.missed)) a.missed[k] = Math.max(a.missed[k] || 0, n);
      for (const [k, v] of Object.entries(b.vocab)) if (!a.vocab[k] || (v.recalled && !a.vocab[k].recalled)) a.vocab[k] = v;
      for (const [k, n] of Object.entries(b.stars)) a.stars[k] = Math.max(a.stars[k] || 0, n);
      // gems: lifetime earned and spent each keep the larger total, so gems spent on one device stay spent
      for (const [id, wb] of Object.entries(b.wallet)) {
        const wa = a.wallet[id] || { earned: 0, spent: 0 };
        a.wallet[id] = { earned: Math.max(wa.earned, wb.earned), spent: Math.max(wa.spent, wb.spent) };
      }
      const all = Object.values(a.wallet);
      a.gems = Math.max(0, all.reduce((t, w) => t + w.earned, 0) - all.reduce((t, w) => t + w.spent, 0));
      a.companion.stars = Math.max(a.companion.stars, b.companion.stars);
      a.badges = [...new Set([...a.badges, ...b.badges])];
      a.streak.days = [...new Set([...a.streak.days, ...b.streak.days])].sort();
      a.squishies.rescued = [...new Set([...a.squishies.rescued, ...b.squishies.rescued])];
      // decorations: every item either device bought; one that lands on a taken spot moves to the first free spot
      const taken = new Set(a.kingdom.placed.map(p => p.spot)), have = new Set(a.kingdom.placed.map(p => p.itemId));
      for (const p of b.kingdom.placed) {
        if (have.has(p.itemId)) continue;
        let spot = p.spot; while (taken.has(spot)) spot = [...Array(taken.size + 1).keys()].find(i => !taken.has(i));
        a.kingdom.placed.push({ itemId: p.itemId, spot }); taken.add(spot); have.add(p.itemId);
      }
      // gifts, logs, feelings: multiset union (a row keeps the larger of its two counts), so merging twice changes nothing
      a.kingdom.gifts = capGifts(unionRows(a.kingdom.gifts, b.kingdom.gifts));
      a.log = unionRows(a.log, b.log);
      a.log.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : (x.t || 0) - (y.t || 0)));
      a.feelingsLog = unionRows(a.feelingsLog, b.feelingsLog);
      a.scenariosSeen = [...new Set([...a.scenariosSeen, ...b.scenariosSeen])];
      for (const [k, v] of Object.entries(b.books)) if (!a.books[k] || (v.reads || 0) > (a.books[k].reads || 0)) a.books[k] = v;
      for (const [k, v] of Object.entries(b.demos)) if (!a.demos[k]) a.demos[k] = v;
      trimLog();
      return persist() ? true : 'full';
    },
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
