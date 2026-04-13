// PHASE 2 — OFFENSE STRUCTURE CLASSIFICATION
// Purely analytical. Does NOT alter any route/motion/shift/block data.
// Does NOT affect simulation.
// ─────────────────────────────────────────────

let debugOverlayOn = false;
let offenseStructureSnapshot = null;

// Toggle handler
document.getElementById('debugOverlayToggle').addEventListener('change', function() {
  debugOverlayOn = this.checked;
  document.getElementById('debugToggleWrap').classList.toggle('active', debugOverlayOn);
  updateFormationBadge();
  draw();
});

// Returns the final pre-snap position of a skill player:
// last motionPoint → last shiftPoint → player start (x,y)
// rawOnly=true: always return p.x/p.y (ignore shift/motion endpoints)
let _snapRawOverride = false; // when true, getSnapPos ignores waypoints everywhere
function getSnapPos(player, rawOnly = false) {
  // ── SIM PRE-SNAP: return NEXT waypoint target, not final endpoint ──
  // The defense can only know the next destination, not the entire path.
  if (mode === 'sim' && (simPhase === 'shift' || simPhase === 'settle' || simPhase === 'preplay')) {
    // During shift: return the next shift waypoint the player is heading toward
    if (simPhase === 'shift' && player.simShiftPoints && player.simShiftPoints.length > 0) {
      const idx = player.simWpIdx ?? 0;
      if (idx < player.simShiftPoints.length) {
        return { x: player.simShiftPoints[idx].x, y: player.simShiftPoints[idx].y };
      }
      // All shift waypoints reached → current sim position
      return { x: player.simX ?? player.x, y: player.simY ?? player.y };
    }
    // During preplay/motion: return the next motion waypoint for the motion player
    if (simPhase === 'preplay' && player.id === motionOwnerId
        && player.simMotionPoints && player.simMotionPoints.length > 0) {
      const idx = player.simWpIdx ?? 0;
      if (idx < player.simMotionPoints.length) {
        return { x: player.simMotionPoints[idx].x, y: player.simMotionPoints[idx].y };
      }
      // All motion waypoints reached → current sim position
      return { x: player.simX ?? player.x, y: player.simY ?? player.y };
    }
    // Settle phase or players without active waypoints: current sim position
    return { x: player.simX ?? player.x, y: player.simY ?? player.y };
  }

  // ── EDITOR / PLAY PHASE: original logic (final endpoint) ──
  if (!_snapRawOverride && !rawOnly && player.motionPoints && player.motionPoints.length > 0) {
    const m = player.motionPoints[player.motionPoints.length - 1];
    return { x: m.x, y: m.y };
  }
  if (!_snapRawOverride && !rawOnly && player.shiftPoints && player.shiftPoints.length > 0) {
    const s = player.shiftPoints[player.shiftPoints.length - 1];
    return { x: s.x, y: s.y };
  }
  return { x: player.x, y: player.y };
}

// Returns { boxLeftX, boxRightX } based on LT/RT snap positions.
// Falls back to Center ± 2 yards if linemen unavailable.
function getTackleBox() {
  const PADDING_PX = YARD_PX * 0.5;     // 0.5 yard tolerance
  const FALLBACK   = YARD_PX * 2;       // 2 yards fallback half-width

  const olData = olinePlayers();         // [{id, x, y, label}, ...]
  const lt = olData.find(o => o.id === 'olt');
  const rt = olData.find(o => o.id === 'ort');
  const oc = olData.find(o => o.id === 'oc');

  const ltX = lt ? lt.x : (oc ? oc.x - FALLBACK : ball.x - FALLBACK);
  const rtX = rt ? rt.x : (oc ? oc.x + FALLBACK : ball.x + FALLBACK);

  return {
    boxLeftX:  Math.min(ltX, rtX) - PADDING_PX,
    boxRightX: Math.max(ltX, rtX) + PADDING_PX,
  };
}

// Dynamically classifies a skill player based on snap position.
// Returns: 'qb' | 'backfield' | 'eligible'
// (OL is handled separately via olinePlayers / OLINE_IDS)
function classifyAlignment(player, tackleBox, losY, useRaw = false) {
  if (player.type === 'QB') return 'qb';

  const snap         = useRaw ? { x: player.x, y: player.y } : getSnapPos(player);
  const DEPTH_PX     = YARD_PX * 0.5;  // must be this far behind LOS to be backfield
  const isBehindLOS  = snap.y > losY + DEPTH_PX;   // y increases downfield (toward camera)
  const isInsideBox  = snap.x >= tackleBox.boxLeftX && snap.x <= tackleBox.boxRightX;

  return (isBehindLOS && isInsideBox) ? 'backfield' : 'eligible';
}

// Returns 'L' | 'R' based on snap x vs ball x. Ties → 'R'.
function getSide(player, ballX, useRaw = false) {
  const snap = useRaw ? { x: player.x, y: player.y } : getSnapPos(player);
  return snap.x < ballX ? 'L' : 'R';
}

// Assigns ._receiverNumber (1-based) to eligible players on each side.
// #1 = outermost (furthest from ball X), #2 = next inward, etc.
// Tie-breaker: deeper (larger Y = further from LOS) first, then lower id.
function assignReceiverNumbers(eligiblePlayers, ballX) {
  const left  = eligiblePlayers.filter(p => p._side === 'L').sort((a, b) => {
    const da = Math.abs(getSnapPos(a).x - ballX);
    const db = Math.abs(getSnapPos(b).x - ballX);
    if (Math.abs(da - db) > 0.01) return db - da; // larger dist first (outermost)
    if (Math.abs(getSnapPos(a).y - getSnapPos(b).y) > 0.01) return getSnapPos(b).y - getSnapPos(a).y;
    return a.id - b.id;
  });
  const right = eligiblePlayers.filter(p => p._side === 'R').sort((a, b) => {
    const da = Math.abs(getSnapPos(a).x - ballX);
    const db = Math.abs(getSnapPos(b).x - ballX);
    if (Math.abs(da - db) > 0.01) return db - da; // larger dist first (outermost)
    if (Math.abs(getSnapPos(a).y - getSnapPos(b).y) > 0.01) return getSnapPos(b).y - getSnapPos(a).y;
    return a.id - b.id;
  });

  left.forEach((p, i)  => { p._receiverNumber = i + 1; });
  right.forEach((p, i) => { p._receiverNumber = i + 1; });
}

// ── Bunch Detection ───────────────────────────────────────────────────────
// Bunch: ≥3 eligibles on a side, all pairwise distances ≤ BUNCH_THRESHOLD
const BUNCH_THRESHOLD_PX = YARD_PX * 2.0;   // 2.0 yards euklidisch
const STACK_H_THRESHOLD  = YARD_PX * 0.75;  // ≤0.75 yards horizontal
const STACK_V_THRESHOLD  = YARD_PX * 2.0;   // ≤2.0 yards vertikal (oder euklid ≤1.5 yd)
const STACK_EUCLID_PX    = YARD_PX * 1.5;   // 1.5 yards euklidisch (alternative)

function detectBunch(sideEligibles) {
  if (sideEligibles.length < 3) return { bunch: false, ids: [] };
  // Try every combination of 3 players
  for (let a = 0; a < sideEligibles.length - 2; a++) {
    for (let b = a + 1; b < sideEligibles.length - 1; b++) {
      for (let c = b + 1; c < sideEligibles.length; c++) {
        const pa = getSnapPos(sideEligibles[a]);
        const pb = getSnapPos(sideEligibles[b]);
        const pc = getSnapPos(sideEligibles[c]);
        const dAB = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        const dAC = Math.hypot(pa.x - pc.x, pa.y - pc.y);
        const dBC = Math.hypot(pb.x - pc.x, pb.y - pc.y);
        if (dAB <= BUNCH_THRESHOLD_PX && dAC <= BUNCH_THRESHOLD_PX && dBC <= BUNCH_THRESHOLD_PX) {
          return {
            bunch: true,
            ids: [sideEligibles[a].id, sideEligibles[b].id, sideEligibles[c].id],
            labels: [sideEligibles[a].label + '#' + sideEligibles[a].id,
                     sideEligibles[b].label + '#' + sideEligibles[b].id,
                     sideEligibles[c].label + '#' + sideEligibles[c].id],
          };
        }
      }
    }
  }
  return { bunch: false, ids: [] };
}

function detectStack(sideEligibles) {
  if (sideEligibles.length < 2) return { stack: false, ids: [] };
  for (let a = 0; a < sideEligibles.length - 1; a++) {
    for (let b = a + 1; b < sideEligibles.length; b++) {
      const pa = getSnapPos(sideEligibles[a]);
      const pb = getSnapPos(sideEligibles[b]);
      const dx = Math.abs(pa.x - pb.x);
      const dy = Math.abs(pa.y - pb.y);
      const euclid = Math.hypot(dx, dy);
      // Qualify if: (small horizontal AND moderate vertical) OR pure euclid
      const isStack = (dx <= STACK_H_THRESHOLD && dy <= STACK_V_THRESHOLD)
                   || (euclid <= STACK_EUCLID_PX);
      if (isStack) {
        return {
          stack: true,
          ids: [sideEligibles[a].id, sideEligibles[b].id],
          labels: [sideEligibles[a].label + '#' + sideEligibles[a].id,
                   sideEligibles[b].label + '#' + sideEligibles[b].id],
        };
      }
    }
  }
  return { stack: false, ids: [] };
}

// Core snapshot builder. Called every frame via draw().
// rawOnly=true: use p.x/p.y instead of shift/motion endpoints (for reactive formation editor preview)
function rebuildOffenseStructureSnapshot(rawOnly = false) {
  const losY      = LOS_Y();
  const ballX     = ball.x;
  const tackleBox = getTackleBox();

  // Classify every skill player
  const qbPlayers        = [];
  const backfieldPlayers = [];
  const eligiblePlayers  = [];

  players.forEach(p => {
    const cls  = classifyAlignment(p, tackleBox, losY, rawOnly);
    p._alignmentClass = cls;

    if (cls === 'qb') {
      p._side = getSide(p, ballX, rawOnly);
      qbPlayers.push(p);
    } else if (cls === 'backfield') {
      p._side = getSide(p, ballX, rawOnly);
      backfieldPlayers.push(p);
    } else {
      p._side = getSide(p, ballX, rawOnly);
      eligiblePlayers.push(p);
    }
    // Reset bunch/stack flags each rebuild
    p._isBunch = false;
    p._isStack = false;
  });

  // Primary backfield: furthest from ball = the one RB for release checks
  // All other backfield players are promoted to eligiblePlayers and numbered normally
  let primaryBackfield = null;
  if (backfieldPlayers.length > 0) {
    const qb = qbPlayers[0] || null;
    const qbX = qb ? (getSnapPos(qb).x) : ballX;
    const weakSideForRB = 'R'; // fallback weak side
    backfieldPlayers.sort((a, b) => {
      const aPos = getSnapPos(a), bPos = getSnapPos(b);
      // 1. Deepest from LOS (largest Y = furthest behind LOS)
      const depthDiff = bPos.y - aPos.y;
      if (Math.abs(depthDiff) > 1) return depthDiff;
      // 2. Closest to QB horizontally
      const aDist = Math.abs(aPos.x - qbX);
      const bDist = Math.abs(bPos.x - qbX);
      const distDiff = aDist - bDist;
      if (Math.abs(distDiff) > 1) return distDiff;
      // 3. Weak side wins (weak = fewer eligibles)
      const leftCount = eligiblePlayers.filter(p => p._side === 'L').length;
      const weakSide = leftCount <= eligiblePlayers.filter(p => p._side === 'R').length ? 'L' : 'R';
      const aSide = getSnapPos(a).x < ballX ? 'L' : 'R';
      const bSide = getSnapPos(b).x < ballX ? 'L' : 'R';
      if (aSide === weakSide && bSide !== weakSide) return -1;
      if (bSide === weakSide && aSide !== weakSide) return 1;
      return 0;
    });
    primaryBackfield = backfieldPlayers[0];
    // Extra backfield players → eligible
    for (let i = 1; i < backfieldPlayers.length; i++) {
      backfieldPlayers[i]._alignmentClass = 'eligible';
      eligiblePlayers.push(backfieldPlayers[i]);
    }
  }

  // Assign receiver numbers
  assignReceiverNumbers(eligiblePlayers, ballX);

  // ── Attachment Zone Classification ─────────────────────────────────────
  // Determines how far each eligible player is from the nearest OT.
  // This replaces TE/WR label logic — Defense reads POSITION, not label.
  //   ATTACHED  (≤1.5 OL gaps from OT) → Defense reads as inline TE / block threat
  //   DETACHED  (≤4.0 OL gaps from OT) → Defense reads as Slot / H-back
  //   WIDE      (>4.0 OL gaps from OT) → Defense reads as WR
  {
    const olData = olinePlayers();
    const oltX   = olData.find(o => o.id === 'olt')?.x ?? (ball.x - OLINE_SPACING * 2);
    const ortX   = olData.find(o => o.id === 'ort')?.x ?? (ball.x + OLINE_SPACING * 2);

    eligiblePlayers.forEach(p => {
      const snap         = getSnapPos(p);
      const nearTackleX  = p._side === 'L' ? oltX : ortX;
      const distPx       = Math.abs(snap.x - nearTackleX);

      if      (distPx <= OLINE_SPACING * 1.5) p._attachmentZone = 'ATTACHED';
      else if (distPx <= YARD_PX * 8)         p._attachmentZone = 'DETACHED';
      else                                    p._attachmentZone = 'WIDE';
    });
  }

  const leftEligible  = eligiblePlayers.filter(p => p._side === 'L');
  const rightEligible = eligiblePlayers.filter(p => p._side === 'R');

  // Bunch / Stack detection per side
  const leftBunch  = detectBunch(leftEligible);
  const rightBunch = detectBunch(rightEligible);
  const leftStack  = detectStack(leftEligible);
  const rightStack = detectStack(rightEligible);

  // Tag individual players for debug render
  leftBunch.ids.forEach(id  => { const p = players.find(pl=>pl.id===id); if(p) p._isBunch = true; });
  rightBunch.ids.forEach(id => { const p = players.find(pl=>pl.id===id); if(p) p._isBunch = true; });
  leftStack.ids.forEach(id  => { const p = players.find(pl=>pl.id===id); if(p) p._isStack = true; });
  rightStack.ids.forEach(id => { const p = players.find(pl=>pl.id===id); if(p) p._isStack = true; });

  // Formation string e.g. "2x2", "3x1"
  const formation = `${leftEligible.length}x${rightEligible.length}`;
  const isEmpty   = backfieldPlayers.length === 0;

  // ── Strong Side Detection ────────────────────────────────────────────
  // Priority 1: ATTACHED player (inline TE / H-back next to tackle) → defines strong side.
  // Priority 2: More eligibles on a side → strong side.
  // Priority 3: Backfield offset → strong side.
  // Priority 4: Default Right.
  const leftAttached  = leftEligible.filter(p => p._attachmentZone === 'ATTACHED');
  const rightAttached = rightEligible.filter(p => p._attachmentZone === 'ATTACHED');

  let strongSide = 'R';
  if (rightAttached.length > leftAttached.length) {
    strongSide = 'R';
  } else if (leftAttached.length > rightAttached.length) {
    strongSide = 'L';
  } else if (leftEligible.length > rightEligible.length) {
    strongSide = 'L';
  } else if (leftEligible.length === rightEligible.length) {
    if (backfieldPlayers.length > 0) {
      const lbf = backfieldPlayers.filter(p => p._side === 'L').length;
      const rbf = backfieldPlayers.filter(p => p._side === 'R').length;
      strongSide = (lbf > rbf) ? 'L' : 'R';
    }
  }

  // ── Coverage Strong Side ─────────────────────────────────────────────
  // Independent from formation strongSide.
  // Coverage rules always treat the side with MORE receivers as strong.
  // 3x1: strong = Trips side, regardless of attached players.
  // 2x2: strong = side where RB is offset to; RB directly behind QB → default Right.
  // Balanced / empty backfield → default Right.
  let coverageStrongSide = 'R';
  if (leftEligible.length !== rightEligible.length) {
    coverageStrongSide = leftEligible.length > rightEligible.length ? 'L' : 'R';
  } else {
    // Equal receivers each side — use RB offset
    if (backfieldPlayers.length > 0) {
      const lbf = backfieldPlayers.filter(p => p._side === 'L').length;
      const rbf = backfieldPlayers.filter(p => p._side === 'R').length;
      if (lbf !== rbf) coverageStrongSide = lbf > rbf ? 'L' : 'R';
      // else: RB directly behind QB → default 'R'
    }
  }

  // ── Phase 2.3: Early Read Feature Extraction ──────────────────────────
  const snapshot = {
    ballX, losY, tackleBox,
    qbPlayers, backfieldPlayers, eligiblePlayers,
    primaryBackfield,
    leftEligible, rightEligible,
    leftAttached, rightAttached,
    formation, strongSide, coverageStrongSide, isEmpty,
    leftBunch, rightBunch, leftStack, rightStack,
    isTrips: eligiblePlayers.filter(p => p._side === 'L').length >= 3
          || eligiblePlayers.filter(p => p._side === 'R').length >= 3,
  };

  eligiblePlayers.forEach(p => {
    p._earlyRead = extractEarlyReceiverRead(p, snapshot);
  });
  backfieldPlayers.forEach(p => {
    p._earlyRead = extractEarlyBackfieldRead(p, snapshot);
  });

  offenseStructureSnapshot = snapshot;
}

