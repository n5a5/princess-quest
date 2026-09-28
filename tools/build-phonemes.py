# tools/build-phonemes.py — builds the bundled letter-sound clips (assets/audio/phonemes/<id>.ogg).
# Not an app build step: run it when content/sounds.json changes or the voice changes.
#
# Why this exists: the first set (the old Windows SAPI + SSML IPA script, removed) produced clips
# with only ~30 ms of real sound followed by near-silence. On laptop and Chromebook speakers that is a click.
#
# Everything is made with Kokoro-82M (Apache-2.0 code and weights), voice af_heart, the same voice as the
# bundled word clips, run locally through kokoro-onnx (MIT). Kokoro cannot hold a hissing sound on its own
# (asked for "sːːː" it says "suh"), so each sound comes from whichever source is clean for it:
#   held      vowels, m, n, ng, l, r, y  — phoneme input with length marks ("æːːː"), steady part kept
#   final     s, f, sh, th, z, v, and the stops p t k b d g, ch — cut from the END of a word ("bus",
#             "cap"), where the model releases the sound cleanly with no vowel after it
#   initial   j (jam), h, w — cut from the start of a word or a short phoneme input, before the vowel
#   combo     qu = k + w, x = k + s
# Continuous sounds keep only their steady middle and are stretched with ffmpeg's pitch-preserving
# atempo to a teachable length (~0.5 s). Stops keep the burst only (~0.1 s, no "uh"). Every clip gets a
# soft fade in and out, 20 ms of lead silence, loudness normalisation, and Opus 48 kbps.
#
# Measurements are written to content/phoneme-stats.json on every build (tests/audio-assets.test.js reads
# it): duration, active length, loudness, start amplitude, byte size, and for short vowels an F1/F2 estimate
# (informational only). The ear is the final check: Parent Corner → Sound Check plays each one.
#
# Usage (from the repo root, with a venv that has kokoro-onnx, numpy, soundfile):
#   python tools/build-phonemes.py --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [ids...]
# Model files: https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0). Needs ffmpeg on PATH.
import argparse, json, subprocess, tempfile, datetime
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'phonemes'
SR = 24000
VOICE = 'af_heart'
TMP = Path(tempfile.mkdtemp(prefix='pq-phon-'))

# id: (method, source, target ms)
PLAN = {
    'a':  ('held', 'æːːː', 480),  'e':  ('held', 'ɛːːː', 480),  'i':  ('held', 'ɪːːː', 480),
    'o':  ('held', 'ɑːːː', 480),  'u':  ('held', 'ʌːːː', 480),
    'ae': ('held', 'eːːɪ', 520),  'ee': ('held', 'iːːː', 520),  'ie': ('held', 'aːːɪ', 520),
    'oe': ('held', 'oːːʊ', 520),  'ue': ('held', 'juːːː', 540),
    'm':  ('held', 'mːːːː', 540), 'n':  ('held', 'nːːːː', 540), 'ng': ('held', 'ŋːːː', 520),
    'l':  ('held', 'lːːːː', 520), 'r':  ('held', 'ɹːːːː', 520), 'y':  ('held', 'jː', 300),
    's':  ('final', 'bus', 540),  'f':  ('final', 'puff', 540), 'sh': ('final', 'fish', 540),
    'th': ('final', 'bath', 520), 'z':  ('final', 'buzz', 520), 'v':  ('final', 'five', 480),
    'p':  ('final', 'cap', 0),    't':  ('final', 'cat', 0),    'k':  ('final', 'back', 0),
    'b':  ('initial', 'box', 0),  'd':  ('initial', 'dog', 0),  'g':  ('initial', 'gas', 0),
    'ch': ('final', 'rich', 0),
    'j':  ('initial', 'jam', 0),  'h':  ('initial', 'hːːː', 260), 'w': ('initial', 'wː', 260),
}
COMBOS = {'qu': ['k', 'w'], 'x': ['k', 's']}
STOPS = {'p', 't', 'k', 'b', 'd', 'g'}
NOISE = {'s', 'f', 'sh', 'th', 'z', 'v', 'h'}
TARGET_RMS_DB = -18.0
PEAK_DB = -1.0
# Expected first/second formant ranges (Hz) for a female voice. Wide on purpose: they catch a wrong vowel
# or a schwa, not fine accent differences.
FORMANTS = {'a': ((650, 1150), (1450, 2400)), 'e': ((480, 850), (1700, 2600)), 'i': ((330, 620), (1900, 2900)),
            'o': ((650, 1200), (950, 1600)), 'u': ((550, 950), (1150, 1800))}


# ---------- audio helpers ----------
def run_ff(args, data=None):
    return subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, input=data, capture_output=True, check=True).stdout


def to_wav(x, path, sr=SR):
    run_ff(['-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', str(path)], x.astype(np.float32).tobytes())


def from_file(path, sr=SR):
    return np.frombuffer(run_ff(['-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-']), dtype=np.float32).copy()


def frames(x, win=0.02, hop=0.005):
    w, h = int(SR * win), int(SR * hop)
    out = []
    for i in range(0, max(1, len(x) - w), h):
        f = x[i:i + w]
        e = 20 * np.log10(np.sqrt(np.mean(f ** 2)) + 1e-9)
        z = np.mean(np.abs(np.diff(np.sign(f)))) / 2
        spec = np.abs(np.fft.rfft(f * np.hanning(len(f)))) ** 2
        freqs = np.fft.rfftfreq(len(f), 1 / SR)
        low = spec[freqs < 500].sum() / (spec.sum() + 1e-12)
        out.append({'i': i, 'e': e, 'z': z, 'low': low})
    return out, h


def steady(x, max_drop_db=5, min_ms=60):
    """Longest run of frames within max_drop_db of the loudest frame."""
    fr, h = frames(x)
    e = np.array([f['e'] for f in fr]); top = e.max()
    ok = e > top - max_drop_db
    best, cur = (0, 0), None
    for k, v in enumerate(list(ok) + [False]):
        if v and cur is None: cur = k
        if not v and cur is not None:
            if k - cur > best[1] - best[0]: best = (cur, k)
            cur = None
    s0, s1 = fr[best[0]]['i'], fr[best[1] - 1]['i'] + int(SR * 0.02)
    if (s1 - s0) / SR * 1000 < min_ms:
        raise RuntimeError('steady part too short')
    return x[s0:s1]


def stretch(x, target_ms, name):
    cur = len(x) / SR * 1000
    factor = cur / target_ms
    if factor >= 0.98:
        return x
    parts, f = [], factor
    while f < 0.5:
        parts.append(0.5); f /= 0.5
    parts.append(f)
    src, dst = TMP / f'{name}.in.wav', TMP / f'{name}.st.wav'
    to_wav(x, src)
    run_ff(['-i', str(src), '-af', ','.join(f'atempo={p:.4f}' for p in parts), '-ar', str(SR), '-ac', '1', str(dst)])
    return from_file(dst)


def envelope(x, fade_in_ms, fade_out_ms):
    x = x.copy()
    fi, fo = int(SR * fade_in_ms / 1000), int(SR * fade_out_ms / 1000)
    fi, fo = min(fi, len(x) // 3), min(fo, len(x) // 2)
    if fi: x[:fi] *= np.linspace(0, 1, fi) ** 2
    if fo: x[-fo:] *= np.linspace(1, 0, fo) ** 2
    return x


def active(x, sr=SR):
    w = int(sr * 0.02)
    fr = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)]) if len(x) > w else np.array([np.sqrt(np.mean(x ** 2))])
    act = fr[fr > 10 ** (-40 / 20)]
    return (float(20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12)) if len(act) else -99.0), len(act) * 20


def normalise(x):
    rms, _ = active(x)
    y = x * 10 ** ((TARGET_RMS_DB - rms) / 20)
    pk = np.abs(y).max(); lim = 10 ** (PEAK_DB / 20)
    return y * (lim / pk) if pk > lim else y


def formants(x, order=12):
    """Median F1, F2 over 40 ms frames (LPC at 10 kHz). Informational: unreliable for back vowels, where
    F1 and F2 sit close together, so it is recorded in phoneme-stats.json but never blocks a build."""
    src = TMP / 'fm.wav'; to_wav(x, src)
    y = from_file(src, 10000)
    w, out = 400, []
    for i in range(len(y) // 4, 3 * len(y) // 4 - w, 200):
        f = y[i:i + w]; f = np.append(f[0], f[1:] - 0.63 * f[:-1]) * np.hamming(w)
        r = np.correlate(f, f, 'full')[w - 1:w + order]
        R = np.array([[r[abs(a - b)] for b in range(order)] for a in range(order)])
        c = np.linalg.solve(R + np.eye(order) * r[0] * 1e-9, -r[1:order + 1])
        rts = [z for z in np.roots(np.concatenate([[1.0], c])) if np.imag(z) > 0.01]
        fs = sorted((np.angle(z) * 10000 / (2 * np.pi), -10000 / np.pi * np.log(abs(z))) for z in rts)
        fs = [q for q, bw in fs if q > 200 and bw < 400]
        if len(fs) >= 2: out.append(fs[:2])
    return [int(v) for v in np.median(np.array(out), axis=0)] if out else [0, 0]


# ---------- sources ----------
class Voice:
    def __init__(self, model, voices):
        from kokoro_onnx import Kokoro
        self.k = Kokoro(model, voices)

    def say(self, text, phonemes=False, speed=0.8):
        a, sr = self.k.create(text, voice=VOICE, speed=speed, lang='en-us', is_phonemes=phonemes)
        assert sr == SR
        return np.asarray(a, dtype=np.float32)


def final_segment(x, pid):
    """The sound after the word's last vowel: for stops the release burst after the closure silence."""
    fr, h = frames(x)
    e = np.array([f['e'] for f in fr]); z = np.array([f['z'] for f in fr])
    top = e.max()
    loud = np.where(e > top - 30)[0]
    end = loud[-1]
    # vowel: the last frame that is loud and not noisy
    vowel = [k for k in range(len(fr)) if e[k] > top - 10 and z[k] < 0.12]
    v_end = vowel[-1]
    if pid in STOPS or pid == 'ch':
        # the closure is the quietest frame in the 100 ms after the vowel; the burst is the first frame after
        # it that turns noisy or jumps in energy
        win = range(v_end, min(end, v_end + 20) + 1)
        closure = min(win, key=lambda k: e[k])
        burst = next((k for k in range(closure + 1, end + 1) if z[k] > 0.15 or e[k] > e[closure] + 4), closure + 1)
        s0 = fr[max(burst - 1, 0)]['i']
        s1 = fr[end]['i'] + int(SR * 0.02)
        return x[s0:s1]
    # fricatives: frames after the vowel whose zero-crossing rate says noise
    thr = 0.12 if pid in ('z', 'v') else 0.2
    noisy = [k for k in range(v_end, end + 1) if z[k] > thr]
    if not noisy:
        raise RuntimeError('no final noise')
    s0 = fr[noisy[0]]['i']; s1 = fr[noisy[-1]]['i'] + int(SR * 0.02)
    return x[s0:s1]


def main_vowel_start(fr):
    e = np.array([f['e'] for f in fr]); z = np.array([f['z'] for f in fr]); top = e.max()
    ok = (e > top - 10) & (z < 0.12)
    runs, cur = [], None
    for k, v in enumerate(list(ok) + [False]):
        if v and cur is None: cur = k
        if not v and cur is not None: runs.append((cur, k)); cur = None
    return max(runs, key=lambda r: r[1] - r[0])[0]


def initial_segment(x, pid):
    fr, h = frames(x)
    e = np.array([f['e'] for f in fr]); z = np.array([f['z'] for f in fr])
    top = e.max()
    start = next(k for k in range(len(fr)) if e[k] > top - 30)
    if pid in ('b', 'd', 'g'):
        # voiced stop: from the closure (the quietest point before the vowel) through the burst and ~45 ms
        # of the stop's own voicing. Shorter sounds like a click; much longer starts to say "buh".
        v0 = main_vowel_start(fr)
        i = min(range(start + 3, v0), key=lambda k: e[k]) if v0 > start + 3 else start
        return x[fr[i]['i']: fr[v0]['i'] + int(SR * 0.045)]
    if pid in STOPS or pid == 'j':
        # the consonant is the noisy run right before the vowel (this skips the short voiced murmur the
        # model sometimes puts before a word); stops keep 10 ms of the vowel onset so voiced stops are heard
        v0 = main_vowel_start(fr)
        k = v0 - 1
        while k > 0 and (z[k] > 0.12 or z[k - 1] > 0.12) and e[k] > top - 40: k -= 1
        s0 = fr[max(k, 0)]['i']
        # voiced stops (b, d, g) keep ~30 ms of their own voicing so the burst is heard as that sound, not a
        # click; voiceless stops keep 12 ms; anything longer would start to say "uh"
        s1 = fr[v0]['i'] + int(SR * (0.03 if pid in ('b', 'd', 'g') else 0.012 if pid in STOPS else 0.0))
        if s1 - s0 < int(SR * 0.02): s0 = max(0, s1 - int(SR * 0.05))
        return x[s0:s1]
    if pid == 'h':
        noisy = [k for k in range(start, len(fr)) if z[k] > 0.15]
        if not noisy: raise RuntimeError('no h noise')
        return x[fr[noisy[0]]['i']: fr[noisy[-1] if noisy[-1] - noisy[0] < 40 else noisy[0] + 20]['i'] + int(SR * 0.02)]
    return x[fr[start]['i']:]


# ---------- build ----------
def build_one(v, pid):
    if pid in COMBOS:
        a, b = [build_one(v, c)[0] for c in COMBOS[pid]]
        b = envelope(b[: int(SR * (0.32 if pid == 'x' else 0.22))], 4, 50)
        return np.concatenate([a, np.zeros(int(SR * 0.004), dtype=np.float32), b]), {}
    method, src, target = PLAN[pid]
    info = {'method': method, 'source': src}
    if method == 'held':
        x = v.say(src, phonemes=True)
        if pid in ('m', 'n', 'ng'):
            # keep only nasal murmur (energy mostly below 500 Hz), never the vowel the model may add after it
            fr, h = frames(x)
            nas = [k for k, f in enumerate(fr) if f['low'] > 0.7 and f['e'] > max(ff['e'] for ff in fr) - 12]
            runs, cur = [], [nas[0]]
            for k in nas[1:]:
                if k == cur[-1] + 1: cur.append(k)
                else: runs.append(cur); cur = [k]
            runs.append(cur)
            run = max(runs, key=len)
            x = x[fr[run[0]]['i']: fr[run[-1]]['i'] + int(SR * 0.02)]
            seg = x[int(len(x) * 0.1): int(len(x) * 0.9)]
        else:
            seg = steady(x, 5 if pid in FORMANTS else 7)
            seg = seg[int(len(seg) * 0.08): int(len(seg) * 0.92)]
        y = envelope(stretch(seg, target, pid), 30, 90)
        if pid in FORMANTS:
            f1, f2 = formants(seg)
            info['F1'], info['F2'] = round(f1), round(f2)
            (lo1, hi1), (lo2, hi2) = FORMANTS[pid]
            info['formants_in_range'] = bool(lo1 <= f1 <= hi1 and lo2 <= f2 <= hi2)
        return y, info
    if method == 'final':
        x = v.say(src)
        seg = final_segment(x, pid)
        if pid in STOPS:
            return envelope(seg[: int(SR * 0.12)], 2, 25), info
        if pid == 'ch':
            return envelope(seg[: int(SR * 0.26)], 3, 45), info
        core = seg[int(len(seg) * 0.15): int(len(seg) * 0.85)]
        return envelope(stretch(core, target, pid), 35, 90), info
    x = v.say(src, phonemes=pid in ('h', 'w'))
    seg = initial_segment(x, pid)
    if pid in ('b', 'd', 'g'):
        return envelope(seg[-int(SR * 0.13):], 2, 35), info
    if pid in STOPS:
        return envelope(seg[-int(SR * 0.12):], 2, 30), info
    if pid == 'j':
        return envelope(seg[: int(SR * 0.26)], 3, 45), info
    if pid == 'w':
        seg = steady(seg, 6, 40)
        return envelope(stretch(seg, target, pid), 25, 110), info
    return envelope(stretch(seg, target, pid), 30, 90), info


def main():
    import sys; sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('ids', nargs='*')
    args = ap.parse_args()
    v = Voice(args.model, args.voices)
    sounds = [s['id'] for s in json.loads((ROOT / 'content' / 'sounds.json').read_text(encoding='utf-8'))['sounds']]
    stats_path = ROOT / 'content' / 'phoneme-stats.json'
    stats = json.loads(stats_path.read_text(encoding='utf-8')) if stats_path.exists() else {}
    bad = []
    for pid in sounds:
        if args.ids and pid not in args.ids:
            continue
        y, info = build_one(v, pid)
        y = normalise(y)
        y = np.concatenate([np.zeros(int(SR * 0.02), dtype=np.float32), y])
        wav = TMP / f'{pid}.wav'; to_wav(y, wav)
        out = OUT / f'{pid}.ogg'
        run_ff(['-i', str(wav), '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', str(out)])
        z = from_file(out)
        rms, act_ms = active(z)
        stats[pid] = {**info, 'ms': round(len(z) / SR * 1000), 'active_ms': act_ms, 'active_rms_db': round(rms, 1),
                      'peak_db': round(float(20 * np.log10(np.abs(z).max() + 1e-12)), 1),
                      'start_amp': round(float(np.abs(z[: int(SR * 0.002)]).max()), 4), 'bytes': out.stat().st_size}
        extra = f"  F1 {info['F1']} F2 {info['F2']}" if 'F1' in info else ''
        print(f"{pid:3} {info.get('method', 'combo'):7} {str(info.get('source', '+'.join(COMBOS.get(pid, [])))):6} {stats[pid]['ms']:4} ms, active {act_ms:4} ms, {rms:6.1f} dB{extra}")
    stats_path.write_text(json.dumps(dict(sorted(stats.items())), indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    man_path = ROOT / 'content' / 'audio-manifest.json'
    man = json.loads(man_path.read_text(encoding='utf-8'))
    man['source'] = 'Letter sounds made with Kokoro-82M af_heart (Apache-2.0) via kokoro-onnx; see tools/build-phonemes.py. Parent recordings override.'
    man['generated'] = datetime.date.today().isoformat()
    man_path.write_text(json.dumps(man, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
