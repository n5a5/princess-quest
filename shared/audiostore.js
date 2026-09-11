// shared/audiostore.js — recorded audio clips in IndexedDB, keyed "kind:id" (phoneme:m, word:cat, letter:s).
// Browser-only. Recordings override bundled defaults; nothing here is required for the app to work.
const DB = 'arcade-audiostore';
const STORE = 'clips';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const clipKey = (kind, id) => kind + ':' + id;

export function createAudioStore() {
  let dbPromise = null;
  const cache = new Map(); // key → Blob
  const db = () => (dbPromise ||= openDB());

  async function write(fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, 'readwrite');
      fn(t.objectStore(STORE));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }

  const api = {
    async load() {
      try {
        const d = await db();
        const rows = await new Promise((resolve, reject) => {
          const t = d.transaction(STORE);
          const s = t.objectStore(STORE);
          const keys = s.getAllKeys();
          const vals = s.getAll();
          t.oncomplete = () => resolve(keys.result.map((k, i) => [k, vals.result[i]]));
          t.onerror = () => reject(t.error);
        });
        rows.forEach(([k, v]) => cache.set(k, v));
      } catch (e) { console.warn('audiostore unavailable', e); }
      return cache.size;
    },
    has: (kind, id) => cache.has(clipKey(kind, id)),
    get: (kind, id) => cache.get(clipKey(kind, id)) || null,
    count: kind => [...cache.keys()].filter(k => !kind || k.startsWith(kind + ':')).length,
    ids: kind => [...cache.keys()].filter(k => k.startsWith(kind + ':')).map(k => k.slice(kind.length + 1)),
    async save(kind, id, blob) { cache.set(clipKey(kind, id), blob); await write(s => s.put(blob, clipKey(kind, id))); },
    async remove(kind, id) { cache.delete(clipKey(kind, id)); await write(s => s.delete(clipKey(kind, id))); },
    canRecord: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && globalThis.MediaRecorder),
    // Starts recording; auto-stops at maxMs. Returns { stop(), blob: Promise<Blob> }.
    async record(maxMs = 1800) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const blob = new Promise(resolve => {
        rec.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
        };
      });
      rec.start();
      const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, maxMs);
      return { stop: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); }, blob };
    },
    // Export/import so recordings can move between devices (JSON with base64 clips).
    async exportJSON() {
      const clips = {};
      for (const [k, blob] of cache) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        clips[k] = { type: blob.type, b64: btoa(bin) };
      }
      return JSON.stringify({ version: 1, clips });
    },
    async importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed.clips !== 'object') throw new Error('Not a sound kit file');
      let n = 0;
      for (const [k, v] of Object.entries(parsed.clips)) {
        const bin = atob(v.b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const [kind, ...rest] = k.split(':');
        await api.save(kind, rest.join(':'), new Blob([buf], { type: v.type || 'audio/webm' }));
        n++;
      }
      return n;
    }
  };
  return api;
}
