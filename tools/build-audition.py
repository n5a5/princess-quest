# tools/build-audition.py — renders the Parent Corner voice audition: the same words, instructions and a
# short story in each shortlisted voice, so a parent can choose by ear. Not an app build step.
# Voices: Kokoro-82M (Apache-2.0 code and weights) af_heart, af_bella, af_sarah, am_michael via kokoro-onnx
# (MIT); Piper (GPL-3.0 program, used only here at build time; the audio carries no licence) with the
# public-domain "kristin" voice. Output: assets/audio/audition/<voice>/<n>.ogg and content/audition.json.
# Usage: python tools/build-audition.py --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin> [--piper <kristin.onnx>]
import argparse, json, sys, wave, io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import pqaudio as pa

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'audio' / 'audition'
WORDS = ['cat', 'ship', 'fish', 'jump', 'the', 'rainbow', 'unicorn', 'seven', 'frog', 'said']
LINES = [
    'Welcome to Unicorn Meadow! Which magic today?',
    'Tap each letter stone to hear its sound. Read the word. Then tap its picture.',
    'Build the word you hear. Put the letter stones in order.',
    'Listen and put the sounds together. Which picture is it?',
    'Luna has three gems in her pouch. She finds two more. How many gems does she have now?',
    'Which one is heavier? Or are they the same?',
    'Amazing, Amelia! You did it!',
    'Almost! Look at the glowing one.',
    'You freed a Squishy! Rosie says thank you!',
    'Great job! One more, or all done?',
]
STORY = ('Luna the unicorn had a gem. It was pink. It could glow. One day the gem was gone! '
         'Luna looked in the grass. She looked by the pond. A little Squishy popped up. "I have it!" said Rosie.')
VOICES = [
    {'id': 'af_heart', 'engine': 'kokoro', 'label': 'Heart (Kokoro)', 'note': 'Warm US female. Already used for the words and letter sounds.', 'license': 'Apache-2.0'},
    {'id': 'af_bella', 'engine': 'kokoro', 'label': 'Bella (Kokoro)', 'note': 'Bright US female.', 'license': 'Apache-2.0'},
    {'id': 'af_sarah', 'engine': 'kokoro', 'label': 'Sarah (Kokoro)', 'note': 'Calm US female.', 'license': 'Apache-2.0'},
    {'id': 'am_michael', 'engine': 'kokoro', 'label': 'Michael (Kokoro)', 'note': 'Gentle US male.', 'license': 'Apache-2.0'},
    {'id': 'kristin', 'engine': 'piper', 'label': 'Kristin (Piper)', 'note': 'US female, public-domain voice. Lighter, more robotic.', 'license': 'Public domain voice'},
]


def piper_say(model, text):
    from piper import PiperVoice
    global _piper
    try: _piper
    except NameError: _piper = PiperVoice.load(model)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        _piper.synthesize_wav(text, w)
    buf.seek(0)
    with wave.open(buf, 'rb') as w:
        sr = w.getframerate(); data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    tmp = pa.TMP / 'piper.wav'; pa.to_wav(data, tmp, sr)
    return pa.from_file(tmp)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True); ap.add_argument('--voices', required=True); ap.add_argument('--piper')
    args = ap.parse_args()
    k = pa.Voice(args.model, args.voices)
    items = [{'kind': 'word', 'text': w} for w in WORDS] + [{'kind': 'line', 'text': t} for t in LINES] + [{'kind': 'story', 'text': STORY}]
    voices = []
    for v in VOICES:
        if v['engine'] == 'piper' and not args.piper:
            continue
        d = OUT / v['id']; d.mkdir(parents=True, exist_ok=True)
        for n, it in enumerate(items):
            if v['engine'] == 'kokoro':
                x = k.say(it['text'], speed=0.85 if it['kind'] == 'word' else 0.9, voice=v['id'])
            else:
                x = piper_say(args.piper, it['text'])
            x = pa.trim_silence(x, -45, 5)
            if it['kind'] == 'word':
                x, _ = pa.trim_lead_murmur(x, it['text'])
            x = pa.normalise_peak(pa.fade(pa.trim_silence(x, -45, 15), 5, 25))
            pa.encode_opus(x, d / f'{n}.ogg', 32)
        voices.append(v)
        print('rendered', v['id'])
    (ROOT / 'content' / 'audition.json').write_text(json.dumps({'items': items, 'voices': voices}, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
