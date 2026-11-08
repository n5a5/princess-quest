// The song player (shared/songclip.js) against a stand-in <audio> element: a second play() while the first is
// still starting must not end the second with 'error' (review: Luna said "The song will not play" and the song
// kept running silently to the end).
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeAudio {
  constructor() { FakeAudio.last = this; this.paused = true; this.currentTime = 0; this.duration = 200; this.volume = 1; this.ended = false; this.listeners = {}; this.pending = []; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  set src(v) { this._src = v; setTimeout(() => (this.listeners.loadedmetadata || []).forEach(f => f()), 0); }
  get src() { return this._src; }
  removeAttribute() {}
  load() {}
  play() {
    this.paused = false;
    // like a browser: play() settles a little later, and a pause() before then rejects it with AbortError
    return new Promise((res, rej) => { const p = { res, rej }; this.pending.push(p); setTimeout(() => { const i = this.pending.indexOf(p); if (i >= 0) { this.pending.splice(i, 1); res(); } }, 30); });
  }
  pause() {
    this.paused = true;
    const was = this.pending; this.pending = [];
    was.forEach(p => { const e = new Error('The play() request was interrupted by a call to pause()'); e.name = 'AbortError'; p.rej(e); });
  }
}
globalThis.Audio = FakeAudio;
globalThis.URL.createObjectURL = () => 'blob:song';
globalThis.URL.revokeObjectURL = () => {};
const { createSongPlayer } = await import('../shared/songclip.js');

test('song player: a second play while the first is starting plays on and stops at its end', async () => {
  const s = createSongPlayer(new Blob(['x']));
  const el = FakeAudio.last;
  assert.equal(await s.duration(), 200);
  const first = s.play({ from: 0 });
  const second = s.play({ from: 10.8, to: 11.0, fadeIn: 0.01, fadeOut: 0.01 });
  assert.equal(await first, 'stopped', 'the first one was replaced');
  await new Promise(r => setTimeout(r, 80)); // the first play()'s AbortError has arrived by now
  assert.equal(el.paused, false, 'still playing');
  el.currentTime = 11.2; // past the end of the range
  const how = await Promise.race([second, new Promise(r => setTimeout(() => r('timeout'), 500))]);
  assert.equal(how, 'ended', 'the AbortError of the first play() does not end the second; it stops at `to`');
  assert.equal(el.paused, true);
  s.release();
});

test('song player: a file that cannot be played resolves error', async () => {
  class Broken extends FakeAudio { play() { this.paused = false; return Promise.reject(Object.assign(new Error('no'), { name: 'NotSupportedError' })); } }
  globalThis.Audio = Broken;
  const s = createSongPlayer(new Blob(['x']));
  await s.duration();
  assert.equal(await s.play({ from: 0 }), 'error');
  assert.equal(FakeAudio.last.paused, true, 'not left running');
  s.release();
  globalThis.Audio = FakeAudio;
});
