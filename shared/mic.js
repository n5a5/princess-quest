// shared/mic.js — the microphone for Star Stage: record one take while watching the level, so the place knows
// when she started and stopped and how loud she was (shared/stage-plan.js createVoiceGate). Browser-only.
// The raw microphone is asked for (no automatic gain): automatic gain would make every take equally loud and
// the big-voice star meaningless. Open it for one take and close it right after, so the device never sits
// in call mode while Luna is talking.
import { rmsDb, createVoiceGate } from './stage-plan.js';

export const canListen = () => !!(globalThis.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && globalThis.MediaRecorder);

export async function openMic() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false } }); }
  catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ac = new AC();
  try { await ac.resume(); } catch {}
  const an = ac.createAnalyser();
  an.fftSize = 2048;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const level = () => { an.getFloatTimeDomainData(buf); return rmsDb(buf); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let closed = false;
  return {
    // The room's quiet level: the quietest reading over the next ms.
    async floor(ms = 250) {
      let lo = 0;
      for (let t = 0; t < ms; t += 50) { lo = Math.min(lo, level()); await sleep(50); }
      return lo;
    },
    // Records until the gate closes or live() turns false. Resolves { blob, heard, peakDb, ms, reason }.
    listen({ floorDb, maxMs, endSilenceMs, noVoiceMs, onLevel = () => {}, live = () => true }) {
      const gate = createVoiceGate({ floorDb, maxMs, endSilenceMs, noVoiceMs });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      return new Promise(resolve => {
        let result = null;
        rec.onstop = () => resolve({ ...result, blob: chunks.length ? new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) : null });
        const t0 = Date.now();
        rec.start();
        const timer = setInterval(() => {
          const db = level();
          onLevel(db);
          const r = live() ? gate.step(db, Date.now() - t0) : { reason: 'cancelled', heard: false, peakDb: null, ms: Date.now() - t0 };
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
