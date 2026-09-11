// shared/content.js — fetch-once JSON loader. All game content lives in /content/*.json.
export function createContentLoader({ fetchImpl = u => globalThis.fetch(u), base = './content/' } = {}) {
  const cache = new Map();
  return {
    load(name) {
      if (!cache.has(name)) {
        const p = fetchImpl(base + name + '.json')
          .then(r => { if (!r.ok) throw new Error('Missing content ' + name); return r.json(); })
          .then(j => { if (!j || typeof j !== 'object') throw new Error('Bad content ' + name); return j; })
          .catch(e => { cache.delete(name); throw e; });
        cache.set(name, p);
      }
      return cache.get(name);
    }
  };
}
