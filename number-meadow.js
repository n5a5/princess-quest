// ==================== NUMBER MEADOW (kindergarten math) ====================
// Six activities: Counting, Peek-a-Boo (subitizing), Matching, Magic Math
// (add & take away within 5), Shapes, Patterns. All generator-driven, 1-10 only.

registerModule('numbers', {
  open() { this.showMenu(); },
  close() {},
  afterReward() { this.showMenu(); },

  showMenu() {
    const area = document.getElementById('numbers-game-area');
    const sel = document.getElementById('numbers-mode-select');
    area.style.display = 'none';
    sel.style.display = 'block';
    document.getElementById('numbers-progress').textContent =
      state.numbersPracticed.length + ' numbers practiced 🦄';
  },

  _showGame() {
    document.getElementById('numbers-mode-select').style.display = 'none';
    const area = document.getElementById('numbers-game-area');
    area.style.display = 'block';
    return area;
  },

  _numberOptions(answer, max) {
    const opts = [answer];
    while (opts.length < 3) {
      const n = randInt(Math.max(1, answer - 2), Math.min(max, answer + 2));
      if (!opts.includes(n)) opts.push(n);
    }
    return shuffle(opts);
  },

  _practiced(n) {
    if (!state.numbersPracticed.includes(n)) { state.numbersPracticed.push(n); saveState(); }
  },

  // ============ 1. COUNTING ============
  startCounting() {
    this._round = 0; this._retries = 0;
    this._countNext();
  },

  _countNext() {
    if (this._round >= 5) { completeActivity('counting', this._retries); return; }
    const area = this._showGame();
    const n = randInt(1, Math.min(10, 3 + this._round * 2));
    const obj = COUNT_OBJECTS[Math.floor(Math.random() * COUNT_OBJECTS.length)];
    this._countN = n;
    this._countTapped = 0;
    this._countObj = obj;
    let html = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">Tap each one to count!</div>' +
      '<div class="objects-area" id="count-objects">';
    for (let i = 0; i < n; i++) {
      html += '<button class="count-object" onclick="Modules.numbers._tapCount(this)">' + obj.e + '</button>';
    }
    html += '</div><div class="count-readout" id="count-readout">&nbsp;</div><div id="count-answer"></div>';
    area.innerHTML = html;
    speak('Count the ' + obj.name + ' with me, {name}! Tap each one.');
    startHintTimer('Tap every ' + obj.name.replace(/s$/, '') + ' one time.');
  },

  _tapCount(btn) {
    if (btn.classList.contains('counted')) return;
    btn.classList.add('counted');
    this._countTapped++;
    playSound('pop');
    haptic('tap');
    speak(String(this._countTapped));
    document.getElementById('count-readout').textContent = this._countTapped;
    if (this._countTapped === this._countN) {
      clearHintTimer();
      const opts = this._numberOptions(this._countN, 10);
      let html = '<div class="activity-title">How many?</div><div class="big-options">';
      opts.forEach(o => {
        html += '<button class="big-option num-opt" data-n="' + o + '" onclick="Modules.numbers._countPick(this)">' + o + '</button>';
      });
      html += '</div>';
      document.getElementById('count-answer').innerHTML = html;
      setActivityTimer(() => speak('How many ' + this._countObj.name + ' are there?'), 800);
    }
  },

  _countPick(btn) {
    const n = parseInt(btn.dataset.n, 10);
    if (n === this._countN) {
      markCorrect(btn);
      this._practiced(n);
      speak('Yes! ' + n + ' ' + this._countObj.name + '!');
      this._round++;
      setActivityTimer(() => this._countNext(), 1600);
    } else {
      this._retries++;
      gentleNo(btn, 'Let’s count again together! Tap the number we counted.');
    }
  },

  // ============ 2. PEEK-A-BOO (subitizing 1-5) ============
  startPeek() {
    this._round = 0; this._retries = 0;
    this._peekNext();
  },

  _peekNext() {
    if (this._round >= 5) { completeActivity('peekaboo', this._retries); return; }
    const area = this._showGame();
    const n = randInt(1, 5);
    this._peekN = n;
    const obj = COUNT_OBJECTS[Math.floor(Math.random() * COUNT_OBJECTS.length)];
    this._peekObj = obj;
    let dots = '';
    for (let i = 0; i < n; i++) dots += '<span>' + obj.e + '</span>';
    area.innerHTML = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">Quick peek! How many?</div>' +
      '<div class="peek-box" id="peek-box"><div class="peek-dots">' + dots + '</div></div>' +
      '<div id="peek-answer"></div>';
    speak('Peek! How many ' + obj.name + ' do you see?');
    // Hide after a friendly 2 seconds, then show options. Peeking again is allowed!
    setActivityTimer(() => {
      const box = document.getElementById('peek-box');
      if (!box) return;
      box.classList.add('hidden-peek');
      box.innerHTML = '<button class="peek-again" onclick="Modules.numbers._peekAgain()">👀 Peek again</button>';
      const opts = this._numberOptions(n, 5);
      let html = '<div class="big-options">';
      opts.forEach(o => {
        html += '<button class="big-option num-opt" data-n="' + o + '" onclick="Modules.numbers._peekPick(this)">' + o + '</button>';
      });
      html += '</div>';
      document.getElementById('peek-answer').innerHTML = html;
    }, 2000);
  },

  _peekAgain() {
    // No penalty for peeking — gentle by design.
    const box = document.getElementById('peek-box');
    let dots = '';
    for (let i = 0; i < this._peekN; i++) dots += '<span>' + this._peekObj.e + '</span>';
    box.classList.remove('hidden-peek');
    box.innerHTML = '<div class="peek-dots">' + dots + '</div>';
    playSound('click');
    setActivityTimer(() => {
      box.classList.add('hidden-peek');
      box.innerHTML = '<button class="peek-again" onclick="Modules.numbers._peekAgain()">👀 Peek again</button>';
    }, 2000);
  },

  _peekPick(btn) {
    const n = parseInt(btn.dataset.n, 10);
    if (n === this._peekN) {
      markCorrect(btn);
      this._practiced(n);
      speak('Yes, ' + n + '! Great eyes, {name}!');
      this._round++;
      setActivityTimer(() => this._peekNext(), 1600);
    } else {
      this._retries++;
      gentleNo(btn, 'Want another peek? Tap peek again, then pick the number.');
    }
  },

  // ============ 3. MATCHING (numeral <-> quantity) ============
  startMatch() {
    this._round = 0; this._retries = 0;
    this._matchNext();
  },

  _matchNext() {
    if (this._round >= 5) { completeActivity('matching', this._retries); return; }
    const area = this._showGame();
    const n = randInt(1, 10);
    this._matchN = n;
    const obj = COUNT_OBJECTS[Math.floor(Math.random() * COUNT_OBJECTS.length)];
    const opts = this._numberOptions(n, 10);
    let html = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">Find the matching number!</div>' +
      '<div class="match-group">';
    for (let i = 0; i < n; i++) html += '<span>' + obj.e + '</span>';
    html += '</div><div class="big-options">';
    opts.forEach(o => {
      html += '<button class="big-option num-opt" data-n="' + o + '" onclick="Modules.numbers._matchPick(this)">' + o + '</button>';
    });
    html += '</div>';
    area.innerHTML = html;
    speak('Count the ' + obj.name + ', then tap the matching number!');
    startHintTimer('Touch each ' + obj.name.replace(/s$/, '') + ' while you count out loud.');
  },

  _matchPick(btn) {
    const n = parseInt(btn.dataset.n, 10);
    if (n === this._matchN) {
      clearHintTimer();
      markCorrect(btn);
      this._practiced(n);
      speak('That’s it! ' + n + '!');
      this._round++;
      setActivityTimer(() => this._matchNext(), 1500);
    } else {
      this._retries++;
      gentleNo(btn, 'Count one more time, nice and slow.');
    }
  },

  // ============ 4. MAGIC MATH (add & take away within 5) ============
  startMath() {
    this._round = 0; this._retries = 0;
    this._mathNext();
  },

  _mathNext() {
    if (this._round >= 5) { completeActivity('magic-math', this._retries); return; }
    const area = this._showGame();
    const isAdd = Math.random() < 0.6;
    const obj = COUNT_OBJECTS[Math.floor(Math.random() * COUNT_OBJECTS.length)];
    let a, b, answer, story;
    if (isAdd) {
      a = randInt(1, 4); b = randInt(1, 5 - a); answer = a + b;
      story = a + ' ' + obj.name + ', and ' + b + ' more come to play. How many now?';
    } else {
      a = randInt(2, 5); b = randInt(1, a - 1); answer = a - b;
      story = a + ' ' + obj.name + ', and ' + b + ' hop away. How many are left?';
    }
    this._mathAnswer = answer;
    let html = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">' + (isAdd ? '✨ More friends come!' : '✨ Some hop away!') + '</div>' +
      '<div class="math-stage" id="math-stage">';
    for (let i = 0; i < a; i++) html += '<span class="math-obj">' + obj.e + '</span>';
    html += '</div><div class="math-line" id="math-line">' +
      a + ' ' + (isAdd ? '+' : '−') + ' ' + b + ' = ?</div>' +
      '<div id="math-answer"></div>';
    area.innerHTML = html;
    speak(story);

    const stage = document.getElementById('math-stage');
    setActivityTimer(() => {
      if (isAdd) {
        for (let i = 0; i < b; i++) {
          const s = document.createElement('span');
          s.className = 'math-obj arriving';
          s.textContent = obj.e;
          stage.appendChild(s);
        }
        playSound('pop');
      } else {
        const objs = stage.querySelectorAll('.math-obj');
        for (let i = 0; i < b; i++) objs[objs.length - 1 - i].classList.add('leaving');
        playSound('click');
      }
      const opts = this._numberOptions(answer, 5);
      let oh = '<div class="big-options">';
      opts.forEach(o => {
        oh += '<button class="big-option num-opt" data-n="' + o + '" onclick="Modules.numbers._mathPick(this)">' + o + '</button>';
      });
      oh += '</div>';
      document.getElementById('math-answer').innerHTML = oh;
      startHintTimer('Count the ' + obj.name + ' you can see now.');
    }, 1700);
  },

  _mathPick(btn) {
    const n = parseInt(btn.dataset.n, 10);
    if (n === this._mathAnswer) {
      clearHintTimer();
      markCorrect(btn);
      this._practiced(n);
      speak('Magic! The answer is ' + n + '!');
      this._round++;
      setActivityTimer(() => this._mathNext(), 1600);
    } else {
      this._retries++;
      gentleNo(btn, 'Count how many are on the screen now, then try again.');
    }
  },

  // ============ 5. SHAPES ============
  startShapes() {
    this._round = 0; this._retries = 0;
    this._shapeNext();
  },

  _shapeNext() {
    if (this._round >= 5) { completeActivity('shapes', this._retries); return; }
    const area = this._showGame();
    const target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    this._shapeTarget = target;
    const realWorld = Math.random() < 0.4;
    let html = roundProgressHtml(this._round, 5);
    if (realWorld) {
      // "Which one looks like a circle?" with world objects
      const w = target.world[Math.floor(Math.random() * target.world.length)];
      const others = pickN(SHAPES.filter(s => s.name !== target.name), 2)
        .map(s => s.world[Math.floor(Math.random() * s.world.length)]);
      const options = shuffle([{ ...w, ok: true }].concat(others.map(o => ({ ...o, ok: false }))));
      this._shapeMode = 'world';
      html += '<div class="activity-title">Which one looks like a ' + target.name + '?</div>' +
        '<div class="shape-target">' + target.e + '</div><div class="big-options">';
      options.forEach((o, i) => {
        html += '<button class="big-option shape-opt" data-ok="' + o.ok + '" data-w="' + o.w + '" onclick="Modules.numbers._shapePick(this)">' + o.e + '</button>';
      });
      html += '</div>';
      area.innerHTML = html;
      speak('A ' + target.name + '! Which one looks like a ' + target.name + '?');
    } else {
      const others = pickN(SHAPES.filter(s => s.name !== target.name), 2);
      const options = shuffle([target].concat(others));
      this._shapeMode = 'shape';
      html += '<div class="activity-title">Find the ' + target.name + '!</div><div class="big-options">';
      options.forEach(s => {
        html += '<button class="big-option shape-opt" data-ok="' + (s.name === target.name) + '" data-w="' + s.name + '" onclick="Modules.numbers._shapePick(this)">' + s.e + '</button>';
      });
      html += '</div>';
      area.innerHTML = html;
      speak('Can you find the ' + target.name + '?');
    }
    startHintTimer('Look for the ' + target.name + ' shape, {name}.');
  },

  _shapePick(btn) {
    if (btn.dataset.ok === 'true') {
      clearHintTimer();
      markCorrect(btn);
      speak('Yes! ' + (this._shapeMode === 'world'
        ? 'A ' + btn.dataset.w + ' looks like a ' + this._shapeTarget.name + '!'
        : 'That’s the ' + this._shapeTarget.name + '!'));
      this._round++;
      setActivityTimer(() => this._shapeNext(), 1700);
    } else {
      this._retries++;
      gentleNo(btn, 'Hmm, that’s a ' + btn.dataset.w + '. Look for the ' + this._shapeTarget.name + '!');
    }
  },

  // ============ 6. PATTERNS ============
  startPatterns() {
    this._round = 0; this._retries = 0;
    this._patternNext();
  },

  _patternNext() {
    if (this._round >= 5) { completeActivity('patterns', this._retries); return; }
    const area = this._showGame();
    const theme = PATTERN_THEMES[Math.floor(Math.random() * PATTERN_THEMES.length)];
    const a = theme[0], b = theme[1], c = theme[2];
    const kinds = c ? ['AB', 'ABB', 'ABC'] : ['AB', 'ABB', 'AABB'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    let unit;
    if (kind === 'AB') unit = [a, b];
    else if (kind === 'ABB') unit = [a, b, b];
    else if (kind === 'AABB') unit = [a, a, b, b];
    else unit = [a, b, c];
    // Build a sequence of 2 full units + the next item hidden.
    const seq = unit.concat(unit);
    const answer = unit[0];
    this._patternAnswer = answer;
    const distract = theme.filter(t => t !== answer);
    while (distract.length < 2) {
      const extra = ['🌟', '🍀', '🐞'].find(x => !theme.includes(x) && !distract.includes(x));
      distract.push(extra);
    }
    const options = shuffle([answer].concat(distract.slice(0, 2)));
    let html = roundProgressHtml(this._round, 5) +
      '<div class="activity-title">What comes next?</div>' +
      '<div class="pattern-row">';
    seq.forEach(s => { html += '<span class="pat-item">' + s + '</span>'; });
    html += '<span class="pat-item blank">?</span></div><div class="big-options">';
    options.forEach(o => {
      html += '<button class="big-option pat-opt" data-e="' + o + '" onclick="Modules.numbers._patternPick(this)">' + o + '</button>';
    });
    html += '</div>';
    area.innerHTML = html;
    speak('Look at the pattern, {name}. What comes next?');
    startHintTimer('Say the pattern out loud — it helps!');
  },

  _patternPick(btn) {
    if (btn.dataset.e === this._patternAnswer) {
      clearHintTimer();
      const blank = document.querySelector('.pat-item.blank');
      if (blank) { blank.textContent = this._patternAnswer; blank.classList.remove('blank'); }
      markCorrect(btn);
      speak('That’s the pattern! Wonderful!');
      this._round++;
      setActivityTimer(() => this._patternNext(), 1700);
    } else {
      this._retries++;
      gentleNo(btn, 'Say the pattern out loud, then try again!');
    }
  }
});
