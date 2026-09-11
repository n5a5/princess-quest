// shared/soundkit.js — parent-recorded phoneme clips in IndexedDB. Browser-only.
// speech.speak() plays a clip for every /id/ token when one exists; otherwise falls back to TTS.
const DB = 'arcade-soundkit';
const STORE = 'clips';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createSoundKit() {
  let dbPromise = null;
  const cache = new Map(); // id → Blob
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
    // Loads every clip into memory once. Returns the count. Safe to call when IndexedDB is unavailable.
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
      } catch (e) { console.warn('soundkit unavailable', e); }
      return cache.size;
    },
    has: id => cache.has(id),
    count: () => cache.size,
    async save(id, blob) { cache.set(id, blob); await write(s => s.put(blob, id)); },
    async remove(id) { cache.delete(id); await write(s => s.delete(id)); },
    // Resolves true when the clip finished playing, false when missing or blocked.
    play(id) {
      const blob = cache.get(id);
      if (!blob) return Promise.resolve(false);
      return new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        const done = ok => { URL.revokeObjectURL(url); resolve(ok); };
        a.onended = () => done(true);
        a.onerror = () => done(false);
        a.play().catch(() => done(false));
      });
    },
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
    }
  };
  return api;
}
