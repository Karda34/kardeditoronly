function makeBacksidePreset(weakKey) {
  const weak = PRESET_REGISTRY[weakKey];
  if (!weak) return null;

  function patchSnapshot(snapshot) {
    if (!snapshot) return snapshot;
    const rb = snapshot.primaryBackfield;
    if (!rb) return snapshot; // no RB → nothing to inject
    const strongSide = snapshot.coverageStrongSide || 'R';
    const weakSide   = strongSide === 'L' ? 'R' : 'L';
    // If weak side already has a #2, don't double-inject
    const hasW2 = snapshot.eligiblePlayers.some(
      p => p._side === weakSide && p._receiverNumber === 2
    );
    if (hasW2) return snapshot;
    // Create RB proxy with weak-side #2 identity
    const rbProxy = Object.create(rb);
    rbProxy._side           = weakSide;
    rbProxy._receiverNumber = 2;
    rbProxy._attachmentZone = 'WIDE'; // treated as receiver, not inline
    // Shallow-clone snapshot with RB injected and primaryBackfield nulled
    return Object.assign({}, snapshot, {
      eligiblePlayers:  [...snapshot.eligiblePlayers, rbProxy],
      primaryBackfield: null,
    });
  }

  return {
    fullField:  false,
    isOneHigh:  weak.isOneHigh ?? false,
    alignment:  weak.alignment,
    decide(roles, byId, snapshot) {
      return weak.decide(roles, byId, patchSnapshot(snapshot));
    },
    react(d, role, snapshot, lrState) {
      return weak.react(d, role, patchSnapshot(snapshot), lrState);
    },
  };
}

// Register 3x1 backside presets
PRESET_REGISTRY['meg-backside']  = makeBacksidePreset('meg-weak');
PRESET_REGISTRY['c2m-backside']  = makeBacksidePreset('c2m-weak');
PRESET_REGISTRY['tuff-backside'] = makeBacksidePreset('tuff-weak');

// Returns Map<defenderId, decision> or null if manual.
// For fullField presets: single preset handles everything (existing behaviour).
// For side-only presets: strong owns SS/Hook/Strong-CB/Strong-Apex,
//                        weak  owns FS/Weak-CB/Weak-Apex.
function getActivePresetDecisions(snapshot, defenders) {
  const { strongKey, weakKey, isFullField } = resolveCallSheetSlots(snapshot);
  const strongPreset = PRESET_REGISTRY[strongKey];
  if (!strongPreset || !snapshot) return null;

  // Empty formation: map #2w as primaryBackfield for RB-referencing presets
  const snap = patchEmptySnapshot(snapshot);

  const ballX = snap.ballX;
  const losY  = snap.losY ?? LOS_Y();
  const byId  = new Map(defenders.map(d => [d.id, d]));
  const roles = (simPhase === 'play' && frozenRoleMap) ? frozenRoleMap
              : classifyAllRoles(defenders, ballX, losY, strongPreset.isOneHigh, snap.coverageStrongSide);

  // ── Full field: one preset decides everything ────────────────────
  if (isFullField) {
    const decMap = strongPreset.decide(roles, byId, snap);
    roles.forEach((role, id) => { const dec = decMap.get(id); if (dec) dec._structRole = role; });
    return decMap;
  }

  // ── Side-only: both presets decide, merged by role ownership ─────
  const weakPreset   = PRESET_REGISTRY[weakKey];
  const strongSide   = snap.coverageStrongSide || 'R';
  const strongDecMap = strongPreset.decide(roles, byId, snap);
  const weakDecMap   = weakPreset ? weakPreset.decide(roles, byId, snap) : new Map();

  const decMap = new Map();
  roles.forEach((role, id) => {
    const d = byId.get(id);
    if (!d) return;
    const dSide    = (d.simX ?? d.x) <= ballX ? 'L' : 'R';
    const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                   : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                   : dSide;
    const ownerStrong = role === 'RUSH' || role === 'UNDER'
                     || role === 'SAF_S'
                     || role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M'
                     || roleSide === strongSide;
    const dec = ownerStrong ? strongDecMap.get(id) : weakDecMap.get(id);
    if (dec) { dec._structRole = role; decMap.set(id, dec); }
  });
  return decMap;
}

// updateDefenseDecisions — called every tick in play phase and every draw() in editor.
// In play phase: calls preset.react() per defender → updates decision if non-null.
// In editor: rebuilds full initial decisions for preview.
function updateDefenseDecisions(snapshot, lrState, dt) {
  if (!snapshot) return;

  resolveActivePreset(snapshot);
  const preset = PRESET_REGISTRY[activePreset];

  // ── PLAY PHASE: react() per defender ─────────────────────────────
  if (mode === 'sim') {
    if (!preset) {
      // Manual mode — derive from assignment
      defensePlayers.forEach(d => {
        if (!d.decision) d.decision = assignmentToDecision(d.assignment);
        const asg = d.assignment;
        const dec = d.decision;
        if (asg.type === 'man' && asg.targetId != null) {
          dec.mode = 'follow'; dec.focusTargetId = asg.targetId;
          dec.focusLandmarkId = null; dec.trailPx = (asg.trailDistance || 0) * YARD_PX;
        } else if (asg.type === 'zone' && asg.landmarkId) {
          dec.mode = 'drop'; dec.focusTargetId = null;
          dec.focusLandmarkId = asg.landmarkId; dec.trailPx = 0;
        } else if (asg.type === 'rush') {
          dec.mode = 'rush'; dec.focusTargetId = null;
          dec.focusLandmarkId = null; dec.trailPx = 0;
        } else {
          dec.mode = 'idle'; dec.focusTargetId = null;
          dec.focusLandmarkId = null; dec.trailPx = 0;
        }
      });
      return;
    }

    // Preset mode: call react() for each defender
    // Empty formation: map #2w as primaryBackfield for RB-referencing presets
    const snap = patchEmptySnapshot(snapshot);
    const ballX = snap.ballX;
    const losY  = snap.losY ?? LOS_Y();
    const { strongKey, weakKey, isFullField } = resolveCallSheetSlots(snap);
    const strongPreset = PRESET_REGISTRY[strongKey];
    const weakPreset   = isFullField ? strongPreset : (PRESET_REGISTRY[weakKey] || null);
    const strongSide   = snap.coverageStrongSide || 'R';

    const roles = (simPhase === 'play' && frozenRoleMap) ? frozenRoleMap
               : classifyAllRoles(defensePlayers, ballX, losY, strongPreset.isOneHigh, snap.coverageStrongSide);

    // Freeze decisions after 2.0s — by then assignments are locked in
    const decisionsFrozen = playPhaseTime > 3.0;

    // Reset Fire Zone inter-defender calls each tick so stale calls don't persist
    if (activePreset === 'firezone' && !snap._fzCalls) snap._fzCalls = {};

    // Determine which preset owns a given role/side combination.
    // Strong owns: RUSH, UNDER, SS, all HOOKs, strong-side CB and Apex.
    // Weak owns:   FS, weak-side CB and Apex.
    function ownerPreset(role, d) {
      if (isFullField) return strongPreset;
      if (role === 'RUSH' || role === 'UNDER' || role === 'SAF_S') return strongPreset;
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') return strongPreset;
      if (role === 'SAF_W') return weakPreset;
      // CB and Apex — by physical/role side
      const dSide    = (d.simX ?? d.x) <= ballX ? 'L' : 'R';
      const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                     : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                     : dSide;
      return roleSide === strongSide ? strongPreset : weakPreset;
    }

    function applyDec(d, role) {
      if (!d.decision) d.decision = idleDec();
      if (decisionsFrozen) return;
      if (playPhaseTime < 0.4) return; // Snap-phase: no react() before 0.4s
      const prs = ownerPreset(role, d);
      if (!prs) return; // No preset for this role (e.g. backside = manual) — keep initial decision
      const newDec = prs.react(d, role, snap, lrState, dt);
      if (newDec !== null && newDec !== undefined) {
        d.decision.mode            = newDec.mode;
        d.decision.focusTargetId   = newDec.focusTargetId;
        d.decision.focusLandmarkId = newDec.focusLandmarkId;
        d.decision.trailPx         = newDec.trailPx;
        d.decision._structRole     = role;
      }
      // Safety zone shade toward vertical threat (all presets)
      if (d.decision.mode === 'drop') {
        const vtSide = findVerticalThreatSide();
        if (vtSide && vtSide !== 'both') {
          const baseLm = getLandmarkPos(d.decision.focusLandmarkId || 'DEEP_MIDDLE');
          const shadeX = vtSide === 'R'
            ? baseLm.x + 3 * YARD_PX
            : baseLm.x - 3 * YARD_PX;
          d.decision._shadedLandmarkPos = { x: shadeX, y: baseLm.y };
        } else {
          d.decision._shadedLandmarkPos = null;
        }
      }
    }

    // Ordered react passes — same order as before:
    // Pass 1: CBs set their Under/Smash calls first
    // Pass 2: Apexes read CB calls
    // Pass 3: Hooks read CB + Apex calls
    // Pass 4: Safeties + everyone else
    const cbRoles    = ['CB'];
    const apexRoles  = ['APEX-L', 'APEX-R'];
    const hookRoles  = ['HOOK-L', 'HOOK-R', 'HOOK-M'];

    defensePlayers.forEach(d => { const role = roles.get(d.id) ?? 'UNDER'; if (cbRoles.includes(role))   applyDec(d, role); });
    defensePlayers.forEach(d => { const role = roles.get(d.id) ?? 'UNDER'; if (apexRoles.includes(role)) applyDec(d, role); });
    defensePlayers.forEach(d => { const role = roles.get(d.id) ?? 'UNDER'; if (hookRoles.includes(role)) applyDec(d, role); });
    defensePlayers.forEach(d => {
      const role = roles.get(d.id) ?? 'UNDER';
      if (!cbRoles.includes(role) && !apexRoles.includes(role) && !hookRoles.includes(role)) applyDec(d, role);
    });
    return;
  }

  // ── EDITOR PREVIEW: full decide() for visual feedback ────────────
  if (!preset) {
    // Manual
    defensePlayers.forEach(d => {
      if (!d.decision) d.decision = assignmentToDecision(d.assignment);
    });
    return;
  }
  const decMap = getActivePresetDecisions(snapshot, defensePlayers);
  if (!decMap) return;
  defensePlayers.forEach(d => {
    const dec = decMap.get(d.id);
    if (dec) {
      if (!d.decision) d.decision = {};
      d.decision.mode            = dec.mode;
      d.decision.focusTargetId   = dec.focusTargetId;
      d.decision.focusLandmarkId = dec.focusLandmarkId;
      d.decision.trailPx         = dec.trailPx;
      d.decision._structRole     = dec._structRole;
    } else {
      // Not covered by any preset (e.g. backside = manual) — fall back to manual assignment
      d.decision = assignmentToDecision(d.assignment);
    }
  });
}

// refreshPresetMatchList — no-op placeholder (reserved for future UI)
function refreshPresetMatchList() {}

// buildPresetSnapshotKey — no-op placeholder (cache removed)
function buildPresetSnapshotKey(snapshot) { return ''; }


// Move defenders each tick during PlayPhase.
// Reads ONLY d.decision — d.assignment is never touched here.
// ALL modes (follow, drop, rush) check for blockers in path and stop in front.
function stepDefensePlayers(dt) {
  const BASE_SPEED = simSpeed * 80;  // matches offense baseSpeed exactly
  const BLOCK_STOP_DIST = DEF_PLAYER_RADIUS + 10; // px — stop this far from a blocker center

  // Zone-drop speed multipliers by positional role
  const ZONE_SPEED = { CB: 0.95, FS: 0.90, SS: 0.90, safety: 0.90, underneath: 0.85 };

  // Build blocker list once per tick (O-Line + skill players with block routes)
  const blockerPositions = [];
  olinePlayers().forEach(ol => {
    const od = olineData[ol.id];
    blockerPositions.push({
      x: od.simX !== undefined ? od.simX : ol.x,
      y: od.simY !== undefined ? od.simY : ol.y,
    });
  });
  players.forEach(p => {
    if (p.simBlockPoints && p.simBlockPoints.length > 0) {
      blockerPositions.push({ x: p.simX ?? p.x, y: p.simY ?? p.y });
    }
  });

  // Helper: given rusher position and raw target, return the (possibly blocker-capped) target
  // Uses swept-circle intersection to prevent tunneling at high speeds.
  function blockerCappedTarget(fromX, fromY, rawTx, rawTy) {
    const totalDist = Math.hypot(rawTx - fromX, rawTy - fromY);
    if (totalDist < 1) return { tx: rawTx, ty: rawTy };
    const dirX = (rawTx - fromX) / totalDist;
    const dirY = (rawTy - fromY) / totalDist;
    let capProj = Infinity;
    for (const b of blockerPositions) {
      const bx = b.x - fromX;
      const by = b.y - fromY;
      const proj = bx * dirX + by * dirY;
      if (proj < -BLOCK_STOP_DIST) continue; // clearly behind
      const perp = Math.abs(bx * dirY - by * dirX);
      if (perp < BLOCK_STOP_DIST) {
        const entryProj = proj - Math.sqrt(Math.max(0, BLOCK_STOP_DIST * BLOCK_STOP_DIST - perp * perp));
        if (entryProj < capProj && entryProj <= totalDist) capProj = Math.max(0, entryProj);
      }
    }
    if (capProj === Infinity) return { tx: rawTx, ty: rawTy };
    return { tx: fromX + dirX * capProj, ty: fromY + dirY * capProj };
  }

  // Post-move push-out: resolve any residual overlap after position is written.
  function pushOutBlockers(d) {
    let px = d.simX ?? d.x;
    let py = d.simY ?? d.y;
    let moved = false;
    for (const b of blockerPositions) {
      const dx = px - b.x;
      const dy = py - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < BLOCK_STOP_DIST && dist > 0.01) {
        const push = BLOCK_STOP_DIST - dist;
        px += (dx / dist) * push;
        py += (dy / dist) * push;
        moved = true;
      }
    }
    if (moved) { d.simX = px; d.simY = py; }
  }

  // ── Dual-Man Coverage: two defenders on same target ────────────────
  // If exactly 2 follow-mode (non-bracket) defenders share a focusTargetId,
  // assign one as 'ott' and one as 'utp' (vertical/stopped),
  // or one as 'otp' and one as 'utp' (non-vertical), based on who is
  // physically closer to each role's ideal position.
  // Roles are frozen in d._dualManRole once assigned.
  {
    const qb  = players.find(p => p.type === 'QB');
    const qbX = qb ? (qb.simX ?? qb.x) : ball.x;
    const qbY = qb ? (qb.simY ?? qb.y) : LOS_Y();

    // Build map: targetId → list of follow-mode (non-bracket) OR ott-mode defenders
    const dualMap = new Map();
    defensePlayers.forEach(d => {
      const dec = d.decision;
      if (!dec) return;
      const isFollow = dec.mode === 'follow' && !dec.leverage;
      const isOtt    = dec.mode === 'ott';
      if (!isFollow && !isOtt) return;
      if (dec.focusTargetId == null) return;
      if (!dualMap.has(dec.focusTargetId)) dualMap.set(dec.focusTargetId, []);
      dualMap.get(dec.focusTargetId).push(d);
    });

    dualMap.forEach((defs, targetId) => {
      if (defs.length !== 2) {
        // Not a dual-man situation — clear any stale role
        defs.forEach(d => { if (d._dualManTargetId === targetId) { d._dualManRole = null; d._dualManTargetId = null; } });
        return;
      }

      const rec = players.find(p => p.id === targetId);
      if (!rec) return;
      const recX = rec.simX ?? rec.x;
      const recY = rec.simY ?? rec.y;

      // Vector from receiver toward QB (normalized)
      const toQbX = qbX - recX;
      const toQbY = qbY - recY;
      const toQbDist = Math.hypot(toQbX, toQbY);
      const toQbNX = toQbDist > 0 ? toQbX / toQbDist : 0;
      const toQbNY = toQbDist > 0 ? toQbY / toQbDist : 1;

      // Is the receiver going vertical or stopped?
      const lr = liveReadStateById ? liveReadStateById[targetId] : null;
      const isVert = !lr || lr.moveType === 'stopped' || lr.moveType === 'vertical' || lr.isVerticalThreatNow;

      // Ideal positions for each role
      // UTP always: 1 yard toward QB from receiver
      const utpIdealX = recX + toQbNX * YARD_PX;
      const utpIdealY = recY + toQbNY * YARD_PX;
      // OTT (vertical): 2 yards above receiver (toward endzone)
      // OTP (non-vertical): 1 yard away from QB (mirrored UTP)
      const ottIdealX = isVert ? recX                   : recX - toQbNX * YARD_PX;
      const ottIdealY = isVert ? recY - 2 * YARD_PX     : recY - toQbNY * YARD_PX;

      const [dA, dB] = defs;

      // If one defender is already in ott-mode, they are always the top player
      const aIsOtt = dA.decision?.mode === 'ott';
      const bIsOtt = dB.decision?.mode === 'ott';

      // Assign roles only once per target — freeze WHO is top vs utp
      // but allow the top role to switch between 'ott' and 'otp' dynamically
      const alreadyAssigned = dA._dualManTargetId === targetId && dB._dualManTargetId === targetId;
      const topRole = isVert ? 'ott' : 'otp';
      if (!alreadyAssigned) {
        let aIsTopPlayer;
        if (aIsOtt && !bIsOtt) {
          aIsTopPlayer = true;
        } else if (bIsOtt && !aIsOtt) {
          aIsTopPlayer = false;
        } else {
          const aX = dA.simX ?? dA.x, aY = dA.simY ?? dA.y;
          const bX = dB.simX ?? dB.x, bY = dB.simY ?? dB.y;
          const aToOtt = Math.hypot(aX - ottIdealX, aY - ottIdealY);
          const bToOtt = Math.hypot(bX - ottIdealX, bY - ottIdealY);
          aIsTopPlayer = aToOtt <= bToOtt;
        }
        if (aIsTopPlayer) {
          dA._dualManIsTop = true;  dA._dualManTargetId = targetId;
          dB._dualManIsTop = false; dB._dualManTargetId = targetId;
        } else {
          dB._dualManIsTop = true;  dB._dualManTargetId = targetId;
          dA._dualManIsTop = false; dA._dualManTargetId = targetId;
        }
      }
      // Update role each tick based on current isVert
      dA._dualManRole = dA._dualManIsTop ? topRole : 'utp';
      dB._dualManRole = dB._dualManIsTop ? topRole : 'utp';
    });
  }

  defensePlayers.forEach(d => {
    if (d._blockLocked) return; // frozen by a blocker — skip
    const dec = d.decision;
    if (!dec || dec.mode === 'idle') return;

    const fromX = d.simX ?? d.x;
    const fromY = d.simY ?? d.y;

    // Track velocity for block anticipation (EMA smoothed)
    const EMA_D = 0.3;
    if (d._prevSimX !== undefined && dt > 0) {
      const rawVx = (fromX - d._prevSimX) / dt;
      const rawVy = (fromY - d._prevSimY) / dt;
      d._velX = d._velX !== undefined ? d._velX * (1 - EMA_D) + rawVx * EMA_D : rawVx;
      d._velY = d._velY !== undefined ? d._velY * (1 - EMA_D) + rawVy * EMA_D : rawVy;
    }
    d._prevSimX = fromX;
    d._prevSimY = fromY;

    // Determine effective speed: zone drops use role-based multipliers,
    // man coverage and rush use the editor speedMultiplier.
    const posRole  = classifyDefenderRole(d, ball.x, LOS_Y());
    const zoneMult = dec.mode === 'drop' ? (ZONE_SPEED[posRole] ?? 0.9) : (d.speedMultiplier || 1);
    const speed = BASE_SPEED * zoneMult;

    // Coverage role for technique adjustments (over-the-top offset etc.)
    const _snap    = offenseStructureSnapshot;
    const _ballX   = _snap ? _snap.ballX : ball.x;
    const _losY    = _snap ? (_snap.losY ?? LOS_Y()) : LOS_Y();
    const _covRoles = (simPhase === 'play' && frozenRoleMap) ? frozenRoleMap
      : classifyAllRoles(defensePlayers, _ballX, _losY,
        activePreset && PRESET_REGISTRY[activePreset]?.isOneHigh, _snap?.coverageStrongSide);
    const covRole  = _covRoles.get(d.id) || '';

    let rawTx, rawTy;

    if (dec.mode === 'follow') {
      const tgt = players.find(p => p.id === dec.focusTargetId);
      if (!tgt) return;
      const tgtX = tgt.simX ?? tgt.x;
      const tgtY = tgt.simY ?? tgt.y;
      const trailPx = dec.trailPx || 0;

      // ── Dual-man override ──────────────────────────────────────────
      if (d._dualManRole && d._dualManTargetId === dec.focusTargetId) {
        const qb  = players.find(p => p.type === 'QB');
        const qbX = qb ? (qb.simX ?? qb.x) : ball.x;
        const qbY = qb ? (qb.simY ?? qb.y) : LOS_Y();
        const tgtX = tgt.simX ?? tgt.x;
        const tgtY = tgt.simY ?? tgt.y;

        // Distanced-scaled prediction (same principle as run pursuit)
        const lrDM = liveReadStateById ? liveReadStateById[tgt.id] : null;
        const velX = lrDM?.vel?.x ?? 0;
        const velY = lrDM?.vel?.y ?? 0;
        const velSpd = Math.hypot(velX, velY);
        let predX = tgtX, predY = tgtY;
        if (velSpd > 5) {
          const xDist = Math.abs(fromX - tgtX);
          const yDist = Math.abs(fromY - tgtY);
          const lookaheadX = CB_S_LOOKAHEAD_SEC * Math.min(2.0, yDist / (2.25 * YARD_PX));
          const lookaheadY = CB_S_LOOKAHEAD_SEC * Math.min(2.0, xDist / (2.25 * YARD_PX));
          predX = tgtX + velX * lookaheadX;
          predY = tgtY + velY * lookaheadY;
        }

        const toQbX = qbX - predX, toQbY = qbY - predY;
        const toQbDist = Math.hypot(toQbX, toQbY);
        const pToQbNX = toQbDist > 0 ? toQbX / toQbDist : 0;
        const pToQbNY = toQbDist > 0 ? toQbY / toQbDist : 1;

        if (d._dualManRole === 'ott') {
          // Vertical OTT: 2 yards above predicted receiver (toward endzone)
          rawTx = predX;
          rawTy = predY - 2 * YARD_PX;
        } else if (d._dualManRole === 'utp') {
          // Under The Player: 1 yard toward QB from predicted receiver
          rawTx = predX + pToQbNX * YARD_PX;
          rawTy = predY + pToQbNY * YARD_PX;
        } else if (d._dualManRole === 'otp') {
          // Over The Player: mirror receiver movement vector, 2.5 yards
          // Fallback to QB-mirrored when receiver is stopped
          const hasVel = velSpd > 5;
          if (hasVel) {
            const vnx = velX / velSpd;
            const vny = velY / velSpd;
            const OTP_DIST = 2.5 * YARD_PX;
            // Blend: 70% receiver movement direction + 30% pure upfield
            const blendNX = vnx * 0.7;
            const blendNY = vny * 0.7 + (-1) * 0.3; // -1 = upfield
            const blendLen = Math.hypot(blendNX, blendNY) || 1;
            rawTx = predX + (blendNX / blendLen) * OTP_DIST;
            rawTy = predY + (blendNY / blendLen) * OTP_DIST;
            // Enforce minimum 1 yard upfield from receiver
            if (rawTy > predY - YARD_PX) rawTy = predY - YARD_PX;
          } else {
            rawTx = predX - pToQbNX * YARD_PX;
            rawTy = predY - pToQbNY * YARD_PX;
          }
        }

        // Never go behind LOS
        const losYDM = LOS_Y();
        if (rawTy > losYDM - YARD_PX) rawTy = losYDM - YARD_PX;

        // Skip normal follow logic — always step-based, never snap (target moves with receiver)
        const { tx: txDM, ty: tyDM } = blockerCappedTarget(fromX, fromY, rawTx, rawTy);
        const dxDM = txDM - fromX, dyDM = tyDM - fromY;
        const distDM2 = Math.hypot(dxDM, dyDM);
        const stepDM  = speed * dt;
        if (distDM2 > 0.1) {
          d.simX = fromX + (dxDM / distDM2) * Math.min(stepDM, distDM2);
          d.simY = fromY + (dyDM / distDM2) * Math.min(stepDM, distDM2);
        }
        pushOutBlockers(d);
        return;
      }

      // ── Intercept prediction ──────────────────────────────────────────
      // Use live read velocity to project where the receiver will be when
      // the defender arrives. Avoids always chasing the receiver's current spot.
      const lr = liveReadStateById ? liveReadStateById[tgt.id] : null;
      let interceptX = tgtX;
      let interceptY = tgtY;
      if (lr && lr.vel && (lr.vel.x !== 0 || lr.vel.y !== 0)) {
        const dist = Math.hypot(tgtX - fromX, tgtY - fromY);
        const defSpeed = BASE_SPEED * 1.0 * simSpeed;
        if (defSpeed > 0 && dist > 0) {
          const timeToReach = dist / defSpeed;
          const t = Math.min(timeToReach, 1.5);
          interceptX = tgtX + lr.vel.x * t;
          interceptY = tgtY + lr.vel.y * t;
        }
      }

      if (trailPx > 0) {
        const dx0 = interceptX - fromX;  const dy0 = interceptY - fromY;
        const d0  = Math.hypot(dx0, dy0);
        if (d0 > 0.1) {
          rawTx = interceptX - (dx0 / d0) * trailPx;
          rawTy = interceptY - (dy0 / d0) * trailPx;
        } else { rawTx = interceptX; rawTy = interceptY; }
      } else { rawTx = interceptX; rawTy = interceptY; }

      // Over-the-top technique — defender stays upfield of receiver when vertical.
      // Offset varies by coverage role: CB/FS/SS = 2 yds, APEX = 1.5 yds, HOOK = 1 yd.
      // Use current receiver Y (not predicted intercept) to keep the gap exact.
      const isVertical = lr && (lr.isVerticalThreatNow || lr.moveType === 'vertical');
      if (isVertical) {
        const ottOffset = (covRole === 'CB' || covRole === 'SAF_W' || covRole === 'SAF_S') ? 2 * YARD_PX
                        : (covRole === 'APEX-L' || covRole === 'APEX-R')             ? 1.5 * YARD_PX
                        : 1 * YARD_PX; // HOOK or anything else
        rawTx = tgtX;
        rawTy = tgtY - ottOffset;
      }

      // Cap target to LOS — never send defender behind LOS chasing a backfield player
      const losY = LOS_Y();
      if (rawTy > losY) { rawTy = losY; }

      // Man coverage depth floor — defender never comes within 2 yards of LOS
      const manDepthFloor = losY - 2 * YARD_PX;
      if (rawTy > manDepthFloor) { rawTy = manDepthFloor; }

      // Wall behavior (2-Read Apex): apply inside leverage offset toward center
      if (dec.behavior === 'wall') {
        const insideOffsetPx = 1.5 * YARD_PX;
        rawTx += (rawTx > ball.x) ? -insideOffsetPx : insideOffsetPx;
      }

    } else if (dec.mode === 'ott') {
      // ── Dual-man override for ott-mode defenders ──────────────────
      if (d._dualManRole && d._dualManTargetId === dec.focusTargetId) {
        const tgt2 = players.find(p => p.id === dec.focusTargetId);
        if (!tgt2) return;
        const tgtX2 = tgt2.simX ?? tgt2.x;
        const tgtY2 = tgt2.simY ?? tgt2.y;
        const qb2   = players.find(p => p.type === 'QB');
        const qbX2  = qb2 ? (qb2.simX ?? qb2.x) : ball.x;
        const qbY2  = qb2 ? (qb2.simY ?? qb2.y) : LOS_Y();
        // Distanced-scaled prediction
        const lrOtt2 = liveReadStateById ? liveReadStateById[dec.focusTargetId] : null;
        const vx2 = lrOtt2?.vel?.x ?? 0, vy2 = lrOtt2?.vel?.y ?? 0;
        const spd2 = Math.hypot(vx2, vy2);
        let predX2 = tgtX2, predY2 = tgtY2;
        if (spd2 > 5) {
          const xD2 = Math.abs(fromX - tgtX2), yD2 = Math.abs(fromY - tgtY2);
          predX2 = tgtX2 + vx2 * CB_S_LOOKAHEAD_SEC * Math.min(2.0, yD2 / (2.25 * YARD_PX));
          predY2 = tgtY2 + vy2 * CB_S_LOOKAHEAD_SEC * Math.min(2.0, xD2 / (2.25 * YARD_PX));
        }
        const toQbX2 = qbX2 - predX2, toQbY2 = qbY2 - predY2;
        const toQbD2 = Math.hypot(toQbX2, toQbY2);
        const nqbX2  = toQbD2 > 0 ? toQbX2 / toQbD2 : 0;
        const nqbY2  = toQbD2 > 0 ? toQbY2 / toQbD2 : 1;
        if (d._dualManRole === 'ott') {
          rawTx = predX2; rawTy = predY2 - 2 * YARD_PX;
        } else if (d._dualManRole === 'otp') {
          const hasVel2 = spd2 > 5;
          if (hasVel2) {
            const vnx2 = vx2 / spd2, vny2 = vy2 / spd2;
            const OTP_DIST2 = 2.5 * YARD_PX;
            const blendNX2 = vnx2 * 0.7;
            const blendNY2 = vny2 * 0.7 + (-1) * 0.3;
            const blendLen2 = Math.hypot(blendNX2, blendNY2) || 1;
            rawTx = predX2 + (blendNX2 / blendLen2) * OTP_DIST2;
            rawTy = predY2 + (blendNY2 / blendLen2) * OTP_DIST2;
            if (rawTy > predY2 - YARD_PX) rawTy = predY2 - YARD_PX;
          } else {
            rawTx = predX2 - nqbX2 * YARD_PX; rawTy = predY2 - nqbY2 * YARD_PX;
          }
        } else {
          rawTx = predX2 + nqbX2 * YARD_PX; rawTy = predY2 + nqbY2 * YARD_PX;
        }
        const losYO = LOS_Y();
        if (rawTy > losYO - YARD_PX) rawTy = losYO - YARD_PX;
      } else {
      // ── Normal Over-The-Top — stay 2 yards deeper than receiver ──
      const tgt = players.find(p => p.id === dec.focusTargetId);
      if (!tgt) return;
      const tgtX = tgt.simX ?? tgt.x;
      const tgtY = tgt.simY ?? tgt.y;
      rawTx = tgtX;
      rawTy = tgtY - dec.trailPx;
      if (rawTy > tgtY - dec.trailPx) rawTy = tgtY - dec.trailPx;
      }

    } else if (dec.mode === 'otp_shallow') {
      // ── OTP Shallow: man coverage but Y capped at 5 yards upfield of LOS ──
      const tgt = players.find(p => p.id === dec.focusTargetId);
      if (!tgt) return;
      const tgtX = tgt.simX ?? tgt.x;
      const tgtY = tgt.simY ?? tgt.y;
      const losYS = LOS_Y();
      const maxY = losYS - 5 * YARD_PX; // never deeper than 5 yards upfield
      rawTx = tgtX;
      rawTy = Math.min(tgtY - dec.trailPx, maxY);

    } else if (dec.mode === 'drop') {
      const lmId = dec.focusLandmarkId;
      const ZONE_REACT_RADIUS = 5 * YARD_PX;   // fallback only — prefer isInZoneBounds
      const ZONE_LEASH_RADIUS = 7 * YARD_PX;   // abandon receiver if they ran this far from the landmark
      const VERTICAL_THREAT_DEPTH = 8 * YARD_PX; // receiver is going vertical if route extends this far upfield

      // ── Zone bounds helper ───────────────────────────────────────────
      // Returns true if (rx, ry) is inside the named zone's rectangle.
      // Half-widths and half-heights match the visual zone rectangles defined in ZONE_SHAPES.
      const ZONE_HALF = {
        FLAT_L:      { hw: 5.4625*YARD_PX, hh: 6*YARD_PX },
        FLAT_R:      { hw: 5.4625*YARD_PX, hh: 6*YARD_PX },
        CURL_L:      { hw: 4.4625*YARD_PX, hh: 4*YARD_PX },
        CURL_R:      { hw: 4.4625*YARD_PX, hh: 4*YARD_PX },
        CURL_FLAT_L: { hw: 4.4625*YARD_PX, hh: 4*YARD_PX },
        CURL_FLAT_R: { hw: 4.4625*YARD_PX, hh: 4*YARD_PX },
        HOOK_L:      { hw: 3.825*YARD_PX,  hh: 4*YARD_PX },
        HOOK_R:      { hw: 3.825*YARD_PX,  hh: 4*YARD_PX },
        HOOK_MIDDLE: { hw: 6.665*YARD_PX,  hh: 4*YARD_PX },
        HOOK_CURL_L: { hw: 3.825*YARD_PX,  hh: 4*YARD_PX },
        HOOK_CURL_R: { hw: 3.825*YARD_PX,  hh: 4*YARD_PX },
        // Deep corner zones — used for candidate scan bounds
        DEEP_L:       { hw: 8.925*YARD_PX, hh: 5*YARD_PX },
        DEEP_R:       { hw: 8.925*YARD_PX, hh: 5*YARD_PX },
        DEEP_QRTR_L:  { hw: 6.625*YARD_PX, hh: 5*YARD_PX },
        DEEP_QRTR_ML: { hw: 6.625*YARD_PX, hh: 5*YARD_PX },
        DEEP_QRTR_MR: { hw: 6.625*YARD_PX, hh: 5*YARD_PX },
        DEEP_QRTR_R:  { hw: 6.625*YARD_PX, hh: 5*YARD_PX },
        DEEP_THIRD_L: { hw: 9*YARD_PX,     hh: 6*YARD_PX },
        DEEP_THIRD_R: { hw: 9*YARD_PX,     hh: 6*YARD_PX },
        DEEP_MIDDLE:  { hw: 8.65*YARD_PX,  hh: 5*YARD_PX },
        DEEP_FREE:    { hw: 26.5*YARD_PX,  hh: 5*YARD_PX },
        DEEP_HALF_L:  { hw: 13.25*YARD_PX, hh: 5*YARD_PX },
        DEEP_HALF_R:  { hw: 13.25*YARD_PX, hh: 5*YARD_PX },
        TAMPA_MIDDLE: { hw: 7*YARD_PX,     hh: 4*YARD_PX },
      };
      // ── Active deep zone checker — for vertical threat hierarchy ─────────
      // Returns a Set of landmark IDs currently being played as zone drops
      const activeDropZones = new Set(
        defensePlayers
          .filter(other => other.decision?.mode === 'drop' && other.decision.focusLandmarkId)
          .map(other => other.decision.focusLandmarkId)
      );
      // Returns true if any of the given landmark IDs are currently active
      function anyActive(...lmIds) { return lmIds.some(id => activeDropZones.has(id)); }

      // Vertical threat hierarchy: should this zone handle vertical threats?
      // Returns true if NO covering deep zone is currently active above this zone
      function needsVertRead(zoneId) {
        switch (zoneId) {
          case 'FLAT_L':       return !anyActive('DEEP_HALF_L', 'DEEP_FREE', 'DEEP_L');
          case 'CURL_L':       return !anyActive('DEEP_FREE') &&
                                      !(anyActive('DEEP_HALF_L') && anyActive('DEEP_MIDDLE'));
          case 'HOOK_CURL_L':  return !anyActive('DEEP_HALF_L', 'DEEP_FREE', 'DEEP_MIDDLE');
          case 'HOOK_L':       return !anyActive('DEEP_HALF_L', 'DEEP_FREE', 'DEEP_MIDDLE');
          case 'HOOK_MIDDLE':  return !anyActive('DEEP_MIDDLE', 'DEEP_FREE') &&
                                      !(anyActive('DEEP_HALF_L') && anyActive('DEEP_HALF_R'));
          case 'TAMPA_MIDDLE': return !anyActive('DEEP_MIDDLE', 'DEEP_FREE') &&
                                      !(anyActive('DEEP_HALF_L') && anyActive('DEEP_HALF_R'));
          case 'HOOK_R':       return !anyActive('DEEP_HALF_R', 'DEEP_FREE', 'DEEP_MIDDLE');
          case 'HOOK_CURL_R':  return !anyActive('DEEP_HALF_R', 'DEEP_FREE', 'DEEP_MIDDLE');
          case 'CURL_R':       return !anyActive('DEEP_FREE') &&
                                      !(anyActive('DEEP_HALF_R') && anyActive('DEEP_MIDDLE'));
          case 'FLAT_R':       return !anyActive('DEEP_HALF_R', 'DEEP_FREE', 'DEEP_R');
          case 'CURL_FLAT_L':  return !anyActive('DEEP_HALF_L', 'DEEP_FREE', 'DEEP_MIDDLE');
          case 'CURL_FLAT_R':  return !anyActive('DEEP_HALF_R', 'DEEP_FREE', 'DEEP_MIDDLE');
          default: return false;
        }
      }

      // ── Zone target selector: prefer uncovered, then highest (lowest Y = most upfield) ──
      function selectZoneTarget(candidates, coveredIds) {
        if (!candidates.length) return null;
        const uncovered = candidates.filter(c => !coveredIds.has(c.p.id));
        const pool = uncovered.length > 0 ? uncovered : candidates;
        // Among pool: pick receiver with lowest Y (most upfield = highest on field)
        return pool.reduce((best, c) => {
          if (!best) return c;
          const bestY = best.p.simY ?? best.p.y;
          const cY    = c.p.simY ?? c.p.y;
          return cY < bestY ? c : best;
        }, null);
      }

      function isInZoneBounds(zoneId, rx, ry, lmPos) {
        const z = ZONE_HALF[zoneId];
        if (!z) return false;
        const lp = lmPos || getLandmarkPos(zoneId);
        const isDeep = zoneId === 'DEEP_HALF_L' || zoneId === 'DEEP_HALF_R'
                    || zoneId === 'DEEP_MIDDLE'  || zoneId === 'DEEP_FREE'
                    || zoneId === 'DEEP_L'       || zoneId === 'DEEP_R'
                    || zoneId === 'DEEP_THIRD_L' || zoneId === 'DEEP_THIRD_R'
                    || zoneId === 'DEEP_QRTR_L'  || zoneId === 'DEEP_QRTR_ML'
                    || zoneId === 'DEEP_QRTR_MR' || zoneId === 'DEEP_QRTR_R';
        if (isDeep) {
          const losY = LOS_Y ? LOS_Y() : lp.y + 10 * YARD_PX;
          // Y: from 10 yards upfield of LOS to ENDZONE_Y (top of field)
          if (ry > losY - 10 * YARD_PX) return false;
          if (ry < ENDZONE_Y) return false;
          // X: unchanged — based on landmark half-width
          return Math.abs(rx - lp.x) <= z.hw;
        }
        return Math.abs(rx - lp.x) <= z.hw && Math.abs(ry - lp.y) <= z.hh;
      }

      // ── CURL_FLAT two-phase logic ────────────────────────────────────
      // Phase 1: drop to the curl point. Phase 2: slide to the flat point.
      const isCurlFlat = lmId === 'CURL_FLAT_L' || lmId === 'CURL_FLAT_R';
      const isLeft     = lmId === 'CURL_FLAT_L' || lmId === 'HOOK_L' || lmId === 'HOOK_CURL_L';

      // ── HOOK_L / HOOK_R two-phase logic ──────────────────────────────
      // Phase 1: drop to the hook point. Phase 2: slide toward the curl point.
      const isHookSide   = lmId === 'HOOK_L' || lmId === 'HOOK_R';
      const isHookMiddle = lmId === 'HOOK_MIDDLE';

      // ── HOOK_CURL_L / HOOK_CURL_R two-phase logic ────────────────────
      // Used by SS in Cover 3 (one-high).
      // Phase 1: drop to the hook point. Phase 2: slide outward to the curl point.
      const isHookCurl = lmId === 'HOOK_CURL_L' || lmId === 'HOOK_CURL_R';

      if (isCurlFlat) {
        if (!d.simZonePhase) d.simZonePhase = 1;
        const curlLm = getLandmarkPos(isLeft ? 'CURL_L' : 'CURL_R');
        const flatLm = getLandmarkPos(isLeft ? 'FLAT_L' : 'FLAT_R');

        if (d.simZonePhase === 1) {
          // Move to curl point
          const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
          if (distToCurl <= DEF_ARRIVE_THR) {
            d.simZonePhase = 2; // curl reached — now slide to flat
          }
          rawTx = curlLm.x; rawTy = curlLm.y;
        } else {
          // Phase 2 — slide toward flat, but still react to nearby receivers
          // Prefer uncovered receivers (not already in man coverage by another defender)
          const coveredIdsCF = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          const flatLmPos = getLandmarkPos(isLeft ? 'FLAT_L' : 'FLAT_R');
          const candidatesCF = players.reduce((acc, p) => {
            const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
            if (!isInZoneBounds(isLeft ? 'FLAT_L' : 'FLAT_R', rx, ry, flatLmPos)) return acc;
            acc.push({ p, dist: Math.hypot(rx - fromX, ry - fromY) });
            return acc;
          }, []);
          const uncoveredCF = candidatesCF.filter(c => !coveredIdsCF.has(c.p.id));
          const nearbyR2 = (uncoveredCF.length > 0 ? uncoveredCF : candidatesCF)
            .reduce((best, c) => (!best || c.dist < best.dist) ? c : best, null);
          if (nearbyR2) {
            const recX2 = nearbyR2.p.simX ?? nearbyR2.p.x;
            const recY2 = nearbyR2.p.simY ?? nearbyR2.p.y;
            if (isInZoneBounds(isLeft ? 'FLAT_L' : 'FLAT_R', recX2, recY2, flatLm)) {
              rawTx = recX2; rawTy = recY2;
            } else {
              rawTx = flatLm.x; rawTy = flatLm.y;
            }
          } else {
            const distToFlat = Math.hypot(fromX - flatLm.x, fromY - flatLm.y);
            if (distToFlat <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
            rawTx = flatLm.x; rawTy = flatLm.y;
          }
        }
      } else if (isHookMiddle) {
        // Hook Middle: drop toward hook middle, reacting to receivers in corridor at all times
        if (!d.simZonePhase) d.simZonePhase = 1;
        const hookLmPos = getLandmarkPos('HOOK_MIDDLE');
        if (d.simZonePhase === 1) {
          const distToHook = Math.hypot(fromX - hookLmPos.x, fromY - hookLmPos.y);
          if (distToHook <= DEF_ARRIVE_THR) d.simZonePhase = 2;
        }
        // React to receivers in the middle corridor at all times (both phases)
        // Prefer uncovered receivers (not already in man coverage by another defender)
        const coveredIdsHM = new Set(
          defensePlayers
            .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
            .map(other => other.decision.focusTargetId)
        );
        const hmNeedsVert = needsVertRead('HOOK_MIDDLE');
        const midCandidates = players.reduce((acc, p) => {
          const recX = p.simX ?? p.x;
          const recY = p.simY ?? p.y;
          if (recY >= LOS_Y()) return acc;
          const inZone = isInZoneBounds('HOOK_MIDDLE', recX, recY, hookLmPos);
          if (!inZone && hmNeedsVert) {
            const lrP = liveReadStateById?.[p.id];
            if (!lrP?.isVerticalThreatNow) return acc;
            if (Math.abs(recX - hookLmPos.x) > (ZONE_HALF['HOOK_MIDDLE']?.hw ?? 0)) return acc;
          } else if (!inZone) {
            return acc;
          }
          acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
          return acc;
        }, []);
        const uncoveredMid = midCandidates.filter(c => !coveredIdsHM.has(c.p.id));
        const nearbyMid = selectZoneTarget(midCandidates, coveredIdsHM);
        if (nearbyMid) {
          rawTx = nearbyMid.p.simX ?? nearbyMid.p.x;
          rawTy = nearbyMid.p.simY ?? nearbyMid.p.y;
        } else {
          rawTx = hookLmPos.x; rawTy = hookLmPos.y;
        }
      } else if (isHookSide) {
        // Hook L/R: phase 1 = drop to hook, phase 2 = slide toward curl
        if (!d.simZonePhase) d.simZonePhase = 1;
        const hookLm = getLandmarkPos(lmId);                              // HOOK_L or HOOK_R
        const curlLm = getLandmarkPos(lmId === 'HOOK_L' ? 'CURL_L' : 'CURL_R');

        if (d.simZonePhase === 1) {
          const distToHook = Math.hypot(fromX - hookLm.x, fromY - hookLm.y);
          if (distToHook <= DEF_ARRIVE_THR) d.simZonePhase = 2;
          rawTx = hookLm.x; rawTy = hookLm.y;
        } else {
          // Phase 2 — slide toward curl, react to nearby receivers
          // Prefer uncovered receivers (not already in man coverage by another defender)
          const coveredIdsHS = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          const hookSideLmPos = getLandmarkPos(lmId);
          const curlSideId = lmId === 'HOOK_L' ? 'CURL_L' : 'CURL_R';
          const hookNeedsVert = needsVertRead(lmId);
          const candidatesHS = players.reduce((acc, p) => {
            const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
            const inHook = isInZoneBounds(lmId, rx, ry, hookSideLmPos);
            const inCurl = isInZoneBounds(curlSideId, rx, ry);
            if (!inHook && !inCurl) {
              if (!hookNeedsVert) return acc;
              const lrP = liveReadStateById?.[p.id];
              if (!lrP?.isVerticalThreatNow) return acc;
              if (Math.abs(rx - hookSideLmPos.x) > (ZONE_HALF[lmId]?.hw ?? 0)) return acc;
            }
            acc.push({ p, dist: Math.hypot(rx - fromX, ry - fromY) });
            return acc;
          }, []);
          const uncoveredHS = candidatesHS.filter(c => !coveredIdsHS.has(c.p.id));
          const nearbyRH = selectZoneTarget(candidatesHS, coveredIdsHS);
          if (nearbyRH) {
            rawTx = nearbyRH.p.simX ?? nearbyRH.p.x;
            rawTy = nearbyRH.p.simY ?? nearbyRH.p.y;
          } else {
            const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
            if (distToCurl <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
            rawTx = curlLm.x; rawTy = curlLm.y;
          }
        }
      } else if (isHookCurl) {
        // Hook/Curl: phase 1 = drop to hook point, phase 2 = slide outward to curl point.
        // Used by SS in Cover 3 (one-high).
        if (!d.simZonePhase) d.simZonePhase = 1;
        const hookLm = getLandmarkPos(lmId === 'HOOK_CURL_L' ? 'HOOK_L' : 'HOOK_R');
        const curlLm = getLandmarkPos(lmId === 'HOOK_CURL_L' ? 'CURL_L' : 'CURL_R');

        if (d.simZonePhase === 1) {
          const distToHook = Math.hypot(fromX - hookLm.x, fromY - hookLm.y);
          if (distToHook <= DEF_ARRIVE_THR) d.simZonePhase = 2;
          rawTx = hookLm.x; rawTy = hookLm.y;
        } else {
          // Phase 2 — slide outward to curl, react to nearby receivers
          // Prefer uncovered receivers (not already in man coverage by another defender)
          const coveredIdsHC = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          const hookCurlLmPos = getLandmarkPos(lmId);
          const curlHCId = lmId === 'HOOK_CURL_L' ? 'CURL_L' : 'CURL_R';
          const hcNeedsVert = needsVertRead(lmId);
          const candidatesHC = players.reduce((acc, p) => {
            const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
            const inHC = isInZoneBounds(lmId, rx, ry, hookCurlLmPos);
            const inCurl = isInZoneBounds(curlHCId, rx, ry);
            if (!inHC && !inCurl) {
              if (!hcNeedsVert) return acc;
              const lrP = liveReadStateById?.[p.id];
              if (!lrP?.isVerticalThreatNow) return acc;
              if (Math.abs(rx - hookCurlLmPos.x) > (ZONE_HALF[lmId]?.hw ?? 0)) return acc;
            }
            acc.push({ p, dist: Math.hypot(rx - fromX, ry - fromY) });
            return acc;
          }, []);
          const uncoveredHC = candidatesHC.filter(c => !coveredIdsHC.has(c.p.id));
          const nearbyRHC = selectZoneTarget(candidatesHC, coveredIdsHC);
          if (nearbyRHC) {
            rawTx = nearbyRHC.p.simX ?? nearbyRHC.p.x;
            rawTy = nearbyRHC.p.simY ?? nearbyRHC.p.y;
          } else {
            const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
            if (distToCurl <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
            rawTx = curlLm.x; rawTy = curlLm.y;
          }
        }
      } else {
        // ── All other drop zones ─────────────────────────────────────────
        // Phase 3.4: use shaded landmark position if safety behavior override is active
        const lp = (d.decision._shadedLandmarkPos) || getLandmarkPos(lmId);
        const isDeepZone   = lmId === 'DEEP_L' || lmId === 'DEEP_R' || lmId === 'DEEP_MIDDLE' || lmId === 'DEEP_FREE'
                           || lmId === 'DEEP_HALF_L' || lmId === 'DEEP_HALF_R'
                           || lmId === 'DEEP_QRTR_L' || lmId === 'DEEP_QRTR_ML' || lmId === 'DEEP_QRTR_MR' || lmId === 'DEEP_QRTR_R'
                           || lmId === 'DEEP_THIRD_L' || lmId === 'DEEP_THIRD_R'
                           || lmId === 'TAMPA_MIDDLE';
        // DEEP_HALF is handled separately — it owns half the field from the true center,
        // not the deep-corner logic (which uses ball.x as divider and ZONE_REACT_RADIUS gate).
        const isDeepHalf   = lmId === 'DEEP_HALF_L' || lmId === 'DEEP_HALF_R';
        const isDeepCorner = (lmId === 'DEEP_L' || lmId === 'DEEP_R'
                           || lmId === 'DEEP_QRTR_L' || lmId === 'DEEP_QRTR_ML' || lmId === 'DEEP_QRTR_MR' || lmId === 'DEEP_QRTR_R'
                           || lmId === 'DEEP_THIRD_L' || lmId === 'DEEP_THIRD_R')
                           && !isDeepHalf;
        const deepSideX    = lmId === 'DEEP_L' ? FIELD_LEFT : FIELD_RIGHT; // sideline direction (DEEP_L/R only)

        // All deep zones: walk to zone area first before reacting to receivers.
        // "In zone" = within the zone ellipse.
        const DEEP_ZONE_RX = isDeepHalf ? 11 * YARD_PX
                           : lmId === 'DEEP_QRTR_L' || lmId === 'DEEP_QRTR_ML' || lmId === 'DEEP_QRTR_MR' || lmId === 'DEEP_QRTR_R' ? 5.5 * YARD_PX
                           : lmId === 'DEEP_MIDDLE' || lmId === 'DEEP_FREE' ? 8 * YARD_PX
                           : 7 * YARD_PX;  // DEEP_L / DEEP_R
        const DEEP_ZONE_RY = 6 * YARD_PX;
        if (isDeepZone) {
          const dxLm = fromX - lp.x;
          const dyLm = fromY - lp.y;
          const inZoneEllipse = (dxLm * dxLm) / (DEEP_ZONE_RX * DEEP_ZONE_RX) +
                                (dyLm * dyLm) / (DEEP_ZONE_RY * DEEP_ZONE_RY) <= 1;
          if (inZoneEllipse) d.simDeepArrived = true;
        }

        // Field center (true midpoint, independent of ball position)
        const FIELD_CENTER_X = FIELD_W / 2;

        let nearbyReceiver;
        if (isDeepZone && !d.simDeepArrived) {
          // Don't react until in zone
          nearbyReceiver = null;

        } else if (isDeepHalf) {
          // ── DEEP_HALF: scan within visual zone bounds ──
          const halfLmPos = lp;
          const halfCandidates = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x;
            const recY = p.simY ?? p.y;
            if (recY >= LOS_Y()) return acc;
            if ((LOS_Y() - recY) < 8 * YARD_PX) return acc;
            if (!isInZoneBounds(lmId, recX, recY, halfLmPos)) return acc;
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          const coveredIds = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );

          // Prioritise verticals first (most dangerous), then closest
          // Within each group: uncovered > covered
          const halfVerticals = halfCandidates.filter(c => {
            const lr = liveReadStateById && liveReadStateById[c.p.id];
            return lr && lr.isVerticalThreatNow;
          });
          const uncoveredVerticals = halfVerticals.filter(c => !coveredIds.has(c.p.id));
          const vertPool = uncoveredVerticals.length > 0 ? uncoveredVerticals : halfVerticals;
          if (vertPool.length > 0) {
            nearbyReceiver = vertPool.reduce((best, c) => {
              const lrC    = liveReadStateById[c.p.id];
              const lrBest = liveReadStateById[best.p.id];
              return (lrC.dirAngleDeg < lrBest.dirAngleDeg) ? c : best;
            });
          } else {
            nearbyReceiver = selectZoneTarget(halfCandidates, coveredIds);
          }

        } else if (lmId === 'DEEP_THIRD_L' || lmId === 'DEEP_THIRD_R') {
          // ── DEEP_THIRD: scan within visual zone bounds ──
          const thirdLmPos = lp;
          const candidatesThird = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x;
            const recY = p.simY ?? p.y;
            if (recY >= LOS_Y()) return acc;
            if ((LOS_Y() - recY) < 8 * YARD_PX) return acc;
            if (!isInZoneBounds(lmId, recX, recY, thirdLmPos)) return acc;
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          const verticalsThird = candidatesThird.filter(c => {
            const lr = liveReadStateById && liveReadStateById[c.p.id];
            return lr && lr.isVerticalThreatNow;
          });
          const coveredIdsThird = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          if (verticalsThird.length > 0) {
            const uncoveredVerts = verticalsThird.filter(c => !coveredIdsThird.has(c.p.id));
            const vertPool = uncoveredVerts.length > 0 ? uncoveredVerts : verticalsThird;
            nearbyReceiver = vertPool.reduce((a, b) => a.dist < b.dist ? a : b);
          } else {
            nearbyReceiver = selectZoneTarget(candidatesThird, coveredIdsThird);
          }

        } else if (isDeepCorner) {
          // ── DEEP_L / DEEP_R / DEEP_QRTR: scan within visual zone bounds ──
          const dcLmPos = lp;
          const candidatesDC = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x;
            const recY = p.simY ?? p.y;
            if (recY >= LOS_Y()) return acc;
            if ((LOS_Y() - recY) < 8 * YARD_PX) return acc;
            if (!isInZoneBounds(lmId, recX, recY, dcLmPos)) return acc;
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          const verticalsDC = candidatesDC.filter(c => {
            const lr = liveReadStateById && liveReadStateById[c.p.id];
            return lr && lr.isVerticalThreatNow;
          });
          const coveredIdsDC = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          if (verticalsDC.length > 0) {
            const uncoveredVerts = verticalsDC.filter(c => !coveredIdsDC.has(c.p.id));
            const vertPool = uncoveredVerts.length > 0 ? uncoveredVerts : verticalsDC;
            nearbyReceiver = vertPool.reduce((best, c) => {
              const lrC    = liveReadStateById[c.p.id];
              const lrBest = liveReadStateById[best.p.id];
              return (lrC.dirAngleDeg < lrBest.dirAngleDeg) ? c : best;
            });
          } else {
            nearbyReceiver = selectZoneTarget(candidatesDC, coveredIdsDC);
          }

        } else if (lmId === 'FLAT_L' || lmId === 'FLAT_R') {
          // FLAT zones: scan receivers on own side within ZONE_REACT_RADIUS
          // Prefer uncovered receivers (not already in man coverage by another defender)
          const isLeftFlat = lmId === 'FLAT_L';
          const coveredIdsFL = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          const flatLmPosFL = getLandmarkPos(lmId);
          const flatNeedsVert = needsVertRead(lmId);
          const candidatesFL = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x;
            const recY = p.simY ?? p.y;
            if (recY >= LOS_Y()) return acc;
            const inZone = isInZoneBounds(lmId, recX, recY, flatLmPosFL);
            // Also include vertical threats passing through if no deep zone covers
            if (!inZone && flatNeedsVert) {
              const lrP = liveReadStateById?.[p.id];
              if (!lrP?.isVerticalThreatNow) return acc;
              // Must be laterally within zone width
              if (Math.abs(recX - flatLmPosFL.x) > ZONE_HALF[lmId]?.hw) return acc;
            } else if (!inZone) {
              return acc;
            }
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          const uncoveredFL = candidatesFL.filter(c => !coveredIdsFL.has(c.p.id));
          nearbyReceiver = selectZoneTarget(candidatesFL, coveredIdsFL);

        } else if (lmId === 'CURL_L' || lmId === 'CURL_R') {
          // CURL zones: scan receivers within zone bounds, uncovered preferred
          const coveredIdsCURL = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          const curlLmPos = getLandmarkPos(lmId);
          const curlNeedsVert = needsVertRead(lmId);
          const candidatesCURL = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x, recY = p.simY ?? p.y;
            if (recY >= LOS_Y()) return acc;
            const inZone = isInZoneBounds(lmId, recX, recY, curlLmPos);
            if (!inZone && curlNeedsVert) {
              const lrP = liveReadStateById?.[p.id];
              if (!lrP?.isVerticalThreatNow) return acc;
              if (Math.abs(recX - curlLmPos.x) > ZONE_HALF[lmId]?.hw) return acc;
            } else if (!inZone) {
              return acc;
            }
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          const uncoveredCURL = candidatesCURL.filter(c => !coveredIdsCURL.has(c.p.id));
          nearbyReceiver = selectZoneTarget(candidatesCURL, coveredIdsCURL);

        } else {
          // DEEP_MIDDLE / DEEP_FREE / TAMPA_MIDDLE: scan within visual zone bounds.
          const midLmPos = lp;
          const _losY = LOS_Y();
          const midNeedsVert = needsVertRead(lmId);
          const candidates = players.reduce((acc, p) => {
            const recX = p.simX ?? p.x;
            const recY = p.simY ?? p.y;
            if (recY >= _losY) return acc;
            if (isDeepZone && (_losY - recY) < 8 * YARD_PX) return acc;
            const inZone = isInZoneBounds(lmId, recX, recY, midLmPos);
            if (!inZone && midNeedsVert) {
              const lrP = liveReadStateById?.[p.id];
              if (!lrP?.isVerticalThreatNow) return acc;
              if (Math.abs(recX - midLmPos.x) > (ZONE_HALF[lmId]?.hw ?? 0)) return acc;
            } else if (!inZone) {
              return acc;
            }
            acc.push({ p, dist: Math.hypot(recX - fromX, recY - fromY) });
            return acc;
          }, []);
          // Build covered set — deprioritise already-manned receivers
          const coveredIdsMid = new Set(
            defensePlayers
              .filter(other => other.id !== d.id && other.decision?.mode === 'follow' && other.decision.focusTargetId != null)
              .map(other => other.decision.focusTargetId)
          );
          // Prioritise verticals (most dangerous), then closest — uncovered before covered
          const verticals = candidates.filter(c => {
            const lr = liveReadStateById && liveReadStateById[c.p.id];
            return lr && lr.isVerticalThreatNow;
          });
          const uncoveredVerts = verticals.filter(c => !coveredIdsMid.has(c.p.id));
          const vertPool = uncoveredVerts.length > 0 ? uncoveredVerts : verticals;
          if (vertPool.length > 0) {
            nearbyReceiver = vertPool.reduce((best, c) => {
              const lrC    = liveReadStateById[c.p.id];
              const lrBest = liveReadStateById[best.p.id];
              return (lrC.dirAngleDeg < lrBest.dirAngleDeg) ? c : best;
            });
          } else {
            nearbyReceiver = selectZoneTarget(candidates, coveredIdsMid);
          }
        }

        if (nearbyReceiver) {
          const rec  = nearbyReceiver.p;
          const recX = rec.simX ?? rec.x;
          const recY = rec.simY ?? rec.y;

          if (isDeepZone) {
            // Check live read for vertical threat
            const lr = liveReadStateById && liveReadStateById[rec.id];
            const isVerticalLive = lr && lr.isVerticalThreatNow;

            let tgtX, tgtY;

            // Check if receiver is running vertically (within 10° of straight upfield).
            const pts    = rec.simRoutePoints ?? [];
            const wpIdx  = rec.simWpIdx ?? 0;
            const nextWp = pts[wpIdx] ?? null;
            const recMovDx = nextWp ? nextWp.x - recX : 0;
            const recMovDy = nextWp ? nextWp.y - recY : 0;
            const isRunningVertical = nextWp &&
              recMovDy < 0 &&
              Math.abs(recMovDx) < Math.abs(recMovDy) * 0.176;

            if (isVerticalLive) {
              // Vertical threat confirmed by live read: follow and anticipate next waypoint.
              // Stay 1 yard deeper (OTT)
              tgtX = nextWp ? nextWp.x : recX;
              tgtY = (nextWp ? nextWp.y : recY) - YARD_PX;

            } else if (isDeepHalf) {
              // ── DEEP_HALF tracking ───────────────────────────────────────
              const isLeftHalf2 = lmId === 'DEEP_HALF_L';
              const recCrossedCenter = isLeftHalf2 ? recX > FIELD_CENTER_X : recX < FIELD_CENTER_X;
              if (recCrossedCenter) {
                tgtX = lp.x; tgtY = lp.y;
              } else if (isRunningVertical) {
                const ZONE_PULL_START_H = 3 * YARD_PX;
                const ZONE_PULL_FULL_H  = 9 * YARD_PX;
                const defDistFromLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
                const zonePull = Math.min(1, Math.max(0,
                  (defDistFromLandmark - ZONE_PULL_START_H) / (ZONE_PULL_FULL_H - ZONE_PULL_START_H)
                ));
                tgtX = recX + (lp.x - recX) * zonePull;
                tgtY = recY + (lp.y - recY) * zonePull - YARD_PX;
              } else {
                // Crossing / out route in our half: track with OTT offset
                tgtX = recX; tgtY = recY - YARD_PX;
              }

            } else if (isDeepCorner) {
              if (isRunningVertical) {
                const ZONE_PULL_START = 3 * YARD_PX;
                const ZONE_PULL_FULL  = 8 * YARD_PX;
                const defDistFromLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
                const zonePull = Math.min(1, Math.max(0,
                  (defDistFromLandmark - ZONE_PULL_START) / (ZONE_PULL_FULL - ZONE_PULL_START)
                ));
                tgtX = recX + (lp.x - recX) * zonePull;
                tgtY = recY + (lp.y - recY) * zonePull - YARD_PX;
              } else {
                tgtX = recX; tgtY = recY - YARD_PX;
              }
            } else {
              // DEEP_MIDDLE / DEEP_FREE / TAMPA_MIDDLE
              const MIDDLE_CORRIDOR_L2 = LEFT_HASH  - HASH_OFFSET * 0.5;
              const MIDDLE_CORRIDOR_R2 = RIGHT_HASH + HASH_OFFSET * 0.5;
              const recExitedCorridor  = recX < MIDDLE_CORRIDOR_L2 || recX > MIDDLE_CORRIDOR_R2;
              if (recExitedCorridor) {
                tgtX = lp.x; tgtY = lp.y;
              } else if (isRunningVertical) {
                const ZONE_PULL_START_DM = 3 * YARD_PX;
                const ZONE_PULL_FULL_DM  = 8 * YARD_PX;
                const defDistFromLandmarkDM = Math.hypot(fromX - lp.x, fromY - lp.y);
                const zonePullDM = Math.min(1, Math.max(0,
                  (defDistFromLandmarkDM - ZONE_PULL_START_DM) / (ZONE_PULL_FULL_DM - ZONE_PULL_START_DM)
                ));
                tgtX = recX + (lp.x - recX) * zonePullDM;
                tgtY = recY + (lp.y - recY) * zonePullDM - YARD_PX;
              } else {
                tgtX = recX; tgtY = recY - YARD_PX;
              }
            }

            // Enforce 1-yard minimum separation from receiver (never step inside them)
            const MIN_SEP = YARD_PX * 1;
            const sepDx   = tgtX - recX;
            const sepDy   = tgtY - recY;
            const sepDist = Math.hypot(sepDx, sepDy);
            if (sepDist < MIN_SEP) {
              // Target is the receiver's position — back off by MIN_SEP along the
              // direction from defender to receiver
              const approachDx = recX - fromX;
              const approachDy = recY - fromY;
              const approachDist = Math.hypot(approachDx, approachDy);
              if (approachDist > MIN_SEP) {
                const nx = approachDx / approachDist;
                const ny = approachDy / approachDist;
                tgtX = recX - nx * MIN_SEP;
                tgtY = recY - ny * MIN_SEP;
              } else {
                // Already within 1 yard — hold position
                return;
              }
            }

            rawTx = tgtX; rawTy = tgtY;

          } else {
            // Non-deep zone — leash + vertical-only zone pull
            const recDistFromLandmark = Math.hypot(recX - lp.x, recY - lp.y);
            if (recDistFromLandmark > ZONE_LEASH_RADIUS) {
              const distToLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
              if (distToLandmark <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
              rawTx = lp.x; rawTy = lp.y;
            } else {
              // Only apply zone pull when receiver is running vertically (within 10° of upfield)
              const ptsS    = rec.simRoutePoints ?? [];
              const wpIdxS  = rec.simWpIdx ?? 0;
              const nextWpS = ptsS[wpIdxS] ?? null;
              const movDxS  = nextWpS ? nextWpS.x - recX : 0;
              const movDyS  = nextWpS ? nextWpS.y - recY : 0;
              const isVertS = nextWpS && movDyS < 0 && Math.abs(movDxS) < Math.abs(movDyS) * 0.176;

              if (isVertS) {
                // Zone pull: blend toward landmark based on how far defender is from home
                const ZONE_PULL_START = 2 * YARD_PX;
                const ZONE_PULL_FULL  = 6 * YARD_PX;
                const defDistFromLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
                const zonePull = Math.min(1, Math.max(0,
                  (defDistFromLandmark - ZONE_PULL_START) / (ZONE_PULL_FULL - ZONE_PULL_START)
                ));
                rawTx = recX + (lp.x - recX) * zonePull;
                rawTy = recY + (lp.y - recY) * zonePull;
              } else {
                // Horizontal / crossing: follow receiver directly
                rawTx = recX; rawTy = recY;
              }
            }
          }
        } else {
          // No receiver — move to landmark (or hold if arrived)
          const distToLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
          if (distToLandmark <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
          rawTx = lp.x; rawTy = lp.y;
        }
      }

    } else if (dec.mode === 'rush') {
      const qb = players.find(p => p.type === 'QB');
      const qbX = qb ? (qb.simX ?? qb.x) : ball.x;
      const qbY = qb ? (qb.simY ?? qb.y) : ball.y;

      // Find this rusher's gap — prefer runAssignment, fall back to assignment
      const rushAsg = (d.runAssignment && d.runAssignment.type === 'gap') ? d.runAssignment
                    : (d.assignment && d.assignment.type === 'gap')       ? d.assignment
                    : null;

      if (rushAsg && rushAsg.gapId) {
        const gapX  = ball.x + (GAP_OFFSETS_PX[rushAsg.gapId] ?? 0);
        const gapY  = LOS_Y();
        // Defense is upfield (lower Y). Past the gap = reached or crossed LOS (fromY >= gapY - 4)
        const pastGap = fromY >= gapY - 4;
        if (!pastGap) {
          rawTx = gapX;
          rawTy = gapY;
        } else {
          rawTx = qbX;
          rawTy = qbY;
        }
      } else {
        rawTx = qbX;
        rawTy = qbY;
      }
    }

    // Apply blocker cap to every mode
    const { tx, ty } = blockerCappedTarget(fromX, fromY, rawTx, rawTy);

    // Move toward (tx, ty)
    const dx   = tx - fromX;
    const dy   = ty - fromY;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;

    if (dist <= step + DEF_ARRIVE_THR) {
      d.simX = tx; d.simY = ty;
    } else {
      d.simX = fromX + (dx / dist) * step;
      d.simY = fromY + (dy / dist) * step;
    }

    // Post-move push-out: eliminate any residual overlap that slipped through
    pushOutBlockers(d);
  });
}

// ── Pre-snap Defense Slide (X-only, shift/settle/motion phases) ──────
// Only the defender covering the CURRENTLY MOVING offense player tracks X.
// If the moving player changes, the previous slider returns to their origX.
// Y is always locked to the pre-snap editor position.
function stepDefensePresnapSlide(dt) {
  if (activePreset === 'manual' || !offenseStructureSnapshot) return;
  if (defensePlayers.length === 0) return;

  // Identify the offense player currently moving pre-snap
  let movingPlayerId = null;
  if (simPhase === 'preplay') {
    movingPlayerId = motionOwnerId;
  } else if (simPhase === 'shift' || simPhase === 'settle') {
    const shifter = players.find(p => p.simShiftPoints && p.simShiftPoints.length > 0);
    movingPlayerId = shifter ? shifter.id : null;
  }

  // Use preview decisions to find which defender is assigned to the moving player
  const previewDec = activePreset !== 'manual'
    ? getActivePresetDecisions(offenseStructureSnapshot, defensePlayers)
    : null;
  if (!previewDec) return;

  // Use simSpeed-based speed so slider affects preplay equally
  const slideSpeed = simSpeed * 80 * DEF_SLIDE_SPEED_FACTOR;

  defensePlayers.forEach(d => {
    const dec = previewDec.get(d.id);
    // Y locked for all defenders
    d.simY = d.y;
    // Is this defender the one assigned to the currently moving player?
    const isTracker = dec && dec.mode === 'follow' && dec.focusTargetId === movingPlayerId && movingPlayerId !== null;

    if (isTracker) {
      // Slide X toward the moving player's current X
      const movingPlayer = players.find(p => p.id === movingPlayerId);
      if (!movingPlayer) return;
      const movingX = movingPlayer.simX ?? movingPlayer.x;
      const curX    = d.simX ?? d.x;
      const delta   = movingX - curX;
      const step    = slideSpeed * dt;
      d.simX = curX + Math.sign(delta) * Math.min(Math.abs(delta), step);
    } else if (!reactiveFormationActive) {
      // Return to original editor X position — skip if reactive formation is handling this
      const curX  = d.simX ?? d.x;
      const delta = d.x - curX;
      if (Math.abs(delta) > 0.5) {
        const step = slideSpeed * dt;
        d.simX = curX + Math.sign(delta) * Math.min(Math.abs(delta), step);
      } else {
        d.simX = d.x;
      }
    }
  });
}

// Restore defender sim positions to editor positions on stopSim.
function resetDefendersAfterSim() {
  defensePlayers.forEach(d => {
    // Restore original role (undo any SAM/WILL swaps from reactive motion)
    if (_simOriginalRoles.has(d.id)) d.role = _simOriginalRoles.get(d.id);
    d.simX = d.x;
    d.simY = d.y;
    d.simZoneDone    = false;
    d.simZonePhase   = 1;
    d.simDeepArrived = false;
    d._blockLocked   = false;
    d._velX          = undefined;
    d._velY          = undefined;
    if (d.decision) {
      d.decision.behavior           = undefined;
      d.decision.notes              = '';
      d.decision._shadedLandmarkPos = null;
    }
  });
}

// ─────────────────────────────────────────────
// PLAY TYPE — Pass / Run / Play Action
// ─────────────────────────────────────────────
let playType     = 'pass';   // 'pass' | 'run'
let runCarrierId = null;     // id of the designated ball carrier (for run/pa)

// PA sub-phase: 'fake' (run action) → 'pass' (QB drops and throws)
let paSubPhase   = 'fake';

// ── Run handoff state ─────────────────────────────────────────────────
// After snap: carrier moves to QB, handoff happens (HANDOFF_DURATION),
// then carrier runs their route. ballOwner tracks who has the ball.
const HANDOFF_DURATION   = 0.1;   // seconds for the exchange animation
const CB_S_LOOKAHEAD_SEC = 0.35;  // seconds to predict carrier position ahead (predictive pursuit)
let runHandoffState = 'idle'; // 'idle' | 'approaching' | 'handoff' | 'carrying'
let runHandoffTimer = 0;      // counts up during 'handoff' sub-state
let ballOwner       = null;   // player id who currently has the ball (null = QB / snap)
let _tackleTimerActive = false;  // true after a tackle occurs
let _tackleTimer       = 0;      // countdown (sim seconds) until auto-pause after tackle

// ── Offense Formation Presets ─────────────────────────────────────────
const OFF_FORMATIONS = {
  'gun-ace': {
    label: 'Gun Ace Leo',
    players: [
      { type: 'QB', dxYd: 0,   dyYd: 5 },
      { type: 'RB', dxYd: -1.5,  dyYd: 6.5 },
      { type: 'WR', side: 'L', dyYd: 2 },
      { type: 'WR', side: 'R', dyYd: 2 },
      { type: 'TE', dxYd: -4.7,  dyYd: 1 },
      { type: 'TE', dxYd:  4.7,  dyYd: 1 },
    ]
  },

  'gun-twins-ringo': {
    label: 'Gun Spread Ringo',
    players: [
      { type: 'QB', dxYd:  0,     dyYd: 5   },
      { type: 'RB', dxYd:  1.5,   dyYd: 6.5 },
      { type: 'WR', side: 'L',    dyYd: 1   },
      { type: 'WR', side: 'R',    dyYd: 1   },
      { type: 'WR', midSlot: 'L', dyYd: 2   },
      { type: 'WR', midSlot: 'R', dyYd: 2   },
    ]
  },

  // Gun West LT Trey Leo
  // QB 5 yds deep. RB 2 yds left and behind QB.
  // TE both sides: 1 yd outside tackle, 1 yd off LOS.
  // 2 WRs on right: outer (clamped side) + slot (midSlot).
  'gun-west-lt-trey-leo': {
    label: 'Gun West LT Trey Leo',
    players: [
      { type: 'QB', dxYd:  0,      dyYd: 5 },
      { type: 'RB', dxYd: -2,      dyYd: 5 },
      { type: 'TE', dxYd: -4.7,    dyYd: 1 },
      { type: 'TE', dxYd:  4.7,    dyYd: 1 },
      { type: 'WR', side: 'R',     dyYd: 2 },
      { type: 'WR', midSlot: 'R',  dyYd: 2 },
    ]
  },

  // I Form East Out
  'i-form-east-out': {
    label: 'Under I East Out',
    players: [
      { type: 'QB', dxYd:  0,      dyYd: 2.5 },
      { type: 'FB', dxYd:  0,      dyYd: 4 },
      { type: 'RB', dxYd:  0,      dyYd: 6 },
      { type: 'TE', dxYd: -4.7,    dyYd: 1 },
      { type: 'WR', side: 'L',     dyYd: 2 },
      { type: 'WR', dxOLplus: 8,   dyYd: 1 },
    ]
  },

  // Under Strong L East Slot
  'under-strong-l-east-slot': {
    label: 'Under Strong L East Slot',
    players: [
      { type: 'QB', dxYd:  0,         dyYd: 2.5 },
      { type: 'FB', dxYd: -2,         dyYd: 4 },
      { type: 'RB', dxYd:  0,         dyYd: 6 },
      { type: 'TE', dxYd: -4.7,       dyYd: 1 },
      { type: 'WR', sideInsetL: 5,    dyYd: 2 },
      { type: 'WR', dxOLplus: 8,      dyYd: 1 },
    ]
  },

  // Gun RT Near Bunch Leo
  'gun-rt-near-bunch-leo': {
    label: 'Gun RT Near Bunch Leo',
    players: [
      { type: 'QB', dxYd:  0,        dyYd: 5 },
      { type: 'RB', dxYd: -2,        dyYd: 5 },
      { type: 'WR', dxOLminus: 8,    dyYd: 0.8 },
      { type: 'WR', dxOLplus: -0.5,  dyYd: 2 },
      { type: 'WR', dxOLplus: 0.8,   dyYd: 1 },
      { type: 'WR', dxOLplus: 2.1,   dyYd: 2 },
    ]
  },
  // QB 1.5 yds deep, RB 6 yds deep, TE 1.5 yds outside left tackle at 1 yd LOS.
  // 3 WRs right: at 25%, 50%, 75% of RT→sideline. 25%+75% at 2 yds, 50% at 1 yd.
  'back-east-rt-trips-ringo': {
    label: 'Under East RT Trips',
    players: [
      { type: 'QB', dxYd:  0,       dyYd: 2.5 },
      { type: 'RB', dxYd:  0,       dyYd: 6 },
      { type: 'TE', dxYd: -4.7,     dyYd: 1 },
      { type: 'WR', dxRTpct: 0.25,  dyYd: 2 },
      { type: 'WR', dxRTpct: 0.50,  dyYd: 1 },
      { type: 'WR', dxRTpct: 0.75,  dyYd: 2 },
    ]
  }
};

function flipPlayHorizontal() {
  const cx = ball.x; // mirror axis = ball X
  const flipX = x => 2 * cx - x;
  const flipPts = pts => (pts || []).map(p => ({ x: flipX(p.x), y: p.y }));

  // Percentage-based flip for a single X coordinate:
  // Compute how far the point is from ball toward its sideline (as a ratio),
  // then place it at the same ratio on the opposite side.
  const flipXPercent = x => {
    if (x >= cx) {
      // Right of ball: ratio = (x - cx) / (FIELD_RIGHT - cx)
      const ratio = (x - cx) / (FIELD_RIGHT - cx);
      // Mirror to left: cx - ratio * (cx - FIELD_LEFT)
      return cx - ratio * (cx - FIELD_LEFT);
    } else {
      // Left of ball: ratio = (cx - x) / (cx - FIELD_LEFT)
      const ratio = (cx - x) / (cx - FIELD_LEFT);
      // Mirror to right: cx + ratio * (FIELD_RIGHT - cx)
      return cx + ratio * (FIELD_RIGHT - cx);
    }
  };
  const flipPtsPercent = pts => (pts || []).map(p => ({ x: flipXPercent(p.x), y: p.y }));

  // Flip all skill players:
  // - Within 7 yards of ball: simple mirror flip
  // - Beyond 7 yards: percentage-based flip to stay in bounds
  players.forEach(p => {
    const distYds   = Math.abs(p.x - cx) / YARD_PX;
    const flipPtsFn = distYds > 7 ? flipPtsPercent : flipPts;
    p.x             = distYds > 7 ? flipXPercent(p.x)   : flipX(p.x);
    p.origX         = distYds > 7 ? flipXPercent(p.origX) : flipX(p.origX);
    p.routePoints   = flipPtsFn(p.routePoints);
    p.motionPoints  = flipPtsFn(p.motionPoints);
    p.shiftPoints   = flipPtsFn(p.shiftPoints);
    p.blockPoints   = flipPtsFn(p.blockPoints);
  });

  // Flip O-Line block points and swap between mirrored pairs
  // First flip all block points geometrically
  olinePlayers().forEach(ol => {
    const d = olineData[ol.id];
    if (d) {
      d.blockPoints = flipPts(d.blockPoints);
    }
  });
  // Then swap block points between mirrored pairs (LT↔RT, LG↔RG, C stays)
  const swapPairs = [['olt','ort'], ['olg','org']];
  swapPairs.forEach(([idA, idB]) => {
    const dA = olineData[idA];
    const dB = olineData[idB];
    if (dA && dB) {
      const tmp = dA.blockPoints;
      dA.blockPoints = dB.blockPoints;
      dB.blockPoints = tmp;
    }
  });

  draw();
  showToast('⇆ Play flipped');
}

function applyOffFormationPreset() {
  const sel = document.getElementById('offFormationSelect');
  const key = sel ? sel.value : '';
  if (!key) { showToast('\u26a0 Select a formation first'); return; }
  const formation = OFF_FORMATIONS[key];
  if (!formation) return;

  const los = LOS_Y();
  const cx  = ball.x;

  // Remove all existing skill players (keep OLine intact)
  players = players.filter(p => p.isOline);
  selectedPlayerId = null;
  motionOwnerId = null;

  formation.players.forEach(p => {
    let px, py;

    // Helper: clamped outer WR — prefer 5 yds from sideline,
    // but never closer than 10 yds from ball (field-width independent).
    // Also never further than 19.5 yds from ball.
    const idealL        = FIELD_LEFT  + 5 * YARD_PX;   // 5 yds from left sideline
    const idealR        = FIELD_RIGHT - 5 * YARD_PX;   // 5 yds from right sideline
    const clampedOuterL = Math.max(cx - 19.5 * YARD_PX, Math.min(cx - 10 * YARD_PX, idealL));  // between 10 and 19.5 yds left
    const clampedOuterR = Math.min(cx + 19.5 * YARD_PX, Math.max(cx + 10 * YARD_PX, idealR));  // between 10 and 19.5 yds right
    if (p.side === 'L') {
      px = clampedOuterL;
    } else if (p.side === 'R') {
      px = clampedOuterR;
    } else if (p.sideInsetL !== undefined) {
      // Outer left WR position + X yards toward center
      px = clampedOuterL + p.sideInsetL * YARD_PX;
    } else if (p.sideInsetR !== undefined) {
      // Outer right WR position - X yards toward center
      px = clampedOuterR - p.sideInsetR * YARD_PX;
    } else if (p.midSlot === 'L') {
      // Midpoint between clamped outer WR and left tackle
      const tackleL = cx - 3 * OLINE_SPACING;
      px = (clampedOuterL + tackleL) / 2;
    } else if (p.midSlot === 'R') {
      // Midpoint between right tackle and clamped outer WR
      const tackleR = cx + 3 * OLINE_SPACING;
      px = (tackleR + clampedOuterR) / 2;
    } else if (p.dxOLplus !== undefined) {
      // X yards outside the right tackle
      px = cx + 3 * OLINE_SPACING + p.dxOLplus * YARD_PX;
    } else if (p.dxOLminus !== undefined) {
      // X yards outside the left tackle (to the left)
      px = cx - 3 * OLINE_SPACING - p.dxOLminus * YARD_PX;
    } else if (p.dxRTpct !== undefined) {
      // Percentage along line from right tackle to right sideline
      const tackleR = cx + 3 * OLINE_SPACING;
      px = tackleR + p.dxRTpct * (FIELD_RIGHT - 14 - tackleR);
    } else if (p.dxOL !== undefined) {
      px = cx + p.dxOL * OLINE_SPACING;
    } else {
      px = cx + p.dxYd * YARD_PX;
    }

    py = los + p.dyYd * YARD_PX;
    px = Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14, px));

    const np = makePlayer(p.type, px, py);
    np.origX = px; np.origY = py;
    players.push(np);
  });

  nextId = Math.max(...players.filter(p=>p.id).map(p => p.id), 0) + 1;
  refreshPlayerList();
  refreshSkillCounter();
  updateMotionBadge();
  refreshRunCarrierSelect();
  draw();
  showToast('\u2713 ' + formation.label + ' \u2014 ' + formation.players.length + ' players placed', 'info');
}

function setPlayType(type) {
  playType = type;
  ['pass','run'].forEach(t => {
    const btn = document.getElementById('pt' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!btn) return;
    btn.className = 'play-type-btn';
    if (t === type) btn.classList.add('active-' + t);
  });
  const wrap = document.getElementById('runCarrierWrap');
  if (wrap) wrap.style.display = type === 'run' ? '' : 'none';
  refreshRunCarrierSelect();
  // Update defense assignment dropdown labels based on play type
  updateDefAssignTypeForPlayType();
  // Trigger live run-fit recompute when switching to run mode
  if (mode === 'editor') recomputeRunFits();
  draw();
}

function refreshRunCarrierSelect() {
  const sel = document.getElementById('runCarrierSelect');
  if (!sel) return;
  const eligible = players.filter(p => ['QB','RB','FB','TE','WR'].includes(p.type));
  sel.innerHTML = '<option value="">— select carrier —</option>' +
    eligible.map(p => `<option value="${p.id}"${p.id === runCarrierId ? ' selected' : ''}>${p.label} #${p.id} (${p.type})</option>`).join('');
  if (runCarrierId && !eligible.find(p => p.id === runCarrierId)) runCarrierId = null;
}

function onRunCarrierChange() {
  const sel = document.getElementById('runCarrierSelect');
  runCarrierId = sel ? (parseInt(sel.value) || null) : null;
  draw();
}

// Show/hide run-specific options in defense assignment panel
function updateDefAssignTypeForPlayType() {
  // nothing to hide/show beyond what's already in the HTML
}

function onDefRunFitTypeChange() {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d) return;
  const newType = document.getElementById('defRunFitType').value;
  if (newType === 'none') {
    d.runAssignment = { type: 'none' };
    d._manualRunAssignment = false;
  } else {
    d.runAssignment = { type: newType };
    if (newType === 'gap') {
      d.runAssignment.gapId    = d.x < ball.x ? 'A_gap_L' : 'A_gap_R';
      d.runAssignment.fillType = 'fill';
    }
    d._manualRunAssignment = true;
  }
  const gapCtrl = document.getElementById('defGapControls');
  if (gapCtrl) gapCtrl.style.display = newType === 'gap' ? '' : 'none';
  recomputeRunFits();
  refreshRunFitsSummary();
  draw();
}

function onDefRunFitSave() {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d || !d.runAssignment) return;
  if (d.runAssignment.type === 'gap') {
    const gapEl  = document.getElementById('defGapSelect');
    const fillEl = document.getElementById('defGapFillType');
    if (gapEl)  d.runAssignment.gapId    = gapEl.value;
    if (fillEl) d.runAssignment.fillType = fillEl.value;
  }
  recomputeRunFits();
  refreshRunFitsSummary();
  draw();
}

// ── Gap landmark positions — anchored to actual O-Line geometry ──────
// OLINE_SPACING = 32px between linemen. C at ball.x.
//   LG/RG = ball.x ± 32   (1× OLINE_SPACING)
//   LT/RT = ball.x ± 64   (2× OLINE_SPACING)
//
// Gap centers (midpoints between linemen):
//   A gap: between C  and G  → ± (OLINE_SPACING/2)     = ±16px
//   B gap: between G  and T  → ± (OLINE_SPACING*1.5)   = ±48px
//   C gap: just outside T    → ± (OLINE_SPACING*2 + OLINE_SPACING*0.6) = ±83px
//   D gap: 1 extra yard outside C → C_gap ± YARD_PX     = ±103px
// A/B/C gaps are fixed (O-Line geometry). D/E/F are generated dynamically.
const GAP_BASE_OFFSETS_PX = {
  'A_gap_L': -16,
  'A_gap_R':  16,
  'B_gap_L': -48,
  'B_gap_R':  48,
  'C_gap_L': -83,
  'C_gap_R':  83,
};

// GAP_OFFSETS_PX is rebuilt each frame by computeDynamicGaps().
// Starts with A/B/C only — D/E/F added when offense alignment warrants them.
let GAP_OFFSETS_PX = { ...GAP_BASE_OFFSETS_PX };

// Gap labels for rendering (rebuilt by computeDynamicGaps)
let _gapLabels = {
  'A_gap_L':'A','A_gap_R':'A',
  'B_gap_L':'B','B_gap_R':'B',
  'C_gap_L':'C','C_gap_R':'C',
};

// Gap priority inside-out per side (rebuilt by computeDynamicGaps)
let GAP_PRIORITY_L = ['A_gap_L','B_gap_L','C_gap_L'];
let GAP_PRIORITY_R = ['A_gap_R','B_gap_R','C_gap_R'];

/**
 * computeDynamicGaps()
 * Rebuilds GAP_OFFSETS_PX from the current offense alignment.
 * D/E/F gaps are created only when an offensive skill player sits
 * within 2 horizontal yards (X-axis only, Y/depth ignored) outside
 * the last existing gap on that side. The chain breaks as soon as
 * no player is found within range.
 */
function computeDynamicGaps() {
  const ballX  = ball.x;
  const TWO_YD = 2 * YARD_PX;
  const gaps   = { ...GAP_BASE_OFFSETS_PX };

  // Collect X positions of all non-OLine, non-QB offensive players.
  // Always use editor position (p.x), never simX — so D/E/F gaps stay
  // frozen at their snap positions even when blockers move during sim.
  const offX = players
    .filter(p => !p.isOline && p.type !== 'QB')
    .map(p => p.x);

  const GAP_SEQ = ['D','E','F'];
  const C_ABS   = 83; // absolute px offset of C gap

  // Left side: extend outward (more negative offsets)
  let lastOffsetL = -C_ABS;
  for (const letter of GAP_SEQ) {
    const gapId    = `${letter}_gap_L`;
    const outerEdge = ballX + lastOffsetL;       // position of last gap
    const searchMin = outerEdge - TWO_YD;        // 2 yd further left
    // Find the closest player strictly left of lastGap and within 2 yd
    const candidates = offX.filter(x => x < outerEdge - 0.5 && x >= searchMin);
    if (candidates.length === 0) break;
    const closest   = candidates.reduce((a, b) =>
      Math.abs(a - outerEdge) < Math.abs(b - outerEdge) ? a : b);
    const newOffset = closest - ballX - YARD_PX * 0.5; // 0.5 yd outside player
    gaps[gapId]     = newOffset;
    lastOffsetL     = newOffset;
  }

  // Right side: extend outward (more positive offsets)
  let lastOffsetR = C_ABS;
  for (const letter of GAP_SEQ) {
    const gapId    = `${letter}_gap_R`;
    const outerEdge = ballX + lastOffsetR;
    const searchMax = outerEdge + TWO_YD;
    const candidates = offX.filter(x => x > outerEdge + 0.5 && x <= searchMax);
    if (candidates.length === 0) break;
    const closest   = candidates.reduce((a, b) =>
      Math.abs(a - outerEdge) < Math.abs(b - outerEdge) ? a : b);
    const newOffset = closest - ballX + YARD_PX * 0.5;
    gaps[gapId]     = newOffset;
    lastOffsetR     = newOffset;
  }

  GAP_OFFSETS_PX = gaps;

  // Rebuild labels and priority arrays
  _gapLabels = {};
  Object.keys(gaps).forEach(id => { _gapLabels[id] = id.split('_gap_')[0]; });

  const ORDER = ['A','B','C','D','E','F'];
  GAP_PRIORITY_L = ORDER.map(g => `${g}_gap_L`).filter(id => gaps[id] !== undefined);
  GAP_PRIORITY_R = ORDER.map(g => `${g}_gap_R`).filter(id => gaps[id] !== undefined);
}

function getGapPos(gapId) {
  const offsetPx = GAP_OFFSETS_PX[gapId] ?? 0;
  // Gap target is AT the LOS — defenders attack through the line
  return { x: ball.x + offsetPx, y: LOS_Y() };
}


// ── Get all current blocker positions for collision checking ──────────
// Used to stop defenders from running through blockers on run plays.
function getRunBlockerPositions() {
  const blockers = [];
  // O-Line blockers (always present on run plays)
  olinePlayers().forEach(ol => {
    const d = olineData[ol.id];
    blockers.push({
      x: (d.simX !== undefined) ? d.simX : ol.x,
      y: (d.simY !== undefined) ? d.simY : ol.y,
    });
  });
  // Skill players with block assignments (FBs, TEs blocking)
  players.forEach(p => {
    if (p.id === runCarrierId) return; // carrier doesn't block himself
    const bpts = p.simBlockPoints && p.simBlockPoints.length > 0 ? p.simBlockPoints : p.blockPoints;
    if (bpts && bpts.length > 0) {
      blockers.push({ x: p.simX ?? p.x, y: p.simY ?? p.y });
    }
  });
  return blockers;
}

// ── Blocker collision cap for run plays ───────────────────────────────
// Returns adjusted (tx,ty) that stops the defender in front of any blocker
// in their direct path. Uses swept-circle check to prevent tunneling.
function runBlockerCap(fromX, fromY, rawTx, rawTy, blockers) {
  const BLOCK_STOP_DIST = 14; // px — stop this far from blocker center
  const totalDist = Math.hypot(rawTx - fromX, rawTy - fromY);
  if (totalDist < 1) return { tx: rawTx, ty: rawTy };
  const dirX = (rawTx - fromX) / totalDist;
  const dirY = (rawTy - fromY) / totalDist;
  let capProj = Infinity;
  for (const b of blockers) {
    const bx = b.x - fromX;
    const by = b.y - fromY;
    const proj = bx * dirX + by * dirY;
    if (proj < -BLOCK_STOP_DIST) continue; // clearly behind
    // Use swept-circle: closest approach along the movement segment
    const perp = Math.abs(bx * dirY - by * dirX);
    if (perp < BLOCK_STOP_DIST) {
      // Would intersect — cap at the point where edge of stop zone is reached
      const entryProj = proj - Math.sqrt(Math.max(0, BLOCK_STOP_DIST * BLOCK_STOP_DIST - perp * perp));
      if (entryProj < capProj && entryProj <= totalDist) capProj = Math.max(0, entryProj);
    }
  }
  if (capProj === Infinity) return { tx: rawTx, ty: rawTy };
  return {
    tx: fromX + dirX * capProj,
    ty: fromY + dirY * capProj,
  };
}

// ── Post-move push-out: resolve overlap after position is updated ──────
// Call AFTER simX/simY has been set. Pushes the defender out of any blocker
// they are overlapping with so positions never compound across frames.
// This eliminates phasing even at high speeds / large dt.
function resolveBlockerOverlap(d, blockers) {
  const BLOCK_STOP_DIST = 14;
  let px = d.simX ?? d.x;
  let py = d.simY ?? d.y;
  let moved = false;
  for (const b of blockers) {
    const dx = px - b.x;
    const dy = py - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < BLOCK_STOP_DIST && dist > 0.01) {
      // Push out to the stop surface
      const push = BLOCK_STOP_DIST - dist;
      px += (dx / dist) * push;
      py += (dy / dist) * push;
      moved = true;
    }
  }
  if (moved) { d.simX = px; d.simY = py; }
}

// ── Draw run path of ball carrier (green thick line) ─────────────────
function drawRunPath(p) {
  if (!p || p.simRoutePoints === undefined) return;
  const pts = (mode === 'sim') ? (p.simRoutePoints || []) : (p.routePoints || []);
  if (!pts || pts.length === 0) return;

  const sx = (mode === 'sim' && p.simX !== undefined) ? p.simX : p.x;
  const sy = (mode === 'sim' && p.simY !== undefined) ? p.simY : p.y;

  ctx.save();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth   = 3.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.setLineDash([]);
  ctx.shadowColor = 'rgba(34,197,94,0.6)';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  pts.forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Arrow heads
  const all = [{x:sx,y:sy}, ...pts];
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i], b = all[i+1];
    drawArrow(ctx, (a.x+b.x)/2, (a.y+b.y)/2, b.x, b.y, '#22c55e');
  }
  // Waypoint dots
  pts.forEach((wp, i) => {
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 5, 0, Math.PI*2);
    ctx.fillStyle = i === pts.length-1 ? '#22c55e' : '#86efac';
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // "BALL CARRIER" label on the player
  const lx = sx + 18;
  const ly = sy - 18;
  ctx.font          = 'bold 10px Barlow Condensed';
  ctx.textAlign     = 'left';
  ctx.lineWidth     = 2.5;
  ctx.strokeStyle   = 'rgba(0,0,0,0.9)';
  ctx.strokeText('CARRIER', lx, ly);
  ctx.fillStyle     = '#4ade80';
  ctx.fillText('CARRIER', lx, ly);
  ctx.restore();
}

// ── Draw gap markers (for run plays in editor) ────────────────────
function drawGapMarkers() {
  if (playType === 'pass') return;
  computeDynamicGaps();
  const losY = LOS_Y();
  ctx.save();
  ctx.font         = 'bold 9px Barlow Condensed';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';

  Object.entries(GAP_OFFSETS_PX).forEach(([gapId, offPx]) => {
    const gx      = ball.x + offPx;
    const label   = _gapLabels[gapId] || gapId.split('_gap_')[0];
    const dynamic = ['D','E','F'].includes(label);
    ctx.strokeStyle = dynamic ? 'rgba(251,146,60,0.4)' : 'rgba(34,197,94,0.25)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(gx, losY - 8); ctx.lineTo(gx, losY + 6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = dynamic ? 'rgba(251,146,60,0.65)' : 'rgba(34,197,94,0.45)';
    ctx.fillText(label, gx, losY - 9);
  });
  ctx.restore();
}

// ── Run fit: draw gap assignment lines for defenders ─────────────
function drawRunFitLines() {
  if (playType === 'pass') return;
  defensePlayers.forEach(d => {
    const asg = d.assignment;
    if (!asg || !['gap','contain','spill'].includes(asg.type)) return;
    const px = mode === 'sim' ? (d.simX ?? d.x) : d.x;
    const py = mode === 'sim' ? (d.simY ?? d.y) : d.y;

    let tx, ty;
    if (asg.type === 'gap' && asg.gapId) {
      const gp = getGapPos(asg.gapId);
      tx = gp.x; ty = gp.y;
    } else if (asg.type === 'contain') {
      const side = px <= ball.x ? -1 : 1;
      tx = ball.x + side * (YARD_PX * 15);
      ty = LOS_Y();
    } else if (asg.type === 'spill') {
      const side = px <= ball.x ? -1 : 1;
      tx = ball.x + side * OLINE_SPACING * 2;
      ty = LOS_Y();
    } else return;

    const color = asg.type === 'gap' ? '#4ade80' : asg.type === 'contain' ? '#facc15' : '#f97316';
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI*2);
    ctx.fillStyle = color + '88';
    ctx.fill();
    let label;
    if (asg.type === 'gap') label = (asg.gapId || '').replace('_gap_', ' ').replace('_',' ');
    else label = asg.type.toUpperCase();
    ctx.font = 'bold 9px Barlow Condensed';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tx + 7, ty);
    ctx.restore();
  });
}

// ── PA: draw fake-run path dimly ──────────────────────────────────
function drawPAFakePath(p) {
  if (!p) return;
  const pts = (mode === 'sim') ? (p.simBlockPoints || []) : (p.blockPoints || []);
  if (!pts || pts.length === 0) return;
  const sx = (mode === 'sim') ? (p.simX ?? p.x) : p.x;
  const sy = (mode === 'sim') ? (p.simY ?? p.y) : p.y;

  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth   = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(sx, sy);
  pts.forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const lx = sx + 18, ly = sy - 18;
  ctx.font = 'bold 10px Barlow Condensed';
  ctx.textAlign = 'left';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText('FAKE', lx, ly);
  ctx.fillStyle = '#fb923c';
  ctx.fillText('FAKE', lx, ly);
  ctx.restore();
}

// ── Sim: step the ball carrier (run/PA fake) ──────────────────────
function stepRunCarrier(dt, baseSpeed) {
  if (!runCarrierId) return;
  const carrier = players.find(p => p.id === runCarrierId);
  if (!carrier || carrier.simDone) return;
  const spd = getMoveSpeed(carrier, baseSpeed) * 1.05; // RB slightly faster
  if (carrier.simRoutePoints && carrier.simRoutePoints.length > 0) {
    if (stepPlayer(carrier, carrier.simRoutePoints, dt, spd)) carrier.simDone = true;
  }
}

// ── Sim: step defenders with run fit logic ────────────────────────
function stepDefenseRunFit(dt) {
  const BASE_SPEED = simSpeed * 80;
  const carrier = players.find(p => p.id === runCarrierId);
  const blockers = getRunBlockerPositions();

  // ── 0.3s pass-read delay ───────────────────────────────────────
  // First 0.3s defenders react like pass coverage, then commit to run fits.
  const RUN_COMMIT_DELAY = 0.3;
  if (playPhaseTime < RUN_COMMIT_DELAY) {
    updateDefenseDecisions(offenseStructureSnapshot, liveReadStateById, dt);
    stepDefensePlayers(dt);
    return;
  }

  // ── Speed multipliers ──────────────────────────────────────────
  const DL_SPEED = { DT: 0.50, NT: 0.50, DE: 0.70 };
  const LB_SPEED = 0.90;
  const DB_SPEED = 0.95; // CBs and safeties in run support

  // ── Carrier velocity for predictive pursuit (CB/S only) ───────
  // Track carrier position from previous tick; compute velocity px/s.
  const carrierX = carrier ? (carrier.simX ?? carrier.x) : ball.x;
  const carrierY = carrier ? (carrier.simY ?? carrier.y) : LOS_Y();

  if (carrier) {
    if (carrier._prevSimX === undefined) {
      carrier._prevSimX = carrierX; carrier._prevSimY = carrierY;
    }
    const rawVx = dt > 0 ? (carrierX - carrier._prevSimX) / dt : 0;
    const rawVy = dt > 0 ? (carrierY - carrier._prevSimY) / dt : 0;
    // EMA 0.7: converges fast enough after a cut without single-frame jitter
    const EMA = 0.35;
    carrier._velX = carrier._velX !== undefined ? carrier._velX * (1 - EMA) + rawVx * EMA : rawVx;
    carrier._velY = carrier._velY !== undefined ? carrier._velY * (1 - EMA) + rawVy * EMA : rawVy;
    carrier._prevSimX = carrierX; carrier._prevSimY = carrierY;
  }

  // Helper: predicted carrier position for CB/S intercept
  function predictedCarrierPos(fromX, fromY) {
    if (!carrier || carrier._velX === undefined) return { x: carrierX, y: carrierY };
    const velX = carrier._velX ?? 0;
    const velY = carrier._velY ?? 0;
    const speed = Math.hypot(velX, velY);
    if (speed < 5 || runHandoffState !== 'carrying') return { x: carrierX, y: carrierY };

    const xDist = Math.abs(fromX - carrierX);
    const yDist = Math.abs(fromY - carrierY);

    // Min floor 0.6 prevents prediction collapse when defender and carrier
    // are at similar depth (yDist ≈ 0) and carrier runs hard horizontal.
    const lookaheadX = CB_S_LOOKAHEAD_SEC * Math.min(2.0, Math.max(0.6, yDist / (2.25 * YARD_PX)));
    const lookaheadY = CB_S_LOOKAHEAD_SEC * Math.min(2.0, Math.max(0.6, xDist / (2.25 * YARD_PX)));

    const px = carrierX + velX * lookaheadX;
    const py = carrierY + velY * lookaheadY;

    if (!isFinite(px) || !isFinite(py)) return { x: carrierX, y: carrierY };
    return { x: px, y: py };
  }

  // ── Mark gaps already occupied by DL pre-snap alignment ───────
  // simLockedGapX was frozen once at snap in initDefendersForSim — never rebuilt
  const lockedGapX = simLockedGapX;

  const GAP_FILL_RADIUS = OLINE_SPACING * 0.7; // ~22px horizontal tolerance
  const AT_LOS_THR = 6; // px — within this of LOS_Y counts as "at the line"
  const filledGaps = new Set();

  defensePlayers.forEach(d => {
    const role = d.role.toUpperCase();
    if (!['DT','NT','DE'].includes(role)) return;
    const px = d.simX ?? d.x;
    // Use simLockedGapX (frozen at snap) — not live GAP_OFFSETS_PX
    Object.entries(simLockedGapX).forEach(([gapId, gapAbsX]) => {
      if (Math.abs(px - gapAbsX) < GAP_FILL_RADIUS) filledGaps.add(gapId);
    });
  });

  // ── Inside-out cascade for LBs / DBs without assignment ───────
  // Outside-in gap fill for sim loop — mirrors pre-snap assignment order
  function nextOpenGap(side) {
    // GAP_PRIORITY_L/R are inside-out; reverse for outside-in
    const list = (side === 'L' ? [...GAP_PRIORITY_L] : [...GAP_PRIORITY_R]).reverse();
    return list.find(g => !filledGaps.has(g)) ?? null;
  }

  // ── Helper: go to gap X at LOS, then push THROUGH to carrier ──
  const CARRIER_PAST_LOS_THR = 6;
  const carrierPastLOS = carrierY < LOS_Y() - CARRIER_PAST_LOS_THR;
  function gapThenThrough(gapId) {
    // Use X locked at snap so D/E/F gaps do not drift with ball movement
    const gapX = lockedGapX[gapId] ?? (ball.x + (GAP_OFFSETS_PX[gapId] ?? 0));
    const atLine = (LOS_Y() - d_fromY) <= AT_LOS_THR;
    if (atLine || carrierPastLOS) {
      return { tx: carrierX, ty: carrierY, cap: false };
    } else {
      return { tx: gapX, ty: LOS_Y(), cap: true };
    }
  }

  let d_fromY = 0;

  defensePlayers.forEach(d => {
    if (d._blockLocked) return; // frozen by a blocker — skip
    // Prefer manual runAssignment; fall back to auto-computed assignment (from DP)
    const asg  = (d.runAssignment && d.runAssignment.type !== 'none')
               ? d.runAssignment
               : (d.assignment && d.assignment.type !== 'none')
                 ? d.assignment
                 : { type: 'none' };
    const role = d.role.toUpperCase();
    const isDL  = ['DT','NT','DE'].includes(role);
    const isCBS = ['CB','NICKEL','FS','SS'].includes(role); // predictive pursuit eligible

    const fromX = d.simX ?? d.x;
    const fromY = d.simY ?? d.y;
    d_fromY = fromY;

    let speedMult;
    if (isDL)       speedMult = DL_SPEED[role] ?? 0.55;
    else if (isCBS) speedMult = DB_SPEED;
    else            speedMult = LB_SPEED;
    speedMult *= (d.speedMultiplier || 1.0);
    const step = BASE_SPEED * speedMult * dt;

    let tx, ty, useBlockerCap = true;

    // ── DL: always rush through their assigned/nearest gap ────────
    if (isDL) {
      // Explicit gap assignment takes priority; rush/none → lock nearest gap at snap
      let gapId = asg && asg.type === 'gap' ? asg.gapId : null;
      if (!gapId) {
        if (!d._lockedGapId) {
          let best = null, bestDist = Infinity;
          Object.entries(lockedGapX).forEach(([g, gx]) => {
            const dist = Math.abs(fromX - gx);
            if (dist < bestDist) { bestDist = dist; best = g; }
          });
          d._lockedGapId = best;
        }
        gapId = d._lockedGapId;
      }
      if (gapId) {
        filledGaps.add(gapId);
        const r = gapThenThrough(gapId);
        tx = r.tx; ty = r.ty; useBlockerCap = r.cap;
      } else {
        tx = carrierX; ty = carrierY; useBlockerCap = true;
      }
      if (useBlockerCap) { const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty; }
      const dx = tx-fromX, dy = ty-fromY, dist = Math.hypot(dx,dy);
      if (dist > 4) { d.simX = fromX+(dx/dist)*step; d.simY = fromY+(dy/dist)*step; }
      resolveBlockerOverlap(d, blockers);
      return;
    }

    // ── CB / S: predictive pursuit (no gap assignment) ────────────
    // If they have an explicit gap/contain/spill assignment, respect it.
    // Otherwise use predicted carrier intercept point.
    if (isCBS && (!asg || !['gap','contain','spill','rush'].includes(asg.type))) {
      const distToCarrier = Math.hypot(fromX - carrierX, fromY - carrierY);
      let tx, ty;
      if (distToCarrier < 1 * YARD_PX) {
        // Close enough — go directly for the tackle
        tx = carrierX; ty = carrierY;
      } else {
        const pred = predictedCarrierPos(fromX, fromY);
        tx = pred.x; ty = pred.y;
      }
      const dx = tx-fromX, dy = ty-fromY, dist = Math.hypot(dx,dy);
      if (dist > 4) { d.simX = fromX+(dx/dist)*step; d.simY = fromY+(dy/dist)*step; }
      return;
    }

    // ── LBs / DBs with explicit assignment ────────────────────────
    if (asg && asg.type === 'gap' && asg.gapId) {
      filledGaps.add(asg.gapId);
      const r = gapThenThrough(asg.gapId);
      tx = r.tx; ty = r.ty; useBlockerCap = r.cap;
      if (useBlockerCap) { const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty; }

    } else if (asg && asg.type === 'contain') {
      const side = fromX <= ball.x ? -1 : 1;
      const edgeX = ball.x + side * (YARD_PX * 15);
      const distToCarrier = Math.hypot(fromX - carrierX, fromY - carrierY);
      if (distToCarrier <= YARD_PX) {
        // Within 1 yard — go for the tackle
        tx = carrierX; ty = carrierY;
      } else {
        const carrierGoingToSide = side < 0 ? (carrierX < ball.x - 20) : (carrierX > ball.x + 20);
        if (carrierGoingToSide) {
          tx = carrierX + side * YARD_PX; ty = carrierY;
        } else {
          tx = edgeX; ty = LOS_Y();
        }
      }

    } else if (asg && asg.type === 'spill') {
      tx = carrierX; ty = carrierY;
      const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;

    } else if (asg && asg.type === 'rush') {
      tx = carrierX; ty = carrierY;
      const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;

    } else if (asg && asg.type === 'pursuit') {
      // Pursuit: predicted carrier position, no blocker cap (pursue around blocks).
      const pred = predictedCarrierPos(fromX, fromY);
      tx = pred.x; ty = pred.y;

    } else {
      // ── No explicit assignment: gap locked at play start on first tick ──
      if (!d._lockedGapId) {
        const side = fromX <= ball.x ? 'L' : 'R';
        const openGap = nextOpenGap(side);
        d._lockedGapId = openGap || null;
      }
      const lockedGap = d._lockedGapId;
      if (lockedGap) {
        filledGaps.add(lockedGap);
        const r = gapThenThrough(lockedGap);
        tx = r.tx; ty = r.ty; useBlockerCap = r.cap;
        if (useBlockerCap) { const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty; }
      } else {
        // Truly nothing available → pursuit
        tx = carrierX; ty = carrierY;
      }
    }

    const dx = tx-fromX, dy = ty-fromY, dist = Math.hypot(dx,dy);
    if (dist > 4) { d.simX = fromX+(dx/dist)*step; d.simY = fromY+(dy/dist)*step; }
    resolveBlockerOverlap(d, blockers);
  });
}

