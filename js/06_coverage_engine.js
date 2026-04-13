// ===================================================================
// COVERAGE ENGINE v2
// ===================================================================

// ── Snap alignment ────────────────────────────────────────────────────
// Called once at play start — records each defender's x/y at snap time.
// The shell (one-high / two-high) is also fixed here.
function snapCoverageAlignment() {
  snapAlignment = {};
  defensePlayers.forEach(d => {
    snapAlignment[d.id] = { x: d.simX ?? d.x, y: d.simY ?? d.y };
  });
}

function resetCoverageAlignment() {
  snapAlignment = {};
}

// ── Cross-preset push guard ───────────────────────────────────────────
// Before a HOOK in a non-fullField strong preset sets a pushWeak flag,
// check that the currently active weak preset will actually react to it.
// If not, the Hook must cover RB/#3 himself instead of pushing.
// acceptedByWeakPresets: list of weakKey values that read this flag.
function weakApexWillAcceptPush(snapshot, acceptedByWeakPresets) {
  const { isFullField, weakKey } = resolveCallSheetSlots(snapshot);
  if (isFullField) return true;
  return acceptedByWeakPresets.includes(weakKey);
}

// Same guard for switchToApexWeak calls:
// If the active weak preset doesn't know this switch flag, Hook must keep RB himself.
function weakApexWillAcceptSwitch(snapshot, acceptedByWeakPresets) {
  const { isFullField, weakKey } = resolveCallSheetSlots(snapshot);
  if (isFullField) return true;
  return acceptedByWeakPresets.includes(weakKey);
}

// ── UI handler ────────────────────────────────────────────────────────
// Resolve the active strong+weak preset keys from callSheet based on formation.
// Also sets activePreset = strongKey for backward compatibility.
// Returns { strongKey, weakKey, isFullField }
function resolveCallSheetSlots(snapshot) {
  const formation = snapshot ? getFormationRead(snapshot).formation : '2x2';
  let slot;
  if (formation === 'empty')     slot = 'empty';
  else if (formation === '3x1') slot = '3x1';
  else                           slot = '2x2';

  let strongKey, weakKey;
  if (slot === 'empty') {
    strongKey = callSheet['empty-trips']    ?? 'manual';
    weakKey   = callSheet['empty-backside'] ?? 'manual';
  } else if (slot === '3x1') {
    strongKey = callSheet['3x1-strong']     ?? 'manual';
    weakKey   = callSheet['3x1-backside']   ?? 'manual';
  } else {
    strongKey = callSheet['2x2-strong']     ?? 'manual';
    weakKey   = callSheet['2x2-weak']       ?? 'manual';
  }
  const strongPreset = PRESET_REGISTRY[strongKey];
  const isFullField  = !strongPreset || strongPreset.fullField === true;
  activePreset = strongKey; // keep backward compat
  return { strongKey, weakKey, isFullField };
}

// Backward-compat shim — all internal callers now use resolveCallSheetSlots.
function resolveActivePreset(snapshot) {
  return resolveCallSheetSlots(snapshot).strongKey;
}

function onCallSheetChange(slot) {
  const sel = document.getElementById('cs-' + slot);
  if (!sel) return;
  callSheet[slot] = sel.value;

  // When Strong changes → auto-set Weak/Backside default to same preset
  if (slot === '2x2-strong') {
    const weakSel = document.getElementById('cs-2x2-weak');
    if (weakSel) { weakSel.value = sel.value; callSheet['2x2-weak'] = sel.value; }
  }
  if (slot === '3x1-strong') {
    const bsSel = document.getElementById('cs-3x1-backside');
    if (bsSel) { bsSel.value = sel.value; callSheet['3x1-backside'] = sel.value; }
  }
  if (slot === 'empty-trips') {
    const bsSel = document.getElementById('cs-empty-backside');
    if (bsSel) { bsSel.value = sel.value; callSheet['empty-backside'] = sel.value; }
  }

  // Lock Weak/Backside rows if Strong preset is fullField
  updateCallSheetLockState();

  resolveActivePreset(offenseStructureSnapshot);
  applyPresetAlignment();
  draw();
}

// Enable/disable Weak and Backside dropdowns based on fullField flag of Strong presets.
function updateCallSheetLockState() {
  const strong2x2  = PRESET_REGISTRY[callSheet['2x2-strong']];
  const strong3x1  = PRESET_REGISTRY[callSheet['3x1-strong']];
  const strongEmp  = PRESET_REGISTRY[callSheet['empty-trips']];
  const ff2x2 = strong2x2?.fullField === true;
  const ff3x1 = strong3x1?.fullField === true;
  const ffEmp = strongEmp?.fullField === true;

  const weakRow   = document.getElementById('cs-2x2-weak-row');
  const bsRow     = document.getElementById('cs-3x1-backside-row');
  const empBsRow  = document.getElementById('cs-empty-backside-row');
  const hint2x2   = document.getElementById('cs-2x2-fullfield-hint');
  const hint3x1   = document.getElementById('cs-3x1-fullfield-hint');
  const hintEmp   = document.getElementById('cs-empty-fullfield-hint');
  const weakSel   = document.getElementById('cs-2x2-weak');
  const bsSel     = document.getElementById('cs-3x1-backside');
  const empBsSel  = document.getElementById('cs-empty-backside');

  if (weakRow)   weakRow.style.opacity   = ff2x2 ? '0.35' : '1';
  if (bsRow)     bsRow.style.opacity     = ff3x1 ? '0.35' : '1';
  if (empBsRow)  empBsRow.style.opacity  = ffEmp ? '0.35' : '1';
  if (weakSel)   weakSel.disabled        = ff2x2;
  if (bsSel)     bsSel.disabled          = ff3x1;
  if (empBsSel)  empBsSel.disabled       = ffEmp;
  if (hint2x2)   hint2x2.style.display   = ff2x2 ? 'block' : 'none';
  if (hint3x1)   hint3x1.style.display   = ff3x1 ? 'block' : 'none';
  if (hintEmp)   hintEmp.style.display   = ffEmp ? 'block' : 'none';
}

// Legacy stub — kept in case any other code references it
function onCoveragePresetChange() {
  resolveActivePreset(offenseStructureSnapshot);
  applyPresetAlignment();
  draw();
}

// Clear all manual alignment overrides and re-apply preset alignment.
function resetAlignmentToPreset() {
  defensePlayers.forEach(d => { d._manualAlignment = false; });
  applyPresetAlignment();
  draw();
  showToast('↺ Alignment reset to preset', 'info');
}
// Respects _manualAlignment flag — manually overridden defenders are skipped.
function applyPresetAlignment() {
  const preset = activePreset !== 'manual' ? PRESET_REGISTRY[activePreset] : null;
  const alignDef = preset ? (preset.alignment || {}) : {};

  // Build coverage role map based on current field state
  const ballX = ball.x;
  const losY  = LOS_Y();
  const isOneHigh = preset ? !!preset.isOneHigh : false;
  const roleMap = classifyAllRoles(defensePlayers, ballX, losY, isOneHigh, offenseStructureSnapshot?.coverageStrongSide);

  defensePlayers.forEach(d => {
    if (d._manualAlignment) return; // user override — skip
    const covRole = roleMap.get(d.id) || '';
    const aln = alignDef[covRole];
    if (aln) {
      if (aln.cbSpacing !== undefined) d.cbSpacing = aln.cbSpacing;
      if (aln.cbShade   !== undefined) d.cbShade   = aln.cbShade;
    } else {
      // No alignment rule for this role — reset to formation defaults
      d.cbSpacing = 'normal';
      d.cbShade   = 'normal';
    }
  });

  // Reposition CBs on the field immediately
  if (players.length > 0) alignDBsToWideouts();
}

function togglePause() {
  if (mode !== 'sim') return;
  simPaused = !simPaused;
  const btn = document.getElementById('pauseBtn');
  if (simPaused) {
    btn.textContent = '▶ RESUME';
    if (animId) cancelAnimationFrame(animId);
    animId = null; lastTime = null;
  } else {
    btn.textContent = '⏸ PAUSE';
    animId = requestAnimationFrame(animateSim);
  }
}
function resetSwitchState() {
  defensePlayers.forEach(d => {
    d._passoffTime      = null;
    d._covLock          = null;   // locked target id (man) or null
    d._covCall          = null;   // current inter-defender call
  });
}

// ───────────────────────────────────────────────────────────────────────
// FORMATION & RECEIVER CLASSIFICATION
// ───────────────────────────────────────────────────────────────────────

// Returns { countStrong, countWeak, formation }
// formation: '2x2' | '3x1' | 'empty' | '2x1' | '1x1'
function getFormationRead(snapshot) {
  if (!snapshot) return { countStrong: 0, countWeak: 0, formation: '2x2' };
  const eligible = snapshot.eligiblePlayers || [];
  const ballX    = snapshot.ballX;
  const left  = eligible.filter(p => p._side === 'L').length;
  const right = eligible.filter(p => p._side === 'R').length;
  const strong = Math.max(left, right);
  const weak   = Math.min(left, right);
  let formation = '2x2';
  if (strong + weak === 0) formation = '2x2';
  else if (snapshot.isEmpty && strong + weak >= 5) formation = 'empty';
  else if (strong >= 4)    formation = 'empty';
  else if (strong === 3)   formation = '3x1';
  else if (strong === 2 && weak === 2) formation = '2x2';
  else if (strong === 2 && weak <= 1)  formation = '2x1';
  else formation = '1x1';
  return { countStrong: strong, countWeak: weak, formation };
}

// ───────────────────────────────────────────────────────────────────────
// ROUTE CLASSIFICATION
// ───────────────────────────────────────────────────────────────────────
// Uses liveReadStateById to classify each receiver's current route type.
// Returns: 'vertical' | 'corner' | 'post' | 'dig' | 'out' | 'under' | 'hitch' | 'unknown'

function classifyRoute(playerId, liveReadStateById) {
  const lr = liveReadStateById[playerId];
  if (!lr) return 'unknown';
  const mt = lr.moveType || '';
  if (mt === 'vertical' || lr.isVerticalThreatNow)                       return 'vertical';
  if (mt === 'corner')                                                     return 'corner';
  if (mt === 'post')                                                       return 'post';
  if (mt === 'dig'  || mt === 'cross')                                    return 'dig';
  if (mt === 'out'  || mt === 'flat')                                     return 'out';
  if (mt === 'under'|| mt === 'drag')                                      return 'under';
  if (mt === 'hitch'|| mt === 'stop')                                     return 'hitch';
  // Early hitch detection: receiver broke and is now coming back toward LOS
  if (lr.breakNow && lr.depthYards >= 3 && lr.depthYards <= 8
      && (mt === 'backwards' || mt === 'stopped'))                        return 'hitch';
  return 'unknown';
}

// Vertical threat speed: score 1.0 for these, lower for others
const ROUTE_VERTICAL_SCORE = {
  vertical: 1.0,
  corner:   0.9,
  post:     0.9,
  dig:      0.7,
  out:      0.6,
  hitch:    0.3,
  under:    0.4,
  unknown:  0.5,
};

// ───────────────────────────────────────────────────────────────────────
// REACHABILITY
// ───────────────────────────────────────────────────────────────────────
const REACTION_BUFFER_S  = 0.25;
const DEFENDER_SPEED_YDS = 5.0;   // yards/sec average

function defenderCanReach(defender, receiver, liveReadStateById) {
  const dx = (receiver.simX ?? receiver.x) - (defender.simX ?? defender.x);
  const dy = (receiver.simY ?? receiver.y) - (defender.simY ?? defender.y);
  const distYds = Math.hypot(dx, dy) / YARD_PX;
  const tReach  = distYds / DEFENDER_SPEED_YDS;
  const lr = liveReadStateById[receiver.id];
  const tBreak = lr ? (lr.timeToBreak ?? 1.0) : 1.0;
  return tReach <= tBreak + REACTION_BUFFER_S;
}

// ───────────────────────────────────────────────────────────────────────
// THREAT SCORE
// ───────────────────────────────────────────────────────────────────────
// Wz=0.4, Wv=0.3, Wr=0.2, Wl=0.1
const W_ZONE      = 0.4;
const W_VERTICAL  = 0.3;
const W_REACH     = 0.2;
const W_LEVERAGE  = 0.1;

function computeZoneThreat(defender, receiver, snapshot) {
  // 1 if receiver's current path intersects the defender's landmark zone
  const lm = defender.decision && defender.decision.focusLandmarkId;
  if (!lm) return 0;
  const lmPos = getLandmarkPos(lm);
  const rx = receiver.simX ?? receiver.x;
  const ry = receiver.simY ?? receiver.y;
  const dist = Math.hypot(rx - lmPos.x, ry - lmPos.y) / YARD_PX;
  return dist <= 8 ? 1 : 0;
}

function computeLeverageThreat(defender, receiver) {
  // Leverage: receiver is on the same side as defender and closer to the boundary
  const dx = (receiver.simX ?? receiver.x) - (defender.simX ?? defender.x);
  const dy = (receiver.simY ?? receiver.y) - (defender.simY ?? defender.y);
  const dist = Math.hypot(dx, dy) / YARD_PX;
  return 1 / (1 + dist);
}

function threatScore(defender, receiver, routeType, liveReadStateById, snapshot) {
  const zoneThreat     = computeZoneThreat(defender, receiver, snapshot);
  const verticalThreat = ROUTE_VERTICAL_SCORE[routeType] ?? 0.5;
  const reachScore     = defenderCanReach(defender, receiver, liveReadStateById) ? 1 : 0;
  const leverageScore  = computeLeverageThreat(defender, receiver);
  return W_ZONE * zoneThreat
       + W_VERTICAL * verticalThreat
       + W_REACH * reachScore
       + W_LEVERAGE * leverageScore;
}

const THREAT_MATCH_THRESHOLD = 0.65;

// ───────────────────────────────────────────────────────────────────────
// ASSIGNMENT RESOLVER — Hungarian-style min-cost matching
// ───────────────────────────────────────────────────────────────────────
// Returns Map<defenderId, receiverId> — each defender gets at most one receiver.
// cost(d, r) = euclidean distance + zone_penalty + leverage_penalty

function resolveManAssignments(defenders, receivers) {
  if (defenders.length === 0 || receivers.length === 0) return new Map();
  const result = new Map();

  function cost(d, r) {
    const dx = (r.simX ?? r.x) - (d.simX ?? d.x);
    const dy = (r.simY ?? r.y) - (d.simY ?? d.y);
    let c = Math.hypot(dx, dy);
    // CB prefers outermost receiver (#1)
    if (d.role === 'CB' && r._receiverNumber === 1) c -= YARD_PX * 4;
    // Underneath defenders prefer slot receivers (#2/#3)
    if (d.role !== 'CB' && (r._receiverNumber === 2 || r._receiverNumber === 3)) c -= YARD_PX * 3;
    return c;
  }

  // Greedy Hungarian approximation for small N (≤ 20 defenders)
  const usedReceivers = new Set();
  const sortedDefs = [...defenders].sort((a, b) => {
    // CBs first, then by depth (shallowest first)
    const aIsCB = a.role === 'CB' ? 0 : 1;
    const bIsCB = b.role === 'CB' ? 0 : 1;
    if (aIsCB !== bIsCB) return aIsCB - bIsCB;
    return (a.simY ?? a.y) - (b.simY ?? b.y);
  });

  for (const d of sortedDefs) {
    let bestR = null, bestCost = Infinity;
    for (const r of receivers) {
      if (usedReceivers.has(r.id)) continue;
      const c = cost(d, r);
      if (c < bestCost) { bestCost = c; bestR = r; }
    }
    if (bestR) {
      result.set(d.id, bestR.id);
      usedReceivers.add(bestR.id);
    }
  }
  return result;
}

// ───────────────────────────────────────────────────────────────────────
// ROLE CLASSIFICATION (single source of truth)
// ───────────────────────────────────────────────────────────────────────
// Returns Map<defenderId, role>
// Roles: 'RUSH' | 'CB' | 'SAF_W' | 'SAF_S' | 'APEX-L' | 'APEX-R' |
//        'HOOK-L' | 'HOOK-R' | 'HOOK-M' | 'UNDER'

const CB_DEPTH_LIMIT_YD = 10;
const PRESET_CORNER_WIDTH_YD = 8;
const PRESET_SAFETY_DEPTH_YD = 10;

function classifyAllRoles(defenders, ballX, losY, isOneHigh, strongSide) {
  const roleMap = new Map();

  // Use current sim position (simX/simY) if available, fall back to snap position
  const px = d => d.simX ?? d.x;
  const py = d => d.simY ?? d.y;

  // 1. Rushers — DE/DT inside tackle box
  defenders.forEach(d => { if (isEligibleRusher(d, ballX, losY)) roleMap.set(d.id, 'RUSH'); });
  const nonRushers = defenders.filter(d => !roleMap.has(d.id));

  // 2. CBs — widest per side, within 10 yds of LOS
  const cbLeft  = nonRushers.filter(d => px(d) <= ballX && (losY - py(d)) / YARD_PX <= CB_DEPTH_LIMIT_YD)
                             .sort((a, b) => px(a) - px(b))[0];
  const cbRight = nonRushers.filter(d => px(d) >  ballX && (losY - py(d)) / YARD_PX <= CB_DEPTH_LIMIT_YD)
                             .sort((a, b) => px(b) - px(a))[0];
  if (cbLeft)  roleMap.set(cbLeft.id,  'CB');
  if (cbRight) roleMap.set(cbRight.id, 'CB');

  // 3. FS and SS — two deepest non-rusher non-CB non-LB, then assign by strong side
  const _strongSide = strongSide || 'R';
  const LB_ROLE_SET = new Set(['LB','SAM','MIKE','WILL','LOLB','ROLB','LILB','RILB','NICKEL']);

  const remaining = nonRushers.filter(d => !roleMap.has(d.id) && !LB_ROLE_SET.has(d.role));
  const depthPool = remaining
    .map(d => ({ d, depthYd: (losY - py(d)) / YARD_PX }))
    .sort((a, b) => b.depthYd - a.depthYd);
  const fsCandidate = depthPool[0] ?? null;
  const ssCandidate = depthPool[1] ?? null;

  if (fsCandidate && ssCandidate && !isOneHigh) {
    // Sort by side: weak → FS, strong → SS
    const safeties = [fsCandidate.d, ssCandidate.d].sort((a, b) =>
      _strongSide === 'R' ? px(a) - px(b) : px(b) - px(a)
    );
    roleMap.set(safeties[0].id, 'SAF_W');
    roleMap.set(safeties[1].id, 'SAF_S');
  } else if (fsCandidate) {
    roleMap.set(fsCandidate.d.id, 'SAF_W');
  }

  // 4. Apex / Hook slots
  const underneath = nonRushers.filter(d => !roleMap.has(d.id));
  const leftSide  = underneath.filter(d => px(d) <= ballX).sort((a, b) => px(a) - px(b));
  const rightSide = underneath.filter(d => px(d) >  ballX).sort((a, b) => px(b) - px(a));
  let li = 0, ri = 0;

  if (isOneHigh) {
    const slots = [
      { side: 'R', role: 'APEX-R' }, { side: 'L', role: 'APEX-L' },
      { side: 'R', role: 'HOOK-R' }, { side: 'L', role: 'HOOK-L' },
    ];
    for (const slot of slots) {
      const p = slot.side === 'R' ? rightSide[ri++] : leftSide[li++];
      if (p) roleMap.set(p.id, slot.role);
    }
    const stillUnder = underneath.filter(d => !roleMap.has(d.id));
    if (![...roleMap.values()].includes('HOOK-L') && stillUnder.length > 0)
      roleMap.set(stillUnder[0].id, 'HOOK-L');
    else if (![...roleMap.values()].includes('HOOK-R') && stillUnder.length > 0)
      roleMap.set(stillUnder[0].id, 'HOOK-R');
  } else {
    // 2-high: sort ALL underneath by X, assign leftmost=APEX-L, rightmost=APEX-R, middle=HOOK-M
    const sorted = underneath.slice().sort((a, b) => px(a) - px(b));
    if (sorted.length >= 1) roleMap.set(sorted[0].id, 'APEX-L');
    if (sorted.length >= 2) roleMap.set(sorted[sorted.length - 1].id, 'APEX-R');
    if (sorted.length >= 3) {
      const remaining2 = sorted.slice(1, sorted.length - 1);
      const mid = remaining2.reduce((best, d) =>
        Math.abs(px(d) - ballX) < Math.abs(px(best) - ballX) ? d : best
      , remaining2[0]);
      if (mid) roleMap.set(mid.id, 'HOOK-M');
    }
  }

  // 5. Anything unassigned → RUSH
  defenders.forEach(d => { if (!roleMap.has(d.id)) roleMap.set(d.id, 'RUSH'); });

  // 6. Post-process: guarantee SS is on strong side, FS on weak side.
  //    classifyAllRoles sorts by depth first then by X, but if the user manually
  //    placed safeties in swapped positions this ensures coverage role matches
  //    snap position, not player label.
  if (!isOneHigh) {
    let ssId = null, fsId = null;
    roleMap.forEach((role, id) => {
      if (role === 'SAF_S') ssId = id;
      if (role === 'SAF_W') fsId = id;
    });
    if (ssId && fsId) {
      const ssDef = defenders.find(d => d.id === ssId);
      const fsDef = defenders.find(d => d.id === fsId);
      if (ssDef && fsDef) {
        const ssSide = px(ssDef) <= ballX ? 'L' : 'R';
        const fsSide = px(fsDef) <= ballX ? 'L' : 'R';
        // Only swap if SS is on weak side AND FS is on strong side
        if (ssSide !== _strongSide && fsSide === _strongSide) {
          roleMap.set(ssId, 'SAF_W');
          roleMap.set(fsId, 'SAF_S');
        }
      }
    }
  }

  return roleMap;
}

// Legacy single-player shortcut (kept for draw code)
function classifyDefenderRole(d, ballX, losY) {
  const depthYd = (losY - d.y) / YARD_PX;
  const widthYd = Math.abs(d.x - ballX) / YARD_PX;
  if (widthYd >= PRESET_CORNER_WIDTH_YD && depthYd <= CB_DEPTH_LIMIT_YD) return 'CB';
  if (depthYd >= PRESET_SAFETY_DEPTH_YD) return 'safety';
  return 'underneath';
}

// Rusher eligibility: DE/DT inside tackle box, max 10 yds behind LOS
const RUSH_ELIGIBLE_ROLES = new Set(['DE', 'DT']);
function isEligibleRusher(d, ballX, losY) {
  if (!RUSH_ELIGIBLE_ROLES.has(d.role.toUpperCase())) return false;
  const tb = getDefenseTackleBox(ballX, losY);
  if (d.x < tb.boxLeft || d.x > tb.boxRight) return false;
  if (d.y > tb.maxDepthY) return false;
  return true;
}

// ── Helper: role hint for a single defender (used in draw) ────────────
function getDefenderRoleHint(d) {
  const losY    = LOS_Y();
  const depthYd = (losY - d.y) / YARD_PX;
  const widthYd = Math.abs(d.x - ball.x) / YARD_PX;
  if (widthYd >= PRESET_CORNER_WIDTH_YD) return 'CB';
  if (depthYd >= PRESET_SAFETY_DEPTH_YD) return 'safety';
  return 'underneath';
}

// ── Helper: vertical threat side ─────────────────────────────────────
function findVerticalThreatSide() {
  if (!offenseStructureSnapshot) return null;
  let leftVert = false, rightVert = false;
  (offenseStructureSnapshot.eligiblePlayers || []).forEach(p => {
    const lr = liveReadStateById[p.id];
    if (lr && lr.isVerticalThreatNow) {
      if (p._side === 'L') leftVert = true;
      else rightVert = true;
    }
  });
  if (leftVert && !rightVert) return 'L';
  if (rightVert && !leftVert) return 'R';
  if (leftVert && rightVert)  return 'both';
  return null;
}

// ───────────────────────────────────────────────────────────────────────
// DECISION PRIMITIVES
// ───────────────────────────────────────────────────────────────────────
function zoneDrop(lm) {
  return { mode: 'drop',  focusTargetId: null, focusLandmarkId: lm, trailPx: 0 };
}

// ── Global isFlat helper ──────────────────────────────────────────────────
// Returns true if receiver p is on a flat route or positioned in the flat zone.
// checkSide: 'L' or 'R' — if provided, only considers receivers on that side.
// Flat zone: from sideline to midpoint between numbers and hashes (11.11yd from center),
// from 3 yards behind LOS to 5 yards beyond LOS. Anyone physically in this box is flat — no route checks.
function isFlatRoute(p, checkSide, lrState, snapshot) {
  if (!p) return false;
  const curX = p.simX ?? p.x;
  const curY = p.simY ?? p.y;
  const bx   = snapshot ? snapshot.ballX : (ball ? ball.x : curX);
  const losY = LOS_Y ? LOS_Y() : (snapshot ? snapshot.losY : curY);

  // Only within flat zone depth: 3 yards behind LOS to 5 yards beyond LOS
  if (curY > losY + YARD_PX * 3) return false;
  if (curY < losY - YARD_PX * 5) return false;

  // Flat zone X boundary: sideline to 11.11 yards from center (= curl_flat landmark X)
  const curlFlatLX = bx - YARD_PX * 11.11;
  const curlFlatRX = bx + YARD_PX * 11.11;
  const onLeft  = curX <= curlFlatLX;
  const onRight = curX >= curlFlatRX;

  if (!onLeft && !onRight) return false; // inside the curl-flat boundary → not flat

  // checkSide filter
  if (checkSide === 'L' && !onLeft)  return false;
  if (checkSide === 'R' && !onRight) return false;

  return true;
}

// ── Global coverage helper functions ─────────────────────────────────────
// All take (p, lrState) — use local aliases: const isUnder = p => isUnderRoute(p, lrState);
// When receiver is stopped/backwards, helpers fall back to lastActive* fields
// so route classification remains sticky until the receiver moves again.
function isUnderRoute(p, lrState) {
  const r = lrState?.[p?.id]; if (!r) return false;
  const isStopped = r.moveType === 'stopped' || r.moveType === 'backwards';
  // While isHitch is active (first 1s of stop), under yields to hitch
  if (isStopped && isHitchRoute(p, lrState)) return false;
  const vel   = isStopped ? r.lastActiveVel         : r.vel;
  const angle = isStopped ? r.lastActiveDirAngleDeg : r.dirAngleDeg;
  const mt    = isStopped ? r.lastActiveMoveType     : r.moveType;
  const isMovingInside = r.startSide === 'L' ? (vel?.x ?? 0) > 0 : (vel?.x ?? 0) < 0;
  const hasAngle = angle >= 25;
  const isOut = mt === 'outside';
  return isMovingInside && hasAngle && r.depthYards <= 7 && !isOut;
}
function isHitchRoute(p, lrState) {
  const r = lrState?.[p?.id]; if (!r) return false;
  if (r.depthYards > 7 || r.t < 0.5) return false;
  const isStopped = r.moveType === 'stopped' || r.dirAngleDeg >= 140;
  if (!isStopped) return false;
  // 1s stop-time limit: hitch only fires within 1s of stopping
  const stopDuration = r.t - r.lastDecisionChangeAt;
  return stopDuration <= 1.0;
}
function isVerticalRoute(p, lrState) {
  const r = lrState?.[p?.id]; if (!r) return false;
  if (r.moveType === 'vertical' || r.isVerticalThreatNow) return true;
  if (r.moveType === 'stopped' || r.moveType === 'backwards') return r.lastActiveMoveType === 'vertical';
  return false;
}
function isDeepVertical(p, lrState, minDepth) {
  const r = lrState?.[p?.id]; if (!r) return false;
  const isVert = (r.moveType === 'vertical' || r.isVerticalThreatNow)
              || ((r.moveType === 'stopped' || r.moveType === 'backwards') && r.lastActiveMoveType === 'vertical');
  return isVert && r.depthYards >= (minDepth ?? 9);
}
function isStoppedRoute(p, lrState)   { const r = lrState?.[p?.id]; if (!r) return true;  return r.moveType === 'stopped' || r.moveType === 'backwards'; }
function isVertInsideRoute(p, lrState) {
  const r = lrState?.[p?.id]; if (!r) return false;
  if (r.isVerticalThreatNow && (r.moveType === 'inside' || r.moveType === 'vertical')) return true;
  if (r.moveType === 'stopped' || r.moveType === 'backwards') {
    return r.lastActiveMoveType === 'inside' || r.lastActiveMoveType === 'vertical';
  }
  return false;
}
function isOutRoute(p, lrState) {
  const r = lrState?.[p?.id]; if (!r) return false;
  const isStopped = r.moveType === 'stopped' || r.moveType === 'backwards';
  // While isHitch is active (first 1s of stop), out yields to hitch
  if (isStopped && isHitchRoute(p, lrState)) return false;
  const vel   = isStopped ? r.lastActiveVel         : r.vel;
  const angle = isStopped ? r.lastActiveDirAngleDeg : r.dirAngleDeg;
  const mt    = isStopped ? r.lastActiveMoveType     : r.moveType;
  const isMovingOutside = r.startSide === 'L' ? (vel?.x ?? 0) < 0 : (vel?.x ?? 0) > 0;
  const hasAngle = angle >= 25;
  return r.depthYards <= 6 && isMovingOutside && hasAngle && mt !== 'inside' && mt !== 'under';
}
function isReleasedRoute(p, lrState)  { const r = lrState?.[p?.id]; if (!r) return false; return r.moveType !== 'stopped'; }
function canReachRoute(def, rec, lrState) { return rec ? defenderCanReach(def, rec, lrState) : false; }

// Flat receiver search: prioritise receiver nearest to the sideline (outermost).
// lrState and snapshot kept as params for API compatibility but not used in new flat definition.
function findFlatRouteRec(arr, checkSide, lrState, snapshot) {
  const bx = snapshot ? snapshot.ballX : ball.x;
  const flatRecs = arr.filter(p => isFlatRoute(p, checkSide, lrState, snapshot));
  if (flatRecs.length === 0) return null;
  // Nearest to sideline: left side → smallest x wins; right side → largest x wins
  if (checkSide === 'L') return flatRecs.reduce((a, b) => (a.simX ?? a.x) <= (b.simX ?? b.x) ? a : b);
  if (checkSide === 'R') return flatRecs.reduce((a, b) => (a.simX ?? a.x) >= (b.simX ?? b.x) ? a : b);
  // No checkSide: split by ball center, apply rule per side, return closest to nearest sideline
  const left  = flatRecs.filter(p => (p.simX ?? p.x) <= bx);
  const right = flatRecs.filter(p => (p.simX ?? p.x) >  bx);
  const bestL = left.length  ? left.reduce((a, b)  => (a.simX ?? a.x) <= (b.simX ?? b.x) ? a : b) : null;
  const bestR = right.length ? right.reduce((a, b) => (a.simX ?? a.x) >= (b.simX ?? b.x) ? a : b) : null;
  if (bestL && bestR) return flatRecs[0]; // both sides — return first found
  return bestL || bestR;
}

// Returns the single flat receiver for a given side — nearest to the outer corner of the flat zone.
// Corner point: (FIELD_LEFT, losY - 8yd) for L, (FIELD_RIGHT, losY - 8yd) for R.
function getFlatReceiver(side, allRec, snapshot, lrState) {
  const losY = snapshot?.losY ?? LOS_Y();
  const cornerX = side === 'L' ? FIELD_LEFT : FIELD_RIGHT;
  const cornerY = losY - YARD_PX * 5;
  const inFlat = allRec.filter(p => isFlatRoute(p, side, lrState, snapshot));
  if (inFlat.length === 0) return null;
  return inFlat.reduce((best, p) => {
    const distBest = Math.hypot((best.simX ?? best.x) - cornerX, (best.simY ?? best.y) - cornerY);
    const distP    = Math.hypot((p.simX    ?? p.x)    - cornerX, (p.simY    ?? p.y)    - cornerY);
    return distP < distBest ? p : best;
  });
}

// Returns true only if p is THE flat receiver for its side (nearest to outer corner).
// Use this instead of isFlatRoute when checking if a specific receiver is "the" flat assignment.
// Reversible: swap back to isFlatRoute(p, side, lrState, snapshot) to restore old behaviour.
function isFlatReceiverFor(p, side, allRec, snapshot, lrState) {
  if (!p) return false;
  if (!isFlatRoute(p, side, lrState, snapshot)) return false;
  const winner = getFlatReceiver(side, allRec, snapshot, lrState);
  return winner?.id === p.id;
}

function manCover(targetId, trailPx) {
  return { mode: 'follow', focusTargetId: targetId, focusLandmarkId: null, trailPx: trailPx ?? YARD_PX };
}
function rushDec() {
  return { mode: 'rush', focusTargetId: null, focusLandmarkId: null, trailPx: 0 };
}
function idleDec() {
  return { mode: 'idle', focusTargetId: null, focusLandmarkId: null, trailPx: 0 };
}

// Bracket leverage constants — kept for backwards compat but bracketDec now uses manCover
const BRACKET_INSIDE  = 'inside';
const BRACKET_OUTSIDE = 'outside';
const BRACKET_OFFSET_PX = 1.2 * YARD_PX;

function bracketDec(receiverId, leverage) {
  // Bracket replaced by dual-man QB-relative system — just assign man coverage
  return manCover(receiverId, YARD_PX);
}
// Over-The-Top: safety stays 2 yards deeper than receiver (toward endzone)
function ottDec(receiverId) {
  return { mode: 'ott', focusTargetId: receiverId, focusLandmarkId: null, trailPx: 2 * YARD_PX };
}
// OTP Shallow: man coverage but never deeper than 5 yards upfield of LOS
// Used by Apex when taking RB/push route — stay at 5-yard depth minimum
function otpShallowDec(receiverId) {
  return { mode: 'otp_shallow', focusTargetId: receiverId, focusLandmarkId: null, trailPx: YARD_PX };
}

// ───────────────────────────────────────────────────────────────────────
// PRESET REGISTRY
// ───────────────────────────────────────────────────────────────────────
// Each preset defines:
//   isOneHigh  — shell type
//   decide(roles, byId, snapshot) → Map<id, decision>   initial assignment
//   react(d, role, snapshot, lrState, dt) → decision|null   per-tick update (null = no change)

