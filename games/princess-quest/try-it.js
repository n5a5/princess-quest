// games/princess-quest/try-it.js — temporary Step 1 demo: "Which one starts with /m/?" Removed in Step 2.
import { el, shuffle, runRound, roundCelebration } from '../../shared/ui.js';

const ITEMS = [
  { id: 'm', sound: 'mmm', ok: { pic: '🌙', word: 'moon' }, others: [{ pic: '☀️', word: 'sun' }, { pic: '🐱', word: 'cat' }] },
  { id: 's', sound: 'sss', ok: { pic: '☀️', word: 'sun' }, others: [{ pic: '🐶', word: 'dog' }, { pic: '🎩', word: 'hat' }] },
  { id: 'f', sound: 'fff', ok: { pic: '🐟', word: 'fish' }, others: [{ pic: '🍎', word: 'apple' }, { pic: '🐰', word: 'bunny' }] },
  { id: 'b', sound: 'buh', ok: { pic: '⚽', word: 'ball' }, others: [{ pic: '🌙', word: 'moon' }, { pic: '🍋', word: 'lemon' }] },
  { id: 'p', sound: 'puh', ok: { pic: '🐷', word: 'pig' }, others: [{ pic: '🦊', word: 'fox' }, { pic: '🐢', word: 'turtle' }] }
];

let root = null;

export async function mount(host, ctx) {
  root = el('div', { class: 'activity' });
  host.replaceChildren(root);
  const praise = await ctx.content.load('praise');
  const { stars } = await runRound({
    root, speech: ctx.speech, adaptive: ctx.adaptive, economy: ctx.economy,
    praiseLines: praise.praise, name: ctx.economy.save.child.name, cabinetId: 'try-it',
    items: ITEMS,
    makeItem: it => ({
      subskill: 'pa-sounds', itemId: 'first-' + it.id,
      prompt: 'Which one starts with ' + it.sound + '?',
      choices: shuffle([it.ok, ...it.others]).map(c => ({ id: c.word, pic: c.pic, label: c.word, ok: c === it.ok })),
      revealText: it.ok.word + ' starts with ' + it.sound + '.'
    })
  });
  if (root) roundCelebration(ctx.speech, stars, () => ctx.exit());
}

export function unmount() { root = null; }
