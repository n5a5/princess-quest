# One voice for Princess Quest: open TTS options (research as of 2026-09-27)

Goal: one warm, natural, consistent US-English voice for (a) fixed lines, (b) dynamic lines, (c) isolated phonemes. The app is an offline static PWA on GitHub Pages. Pre-rendering happens on a Windows 11 PC with CPU only.

**How this was verified.** Licenses, dates and file sizes come from the GitHub REST API (`/repos/...` `license.spdx_id`), the Hugging Face model API (`/api/models/<id>` `cardData.license`, plus file sizes from `?blobs=true`), the npm and PyPI registries, and the READMEs. All of these were fetched today. Quality comes from the live TTS Arena V2 JSON (`https://tts-agi-tts-arena-v2.hf.space/api/leaderboard`, fetched today) and from the Artificial Analysis Speech Arena page (read through a summarizer, so treat those exact numbers as approximate). **Nothing was listened to.** No model was run on this PC. Speed numbers are vendor or third-party claims unless noted.

Legend: **NC** = non-commercial. **SA** = share-alike. **Consent** = the terms restrict cloning a voice without its owner's consent. **(unverified)** = I could not confirm this from a primary source.

---

## 1. TL;DR recommendation

1. **Standardize on Kokoro-82M `af_heart` everywhere.** You already use it for words. It has Apache-2.0 code and Apache-2.0 weights. On the TTS Arena V2 board it is statistically tied with Chatterbox (1483 ± 23 vs 1485 ± 19) and about 30 Elo below ElevenLabs v2/v3. It is the only top-tier open voice that also runs in the browser (kokoro-js). It also accepts phoneme input and gives per-phoneme durations, which you need for (c).
2. **Pre-render everything you can, including "dynamic" lines.** Enumerate the templates at build time and concatenate clips. On-device neural TTS on a mid-range Android phone is slow. One developer measured kokoro-js WASM q8 at roughly 3.5x *slower* than real time on phones ([Aloud PR #15](https://github.com/WestSmith/Aloud/pull/15)). GitHub Pages cannot send COOP/COEP headers, so multi-threaded WASM needs a service-worker shim.
3. **Phonemes: cut them out of Kokoro `af_heart` carrier words** using the model's own phoneme durations. Time-stretch the continuants (/m/, /s/, /f/…) to "hold" them. Trim stops to burst plus aspiration. This keeps one voice. The only openly licensed human set that looks usable is Feed the Monster's English letter sounds (CC-BY per its README). The speaker and accent are unverified, and it is a different voice. Wikimedia IPA files are not suitable (details in section 5).

---

## 2. Comparison table

Licenses are listed as *code / weights*. The "Browser" column means running offline in a PWA on a mid-range Chromebook or Android phone.

| Model (latest) | Code license | Weights license | US-English voices (warm picks) | Quality evidence | Size on disk | Browser? | CPU pre-render | Phoneme input |
|---|---|---|---|---|---|---|---|---|
| **Kokoro-82M v1.0** (Jan 2025; still the latest English release) | Apache-2.0 ([hexgrad/kokoro](https://github.com/hexgrad/kokoro)) | Apache-2.0 ([HF](https://huggingface.co/hexgrad/Kokoro-82M)) | 20 US voices. Best graded: **af_heart (A)**, **af_bella (A-)**, af_nicole (B-, whispery "headphones" voice), af_aoede/af_kore/af_sarah (C+) ([VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)) | TTS Arena V2: **1483 ± 23** (Chatterbox 1485, Eleven Multilingual v2 1513, Eleven v3 1510). AA Speech Arena: ~1065, 5th among open-weight models | .pth 327 MB. ONNX: fp32 326 MB, fp16 163 MB, q8 92 MB, q8f16 86 MB, q4f16 155 MB. 0.5 MB per voice ([onnx-community](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)) | **Yes**: `kokoro-js` 1.2.1 (Apache-2.0, npm unpacked 30 MB, uses transformers.js + onnxruntime-web, WASM or WebGPU). Slow on phones (see §4) | Fast. Reported several times faster than real time on desktop CPUs (unverified on your PC; you already render words with it) | **Yes.** misaki inline `[word](/fəˈnɛtɪks/)`. `kokoro-onnx` has `create(..., is_phonemes=True)`. kokoro-js has `tokenizer()` + `generate_from_ids()`. Per-phoneme durations: `pred_dur` in KPipeline, `create_timed()` in kokoro-onnx (needs a duration-output export) |
| **Piper** (piper1-gpl v1.8.0, 2026-09-04) | **GPL-3.0** ([OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl)). The old MIT repo [rhasspy/piper](https://github.com/rhasspy/piper) is **archived** | Per voice ([piper-voices](https://huggingface.co/rhasspy/piper-voices), repo tagged MIT). **lessac is research-only** ([Blizzard 2013 licence](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html)). amy, hfc_*, ryan, libritts_r and others are *fine-tuned from lessac*. hfc_female and ryan are also **CC-BY-NC-SA**. Clean from-scratch voices: **ljspeech (PD), kristin (PD), norman (PD)**. kathleen is CC0 data but fine-tuned from ryan | US: amy, arctic, bryce, danny, hfc_female/male, joe, john, kathleen, kristin, kusal, lessac, libritts(_r), ljspeech, mike, norman, ryan, sam. Warm plus clean licence: **kristin**, **ljspeech** | Not on the arenas. Generally rated clearly below Kokoro (secondary sources) | medium ≈ 63 MB (kristin), high ≈ 114 MB (ljspeech) | **Yes**: `@mintplex-labs/piper-tts-web` 1.0.5 (MIT wrapper, ~0.5 MB plus model plus ORT WASM) or `sherpa-onnx` WASM. Both bundle **espeak-ng (GPL-3)** compiled to WASM | Very fast (VITS). Real-time factor well below 0.1 on desktop CPUs is commonly reported (unverified) | **Yes**: raw espeak phonemes in `[[ ... ]]`. Per-phoneme sample alignments (`include_alignments=True`) ([ALIGNMENTS.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/ALIGNMENTS.md)) |
| **Kitten TTS 0.8** (Feb 2026) | Apache-2.0 ([KittenML/KittenTTS](https://github.com/KittenML/KittenTTS)) | Apache-2.0 | 8 voices: Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo. Accent assumed US (unverified) | Not on the arenas. "Developer preview". The README warns about int8 nano issues | mini 80M = 78 MB. micro 40M = 41 MB. nano 15M = 56 MB fp32 / **25 MB int8** | Community ports only ([kitten-tts-web-demo](https://github.com/clowerweb/kitten-tts-web-demo), sherpa-onnx WASM) | Very fast (ONNX, StyleTTS2-style) | espeak phonemizer internally. Direct phoneme API not documented |
| **Pocket TTS** (Kyutai, Jan 2026; pocket-tts 3.3.0 on 2026-09-24) | MIT ([kyutai-labs/pocket-tts](https://github.com/kyutai-labs/pocket-tts)) | **CC-BY-4.0**. The main repo is **gated**: you accept a use policy that forbids cloning a voice without consent ([HF](https://huggingface.co/kyutai/pocket-tts)). An ungated `pocket-tts-without-voice-cloning` repo exists | Preset voices come from [kyutai/tts-voices](https://huggingface.co/kyutai/tts-voices). Most English presets are **VCTK (British-Isles accents)**. The voice-donation presets are CC0. Expresso presets are **NC**. US-accent presets unclear | Not on the arenas. The vendor says it is comparable to larger models (unverified) | 100M params | Community ports: ONNX Runtime Web, Rust/WASM, sherpa-onnx WASM, jax-js | ~6x real time on a MacBook Air M4 using 2 cores (vendor) | No documented phoneme input |
| **Supertonic 2 / 3** (Supertone; **repo archived 2026**) | MIT (unverified for the archive) | **OpenRAIL-M** (has use restrictions) | Presets M1–M5, F1–F5 (accents unverified) | Not on the arenas | v2: 66M, 263 MB ONNX. v3: 99M, 398 MB | **Yes, officially** (browser WebGPU/WASM example, onnx-community ports) | Extremely fast. Vendor claims up to 167x real time | **No.** It reads characters directly, with no espeak and no phoneme control |
| **MeloTTS** | MIT | MIT | EN-US, EN-BR, EN-AU, EN-India, EN-Default (one speaker each) | Below Kokoro (secondary sources) | 208 MB | No maintained web port | Real time on CPU (vendor) | Internal g2p only. Windows install is awkward (MeCab/unidic). Repo inactive since Dec 2024 |
| **StyleTTS 2** | MIT (inference depends on a GPL phonemizer) | Checkpoint carries a **disclosure/consent condition**: tell listeners it is synthetic unless you have the speaker's permission | LibriTTS multi-speaker (zero-shot), LJSpeech | AA arena ~893 | LibriTTS ckpt 771 MB | No | GPU-oriented | espeak phonemes (yes) |
| **Chatterbox** (Resemble; Turbo 350M Dec 2025, Nano 110M Apr 2026, Multilingual V3) | MIT | MIT | One default voice. Otherwise **zero-shot cloning from a ~10 s reference clip**. Every output carries an imperceptible **PerTh watermark** | TTS Arena V2 **1485 ± 19**. AA ~1024 | Original ≈ 0.5B (repo 13.9 GB incl. variants). Turbo ≈ 4 GB of files. Nano ≈ 3 GB of files (the 1 GB s3gen decoder dominates) | No | Nano: "3x faster than real time on 8 CPU cores" (vendor). Original/Turbo are slow on CPU | No phoneme input |
| **Orpheus TTS 3B** | Apache-2.0 | Apache-2.0 on HF, gated. Built on Llama-3.2-3B, so the Llama licence may also apply (unverified) | tara, leah, jess, leo, dan, mia, zac, zoe | Not on the current boards | ~6.6 GB bf16 (GGUF quantizations exist) | No | Very slow on CPU (llama.cpp path exists) | No |
| **Parler-TTS mini v1.1** | Apache-2.0 | Apache-2.0 | Described by a text prompt. 34 named speakers (e.g. "Laura", "Jenna") | Not on the current boards | 880M, 3.75 GB | No | Slow on CPU | No |
| **F5-TTS** | MIT | **CC-BY-NC-4.0** | Zero-shot cloning | n/a | ~1.35 GB per checkpoint | No | Slow on CPU | No |
| **XTTS-v2** (Coqui, defunct) | MPL-2.0 (maintained fork: idiap/coqui-ai-TTS) | **Coqui Public Model License (NC)** | Cloning plus built-in speakers | AA ~916 | 1.9 GB | No | Slow on CPU | No |
| **Dia 1.6B** | Apache-2.0 | Apache-2.0 | Dialogue model, random or cloned voices | n/a | ~6.4 GB | No | Impractical on CPU | No |
| **Sesame CSM-1B** | Apache-2.0 | Apache-2.0, gated. Llama-3.2-1B backbone | Cloning via context | n/a | ~1B params | No | Impractical on CPU | No |
| **Zonos v0.1** | Apache-2.0 | Apache-2.0 | Cloning | AA ~1000 | 3.2 GB | No | GPU. Windows not officially supported | espeak phonemes internally |
| **Spark-TTS 0.5B** | Apache-2.0 | **CC-BY-NC-SA-4.0** | Cloning plus attribute control | n/a | 3.9 GB | No | Slow | No |
| **Llasa 1B/3B/8B** | no licence asserted | **CC-BY-NC-4.0** | Cloning | n/a | 1B+ | No | Slow | No |
| **OuteTTS 1.0** | Apache-2.0 | 0.6B: Apache-2.0. **1B: CC-BY-NC-SA-4.0** | Cloning/speaker profiles | n/a | 0.6B = 1.2 GB | No | llama.cpp possible | No |
| *Newer, notable* **NeuTTS Air** (Neuphonic, Sep 2025) | Apache-2.0 (unverified) | Apache-2.0, gated. **NeuTTS Nano: "other" licence** | Cloning | "NeuTTS Max" (hosted) 1444 on Arena V2 | 748M, GGUF 1.5 GB | No | Built for CPU via GGUF | No |
| *Newer* **Soprano 1.1-80M** (Jan 2026) | Apache-2.0 (unverified) | Apache-2.0 | Single voice | n/a | 281 MB | No | Vendor claims 20x real time on CPU. The pip wheel is CUDA-only; CPU needs a source install | No |
| *Newer* **Qwen3-TTS 0.6B** (Jan 2026) | Apache-2.0 | Apache-2.0 | CustomVoice presets (English names unverified) | n/a | 2.5 GB | onnx-community ports exist; too big for phones | Slow on CPU | No |
| *Newer* **VibeVoice-Realtime-0.5B** (Microsoft, Dec 2025) | MIT | MIT | A few presets | VibeVoice 1.5B AA ~953 | 2 GB | No | Slow | No |
| *Newer, top of open boards* **Breeze TTS 2** (Aug 2026), **Fish Audio S2 Pro**, **Voxtral TTS 4B**, **Magpie 357M** | Apache-2.0 (Breeze code) | **Breeze: research & non-commercial licence**, which also covers *self-hosted outputs*. **Fish: Fish Audio Research License (NC)**. **Voxtral: CC-BY-NC-4.0**. **Magpie: NVIDIA Open Model License** | Cloning | AA: Breeze ~1204 (#1 open), Fish ~1118, Voxtral ~1080, Magpie ~1064 | Multi-GB | No | GPU-class | No |

Other licence notes:
- **espeak-ng is GPL-3.0.** It sits under Kokoro's out-of-dictionary fallback, kokoro-onnx (`phonemizer-fork`, GPL-3), Kitten, Piper and StyleTTS2. Using it at *build time* to make WAVs puts no licence on the audio. *Shipping* it in the PWA as WASM does bring GPL obligations. Examples: kokoro-js → `phonemizer` npm, whose repo is labelled Apache-2.0 but whose README says it uses eSpeak NG; and piper-tts-web. For a public GitHub repo that is manageable (publish the source), but it should be a deliberate choice.
- Kokoro's own README acknowledges that some training data was synthetic. The weights are still Apache-2.0.

---

## 3. Leaderboard snapshot (child-listener relevance)

**TTS Arena V2** (live JSON, 2026-09-27). Blind human A/B tests of "which sounds more human".
- Top: Aurora 1582. Inworld TTS MAX 1564. ElevenLabs Multilingual v2 1513, v3 1510.
- **Chatterbox 1485 ± 19 (1798 votes)**, **Kokoro v1.0 1483 ± 23 (1033 votes, the only "open" entry in the top 30)**.
- NeuTTS Max 1444. Maya 1 1416.

**Artificial Analysis Speech Arena**, open weights (read via summarizer, approximate): Breeze TTS 2 ~1204, Fish S2 Pro ~1118, Step Audio EditX ~1095, Voxtral ~1080, **Kokoro ~1065**, Magpie ~1064, Maya1 ~1044, Higgs V3 ~1037, **Chatterbox ~1024**, Zonos ~1000, VibeVoice 1.5B ~953, XTTS-v2 ~916, StyleTTS2 ~893 ([AA leaderboard](https://artificialanalysis.ai/text-to-speech/leaderboard)).

No leaderboard tests *child listeners* or *slow, clear teacher prosody*. For a 6-year-old, what matters most is stable pronunciation of single words and short sentences, a calm pace, and no hallucinations or dropped words. Small non-autoregressive models (Kokoro, Piper, Kitten, Supertonic) do not hallucinate or repeat. The LLM-style models (Orpheus, Dia, CSM, Chatterbox, Llasa, Spark) occasionally do. That is a real advantage for Kokoro beyond its Elo. Kokoro's `speed=0.85–0.9` gives a gentler teacher pace.

---

## 4. Browser feasibility (mid-range Chromebook / Android)

- **kokoro-js**: q8 model ≈ 86–92 MB, plus onnxruntime-web WASM (~10–25 MB, unverified), plus 0.5 MB for the voice. WebGPU wants fp32 (326 MB). One measurement put WASM q8 at ~3.5x *slower* than real time on phones, and even an M1 Max single-threaded WASM fallback at RTF ≈ 2.0 ([Aloud PR #15](https://github.com/WestSmith/Aloud/pull/15), [Brian Tung](https://briantung.me/blog/tts-engines-in-the-browser/)). On GitHub Pages you cannot set COOP/COEP, so threads (SharedArrayBuffer) need a `coi-serviceworker`-style shim. Voices are fetched from a configurable URL (`voiceDataUrl`). Model files load through transformers.js from huggingface.co, so for offline use, precache them and serve them from your service worker. `env.wasmPaths` is exposed for self-hosting the ORT WASM. The package was last published May 2025.
- **Piper (piper-tts-web / sherpa-onnx WASM)**: much faster than Kokoro in the browser. It is a different voice, lower quality, and you would ship GPL espeak WASM.
- **Kitten nano int8 (25 MB)**: the smallest decent option. Community ports only. Different voice.
- **Supertonic**: officially browser-ready and very fast. Different voice. OpenRAIL-M licence, and the project is archived.
- **Verdict:** there is no on-device option that is *both* fast on a phone *and* the same voice as your fixed lines, except pre-rendering. Use kokoro-js only as an optional lazy-loaded fallback for text you truly cannot enumerate. Generate in the background and cache the result in IndexedDB. Do not generate at tap time.

---

## 5. Isolated phonemes

### 5a. Synthetic, same voice (recommended)
1. **Carrier-word extraction.** For each phoneme, synthesize 2–3 carrier words with `af_heart` at speed 0.85. Use /m/ from "mom" or "moon", /s/ from "sun" or "bus", /t/ from "top".
   - Get phoneme boundaries from `KPipeline` → `result.pred_dur`. The frame→sample conversion is ×600 at 24 kHz, per `join_timestamps` in [pipeline.py](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py). Alternatively use kokoro-onnx `create_timed()` with a model exported with a duration output (`scripts/export.py`).
   - **Continuants** (/m n s f v z sh th l r/ and vowels): cut the steady-state middle and time-stretch it to 600–900 ms with WSOLA (`librosa.effects.time_stretch` or rubberband) to get a held "mmm". Apply 15–30 ms fades.
   - **Stops** (/p t k/): keep the burst plus aspiration (~60–120 ms) from a word-initial stop, and cut *before* voicing onset. Voicing onset can be detected with `parselmouth` pitch or zero-crossing rate. This gives a clipped /t/ with no schwa.
   - **Voiced stops** (/b d g/): unavoidably carry ~30–50 ms of voicing. Cut at the first glottal pulse of the vowel.
   - This works (it is standard concatenative practice), but **each phoneme needs listening QA**. I have not tested it on Kokoro.
2. **Direct phoneme input.** Try `pipeline("[mmm](/mmm/)", voice="af_heart")` or `kokoro.create("mmm", is_phonemes=True)`. Neural models often produce artifacts on very short inputs or inputs without a vowel (untested). Treat this as an experiment, and fall back to method 1.
3. Piper also allows `[[ m ]]` phoneme input plus sample alignments. It is a different voice, so it is not recommended.

### 5b. Openly licensed human recordings
| Source | Licence | Voice | Suitability |
|---|---|---|---|
| **Feed the Monster, English** ([FeedTheMonsterJS `lang/english/audios`](https://github.com/curiouslearning/FeedTheMonsterJS/tree/main/lang/english/audios)): letters `a.mp3…`, digraphs `ch`, `sh`, blends `bl`, `br`, rimes `ake`… (335 English files) | README: "audio and graphical content … licensed under CC-BY" (version not stated). Repo LICENSE is MIT. The companion [ftm-languagepacks](https://github.com/curiouslearning/ftm-languagepacks) is BSD-2. **Licence is inconsistent: attribute Curious Learning and confirm with them** | Speaker, gender and accent **unverified** (separate australian/indian/SA/West-African English packs exist, so "english" is plausibly US). I downloaded 7 clips and probed them with ffprobe: 44.1/48 kHz mono ~72 kbps MP3. Audible durations: t ≈ 0.17 s, b ≈ 0.26 s, s ≈ 0.43 s, m ≈ 0.61 s. That is consistent with clipped stops and short held continuants. `th.mp3` is missing (14-byte file) | Best found. Needs a listening check. Different voice from Kokoro |
| **Wikimedia Commons IPA files** (e.g. `Voiceless_alveolar_plosive.ogg`, `Bilabial_nasal.ogg`) | **CC BY-SA 3.0** (GFDL-migrated), so **share-alike** | Mostly Peter Isotalo, adult male linguist ("raised in Stockholm and Moscow"), plus others (Denelson83, Erutuon). Stops are recorded **in [ata]/[apa] vowel context**. Sibilants as "[sa asa]". Durations 1.5–2.6 s | Not for teaching kids as-is: adult phonetician, non-US, unaspirated IPA stops (English /t/ is aspirated), vowel context |
| Freesound "English Phonemes" pack by margo_heston ([link](https://freesound.org/people/margo_heston/packs/12249/)) | **CC BY-NC** | Unknown speaker. Each file is the phoneme plus an example word | NC, so only OK for a personal, non-commercial app |
| UCLA Phonetics Lab Archive / VoxAngeles | NC / educational only, rights held by many owners | Linguistic field recordings | No |
| Open Source Phonics ([opensourcephonics.org](https://www.opensourcephonics.org/)) | Reported as CC-BY (via a Maryland MSDE RFA). The site itself does not state it | No downloadable isolated phoneme audio found | Lesson plans only |
| Open International Phonics Library ([openphonics.org](https://openphonics.org/pages/api-docs)) | "Library License", not examined | API "coming soon" | Not usable yet |

**Honest alternative:** the parent records the ~44 phonemes once on a phone (a quiet room, 20 minutes, Audacity trimming). There is no licence question, and it gives the best pedagogy: a real held /mmm/ and a crisp /t/. It will not match `af_heart`, but a human "letter-sound voice" is a defensible design choice. Another option is to clone the parent's voice with Chatterbox (MIT) or Pocket TTS (CC-BY-4.0) for *every* line. That is permitted because it is her own voice, but it costs CPU time and hallucination QA.

---

## 6. Ranked shortlists

### (a) Pre-rendering all fixed lines (build time, Windows CPU)
1. **Kokoro-82M `af_heart`** (Apache/Apache). Already in your pipeline, top-tier quality, no hallucinations, phoneme overrides for tricky words.
2. **Kokoro `af_bella`** as a same-model backup voice if `af_heart` feels too breathy for some lines. Do not mix the two within the app.
3. **Chatterbox-Nano / Turbo** (MIT/MIT) *if* you want more expressive praise lines with a consented reference voice. Downsides: it is a different voice unless cloned, it is watermarked, it needs hallucination QA, and it downloads 3–4 GB.
4. **Pocket TTS** (MIT / CC-BY-4.0, gated with consent terms). A CPU-friendly cloning route (e.g. the parent's voice). Most presets are British.

### (b) On-device dynamic lines
1. **None: enumerate and pre-render with Kokoro, then concatenate.** Best consistency and zero latency.
2. **kokoro-js q8 `af_heart`** (Apache). Same voice. Lazy-load ~90 MB, generate in the background, cache in IndexedDB. Too slow for tap-time on phones.
3. **Kitten nano int8 (25 MB, Apache)** or **Piper `en_US-kristin-medium` (63 MB, PD voice; GPL runtime)** if speed matters more than voice match.
4. Supertonic 2/3 (fast, official browser support), but it has OpenRAIL-M use restrictions and an archived project.

### (c) Isolated phonemes
1. **Kokoro `af_heart` carrier-word extraction + WSOLA hold + burst trimming** (same voice). Validate by ear.
2. **Kokoro direct phoneme input** (`is_phonemes=True` or misaki `[x](/…/)`) as an experiment for continuants.
3. **Parent-recorded phonemes** (no licence risk, best pedagogy).
4. **Feed the Monster English letter sounds** (CC-BY per README; confirm the licence, speaker and accent; `th` is missing).

---

## 7. Install and run on Windows CPU (shortlisted)

Use Python **3.12** for Kokoro: `kokoro` 0.9.4 requires `>=3.10,<3.13`.

### Kokoro (PyTorch, official)
```powershell
py -3.12 -m venv .venv-kokoro
.\.venv-kokoro\Scripts\Activate.ps1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install "kokoro>=0.9.4" soundfile
# Optional OOD fallback: install espeak-ng MSI from https://github.com/espeak-ng/espeak-ng/releases
# misaki may download the spaCy model en_core_web_sm on first run (needs internet once)
```
```python
from kokoro import KPipeline
import soundfile as sf, numpy as np
pipe = KPipeline(lang_code='a')                      # American English
for i, r in enumerate(pipe("Tap the word [cat](/kˈæt/).", voice='af_heart', speed=0.9)):
    sf.write(f'line_{i}.wav', r.audio.numpy(), 24000)
    print(r.phonemes, r.pred_dur)                     # per-phoneme frame durations (x600 = samples @24 kHz)
```

### kokoro-onnx (no PyTorch; phoneme input; timings)
```powershell
py -3.12 -m venv .venv-konnx; .\.venv-konnx\Scripts\Activate.ps1
pip install -U kokoro-onnx soundfile
curl.exe -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx
curl.exe -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin
```
```python
from kokoro_onnx import Kokoro
import soundfile as sf
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
audio, sr = k.create("Hello, princess!", voice="af_heart", speed=0.9, lang="en-us")
sf.write("hello.wav", audio, sr)
audio, sr = k.create("mmm", voice="af_heart", is_phonemes=True)   # phoneme experiment
# Per-phoneme timings: k.create_timed(...) needs a model exported WITH a duration output (repo scripts/export.py)
```
(kokoro-onnx is MIT, but it pulls `phonemizer-fork` (GPL-3) plus `espeakng-loader`. That is fine for build-time use.)

### Browser (kokoro-js), only if needed
```bash
npm i kokoro-js   # Apache-2.0
```
```js
import { KokoroTTS, env } from "kokoro-js";
env.wasmPaths = "/vendor/ort/";     // self-host ORT wasm for offline
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "wasm" });
const audio = await tts.generate("Great job!", { voice: "af_heart", speed: 0.9 });
```
(Precache the model/tokenizer/voice URLs in the service worker so HF fetches are served offline. Verify this against transformers.js v3 cache behaviour.)

### Piper (fallback / phoneme experiments)
```powershell
pip install piper-tts          # GPL-3.0; win_amd64 wheel published for 1.8.0
python -m piper.download_voices en_US-kristin-medium
```
```python
import wave; from piper import PiperVoice
v = PiperVoice.load("en_US-kristin-medium.onnx")
with wave.open("t.wav", "wb") as w: v.synthesize_wav("I am [[ mmmm ]]", w)
```

### Kitten TTS 0.8 (tiny fallback)
```powershell
pip install https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl soundfile
```
```python
from kittentts import KittenTTS; import soundfile as sf
m = KittenTTS("KittenML/kitten-tts-mini-0.8")
sf.write("k.wav", m.generate("Great job!", voice="Luna"), 24000)
```
(The PyPI package `kittentts` is stale at 0.1.3. Use the GitHub wheel.)

### Chatterbox Nano (optional, expressive, cloning)
```powershell
py -3.11 -m venv .venv-cb; .\.venv-cb\Scripts\Activate.ps1
pip install chatterbox-tts
```
```python
import torchaudio as ta
from chatterbox.tts_turbo import ChatterboxTurboTTS
m = ChatterboxTurboTTS.from_pretrained(device="cpu", nano=True)
wav = m.generate("You did it!", audio_prompt_path="consented_ref_10s.wav")
ta.save("cb.wav", wav, m.sr)
```

### Pocket TTS (optional, CPU cloning)
```powershell
pip install pocket-tts        # Windows default torch wheel is CPU-only
# accept the gated terms at huggingface.co/kyutai/pocket-tts and `hf auth login`, or use the ungated no-cloning repo
pocket-tts generate --voice alba --text "Hello!"
```

---

## 8. Uncertainties / not verified
- I listened to no audio. "Warmest" is based on Kokoro's own grades and arena results, not on a child-listening test.
- CPU speeds on your PC were not measured. Phone and Chromebook browser speeds come from two third-party posts.
- Kitten voice accents, Supertonic and Qwen3 preset names and accents, and Pocket's US-accent presets were not verified.
- Feed the Monster: the audio licence version, speaker identity and accent are unconfirmed. The repo licence files conflict with the README.
- Kokoro behaviour on phoneme-only inputs (e.g. "mmm") is untested.
- AA arena figures came through a summarizer. TTS Arena V2 figures come from its JSON API (primary).
- The `phonemizer` npm package (used by kokoro-js) is labelled Apache-2.0 but embeds eSpeak NG. Treat it as GPL-3 for distribution purposes (inferred, not confirmed from its build files).
