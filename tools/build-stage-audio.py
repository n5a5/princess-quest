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
TEXTS = ROOT / 'tools' / 'stage-audio-texts.json'  # what each clip says (tools/ is not shipped)


def ranges(n, chain=True):
    """Every range the place can play: each single chunk and each tail, or for an echo-only block (chain: false)
    each chunk and the whole (shared/stage-plan.js clipRanges)."""
    out = {(i, i + 1) for i in range(n)} | ({(i, n) for i in range(n)} if chain else {(0, n)})
    return sorted(out)


def show_blocks(stage):
    """Every block Luna models: the warm-up and the show parts (Kate, the orphans' lines and songs)."""
    sh = stage['show']
    return [stage['warmup']] + sh['kate'] + sh['lines'] + sh['songs']


def cues(stage):
    """Every cue line, said by its character: (clip id, character, text). Blocks and Sandy's steps."""
    sh = stage['show']
    out = []
    for b in sh['kate'] + sh['lines'] + sh['songs'] + sh['sandy']:
        if b.get('cue'):
            c = b['cue']
            out.append((f"{b['id']}-cue", c['who'], c.get('say', c['text'])))
    return out


def render(v, text, speed, voice=None):
    first = text.split()[0].strip('"\'')
    raw = pa.trim_silence(v.say(text, speed=speed, voice=voice), -45, 5)
    x, _ = pa.trim_lead_murmur(raw, first, window_ms=450, max_ms=140)
    x, cut = pa.trim_tail_hiss(pa.trim_silence(x, -45, 20), text)
    return pa.fade(x, 5, 25), cut


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart'); ap.add_argument('--speed', type=float, default=0.85)
    ap.add_argument('--name', default='Amelia')
    ap.add_argument('--all', action='store_true', help='render every clip again, not only new or changed ones')
    args = ap.parse_args()
    stage = json.loads((ROOT / 'content' / 'stage.json').read_text(encoding='utf-8'))
    voices = stage['show']['voices']
    v = pa.Voice(args.model, args.voices, args.voice)
    OUT.mkdir(parents=True, exist_ok=True)
    # Kokoro is not deterministic: a clip whose voice and text did not change is kept as it is (TEXTS records
    # what each clip says), so a rebuild changes only what changed
    old = json.loads(TEXTS.read_text(encoding='utf-8')) if TEXTS.exists() else {}
    old_dur = json.loads((ROOT / 'content' / 'stage-audio.json').read_text(encoding='utf-8')) if (ROOT / 'content' / 'stage-audio.json').exists() else {}
    jobs = []
    for b in show_blocks(stage):
        # 'say' spells a chunk the way the voice should read it (Mister, not Mr.: Kokoro stops at the period)
        texts = [c.get('say', c['text']).replace('{name}', args.name) for c in b['chunks']]
        for i, j in ranges(len(texts), b.get('chain', True)):
            jobs.append((f"{b['id']}-{i}-{j}", args.voice, args.speed, ' '.join(texts[i:j])))
    for fid, who, text in cues(stage):
        # a cue is said by that character, never in Luna's voice: she learns to listen for who speaks before her
        jobs.append((fid, voices[who], 0.95, text))
    keep, dur, said = set(), {}, {}
    for fid, voice, speed, text in jobs:
        keep.add(fid)
        sig = f'{voice}|{speed}|{text}'
        said[fid] = sig
        if not args.all and old.get(fid) == sig and (OUT / f'{fid}.ogg').exists() and fid in old_dur:
            dur[fid] = old_dur[fid]
            continue
        x, cut = render(v, text, speed, voice)
        if cut: print(f'  {fid}: cut a {cut} ms hiss after the last word')
        pa.encode_checked(x, OUT / f'{fid}.ogg', 32, target=pa.LOUDNESS_LUFS)
        dur[fid] = round(len(x) / pa.SR * 1000)
        print(f'{fid}: {len(x) / pa.SR:.2f}s  [{voice}] {text}')
    for f in OUT.glob('*.ogg'):
        if f.stem not in keep: f.unlink()
    (ROOT / 'content' / 'stage-audio.json').write_text(json.dumps(dict(sorted(dur.items())), indent=0) + '\n', encoding='utf-8')
    TEXTS.write_text(json.dumps(dict(sorted(said.items())), indent=0, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
