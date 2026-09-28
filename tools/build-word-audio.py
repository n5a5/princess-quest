# tools/build-word-audio.py — generates the bundled word clips with Kokoro-82M (af_heart, Apache-2.0)
# run locally through kokoro-onnx (MIT). Not an app build step.
# Words come from content/phonics.json, sight-words.json, sounds.json (keyword pictures), pa.json
# (syllable words) and every word in sentences.json. Each clip: synthesized at speed 0.85 → leading
# "uh" murmur trimmed (see pqaudio.trim_lead_murmur) → silence trimmed → soft fades → peak -1 dBFS →
# Opus 32 kbps mono in assets/audio/words/<word>.ogg. Updates content/audio-manifest.json "words".
#
# Usage:  python tools/build-word-audio.py --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [--missing] [words...]
import argparse, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pqaudio as pa

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'words'


def all_words():
    words = []
    for st in json.loads((ROOT / 'content' / 'phonics.json').read_text(encoding='utf-8'))['stages']:
        words += [w['w'] for w in st['words']]
    sw = json.loads((ROOT / 'content' / 'sight-words.json').read_text(encoding='utf-8'))
    for lst in sw['lists'].values():
        words += lst
    words += [s['word'] for s in json.loads((ROOT / 'content' / 'sounds.json').read_text(encoding='utf-8'))['sounds'] if s.get('word')]
    words += [s[0] for s in json.loads((ROOT / 'content' / 'pa.json').read_text(encoding='utf-8'))['syllables']]
    for s in json.loads((ROOT / 'content' / 'sentences.json').read_text(encoding='utf-8'))['sentences']:
        words += [w.lower() if w != 'I' else w for w in re.sub(r"[^A-Za-z\s']", '', s['text']).split()]
    return sorted(set(w for w in words if re.fullmatch(r"[A-Za-z][a-z'-]*", w)))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart'); ap.add_argument('--missing', action='store_true')
    ap.add_argument('words', nargs='*')
    args = ap.parse_args()
    v = pa.Voice(args.model, args.voices, args.voice)
    words = all_words()
    if args.words: words = [w for w in words if w in set(args.words)]
    if args.missing: words = [w for w in words if not (OUT / f'{w}.ogg').exists()]
    OUT.mkdir(parents=True, exist_ok=True)
    done, trimmed = [], 0
    for w in words:
        x = v.say(w, speed=0.85)
        x = pa.trim_silence(x, -45, 5)
        x, cut = pa.trim_lead_murmur(x, w)
        if cut: trimmed += 1
        x = pa.normalise_peak(pa.fade(pa.trim_silence(x, -45, 10), 4, 15))
        pa.encode_opus(x, OUT / f'{w}.ogg', 32)
        done.append(w)
        print(f'{w:12} {len(x) / pa.SR * 1000:5.0f} ms' + (f'  (trimmed {cut} ms of lead murmur)' if cut else ''))
    man_path = ROOT / 'content' / 'audio-manifest.json'
    man = json.loads(man_path.read_text(encoding='utf-8'))
    man['words'] = sorted(set(man.get('words', [])) | set(done))
    man['wordsSource'] = 'Kokoro-82M af_heart (Apache-2.0) via kokoro-onnx; see tools/build-word-audio.py. Parent recordings override.'
    man_path.write_text(json.dumps(man, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {len(done)} word clips ({trimmed} had a lead murmur trimmed); manifest lists {len(man["words"])} words')


if __name__ == '__main__':
    main()
