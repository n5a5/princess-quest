# Princess Quest

Static offline PWA (vanilla ES modules, no build step). Tests: `node --test tests/*.test.js`.
After changing spoken text: `python tools/collect-lines.py` then `tools/build-lines-audio.py` (needs the
kokoro-onnx venv; see docs). New tracked files must be `git add`ed before regenerating `sw.js`.

## Deploy

- **Deploy:** push `main` to GitHub. GitHub Pages serves the repo root at
  https://n5a5.github.io/princess-quest/ within about a minute. Before pushing, bump `VERSION` in
  `sw.js` and regenerate its `ASSETS` list (`node <scratchpad>/regen_sw.js arcade-vX.Y.Z`, which reads the
  SKIP rule from `tests/precache.test.js`); the precache test fails until the list matches `git ls-files`.
- **Check what is live:** `curl -s https://n5a5.github.io/princess-quest/sw.js | grep VERSION`.
  Devices pick the new version up on their next reload (a first install can fail while Pages is still
  spreading the files; a reload retries it).
- **Roll back:** `git revert <commit>` (or `git revert <oldest>..<newest>` for a range) with a new
  `VERSION` in `sw.js`, then push `main`. Never force-push: Pages deploys whatever `main` points at, and a
  device that already cached a version keeps it until it sees a newer `VERSION`.
