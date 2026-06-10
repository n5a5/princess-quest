// ==================== PARENT CORNER (PIN, stats, settings) ====================

let pinEntry = '';

document.addEventListener('DOMContentLoaded', () => {
  const crown = document.getElementById('crown-tap');
  if (crown) crown.addEventListener('click', showPinOverlay);
});

function showPinOverlay() {
  pinEntry = '';
  updatePinDots();
  const keypad = document.getElementById('pin-keypad');
  keypad.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement('button');
    btn.className = 'pin-key'; btn.textContent = i;
    btn.onclick = () => enterPinDigit(String(i));
    keypad.appendChild(btn);
  }
  keypad.appendChild(document.createElement('div'));
  const zero = document.createElement('button');
  zero.className = 'pin-key'; zero.textContent = '0';
  zero.onclick = () => enterPinDigit('0');
  keypad.appendChild(zero);
  const back = document.createElement('button');
  back.className = 'pin-key backspace'; back.textContent = '⌫';
  back.onclick = () => { pinEntry = pinEntry.slice(0, -1); updatePinDots(); };
  keypad.appendChild(back);
  document.getElementById('pin-overlay').classList.add('show');
}

function enterPinDigit(d) {
  if (pinEntry.length >= 4) return;
  pinEntry += d;
  updatePinDots();
  if (pinEntry.length === 4) {
    if (pinEntry === (state.parentPin || '1234')) {
      closePin(); openDashboard();
    } else {
      document.querySelectorAll('.pin-dot').forEach(dot => dot.classList.add('error'));
      setTimeout(() => { pinEntry = ''; updatePinDots(); document.querySelectorAll('.pin-dot').forEach(dot => dot.classList.remove('error')); }, 500);
    }
  }
}

function updatePinDots() {
  document.querySelectorAll('#pin-dots .pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinEntry.length);
    dot.classList.remove('error');
  });
}

function closePin() { pinEntry = ''; document.getElementById('pin-overlay').classList.remove('show'); }

// ---------- DASHBOARD ----------
function openDashboard() {
  const d = document.getElementById('dash-stats');
  const lettersWithStars = Object.keys(state.letterStars).filter(l => state.letterStars[l] > 0);
  const totalLetterStars = Object.values(state.letterStars).reduce((a, b) => a + b, 0);
  const uniqueStickers = new Set(state.stickers).size;
  const openSets = openSetCount();

  d.innerHTML =
    '<div class="stat"><strong>Days played:</strong> ' + state.activeDays.length + '</div>' +
    '<div class="stat"><strong>Activities finished:</strong> ' + state.totalActivities + '</div>' +
    '<div class="stat"><strong>Letters practiced:</strong> ' + state.lettersPracticed.length + ' of 28 (' + totalLetterStars + ' letter stars)</div>' +
    '<div class="stat"><strong>Letters with stars:</strong> ' + (lettersWithStars.join(', ') || 'none yet') + '</div>' +
    '<div class="stat"><strong>Phonics sets open:</strong> ' + openSets + ' of ' + PHONICS_SETS.length + ' (next opens at 2 stars per letter)</div>' +
    '<div class="stat"><strong>Numbers practiced:</strong> ' + (state.numbersPracticed.slice().sort((a, b) => a - b).join(', ') || 'none yet') + '</div>' +
    '<div class="stat"><strong>Stickers:</strong> ' + uniqueStickers + ' of ' + STICKERS.length + ' unique (' + state.stickers.length + ' total)</div>' +
    '<hr style="margin:14px 0;border:none;border-top:2px solid #f3e8ff">' +
    '<h3 class="dash-h3">Settings</h3>' +
    '<div class="stat"><strong>Child name:</strong> <input id="set-name" class="dash-input" value="' + (state.name || '') + '" maxlength="20"> ' +
      '<button class="dash-btn" onclick="parentSetName()">Save</button></div>' +
    '<div class="stat"><strong>Narration:</strong> ' +
      '<button class="dash-btn" id="set-narration" onclick="parentToggleNarration()">' + (state.narrationOn !== false ? 'On ✅' : 'Off ❌') + '</button></div>' +
    '<div class="stat"><strong>Talking speed:</strong> ' +
      '<button class="dash-btn" onclick="parentSetRate(0.72)"' + (state.speechRate <= 0.75 ? ' style="background:#ddd6fe"' : '') + '>Slower</button> ' +
      '<button class="dash-btn" onclick="parentSetRate(0.82)"' + (state.speechRate > 0.75 && state.speechRate < 0.95 ? ' style="background:#ddd6fe"' : '') + '>Normal</button> ' +
      '<button class="dash-btn" onclick="parentSetRate(1.0)"' + (state.speechRate >= 0.95 ? ' style="background:#ddd6fe"' : '') + '>Quicker</button></div>' +
    '<div class="stat"><strong>Sounds:</strong> <button class="dash-btn" onclick="toggleSound();openDashboard()">' + (soundMuted ? 'Off ❌' : 'On ✅') + '</button> ' +
      '<strong style="margin-left:10px">Music:</strong> <button class="dash-btn" onclick="toggleMusic();openDashboard()">' + (musicMuted ? 'Off ❌' : 'On ✅') + '</button></div>' +
    '<div class="stat"><strong>Parent PIN:</strong> <input id="set-pin" class="dash-input" value="' + (state.parentPin || '1234') + '" maxlength="4" inputmode="numeric"> ' +
      '<button class="dash-btn" onclick="parentSetPin()">Save</button></div>' +
    '<div class="stat" style="margin-top:14px"><button class="dash-danger" onclick="parentReset()">Reset all progress</button></div>';

  document.getElementById('parent-dashboard').style.display = 'block';
}

function closeDashboard() {
  document.getElementById('parent-dashboard').style.display = 'none';
  renderHome();
}

function parentSetName() {
  const v = (document.getElementById('set-name').value || '').trim();
  if (v) {
    state.name = v.charAt(0).toUpperCase() + v.slice(1);
    saveState();
    renderHome();
    speak('Hello, ' + state.name + '!');
  }
  openDashboard();
}

function parentToggleNarration() {
  state.narrationOn = state.narrationOn === false ? true : false;
  saveState();
  if (state.narrationOn) speak('Narration is on!');
  else stopSpeech();
  openDashboard();
}

function parentSetRate(r) {
  state.speechRate = r;
  saveState();
  speak('I will talk like this now.');
  openDashboard();
}

function parentSetPin() {
  const v = (document.getElementById('set-pin').value || '').trim();
  if (/^\d{4}$/.test(v)) {
    state.parentPin = v;
    saveState();
  }
  openDashboard();
}

function parentReset() {
  if (confirm('Reset ALL progress for ' + (state.name || 'your child') + '? Stickers, stars, and rooms will be cleared. This cannot be undone.')) {
    try { localStorage.removeItem(STATE_KEY); } catch (e) {}
    location.reload();
  }
}
