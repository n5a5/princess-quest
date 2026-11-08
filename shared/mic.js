// shared/mic.js — the microphone for Star Stage: record one take while watching the level, so the place knows
// when she started and stopped and how loud she was (shared/stage-plan.js createVoiceGate). Browser-only.
// The raw microphone is asked for (no automatic gain): automatic gain would make every take equally loud and
// the big-voice star meaningless. Open it for one take, after Luna has finished, and close it right after, so
// the device never sits in call mode while Luna is talking.
import { rmsDb, createVoiceGate, roomLevel, quietLevel } from './stage-plan.js';

export const canListen = () => !!(globalThis.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && globalThis.MediaRecorder);

// A permission question nobody answers (a child alone) must not hang the app: after timeoutMs this throws a
// TimeoutError, and a stream that arrives later is stopped at once.
function withTimeout(p, ms) {
  let late = false;
  return Promise.race([
    p.then(s => { if (late) s.getTracks().forEach(t => t.stop()); return s; }),
    new Promise((_, reject) => setTimeout(() => { late = true; const e = new Error('microphone permission not answered'); e.name = 'TimeoutError'; reject(e); }, ms))
  ]);
}

export async function openMic({ timeoutMs = 10000 } = {}) {
  let stream;
  try { stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false } }), timeoutMs); }
  catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'TimeoutError')) throw e;
    stream = await withTimeout(navigator.mediaDevices.getUserMedia({ audio: true }), timeoutMs);
  }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  let ac = null, an;
  try {
    ac = new AC();
    try { await ac.resume(); } catch {}
    an = ac.createAnalyser();
    an.fftSize = 2048;
    ac.createMediaStreamSource(stream).connect(an);
  } catch (e) { stream.getTracks().forEach(t => t.stop()); if (ac) ac.close().catch(() => {}); throw e; }
  const buf = new Float32Array(an.fftSize);
  const level = () => { an.getFloatTimeDomainData(buf); return rmsDb(buf); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let closed = false;
  return {
    // The room's quiet level over the next ms (shared/stage-plan.js roomLevel); `fallback` when no reading was usable.
    async floor(ms = 400, fallback = -60) {
      const readings = [];
      for (let t = 0; t < ms; t += 50) { readings.push(level()); await sleep(50); }
      return roomLevel(readings, fallback);
    },
    // Records until the gate closes or live() turns false. Resolves { blob, heard, peakDb, maxDb, ms, reason, quietDb }
    // (quietDb: the room as heard during the take, shared/stage-plan.js quietLevel).
    // nudgeMs: with no voice yet by then, onNudge() runs once (the "your turn" reminder) and the gate ignores the
    // next 500 ms, so the reminder's own chime is never taken for her voice.
    listen({ floorDb, maxMs, endSilenceMs, noVoiceMs, graceMs = 250, nudgeMs = 0, onNudge = () => {}, onLevel = () => {}, live = () => true }) {
      const gate = createVoiceGate({ floorDb, maxMs, endSilenceMs, noVoiceMs, graceMs });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      return new Promise(resolve => {
        let result = null;
        const heardLevels = [];
        rec.onstop = () => resolve({ ...result, quietDb: quietLevel(heardLevels), blob: chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null });
        const t0 = Date.now();
        let nudged = false;
        rec.start();
        const timer = setInterval(() => {
          const db = level(), t = Date.now() - t0;
          if (t >= graceMs) heardLevels.push(db);
          if (nudgeMs && !nudged && t >= nudgeMs && !gate.heard) { nudged = true; gate.ignore(t + 500); try { onNudge(); } catch {} }
          if (t >= graceMs) onLevel(db);
          const r = live() ? gate.step(db, t) : { reason: 'cancelled', heard: false, peakDb: null, ms: t };
          if (r) { clearInterval(timer); result = r; if (rec.state !== 'inactive') rec.stop(); }
        }, 50);
      });
    },
    close() {
      if (closed) return;
      closed = true;
      stream.getTracks().forEach(t => t.stop());
      ac.close().catch(() => {});
    }
  };
}
