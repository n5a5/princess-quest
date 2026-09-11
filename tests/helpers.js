// tests/helpers.js — shared test utilities (memory storage, fixed clock, JSON reader).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); }
  };
}

export function readJSON(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

export function fixedClock(startISO = '2026-09-10T10:00:00') {
  let t = new Date(startISO).getTime();
  return { now: () => new Date(t), advanceDays: n => { t += n * 864e5; }, advanceMs: n => { t += n; } };
}
