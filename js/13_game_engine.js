// ===================================================================
// 13_GAME_ENGINE.JS — OC Game Mode
// ===================================================================
// Rein additiv — kein bestehender Code wird angefasst.
// Lädt nach 11_gif_export.js in index.html.
//
// Globale Abhängigkeiten (aus anderen Dateien):
//   ball, players, defensePlayers, OLINE_IDS, olineData
//   motionOwnerId, nextDefId, mode
//   applyLoadedPlayData(), showToast(), lastPlayOutcome
//   closeOutcomeOverlay()
// ===================================================================

// ── Game State ───────────────────────────────────────────────────────

let gameState = {
  down:       1,
  distance:   10,
  yardLine:   25,     // 0 = eigene Endzone, 100 = Gegner-Endzone
  quarter:    1,
  score:      { home: 0, away: 0 },
  clock:      900,    // 15 min in Sekunden
  active:     false,
  possession: 'home',
};

// ── LocalStorage Playbook ────────────────────────────────────────────

const PLAYBOOK_KEY = 'kardiron_playbook';

function getPlaybook() {
  try { return JSON.parse(localStorage.getItem(PLAYBOOK_KEY) || '[]'); }
  catch { return []; }
}

function _buildCurrentPlayData() {
  const nameInput = document.getElementById('playNameInput');
  const name = nameInput?.value?.trim() || 'Unnamed Play';
  return {
    name,
    ball: { x: ball.x, y: ball.y },
    motionOwnerId,
    olineBlocks: Object.fromEntries(
      OLINE_IDS.map(id => [id, {
        blockPoints: olineData[id].blockPoints,
        important:   olineData[id].important,
        offsetX:     olineData[id].offsetX || 0,
        offsetY:     olineData[id].offsetY || 0,
        removed:     !!olineData[id].removed,
      }])
    ),
    players: players.map(p => ({
      id: p.id, type: p.type, label: p.label,
      x: p.x, y: p.y, origX: p.origX, origY: p.origY,
      important:    p.important,
      routePoints:  p.routePoints,
      motionPoints: p.motionPoints,
      shiftPoints:  p.shiftPoints,
      blockPoints:  p.blockPoints,
      routes:       p.routePoints,
    })),
    defensePlayers: defensePlayers.map(d => ({
      id: d.id, role: d.role, x: d.x, y: d.y,
      origX: d.origX, origY: d.origY,
      assignment: { ...d.assignment },
      speedMultiplier: d.speedMultiplier,
      cbSpacing: d.cbSpacing || 'normal',
      cbShade:   d.cbShade   || 'normal',
      mirroredWRId: d.mirroredWRId ?? null,
    })),
    nextDefId,
  };
}

function saveToPlaybook() {
  if (mode === 'sim') { showToast('⚠ Erst Sim stoppen', 'error'); return; }
  const data = _buildCurrentPlayData();
  const name = data.name;
  if (!name || name === 'Unnamed Play') {
    showToast('⚠ Play-Namen eingeben bevor speichern', 'error'); return;
  }
  const playbook = getPlaybook();
  const existingIdx = playbook.findIndex(p => p.name === name);
  const entry = { name, timestamp: Date.now(), data };

  if (existingIdx >= 0) {
    playbook[existingIdx] = entry;
  } else {
    playbook.push(entry);
  }

  try {
    localStorage.setItem(PLAYBOOK_KEY, JSON.stringify(playbook));
  } catch (e) {
    showToast('⚠ Speichern fehlgeschlagen — localStorage voll', 'error');
    return;
  }
  if (existingIdx >= 0) showToast(`Updated "${name}" in Playbook`, 'success');
  else                  showToast(`"${name}" → Playbook`, 'success');
  _renderPlaybookModal();
}

// ── UI-Injection ─────────────────────────────────────────────────────

function _injectGameUI() {
  // 1. GAME button → offense panel (under the QB throws / formation toggles).
  //    PLAYBOOK now lives in the header SAVE ▾ dropdown (calls saveToPlaybook directly).
  const gameSlot = document.getElementById('gameBtnSlot');
  if (gameSlot && !document.getElementById('gameModeBtn')) {
    const gameModeBtn = document.createElement('button');
    gameModeBtn.className = 'panel-action-btn';
    gameModeBtn.id = 'gameModeBtn';
    gameModeBtn.textContent = '🏈 GAME';
    gameModeBtn.title = 'Toggle OC Game Mode';
    gameModeBtn.onclick = toggleGameMode;
    gameSlot.appendChild(gameModeBtn);
  }

  // 2. Scoreboard-Bar (zwischen header und .main)
  const scoreboard = document.createElement('div');
  scoreboard.id = 'gameScoreboard';
  scoreboard.style.cssText = [
    'display:none',
    'align-items:center',
    'justify-content:space-between',
    'padding:0 20px',
    'height:44px',
    'background:#0c0f14',
    'border-bottom:1px solid rgba(255,94,26,0.3)',
    'flex-shrink:0',
    'gap:12px',
    "font-family:'Barlow Condensed',sans-serif",
    'font-size:13px',
    'letter-spacing:0.5px',
  ].join(';');

  scoreboard.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex:1;min-width:0">
      <div id="sbDownDist" style="font-size:16px;font-weight:700;color:#fff;white-space:nowrap">1st &amp; 10</div>
      <div id="sbFieldPos" style="color:rgba(240,240,242,0.5);white-space:nowrap;font-size:13px">Own 25</div>
    </div>

    <div style="display:flex;align-items:center;gap:16px;flex-shrink:0">
      <div style="text-align:right">
        <div style="font-size:10px;color:rgba(240,240,242,0.3);letter-spacing:1px">HOME</div>
        <div id="sbScoreHome" style="font-size:22px;font-weight:700;color:#fff;line-height:1">0</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:10px;color:rgba(240,240,242,0.3);letter-spacing:1px">Q<span id="sbQuarter">1</span></div>
        <div id="sbClock" style="font-size:13px;color:rgba(240,240,242,0.5)">15:00</div>
      </div>
      <div style="text-align:left">
        <div style="font-size:10px;color:rgba(240,240,242,0.3);letter-spacing:1px">AWAY</div>
        <div id="sbScoreAway" style="font-size:22px;font-weight:700;color:rgba(240,240,242,0.5);line-height:1">0</div>
      </div>
    </div>

    <div style="flex:1;display:flex;justify-content:flex-end">
      <button id="callPlayBtn" style="
        display:none;
        background:rgba(255,94,26,0.15);
        border:1px solid rgba(255,94,26,0.5);
        border-radius:4px;
        color:#ff5e1a;
        font-family:'Barlow Condensed',sans-serif;
        font-size:13px;
        font-weight:600;
        letter-spacing:1px;
        padding:6px 14px;
        cursor:pointer;
        white-space:nowrap;
        transition:background 0.15s;
      " onmouseover="this.style.background='rgba(255,94,26,0.25)'"
         onmouseout="this.style.background='rgba(255,94,26,0.15)'"
         onclick="openCallPlayModal()">📋 CALL PLAY</button>
    </div>
  `;

  const mainEl = document.querySelector('.main');
  if (mainEl) mainEl.parentNode.insertBefore(scoreboard, mainEl);

  // 3. Call Play Modal
  const callPlayModal = document.createElement('div');
  callPlayModal.id = 'callPlayModal';
  callPlayModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,0.78);align-items:center;justify-content:center;';
  callPlayModal.innerHTML = `
    <div style="background:#16191f;border:1px solid rgba(255,94,26,0.35);border-radius:8px;
                padding:24px;min-width:300px;max-width:460px;width:90vw;max-height:75vh;
                display:flex;flex-direction:column;gap:14px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;
                  letter-spacing:2px;color:#fff">📋 PLAYBOOK</div>
      <div style="font-size:11px;color:rgba(240,240,242,0.4);margin-top:-6px">
        Situation: <span id="cpSituation">—</span>
      </div>
      <div id="callPlayList" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:5px;
                                    max-height:50vh;min-height:60px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px">
        <button onclick="closeCallPlayModal()" style="
          background:transparent;border:1px solid rgba(255,255,255,0.12);border-radius:4px;
          color:rgba(240,240,242,0.5);font-family:'Barlow Condensed',sans-serif;
          font-size:13px;letter-spacing:1px;padding:6px 16px;cursor:pointer;">CANCEL</button>
      </div>
    </div>
  `;
  document.body.appendChild(callPlayModal);

  // 4. 4th Down Decision Modal
  const fourthDownModal = document.createElement('div');
  fourthDownModal.id = 'fourthDownModal';
  fourthDownModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:8100;background:rgba(0,0,0,0.82);align-items:center;justify-content:center;';
  fourthDownModal.innerHTML = `
    <div style="background:#16191f;border:1px solid rgba(255,220,50,0.4);border-radius:8px;
                padding:28px 32px;min-width:280px;display:flex;flex-direction:column;gap:18px;align-items:center">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;
                  letter-spacing:2px;color:#ffe040;text-align:center">⬡ 4TH DOWN</div>
      <div id="fourthDownSituation" style="font-size:13px;color:rgba(240,240,242,0.55);text-align:center">
        4th &amp; — — Own —
      </div>
      <div style="display:flex;flex-direction:column;gap:9px;width:100%">
        <button onclick="fourthDownDecision('go')" style="
          width:100%;background:rgba(255,94,26,0.15);border:1px solid rgba(255,94,26,0.5);
          border-radius:4px;color:#ff5e1a;font-family:'Barlow Condensed',sans-serif;
          font-size:15px;font-weight:600;letter-spacing:1px;padding:9px;cursor:pointer;">
          🏈 Go For It
        </button>
        <button onclick="fourthDownDecision('punt')" style="
          width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);
          border-radius:4px;color:#f0f0f2;font-family:'Barlow Condensed',sans-serif;
          font-size:15px;font-weight:600;letter-spacing:1px;padding:9px;cursor:pointer;">
          ➡ Punt
        </button>
        <button id="fgBtn" onclick="fourthDownDecision('fg')" style="
          width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);
          border-radius:4px;color:#f0f0f2;font-family:'Barlow Condensed',sans-serif;
          font-size:15px;font-weight:600;letter-spacing:1px;padding:9px;cursor:pointer;">
          ⬛ Field Goal
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(fourthDownModal);
}

// ── Game Mode Toggle ─────────────────────────────────────────────────

function toggleGameMode() {
  gameState.active = !gameState.active;
  const btn        = document.getElementById('gameModeBtn');
  const scoreboard = document.getElementById('gameScoreboard');
  const callPlayBtn = document.getElementById('callPlayBtn');

  if (gameState.active) {
    // Vorherigen Toggle-State sichern bevor wir ihn überschreiben
    gameState._savedQbNeverThrow        = qbNeverThrow;
    gameState._savedIllegalFormationOn  = illegalFormationRulesOn;

    // Neues Spiel initialisieren
    gameState.down       = 1;
    gameState.distance   = 10;
    gameState.yardLine   = 25;
    gameState.quarter    = 1;
    gameState.score      = { home: 0, away: 0 };
    gameState.clock      = 900;
    gameState.possession = 'home';

    // QB throws ON erzwingen (qbNeverThrow = false bedeutet "throws ON")
    if (qbNeverThrow) toggleQBNeverThrow();
    // Illegal Formation Rules ON erzwingen
    if (!illegalFormationRulesOn) toggleIllegalFormationRules();

    btn.textContent = '✕ EXIT GAME';
    btn.style.cssText += ';color:#ff5e1a;border-color:rgba(255,94,26,0.5);';
    if (scoreboard)   scoreboard.style.display = 'flex';
    if (callPlayBtn)  callPlayBtn.style.display = '';
    updateScoreboard();
    if (typeof draw === 'function') draw();
    showToast('🏈 Game Mode — 1st & 10, Own 25. Call your first play!', 'info');
  } else {
    // Vorherigen State wiederherstellen
    if (qbNeverThrow !== gameState._savedQbNeverThrow) toggleQBNeverThrow();
    if (illegalFormationRulesOn !== gameState._savedIllegalFormationOn) toggleIllegalFormationRules();

    btn.textContent = '🏈 GAME';
    btn.style.color = '';
    btn.style.borderColor = '';
    if (scoreboard)   scoreboard.style.display = 'none';
    if (callPlayBtn)  callPlayBtn.style.display = 'none';
    if (typeof draw === 'function') draw();
  }
}

// ── Scoreboard Update ────────────────────────────────────────────────

function _ordinal(n) {
  return ['', '1st', '2nd', '3rd', '4th'][n] || (n + 'th');
}

function _fieldPosStr(yardLine) {
  if (yardLine === 50) return 'Midfield (50)';
  if (yardLine > 50)   return `Opp ${100 - yardLine}`;
  return `Own ${yardLine}`;
}

function _clockStr(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateScoreboard() {
  const gs = gameState;
  const el = id => document.getElementById(id);

  const dd = el('sbDownDist');
  const fp = el('sbFieldPos');
  const sh = el('sbScoreHome');
  const sa = el('sbScoreAway');
  const q  = el('sbQuarter');
  const cl = el('sbClock');

  if (dd) dd.textContent = `${_ordinal(gs.down)} & ${gs.distance}`;
  if (fp) fp.textContent = _fieldPosStr(gs.yardLine);
  if (sh) sh.textContent = gs.score.home;
  if (sa) sa.textContent = gs.score.away;
  if (q)  q.textContent  = gs.quarter;
  if (cl) cl.textContent = _clockStr(gs.clock);
}

// ── Call Play Modal ──────────────────────────────────────────────────

function openCallPlayModal() {
  if (mode === 'sim') { showToast('⚠ Erst Sim stoppen', 'error'); return; }
  const modal = document.getElementById('callPlayModal');
  const sitEl = document.getElementById('cpSituation');
  if (sitEl) {
    sitEl.textContent = `${_ordinal(gameState.down)} & ${gameState.distance} — ${_fieldPosStr(gameState.yardLine)}`;
  }
  _renderPlaybookModal();
  if (modal) modal.style.display = 'flex';
}

function closeCallPlayModal() {
  const modal = document.getElementById('callPlayModal');
  if (modal) modal.style.display = 'none';
}

function _renderPlaybookModal() {
  const list = document.getElementById('callPlayList');
  if (!list) return;
  const playbook = getPlaybook();

  if (playbook.length === 0) {
    list.innerHTML = `
      <div style="color:rgba(240,240,242,0.3);font-size:12px;padding:20px;text-align:center;line-height:1.7">
        No plays saved.<br>
        Draw a play in the editor, name it, then click<br>
        <b style="color:rgba(240,240,242,0.55)">📋 PLAYBOOK</b> to save it here.
      </div>`;
    return;
  }

  list.innerHTML = '';
  playbook.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.style.cssText = 'position:relative;display:flex;align-items:center;gap:0;';

    const btn = document.createElement('button');
    btn.style.cssText = [
      'flex:1',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'background:rgba(255,255,255,0.04)',
      'border:1px solid rgba(255,255,255,0.09)',
      'border-radius:4px',
      'padding:9px 40px 9px 12px',
      'color:#fff',
      'cursor:pointer',
      'text-align:left',
      "font-family:'Barlow Condensed',sans-serif",
      'font-size:14px',
      'letter-spacing:0.5px',
      'transition:background 0.13s',
    ].join(';');
    btn.onmouseover = () => { btn.style.background = 'rgba(255,94,26,0.12)'; btn.style.borderColor = 'rgba(255,94,26,0.3)'; };
    btn.onmouseout  = () => { btn.style.background = 'rgba(255,255,255,0.04)'; btn.style.borderColor = 'rgba(255,255,255,0.09)'; };

    const d = new Date(entry.timestamp);
    const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
    btn.innerHTML = `
      <span style="font-size:14px">${entry.name}</span>
      <span style="font-size:11px;color:rgba(240,240,242,0.3)">${dateStr}</span>
    `;
    btn.onclick = () => _callPlay(entry);

    const delBtn = document.createElement('button');
    delBtn.title = 'Remove from playbook';
    delBtn.textContent = '✕';
    delBtn.style.cssText = [
      'position:absolute',
      'right:6px',
      'top:50%',
      'transform:translateY(-50%)',
      'background:none',
      'border:none',
      'color:rgba(240,240,242,0.22)',
      'cursor:pointer',
      'font-size:13px',
      'padding:3px 6px',
      'line-height:1',
      'transition:color 0.13s',
    ].join(';');
    delBtn.onmouseover = () => { delBtn.style.color = '#f87171'; };
    delBtn.onmouseout  = () => { delBtn.style.color = 'rgba(240,240,242,0.22)'; };
    delBtn.onclick = (e) => { e.stopPropagation(); _removeFromPlaybook(idx); };

    row.appendChild(btn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function _removeFromPlaybook(idx) {
  const playbook = getPlaybook();
  const removed = playbook.splice(idx, 1)[0];
  try {
    localStorage.setItem(PLAYBOOK_KEY, JSON.stringify(playbook));
  } catch (e) {
    showToast('⚠ Löschen konnte nicht gespeichert werden', 'error');
    return;
  }
  if (removed) showToast(`Removed "${removed.name}" from Playbook`, 'info');
  _renderPlaybookModal();
}

function _callPlay(entry) {
  closeCallPlayModal();
  applyLoadedPlayData(entry.data);
  showToast(`▶ ${entry.name} geladen — ▶ SIMULATE drücken zum Snappen`, 'info');
}

// ── Outcome-Hook ─────────────────────────────────────────────────────
// Wir wrappen closeOutcomeOverlay ohne den Original-Code anzufassen.
// Immer wenn Game Mode aktiv → Outcome → Game State updaten.

(function _hookOutcomeClose() {
  setTimeout(function() {
    const _origClose = window.closeOutcomeOverlay;
    if (typeof _origClose !== 'function') return;

    window.closeOutcomeOverlay = function() {
      _origClose();
      if (gameState.active && typeof lastPlayOutcome !== 'undefined' && lastPlayOutcome) {
        processGameOutcome(lastPlayOutcome);
        if (typeof stopSim === 'function' && mode === 'sim') stopSim();
      }
    };
  }, 0);
})();

// ── Game Outcome Processing ──────────────────────────────────────────

function processGameOutcome(outcome) {
  if (!gameState.active) return;
  const gs     = gameState;
  const yards  = outcome.yards  ?? 0;
  const result = outcome.result ?? 'incomplete';

  // Uhrzeit pro Play (pauschal)
  gs.clock = Math.max(0, gs.clock - 35);

  // Penalty
  if (result === 'penalty') {
    const penYards = outcome.yards ?? -5;
    gs.yardLine  = Math.max(1, Math.min(99, gs.yardLine + penYards));
    gs.distance  = Math.max(1, gs.distance - penYards);
    showToast(`⚑ PENALTY — ${penYards > 0 ? '+' : ''}${penYards} yds`, 'error');
    updateScoreboard();
    return;
  }

  // Interception → Turnover
  if (result === 'interception') {
    const newYL = Math.max(10, Math.min(90, 100 - gs.yardLine));
    gs.yardLine   = newYL;
    gs.down       = 1;
    gs.distance   = 10;
    gs.possession = gs.possession === 'home' ? 'away' : 'home';
    showToast(`⚡ INTERCEPTION — Turnover! ${_fieldPosStr(gs.yardLine)}`, 'error');
    updateScoreboard();
    return;
  }

  // Touchdown (via result flag oder yardLine überläuft)
  const newYardLine = gs.yardLine + yards;
  if (result === 'touchdown' || newYardLine >= 100) {
    gs.score.home += 7;
    showToast(`🏈 TOUCHDOWN! HOME ${gs.score.home} – ${gs.score.away} AWAY`, 'success');
    _advanceQuarterIfNeeded();
    gs.yardLine  = 25;  // nächster Drive: approximierter Kickoff-Start
    gs.down      = 1;
    gs.distance  = 10;
    updateScoreboard();
    return;
  }

  // Normaler Gain/Loss
  gs.yardLine = Math.max(1, Math.min(99, newYardLine));

  if (yards >= gs.distance) {
    // First Down
    gs.down     = 1;
    gs.distance = 10;
    showToast(`↑ FIRST DOWN! ${_fieldPosStr(gs.yardLine)}`, 'success');
  } else {
    gs.down++;
    gs.distance = Math.max(1, gs.distance - yards);

    if (gs.down === 4) {
      _advanceQuarterIfNeeded();
      updateScoreboard();
      _show4thDownModal();
      return;
    }

    if (gs.down > 4) {
      // Turnover on downs
      gs.yardLine   = Math.max(10, Math.min(90, 100 - gs.yardLine));
      gs.down       = 1;
      gs.distance   = 10;
      gs.possession = gs.possession === 'home' ? 'away' : 'home';
      showToast(`📌 Turnover on Downs — ${_fieldPosStr(gs.yardLine)}`, 'error');
    }
  }

  _advanceQuarterIfNeeded();
  updateScoreboard();
}

function _advanceQuarterIfNeeded() {
  if (gameState.clock > 0) return;
  const gs = gameState;
  if (gs.quarter < 4) {
    gs.quarter++;
    gs.clock = 900;
    showToast(`Q${gs.quarter} beginnt`, 'info');
  } else {
    showToast(`🏁 GAME OVER — HOME ${gs.score.home} : ${gs.score.away} AWAY`, 'info');
  }
}

// ── 4th Down Modal ────────────────────────────────────────────────────

function _show4thDownModal() {
  const modal  = document.getElementById('fourthDownModal');
  const sitEl  = document.getElementById('fourthDownSituation');
  const fgBtn  = document.getElementById('fgBtn');
  if (!modal) return;

  if (sitEl) {
    sitEl.textContent = `4th & ${gameState.distance} — ${_fieldPosStr(gameState.yardLine)}`;
  }

  // FG realistisch ab ca. Opp 35 → yardLine >= 65
  if (fgBtn) {
    const inRange = gameState.yardLine >= 65;
    fgBtn.style.opacity = inRange ? '1' : '0.4';
    fgBtn.style.cursor  = inRange ? 'pointer' : 'not-allowed';
    fgBtn.title = inRange ? 'Field Goal attempt' : 'Out of field goal range';
  }

  modal.style.display = 'flex';
}

function fourthDownDecision(decision) {
  const modal = document.getElementById('fourthDownModal');
  if (modal) modal.style.display = 'none';
  const gs = gameState;

  if (decision === 'punt') {
    // Punt: ~42 Yards netto (vereinfacht)
    const puntNet  = 42;
    const oppYL    = Math.max(10, Math.min(95, 100 - (gs.yardLine + puntNet)));
    gs.yardLine    = oppYL;
    gs.down        = 1;
    gs.distance    = 10;
    gs.possession  = gs.possession === 'home' ? 'away' : 'home';
    showToast(`➡ PUNT — Opp ball on ${_fieldPosStr(gs.yardLine)}`, 'info');
    updateScoreboard();
    return;
  }

  if (decision === 'fg') {
    const inRange = gs.yardLine >= 65;
    if (!inRange) { showToast('⚠ Out of field goal range', 'error'); _show4thDownModal(); return; }

    // Grobe Erfolgswahrscheinlichkeit nach Distanz
    const fgDist  = (100 - gs.yardLine) + 17; // Endzone-Tiefe + Snap
    const fgProb  = Math.max(0.15, Math.min(0.97, 1.1 - fgDist / 75));
    const made    = Math.random() < fgProb;

    if (made) {
      gs.score.home += 3;
      showToast(`⬛ FIELD GOAL — GOOD! (${fgDist} yds) HOME ${gs.score.home}`, 'success');
    } else {
      showToast(`⬛ FIELD GOAL — NO GOOD! (${fgDist} yds)`, 'error');
    }

    // Gegner übernimmt auf eigener 20 (oder Spot bei verfehltem FG, vereinfacht)
    gs.yardLine   = 80; // Opp ball on their 20 approximiert
    gs.down       = 1;
    gs.distance   = 10;
    gs.possession = gs.possession === 'home' ? 'away' : 'home';
    updateScoreboard();
    return;
  }

  // decision === 'go' → Down bleibt 4, normaler Play-Ablauf
  showToast('🏈 GOING FOR IT — Snap the ball!', 'info');
}

// ── Dynamische Yard-Labels ────────────────────────────────────────────
// Wird von drawField() in 01_state.js aufgerufen wenn Game Mode aktiv.
// Gibt { i: 'label' } zurück — i = Yard-Offset von LOS (0 = LOS, 10 = 10 yds upfield, usw.)

function getFieldYardLabels() {
  if (!gameState.active) return { 0: '50', 10: '40', 20: '30', 30: '20' };

  const labels = {};
  // Alle i-Offsets von -15 bis +35 prüfen ob dort eine echte NFL 10-Yard-Linie liegt
  for (let i = -15; i <= 35; i++) {
    const absYard = gameState.yardLine + i;  // absolute Feld-Position
    if (absYard % 10 !== 0) continue;        // nur 10-Yard-Linien
    if (absYard <= 0 || absYard >= 100) continue; // Endzonen-Linien bekommen kein Nummer-Label
    const fieldNum = absYard <= 50 ? absYard : 100 - absYard; // NFL: 10→50→10
    labels[i] = String(fieldNum);
  }
  return labels;
}

// ── Game Field Overlays (First-Down-Linie, Endzone, Red Zone) ─────────
// Wird nach dem normalen draw() eingefügt via wrap.

function _drawGameOverlays() {
  if (!gameState.active) return;
  const gs  = gameState;
  const los  = LOS_Y();

  // ── Feld-Grenzen vorberechnen ─────────────────────────────────────
  const oppGoalLineYards = 100 - gs.yardLine;
  const oppGoalLineY     = los - oppGoalLineYards * YARD_PX;
  const oppBackY         = oppGoalLineY - 10 * YARD_PX;
  const ownGoalLineY     = los + gs.yardLine * YARD_PX;
  const ownBackY         = ownGoalLineY + 10 * YARD_PX;

  // ── Bereich außerhalb des Feldes abdecken ─────────────────────────
  // Alles vor der gegnerischen Back-of-Endzone und hinter der eigenen
  ctx.save();
  ctx.fillStyle = '#111318';
  if (oppBackY > 0) ctx.fillRect(0, 0, canvas.width, oppBackY);
  if (ownBackY < canvas.height) ctx.fillRect(0, ownBackY, canvas.width, canvas.height - ownBackY);
  ctx.restore();

  // ── Erste-Down-Linie (gelb, TV-Style) ──────────────────────────────
  const fdY = los - gs.distance * YARD_PX;
  if (fdY > 0 && fdY < canvas.height) {
    ctx.save();
    ctx.strokeStyle = '#f0c000';
    ctx.lineWidth   = 3;
    ctx.setLineDash([]);
    ctx.shadowColor  = 'rgba(240,192,0,0.6)';
    ctx.shadowBlur   = 6;
    ctx.beginPath();
    ctx.moveTo(0, fdY);
    ctx.lineTo(canvas.width, fdY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label: "1ST DOWN" / "2ND DOWN" etc.
    ctx.fillStyle = '#f0c000';
    ctx.font = 'bold 10px Barlow Condensed';
    ctx.textAlign = 'right';
    ctx.fillText(_ordinal(gs.down).toUpperCase() + ' DOWN', canvas.width - 6, fdY - 4);
    ctx.restore();
  }

  // ── Gegnerische Endzone: 10-Yard-Band ────────────────────────────

  // Goal Line (rot, stark)
  if (oppGoalLineY > -2 && oppGoalLineY < canvas.height + 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,60,60,0.95)';
    ctx.lineWidth   = 3;
    ctx.shadowColor = 'rgba(255,60,60,0.5)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(0, oppGoalLineY); ctx.lineTo(canvas.width, oppGoalLineY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255,80,80,0.9)';
    ctx.font = 'bold 10px Barlow Condensed';
    ctx.textAlign = 'left';
    ctx.fillText('GOAL LINE', 6, oppGoalLineY - 4);
    ctx.restore();
  }

  // Endzone-Fläche (10 yds tief, halbtransparentes Rot)
  const ezTop    = Math.max(0, oppBackY);
  const ezBottom = Math.min(canvas.height, oppGoalLineY);
  if (ezBottom > ezTop) {
    ctx.save();
    ctx.fillStyle = 'rgba(180,30,30,0.18)';
    ctx.fillRect(0, ezTop, canvas.width, ezBottom - ezTop);
    ctx.restore();
  }

  // Back-of-Endzone-Linie (Touchback-Linie)
  if (oppBackY > -2 && oppBackY < canvas.height + 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, oppBackY); ctx.lineTo(canvas.width, oppBackY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Eigene Endzone: Goal Line hinter LOS ─────────────────────────

  if (ownGoalLineY > -2 && ownGoalLineY < canvas.height + 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, ownGoalLineY); ctx.lineTo(canvas.width, ownGoalLineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 10px Barlow Condensed';
    ctx.textAlign = 'left';
    ctx.fillText('OWN GOAL LINE', 6, ownGoalLineY + 12);
    ctx.restore();
  }

  // Eigene Endzone-Fläche
  const ownEzTop    = Math.max(0, ownGoalLineY);
  const ownEzBottom = Math.min(canvas.height, ownBackY);
  if (ownEzBottom > ownEzTop) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, ownEzTop, canvas.width, ownEzBottom - ownEzTop);
    ctx.restore();
  }

  // ── Red Zone Overlay (Opp 20 = yardLine >= 80) ────────────────────
  if (gs.yardLine >= 80) {
    const alpha = 0.03 + (gs.yardLine - 80) / 20 * 0.05;
    ctx.save();
    ctx.fillStyle = `rgba(255,40,40,${alpha.toFixed(2)})`;
    const rzTop = Math.max(0, oppGoalLineY);
    ctx.fillRect(0, rzTop, canvas.width, los - rzTop);
    ctx.restore();
  }
}

// ── draw() wrappen ────────────────────────────────────────────────────
// Overlays nach jedem normalen draw()-Aufruf einhängen.

(function _wrapDraw() {
  setTimeout(function() {
    const _origDraw = window.draw;
    if (typeof _origDraw !== 'function') return;
    window.draw = function() {
      _origDraw.apply(this, arguments);
      _drawGameOverlays();
    };
  }, 0);
})();

// ── Field nach Outcome aktualisieren ─────────────────────────────────
// processGameOutcome ruft draw() am Ende auf damit das Feld sofort stimmt.

const _origProcessGameOutcome = processGameOutcome;
processGameOutcome = function(outcome) {
  _origProcessGameOutcome(outcome);
  if (typeof draw === 'function') draw();
};

// ── Init ──────────────────────────────────────────────────────────────

_injectGameUI();
