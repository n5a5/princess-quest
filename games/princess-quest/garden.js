// games/princess-quest/garden.js — Squishy Garden: the reward hub. Rescued Squishies live here and wiggle
// when tapped; gems buy a small set of decorations placed by tapping a spot; two prosocial gifts say thank you.
// No learning items, no timers, nothing to lose.
import { el, wait, shuffle, pick, bigButton, sheet, toast, confetti } from '../../shared/ui.js';
import { lunaSVG, squishySVG, svgFrom, SQUISHY_KINDS, gemSVG } from '../../shared/characters.js';

let host = null, ctx = null, SHOP = null;
const SPOTS = 9; // 3×3 garden grid

function gemRow(cost) {
  const row = el('span', { class: 'gem-cost', 'aria-label': cost + ' gems' });
  for (let i = 0; i < cost; i++) { const g = el('span', { html: gemSVG(14) }); row.appendChild(g); }
  return row;
}

function render() {
  const s = ctx.economy.save;
  const audio = ctx.audio;
  const rescued = s.squishies.rescued;
  const luna = svgFrom(lunaSVG({ state: 'idle', glow: ctx.economy.companion().level }));
  const placed = s.kingdom.placed;
  const owned = new Set(placed.map(p => p.itemId));
  let placing = null;

  const grid = el('div', { class: 'garden-grid' }, Array.from({ length: SPOTS }, (_, i) => {
    const here = placed.find(p => p.spot === i);
    const item = here && SHOP.items.find(x => x.id === here.itemId);
    const cell = el('button', { class: 'garden-spot' + (item ? ' filled' : ''), type: 'button', 'aria-label': item ? item.name : 'empty spot', text: item ? item.pic : '' });
    cell.addEventListener('click', () => {
      if (placing && !item) {
        if (!ctx.economy.spendGems(placing.cost)) { audio.say('Not enough gems yet. Play a round to earn more!'); return; }
        s.kingdom.placed.push({ itemId: placing.id, spot: i }); ctx.economy.persist();
        confetti(30); audio.say('A ' + placing.name + '! Beautiful.'); ctx.refreshBar && ctx.refreshBar(); render();
      } else if (item) { audio.say(item.name); cell.classList.add('wiggle'); setTimeout(() => cell.classList.remove('wiggle'), 600); }
      else audio.say('Pick something from the shop first.');
    });
    return cell;
  }));

  const squishies = el('div', { class: 'row' }, rescued.length ? rescued.map(id => {
    const k = SQUISHY_KINDS.find(x => x.id === id);
    const node = svgFrom(squishySVG(k, { size: 64 }));
    node.addEventListener('click', () => { node.classList.remove('wiggle'); void node.offsetWidth; node.classList.add('wiggle'); audio.say(pick([k.name + ' says hi!', k.name + ' is happy to see you.', 'Wiggle wiggle!', k.name + ' loves the garden.'])); });
    return node;
  }) : [el('div', { class: 'line', text: 'Free Squishies from their bubbles and they will live here.' })]);

  const shop = el('div', { class: 'shop' }, SHOP.items.map(item => {
    const b = el('button', { class: 'shop-item' + (owned.has(item.id) ? ' owned' : '') + (s.gems < item.cost ? ' poor' : ''), type: 'button', 'aria-label': item.name }, [el('div', { class: 'pic', text: item.pic }), el('div', { class: 'name', text: item.name }), gemRow(item.cost)]);
    b.addEventListener('click', () => {
      if (owned.has(item.id)) { audio.say('You already have the ' + item.name + '.'); return; }
      if (s.gems < item.cost) { audio.say('The ' + item.name + ' needs more gems. Play a round to earn some!'); return; }
      placing = item; shop.querySelectorAll('.shop-item').forEach(x => x.classList.toggle('picked', x === b));
      audio.say(item.name + '. Tap a spot in the garden to put it there.');
      grid.querySelectorAll('.garden-spot:not(.filled)').forEach(c => c.classList.add('glow'));
    });
    return b;
  }));

  const gifts = el('div', { class: 'row' }, SHOP.gifts.map(g => {
    const b = el('button', { class: 'shop-item gift' + (s.gems < g.cost ? ' poor' : ''), type: 'button', 'aria-label': g.name }, [el('div', { class: 'pic', text: g.pic }), el('div', { class: 'name', text: g.name }), gemRow(g.cost)]);
    b.addEventListener('click', async () => {
      if (!ctx.economy.spendGems(g.cost)) { audio.say('Gifts need a few gems. Play a round first!'); return; }
      s.kingdom.gifts.push({ id: g.id, day: ctx.economy.today() }); ctx.economy.persist(); ctx.refreshBar && ctx.refreshBar();
      const o = sheet([el('div', { class: 'big-emoji', text: g.pic }), el('h2', { text: 'Thank you!' }), el('div', { class: 'sub', text: g.thanks }), bigButton('Aww', () => { o.remove(); render(); }, 'gold')]);
      confetti(50); await audio.say(g.thanks);
    });
    return b;
  }));

  host.replaceChildren(el('div', { class: 'scene garden' }, [
    el('div', { class: 'scene-head' }, [luna, el('div', {}, [el('div', { class: 'title', text: 'Squishy Garden' }), el('div', { class: 'line', text: rescued.length ? rescued.length + ' Squishies live here. Spend gems to decorate!' : 'Your Squishies will live here.' })])]),
    squishies,
    grid,
    el('div', { class: 'story-title', text: 'Gem shop' }),
    shop,
    el('div', { class: 'story-title', text: 'Gifts' }),
    gifts
  ]));
}

export async function mount(h, c) {
  host = h; ctx = c;
  SHOP = await ctx.content.load('shop');
  render();
  ctx.audio.say('Welcome to the Squishy Garden!');
}
export function unmount() { host = null; }
