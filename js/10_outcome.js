// ===================================================================
// 10_OUTCOME.JS — Play Outcome Engine
// ===================================================================
// Berechnet das Ergebnis eines Plays am Ende der Simulation.
//
// Einstiegspunkte:
//   getPassOutcome(targetId)  → { complete, yards, result, defender, detail }
//   getRunOutcome()           → { yards, result, defender, detail }
//   getQBPressure()           → { pressured, rusherId, timeToArrival }
//
// Attribute-Fallback-System:
//   Alle Spieler-Ratings default auf 75 wenn keine d.attributes gesetzt.
//   Später einfach d.attributes = { speed: 82, coverage: 79, ... } setzen.
// ===================================================================

// ── Attribute-Helfer ─────────────────────────────────────────────────
// getAttr() lebt jetzt in 00_attributes.js (muss vor dieser Datei laden).
// Legacy-Keys (speed, catch, route, ...) werden dort automatisch gemappt.

// ── Konstanten ───────────────────────────────────────────────────────

const YARDS_PER_PX       = 1 / YARD_PX;
const OPEN_SEPARATION_PX = 3 * YARD_PX;   // ab hier gilt Receiver als "open"
const CONTESTED_SEP_PX   = 1.5 * YARD_PX; // darunter = contested catch
const PRESSURE_RADIUS_PX = 2.5 * YARD_PX; // QB-Distanz ab der Pressure gilt
const PRESSURE_TIME_THR  = 2.5;           // Sekunden — nur in ersten 2.5s relevant

// ── Pressure-Tracking ────────────────────────────────────────────────
// Pressure wird WÄHREND der Sim getrackt (jeden Tick), nicht erst am Ende.
// So geht kein früher Druck verloren wenn die Sim länger läuft.
let _qbPressureTracked = {
  pressured:      false,
  minDistPx:      Infinity,
  rusherId:       null,
  pressureFactor: 1.0,
};

function resetQBPressureTracking() {
  _qbPressureTracked = { pressured: false, minDistPx: Infinity, rusherId: null, pressureFactor: 1.0 };
}

// Jeden Pass-Play-Tick aufrufen (in animateSim)
function trackQBPressureTick() {
  if (playPhaseTime > PRESSURE_TIME_THR) return;
  const qb = players.find(p => p.type === 'QB');
  if (!qb) return;
  const qbPos = simPos(qb);
  defensePlayers.forEach(d => {
    if (!d.decision || d.decision.mode !== 'rush') return;
    const separation = dist(simPos(d), qbPos);

    // ── PRS + STR: effektiver Druck-Radius pro Rusher ──────────────────
    // PRS = primäre Pass-Rush-Fähigkeit, STR = Kraftkomponente (Bull Rush).
    // rushScore > 75 → größerer effektiver Radius, < 75 → kleinerer.
    // simSpeed bereits in Bewegungsgeschwindigkeit & playPhaseTime eingerechnet.
    const prsRating = getAttr(d, 'PRS');
    const strRating = getAttr(d, 'STR');
    const rushScore = prsRating * 0.7 + strRating * 0.3;

    // ── BLK: aktiver Blocker reduziert den effektiven Druck-Radius ─────
    // Prüft ob ein Blocker (Skill oder OLine) diesen Rusher gerade hält.
    let blkFactor = 1.0;
    const allBlockers = [
      ...players,
      ...(typeof OLINE_IDS !== 'undefined'
          ? OLINE_IDS.map(id => olineData[id]).filter(Boolean)
          : []),
    ];
    const engagedBlocker = allBlockers.find(b =>
      b._blockChaseTargetId === d.id &&
      dist(simPos(b), simPos(d)) <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 4
    );
    if (engagedBlocker) {
      const blkRating = getAttr(engagedBlocker, 'BLK');
      // Hoher BLK = Rusher wird effektiv abgehalten → kleinerer effektiver Radius.
      // Formel: blkFactor < 1 bei blkRating > 75, > 1 bei blkRating < 75.
      blkFactor = 75 / Math.max(blkRating, 40);
    }

    // Effektiver Radius skaliert mit rushScore und wird durch Blocking gemindert.
    const effectiveRadius = PRESSURE_RADIUS_PX * (rushScore / 75) * blkFactor;

    // Normalisierter Abstand: verhält sich wie der alte minDistPx bzgl. pressureFactor.
    const normalizedDist = (separation / effectiveRadius) * PRESSURE_RADIUS_PX;
    if (normalizedDist < _qbPressureTracked.minDistPx) {
      _qbPressureTracked.minDistPx = normalizedDist;
      _qbPressureTracked.rusherId  = d.id;
    }
  });
  if (_qbPressureTracked.minDistPx <= PRESSURE_RADIUS_PX) {
    _qbPressureTracked.pressured      = true;
    _qbPressureTracked.pressureFactor = Math.max(0.4,
      _qbPressureTracked.minDistPx / PRESSURE_RADIUS_PX);
  }
}

// Gibt das bisherige Tracking-Ergebnis zurück (statt live zu prüfen)
function getQBPressure() {
  return { ..._qbPressureTracked };
}

function simPos(player) {
  return {
    x: player.simX ?? player.x,
    y: player.simY ?? player.y,
  };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Wandelt Canvas-Y-Differenz in Yards um (upfield = weniger Y = positive Yards)
function yardGain(fromY, toY) {
  return Math.round((fromY - toY) * YARDS_PER_PX);
}

// ── Coverage-Faktor eines einzelnen Defenders ────────────────────────
// Wie gut deckt dieser Defender diesen Receiver?
// Gibt einen Multiplikator zurück: > 1.0 = Offense-Vorteil, < 1.0 = Defense-Vorteil

function getCoverageQualityFactor(defender, receiver, recPosOverride, defPosOverride) {
  if (!defender) return 1.5; // kein Defender → offen

  // 1. Basis: Man vs Zone
  const isMan  = defender.decision?.mode === 'follow';
  const isZone = defender.decision?.mode === 'drop';
  const coverageBase = isMan ? 1.0 : 0.75; // Zone = DB kommt von woanders

  // 2. Leverage (cbShade) vs Route-Richtung
  // Inside-Shade + Out-Route = Offense-Vorteil
  // Outside-Shade + Post/Dig = Offense-Vorteil
  const shade     = defender.cbShade || 'normal';
  const lr        = liveReadStateById[receiver.id];
  const routeType = lr?.lastActiveMoveType || 'unknown';

  let leverageFactor = 1.0;
  if (shade === 'inside'  && (routeType === 'out'    || routeType === 'corner')) leverageFactor = 1.25;
  if (shade === 'inside'  && (routeType === 'post'   || routeType === 'dig'))    leverageFactor = 0.85;
  if (shade === 'outside' && (routeType === 'post'   || routeType === 'dig'))    leverageFactor = 1.25;
  if (shade === 'outside' && (routeType === 'out'    || routeType === 'corner')) leverageFactor = 0.85;

  // 3. Phase: ist der DB vor oder hinter dem Receiver?
  // Upfield = kleineres Y. Wenn d.simY > rec.simY → DB ist hinter (trail) → Vorteil Offense
  // Nutze übergebene Positionen (Dry-Run) oder fallback auf simPos (Live)
  const recPos = recPosOverride || simPos(receiver);
  const defPos = defPosOverride || simPos(defender);
  const isTrail = defPos.y > recPos.y;

  // REL: Release-Rating des Receivers wirkt gegen Press-Coverage.
  // Bei Trail-Coverage (DB hinter Receiver) greift REL nicht.
  // simSpeed bereits in den Bewegungspositionen eingerechnet.
  const relRating = getAttr(receiver, 'REL');
  const relBonus  = isTrail ? 0 : (relRating - 75) / 150;
  // REL=75 → +0.0, REL=99 → +0.16, REL=50 → −0.17
  const phaseFactor = (isTrail ? 1.2 : 0.9) + relBonus;

  // 4. Attribute-Einfluss
  const covRating = isMan
    ? getAttr(defender, 'manCoverage')
    : getAttr(defender, 'zoneCoverage');
  const catchRating  = getAttr(receiver, 'catch');
  const routeRating  = getAttr(receiver, 'route');

  // 75 = Baseline. >75 verbessert, <75 verschlechtert.
  const defAttrMult = 75 / covRating;           // guter DB → Faktor < 1 → weniger Separation
  const offAttrMult = ((catchRating + routeRating) / 2) / 75; // guter WR → Faktor > 1

  // BRK: Separation-Bonus beim Route-Cut.
  // breakNow wird in LiveRead getrackt (Winkeländerung ≥35°).
  // Addiert zum Endergebnis da es ein absoluter Bonus auf den covFactor ist.
  const brkRating  = getAttr(receiver, 'BRK');
  const breakNow   = lr?.breakNow || false;
  const breakBonus = breakNow ? (brkRating - 75) / 200 : 0;
  // BRK=75 → +0.0, BRK=99 → +0.12, BRK=50 → −0.13

  return coverageBase * leverageFactor * phaseFactor * defAttrMult * offAttrMult + breakBonus;
}

// ── Nächster Defender zu einem Receiver ──────────────────────────────

function nearestDefender(receiver, excludeIds = []) {
  const recPos = simPos(receiver);
  let best = null, bestDist = Infinity;

  defensePlayers.forEach(d => {
    if (excludeIds.includes(d.id)) return;
    const separation = dist(simPos(d), recPos);
    if (separation < bestDist) {
      bestDist = separation;
      best = d;
    }
  });

  return { defender: best, separationPx: bestDist };
}

// ═══════════════════════════════════════════════════════════════════════
// DRY-RUN PROJECTION SYSTEM
// Runs the real sim forward in time (without rendering) to project
// where all players/defenders will be at ball arrival.
// Used by getPassCompletionProb for accurate separation prediction.
// ═══════════════════════════════════════════════════════════════════════

let _dryRunTimeline = null;
// { stepDt, maxTime, steps: [ { t, pos: { [id]: {x,y} } }, ... ] }

// ── Properties to snapshot per object type ──────────────────────────
const _SNAP_PLAYER_KEYS = [
  'simX', 'simY', 'simWpIdx', 'simDone',
  '_blockChaseTargetId', '_blockChaseDone', '_blockHoldX', '_blockHoldY', '_blockDistTraveled',
  '_blockLocked', '_prevSimX', '_prevSimY', '_velX', '_velY',
  '_breakTimer', '_breakSpeedMult',
  '_releaseTimer', '_releaseSpeedMult',
  '_accMult',
];
const _SNAP_DEFENDER_KEYS = [
  'simX', 'simY', '_prevSimX', '_prevSimY', '_velX', '_velY',
  '_dualManRole', '_dualManTargetId', '_dualManIsTop',
  'simZonePhase', 'simZoneDone', '_blockLocked',
  'simDeepArrived', '_lockedGapId', '_manualRunAssignment',
  '_creFreezeTimer', '_pendingDecision', '_pendingTimer',
  '_backpedalDone', '_lastDecKey',
  '_defAccMult', '_smoothVelX', '_smoothVelY',
  '_percVelX', '_percVelY',
  '_lastCommitTime', '_passoffTime', '_covLock', '_covCall',
];
const _SNAP_OLINE_KEYS = [
  'simX', 'simY', 'simWpIdx', 'simDone',
  '_blockChaseTargetId', '_blockChaseDone', '_blockHoldX', '_blockHoldY', '_blockDistTraveled',
  '_blockLocked',
];

function _snapshotSimState() {
  const snap = {
    players: [], defenders: [], oline: [],
    liveReads: {},
    pressure: { ..._qbPressureTracked },
    playPhaseTime: playPhaseTime,
    lastPlayOutcome: lastPlayOutcome,
    qbThrow: qbThrow ? { ...qbThrow } : null,
    ballSim: { ...ballSim },
    _tackleTimerActive: (typeof _tackleTimerActive !== 'undefined') ? _tackleTimerActive : false,
    _tackleTimer: (typeof _tackleTimer !== 'undefined') ? _tackleTimer : 0,
    persistentCovCalls: (typeof persistentCovCalls !== 'undefined') ? { ...persistentCovCalls } : {},
  };

  players.forEach(p => {
    const s = { id: p.id };
    _SNAP_PLAYER_KEYS.forEach(k => { s[k] = p[k]; });
    snap.players.push(s);
  });

  defensePlayers.forEach(d => {
    const s = { id: d.id };
    _SNAP_DEFENDER_KEYS.forEach(k => { s[k] = d[k]; });
    s.decision = d.decision ? {
      ...d.decision,
      _shadedLandmarkPos: d.decision._shadedLandmarkPos
        ? { x: d.decision._shadedLandmarkPos.x, y: d.decision._shadedLandmarkPos.y } : null,
    } : null;
    snap.defenders.push(s);
  });

  if (typeof OLINE_IDS !== 'undefined') {
    OLINE_IDS.forEach(id => {
      const d = olineData[id];
      if (!d) return;
      const s = { id };
      _SNAP_OLINE_KEYS.forEach(k => { s[k] = d[k]; });
      snap.oline.push(s);
    });
  }

  // Live reads: manual deep clone (avoid JSON for speed and undefined preservation)
  for (const key in liveReadStateById) {
    const lr = liveReadStateById[key];
    snap.liveReads[key] = {
      phase: lr.phase, t: lr.t,
      pos: { x: lr.pos.x, y: lr.pos.y },
      prevPos: { x: lr.prevPos.x, y: lr.prevPos.y },
      vel: { x: lr.vel.x, y: lr.vel.y },
      speed: lr.speed, dirAngleDeg: lr.dirAngleDeg,
      moveType: lr.moveType, prevMoveType: lr.prevMoveType,
      lastActiveMoveType: lr.lastActiveMoveType,
      lastActiveVel: lr.lastActiveVel ? { x: lr.lastActiveVel.x, y: lr.lastActiveVel.y } : { x: 0, y: 0 },
      lastActiveDirAngleDeg: lr.lastActiveDirAngleDeg,
      depthYards: lr.depthYards,
      breakDepthYards: lr.breakDepthYards,
      isVerticalThreatNow: lr.isVerticalThreatNow,
      startSide: lr.startSide,
      crossedMiddleNow: lr.crossedMiddleNow,
      lastDecisionChangeAt: lr.lastDecisionChangeAt,
      prevVelDir: lr.prevVelDir ? { x: lr.prevVelDir.x, y: lr.prevVelDir.y } : { x: 0, y: -1 },
      breakNow: lr.breakNow,
    };
  }

  return snap;
}

function _restoreSimState(snap) {
  snap.players.forEach(s => {
    const p = players.find(pl => pl.id === s.id);
    if (!p) return;
    _SNAP_PLAYER_KEYS.forEach(k => { p[k] = s[k]; });
  });

  snap.defenders.forEach(s => {
    const d = defensePlayers.find(df => df.id === s.id);
    if (!d) return;
    _SNAP_DEFENDER_KEYS.forEach(k => { d[k] = s[k]; });
    d.decision = s.decision ? {
      ...s.decision,
      _shadedLandmarkPos: s.decision._shadedLandmarkPos
        ? { x: s.decision._shadedLandmarkPos.x, y: s.decision._shadedLandmarkPos.y } : null,
    } : null;
  });

  snap.oline.forEach(s => {
    const d = olineData[s.id];
    if (!d) return;
    _SNAP_OLINE_KEYS.forEach(k => { d[k] = s[k]; });
  });

  // Live reads: restore in place
  for (const key in liveReadStateById) delete liveReadStateById[key];
  for (const key in snap.liveReads) {
    const lr = snap.liveReads[key];
    liveReadStateById[key] = {
      phase: lr.phase, t: lr.t,
      pos: { x: lr.pos.x, y: lr.pos.y },
      prevPos: { x: lr.prevPos.x, y: lr.prevPos.y },
      vel: { x: lr.vel.x, y: lr.vel.y },
      speed: lr.speed, dirAngleDeg: lr.dirAngleDeg,
      moveType: lr.moveType, prevMoveType: lr.prevMoveType,
      lastActiveMoveType: lr.lastActiveMoveType,
      lastActiveVel: lr.lastActiveVel ? { x: lr.lastActiveVel.x, y: lr.lastActiveVel.y } : { x: 0, y: 0 },
      lastActiveDirAngleDeg: lr.lastActiveDirAngleDeg,
      depthYards: lr.depthYards,
      breakDepthYards: lr.breakDepthYards,
      isVerticalThreatNow: lr.isVerticalThreatNow,
      startSide: lr.startSide,
      crossedMiddleNow: lr.crossedMiddleNow,
      lastDecisionChangeAt: lr.lastDecisionChangeAt,
      prevVelDir: lr.prevVelDir ? { x: lr.prevVelDir.x, y: lr.prevVelDir.y } : { x: 0, y: -1 },
      breakNow: lr.breakNow,
    };
  }

  // Globals
  _qbPressureTracked = { ...snap.pressure };
  playPhaseTime = snap.playPhaseTime;
  lastPlayOutcome = snap.lastPlayOutcome;
  qbThrow = snap.qbThrow ? { ...snap.qbThrow } : null;
  ballSim = { ...snap.ballSim };
  if (typeof _tackleTimerActive !== 'undefined') _tackleTimerActive = snap._tackleTimerActive;
  if (typeof _tackleTimer !== 'undefined') _tackleTimer = snap._tackleTimer;
  if (typeof persistentCovCalls !== 'undefined') {
    for (const k in persistentCovCalls) delete persistentCovCalls[k];
    Object.assign(persistentCovCalls, snap.persistentCovCalls);
  }
}

// ── Capture positions of all players/defenders ─────────────────────
function _capturePositions() {
  const pos = {};
  players.forEach(p => { pos['o' + p.id] = { x: p.simX ?? p.x, y: p.simY ?? p.y }; });
  defensePlayers.forEach(d => { pos['d' + d.id] = { x: d.simX ?? d.x, y: d.simY ?? d.y }; });
  return pos;
}

// ── One dry-run tick (pass play movement, no QB read/ball/draw) ────
function _dryRunPassTick(dt) {
  const baseSpeed = simSpeed * 80;

  // Offense: skill players step routes/blocks
  players.forEach(p => {
    if (p.type === 'QB') return;
    const spd = getMoveSpeed(p, baseSpeed);
    if (p._blockChaseTargetId != null) {
      const target = defensePlayers.find(d => d.id === p._blockChaseTargetId);
      if (target) {
        const dd = Math.hypot((target.simX ?? target.x) - (p.simX ?? p.x),
                              (target.simY ?? target.y) - (p.simY ?? p.y));
        if (dd <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) stepBlockHold(p, dt, spd);
        else stepBlockChase(p, dt, spd);
      } else stepBlockChase(p, dt, spd);
      return;
    }
    if (p.simDone) return;
    const hasBlock = p.simBlockPoints && p.simBlockPoints.length > 0;
    const hasRoute = p.simRoutePoints && p.simRoutePoints.length > 0;
    if (hasBlock) {
      const done = stepPlayer(p, p.simBlockPoints, dt, spd);
      if (p._blockChaseTargetId != null) stepBlockChase(p, dt, spd);
      else if (done) tryStartBlockChase(p, spd, true);
      else {
        const search = p.simBlockPoints.length >= 2 ? p.simWpIdx >= 1 : false;
        if (!p._blockChaseDone && search) tryStartBlockChase(p, spd, false);
      }
    } else if (hasRoute) {
      if (stepPlayer(p, p.simRoutePoints, dt, spd)) p.simDone = true;
    }
  });

  // OLine blockers
  if (typeof OLINE_IDS !== 'undefined') {
    OLINE_IDS.forEach(id => {
      const d = olineData[id]; if (!d) return;
      const spd = getMoveSpeed(d, baseSpeed);
      if (d._blockChaseTargetId != null) {
        const tgt = defensePlayers.find(def => def.id === d._blockChaseTargetId);
        if (tgt) {
          const dd = Math.hypot((tgt.simX ?? tgt.x) - (d.simX ?? d.x),
                                (tgt.simY ?? tgt.y) - (d.simY ?? d.y));
          if (dd <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) stepBlockHold(d, dt, spd);
          else stepBlockChase(d, dt, spd);
        } else stepBlockChase(d, dt, spd);
        return;
      }
      if (!d.simDone && d.simBlockPoints && d.simBlockPoints.length > 0) {
        const done = stepPlayer(d, d.simBlockPoints, dt, spd);
        if (d._blockChaseTargetId != null) stepBlockChase(d, dt, spd);
        else if (done) tryStartBlockChase(d, spd, true);
        else {
          const search = d.simBlockPoints.length >= 2 ? d.simWpIdx >= 1 : false;
          if (!d._blockChaseDone && search) tryStartBlockChase(d, spd, false);
        }
      }
    });
  }

  // Live reads (also advances playPhaseTime)
  updateLiveReads(dt);

  // Pressure tracking
  if (typeof trackQBPressureTick === 'function') trackQBPressureTick();

  // Defense decisions + movement
  if (typeof updateDefenseDecisions === 'function' && typeof offenseStructureSnapshot !== 'undefined') {
    updateDefenseDecisions(offenseStructureSnapshot, liveReadStateById, dt);
  }
  if (typeof stepDefensePlayers === 'function') stepDefensePlayers(dt);
}

// ── Main entry: run dry-run and build timeline ─────────────────────
const DRY_RUN_STEP_DT  = 1 / 30;  // 30fps — accurate enough
const DRY_RUN_MAX_TIME = 2.0;     // max ball flight time in seconds (covers deep throws)

function runDryRunProjection() {
  const snap = _snapshotSimState();
  const totalSteps = Math.ceil(DRY_RUN_MAX_TIME / DRY_RUN_STEP_DT);
  const timeline = [{ t: 0, pos: _capturePositions() }];

  try {
    for (let i = 0; i < totalSteps; i++) {
      _dryRunPassTick(DRY_RUN_STEP_DT);
      timeline.push({ t: (i + 1) * DRY_RUN_STEP_DT, pos: _capturePositions() });
    }
  } catch (e) {
    console.error('[DRY-RUN] ERROR during simulation:', e);
  }

  _restoreSimState(snap);

  _dryRunTimeline = { stepDt: DRY_RUN_STEP_DT, maxTime: DRY_RUN_MAX_TIME, steps: timeline };

  // ── DIAGNOSTIC: Verify restore ──
  const postRestore = _capturePositions();
  const preSnap = timeline[0].pos;
  let restoreOk = true;
  for (const id in preSnap) {
    const pre = preSnap[id];
    const post = postRestore[id];
    if (!post) { console.warn(`[DRY-RUN] MISSING after restore: id=${id}`); restoreOk = false; continue; }
    const drift = Math.hypot(pre.x - post.x, pre.y - post.y);
    if (drift > 0.5) {
      console.warn(`[DRY-RUN] RESTORE DRIFT id=${id}: pre(${pre.x.toFixed(1)},${pre.y.toFixed(1)}) post(${post.x.toFixed(1)},${post.y.toFixed(1)}) drift=${drift.toFixed(1)}px`);
      restoreOk = false;
    }
  }
  if (restoreOk) console.log(`[DRY-RUN] restore OK — ${totalSteps} steps, ${Object.keys(preSnap).length} entities`);
}

// ── Lookup positions at a specific time ────────────────────────────
function getDryRunPositionsAt(timeSec) {
  if (!_dryRunTimeline || _dryRunTimeline.steps.length === 0) return null;
  const idx = Math.min(
    Math.round(timeSec / _dryRunTimeline.stepDt),
    _dryRunTimeline.steps.length - 1
  );
  return _dryRunTimeline.steps[Math.max(0, idx)].pos;
}

// ── PASS COMPLETION PROBABILITY ──────────────────────────────────────
// Gibt die geschätzte Completion-Wahrscheinlichkeit für einen Receiver zurück
// OHNE zu würfeln. Wird vom QB-Read benutzt um den besten Wurf zu finden.
//
// lookAheadSec > 0: nutzt Dry-Run-Positionen (projiziert bei Ballankunft)
// lookAheadSec == 0 oder absent: nutzt aktuelle Positionen (Outcome)

function getPassCompletionProb(targetId, projPos, lookAheadSec) {
  const receiver = players.find(p => p.id === targetId);
  if (!receiver) {
    return { completionProb: 0, intProb: 0, expectedYards: 0, rawYards: 0,
             nearbyDefCount: 0, effectiveSepYds: 0, debug: 'no receiver' };
  }

  const la = lookAheadSec || 0;
  const dryPos = (la > 0) ? getDryRunPositionsAt(la) : null;

  // ── DIAGNOSTIC: Dry-Run Debug ──────────────────────────────────
  if (la > 0) {
    const hasTL = !!_dryRunTimeline;
    const steps = hasTL ? _dryRunTimeline.steps.length : 0;
    const hasRecPos = dryPos ? !!dryPos['o' + receiver.id] : false;
    const currRec = simPos(receiver);
    const dryRec = dryPos ? dryPos['o' + receiver.id] : null;

    // Find closest current defender
    let closestNowDist = Infinity, closestNowId = null;
    defensePlayers.forEach(d => {
      const s = dist(simPos(d), currRec);
      if (s < closestNowDist) { closestNowDist = s; closestNowId = d.id; }
    });

    // Find closest dry-run defender
    let closestDryDist = Infinity, closestDryId = null;
    if (dryPos && dryRec) {
      defensePlayers.forEach(d => {
        const dp = dryPos['d' + d.id];
        if (!dp) return;
        const s = dist(dp, dryRec);
        if (s < closestDryDist) { closestDryDist = s; closestDryId = d.id; }
      });
    }

    console.log(`[DRY-RUN DIAG] rec:${receiver.label}#${receiver.id} la:${la.toFixed(2)}s | timeline:${hasTL} steps:${steps} hasRecPos:${hasRecPos}` +
      ` | currRec:(${currRec.x.toFixed(0)},${currRec.y.toFixed(0)}) dryRec:${dryRec ? `(${dryRec.x.toFixed(0)},${dryRec.y.toFixed(0)})` : 'NULL'}` +
      ` | nearestNow:def#${closestNowId} ${(closestNowDist/YARD_PX).toFixed(1)}yd | nearestDry:def#${closestDryId} ${(closestDryDist/YARD_PX).toFixed(1)}yd`);
  }
  // ── END DIAGNOSTIC ─────────────────────────────────────────────

  // Receiver-Position: Dry-Run > projPos > aktuell
  const recPos = dryPos ? (dryPos['o' + receiver.id] || simPos(receiver))
               : (projPos || simPos(receiver));
  const los    = LOS_Y();
  const rawYards = yardGain(los, recPos.y);

  const pressure = getQBPressure();

  // Helper: Defender-Position (Dry-Run oder aktuell)
  function defPosAt(d) {
    if (dryPos && dryPos['d' + d.id]) return dryPos['d' + d.id];
    return simPos(d);
  }

  // Nächster Defender
  let defender = null, rawSep = Infinity;
  defensePlayers.forEach(d => {
    const s = dist(defPosAt(d), recPos);
    if (s < rawSep) { rawSep = s; defender = d; }
  });

  const covFactor    = getCoverageQualityFactor(defender, receiver, recPos, defender ? defPosAt(defender) : null);
  const effectiveSep = rawSep * covFactor * pressure.pressureFactor;

  const catchRating    = getAttr(receiver, 'catch');
  const catchThreshold = OPEN_SEPARATION_PX * (catchRating / 75);

  // THA: QB-Genauigkeit unter Druck.
  // Hoher THA = Accuracy-Verlust unter Druck wird abgefedert.
  // pressureFactor bereits simSpeed-skaliert (via playPhaseTime += dt * simSpeed).
  // THA=75 → Faktor 1.0 (kein Unterschied). THA=99 → Faktor 1.32 (besser unter Druck).
  // THA=50 → Faktor 0.67 (deutlich schlechter unter Druck).
  const qb         = players.find(p => p.type === 'QB');
  const thaRating  = qb ? getAttr(qb, 'THA') : 75;
  const passAccuracy = 0.6 + 0.4 * pressure.pressureFactor * (thaRating / 75);

  // SPD: Tiefe-Routen-Bonus — schnelle Receiver gewinnen mehr Separation auf Go-Routen.
  // Greift erst ab 15 Yards Tiefe; simSpeed in den Positionsdaten bereits eingerechnet.
  const recSpd     = getAttr(receiver, 'SPD');
  const depthYds   = liveReadStateById[receiver.id]?.depthYards ?? 0;
  const deepBonus  = depthYds >= 15 ? (recSpd - 75) / 300 : 0;
  // SPD=75 → +0.0, SPD=99 → +0.08, SPD=50 → −0.08

  // Double Coverage
  const DC_RADIUS = 5 * YARD_PX;
  let nearbyDefCount = 0;
  defensePlayers.forEach(d => {
    if (d.decision?.mode === 'rush') return;
    const s = dist(defPosAt(d), recPos);
    if (s <= DC_RADIUS) nearbyDefCount++;
  });
  const isDoubleCovered = nearbyDefCount >= 2;

  // ── Smooth Sigmoid Probability Model ──────────────────────────────
  // Ersetzt die harten Zonen-Grenzen durch eine glatte S-Kurve.
  // effectiveSep → completionProb ohne Cliff-Effekte.

  const _sig = x => 1 / (1 + Math.exp(-x));

  // Sigmoid-Parameter: Mittelpunkt zwischen tight und open
  const midpoint   = (CONTESTED_SEP_PX + catchThreshold) / 2;  // ~2.25yd in px
  const steepness  = (catchThreshold - CONTESTED_SEP_PX) / 4;  // Breite der Transition
  const t          = steepness > 0 ? (effectiveSep - midpoint) / steepness : 0;

  // Basis-Kurve: 8% (tight) → 97% (open)
  const FLOOR   = 0.08;
  const CEILING = 0.97;
  let completionProb = FLOOR + (CEILING - FLOOR) * _sig(t);

  // ── Attribut-Modifikatoren (kontinuierlich, nicht zonenabhängig) ──
  // CTH dominiert bei Separation (open), CIT dominiert bei Traffic (tight)
  const citRating   = getAttr(receiver, 'CIT');
  const routeRating = getAttr(receiver, 'RTE');
  const openness    = _sig(t); // 0 = tight, 1 = open
  const blendedCatch = catchRating * openness + citRating * (1 - openness);
  completionProb += (blendedCatch - 75) / 250;   // Fang-Bonus (blend CTH/CIT)
  completionProb += (routeRating - 75) / 350;    // gute Route → +bonus
  completionProb += (covFactor - 1.0) * 0.08;    // Coverage-Qualität
  completionProb += deepBonus;                    // SPD: Tiefe-Routen-Bonus
  completionProb *= passAccuracy;                 // THA + Pressure-Einfluss

  // Double/Triple Coverage — skaliert mit Separation (härter bei tight)
  const dcPenalty = isDoubleCovered
    ? (nearbyDefCount >= 3 ? 0.25 : 0.15) * (1 - _sig(t) * 0.6)
    : 0;
  completionProb -= dcPenalty;

  completionProb = Math.max(0.03, Math.min(0.97, completionProb));

  // ── INT-Wahrscheinlichkeit: inverse Sigmoid (hoch bei tight, niedrig bei open) ──
  const dPos      = defender ? defPosAt(defender) : recPos;
  const dbInFront = dPos.y < recPos.y;
  const intBase   = dbInFront ? 0.22 : 0.06;
  const intFloor  = 0.01;
  // Bei voller Separation → intFloor, bei 0 Separation → intBase
  let intProb = intFloor + (intBase - intFloor) * (1 - _sig(t));

  if (defender) intProb += (getAttr(defender, 'coverage') - 75) / 500;
  intProb += (1.0 - passAccuracy) * 0.08;
  if (nearbyDefCount >= 3)       intProb += 0.12 * (1 - _sig(t));
  else if (isDoubleCovered)      intProb += 0.07 * (1 - _sig(t));

  intProb = Math.max(0.01, Math.min(0.35, intProb));

  // Expected Value: completionProb × Yards − intProb × Strafwert
  // INT = ca. -40 Yards Feldposition-Verlust als Strafwert
  const INT_PENALTY_YARDS = 40;
  const expectedYards = completionProb * Math.max(rawYards, 0.5)
                      - intProb * INT_PENALTY_YARDS;

  const effSepYds = (effectiveSep * YARDS_PER_PX);
  const debug = `${receiver.label}#${receiver.id} comp:${(completionProb*100).toFixed(0)}% int:${(intProb*100).toFixed(0)}% EY:${expectedYards.toFixed(1)} sep:${effSepYds.toFixed(1)}yd ${nearbyDefCount >= 2 ? nearbyDefCount+'×COV' : ''}`;

  return {
    completionProb,
    intProb,
    expectedYards,
    rawYards,
    nearbyDefCount,
    effectiveSepYds: effSepYds,
    debug,
  };
}

// ── PASS OUTCOME ─────────────────────────────────────────────────────
// targetId: ID des Receivers dem der Pass gilt.
//
// WICHTIG: Nutzt jetzt getPassCompletionProb(targetId) als einzige
// Wahrscheinlichkeits-Quelle. Damit sind QB-Read-Vorhersage und
// tatsächliches Outcome garantiert konsistent — der einzige Unterschied
// ist, dass der QB-Read Dry-Run-Positionen nutzt (lookAhead > 0),
// während das Outcome die echten Live-Positionen nutzt (lookAhead = 0).
//
// Rückgabe:
// {
//   complete:    boolean,
//   yards:       number,          // ab LOS (nur wenn complete)
//   result:      string,          // 'touchdown' | 'complete' | 'incomplete' | 'interception'
//   defender:    object | null,   // der entscheidende Defender
//   separationPx: number,
//   detail:      string,          // lesbarer Text für UI/Log
// }

function getPassOutcome(targetId) {
  const receiver = players.find(p => p.id === targetId);
  if (!receiver) {
    return { complete: false, yards: 0, result: 'incomplete', defender: null, detail: 'Kein Receiver' };
  }

  // ── Einzige Wahrscheinlichkeits-Berechnung: getPassCompletionProb ──
  // lookAheadSec = 0 → nutzt echte simPos() für alle Spieler
  const arrivalProb = getPassCompletionProb(targetId);

  const recPos   = simPos(receiver);
  const los      = LOS_Y();
  const rawYards = yardGain(los, recPos.y);
  const pressure = getQBPressure();

  // Nächster Defender (live positions — konsistent mit getPassCompletionProb bei la=0)
  const { defender, separationPx: rawSep } = nearestDefender(receiver);
  const covFactor    = getCoverageQualityFactor(defender, receiver);
  const effectiveSep = rawSep * covFactor * pressure.pressureFactor;

  const catchThreshold = OPEN_SEPARATION_PX * (getAttr(receiver, 'catch') / 75);

  // ── Würfeln basierend auf der Prob-Engine ─────────────────────────
  let result, complete;
  const compProb = arrivalProb.completionProb;
  const intProb  = arrivalProb.intProb;

  // Zuerst INT prüfen, dann Completion
  if (Math.random() < intProb) {
    complete = false;
    result   = 'interception';
  } else if (Math.random() < compProb / (1 - intProb)) {
    // Bedingte Completion-Wahrscheinlichkeit (gegeben kein INT)
    complete = true;
    result   = 'complete';
  } else {
    complete = false;
    result   = 'incomplete';
  }

  // Touchdown-Check
  if (complete && rawYards >= 30) result = 'touchdown';

  // Detail-String für Debug/UI
  const sepYds    = (effectiveSep * YARDS_PER_PX).toFixed(1);
  const rawSepYds = (rawSep * YARDS_PER_PX).toFixed(1);
  const threshYds = (catchThreshold * YARDS_PER_PX).toFixed(1);
  const pressStr  = pressure.pressured ? ' · PRESSURE' : '';
  const dcStr     = arrivalProb.nearbyDefCount >= 2 ? ` · ${arrivalProb.nearbyDefCount}×COV` : '';
  const detail    = `${receiver.label}#${receiver.id} — RawSep:${rawSepYds}yd EffSep:${sepYds}yd Thresh:${threshYds}yd Comp:${(compProb*100).toFixed(0)}% INT:${(intProb*100).toFixed(0)}%${pressStr}${dcStr} → ${result.toUpperCase()}`;

  // QB-Read-Vorhersage aus qbThrow anhängen (wenn vorhanden)
  const qbReadProb = qbThrow?._qbReadProb || null;

  return {
    complete,
    yards:           complete ? rawYards : 0,
    result,
    defender,
    separationPx:    effectiveSep,
    rawSeparationPx: rawSep,
    covFactor,
    pressure,
    isDoubleCovered: arrivalProb.nearbyDefCount >= 2,
    nearbyDefCount:  arrivalProb.nearbyDefCount,
    detail,
    arrivalProb,
    qbReadProb,   // Dry-Run-Vorhersage zum Vergleich
  };
}

// ── RUN OUTCOME ──────────────────────────────────────────────────────
// Berechnet Yards für das aktuell laufende Run-Play.
//
// Rückgabe:
// {
//   yards:              number,
//   result:             'gain' | 'loss' | 'touchdown',
//   tackler:            object | null,
//   tackleSuccessProb:  number,   // 0–1, Tackle-Erfolgswahrscheinlichkeit (TAK+STR vs SPD)
//   yac:                number,   // Yards After Contact
//   detail:             string,
// }

function getRunOutcome() {
  const carrier = players.find(p => p.id === runCarrierId);
  if (!carrier) return { yards: 0, result: 'gain', tackler: null, detail: 'Kein Carrier' };

  const carPos  = simPos(carrier);
  const los     = LOS_Y();
  const rawYards = yardGain(los, carPos.y);

  // Nächster Tackler
  const { defender: tackler, separationPx } = nearestDefender(carrier);

  // ── Tackle-Duel: TAK + STR (Defense) vs SPD (Offense) ───────────────
  // TAK = Tackle-Technik (70%), STR = Kraft/Stopping-Power (30%).
  // Carrier-SPD = Ausweichgeschwindigkeit / Elusiveness beim Erstkontakt.
  // separationPx ist bereits simSpeed-skaliert (Sim lief schneller/langsamer,
  // aber der Feldabstand beim Play-Ende ist positions-konsistent).
  const tackRating = getAttr(tackler, 'TAK');
  const strRating  = getAttr(tackler, 'STR');
  const carrierSpd = getAttr(carrier,  'SPD');

  // Gewichteter Defense-Score vs Offense-Score → Tackle-Erfolgswahrscheinlichkeit
  const defScore          = tackRating * 0.7 + strRating * 0.3;
  const tackleSuccessProb = defScore / (defScore + carrierSpd);
  // Gleiche Attribute (75 vs 75): 75/(75+75) = 0.5

  // YAC: Separation-Basis (max 4 yd) + Tackle-Miss-Anteil (bis +2 yd extra)
  const yacBase = Math.min(separationPx / YARD_PX, 4);
  const yacAttr = (1 - tackleSuccessProb) * 2;
  // tackleSuccessProb=0.5 → yacAttr=+1 yd; =0.3 → +1.4 yd; =0.7 → +0.6 yd
  const yac     = Math.max(0, yacBase * (1 - tackleSuccessProb * 0.5) + yacAttr);

  const totalYards = Math.round(rawYards + yac);

  const result = totalYards >= 30 ? 'touchdown'
               : totalYards < 0   ? 'loss'
               : 'gain';

  const tackProb = (tackleSuccessProb * 100).toFixed(0);
  const detail = `${carrier.label}#${carrier.id} — ${totalYards > 0 ? '+' : ''}${totalYards} Yards (TackleProb:${tackProb}% YAC:${yac.toFixed(1)})`;

  return {
    yards: totalYards,
    result,
    tackler,
    separationPx,
    tackleSuccessProb,
    yac,
    detail,
  };
}

// ── UI: Outcome Overlay ───────────────────────────────────────────────

function showOutcomeToast(outcome) {
  if (!outcome) return;
  if (typeof _dryRunning !== 'undefined' && _dryRunning) return; // Outcome während Dry-Run unterdrücken

  const labels = {
    touchdown:    '🏈 TOUCHDOWN',
    complete:     '✓ COMPLETE',
    incomplete:   '✗ INCOMPLETE',
    interception: '⚡ INTERCEPTION',
    gain:         '↑ GAIN',
    loss:         '↓ LOSS',
    penalty:      '⚑ PENALTY',
  };

  const yardStr = outcome.yards !== 0
    ? `${outcome.yards > 0 ? '+' : ''}${outcome.yards}`
    : outcome.result === 'incomplete' || outcome.result === 'interception' ? '—' : '0';

  const overlay   = document.getElementById('outcomeOverlay');
  const resEl     = document.getElementById('outcomeResult');
  const yardsEl   = document.getElementById('outcomeYards');
  const detailEl  = document.getElementById('outcomeDetail');
  const sepEl     = document.getElementById('outcomeSep');

  if (!overlay) {
    // Fallback: Toast wenn kein Overlay im DOM
    showToast(labels[outcome.result] + ' ' + yardStr, 'info');
    return;
  }

  resEl.textContent   = labels[outcome.result]  ?? outcome.result.toUpperCase();
  yardsEl.textContent = outcome.result === 'incomplete' || outcome.result === 'interception'
    ? '—'
    : yardStr + ' YDS';
  detailEl.textContent = outcome.detail ?? '';

  // Separation Info + Debug-Zahlen
  if (outcome.raw?.separationPx != null) {
    const effSepYds = (outcome.raw.separationPx / YARD_PX).toFixed(1);
    const rawSepYds = (outcome.raw.rawSeparationPx / YARD_PX).toFixed(1);
    const defName   = outcome.raw?.defender
      ? `${outcome.raw.defender.role}${outcome.raw.defender.id}`
      : 'kein Defender';
    const pressStr  = outcome.raw?.pressure?.pressured ? ' · QB PRESSURE' : '';
    const covFac    = outcome.raw?.covFactor != null ? ` · CovF:${outcome.raw.covFactor.toFixed(2)}` : '';

    let lines = `RawSep: ${rawSepYds}yd → EffSep: ${effSepYds}yd · ${defName}${pressStr}${covFac}`;

    // ── Arrival: Live-Positionen bei Ballankunft (was tatsächlich passiert ist) ──
    const ap = outcome.raw?.arrivalProb;
    if (ap && ap.completionProb != null) {
      lines += `<br><span style="color:#86efac">⬤ Arrival:</span> Comp:<b>${(ap.completionProb*100).toFixed(0)}%</b> · INT:${(ap.intProb*100).toFixed(0)}% · EY:${ap.expectedYards.toFixed(1)} · Sep:${ap.effectiveSepYds.toFixed(1)}yd`;
    }

    // ── QB-Read: Dry-Run-Vorhersage zum Zeitpunkt der Wurfentscheidung ──
    const qp = outcome.raw?.qbReadProb;
    if (qp && qp.completionProb != null) {
      lines += `<br><span style="color:#93c5fd">⬤ QB-Read:</span> Comp:<b>${(qp.completionProb*100).toFixed(0)}%</b> · INT:${(qp.intProb*100).toFixed(0)}% · EY:${qp.expectedYards.toFixed(1)} · Sep:${qp.effectiveSepYds.toFixed(1)}yd`;

      // Delta anzeigen wenn beide vorhanden
      if (ap && ap.completionProb != null) {
        const compDelta = ((ap.completionProb - qp.completionProb) * 100).toFixed(0);
        const sepDelta  = (ap.effectiveSepYds - qp.effectiveSepYds).toFixed(1);
        const deltaColor = parseFloat(compDelta) >= 0 ? '#86efac' : '#f87171';
        lines += `<br><span style="color:${deltaColor}">Δ Comp:${compDelta > 0 ? '+' : ''}${compDelta}% · ΔSep:${sepDelta > 0 ? '+' : ''}${sepDelta}yd</span>`;
      }
    } else {
      lines += `<br><span style="color:#6b7280">QB-Read: nicht verfügbar (kein qbThrow)</span>`;
    }

    sepEl.innerHTML = lines;
  } else {
    sepEl.textContent = '';
  }

  // CSS-Klasse für Farbe
  overlay.className = `visible result-${outcome.result}`;

  // Sim pausieren damit man das Overlay lesen kann
  if (mode === 'sim' && !simPaused) togglePause();

  logDebug(`<span>OUTCOME</span> ${outcome.detail}`);
}

function closeOutcomeOverlay() {
  const overlay = document.getElementById('outcomeOverlay');
  if (overlay) overlay.className = '';
}

// targetId: für Pass-Plays die ID des Receivers; null für Run-Plays.
//
// Gibt ein einheitliches Ergebnis-Objekt zurück:
// {
//   playType:  'pass' | 'run',
//   yards:     number,
//   result:    string,
//   detail:    string,
//   raw:       object,   // volles Ergebnis-Objekt (pass oder run)
// }

function resolvePlayOutcome(targetId = null) {
  let raw;

  if (playType === 'run') {
    raw = getRunOutcome();
  } else {
    // Kein Target manuell gesetzt → automatisch den ersten Receiver mit Route nehmen
    let effectiveTarget = targetId;
    if (effectiveTarget == null) {
      const autoTarget = players.find(p =>
        ['WR','TE','RB','FB'].includes(p.type) &&
        p.simRoutePoints && p.simRoutePoints.length > 0
      );
      effectiveTarget = autoTarget?.id ?? null;
    }

    if (effectiveTarget == null) {
      raw = {
        complete: false, yards: 0,
        result: 'incomplete', defender: null,
        detail: 'Kein Target — Throwaway',
      };
    } else {
      raw = getPassOutcome(effectiveTarget);
    }
  }

  logDebug(`<span>OUTCOME</span> ${raw.detail}`);

  // ── Alignment Checker: Illegal Man Downfield override ───────────────
  if (illegalFormationRulesOn && _pendingIllegalManDownfield) {
    const penaltyDetail = _pendingIllegalManDownfield;
    _pendingIllegalManDownfield = null; // consume before return
    return {
      playType: 'pass',
      yards:    -5,
      result:   'penalty',
      detail:   `Illegal Man Downfield — ${penaltyDetail}`,
      raw:      { yards: -5, result: 'penalty', detail: `Illegal Man Downfield — ${penaltyDetail}` },
    };
  }

  return {
    playType: playType === 'run' ? 'run' : 'pass',
    yards:    raw.yards,
    result:   raw.result,
    detail:   raw.detail,
    raw,
  };
}
