// ==================== LETTER GARDEN (phonics) ====================
// Five activities: Letter Sounds, Find the Letter, First Sounds, Tracing, Word Builder.

registerModule('letters', {
  _lastOpenSets: null,

  open() {
    // Celebrate newly bloomed sets ("appearing", never "unlocking").
    const open = openSetCount();
    if (this._lastOpenSets !== null && open > this._lastOpenSets) {
      createConfetti(30);
      speak('Look, {name}! New letter flowers bloomed in your garden!');
    }
    this._lastOpenSets = open;
    this.showMenu();
  },

  close() {},

  afterReward() { this.showMenu(); },

  showMenu() {
    const area = document.getElementById('letters-game-area');
    const sel = document.getElementById('letters-mode-select');
    area.style.display = 'none';
    sel.style.display = 'block';
    const stars = Object.values(state.letterStars).reduce((a, b) => a + b, 0);
    document.getElementById('letters-progress').textContent =
      availableLetters().length + ' letters in bloom 🌸 ' + stars + ' stars';
  },

  _showGame() {
    document.getElementById('letters-mode-select').style.display = 'none';
    const area = document.getElementById('letters-game-area');
    area.style.display = 'block';
    return area;
  },

  // ============ 1. LETTER SOUNDS (free play) ============
  startSounds() {
    const area = this._showGame();
    const letters = availableLetters();
    this._soundTaps = 0;
    let html = '<div class="activity-title">🌸 Tap a flower to hear its sound!</div><div class="letter-flower-grid">';
    letters.forEach(l => {
      const stars = letterStars(l);
      html += '<button class="letter-flower" data-letter="' + l + '" onclick="Modules.letters._tapSound(this)">' +
        '<span class="lf-letter">' + l + '</span>' +
        '<span class="lf-stars">' + (stars ? '🌼'.repeat(stars) : '·') + '</span></button>';
    });
    html += '</div><div id="sound-showcase" class="sound-showcase"></div>';
    area.innerHTML = html;
    speak('Welcome to the Letter Garden, {name}! Tap any flower to hear its sound.');
  },

  _tapSound(btn) {
    haptic('tap');
    playSound('pop');
    const l = btn.dataset.letter;
    const ld = LETTERS[l];
    const w = ld.words[Math.floor(Math.random() * ld.words.length)];
    const box = document.getElementById('sound-showcase');
    box.innerHTML = '<div class="sc-letter">' + l + '</div><div class="sc-pic">' + w.e + '</div><div class="sc-word">' + w.w + '</div>';
    box.classList.remove('pop-in'); void box.offsetWidth; box.classList.add('pop-in');
    const where = ld.endSound ? 'at the end of' : 'like';
    speak(ld.sound + '! ' + l + ' says ' + ld.sound + ', ' + where + ' ' + w.w + '!');
    practiceLetter(l);
    burstAtElement(btn, 5);
    this._soundTaps++;
    if (this._soundTaps === 8) {
      setActivityTimer(() => completeActivity('letter-sounds', 0), 1500);
    }
  },

  // ============ 2. FIND THE LETTER ============
  startFind() {
    this._round = 0; this._retries = 0;
    this._findNext();
  },

  _findNext() {
    if (this._round >= 5) { completeActivity('find-letter', this._retries); return; }
    const area = this._showGame();
    const letters = availableLetters();
    const target = letters[Math.floor(Math.random() * letters.length)];
    const others = pickN(letters.filter(l => l !== target), 2);
    const options = shuffle([target].concat(others));
    this._findTarget = target;
    const ld = LETTERS[target];
    const w = ld.words[Math.floor(Math.random() * ld.words.length)];
    this._findWord = w;
    let html = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">Which letter says…</div>' +
      '<button class="hear-again" onclick="Modules.letters._findSay()">🔊 ' + ld.sound + '</button>' +
      '<div class="big-options">';
    options.forEach(l => {
      html += '<button class="big-option letter-opt" data-l="' + l + '" onclick="Modules.letters._findPick(this)">' + l + '</button>';
    });
    html += '</div>';
    area.innerHTML = html;
    this._findSay();
    startHintTimer('Listen again, then tap the letter that says ' + ld.sound + '.');
  },

  _findSay() {
    const ld = LETTERS[this._findTarget];
    speak('Which letter says ' + ld.sound + '? ' + ld.sound + ', like ' + this._findWord.w + '.');
  },

  _findPick(btn) {
    const l = btn.dataset.l;
    if (l === this._findTarget) {
      clearHintTimer();
      markCorrect(btn);
      addLetterStar(l);
      speak('Yes! ' + l + ' says ' + LETTERS[l].sound + '!');
      this._round++;
      setActivityTimer(() => this._findNext(), 1600);
    } else {
      this._retries++;
      gentleNo(btn, 'That one says ' + LETTERS[l].sound + '. We want ' + LETTERS[this._findTarget].sound + '. Try again!');
    }
  },

  // ============ 3. FIRST SOUNDS ============
  startFirst() {
    this._round = 0; this._retries = 0;
    this._firstNext();
  },

  _firstNext() {
    if (this._round >= 5) { completeActivity('first-sounds', this._retries); return; }
    const area = this._showGame();
    // Pick a target letter (skip end-sound letters like ck/x) and one of its pictures.
    const letters = availableLetters().filter(l => !LETTERS[l].endSound);
    const target = letters[Math.floor(Math.random() * letters.length)];
    const w = LETTERS[target].words[Math.floor(Math.random() * LETTERS[target].words.length)];
    const others = pickN(letters.filter(l => l !== target), 2);
    const options = shuffle([target].concat(others));
    this._firstTarget = target;
    this._firstWord = w;
    let html = roundProgressHtml(this._round, 5) +
      '<div class="first-pic" onclick="Modules.letters._firstSay()">' + w.e + '</div>' +
      '<div class="activity-title">' + w.w + ' starts with…</div>' +
      '<button class="hear-again" onclick="Modules.letters._firstSay()">🔊 Hear it</button>' +
      '<div class="big-options">';
    options.forEach(l => {
      html += '<button class="big-option letter-opt" data-l="' + l + '" onclick="Modules.letters._firstPick(this)">' + l + '</button>';
    });
    html += '</div>';
    area.innerHTML = html;
    this._firstSay();
    startHintTimer(w.w + '. ' + LETTERS[target].sound + ', ' + w.w + '. Which letter makes that sound?');
  },

  _firstSay() {
    const w = this._firstWord;
    speak(w.w + '! What sound does ' + w.w + ' start with?');
  },

  _firstPick(btn) {
    const l = btn.dataset.l;
    if (l === this._firstTarget) {
      clearHintTimer();
      markCorrect(btn);
      addLetterStar(l);
      speak('Yes! ' + this._firstWord.w + ' starts with ' + l + '. ' + LETTERS[l].sound + ', ' + this._firstWord.w + '!');
      this._round++;
      setActivityTimer(() => this._firstNext(), 1900);
    } else {
      this._retries++;
      gentleNo(btn, this._firstWord.w + ' starts with ' + LETTERS[this._firstTarget].sound + '. Try again, {name}!');
    }
  },

  // ============ 4. TRACING ============
  startTrace() {
    this._traceLetters = availableLetters().filter(l => l.length === 1); // single letters only
    this._traceIdx = 0;
    this._tracedCount = 0;
    this._renderTrace();
  },

  _renderTrace() {
    const area = this._showGame();
    const l = this._traceLetters[this._traceIdx];
    const ld = LETTERS[l];
    const w = ld.words[0];
    const self = this;

    area.innerHTML =
      '<div style="text-align:center">' +
        '<div class="trace-caption">' + w.e + ' <span>' + w.w + '</span></div>' +
        '<div class="trace-box">' +
          '<div class="trace-guide">' + l + '</div>' +
          '<canvas id="trace-canvas" width="280" height="280"></canvas>' +
        '</div>' +
        '<div class="trace-nav" id="letter-nav"></div>' +
        '<div style="margin-top:8px">' +
          '<button class="big-btn small" onclick="Modules.letters._clearTrace()">Clear 🧽</button>' +
          '<button class="big-btn small green" onclick="Modules.letters._checkTrace()">Done ✅</button>' +
        '</div>' +
      '</div>';

    const nav = document.getElementById('letter-nav');
    this._traceLetters.forEach((tl, i) => {
      const btn = document.createElement('button');
      btn.textContent = tl;
      btn.className = 'trace-nav-btn' + (i === this._traceIdx ? ' current' : '');
      btn.onclick = () => { self._traceIdx = i; self._renderTrace(); };
      nav.appendChild(btn);
    });

    const canvas = document.getElementById('trace-canvas');
    const ctx = canvas.getContext('2d');
    this._traceCanvas = canvas;
    this._traceCtx = ctx;
    this._drawing = false;
    this._coverageGrid = Array.from({ length: 7 }, () => Array(7).fill(false));

    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#a855f7';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - rect.left) * (280 / rect.width), y: (t.clientY - rect.top) * (280 / rect.height) };
    }
    function markGrid(x, y) {
      const gx = Math.floor(x / 40);
      const gy = Math.floor(y / 40);
      if (gx >= 0 && gx < 7 && gy >= 0 && gy < 7) self._coverageGrid[gy][gx] = true;
    }
    const startDraw = (e) => { e.preventDefault(); self._drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); markGrid(p.x, p.y); };
    const moveDraw = (e) => { e.preventDefault(); if (!self._drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); markGrid(p.x, p.y); };
    const endDraw = (e) => { e.preventDefault(); self._drawing = false; };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });

    speak(l + ' says ' + ld.sound + ', like ' + w.w + '. Trace the letter ' + l + ' with your finger!');
  },

  _clearTrace() {
    if (this._traceCtx && this._traceCanvas) {
      this._traceCtx.clearRect(0, 0, 280, 280);
      this._coverageGrid = Array.from({ length: 7 }, () => Array(7).fill(false));
      playSound('click');
    }
  },

  _checkTrace() {
    let filled = 0;
    this._coverageGrid.forEach(row => row.forEach(cell => { if (cell) filled++; }));
    const l = this._traceLetters[this._traceIdx];
    if (filled >= 9) {
      markCorrect(this._traceCanvas);
      addLetterStar(l);
      createSparkles(8);
      this._tracedCount++;
      if (this._tracedCount >= 3) {
        speak('Beautiful tracing, {name}!');
        setActivityTimer(() => { this._tracedCount = 0; completeActivity('tracing', 0); }, 1400);
      } else {
        speak('Beautiful letter ' + l + '! Let’s trace another one.');
        this._traceIdx = (this._traceIdx + 1) % this._traceLetters.length;
        setActivityTimer(() => this._renderTrace(), 1800);
      }
    } else {
      playSound('gentle');
      showReaction('retry');
      speak('Keep going! Trace a bit more of the letter ' + l + '.');
    }
  },

  // ============ 5. WORD BUILDER (CVC blending) ============
  startWords() {
    this._wordCount = 0;
    this._wordNext();
  },

  _availableWords() {
    const open = openSetCount();
    const pool = CVC_WORDS.filter(w => w.set < open && w.e);
    return pool.length ? pool : CVC_WORDS.filter(w => w.set === 0);
  },

  _wordNext() {
    if (this._wordCount >= 3) { completeActivity('word-builder', 0); return; }
    const area = this._showGame();
    const pool = this._availableWords();
    const wd = pool[Math.floor(Math.random() * pool.length)];
    this._word = wd;
    this._tiles = wd.tiles || wd.word.split('');
    this._tileIdx = 0;
    let html = '<div class="activity-title">Tap the sounds in order!</div>' +
      '<div class="word-pic" id="word-pic">❔</div>' +
      '<div class="word-tiles" id="word-tiles">';
    this._tiles.forEach((t, i) => {
      html += '<button class="word-tile" data-i="' + i + '" onclick="Modules.letters._tapTile(this)">' + t + '</button>';
    });
    html += '</div><div class="word-blend" id="word-blend"></div>';
    area.innerHTML = html;
    speak('Let’s build a word! Tap the first sound.');
    startHintTimer('Tap the letters from left to right, {name}.');
  },

  _tapTile(btn) {
    const i = parseInt(btn.dataset.i, 10);
    if (i !== this._tileIdx) {
      // Not in order — gently point to the next one (no penalty).
      playSound('gentle');
      const next = this._tiles[this._tileIdx];
      speak('Let’s tap ' + next + ' first!');
      return;
    }
    const t = this._tiles[i];
    btn.classList.add('lit');
    playSound('pop');
    haptic('tap');
    const ld = LETTERS[t];
    speak(ld ? ld.sound : t);
    this._tileIdx++;
    if (this._tileIdx >= this._tiles.length) {
      clearHintTimer();
      const wd = this._word;
      setActivityTimer(() => {
        document.getElementById('word-pic').textContent = wd.e || '✨';
        document.getElementById('word-blend').textContent = wd.word + '!';
        const sounds = this._tiles.map(x => (LETTERS[x] ? LETTERS[x].sound : x)).join(', ');
        speak(sounds + '… ' + wd.word + '! You read the word ' + wd.word + '!');
        createSparkles(8);
        playSound('correct');
        this._tiles.forEach(l => { if (LETTERS[l]) addLetterStar(l); });
        this._wordCount++;
        setActivityTimer(() => this._wordNext(), 3200);
      }, 600);
    }
  }
});
