// ==================== AMELIA'S CASTLE (open-ended play) ====================
// Sticker book, three decorate-able rooms, unicorn care, dress-up.
// No fail states, no costs, nothing can be lost or destroyed.

registerModule('castle', {
  open() { this.showMenu(); },
  close() { this._endDrag(); },
  afterReward() { /* stay where we are */ },

  showMenu() {
    const area = document.getElementById('castle-game-area');
    const sel = document.getElementById('castle-mode-select');
    area.style.display = 'none';
    sel.style.display = 'block';
    document.getElementById('castle-progress').textContent =
      state.stickers.length + ' stickers collected ✨';
  },

  _showGame() {
    document.getElementById('castle-mode-select').style.display = 'none';
    const area = document.getElementById('castle-game-area');
    area.style.display = 'block';
    return area;
  },

  // Unique sticker ids the child owns (for book/tray display).
  _ownedStickers() {
    const seen = {};
    const out = [];
    state.stickers.forEach(id => {
      if (!seen[id]) { seen[id] = 0; }
      seen[id]++;
    });
    STICKERS.forEach(s => { if (seen[s.id]) out.push({ ...s, count: seen[s.id] }); });
    return out;
  },

  // How many of this sticker are placed across all rooms.
  _placedCount(id) {
    let n = 0;
    Object.keys(state.rooms).forEach(r => {
      state.rooms[r].forEach(p => { if (p.id === id) n++; });
    });
    return n;
  },

  // ============ STICKER BOOK ============
  startBook() {
    const area = this._showGame();
    const owned = {};
    state.stickers.forEach(id => { owned[id] = (owned[id] || 0) + 1; });
    const themes = [];
    STICKERS.forEach(s => { if (!themes.includes(s.theme)) themes.push(s.theme); });
    let html = '<div class="activity-title">📖 ' + kidName() + '’s Sticker Book</div>';
    const total = Object.keys(owned).length;
    html += '<div class="book-count">' + total + ' of ' + STICKERS.length + ' stickers found!</div>';
    themes.forEach(theme => {
      html += '<div class="book-theme">' + theme + '</div><div class="book-grid">';
      STICKERS.filter(s => s.theme === theme).forEach(s => {
        if (owned[s.id]) {
          html += '<button class="book-sticker" onclick="Modules.castle._tapBookSticker(this)" data-name="' + s.name + '">' + s.e +
            (owned[s.id] > 1 ? '<span class="book-dup">×' + owned[s.id] + '</span>' : '') + '</button>';
        } else {
          html += '<div class="book-sticker empty">✨</div>';
        }
      });
      html += '</div>';
    });
    html += '<div class="book-hint">Play any game to find more stickers!</div>';
    area.innerHTML = html;
    speak('Your sticker book, {name}! You have found ' + total + ' stickers. Play games to find more!');
  },

  _tapBookSticker(btn) {
    haptic('tap');
    playSound('pop');
    burstAtElement(btn, 5);
    speak(btn.dataset.name + '!');
  },

  // ============ ROOMS ============
  startRooms() {
    this._roomId = this._roomId || 'throne';
    this._renderRoom();
  },

  _renderRoom() {
    const area = this._showGame();
    const room = CASTLE_ROOMS.find(r => r.id === this._roomId);
    let html = '<div class="room-tabs">';
    CASTLE_ROOMS.forEach(r => {
      html += '<button class="room-tab' + (r.id === this._roomId ? ' current' : '') + '" onclick="Modules.castle._switchRoom(\'' + r.id + '\')">' + r.e + ' ' + r.name + '</button>';
    });
    html += '</div>';
    html += '<div class="castle-room" id="castle-room" style="background:' + room.bg + '">' +
      '<div class="room-deco">' + room.deco + '</div></div>';
    html += '<div class="tray-label">Tap a sticker to add it! Drag stickers to move them.</div>';
    html += '<div class="sticker-tray" id="sticker-tray"></div>';
    area.innerHTML = html;
    this._renderRoomStickers();
    this._renderTray();
    this._initRoomDrag();
    speak('The ' + room.name + '! Tap a sticker below to decorate, {name}!');
  },

  _switchRoom(id) {
    playSound('click');
    haptic('tap');
    this._roomId = id;
    this._renderRoom();
  },

  _renderRoomStickers() {
    const roomEl = document.getElementById('castle-room');
    if (!roomEl) return;
    roomEl.querySelectorAll('.placed-sticker').forEach(el => el.remove());
    (state.rooms[this._roomId] || []).forEach((p, idx) => {
      const s = STICKERS.find(x => x.id === p.id);
      if (!s) return;
      const el = document.createElement('div');
      el.className = 'placed-sticker';
      el.textContent = s.e;
      el.style.left = p.x + '%';
      el.style.top = p.y + '%';
      el.dataset.idx = idx;
      roomEl.appendChild(el);
    });
  },

  _renderTray() {
    const tray = document.getElementById('sticker-tray');
    if (!tray) return;
    const owned = this._ownedStickers();
    if (!owned.length) {
      tray.innerHTML = '<div class="tray-empty">Play games to earn stickers! ✨</div>';
      return;
    }
    tray.innerHTML = '';
    owned.forEach(s => {
      const free = s.count - this._placedCount(s.id);
      const btn = document.createElement('button');
      btn.className = 'tray-sticker' + (free <= 0 ? ' all-placed' : '');
      btn.innerHTML = s.e + (s.count > 1 ? '<span class="tray-count">×' + s.count + '</span>' : '');
      btn.onclick = () => this._addToRoom(s, free);
      tray.appendChild(btn);
    });
  },

  _addToRoom(s, free) {
    haptic('tap');
    if (free <= 0) {
      // Every copy is placed somewhere — move one here instead. Never an error.
      let moved = false;
      Object.keys(state.rooms).forEach(rid => {
        if (moved || rid === this._roomId) return;
        const i = state.rooms[rid].findIndex(p => p.id === s.id);
        if (i >= 0) { state.rooms[rid].splice(i, 1); moved = true; }
      });
      if (!moved) {
        speak('Your ' + s.name + ' is already in this room! Drag it to move it.');
        return;
      }
    }
    state.rooms[this._roomId].push({ id: s.id, x: 35 + Math.random() * 30, y: 30 + Math.random() * 30 });
    saveState();
    playSound('pop');
    createSparkles(4);
    speak(s.name + '!');
    this._renderRoomStickers();
    this._renderTray();
  },

  // ---- drag placed stickers around the room (drag to tray = back to book) ----
  _initRoomDrag() {
    const roomEl = document.getElementById('castle-room');
    if (!roomEl) return;
    const self = this;

    const start = (x, y, target) => {
      const el = target.closest('.placed-sticker');
      if (!el) return;
      self._drag = { el, idx: parseInt(el.dataset.idx, 10) };
      el.classList.add('dragging');
    };
    const move = (x, y) => {
      if (!self._drag) return;
      const r = roomEl.getBoundingClientRect();
      const px = Math.max(2, Math.min(92, ((x - r.left) / r.width) * 100));
      const py = Math.max(2, Math.min(88, ((y - r.top) / r.height) * 100));
      self._drag.el.style.left = px + '%';
      self._drag.el.style.top = py + '%';
      self._drag.x = px; self._drag.y = py;
      // hovering over tray?
      const tray = document.getElementById('sticker-tray');
      const tr = tray.getBoundingClientRect();
      const over = y >= tr.top && y <= tr.bottom;
      tray.classList.toggle('tray-hover', over);
      self._drag.overTray = over;
    };
    const end = () => {
      if (!self._drag) return;
      const d = self._drag;
      self._drag = null;
      d.el.classList.remove('dragging');
      const tray = document.getElementById('sticker-tray');
      if (tray) tray.classList.remove('tray-hover');
      const placed = state.rooms[self._roomId][d.idx];
      if (!placed) return;
      if (d.overTray) {
        // Back to the book — nothing is ever lost.
        const s = STICKERS.find(x => x.id === placed.id);
        state.rooms[self._roomId].splice(d.idx, 1);
        saveState();
        playSound('click');
        speak((s ? s.name : 'Sticker') + ' is back in your book!');
        self._renderRoomStickers();
        self._renderTray();
      } else if (d.x != null) {
        placed.x = d.x; placed.y = d.y;
        saveState();
        playSound('pop');
        self._renderRoomStickers();
      }
    };

    roomEl.addEventListener('mousedown', e => { start(e.clientX, e.clientY, e.target); });
    roomEl.addEventListener('touchstart', e => { const t = e.touches[0]; start(t.clientX, t.clientY, e.target); }, { passive: true });
    this._moveHandler = e => move(e.clientX, e.clientY);
    this._touchMoveHandler = e => {
      if (!self._drag) return;
      e.preventDefault();
      const t = e.touches[0];
      move(t.clientX, t.clientY);
    };
    this._endHandler = () => end();
    document.addEventListener('mousemove', this._moveHandler);
    document.addEventListener('mouseup', this._endHandler);
    document.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
    document.addEventListener('touchend', this._endHandler);
  },

  _endDrag() {
    if (this._moveHandler) {
      document.removeEventListener('mousemove', this._moveHandler);
      document.removeEventListener('mouseup', this._endHandler);
      document.removeEventListener('touchmove', this._touchMoveHandler);
      document.removeEventListener('touchend', this._endHandler);
      this._moveHandler = null;
    }
    this._drag = null;
  },

  // ============ UNICORN CARE ============
  startUnicorn() {
    const area = this._showGame();
    this._careActions = 0;
    area.innerHTML =
      '<div class="activity-title">🌈 Sparkle the Unicorn</div>' +
      '<div class="unicorn-stage"><div class="unicorn-big" id="unicorn-big" onclick="Modules.castle._petUnicorn()">🦄</div></div>' +
      '<div class="care-buttons">' +
        '<button class="care-btn" onclick="Modules.castle._care(\'feed\', this)">🍎<span>Feed</span></button>' +
        '<button class="care-btn" onclick="Modules.castle._care(\'brush\', this)">🖌️<span>Brush</span></button>' +
        '<button class="care-btn" onclick="Modules.castle._care(\'hug\', this)">💖<span>Hug</span></button>' +
      '</div>';
    speak('This is Sparkle the unicorn! She loves you, {name}. You can feed her, brush her, or give her a big hug!');
  },

  _petUnicorn() {
    const u = document.getElementById('unicorn-big');
    const r = u.getBoundingClientRect();
    createHeartFloat(r.left + r.width / 2, r.top + 20);
    u.classList.remove('bounce'); void u.offsetWidth; u.classList.add('bounce');
    playSound('pop');
    haptic('tap');
    speak(['Sparkle loves that!', 'Neigh! That tickles!', 'Sparkle is so happy!'][Math.floor(Math.random() * 3)]);
  },

  _care(kind, btn) {
    haptic('tap');
    const u = document.getElementById('unicorn-big');
    const r = u.getBoundingClientRect();
    u.classList.remove('bounce'); void u.offsetWidth; u.classList.add('bounce');
    if (kind === 'feed') {
      state.unicorn.fed++;
      createHeartFloat(r.left + r.width / 2, r.top + 30);
      playSound('pop');
      speak(['Crunch crunch! Yummy apple!', 'Sparkle says thank you, {name}!', 'That was delicious!'][Math.floor(Math.random() * 3)]);
    } else if (kind === 'brush') {
      state.unicorn.brushed++;
      createSparkles(6);
      playSound('correct');
      speak(['So shiny and soft!', 'Sparkle’s mane is beautiful now!', 'Brush brush brush! Lovely!'][Math.floor(Math.random() * 3)]);
    } else {
      state.unicorn.hugged++;
      createHeartFloat(r.left + r.width / 2, r.top + 20);
      playSound('reward');
      speak(['Biggest hug ever! Sparkle loves you, {name}!', 'Aww! Sparkle hugs you back!', 'Best friends forever!'][Math.floor(Math.random() * 3)]);
    }
    saveState();
    this._careActions++;
    if (this._careActions === 5) {
      setActivityTimer(() => {
        speak('Sparkle is so happy! She found a present for you!');
        completeActivity('unicorn-care', 0);
      }, 1800);
    }
  },

  // ============ DRESS UP ============
  startDressup() {
    this._dressChanges = 0;
    this._renderDressup();
  },

  _renderDressup() {
    const area = this._showGame();
    const d = state.dressup;
    const dress = DRESSUP.dress[d.dress], crown = DRESSUP.crown[d.crown];
    const shoes = DRESSUP.shoes[d.shoes], pet = DRESSUP.pet[d.pet];
    let html = '<div class="activity-title">👗 Dress Up Princess ' + kidName() + '</div>' +
      '<div class="dress-display">' +
        '<div class="dd-row">' + crown.e + '</div>' +
        '<div class="dd-row big">👸</div>' +
        '<div class="dd-row">' + dress.e + ' ' + shoes.e + ' ' + pet.e + '</div>' +
        '<div class="dd-caption">' + crown.name + ' · ' + dress.name + '<br>' + shoes.name + ' · with her ' + pet.name + '</div>' +
      '</div>';
    const rows = [
      { key: 'crown', label: 'Crown', items: DRESSUP.crown },
      { key: 'dress', label: 'Dress', items: DRESSUP.dress },
      { key: 'shoes', label: 'Shoes', items: DRESSUP.shoes },
      { key: 'pet', label: 'Friend', items: DRESSUP.pet }
    ];
    rows.forEach(row => {
      html += '<div class="dress-row-label">' + row.label + '</div><div class="dress-row">';
      row.items.forEach((it, i) => {
        html += '<button class="dress-opt' + (state.dressup[row.key] === i ? ' selected' : '') + '" ' +
          'onclick="Modules.castle._pickDress(\'' + row.key + '\',' + i + ')">' + it.e + '</button>';
      });
      html += '</div>';
    });
    html += '<div style="text-align:center;margin-top:14px"><button class="big-btn pink" onclick="Modules.castle._tada()">Ta-da! 🎉</button></div>';
    area.innerHTML = html;
  },

  _pickDress(key, i) {
    state.dressup[key] = i;
    saveState();
    this._dressChanges++;
    playSound('pop');
    haptic('tap');
    const it = DRESSUP[key][i];
    speak('The ' + it.name + '!');
    this._renderDressup();
  },

  _tada() {
    const d = state.dressup;
    createConfetti(30);
    playSound('reward');
    speak('Ta-da! Princess {name} wears the ' + DRESSUP.crown[d.crown].name + ' and the ' +
      DRESSUP.dress[d.dress].name + ', with ' + DRESSUP.shoes[d.shoes].name +
      ', and brings her ' + DRESSUP.pet[d.pet].name + '. You look wonderful!');
    if (this._dressChanges >= 3) {
      this._dressChanges = 0;
      setActivityTimer(() => completeActivity('dress-up', 0), 2600);
    }
  }
});
