// ===================================================================
// LIVE READ (Phase 3.1)
// Per-tick tracking of receiver/backfield movement during PlayPhase.
// Pure helpers + registry. No route/motion/shift/block data is read here.
// Only reads: actual sim positions (simX/simY) each tick.
// ===================================================================

// ── Live Read config constants ────────────────────────────────────────
const LR_STOP_SPEED          = 3;    // px/s below which player is "stopped"
const LR_BACKWARDS_VY        = 3;    // px/s downward (canvas +y) to qualify as backwards
const LR_VERTICAL_MIN_VY     = 8;    // px/s upfield (canvas -y) to qualify as vertical
const LR_UNDER_MAX_VY        = 8;    // px/s vertical threshold for "under/flat"
const LR_UNDER_MIN_VX        = 8;    // px/s horizontal threshold for "under/flat"
const LR_VERTICAL_MAX_DEG    = 20;   // angle deg from upfield axis → vertical
const LR_HORIZONTAL_MIN_DEG  = 65;   // angle deg → flat/under (pure under)
const LR_SHALLOW_MIN_DEG     = 35;   // angle deg → shallow (slant-like, ≤7 yds deep)
const LR_SHALLOW_MAX_DEPTH   = 7;    // yards — deeper than this → inside even if angle qualifies
const LR_BREAK_DEG           = 35;   // direction change threshold for breakNow
const LR_MIDDLE_TOL_X        = YARD_PX * 0.25; // 0.25 yd tolerance for crossedMiddle
const LR_VERTICAL_THREAT_DEPTH = YARD_PX * 15; // 15 yards upfield = deep threat

// ── Live Read state registry ──────────────────────────────────────────
// keyed by player.id; cleared on stopSim, rebuilt on initPlayPhase.
let liveReadStateById = {};
let liveReadOn = false;  // toggles Live Read debug display
let playPhaseTime = 0;   // seconds since PlayPhase started

// Toggle handler
document.getElementById('liveReadToggle').addEventListener('change', function() {
  liveReadOn = this.checked;
  document.getElementById('liveReadToggleWrap').classList.toggle('active', liveReadOn);
  draw();
});

// ── Helpers (pure, no side effects) ──────────────────────────────────

// Direction angle from upfield axis (0=vertical up, 90=flat). Uses velocity {x,y}.
function lrDirAngleDeg(vx, vy) {
  // upfield = canvas -y direction; angle from (0,-1) unit vector
  const mag = Math.hypot(vx, vy);
  if (mag < 0.01) return 90;
  const cosA = (vx * 0 + vy * (-1)) / mag; // dot with (0,-1) = -vy/mag
  return Math.acos(Math.max(-1, Math.min(1, cosA))) * (180 / Math.PI);
}

// Classify movement type from velocity, angle, side.
// side: 'L'|'R' relative to ballX.
function lrClassifyMoveType(vx, vy, speed, dirDeg, side, depthYards, breakDepthYards) {
  if (speed < LR_STOP_SPEED)                                            return 'stopped';
  if (vy > LR_BACKWARDS_VY)                                             return 'backwards';
  if (vy < -LR_VERTICAL_MIN_VY && dirDeg <= LR_VERTICAL_MAX_DEG)       return 'vertical';

  // Check direction first so flat outward routes → 'outside', flat inward → 'shallow'
  const isMovingInside = (side === 'L') ? vx > 0 : vx < 0;

  // Very flat angle (≥65° from vertical) → outside or shallow depending on direction
  if (Math.abs(vy) <= LR_UNDER_MAX_VY && Math.abs(vx) >= LR_UNDER_MIN_VX)
    return isMovingInside ? 'under' : 'outside';
  if (dirDeg >= LR_HORIZONTAL_MIN_DEG)
    return isMovingInside ? 'under' : 'outside';

  if (!isMovingInside) return 'outside';
  // Use breakDepthYards (frozen at break moment) if available, else live depthYards
  const depth = breakDepthYards ?? depthYards ?? 0;
  if (dirDeg >= LR_SHALLOW_MIN_DEG && depth <= LR_SHALLOW_MAX_DEPTH) return 'under';
  return 'inside';
}

// ── Init ──────────────────────────────────────────────────────────────
// Called at start of PlayPhase. Initialises live state for all
// eligible + backfield players from snapshot.
function initLiveReadsForPlayStart() {
  liveReadStateById = {};
  playPhaseTime = 0;

  if (!offenseStructureSnapshot) return;
  const snap = offenseStructureSnapshot;
  const relevant = [...snap.eligiblePlayers, ...snap.backfieldPlayers];

  relevant.forEach(p => {
    const cx = p.simX ?? p.x;
    const cy = p.simY ?? p.y;
    liveReadStateById[p.id] = {
      phase:              'play',
      t:                  0,
      pos:                { x: cx, y: cy },
      prevPos:            { x: cx, y: cy },
      vel:                { x: 0, y: 0 },
      speed:              0,
      dirAngleDeg:        90,
      moveType:           'stopped',
      prevMoveType:       'stopped',
      lastActiveMoveType: 'stopped',
      lastActiveVel:      { x: 0, y: 0 },
      lastActiveDirAngleDeg: 90,
      depthYards:         0,
      breakDepthYards:    null, // depthYards at moment of last break — reset on each new break
      isVerticalThreatNow: false,
      startSide:          p._side || 'R',
      crossedMiddleNow:   false,
      lastDecisionChangeAt: 0,
      prevVelDir:         { x: 0, y: -1 }, // default: upfield
      breakNow:           false,
    };
  });
  logDebug(`<span>LIVE READ INIT</span> — ${relevant.length} tracked players`);
}

// ── Per-tick update ───────────────────────────────────────────────────
// Called AFTER all player positions are updated each tick, PlayPhase only.
function updateLiveReads(dt) {
  if (simPhase !== 'play') return;
  if (!offenseStructureSnapshot)  return;

  playPhaseTime += dt * simSpeed;
  const ballX = offenseStructureSnapshot.ballX;
  const losY  = offenseStructureSnapshot.losY;

  const snap     = offenseStructureSnapshot;
  const relevant = [...snap.eligiblePlayers, ...snap.backfieldPlayers];

  relevant.forEach(p => {
    let lr = liveReadStateById[p.id];
    if (!lr) {
      // Lazy init if player wasn't in snapshot at PlayPhase start
      const cx = p.simX ?? p.x;
      const cy = p.simY ?? p.y;
      lr = liveReadStateById[p.id] = {
        phase: 'play', t: 0,
        pos: { x:cx, y:cy }, prevPos: { x:cx, y:cy },
        vel: {x:0,y:0}, speed: 0, dirAngleDeg: 90,
        moveType: 'stopped', prevMoveType: 'stopped',
        lastActiveMoveType: 'stopped',
        lastActiveVel: { x: 0, y: 0 },
        lastActiveDirAngleDeg: 90,
        depthYards: 0, isVerticalThreatNow: false,
        startSide: p._side || 'R', crossedMiddleNow: false,
        lastDecisionChangeAt: 0,
        prevVelDir: {x:0, y:-1}, breakNow: false,
      };
    }

    const cx = p.simX ?? p.x;
    const cy = p.simY ?? p.y;

    // Velocity estimate from delta pos
    const vx = dt > 0 ? (cx - lr.pos.x) / dt : 0;
    const vy = dt > 0 ? (cy - lr.pos.y) / dt : 0;
    const speed = Math.hypot(vx, vy);

    // Direction angle
    const dirDeg = lrDirAngleDeg(vx, vy);

    // Current side relative to ball
    const curSide = (cx < ballX - LR_MIDDLE_TOL_X) ? 'L'
                  : (cx > ballX + LR_MIDDLE_TOL_X) ? 'R'
                  : lr.startSide; // in tolerance band → keep

    // Depth from LOS: positive = upfield (canvas y decreases upfield)
    const depthYards = (losY - cy) / YARD_PX;

    // Classify move type (use frozen breakDepthYards from previous tick if available)
    const moveType = lrClassifyMoveType(vx, vy, speed, dirDeg, curSide, depthYards, lr.breakDepthYards);

    // Break detection: angle between previous vel direction and current
    let breakNow = false;
    if (speed >= LR_STOP_SPEED) {
      const prevMag = Math.hypot(lr.prevVelDir.x, lr.prevVelDir.y);
      if (prevMag > 0.01) {
        const dot   = (vx * lr.prevVelDir.x + vy * lr.prevVelDir.y) / (speed * prevMag);
        const delta = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        breakNow = delta >= LR_BREAK_DEG;
      }
    }

    // Crossed middle: compare current side vs start side
    const crossedMiddleNow = lr.crossedMiddleNow ||
      (curSide !== lr.startSide && Math.abs(cx - ballX) > LR_MIDDLE_TOL_X);

    const isVerticalThreatNow = (moveType === 'vertical') &&
      ((losY - cy) >= LR_VERTICAL_THREAT_DEPTH || depthYards >= 10);

    // Detect decision change (moveType changed)
    const lastDecisionChangeAt = (moveType !== lr.moveType)
      ? playPhaseTime
      : lr.lastDecisionChangeAt;

    // Update state (mutate in place)
    lr.prevPos            = { ...lr.pos };
    lr.pos                = { x: cx, y: cy };
    lr.prevMoveType       = lr.moveType;
    lr.vel                = { x: vx, y: vy };
    lr.speed              = speed;
    lr.dirAngleDeg        = Math.round(dirDeg);
    lr.moveType           = moveType;
    // Sticky last-active fields: updated only while receiver is moving
    if (moveType !== 'stopped' && moveType !== 'backwards') {
      lr.lastActiveMoveType    = moveType;
      lr.lastActiveVel         = { x: vx, y: vy };
      lr.lastActiveDirAngleDeg = Math.round(dirDeg);
    }
    lr.depthYards         = Math.round(depthYards * 10) / 10;
    lr.breakDepthYards    = breakNow ? Math.round(depthYards * 10) / 10 : lr.breakDepthYards;
    lr.isVerticalThreatNow= isVerticalThreatNow;
    lr.crossedMiddleNow   = crossedMiddleNow;
    lr.lastDecisionChangeAt = lastDecisionChangeAt;
    lr.breakNow           = breakNow;
    lr.t                  = playPhaseTime;
    if (speed >= LR_STOP_SPEED) {
      lr.prevVelDir = { x: vx / speed, y: vy / speed };
    }
  });
}

// ── Debug render: Live Read labels ────────────────────────────────────
// Called from drawDebugOverlay() when liveReadOn is true and mode==='sim'.
function drawLiveReadOverlay() {
  if (!liveReadOn || mode !== 'sim' || !offenseStructureSnapshot) return;

  ctx.save();
  ctx.textBaseline = 'top';

  const snap     = offenseStructureSnapshot;
  const relevant = [...snap.eligiblePlayers, ...snap.backfieldPlayers];

  relevant.forEach(p => {
    const lr = liveReadStateById[p.id];
    if (!lr) return;

    const px = p.simX ?? p.x;
    const py = p.simY ?? p.y;

    // Build label
    const mtShort = lr.moveType.toUpperCase().slice(0, 4);
    const spdStr  = lr.speed >= LR_STOP_SPEED ? `spd=${(lr.speed / YARD_PX).toFixed(1)}` : '';
    const dStr    = `d=${lr.depthYards}`;
    const brkStr  = lr.breakNow ? 'BRK!' : '';
    const midStr  = `mid=${lr.crossedMiddleNow ? 1 : 0}`;
    const vtStr   = lr.isVerticalThreatNow ? '↑!' : '';

    const parts = ['LIVE:', mtShort, spdStr, dStr, brkStr, vtStr, midStr].filter(Boolean);
    const liveLabel = parts.join(' ');

    const lx = px + 16;
    // Stagger below Phase 2.3 labels (which use ~ly-14 and ly-1)
    const ly = py + 6;

    ctx.font = 'bold 10px Barlow Condensed';
    ctx.lineWidth   = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(liveLabel, lx, ly);
    ctx.fillStyle   = lr.isVerticalThreatNow ? '#facc15'
                    : lr.breakNow            ? '#f87171'
                    : lr.moveType === 'stopped' ? '#6b7280'
                    : '#86efac';
    ctx.fillText(liveLabel, lx, ly);

    // Velocity arrow from current position (small, capped at 22px)
    if (lr.speed >= LR_STOP_SPEED) {
      const mag   = lr.speed;
      const scale = Math.min(22, mag) / mag;
      const ax    = px + lr.vel.x * scale;
      const ay    = py + lr.vel.y * scale;
      ctx.strokeStyle = 'rgba(134,239,172,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke();
      const ang = Math.atan2(lr.vel.y, lr.vel.x);
      const hs  = 4;
      ctx.fillStyle = 'rgba(134,239,172,0.8)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - hs * Math.cos(ang - 0.4), ay - hs * Math.sin(ang - 0.4));
      ctx.lineTo(ax - hs * Math.cos(ang + 0.4), ay - hs * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    }
  });

  ctx.restore();
}

// ===================================================================
// DEFENSE (Phase 3.2)
// Player placement, selection, Man/Zone assignments, render, sim.
// Does NOT touch offense data. Reads offenseStructureSnapshot read-only.
