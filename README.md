# Amelia's Arcade — Princess Quest v3

Gentle kindergarten reading and math practice for one child, built as an offline PWA. Design spec: `docs/superpowers/specs/2026-09-10-princess-quest-v3-design.md`. Live: https://n5a5.github.io/princess-quest/

## Run locally

```
npx http-server . -p 8765 -c-1
```

Open http://localhost:8765/. Tests: `node --test tests/*.test.js`.

## Layout

- `index.html`, `shell.js` — launcher shell (splash, home, quest, cabinets)
- `shared/` — economy (save), adaptive (difficulty), speech, ui, content loader, session clock, theme
- `games/registry.js` — one entry per cabinet; `games/princess-quest/*.js` — cabinet modules
- `content/*.json` — all words, stories, problems, standards
- `parent/` — PIN-gated dashboard (default PIN 1234)
- `sw.js` — precache list; bump `VERSION` on release; `tests/precache.test.js` keeps the list honest

## Adding a cabinet

1. Create `games/<group>/<id>.js` exporting `mount(root, ctx)` and `unmount()`.
2. Add one entry to `games/registry.js` with `ready: true`.
3. Add the file to `ASSETS` in `sw.js` and bump `VERSION`.

Full save schema, content formats, and the word/story authoring guide arrive in Step 9.
