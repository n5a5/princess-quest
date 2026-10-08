# tools/build-lines-audio.py — pre-renders every fixed line in content/lines.json (see collect-lines.py)
# with Kokoro-82M af_heart (Apache-2.0) via kokoro-onnx, so instructions, praise and stories can play in
# the same voice as the words and letter sounds instead of the device's text-to-speech.
# Output: assets/audio/lines/<id>.ogg (Opus 24 kbps mono) and content/lines-audio.json { key: id }.
# Unchanged lines are skipped (the id is a hash of the text and voice), so re-runs are quick.
# Usage: python tools/build-lines-audio.py --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [--voice af_heart]
import argparse, hashlib, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pqaudio as pa

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'lines'


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart'); ap.add_argument('--speed', type=float, default=0.9)
    ap.add_argument('--retrim', action='store_true', help='re-render existing lines whose lead trim changes with the first-word window')
    args = ap.parse_args()
    lines = json.loads((ROOT / 'content' / 'lines.json').read_text(encoding='utf-8'))
    v = pa.Voice(args.model, args.voices, args.voice)
    OUT.mkdir(parents=True, exist_ok=True)
    index, made = {}, 0
    for key, text in lines.items():
        fid = hashlib.sha1(f'{args.voice}|{args.speed}|{text}'.encode('utf-8')).hexdigest()[:12]
        index[key] = fid
        out = OUT / f'{fid}.ogg'
        first = text.split()[0].strip('"\'')
        if out.exists() and not (args.retrim and first.lower().startswith(pa.VOICELESS + pa.VOICED_STOPS)):
            continue
        raw = pa.trim_silence(v.say(text, speed=args.speed), -45, 5)
        # the murmur search stays inside the first word (about 450 ms) and never cuts more than 140 ms
        x, ms = pa.trim_lead_murmur(raw, first, window_ms=450, max_ms=140)
        if out.exists():
            _, old = pa.trim_lead_murmur(raw, first)
            if old == ms:
                continue
            print(f'retrim {text[:40]!r}: was {old} ms, now {ms} ms')
        # new lines get the common loudness; lines rendered before it existed keep their peak-normalised level
        x = pa.normalise_loudness(pa.fade(pa.trim_silence(x, -45, 20), 5, 25))
        pa.encode_opus(x, out, 24)
        made += 1
        if made % 50 == 0: print(made, 'rendered')
    keep = set(index.values())
    for f in OUT.glob('*.ogg'):
        if f.stem not in keep: f.unlink()
    (ROOT / 'content' / 'lines-audio.json').write_text(json.dumps({'voice': args.voice, 'ext': 'ogg', 'lines': dict(sorted(index.items()))}, indent=0, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{made} new, {len(index)} lines total -> content/lines-audio.json')


if __name__ == '__main__':
    main()
