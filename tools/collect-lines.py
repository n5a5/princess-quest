# tools/collect-lines.py — lists every sentence the app can speak that can be pre-rendered in one voice.
# Three sources:
#   1. JSON content: stories, poems, calm, scenarios, praise (with the child's name), decodable sentences.
#   2. Complete sentences inside string literals in the code, plus the FRAGMENTS around a letter sound
#      ('Which one starts with /' + p + '/?' gives the fragment "Which one starts with"), because the app
#      plays the fragment clip and the recorded letter sound back to back.
#   3. TEMPLATES: the common sentences with a changing word or number ("Which door says {w}?"), expanded
#      over the words and numbers the app can actually use. tests/content.test.js checks each template's
#      fixed text still appears in the code, so a reworded prompt cannot silently lose its recording.
# Keys match keyOf() in shared/audio.js: lower case, curly quotes straightened, spaces collapsed.
# Output: content/lines.json { "<key>": "<text to speak>" }.   Usage: python tools/collect-lines.py [--name Amelia]
import argparse, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SENT = re.compile(r'[^.!?:]+[.!?:]+["”\']?|[^.!?:]+$')
J = lambda f: json.loads((ROOT / 'content' / f).read_text(encoding='utf-8'))


def key_of(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', s).strip().lower()


def sentences(text):
    return [m.group(0).strip() for m in SENT.finditer(text) if m.group(0).strip()]


def usable(s, fragment=False):
    s = s.strip()
    if not re.search(r'[A-Za-z0-9]', s) or '{' in s or '<' in s or '/' in s:
        return False
    if fragment:
        return True
    return len(s.split()) >= 2 or s.endswith('!') or s.endswith('.')


# ---------- 1. JSON content ----------
def from_json(name):
    lines = []
    st = J('stories.json')
    for s in st['stories']:
        lines.append(s['title'] + '.')
        for sc in s['screens']:
            lines += sentences(sc['text']); lines.append(sc['question']['prompt'])
        lines.append(s['vocab']['question'])
    for p in st['poems']:
        lines += p['lines']; lines.append(p['rhymeQuestion']['prompt'])
    calm = J('calm.json')
    for b in calm['breathing']: lines += sentences(b['line'])
    for f in calm['feelings']: lines += sentences(f['tip'])
    for s in calm['stories']:
        for sc in s['screens']:
            lines += sentences(sc['text'])
            if sc.get('choice'):
                lines.append(sc['choice']['prompt'])
                for o in sc['choice']['options']: lines += sentences(o['feedback'])
    for b in calm['bodyScan']: lines += sentences(b['squeeze']) + sentences(b['release'])
    for s in J('scenarios.json')['scenarios']:
        lines += sentences(s['text'] + ' What would you do?')
        for c in s['choices']: lines += sentences(c['feedback'])
    for k, pool in J('praise.json').items():
        for p in pool: lines += sentences(p.replace('{name}', name))
    for s in J('sentences.json')['sentences']: lines.append(s['text'])
    st = J('stage.json')
    for p in st['pieces']: lines += sentences(p['intro']) + sentences(p['tip'])
    for b in J('books.json')['books']:
        lines.append(b['title'] + '.'); lines.append(b['question']['prompt'])
        for p in b['pages']: lines += sentences(p['text'])
    return [(l, False) for l in lines]


# ---------- 2. code literals and fragments ----------
LIT = re.compile(r"'((?:[^'\\\n]|\\.)*)'")


def from_code():
    out = []
    files = [ROOT / 'shell.js'] + sorted((ROOT / 'shared').glob('*.js')) + sorted((ROOT / 'games' / 'princess-quest').glob('*.js'))
    for f in files:
        src = f.read_text(encoding='utf-8')
        for m in LIT.finditer(src):
            text = m.group(1).replace("\\'", "'")
            if re.match(r'^(ELA|MA)\.[A-Z]', text):  # curriculum codes, never spoken
                continue
            before = src[:m.start()].rstrip()[-1:] if src[:m.start()].rstrip() else ''
            after = src[m.end():].lstrip()[:1]
            glued_before, glued_after = before == '+', after == '+'
            sound_before, sound_after = text.startswith('/'), text.endswith('/')
            core = text[1:] if sound_before else text
            core = core[:-1] if sound_after else core
            parts = sentences(core)
            if not parts:
                continue
            first_ok = (not glued_before) or sound_before or bool(re.match(r'^\s+[A-Z]', core)) or bool(re.match(r'^[.!?]', core))
            last_ok = (not glued_after) or sound_after or core.rstrip().endswith(('.', '!', '?', ':'))
            for i, p in enumerate(parts):
                is_first, is_last = i == 0, i == len(parts) - 1
                if is_first and not first_ok: continue
                if is_last and not last_ok: continue
                frag = (is_last and sound_after) or (is_first and sound_before)
                if frag and usable(p, True):
                    out.append((p, True))
                elif usable(p) and p[0].isupper():
                    out.append((p, False))
    return out


# ---------- 3. templates ----------
def vocab():
    pw = [w['w'] for st in J('phonics.json')['stages'] for w in st['words']]
    sw = [w for lst in J('sight-words.json')['lists'].values() for w in lst]
    kw = [s['word'] for s in J('sounds.json')['sounds'] if s.get('word')]
    squishies = ['Rosie', 'Minty', 'Sunny', 'Skye', 'Plummy', 'Peach', 'Berry', 'Leaf', 'Cloud', 'Lilac', 'Coral', 'Lemon', 'Teal', 'Blush', 'Moss', 'Fern', 'Dawn', 'Pebble']
    sort_names = ['pink Squishy', 'green Squishy', 'yellow Squishy', 'tulip', 'blossom', 'daisy', 'caterpillar', 'bee', 'butterfly', 'apple', 'strawberry', 'lemon']
    sort_bins = {'pink Squishy': 'pink', 'green Squishy': 'green', 'yellow Squishy': 'yellow', 'tulip': 'flowers', 'blossom': 'flowers', 'daisy': 'flowers',
                 'caterpillar': 'bugs', 'bee': 'bugs', 'butterfly': 'bugs', 'apple': 'fruit', 'strawberry': 'fruit', 'lemon': 'fruit'}
    return pw, sw, kw, squishies, sort_names, sort_bins


def gems(n): return f'{n} gem' if n == 1 else f'{n} gems'


# Pieces of the common sentences that carry a changing word or number. The app splices them with the
# bundled word clips and number clips (see segment() in shared/audio.js): "Which door says" + "big".
# Each piece must still appear in the code (tests/content.test.js), so a reworded prompt is caught.
PIECES = [
    'Build the word', 'That picture is', 'The word says', 'This says', 'Say', 'slowly.', 'Which one rhymes with',
    'That is still', 'Now it is', 'It is', 'That is', 'starts with', 'ends with', 'has', 'Which wish door says', 'That door says',
    'This door says', 'Spell the wish word', 'from memory.', 'Find the word', 'Look for', 'Luna has', 'gem.', 'gems.',
    'gem in her pouch.', 'gems in her pouch.', 'She finds', 'more.', 'She gives', 'to Rosie.', 'to Minty.', 'to Sunny.',
    'The crystal door needs', 'gems to open.', 'gems to share with Rosie.', 'Luna keeps', 'Luna finds', 'more gems.',
    'Luna is on', 'She rolls', 'gem and hops one stone.', 'gems and hops two stones.', 'gems and hops three stones.',
    'How many are in the', 'basket?', 'goes in the', 'basket.', 'Luna is looking for a', 'Find the', 'This is the',
    'You freed', 'the Squishy!', 'says thank you!', 'Ten gems for you,', 'Here it is:', 'Say it with me:', 'A new wish word:',
    'Listen for this sound:', 'We need', 'This stone says', 'That stone says', 'Luna says a word in two parts:',
    'Luna says a word in pieces:', 'Now take away the first sound,', 'Now take away the last sound,', 'Now change', 'to', 'and',
    'What word is left?', 'What word is it now?', 'is', 'more is', 'take away', 'make', 'and one more is', 'and one less is',
    'Which one starts with', 'Which one ends with', 'Which one has', 'Which picture starts with', 'Which picture ends with',
    'do not sound the same at the end.', 'Which basket has the most?', 'Which basket has the fewest?',
    'its sound?', 'The pattern goes', 'again and again.', 'comes next.', 'Now the path goes', 'Say it slowly:',
    # reveal lines (the answer shown after a second miss)
    'There were', 'gems long.', 'without', 'has the most.', 'has the fewest.', 'We can measure', 'how long it is.',
    'how heavy it is.', 'how much it holds.', 'is longer.', 'is heavier.', 'is taller.', 'has more.', 'holds more.',
    'They are the same length.', 'They weigh the same.', 'They are the same height.', 'They have the same.', 'They hold the same.',
]
SQUISHY_TOWER_NAMES = ['Rosie', 'Minty', 'Sunny', 'Skye', 'Plummy', 'Peach', 'Berry', 'Leaf', 'Cloud', 'Lilac', 'Coral', 'Lemon', 'Teal', 'Blush', 'Moss', 'Fern', 'Dawn', 'Pebble']  # shared/characters.js SQUISHY_KINDS
SLOT_WORDS = ['pink Squishy', 'green Squishy', 'yellow Squishy', 'tulip', 'blossom', 'daisy', 'caterpillar', 'bee', 'butterfly', 'apple',
              'strawberry', 'lemon', 'pink', 'green', 'yellow', 'flowers', 'bugs', 'fruit', 'circle', 'square', 'triangle', 'rectangle',
              'sphere', 'cube', 'cone', 'cylinder', 'Rosie', 'Minty', 'Sunny', 'Skye', 'Plummy', 'Peach', 'Berry', 'Leaf', 'Cloud',
              'Lilac', 'Coral', 'Lemon', 'Teal', 'Blush', 'Moss', 'Fern', 'Dawn', 'Pebble', 'gem', 'gems', 'more', 'less',
              # Rainbow Path pattern names (falls.js PAT_NAME)
              'heart', 'clover', 'star', 'moon', 'fire', 'purple', 'blue', 'orange',
              # Measure the Falls things (falls.js OBJECTS, HEAVY, HOLDS) and the jars
              'wand', 'ribbon', 'vine', 'scarf', 'ladder', 'A', 'An', 'rock', 'feather', 'pumpkin', 'leaf', 'book', 'balloon', 'apple',
              'spoon', 'cup', 'bottle', 'jug', 'bucket', 'bathtub', 'pink jar', 'green jar', 'The']
SLOT_WORDS += [n + "'s tower" for n in SQUISHY_TOWER_NAMES]
# The code builds some pieces from parts ('gems' comes from gems(n), names from a list), so each check is
# the part of the piece that is literally in the code.
def _check(p):
    p = re.sub(r'^gems? ', '', p)
    m = re.match(r'^to (Rosie|Minty|Sunny)\.$', p)
    if m: return m.group(1)
    if p.startswith('and hops '): return ' and hops '
    m2 = re.match(r'^Which (one|picture) (starts|ends) with$|^Which one has$', p)
    if m2: return 'Which ' + (m2.group(1) or 'one') + ' '
    if p.startswith('Which basket has the '): return 'Which basket has the '
    if p.startswith('They '): return p[5:-1]  # 'They ' + sameWord + '.', sameWord literal in falls.js
    if p in ('has the most.', 'has the fewest.'): return ' has the '
    p = p.replace('Now take away the first sound,', 'Now take away the ').replace('Now take away the last sound,', 'Now take away the ')
    p = p.replace('and one more is', ' and one ').replace('and one less is', ' and one ')
    return p
TEMPLATE_CHECKS = sorted({_check(p) for p in PIECES if len(p) > 3})


def from_templates(name):
    L = [(p, True) for p in PIECES] + [(w, True) for w in SLOT_WORDS] + [(name + '!', True), (name + '.', True), (name, True)]
    L += [(str(n), True) for n in list(range(0, 21)) + [30, 40, 50, 60, 70, 80, 90, 100]]
    return L


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--name', default='Amelia')
    args = ap.parse_args()
    out = {}
    for s, frag in from_json(args.name) + from_code() + from_templates(args.name):
        s = s.strip()
        if usable(s, frag):
            out.setdefault(key_of(s), s)
    (ROOT / 'content' / 'lines.json').write_text(json.dumps(dict(sorted(out.items())), indent=0, ensure_ascii=False) + '\n', encoding='utf-8')
    (ROOT / 'content' / 'line-templates.json').write_text(json.dumps(TEMPLATE_CHECKS, indent=0) + '\n', encoding='utf-8')
    print(f'{len(out)} lines -> content/lines.json')


if __name__ == '__main__':
    main()
