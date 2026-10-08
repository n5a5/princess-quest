// shared/updates.js — shows when a new version of the app is downloading and when it has arrived, and loads it
// at a moment that cuts nothing off. sw.js downloads every file of a new version in the background, posting
// { type: 'install-progress', done, total } as it goes, then takes over the page (skipWaiting + claim).
//   downloading                      a pill at the bottom: "Updating Princess Quest… 42%"
//   arrived, still on the splash     reload now; after the reload the pill says "Updated!" for a few seconds
//   arrived while she is playing     "Update ready. It starts when you go back to the map."; reloadIfReady()
//                                    (shell.js, when she leaves a place) reloads
// The very first install is not an update (there is nothing to replace), so it shows nothing.
const FLAG = 'arcade.updated';

export function watchUpdates({ onSplash = () => false } = {}) {
  const sw = navigator.serviceWorker;
  // false only until the very first install takes over this page; every later new version is an update
  let controlled = !!sw.controller;
  let pill = null, label = null, fill = null, ready = false;

  function show(text, frac) {
    if (!pill) {
      label = document.createElement('span');
      fill = document.createElement('i');
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.appendChild(fill);
      pill = document.createElement('div');
      pill.className = 'update-pill';
      pill.setAttribute('role', 'status');
      pill.append(label, bar);
      document.body.appendChild(pill);
    }
    label.textContent = text;
    pill.classList.toggle('indeterminate', frac === null);
    pill.classList.toggle('no-bar', frac === undefined);
    if (typeof frac === 'number') fill.style.width = Math.round(frac * 100) + '%';
  }
  function hide() { if (pill) { pill.remove(); pill = null; } }
  function reloadNow() { try { sessionStorage.setItem(FLAG, '1'); } catch {} location.reload(); }

  try {
    if (sessionStorage.getItem(FLAG)) { sessionStorage.removeItem(FLAG); show('✨ Updated!', undefined); setTimeout(hide, 4000); }
  } catch {}

  sw.addEventListener('message', e => {
    const d = e.data;
    if (!controlled || ready || !d || d.type !== 'install-progress' || !d.total) return;
    show('Updating Princess Quest… ' + Math.round(d.done / d.total * 100) + '%', d.done / d.total);
  });
  sw.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    if (onSplash()) return reloadNow();
    ready = true;
    show('✨ Update ready. It starts when you go back to the map.', undefined);
  });
  sw.register('sw.js').then(reg => {
    const watch = w => {
      if (!w || !controlled) return;
      show('Updating Princess Quest…', null);
      // a failed download (no internet halfway): hide; the next visit tries again
      w.addEventListener('statechange', () => { if (w.state === 'redundant' && !ready) hide(); });
    };
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // A tablet can stay open for days without reloading: look for a new version when the app comes back into
    // view, at most every half hour.
    let last = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || Date.now() - last < 30 * 60000) return;
      last = Date.now();
      reg.update().catch(() => {});
    });
  }).catch(e => console.warn('sw', e));

  return { reloadIfReady() { if (!ready) return false; reloadNow(); return true; } };
}

// The version installed on this device, as the service worker that runs the app reports it ("4.6.0"), or null
// (not installed, e.g. ?nosw=1). Falls back to the cache name when the worker does not answer.
export async function installedVersion() {
  const sw = navigator.serviceWorker;
  let v = null;
  if (sw && sw.controller) {
    v = await new Promise(res => {
      const ch = new MessageChannel();
      ch.port1.onmessage = e => res(e.data);
      sw.controller.postMessage({ type: 'version' }, [ch.port2]);
      setTimeout(() => res(null), 1500);
    });
  }
  if (!v) { try { const keys = (await caches.keys()).filter(k => k.startsWith('arcade-v')); if (keys.length === 1) v = keys[0]; } catch {} }
  return v ? String(v).replace(/^arcade-v/, '') : null;
}
