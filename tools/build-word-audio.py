# tools/build-word-audio.py — one-time generation of bundled word clips with Kokoro (Apache-2.0).
# Not a build step for the app. Reads every word in content/phonics.json (and content/sight-words.json
# if present), synthesizes it with the af_heart voice, trims silence, normalizes to -1 dBFS, encodes Opus
# 32 kbps mono into assets/audio/words/<word>.ogg, and updates content/audio-manifest.json "words".
# Requires the dev venv the TTS evaluation created (T:\.venv with kokoro + soundfile) and ffmpeg on PATH.
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'words'
OUT.mkdir(parents=True, exist_ok=True)

words = []
phon = json.loads((ROOT / 'content' / 'phonics.json').read_text(encoding='utf-8'))
for st in phon['stages']:
    words += [w['w'] for w in st['words']]
sw = ROOT / 'content' / 'sight-words.json'
if sw.exists():
    d = json.loads(sw.read_text(encoding='utf-8'))
    for lst in d.get('lists', {}).values():
        words += lst
# Keyword pictures for letter sounds (content/sounds.json), syllable words (content/pa.json) and every word
# in the decodable sentences (content/sentences.json) also get clips so tapping any word plays a real voice.
snd = ROOT / 'content' / 'sounds.json'
if snd.exists():
    words += [s['word'] for s in json.loads(snd.read_text(encoding='utf-8'))['sounds'] if s.get('word')]
pa = ROOT / 'content' / 'pa.json'
if pa.exists():
    words += [s[0] for s in json.loads(pa.read_text(encoding='utf-8'))['syllables']]
sen = ROOT / 'content' / 'sentences.json'
if sen.exists():
    for s in json.loads(sen.read_text(encoding='utf-8'))['sentences']:
        words += [w.lower() for w in re.sub(r"[^A-Za-z\s']", '', s['text']).split()]
words = sorted(set(w for w in words if re.fullmatch(r"[a-z][a-z'-]*", w)))
if '--missing' in sys.argv:
    words = [w for w in words if not (OUT / f'{w}.ogg').exists()]
    sys.argv = [a for a in sys.argv if a != '--missing']
only = set(sys.argv[1:])
if only:
    words = [w for w in words if w in only]

from kokoro import KPipeline
import soundfile as sf
pipe = KPipeline(lang_code='a')
tmp = Path(tempfile.mkdtemp(prefix='pq-words-'))

def ffprobe_gain(path):
    r = subprocess.run(['ffmpeg', '-i', str(path), '-af', 'volumedetect', '-f', 'null', 'NUL'], capture_output=True, text=True)
    m = re.search(r'max_volume: (-?[\d.]+) dB', r.stderr)
    return -1.0 - float(m.group(1)) if m else 0.0

done = []
for w in words:
    raw = tmp / f'{w}.wav'
    # Kokoro yields (graphemes, phonemes, audio) chunks; a single word is one chunk.
    for _, _, audio in pipe(w, voice='af_heart', speed=0.85):
        sf.write(str(raw), audio, 24000)
        break
    trimmed = tmp / f'{w}.trim.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(raw), '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.04', str(trimmed)], check=True)
    gain = ffprobe_gain(trimmed)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(trimmed), '-af', f'volume={gain:.2f}dB', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', str(OUT / f'{w}.ogg')], check=True)
    done.append(w)
    print(w, f'{gain:+.1f}dB')

man_path = ROOT / 'content' / 'audio-manifest.json'
man = json.loads(man_path.read_text(encoding='utf-8'))
existing = set(man.get('words', []))
man['words'] = sorted(existing | set(done))
man['wordsSource'] = 'Kokoro-82M af_heart (Apache-2.0) via tools/build-word-audio.py; parent recordings override.'
man_path.write_text(json.dumps(man, indent=2) + '\n', encoding='utf-8')
print(f'wrote {len(done)} word clips; manifest lists {len(man["words"])} words')
