// ===================================================================
// COVERAGE TESTER — runs the current offense play against every preset
// in PRESET_REGISTRY headlessly, captures who-is-covering-whom at
// t=1.0s and t=2.0s, and shows a results table.
// ===================================================================

const COV_TEST_SAMPLE_TIMES   = [1.0, 2.0];
const COV_TEST_DT             = 0.1;       // synthetic tick size (sim seconds)
const COV_TEST_MAX_TICKS      = 80;        // safety cap per preset
const COV_TEST_RANGE_YD       = 7.0;       // "in range" threshold
const COV_TEST_NEAR_YD        = 5.0;       // green threshold
const COV_TEST_SKILL_TYPES    = ['WR','TE','RB','FB'];
// Roles we don't count as coverage (D-line — they rush, not cover)
const COV_TEST_NON_COVER_ROLES = new Set(['DE','DT','NT']);

// Sane defaults to pair with side-only presets so the OTHER side of the
// field has *some* coverage (otherwise everyone on the backside reads as
// uncovered, which would be noise, not signal).
const COV_TEST_DEFAULT_BACKSIDE = {
  '2x2':   'cover5-weak',
  '3x1':   'c2m-backside',
  'empty': 'tuff-backside',
};
const COV_TEST_DEFAULT_STRONG = {
  '2x2':   'bracket-strong',
  '3x1':   'seahawk-strong',
  'empty': 'buster-strong',
};

// ── Preset categorization ───────────────────────────────────────────
// Returns 'fullfield' | 'strong' | 'weak' | 'backside'
function _covTestCategorize(presetKey) {
  const preset = PRESET_REGISTRY[presetKey];
  if (!preset) return 'fullfield';
  if (preset.fullField === true) return 'fullfield';
  if (/-backside$/.test(presetKey)) return 'backside';
  if (/-weak$/.test(presetKey))     return 'weak';
  if (/-strong$/.test(presetKey))   return 'strong';
  return 'fullfield';
}

// ── Slot mapping per formation ──────────────────────────────────────
function _covTestSlotsFor(formation) {
  if (formation === 'empty') return { strong: 'empty-trips',  weak: 'empty-backside' };
  if (formation === '3x1')   return { strong: '3x1-strong',   weak: '3x1-backside' };
  return { strong: '2x2-strong', weak: '2x2-weak' };
}

// Read the call-sheet dropdowns for the given formation and return the
// set of preset keys that are actually selectable for either slot.
// This is the ground truth for "which presets apply to this formation".
function _covTestApplicableKeys(formation) {
  const slots = _covTestSlotsFor(formation);
  const keys = new Set();
  for (const slot of [slots.strong, slots.weak]) {
    const sel = document.getElementById('cs-' + slot);
    if (!sel) continue;
    for (const opt of sel.options) {
      if (!opt.value || opt.value === 'manual') continue;
      if (!PRESET_REGISTRY[opt.value]) continue; // skip stale options
      keys.add(opt.value);
    }
  }
  return keys;
}

// Look up the matching weak/backside (or strong) pendant for a side-only
// preset. Uses the global maps from 06_coverage_engine.js when present —
// they're the same maps the call-sheet UI uses to auto-pair, so the sim
// runs under coherent strong+weak logic.
function _covTestPairForSideOnly(presetKey, formation, scope) {
  const sMap = (typeof _STRONG_TO_WEAK     !== 'undefined') ? _STRONG_TO_WEAK     : {};
  const bMap = (typeof _STRONG_TO_BACKSIDE !== 'undefined') ? _STRONG_TO_BACKSIDE : {};
  if (scope === 'strong') {
    // 2x2 → weak partner; 3x1/empty → prefer backside, fall back to weak
    if (formation === '2x2')   return sMap[presetKey] || null;
    return bMap[presetKey] || sMap[presetKey] || null;
  }
  // weak | backside → reverse lookup
  if (scope === 'weak' || scope === 'backside') {
    for (const [s, w] of Object.entries(sMap)) if (w === presetKey) return s;
    for (const [s, w] of Object.entries(bMap)) if (w === presetKey) return s;
  }
  return null;
}

// ── Build the call sheet for a given preset under a formation ──────
function _covTestBuildCallSheet(presetKey, formation) {
  const slots = _covTestSlotsFor(formation);
  const scope = _covTestCategorize(presetKey);
  const cs = { ...callSheet };
  const pair = _covTestPairForSideOnly(presetKey, formation, scope);

  if (scope === 'fullfield') {
    cs[slots.strong] = presetKey;
    // weak slot ignored (preset.fullField overrides it)
  } else if (scope === 'strong') {
    cs[slots.strong] = presetKey;
    cs[slots.weak]   = pair || COV_TEST_DEFAULT_BACKSIDE[formation] || cs[slots.weak];
  } else { // weak | backside
    cs[slots.weak]   = presetKey;
    cs[slots.strong] = pair || COV_TEST_DEFAULT_STRONG[formation] || cs[slots.strong];
  }
  return cs;
}

// Decide which offense players a preset row is "responsible" for.
//   strong    → players on the strong side, plus RB/FB (check-release)
//   weak/back → players on the weak side,   plus RB/FB
//   fullfield → all players
function _covTestPlayerInScope(scope, playerSide, playerType, strongSide) {
  if (scope === 'fullfield') return true;
  if (playerType === 'RB' || playerType === 'FB') return true; // always shown both sides
  if (!playerSide || !strongSide) return true;
  if (scope === 'strong')                          return playerSide === strongSide;
  if (scope === 'weak' || scope === 'backside')    return playerSide !== strongSide;
  return true;
}

// ── Detect current formation BEFORE starting tests ──────────────────
function _covTestDetectFormation() {
  // rebuildOffenseStructureSnapshot is called inside draw() — force one.
  if (typeof rebuildOffenseStructureSnapshot === 'function') {
    rebuildOffenseStructureSnapshot();
  }
  const snap = offenseStructureSnapshot;
  const read = getFormationRead(snap);
  return read.formation; // '2x2' | '3x1' | 'empty' | '2x1' | '1x1'
}

// ── Capture: for each WR/TE/RB/FB, who is the nearest defender? ────
function _covTestCaptureSnapshot() {
  const out = {};
  const offSkill = players.filter(p => COV_TEST_SKILL_TYPES.includes(p.type));
  defensePlayers.forEach(()=>{}); // (keep array reference stable)

  offSkill.forEach(off => {
    const ox = off.simX ?? off.x;
    const oy = off.simY ?? off.y;

    // 1) Assigned man-follower (decision.mode === 'follow' on this player)
    let assigned = null;
    defensePlayers.forEach(d => {
      const dec = d.decision;
      if (!dec) return;
      if ((dec.mode === 'follow' || dec.mode === 'ott') && dec.focusTargetId === off.id) {
        assigned = d;
      }
    });

    // 2) Nearest coverage defender (any mode), as fallback / "de facto" cover.
    //    D-line (DE/DT/NT) is excluded — they rush, they don't cover.
    let nearest = null;
    let nearestDistPx = Infinity;
    defensePlayers.forEach(d => {
      if (COV_TEST_NON_COVER_ROLES.has(d.role)) return;
      const dx = (d.simX ?? d.x) - ox;
      const dy = (d.simY ?? d.y) - oy;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDistPx) {
        nearestDistPx = dist;
        nearest = d;
      }
    });

    const pick = assigned || nearest;
    if (!pick) {
      out[off.id] = { offLabel: off.label, defLabel: null, distYd: null, mode: null, isAssigned: false };
    } else {
      const dx = (pick.simX ?? pick.x) - ox;
      const dy = (pick.simY ?? pick.y) - oy;
      const distPx = Math.hypot(dx, dy);
      const role = pick.role || frozenRoleMap?.get(pick.id) || '';
      out[off.id] = {
        offLabel:  off.label,
        offType:   off.type,
        defLabel:  pick.label || role || `D#${pick.id}`,
        defId:     pick.id,
        defRole:   role,
        distYd:    distPx / YARD_PX,
        mode:      pick.decision?.mode || '?',
        isAssigned: !!assigned,
      };
    }
  });
  return out;
}

// ── Run sim headlessly to completion for ONE preset ─────────────────
function _covTestRunOnePreset(presetKey, formation, originalCallSheet) {
  // Apply the call sheet for this preset
  const cs = _covTestBuildCallSheet(presetKey, formation);
  Object.keys(cs).forEach(k => { callSheet[k] = cs[k]; });

  const samples = {}; // t -> snapshot
  const targets = COV_TEST_SAMPLE_TIMES.slice();
  const targetsRemaining = new Set(targets);

  let result;
  try {
    if (mode === 'sim') stopSim();
    startSim();

    let ts = 1; // synthetic ms timestamp
    // First call inside startSim was animateSim() with no ts → it just RAFed.
    // Our RAF is patched to no-op. Now drive ticks synchronously.
    let safety = 0;
    let prevPhase = simPhase;
    let prevPlayTime = -1;
    while (mode === 'sim' && targetsRemaining.size > 0 && safety < COV_TEST_MAX_TICKS) {
      ts += COV_TEST_DT * 1000;
      animateSim(ts);
      safety++;

      // After play phase begins, capture at each sample time
      if (simPhase === 'play') {
        // capture if we've just crossed a target threshold
        for (const t of targets) {
          if (!targetsRemaining.has(t)) continue;
          if (playPhaseTime >= t) {
            samples[t] = _covTestCaptureSnapshot();
            targetsRemaining.delete(t);
          }
        }
      }
      // Avoid pathological lock if phases stall
      if (simPhase === prevPhase && simPhase === 'play' && playPhaseTime === prevPlayTime) {
        // play phase frozen — bail out
        break;
      }
      prevPhase = simPhase;
      prevPlayTime = (simPhase === 'play') ? playPhaseTime : -1;
    }

    // Fill missing samples with whatever we have now (might still be in preplay)
    for (const t of targets) {
      if (!samples[t]) samples[t] = _covTestCaptureSnapshot();
    }

    result = { presetKey, formation, scope: _covTestCategorize(presetKey), samples, error: null };
  } catch (e) {
    result = { presetKey, formation, scope: _covTestCategorize(presetKey), samples: {}, error: String(e && e.message || e) };
  }

  // Always stop sim and restore
  try { if (mode === 'sim') stopSim(); } catch(_) {}
  // Restore call sheet to caller's snapshot
  Object.keys(originalCallSheet).forEach(k => { callSheet[k] = originalCallSheet[k]; });

  return result;
}

// ── Main entry ──────────────────────────────────────────────────────
let _covTestRunning = false;
function runCoverageTests() {
  if (_covTestRunning) return;
  if (mode === 'sim') { showToast?.('Sim läuft — bitte erst stoppen', 'warn'); return; }

  const formation = _covTestDetectFormation();
  if (!['2x2','3x1','empty'].includes(formation)) {
    alert(`Coverage Test braucht Formation 2x2 / 3x1 / Empty.\nAktuell: ${formation}`);
    return;
  }
  const strongSide = offenseStructureSnapshot?.coverageStrongSide || 'R';

  const skillCount = players.filter(p => COV_TEST_SKILL_TYPES.includes(p.type)).length;
  if (skillCount === 0) {
    alert('Keine WR/TE/RB/FB auf dem Feld — nichts zu testen.');
    return;
  }

  _covTestRunning = true;
  document.body.classList.add('coverage-testing');

  // Save state we'll trash during tests
  const origCallSheet  = { ...callSheet };
  const origQbNT       = qbNeverThrow;
  const origActivePre  = activePreset;

  // Save and stub heavy globals (RAF + draw + togglePause + toasts)
  const origRAF        = window.requestAnimationFrame;
  const origDraw       = window.draw;
  const origToast      = window.showOutcomeToast;
  const origPause      = window.togglePause;
  window.requestAnimationFrame = () => 0;
  window.draw          = () => {};
  window.showOutcomeToast = () => {};
  window.togglePause   = () => {};

  qbNeverThrow = true; // never throw during tests

  // Build progress overlay
  const overlay = _covTestBuildProgressOverlay();
  document.body.appendChild(overlay);

  // Only test presets that are actually selectable for this formation's
  // call-sheet slots — dropdown options are the ground truth.
  const applicable = _covTestApplicableKeys(formation);
  const presetKeys = Object.keys(PRESET_REGISTRY)
    .filter(k => applicable.has(k))
    .sort();
  const results = [];

  // Run async-ish: process N per microtask batch so the progress bar repaints.
  // Use a chained setTimeout for guaranteed DOM repaint between batches.
  const BATCH_SIZE = 6;
  let idx = 0;

  function runBatch() {
    try {
      const end = Math.min(idx + BATCH_SIZE, presetKeys.length);
      for (; idx < end; idx++) {
        const key = presetKeys[idx];
        let res;
        try {
          res = _covTestRunOnePreset(key, formation, origCallSheet);
        } catch (e) {
          console.error('[CovTest] preset failed:', key, e);
          res = { presetKey: key, formation, scope: 'unknown', samples: {}, error: 'fatal: ' + String(e && e.message || e) };
        }
        results.push(res);
      }
      _covTestUpdateProgress(overlay, idx, presetKeys.length, presetKeys[idx-1]);
      if (idx < presetKeys.length) {
        setTimeout(runBatch, 0);
      } else {
        _covTestFinish();
      }
    } catch (e) {
      // Failsafe: never leave window globals stubbed. _covTestFinish restores
      // requestAnimationFrame/draw/etc. — must run no matter what.
      console.error('[CovTest] fatal in runBatch:', e);
      try { _covTestFinish(); } catch(_) {}
    }
  }

  let _finishCalled = false;
  function _covTestFinish() {
    if (_finishCalled) return;  // idempotent — safe if outer catch also calls
    _finishCalled = true;
    // Restore globals
    window.requestAnimationFrame = origRAF;
    window.draw          = origDraw;
    window.showOutcomeToast = origToast;
    window.togglePause   = origPause;
    qbNeverThrow         = origQbNT;
    activePreset         = origActivePre;
    try { Object.keys(origCallSheet).forEach(k => { callSheet[k] = origCallSheet[k]; }); } catch(_) {}

    try { document.body.classList.remove('coverage-testing'); } catch(_) {}
    try { overlay.remove(); } catch(_) {}
    _covTestRunning = false;

    // Final redraw to reset visuals
    try { if (typeof draw === 'function') draw(); } catch(_){}

    try { _covTestShowResults(results, formation, origCallSheet, strongSide); } catch(e) {
      console.error('[CovTest] showResults failed:', e);
    }
  }

  setTimeout(runBatch, 30);
}

// ── Progress overlay ────────────────────────────────────────────────
function _covTestBuildProgressOverlay() {
  const o = document.createElement('div');
  o.id = 'covTestProgress';
  o.innerHTML = `
    <div class="cov-test-card">
      <div class="cov-test-title">Testing coverages…</div>
      <div class="cov-test-progress-bar"><div class="cov-test-progress-fill" id="covTestFill"></div></div>
      <div class="cov-test-progress-text" id="covTestText">0 / 0</div>
    </div>`;
  return o;
}
function _covTestUpdateProgress(overlay, done, total, currentKey) {
  const fill = overlay.querySelector('#covTestFill');
  const txt  = overlay.querySelector('#covTestText');
  if (fill) fill.style.width = `${(done/total*100).toFixed(1)}%`;
  if (txt)  txt.textContent  = `${done} / ${total}${currentKey ? '  —  '+currentKey : ''}`;
}

// ── Results table ───────────────────────────────────────────────────
function _covTestShowResults(results, formation, originalCallSheet, strongSide) {
  // Determine the list of offense skill players (use current state — they
  // were restored by stopSim). Order: by x-position left → right.
  const off = players
    .filter(p => COV_TEST_SKILL_TYPES.includes(p.type))
    .sort((a,b) => (a.x - b.x));

  // Mark each result as hasError if any IN-SCOPE cell > 7yd or missing
  results.forEach(r => {
    r.hasError = false;
    for (const t of COV_TEST_SAMPLE_TIMES) {
      const snap = r.samples[t] || {};
      off.forEach(p => {
        if (!_covTestPlayerInScope(r.scope, p._side, p.type, strongSide)) return;
        const cell = snap[p.id];
        if (!cell || cell.distYd == null || cell.distYd > COV_TEST_RANGE_YD) r.hasError = true;
      });
    }
  });

  // Sort: errors first, then alphabetic
  results.sort((a,b) => {
    if (a.hasError !== b.hasError) return a.hasError ? -1 : 1;
    return a.presetKey.localeCompare(b.presetKey);
  });

  const overlay = document.createElement('div');
  overlay.id = 'covTestResultsOverlay';
  overlay.innerHTML = `
    <div class="cov-test-results">
      <div class="cov-test-header">
        <div class="cov-test-h-title">Coverage Test — Formation: <b>${formation.toUpperCase()}</b> &nbsp; · &nbsp; ${results.length} Presets getestet</div>
        <div class="cov-test-h-controls">
          <label><input type="checkbox" id="covTestFilterErr"> nur Probleme</label>
          <button id="covTestCloseBtn">✕ schließen</button>
        </div>
      </div>
      <div class="cov-test-legend">
        Zellen: <b>Defender</b> (oben) · <b>MODE·Distanz</b> (unten) &nbsp; |
        <span class="cov-c-green">grün</span> &lt;${COV_TEST_NEAR_YD}yd
        &nbsp; <span class="cov-c-yellow">gelb</span> ${COV_TEST_NEAR_YD}–${COV_TEST_RANGE_YD}yd
        &nbsp; <span class="cov-c-red">rot</span> &gt;${COV_TEST_RANGE_YD}yd
        &nbsp; <span class="cov-c-none">✗</span> keiner
        &nbsp; · ★ = man-assigned, sonst nächster Coverage-Spieler (DL ausgeschlossen)
        &nbsp; · MAN/ZONE/RUSH/OTT/IDLE = aktueller Mode
        &nbsp; · <span class="cov-c-na">—</span> = nicht im Scope des Presets (Strong-Preset zeigt nur Strong-Seite + RB/FB; Weak/Backside nur Weak-Seite + RB/FB)
        &nbsp; · Click auf Preset-Namen lädt es ins Call Sheet
      </div>
      <div class="cov-test-table-wrap">
        <table class="cov-test-table" id="covTestTable">
          <thead>
            <tr>
              <th rowspan="2">Preset</th>
              <th rowspan="2">Scope</th>
              ${off.map(p => {
                const num = p._receiverNumber ? `#${p._receiverNumber}` : '';
                const side = p._side ? p._side : '';
                const tag = side && num ? `${side}${num}` : (p.type);
                return `<th colspan="2">${p.type} ${tag}<br><span class="cov-th-type">id:${p.id}</span></th>`;
              }).join('')}
            </tr>
            <tr>
              ${off.map(() => `<th class="cov-th-t">t=1s</th><th class="cov-th-t">t=2s</th>`).join('')}
            </tr>
          </thead>
          <tbody id="covTestTbody"></tbody>
        </table>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const tbody = overlay.querySelector('#covTestTbody');
  function renderRows(filterErr) {
    tbody.innerHTML = '';
    results.forEach(r => {
      if (filterErr && !r.hasError) return;
      const tr = document.createElement('tr');
      tr.className = r.hasError ? 'cov-row-err' : '';
      const cells = [];
      cells.push(`<td class="cov-preset-name" data-key="${r.presetKey}" title="Click to load">${r.presetKey}</td>`);
      cells.push(`<td class="cov-scope">${r.scope}</td>`);
      for (const p of off) {
        const inScope = _covTestPlayerInScope(r.scope, p._side, p.type, strongSide);
        for (const t of COV_TEST_SAMPLE_TIMES) {
          if (!inScope) {
            cells.push(`<td class="cov-c-na" title="nicht im Scope dieses Presets">—</td>`);
            continue;
          }
          const c = (r.samples[t] || {})[p.id];
          cells.push(_covTestCellHtml(c));
        }
      }
      tr.innerHTML = cells.join('');
      tbody.appendChild(tr);
    });
    // Click handler to load preset
    tbody.querySelectorAll('.cov-preset-name').forEach(td => {
      td.addEventListener('click', () => {
        const key = td.getAttribute('data-key');
        _covTestLoadPresetIntoCallSheet(key, formation);
      });
    });
  }
  renderRows(false);
  overlay.querySelector('#covTestFilterErr').addEventListener('change', e => {
    renderRows(e.target.checked);
  });
  overlay.querySelector('#covTestCloseBtn').addEventListener('click', () => overlay.remove());
}

// Map sim decision.mode → short tag shown in the cell.
function _covTestModeTag(mode) {
  switch (mode) {
    case 'follow': return 'MAN';
    case 'ott':    return 'OTT';
    case 'drop':   return 'ZONE';
    case 'rush':   return 'RUSH';
    case 'idle':   return 'IDLE';
    default:       return mode ? mode.toUpperCase() : '—';
  }
}
function _covTestCellHtml(c) {
  if (!c || c.distYd == null) return `<td class="cov-c-none">✗</td>`;
  let cls = 'cov-c-green';
  if (c.distYd >  COV_TEST_RANGE_YD) cls = 'cov-c-red';
  else if (c.distYd > COV_TEST_NEAR_YD) cls = 'cov-c-yellow';
  const star = c.isAssigned ? '★ ' : '';
  const dist = c.distYd.toFixed(1);
  const tag  = _covTestModeTag(c.mode);
  return `<td class="${cls}" title="${c.defRole || ''} · mode=${c.mode || ''}">${star}${c.defLabel}<br><span class="cov-mode-tag">${tag}·${dist}</span></td>`;
}

function _covTestLoadPresetIntoCallSheet(presetKey, formation) {
  const cs = _covTestBuildCallSheet(presetKey, formation);
  Object.keys(cs).forEach(k => { callSheet[k] = cs[k]; });
  // Sync dropdown UI if present
  Object.keys(cs).forEach(k => {
    const sel = document.getElementById('cs-' + k);
    if (sel && [...sel.options].some(o => o.value === cs[k])) sel.value = cs[k];
  });
  // Resolve and re-align
  if (typeof rebuildOffenseStructureSnapshot === 'function') rebuildOffenseStructureSnapshot();
  if (typeof resolveActivePreset === 'function') resolveActivePreset(offenseStructureSnapshot);
  if (typeof applyPresetAlignment === 'function') applyPresetAlignment();
  if (typeof updateCallSheetLockState === 'function') updateCallSheetLockState();
  if (typeof draw === 'function') draw();
  if (typeof showToast === 'function') showToast(`Preset geladen: ${presetKey}`, 'info');
}

// ── Inject CSS once ─────────────────────────────────────────────────
(function _covTestInjectCSS() {
  if (document.getElementById('covTestCSS')) return;
  const style = document.createElement('style');
  style.id = 'covTestCSS';
  style.textContent = `
    body.coverage-testing #modeIndicator,
    body.coverage-testing #simBtn,
    body.coverage-testing #pauseBtn,
    body.coverage-testing #simPhase,
    body.coverage-testing #debugLog { visibility: hidden !important; }

    #covTestProgress {
      position: fixed; inset: 0; z-index: 99998;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif;
    }
    .cov-test-card {
      background: #1a1a1a; color: #eee; padding: 22px 28px;
      border-radius: 8px; min-width: 380px;
      border: 1px solid #444; box-shadow: 0 10px 40px rgba(0,0,0,.5);
    }
    .cov-test-title { font-size: 15px; margin-bottom: 12px; }
    .cov-test-progress-bar {
      height: 8px; background: #333; border-radius: 4px; overflow: hidden;
    }
    .cov-test-progress-fill {
      height: 100%; background: linear-gradient(90deg,#4caf50,#8bc34a);
      width: 0%; transition: width 0.15s linear;
    }
    .cov-test-progress-text {
      margin-top: 8px; font-size: 12px; color: #aaa; font-family: ui-monospace,monospace;
    }

    #covTestResultsOverlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif;
    }
    .cov-test-results {
      background: #161616; color: #ddd;
      width: 96vw; height: 92vh;
      border-radius: 8px; border: 1px solid #444;
      display: flex; flex-direction: column;
      box-shadow: 0 10px 40px rgba(0,0,0,.6);
    }
    .cov-test-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 18px; border-bottom: 1px solid #333;
    }
    .cov-test-h-title { font-size: 15px; }
    .cov-test-h-controls { display: flex; gap: 14px; align-items: center; font-size: 13px; }
    .cov-test-h-controls button {
      background: #333; color: #eee; border: 1px solid #555;
      padding: 4px 10px; border-radius: 4px; cursor: pointer;
    }
    .cov-test-h-controls button:hover { background: #444; }
    .cov-test-legend {
      padding: 8px 18px; font-size: 11px; color: #aaa;
      border-bottom: 1px solid #333; background: #1a1a1a;
    }
    .cov-test-table-wrap {
      flex: 1; overflow: auto; padding: 0;
    }
    .cov-test-table {
      width: 100%; border-collapse: collapse;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 11px;
    }
    .cov-test-table th, .cov-test-table td {
      border: 1px solid #2a2a2a;
      padding: 4px 6px;
      text-align: center;
      white-space: nowrap;
    }
    .cov-test-table thead { position: sticky; top: 0; background: #222; z-index: 2; }
    .cov-test-table th { background: #222; font-weight: 600; }
    .cov-th-type { font-size: 9px; color: #888; font-weight: 400; }
    .cov-th-t { font-size: 10px; color: #888; font-weight: 400; }
    .cov-preset-name {
      text-align: left !important;
      color: #79c0ff; cursor: pointer;
      font-weight: 600;
    }
    .cov-preset-name:hover { background: #2a3340; text-decoration: underline; }
    .cov-scope { color: #888; font-size: 10px; }
    .cov-c-green  { background: #14361a; color: #b3f0c0; }
    .cov-c-yellow { background: #3c3415; color: #f0e3a8; }
    .cov-c-red    { background: #401b1b; color: #ff9b9b; }
    .cov-c-none   { background: #2a0e0e; color: #ff6b6b; font-weight: bold; }
    .cov-c-na     { background: #1a1a1a; color: #444; }
    .cov-mode-tag { font-size: 9px; opacity: 0.75; letter-spacing: 0.4px; }
    .cov-row-err td:first-child { box-shadow: inset 3px 0 0 #e85; }
  `;
  document.head.appendChild(style);
})();
