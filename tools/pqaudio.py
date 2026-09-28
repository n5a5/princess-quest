# tools/pqaudio.py — shared helpers for the offline audio build scripts (not part of the app).
# Voice: Kokoro-82M (Apache-2.0 code and weights) run locally with kokoro-onnx (MIT).
# Model files: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).
import subprocess, tempfile
from pathlib import Path
import numpy as np

SR = 24000
TMP = Path(tempfile.mkdtemp(prefix='pq-audio-'))


def run_ff(args, data=None):
    return subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, input=data, capture_output=True, check=True).stdout


def to_wav(x, path, sr=SR):
    run_ff(['-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', str(path)], np.asarray(x, dtype=np.float32).tobytes())


def from_file(path, sr=SR):
    return np.frombuffer(run_ff(['-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-']), dtype=np.float32).copy()


def encode_opus(x, out, kbps=32):
    wav = TMP / (Path(out).stem + '.enc.wav')
    to_wav(x, wav)
    run_ff(['-i', str(wav), '-c:a', 'libopus', '-b:a', f'{kbps}k', '-ac', '1', str(out)])


def frames(x, win=0.02, hop=0.005):
    w, h = int(SR * win), int(SR * hop)
    out = []
    for i in range(0, max(1, len(x) - w), h):
        f = x[i:i + w]
        e = 20 * np.log10(np.sqrt(np.mean(f ** 2)) + 1e-9)
        z = np.mean(np.abs(np.diff(np.sign(f)))) / 2
        out.append({'i': i, 'e': e, 'z': z})
    return out


def trim_silence(x, thr_db=-45, pad_ms=10):
    a = np.abs(x); thr = 10 ** (thr_db / 20)
    idx = np.where(a > thr)[0]
    if not len(idx):
        return x
    p = int(SR * pad_ms / 1000)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]


def fade(x, in_ms=4, out_ms=12):
    x = x.copy()
    fi, fo = min(int(SR * in_ms / 1000), len(x) // 3), min(int(SR * out_ms / 1000), len(x) // 3)
    if fi: x[:fi] *= np.linspace(0, 1, fi)
    if fo: x[-fo:] *= np.linspace(1, 0, fo)
    return x


def normalise_peak(x, peak_db=-1.0):
    pk = np.abs(x).max()
    return x * (10 ** (peak_db / 20) / pk) if pk > 0 else x


VOICELESS = ('sh', 'ch', 'th', 'p', 't', 'k', 'c', 's', 'f', 'h', 'q', 'x')
VOICED_STOPS = ('b', 'd', 'g', 'j')


def trim_lead_murmur(x, word):
    """Kokoro often starts an isolated word with 50–100 ms of voiced murmur (an "uh") before the first
    consonant. When the word starts with a consonant we can find acoustically, cut the audio just before
    it: the first noisy frame for a voiceless consonant, the closure silence for b, d, g, j.
    Words starting with a vowel, m, n, l, r, w, y, v or z are left alone (the murmur blends in).
    Returns (audio, ms_trimmed)."""
    w = word.lower()
    kind = 'noise' if w.startswith(VOICELESS) else 'stop' if w.startswith(VOICED_STOPS) else None
    if not kind:
        return x, 0
    fr = frames(x)
    e = np.array([f['e'] for f in fr]); z = np.array([f['z'] for f in fr]); top = e.max()
    s = next(i for i in range(len(fr)) if e[i] > top - 30)
    v0 = main_vowel_start(fr)
    if v0 <= s + 2:
        return x, 0
    cut = None
    if kind == 'noise':
        # the first run of three noisy frames before the vowel
        n = next((i for i in range(s, v0 - 2) if z[i] > 0.15 and z[i + 1] > 0.15 and z[i + 2] > 0.15 and e[i] > top - 35), None)
        if n is not None and n > s:
            cut = max(0, fr[n]['i'] - int(SR * 0.005))
    else:
        # the closure: the quietest frame between the murmur and the vowel, clearly below the murmur
        i = min(range(s + 3, v0), key=lambda k: e[k])
        if e[i] < e[s:i].max() - 4:
            cut = fr[i]['i']
    if cut is None or cut <= fr[s]['i'] or cut >= fr[v0]['i']:
        return x, 0
    return x[cut:], round((cut - fr[s]['i']) / SR * 1000)


def main_vowel_start(fr):
    """Index of the first frame of the longest loud, periodic-looking (low zero-crossing) run."""
    e = np.array([f['e'] for f in fr]); z = np.array([f['z'] for f in fr]); top = e.max()
    ok = (e > top - 10) & (z < 0.12)
    runs, cur = [], None
    for k, v in enumerate(list(ok) + [False]):
        if v and cur is None: cur = k
        if not v and cur is not None: runs.append((cur, k)); cur = None
    return max(runs, key=lambda r: r[1] - r[0])[0] if runs else 0


class Voice:
    def __init__(self, model, voices, name='af_heart'):
        from kokoro_onnx import Kokoro
        self.k = Kokoro(model, voices)
        self.name = name

    def say(self, text, phonemes=False, speed=0.85, voice=None):
        a, sr = self.k.create(text, voice=voice or self.name, speed=speed, lang='en-us', is_phonemes=phonemes, trim=False)
        assert sr == SR
        return np.asarray(a, dtype=np.float32)
