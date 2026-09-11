# tools/build-phoneme-audio.ps1 — regenerates the bundled default phoneme clips.
# Not a build step for the app: run it only when content/sounds.json changes. Requires Windows
# (System.Speech, Microsoft Zira voice) and ffmpeg on PATH. Output: assets/audio/phonemes/<id>.ogg
# and content/audio-manifest.json. Parent recordings made in Parent Corner override these at runtime.
#
# Recipe per sound (from sounds.json): SSML <phoneme alphabet="ipa"> at the given prosody rate →
# trim silence → optional hard cut (stops synthesized with a schwa are cut to ~120–140 ms so the
# child hears a clipped release, not "buh") → 30 ms fade-out → peak-normalize to -1 dBFS → Opus 32 kbps.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sounds = (Get-Content "$root\content\sounds.json" -Raw -Encoding UTF8 | ConvertFrom-Json).sounds
$outDir = "$root\assets\audio\phonemes"
$tmp = Join-Path $env:TEMP 'arcade-phoneme-build'
New-Item -ItemType Directory -Force $outDir | Out-Null
New-Item -ItemType Directory -Force $tmp | Out-Null

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Zira Desktop')

$ids = @()
foreach ($s in $sounds) {
  $raw = Join-Path $tmp "$($s.id).raw.wav"
  $trim = Join-Path $tmp "$($s.id).trim.wav"
  $out = Join-Path $outDir "$($s.id).ogg"
  $rate = if ($s.rate) { $s.rate } else { 'medium' }
  $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody rate="' + $rate + '"><phoneme alphabet="ipa" ph="' + $s.ipa + '">x</phoneme></prosody></speak>'
  $synth.SetOutputToWaveFile($raw)
  $synth.SpeakSsml($ssml)
  $synth.SetOutputToNull()

  $filters = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
  if ($s.cutMs) {
    $cut = [double]$s.cutMs / 1000
    $fadeStart = [math]::Max(0, $cut - 0.03)
    $filters += ",atrim=0:$cut,afade=t=out:st=$fadeStart" + ':d=0.03'
  } else {
    $filters += ',afade=t=out:d=0.03'
  }
  # ffmpeg writes to stderr; run through cmd so PowerShell does not wrap those lines as errors.
  cmd /c "ffmpeg -y -loglevel error -i `"$raw`" -af `"$filters`" `"$trim`" 2>&1" | Out-Null
  $vdText = cmd /c "ffmpeg -i `"$trim`" -af volumedetect -f null NUL 2>&1"
  $vd = ($vdText | Select-String 'max_volume: (-?[\d.]+) dB')
  if (-not $vd) { throw "volumedetect failed for $($s.id)" }
  $maxDb = [double]$vd.Matches[0].Groups[1].Value
  $gain = -1.0 - $maxDb
  cmd /c "ffmpeg -y -loglevel error -i `"$trim`" -af `"volume=${gain}dB`" -c:a libopus -b:a 32k -ac 1 `"$out`" 2>&1" | Out-Null
  $ids += $s.id
  "{0,-4} ipa={1,-5} rate={2,-6} cut={3,-4} gain={4:N1}dB" -f $s.id, $s.ipa, $rate, $s.cutMs, $gain
}
$synth.Dispose()

$manifest = [ordered]@{
  ext = 'ogg'
  generated = (Get-Date).ToString('yyyy-MM-dd')
  source = 'Bundled defaults synthesized with Windows SAPI (Microsoft Zira) via SSML IPA phoneme tags; see tools/build-phoneme-audio.ps1. Parent recordings override.'
  phonemes = $ids
  letters = @()
  words = @()
}
# Keep any existing word list; write UTF-8 without BOM (node's JSON.parse rejects a BOM).
$manPath = "$root\content\audio-manifest.json"
if (Test-Path $manPath) {
  $old = (Get-Content $manPath -Raw -Encoding UTF8) -replace '^﻿', '' | ConvertFrom-Json
  if ($old.words) { $manifest.words = $old.words }
  if ($old.wordsSource) { $manifest.wordsSource = $old.wordsSource }
}
[System.IO.File]::WriteAllText($manPath, (($manifest | ConvertTo-Json -Depth 3) + "`n"), (New-Object System.Text.UTF8Encoding($false)))
"wrote $($ids.Count) clips and content/audio-manifest.json"
