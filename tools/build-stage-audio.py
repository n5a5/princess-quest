# tools/build-stage-audio.py — the Star Stage model clips (content/stage.json) in the story voice, Kokoro-82M
# af_heart (Apache-2.0) via kokoro-onnx. Each block (warm-up, slate, line, song) is a list of chunks; the
# place plays one chunk when a picture is tapped and every tail (chunk i to the end) for backward chaining,
# so those ranges are rendered: assets/audio/stage/<block>-<i>-<j>.ogg covers chunks i..j-1.
# A tail is rendered as one sentence, not spliced from chunks, so it keeps natural phrasing. Every clip is set to
# the same loudness (pqaudio.normalise_loudness; needs pyloudnorm). Each clip's length goes to
# content/stage-audio.json { id: ms }, so the place can light each picture as Luna says its words.
# Usage: python tools/build-stage-audio.py --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [--name Amelia]
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pqaudio as pa

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'stage'


def ranges(n):
    """Every range the place can play: each single chunk and each tail (shared/stage-plan.js clipRanges)."""
    out = {(i, i + 1) for i in range(n)} | {(i, n) for i in range(n)}
    return sorted(out)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart'); ap.add_argument('--speed', type=float, default=0.85)
    ap.add_argument('--name', default='Amelia')
    args = ap.parse_args()
    stage = json.loads((ROOT / 'content' / 'stage.json').read_text(encoding='utf-8'))
    blocks = [stage['warmup'], stage['slate']] + stage['pieces']
    v = pa.Voice(args.model, args.voices, args.voice)
    OUT.mkdir(parents=True, exist_ok=True)
    keep, dur = set(), {}
    for b in blocks:
        texts = [c['text'].replace('{name}', args.name) for c in b['chunks']]
        for i, j in ranges(len(texts)):
            fid = f"{b['id']}-{i}-{j}"
            keep.add(fid)
            text = ' '.join(texts[i:j])
            first = text.split()[0].strip('"\'')
            raw = pa.trim_silence(v.say(text, speed=args.speed), -45, 5)
            x, _ = pa.trim_lead_murmur(raw, first, window_ms=450, max_ms=140)
            x = pa.normalise_loudness(pa.fade(pa.trim_silence(x, -45, 20), 5, 25))
            pa.encode_opus(x, OUT / f'{fid}.ogg', 32)
            dur[fid] = round(len(x) / pa.SR * 1000)
            print(f'{fid}: {len(x) / pa.SR:.2f}s  {text}')
    for f in OUT.glob('*.ogg'):
        if f.stem not in keep: f.unlink()
    (ROOT / 'content' / 'stage-audio.json').write_text(json.dumps(dict(sorted(dur.items())), indent=0) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
