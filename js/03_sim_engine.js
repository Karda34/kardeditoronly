// ===================================================================
// OFFENSE FEATURE EXTRACTION (Phase 2.3)
// Pure helper functions — no side effects, no simulation changes.
// Only uses: snapPos, first 1–2 route/block points (early read only).
// "Non-cheaty": does NOT expose full route depth or break endpoints.
// ===================================================================

// ── Config constants (tune here) ──────────────────────────────────────
const RELEASE_UNDER_MAX_DY      = 2.0;   // yards: shallow release threshold
const RELEASE_UNDER_MIN_DX      = 1.5;   // yards: horizontal component for "under"
const RELEASE_VERTICAL_MAX_DEG  = 20;    // degrees: qualifies as vertical stem
const RELEASE_HORIZONTAL_MIN_DEG= 65;    // degrees: qualifies as under/flat stem
const BREAK_HINT_MIN_DEG        = 35;    // degrees: angle between v1→v2 = early break hint
const BACKWARDS_MAX_DY_YD       = -0.75; // yards: dy less than this → backwards

// ── Vector / angle helpers (pure) ────────────────────────────────────

// Convert pixel delta to yards (YARD_PX global)
function pxToYd(px) { return px / YARD_PX; }

// Upfield direction: canvas Y decreases upfield (screen top = upfield).
// So "positive dy in yards" = moving downfield = AWAY from defense = bad for route.
// Convention here: dy_yd > 0 means UPFIELD (toward LOS, shorter), dy_yd < 0 means downfield.
// Actually in this canvas: y increases downward (toward camera / behind LOS).
// So anchor.y > p0.y means p0 is UPFIELD of anchor (dy_canvas negative).
// We treat "upfield" = p0.y < anchor.y in canvas coords.
// => dy_upfield = anchor.y - p0.y  (positive = going upfield)
// => dy_downfield = p0.y - anchor.y (positive = going downfield / toward camera side)
// For route depth: positive = going into the defensive backfield (good gain).
// releaseAngleDeg: angle from vertical (0=straight upfield, 90=flat/horizontal)
// using v1 = (p0 - anchor) in canvas coords.

// Returns angle in degrees between two {x,y} vectors (0–180).
function angleBetweenVecs(v1, v2) {
  const dot  = v1.x*v2.x + v1.y*v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 < 1e-6 || mag2 < 1e-6) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
}

// Returns release angle in degrees relative to the upfield axis.
// 0 = straight upfield, 90 = horizontal (flat), >90 = angled back downfield.
// v1 = {x, y} in canvas pixels, where negative y = upfield.
function releaseAngleDeg(v1) {
  // Upfield unit vector in canvas coords = {x:0, y:-1}
  const mag = Math.hypot(v1.x, v1.y);
  if (mag < 1e-6) return 90;
  // Angle between v1 and upfield (0,-1)
  const dot = v1.x * 0 + v1.y * (-1);  // = -v1.y
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
}

// ── Play path source (no anchor baked in) ────────────────────────────
// Returns { kind: 'route'|'block'|'none', points: [{x,y},...] }
// anchor = snapPos and is NOT included in points.
function getPlayPath(player) {
  if (player.routePoints && player.routePoints.length > 0)
    return { kind: 'route', points: player.routePoints };
  if (player.blockPoints && player.blockPoints.length > 0)
    return { kind: 'block', points: player.blockPoints };
  return { kind: 'none', points: [] };
}

// Determine which anchor was used for snap position (for debug label)
function snapAnchorUsed(player) {
  if (player.motionPoints && player.motionPoints.length > 0) return 'motionEnd';
  if (player.shiftPoints  && player.shiftPoints.length  > 0) return 'shiftEnd';
  return 'start';
}

// ── Early Receiver Read ───────────────────────────────────────────────
// Only uses anchor (snapPos) + p0 + p1. No further points inspected.
// Returns an earlyRead object — pure, no mutations.
function extractEarlyReceiverRead(player, snapshot) {
  const anchor   = getSnapPos(player);
  const path     = getPlayPath(player);
  const { kind, points } = path;
  const ballX    = snapshot.ballX;
  const side     = player._side;  // 'L' | 'R'

  const NULL_READ = {
    kind, firstVector: null, secondVector: null,
    releaseAngleDeg: null, releaseSide: 'none',
    releaseType: 'none', earlyBreakHint: false,
    isVerticalThreatInitial: false,
    anchorUsed: snapAnchorUsed(player),
  };

  if (kind === 'none' || points.length === 0) return NULL_READ;

  const p0 = points[0];
  const p1 = points.length > 1 ? points[1] : null;

  // v1: anchor → p0 (in canvas pixels)
  const v1 = { x: p0.x - anchor.x, y: p0.y - anchor.y };

  // v2: p0 → p1 (if p1 exists)
  const v2 = p1 ? { x: p1.x - p0.x, y: p1.y - p0.y } : null;

  // Release angle (degrees from upfield axis, 0=vertical, 90=flat)
  const angDeg = releaseAngleDeg(v1);

  // dy in yards (positive = upfield, i.e. canvas y decreases)
  const dy_yd = pxToYd(anchor.y - p0.y);   // positive = upfield
  const dx_yd = pxToYd(p0.x - anchor.x);   // positive = right

  // Release side (inside vs outside relative to ball)
  let releaseSide = 'none';
  if (side === 'L') {
    // Lined up left of ball: moving further left (dx_yd < 0) = outside
    releaseSide = dx_yd < 0 ? 'outside' : 'inside';
  } else {
    // Lined up right: moving further right (dx_yd > 0) = outside
    releaseSide = dx_yd > 0 ? 'outside' : 'inside';
  }

  // Release type classification — simplified: strong/weak/vertical/none
  let releaseType;
  const dy_upfield = dy_yd;
  if (angDeg <= RELEASE_VERTICAL_MAX_DEG && dy_upfield > RELEASE_UNDER_MAX_DY) {
    releaseType = 'vertical';
  } else if (Math.abs(dx_yd) >= RELEASE_UNDER_MIN_DX) {
    releaseType = dx_yd > 0 ? 'right' : 'left';
  } else {
    releaseType = 'none';
  }

  // Early break hint: significant direction change from v1 → v2
  let earlyBreakHint = false;
  if (v2) {
    const angleDiff = angleBetweenVecs(v1, v2);
    earlyBreakHint = angleDiff >= BREAK_HINT_MIN_DEG;
  }

  const isVerticalThreatInitial = (releaseType === 'vertical' && dy_upfield > RELEASE_UNDER_MAX_DY);

  return {
    kind,
    firstVector:  v1,
    secondVector: v2,
    releaseAngleDeg: Math.round(angDeg),
    releaseSide,
    releaseType,
    earlyBreakHint,
    isVerticalThreatInitial,
    anchorUsed: snapAnchorUsed(player),
    // raw for debug
    _dy_yd: Math.round(dy_upfield * 10) / 10,
    _dx_yd: Math.round(dx_yd * 10) / 10,
  };
}

// ── Early Backfield Read ──────────────────────────────────────────────
// "released" = has routePoints (going out as a receiver).
// blockPoints = "stay in" (blocking assignment, not releasing).
// No mutation; uses only anchor + p0.
function extractEarlyBackfieldRead(player, snapshot) {
  const anchor = getSnapPos(player);
  const path   = getPlayPath(player);
  const { kind, points } = path;

  // released: true if going on a route; false if blocking or no assignment
  const released = (kind === 'route');
  // "stay" = block assignment or nothing
  const stayType = (kind === 'block') ? 'block' : (kind === 'none' ? 'none' : 'route');

  let releaseType = 'none';
  let firstVector = null;

  if (released && points.length > 0) {
    const p0 = points[0];
    firstVector = { x: p0.x - anchor.x, y: p0.y - anchor.y };
    const angDeg   = releaseAngleDeg(firstVector);
    const dy_yd    = pxToYd(anchor.y - p0.y);
    const dx_yd    = pxToYd(p0.x - anchor.x);
    if (angDeg <= RELEASE_VERTICAL_MAX_DEG && dy_yd > RELEASE_UNDER_MAX_DY) {
      releaseType = 'vertical';
    } else if (Math.abs(dx_yd) >= RELEASE_UNDER_MIN_DX) {
      releaseType = dx_yd > 0 ? 'right' : 'left';
    } else {
      releaseType = 'none';
    }
  }

  return {
    kind,
    released,
    stayType,
    releaseType,
    firstVector,
    anchorUsed: snapAnchorUsed(player),
  };
}

function updateFormationBadge() {
  const el = document.getElementById('formationBadge');
  if (!debugOverlayOn || !offenseStructureSnapshot) {
    el.classList.remove('visible');
    return;
  }
  const s = offenseStructureSnapshot;
  let txt = `${s.formation}  STRONG: ${s.strongSide}${s.isEmpty ? '  EMPTY' : ''}`;

  // Attachment zone summary
  const attParts = [];
  if (s.leftAttached  && s.leftAttached.length)  attParts.push(`L:${s.leftAttached.length}`);
  if (s.rightAttached && s.rightAttached.length) attParts.push(`R:${s.rightAttached.length}`);
  if (attParts.length) txt += `  ATT:${attParts.join(' ')}`;

  // Bunch flags
  const bunchParts = [];
  if (s.leftBunch  && s.leftBunch.bunch)  bunchParts.push(`L(${s.leftBunch.labels.join(',')})`);
  if (s.rightBunch && s.rightBunch.bunch) bunchParts.push(`R(${s.rightBunch.labels.join(',')})`);
  if (bunchParts.length) txt += `  BUNCH:${bunchParts.join(' ')}`;

  // Stack flags
  const stackParts = [];
  if (s.leftStack  && s.leftStack.stack)  stackParts.push(`L(${s.leftStack.labels.join(',')})`);
  if (s.rightStack && s.rightStack.stack) stackParts.push(`R(${s.rightStack.labels.join(',')})`);
  if (stackParts.length) txt += `  STACK:${stackParts.join(' ')}`;

  el.textContent = txt;
  el.classList.add('visible');
}

// ── Debug Overlay Renderer ────────────────────────────────────────────────
// Draws classification labels, snap markers, and Phase 2.3 early read info.
// Only called when debugOverlayOn === true. Reads from snapshot only.
function drawDebugOverlay() {
  if (!offenseStructureSnapshot) return;

  updateFormationBadge();

  ctx.save();
  ctx.font = 'bold 11px Barlow Condensed';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  players.forEach(p => {
    const cls  = p._alignmentClass || 'eligible';
    const snap = getSnapPos(p);
    const er   = p._earlyRead;

    // Snap position marker: small cyan cross
    ctx.strokeStyle = 'rgba(0,229,255,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(snap.x - 5, snap.y); ctx.lineTo(snap.x + 5, snap.y);
    ctx.moveTo(snap.x, snap.y - 5); ctx.lineTo(snap.x, snap.y + 5);
    ctx.stroke();

    // ── Build label lines ──────────────────────────────────────────────
    let line1 = '';
    let line2 = '';
    let color = '#4ade80';

    if (cls === 'qb') {
      line1 = 'QB';
      color = '#f0e040';
    } else if (cls === 'backfield') {
      color = '#fb923c';
      if (er) {
        const relStr = er.released
          ? `REL:${er.releaseType.toUpperCase()}`
          : (er.stayType === 'block' ? 'STAY:BLK' : 'STAY');
        line1 = `BF ${p._side}  ${relStr}`;
      } else {
        line1 = `BF ${p._side}`;
      }
    } else {
      // eligible
      color = '#60a5fa';
      const bsTag = p._isBunch && p._isStack ? ' B+S'
                  : p._isBunch ? ' BUNCH'
                  : p._isStack ? ' STACK' : '';
      const attTag = p._attachmentZone === 'ATTACHED' ? ' ATT'
                   : p._attachmentZone === 'DETACHED' ? ' DET' : '';
      line1 = `#${p._receiverNumber || '?'} ${p._side}${attTag}${bsTag}`;

      if (er && er.kind !== 'none') {
        const relLabel = er.releaseType === 'none'  ? '—'
                       : er.releaseType.toUpperCase().slice(0, 4);
        const angStr  = er.releaseAngleDeg !== null ? `ang=${er.releaseAngleDeg}°` : '';
        const brkStr  = er.earlyBreakHint ? 'brk!' : '';
        line2 = `REL:${relLabel} ${angStr}${brkStr ? ' ' + brkStr : ''}`.trim();
      }
    }

    // Draw line1
    const lx = p.x + 16;
    let   ly = p.y - 14;
    ctx.font = 'bold 11px Barlow Condensed';
    ctx.lineWidth   = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(line1, lx, ly);
    ctx.fillStyle = color;
    ctx.fillText(line1, lx, ly);

    // Draw line2 (early read) if present
    if (line2) {
      ly += 13;
      ctx.font = '10px Barlow Condensed';
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(line2, lx, ly);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(line2, lx, ly);
    }

    // ── v1 arrow from snap (early release direction) ───────────────────
    if (er && er.firstVector && er.kind !== 'none') {
      const v1  = er.firstVector;
      const mag = Math.hypot(v1.x, v1.y);
      if (mag > 4) {
        const scale  = Math.min(28, mag) / mag;   // cap arrow at 28px
        const arrowX = snap.x + v1.x * scale;
        const arrowY = snap.y + v1.y * scale;

        ctx.save();
        ctx.strokeStyle = cls === 'backfield' ? 'rgba(251,146,60,0.9)' : 'rgba(96,165,250,0.9)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(snap.x, snap.y);
        ctx.lineTo(arrowX, arrowY);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(v1.y, v1.x);
        const hs    = 5;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - hs * Math.cos(angle - 0.4), arrowY - hs * Math.sin(angle - 0.4));
        ctx.lineTo(arrowX - hs * Math.cos(angle + 0.4), arrowY - hs * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Bunch: orange circle halo
    if (p._isBunch) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251,146,60,0.7)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Stack: purple square halo
    if (p._isStack) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192,132,252,0.7)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(p.x - 18, p.y - 18, 36, 36);
      ctx.restore();
    }
  });

  // Draw tackle box lines (light grey, dashed)
  const tb   = offenseStructureSnapshot.tackleBox;
  const losY = offenseStructureSnapshot.losY;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(tb.boxLeftX,  losY - YARD_PX * 2);
  ctx.lineTo(tb.boxLeftX,  losY + YARD_PX * 5);
  ctx.moveTo(tb.boxRightX, losY - YARD_PX * 2);
  ctx.lineTo(tb.boxRightX, losY + YARD_PX * 5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // Phase 3.1: live read labels (only during sim, only if liveReadOn)
  drawLiveReadOverlay();
}

// ─────────────────────────────────────────────
// HIT TESTING
// ─────────────────────────────────────────────
let dragging = null;
let mousePos = { x:0, y:0 };

function hitTestBall(mx, my)   { return Math.hypot(mx-ball.x, my-ball.y) < 18; }

function hitTestPlayer(mx, my) {
  if (mode === 'sim') return null;
  // Skill players
  for (let i=players.length-1; i>=0; i--) {
    if (Math.hypot(mx-players[i].x, my-players[i].y) < 16) return players[i];
  }
  // O-Line always selectable (not just when block tool active)
  const oline = olinePlayers();
  for (let i=oline.length-1; i>=0; i--) {
    if (Math.hypot(mx-oline[i].x, my-oline[i].y) < 16) return oline[i];
  }
  return null;
}

// Returns draggable waypoint hit for current tool of selected player
function hitTestActiveWaypoint(mx, my) {
  if (mode === 'sim') return null;

  // Skill player selected
  const sel = players.find(p => p.id === selectedPlayerId);
  if (sel) {
    const pts = activeTool === 'route'  ? sel.routePoints
              : activeTool === 'motion' ? sel.motionPoints
              : activeTool === 'shift'  ? sel.shiftPoints
              : activeTool === 'block'  ? sel.blockPoints
              : null;
    if (pts) {
      for (let i=pts.length-1; i>=0; i--) {
        if (Math.hypot(mx-pts[i].x, my-pts[i].y) < 10) return { pts, idx:i };
      }
    }
    return null;
  }

  // O-Line player selected — only block waypoints
  if (OLINE_IDS.includes(selectedPlayerId) && activeTool === 'block') {
    const bpts = olineData[selectedPlayerId].blockPoints;
    for (let i=bpts.length-1; i>=0; i--) {
      if (Math.hypot(mx-bpts[i].x, my-bpts[i].y) < 10) return { pts: bpts, idx: i };
    }
  }
  return null;
}

canvas.addEventListener('mousedown', e => {
  // ── Middle-click: assign designated block target ───────────────────
  if (e.button === 1) {
    e.preventDefault();
    const r   = canvas.getBoundingClientRect();
    const raw = { x: (e.clientX - r.left) * (FIELD_W / r.width), y: (e.clientY - r.top) * (FIELD_H / r.height) };
    const fc  = toFieldCoords(raw.x, raw.y);
    const defHit = hitTestDefender(fc.x, fc.y);
    const blocker = selectedPlayerId
      ? (players.find(p => p.id === selectedPlayerId) || (OLINE_IDS.includes(selectedPlayerId) ? olineData[selectedPlayerId] : null))
      : null;
    if (defHit && blocker) {
      // Toggle: middle-click same defender again → remove assignment
      if (blocker._designatedBlockTargetId === defHit.id) {
        blocker._designatedBlockTargetId = null;
        blocker._blockChaseTargetId      = null;
        showToast('Block target removed', 'info');
        draw();
        return;
      }
      // If another blocker already has this defender designated, clear their assignment
      const prevBlocker = players.find(p => p._designatedBlockTargetId === defHit.id && p !== blocker);
      const prevOline   = OLINE_IDS.map(id => olineData[id]).find(d => d._designatedBlockTargetId === defHit.id && d !== blocker);
      if (prevBlocker) { prevBlocker._designatedBlockTargetId = null; prevBlocker._blockChaseTargetId = null; prevBlocker._blockChaseDone = false; }
      if (prevOline)   { prevOline._designatedBlockTargetId   = null; prevOline._blockChaseTargetId   = null; prevOline._blockChaseDone   = false; }
      blocker._designatedBlockTargetId = defHit.id;
      blocker._blockChaseTargetId      = defHit.id;
      blocker._blockChaseDone          = false;
      showToast(`Block target assigned`, 'info');
      draw();
    } else if (!defHit && blocker && blocker._designatedBlockTargetId != null) {
      // Middle-click on the blocker itself (no defender hit) → remove assignment
      const selfHit = hitTestPlayer(fc.x, fc.y);
      if (selfHit && selfHit.id === blocker.id) {
        blocker._designatedBlockTargetId = null;
        blocker._blockChaseTargetId      = null;
        showToast('Block target removed', 'info');
        draw();
      }
    }
    return;
  }

  if (mode === 'sim') return;
  const r   = canvas.getBoundingClientRect();
  const raw = { x: (e.clientX - r.left) * (FIELD_W / r.width), y: (e.clientY - r.top) * (FIELD_H / r.height) };
  const fc  = toFieldCoords(raw.x, raw.y);
  const mx  = fc.x;
  const my  = fc.y;

  // Brush tool: start a new annotation stroke
  if (activeTool === 'brush') {
    activeStroke = [{ x: mx, y: my }];
    return;
  }

  // 1. Waypoint drag (any tool, any player type)
  const wpHit = hitTestActiveWaypoint(mx, my);
  if (wpHit) {
    dragging = { type:'waypoint', pts: wpHit.pts, idx: wpHit.idx };
    return;
  }

  // 2. Ball drag — but NOT when block tool is active with a player selected
  //    (so clicking near the ball can place a block target point there)
  const blockingActive = activeTool === 'block' &&
    (players.find(p => p.id === selectedPlayerId) || OLINE_IDS.includes(selectedPlayerId));
  if (!blockingActive && hitTestBall(mx, my)) {
    dragging = { type:'ball', offX: mx - ball.x };
    return;
  }

  // 3a. Defender hit → select defender, always clear offense selection
  const defHit = hitTestDefender(mx, my);
  if (defHit) {
    selectedDefId    = defHit.id;
    selectedPlayerId = null;          // deselect any offense player
    activeTeam       = 'D';
    dragging         = { type:'defender', defender: defHit, offX: mx - defHit.x, offY: my - defHit.y };
    refreshPlayerList();
    refreshDefPlayerList();
    refreshDefAssignBox();
    draw();
    return;
  }

  // 3b. Offense player / O-Line select + drag → always clear defender selection
  const p = hitTestPlayer(mx, my);
  if (p) {
    // If a defender with man assignment is selected, clicking offense = assign target
    if (tryAssignManTargetByClick(p)) return;
    selectedDefId = null;             // deselect any defender
    activeTeam    = 'O';
    if (p.isOline) {
      selectedPlayerId = p.id;
      if (activeTool !== 'block') setTool('block');
      refreshPlayerList();
      refreshDefPlayerList();
      refreshDefAssignBox();
      draw(); return;
    }
    dragging         = { type:'player', player:p, offX: mx-p.x, offY: my-p.y };
    selectedPlayerId = p.id;
    refreshPlayerList();
    refreshDefPlayerList();
    refreshDefAssignBox();
    draw(); return;
  }

  // 4. Field click → add point for active tool
  const selSkill = players.find(p => p.id === selectedPlayerId);
  const selOline = OLINE_IDS.includes(selectedPlayerId) ? selectedPlayerId : null;

  if (activeTool === 'route') {
    if (!selSkill) return;
    // Mutual exclusivity: first route point clears blockPoints
    if (selSkill.routePoints.length === 0 && selSkill.blockPoints.length > 0) {
      selSkill.blockPoints = [];
    }
    selSkill.routePoints.push({ x: mx, y: my });
    refreshPlayerList(); draw();

  } else if (activeTool === 'block') {
    if (selSkill) {
      // Mutual exclusivity: first block point clears routePoints
      if (selSkill.blockPoints.length === 0 && selSkill.routePoints.length > 0) {
        selSkill.routePoints = [];
      }
      selSkill.blockPoints.push({ x: mx, y: my });
      refreshPlayerList(); draw();
    } else if (selOline) {
      olineData[selOline].blockPoints.push({ x: mx, y: my });
      refreshPlayerList(); draw();
    }

  } else if (activeTool === 'motion') {
    if (!selSkill) return;
    if (motionOwnerId !== null && motionOwnerId !== selSkill.id) {
      const prev = players.find(pl => pl.id === motionOwnerId);
      if (prev) {
        prev.motionPoints = [];
        showToast(`Motion transferred → ${selSkill.label}#${selSkill.id}`, 'info');
      }
    }
    motionOwnerId = selSkill.id;
    selSkill.motionPoints.push({ x: mx, y: my });
    updateMotionBadge(); refreshPlayerList(); draw();

  } else if (activeTool === 'shift') {
    // Shift is only for skill players — silently ignore O-Line clicks
    if (!selSkill) return;
    selSkill.shiftPoints.push({ x: mx, y: my });
    refreshPlayerList(); draw();
  }
});

canvas.addEventListener('mousemove', e => {
  const r   = canvas.getBoundingClientRect();
  const raw = { x: (e.clientX - r.left) * (FIELD_W / r.width), y: (e.clientY - r.top) * (FIELD_H / r.height) };
  const fc  = toFieldCoords(raw.x, raw.y);
  const mx  = fc.x;
  const my  = fc.y;
  mousePos = { x:mx, y:my };

  // Brush tool: extend active stroke
  if (activeTool === 'brush' && activeStroke) {
    activeStroke.push({ x: mx, y: my });
    draw();
    return;
  }

  if (!dragging) return;

  if (dragging.type === 'ball') {
    ball.x = Math.max(LEFT_HASH, Math.min(RIGHT_HASH, mx - dragging.offX));
  } else if (dragging.type === 'player') {
    // Clamp to field bounds AND LOS constraint (cannot drag past LOS into upfield)
    const clamped = clampToLOS(mx - dragging.offX, my - dragging.offY);
    dragging.player.x = clamped.x;
    dragging.player.y = clamped.y;
  } else if (dragging.type === 'defender') {
    // Defenders can be placed anywhere on the field (no LOS restriction)
    dragging.defender.x = Math.max(FIELD_LEFT, Math.min(FIELD_RIGHT, mx - dragging.offX));
    dragging.defender.y = Math.max(20, Math.min(FIELD_H - 20, my - dragging.offY));
  } else if (dragging.type === 'waypoint') {
    dragging.pts[dragging.idx] = { x: mx, y: my };  // waypoints are free (can go upfield)
  }
  draw();
});

canvas.addEventListener('mouseup', () => {
  // Brush tool: commit finished stroke
  if (activeTool === 'brush' && activeStroke) {
    if (activeStroke.length > 1) annotations.push(activeStroke);
    activeStroke = null;
    draw();
  }

  if (dragging && dragging.type === 'player') {
    dragging.player.origX = dragging.player.x;
    dragging.player.origY = dragging.player.y;
    if (mode === 'editor') recomputeRunFits();
    if (mode === 'editor') reactiveFormationUpdate();
  }
  if (dragging && dragging.type === 'defender') {
    dragging.defender.origX = dragging.defender.x;
    dragging.defender.origY = dragging.defender.y;
    if (mode === 'editor') recomputeRunFits();
    // Defenders moved manually do NOT trigger reactive formation
  }
  if (dragging && dragging.type === 'ball') {
    if (mode === 'editor') recomputeRunFits();
    if (mode === 'editor') reactiveFormationUpdate();
  }
  dragging = null;
  // Snapshot already rebuilt every draw(), but update badge after drag
  updateFormationBadge();
});

// RIGHT-CLICK:
// Priority order:
//   1. On a route/block/motion/shift waypoint → pop that waypoint (undo last point)
//   2. On an offense player → no-op (used for man-coverage assignment via left-click only)
//   3. Anywhere else → deselect defender (if one is selected) OR no-op
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (mode === 'sim') return;

  const r   = canvas.getBoundingClientRect();
  const raw = { x: (e.clientX - r.left) * (FIELD_W / r.width), y: (e.clientY - r.top) * (FIELD_H / r.height) };
  const fc  = toFieldCoords(raw.x, raw.y);
  const mx  = fc.x;
  const my  = fc.y;

  // Brush tool: undo last annotation stroke
  if (activeTool === 'brush') {
    if (annotations.length > 0) { annotations.pop(); draw(); }
    return;
  }

  const selSkill = players.find(p => p.id === selectedPlayerId);
  const selOline = OLINE_IDS.includes(selectedPlayerId) ? selectedPlayerId : null;

  // 1. Waypoint hit → always undo the point, no deselect
  const wpHit = hitTestActiveWaypoint(mx, my);
  if (wpHit) {
    // pop the hit waypoint (not just the last — remove by index)
    const pts = wpHit.pts;
    pts.splice(wpHit.idx, 1);
    if (selSkill && selSkill.motionPoints === pts && pts.length === 0) {
      motionOwnerId = null;
      updateMotionBadge();
    }
    refreshPlayerList(); draw();
    return;
  }

  // Also: undo last waypoint of active tool when right-clicking on the field
  // (even if not on a waypoint dot — existing behaviour for route/motion/shift/block pop)
  if (activeTool === 'route' && selSkill && selSkill.routePoints.length > 0) {
    selSkill.routePoints.pop();
    refreshPlayerList(); draw();
    return;

  } else if (activeTool === 'motion' && selSkill && selSkill.motionPoints.length > 0) {
    selSkill.motionPoints.pop();
    if (selSkill.motionPoints.length === 0) motionOwnerId = null;
    updateMotionBadge(); refreshPlayerList(); draw();
    return;

  } else if (activeTool === 'shift' && selSkill && selSkill.shiftPoints.length > 0) {
    selSkill.shiftPoints.pop();
    refreshPlayerList(); draw();
    return;

  } else if (activeTool === 'block') {
    if (selSkill && selSkill._designatedBlockTargetId != null) {
      selSkill._designatedBlockTargetId = null;
      selSkill._blockChaseTargetId = null;
      showToast('Block target removed', 'info');
      draw();
      return;
    } else if (selSkill && selSkill.blockPoints.length > 0) {
      selSkill.blockPoints.pop();
      refreshPlayerList(); draw();
      return;
    } else if (selOline && olineData[selOline]._designatedBlockTargetId != null) {
      olineData[selOline]._designatedBlockTargetId = null;
      olineData[selOline]._blockChaseTargetId = null;
      showToast('Block target removed', 'info');
      draw();
      return;
    } else if (selOline && olineData[selOline].blockPoints.length > 0) {
      olineData[selOline].blockPoints.pop();
      refreshPlayerList(); draw();
      return;
    }
  }

  // 2. On an offense player → ignore (don't deselect)
  const offHit = hitTestPlayer(mx, my);
  if (offHit) return;

  // 3. Anywhere else → deselect everything
  if (selectedDefId !== null || selectedPlayerId !== null) {
    selectedDefId    = null;
    selectedPlayerId = null;
    activeTeam       = 'O';
    refreshPlayerList();
    refreshDefPlayerList();
    refreshDefAssignBox();
    draw();
  }
});

// ── Clear buttons ──────────────────────────────────────────────────────
// "Clear Assignment" = clear ALL assignments for selected player
document.getElementById('clearRouteBtn').addEventListener('click', () => {
  const selSkill = players.find(p => p.id === selectedPlayerId);
  const selOline = OLINE_IDS.includes(selectedPlayerId) ? selectedPlayerId : null;

  if (selSkill) {
    selSkill.routePoints  = [];
    selSkill.motionPoints = [];
    selSkill.shiftPoints  = [];
    selSkill.blockPoints  = [];
    if (motionOwnerId === selSkill.id) { motionOwnerId = null; updateMotionBadge(); }
  }
  if (selOline) {
    olineData[selOline].blockPoints = [];
  }
  refreshPlayerList(); draw();
});

document.getElementById('clearAllRoutesBtn').addEventListener('click', () => {
  players.forEach(p => { p.routePoints = []; p.motionPoints = []; p.shiftPoints = []; p.blockPoints = []; });
  OLINE_IDS.forEach(id => { olineData[id].blockPoints = []; });
  motionOwnerId = null;
  updateMotionBadge(); refreshPlayerList(); draw();
});

document.getElementById('clearAnnotationsBtn').addEventListener('click', () => {
  annotations = [];
  activeStroke = null;
  draw();
});

// Speed
document.getElementById('speedSlider').addEventListener('input', function() {
  simSpeed = +this.value;
  document.getElementById('speedVal').textContent = simSpeed + '×';
});

// ─────────────────────────────────────────────
// SIMULATION STATE MACHINE
// Phase order: shift → settle(1s) → motion → play
// Each phase is optional; skip if no players have that assignment.
// ─────────────────────────────────────────────
let simPhase    = 'play';  // 'shift' | 'settle' | 'preplay' | 'play'
let frozenRoleMap = null;  // Role assignments frozen at snap — never recalculated during sim
let persistentCovCalls = {};  // Coverage calls that must survive snapshot rebuilds (e.g. hookRbReleasedWeak3x1)
let settleTimer = 0;       // counts down during settle pause (seconds)
let motionHoldTimer = 0;   // ensures preplay phase lasts at least MOTION_MIN_DURATION
const SETTLE_DURATION      = 1;   // 1 second pause between shift and motion
const MOTION_MIN_DURATION  = 0.9; // minimum motion phase duration before play starts

// Ball snap animation state
let ballSim = { active: false, done: false, x: 0, y: 0, tx: 0, ty: 0 };
let _simInitialStrongSide = 'R';  // strong side at sim start — used for SAM/WILL swap detection
let _simOriginalRoles = new Map(); // defender id → original role — restored after sim

// ── Speed helper ──────────────────────────────
// O-Line move at 0.75× the base speed in simulation.
function getMoveSpeed(playerOrOlineData, baseSpeed) {
  // O-Line data objects have no 'type', skill players do.
  return (playerOrOlineData.type !== undefined) ? baseSpeed : baseSpeed * 0.5;
}

document.getElementById('simBtn').addEventListener('click', () => {
  if (mode === 'editor') startSim();
  else stopSim();
});

function setSimPhaseUI(phase) {
  const el = document.getElementById('simPhase');
  const map = {
    shift:   ['shift-phase',   'SHIFT'],
    settle:  ['settle-phase',  'SET'],
    preplay: ['motion-phase',  'PRE'],
    play:    ['play-phase',    'PLAY'],
  };
  const [cls, label] = map[phase] || ['play-phase', phase.toUpperCase()];
  el.className   = 'sim-phase visible ' + cls;
  el.textContent = label;
}

function startSim() {
  mode = 'sim';
  simPaused = false;
  document.getElementById('modeIndicator').textContent = 'SIMULATION';
  document.getElementById('modeIndicator').classList.add('sim-mode');
  document.getElementById('simBtn').textContent = '■ STOP';
  document.getElementById('simBtn').classList.remove('btn-sim');
  document.getElementById('simBtn').classList.add('btn-danger');
  document.getElementById('pauseBtn').style.display = '';
  document.getElementById('pauseBtn').textContent = '⏸ PAUSE';
  document.getElementById('debugLog').classList.add('visible');
  clearDebugLog();
  logDebug(`<span>SIM START</span> — ${players.length} skill + 5 oline`);

  // Reset ball snap — will activate when PlayPhase starts
  ballSim = { active: false, done: false, x: ball.x, y: ball.y, tx: 0, ty: 0 };

  // ── Freeze all player state ──────────────────────────────────────────
  players.forEach(p => {
    p.origX = p.x; p.origY = p.y;
    p.simStartX = p.x; p.simStartY = p.y;
    p.simRoutePoints  = p.routePoints.map(wp => ({x:wp.x, y:wp.y}));
    p.simMotionPoints = p.motionPoints.map(wp => ({x:wp.x, y:wp.y}));
    p.simShiftPoints  = p.shiftPoints.map(wp  => ({x:wp.x, y:wp.y}));
    p.simBlockPoints  = p.blockPoints.map(wp  => ({x:wp.x, y:wp.y}));
    p.simMotionStartX = p.x; p.simMotionStartY = p.y;
    p.simX = p.x; p.simY = p.y;
    p.simWpIdx = 0; p.simDone = false;
    logDebug(`<span>${p.label}#${p.id}</span> shift=${p.simShiftPoints.length} motion=${p.simMotionPoints.length} route=${p.simRoutePoints.length} block=${p.simBlockPoints.length}`);
  });

  // ── Freeze O-Line state ──────────────────────────────────────────────
  olinePlayers().forEach(ol => {
    const d = olineData[ol.id];
    d.simStartX    = ol.x; d.simStartY = ol.y;
    d.simX         = ol.x; d.simY      = ol.y;
    d.simBlockPoints = d.blockPoints.map(wp => ({x:wp.x, y:wp.y}));
    d.simWpIdx     = 0;
    d.simDone      = (d.simBlockPoints.length === 0);
  });

  // ── Choose starting phase ────────────────────────────────────────────
  const hasShift  = players.some(p => p.simShiftPoints.length > 0);
  const hasMotion = players.some(p => p.id === motionOwnerId && p.simMotionPoints.length > 0);

  // Phase 3.2: freeze defenders at their current positions
  _reactiveDTOver = Math.random() < 0.5; // freeze Over/Under for entire sim
  _simInitialStrongSide = offenseStructureSnapshot?.strongSide || 'R'; // track for SAM/WILL swap
  _simOriginalRoles.clear();
  defensePlayers.forEach(d => _simOriginalRoles.set(d.id, d.role)); // save roles for restore
  initDefendersForSim();

  if (hasShift) {
    initShiftPhase();
  } else {
    // Always run preplay phase (0.3s min if no motion, else motion duration)
    initPreplayPhase();
  }

  lastTime = null;
  animateSim();
}

// ── Phase initialisers ────────────────────────────────────────────────

function initShiftPhase() {
  simPhase = 'shift';
  setSimPhaseUI('shift');
  logDebug('<span>SHIFT PHASE</span> — skill players with shift move simultaneously');

  players.forEach(p => {
    p.simWpIdx = 0;
    p.simDone  = (p.simShiftPoints.length === 0);
  });
  olinePlayers().forEach(ol => { olineData[ol.id].simDone = true; });
}

function initSettlePhase() {
  simPhase    = 'settle';
  settleTimer = SETTLE_DURATION;
  setSimPhaseUI('settle');
  logDebug(`<span>SETTLE</span> — ${SETTLE_DURATION}s pause`);

  // Everyone stands still
  players.forEach(p => { p.simDone = true; });
  olinePlayers().forEach(ol => { olineData[ol.id].simDone = true; });
}

function initPreplayPhase() {
  simPhase = 'preplay';
  setSimPhaseUI('preplay');
  const mp = players.find(p => p.id === motionOwnerId && p.simMotionPoints.length > 0);

  if (mp) {
    // Motion exists → timer = 0 (no minimum), runs as long as motion takes
    motionHoldTimer = 0;
    logDebug(`<span>PREPLAY PHASE</span> — motion: ${mp.label}#${mp.id}`);
    players.forEach(p => {
      p.simWpIdx = 0;
      p.simDone  = (p.id !== mp.id);
    });
    mp.simDone = false;
  } else {
    // No motion → 0.3s fixed hold, everyone stands still
    motionHoldTimer = MOTION_MIN_DURATION;
    logDebug(`<span>PREPLAY PHASE</span> — no motion, ${MOTION_MIN_DURATION}s hold`);
    players.forEach(p => { p.simDone = true; });
  }
  olinePlayers().forEach(ol => { olineData[ol.id].simDone = true; });

  // Sky: targets will be built at 0.05s into preplay (see tick)
  // posMap and targets computed lazily in preplay tick to allow settle to finish
}

// Called when motion phase ends (or skipped) → starts play phase for all
function initPlayPhase() {
  simPhase = 'play';
  setSimPhaseUI('play');
  logDebug('<span>PLAY PHASE</span> — all players go');

  // Reset run handoff state
  runHandoffState = 'idle'; runHandoffTimer = 0; ballOwner = null;
  _tackleTimerActive = false; _tackleTimer = 0;

  players.forEach(p => {
    p.simWpIdx = 0;
    const hasRoute = p.simRoutePoints && p.simRoutePoints.length > 0;
    const hasBlock = p.simBlockPoints && p.simBlockPoints.length > 0;
    p.simDone = !(hasRoute || hasBlock);
    // Designated block target: activate immediately only if no block path
    // If there's a block path, chase starts after path completes
    p._blockChaseTargetId = (p._designatedBlockTargetId != null && !hasBlock) ? p._designatedBlockTargetId : null;
    p._blockChaseDone = false;
    p._blockHoldX = null; p._blockHoldY = null;
    p._blockDistTraveled = 0;
    p._blockLocked = false;
    if (p._designatedBlockTargetId != null) p.simDone = false;
  });

  olinePlayers().forEach(ol => {
    const d = olineData[ol.id];
    const hasBlock = d.simBlockPoints && d.simBlockPoints.length > 0;
    d.simWpIdx = 0;
    d.simDone  = (!hasBlock && d._designatedBlockTargetId == null);
    // Same logic: chase starts after block path if both exist
    d._blockChaseTargetId = (d._designatedBlockTargetId != null && !hasBlock) ? d._designatedBlockTargetId : null;
    d._blockChaseDone = false;
    d._blockHoldX = null; d._blockHoldY = null;
    d._blockDistTraveled = 0;
    d._blockLocked = false;
  });

  // Ball snap: travels from LOS to QB position at play phase start
  const qb = players.find(p => p.type === 'QB');
  if (qb) {
    ballSim.active = true;
    ballSim.done   = false;
    ballSim.x      = ball.x;
    ballSim.y      = ball.y;
    ballSim.tx     = qb.simStartX;
    ballSim.ty     = qb.simStartY;
    logDebug(`<span>SNAP</span> → QB#${qb.id} at (${Math.round(qb.simStartX)},${Math.round(qb.simStartY)})`);
  }

  // Phase 3.1: Initialise live read tracking at play start (t=0)
  // rebuildOffenseStructureSnapshot runs inside draw(), but we need snapshot
  // to already exist here → call it once immediately.
  rebuildOffenseStructureSnapshot();

  // Re-seed defender decisions based on post-motion/shift offense formation.
  // Roles (APEX, HOOK, CB etc.) depend on where offense players ended up.
  // preserveSimPos=true: keep simX/simY from presnap phase, don't teleport back to editor pos.
  initDefendersForSim(true);

  // Freeze role assignments at snap — never recalculated during sim
  {
    const snap = offenseStructureSnapshot;
    const dPlayers = defensePlayers;
    const bx  = snap?.ballX ?? ball.x;
    const ly  = snap?.losY  ?? LOS_Y();
    resolveActivePreset(snap);
    const preset = PRESET_REGISTRY[activePreset];
    frozenRoleMap = classifyAllRoles(dPlayers, bx, ly,
      preset?.isOneHigh ?? false,
      snap?.coverageStrongSide ?? 'R');
    persistentCovCalls = {};  // Reset persistent calls at snap
  }

  initLiveReadsForPlayStart();

  // Coverage engine: record snap alignment (x/y at snap time)
  snapCoverageAlignment();
}

function stopSim() {
  mode = 'editor';
  simPaused = false;
  frozenRoleMap = null;
  persistentCovCalls = {};
  if (animId) cancelAnimationFrame(animId);
  animId = null; lastTime = null;
  document.getElementById('modeIndicator').textContent = 'EDITOR MODE';
  document.getElementById('modeIndicator').classList.remove('sim-mode');
  document.getElementById('simBtn').textContent = '▶ SIMULATE';
  document.getElementById('simBtn').classList.add('btn-sim');
  document.getElementById('simBtn').classList.remove('btn-danger');
  document.getElementById('pauseBtn').style.display = 'none';
  document.getElementById('pauseBtn').textContent = '⏸ PAUSE';
  document.getElementById('simPhase').classList.remove('visible');

  // Restore skill players to pre-snap positions
  players.forEach(p => {
    if (p.simStartX !== undefined) {
      p.x = p.simStartX; p.y = p.simStartY;
      p.origX = p.simStartX; p.origY = p.simStartY;
    }
    p.simX = p.x; p.simY = p.y;
    p._velX = undefined; p._velY = undefined;
    p._prevSimX = undefined; p._prevSimY = undefined;
  });

  OLINE_IDS.forEach(id => {
    olineData[id].simX = undefined; olineData[id].simY = undefined;
    olineData[id].simBlockPoints = undefined; olineData[id].simDone = false;
  });

  ballSim = { active: false, done: false, x: ball.x, y: ball.y, tx: 0, ty: 0 };
  liveReadStateById = {};  // Phase 3.1: clear live read state
  playPhaseTime = 0;
  runHandoffState = 'idle'; runHandoffTimer = 0; ballOwner = null;  // reset handoff
  _tackleTimerActive = false; _tackleTimer = 0;  // reset tackle auto-pause
  resetCoverageAlignment();    // Coverage engine: clear snap alignment
  resetSwitchState();          // clear per-play coverage locks
  resetDefendersAfterSim();    // Phase 3.2: restore sim positions
  logDebug('<span>SIM STOP</span> — positions restored');
  setTimeout(() => document.getElementById('debugLog').classList.remove('visible'), 2500);
  draw();
}

// Move a player along a waypoint list. Returns true when done.
// The speed parameter must already be adjusted per-player via getMoveSpeed().
function stepPlayer(p, pts, dt, speed) {
  if (!pts || pts.length === 0) return true;

  while (p.simWpIdx < pts.length) {
    const t = pts[p.simWpIdx];
    if (Math.hypot(t.x - p.simX, t.y - p.simY) <= ARRIVE_THRESHOLD) {
      p.simX = t.x; p.simY = t.y;
      p.simWpIdx++;
    } else break;
  }
  if (p.simWpIdx >= pts.length) return true;

  const tgt  = pts[p.simWpIdx];
  const dx   = tgt.x - p.simX, dy = tgt.y - p.simY;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;

  if (dist <= step + ARRIVE_THRESHOLD) {
    p.simX = tgt.x; p.simY = tgt.y; p.simWpIdx++;
  } else {
    p.simX += (dx/dist)*step; p.simY += (dy/dist)*step;
  }
  return p.simWpIdx >= pts.length;
}

// ── Block chase: after reaching block endpoint, pursue nearest unblocked defender ──
const BLOCK_CHASE_RADIUS_YD = 3;
const BLOCK_CHASE_RADIUS_PX = BLOCK_CHASE_RADIUS_YD * YARD_PX;
const BLOCK_EARLY_SEARCH_YD = 3;  // yards traveled before starting to search for defenders
const BLOCK_EARLY_SEARCH_PX = BLOCK_EARLY_SEARCH_YD * YARD_PX;

function getBlockedDefenderIds() {
  // Collect defender ids that are already being chased by a blocker
  const ids = new Set();
  players.forEach(p => { if (p._blockChaseTargetId != null) ids.add(p._blockChaseTargetId); });
  OLINE_IDS.forEach(id => { const d = olineData[id]; if (d._blockChaseTargetId != null) ids.add(d._blockChaseTargetId); });
  return ids;
}

function tryStartBlockChase(blocker, spd, setDoneIfEmpty = true) {
  // Called when path finished (setDoneIfEmpty=true) or during early search (setDoneIfEmpty=false)
  if (blocker._blockChaseTargetId != null || blocker._blockChaseDone) return;

  // Designated target takes absolute priority over auto-search
  if (blocker._designatedBlockTargetId != null) {
    blocker._blockChaseTargetId = blocker._designatedBlockTargetId;
    blocker.simDone = false;
    return;
  }

  const bx = blocker.simX ?? blocker.x;
  const by = blocker.simY ?? blocker.y;
  const alreadyChased = getBlockedDefenderIds();
  let nearest = null, nearestDist = Infinity;
  defensePlayers.forEach(d => {
    if (alreadyChased.has(d.id)) return;
    const dx = (d.simX ?? d.x) - bx;
    const dy = (d.simY ?? d.y) - by;
    const dist = Math.hypot(dx, dy);
    if (dist <= BLOCK_CHASE_RADIUS_PX && dist < nearestDist) {
      nearestDist = dist; nearest = d;
    }
  });
  if (nearest) {
    blocker._blockChaseTargetId = nearest.id;
    blocker.simDone = false;
  } else if (setDoneIfEmpty) {
    blocker._blockChaseDone = true;
  }
}

function stepBlockChase(blocker, dt, spd) {
  if (blocker._blockChaseTargetId == null) return;
  const target = defensePlayers.find(d => d.id === blocker._blockChaseTargetId);
  if (!target) { blocker._blockChaseDone = true; blocker._blockChaseTargetId = null; blocker.simDone = true; return; }
  const bx = blocker.simX ?? blocker.x;
  const by = blocker.simY ?? blocker.y;
  const tx = target.simX ?? target.x;
  const ty = target.simY ?? target.y;

  // Anticipate where defender will be: use their velocity if available
  const dvx = target._velX || 0;
  const dvy = target._velY || 0;
  const distToDef = Math.hypot(tx - bx, ty - by);
  const timeToReach = spd > 0 ? distToDef / spd : 0;
  const LOOKAHEAD = Math.min(timeToReach * 0.6, 0.5); // cap at 0.5s lookahead
  const aimX = tx + dvx * LOOKAHEAD;
  const aimY = ty + dvy * LOOKAHEAD;

  const dx = aimX - bx, dy = aimY - by;
  const dist = Math.hypot(dx, dy);
  const step = spd * dt;
  if (dist <= BLOCK_HOLD_DIST + 2) {
    blocker._blockHoldX = null;
    blocker._blockHoldY = null;
  } else {
    blocker.simX = bx + (dx / dist) * step;
    blocker.simY = by + (dy / dist) * step;
  }
}


// ── Block hold: blocker pushes defender back at 2 yards/sec, both move together ──
const BLOCK_HOLD_DIST = 14; // px — blocker body radius for contact
function stepBlockHold(blocker, dt, spd) {
  if (blocker._blockChaseTargetId == null) return;
  const target = defensePlayers.find(d => d.id === blocker._blockChaseTargetId);
  if (!target) { blocker._blockChaseTargetId = null; blocker.simDone = true; return; }

  const bx = blocker.simX ?? blocker.x;
  const by = blocker.simY ?? blocker.y;
  const tx = target.simX ?? target.x;
  const ty = target.simY ?? target.y;
  const dist = Math.hypot(tx - bx, ty - by);

  if (dist <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS) {
    // Contact — mark both as engaged
    target._blockLocked  = true;
    blocker._blockLocked = true;

    // Push direction: from blocker toward defender (dynamic each frame)
    if (dist > 0.1) {
      const PUSH_SPEED = 1 * YARD_PX * simSpeed; // 1 yard/sec in px/sec, scaled by sim speed
      const step = PUSH_SPEED * dt;
      const nx = (tx - bx) / dist;
      const ny = (ty - by) / dist;

      // Move both in push direction
      target.simX  = tx + nx * step;
      target.simY  = ty + ny * step;
      blocker.simX = bx + nx * step;
      blocker.simY = by + ny * step;
    }
  } else {
    // Lost contact — move blocker back toward defender
    blocker._blockLocked = false;
    target._blockLocked  = false;
    const step = spd * dt;
    const dx = tx - bx, dy = ty - by;
    blocker.simX = bx + (dx / dist) * Math.min(step, dist);
    blocker.simY = by + (dy / dist) * Math.min(step, dist);
  }
}

function animateSim(ts) {
  if (!ts) { animId = requestAnimationFrame(animateSim); return; }
  const dt       = lastTime ? Math.min((ts-lastTime)/1000, 0.1) : 0;
  lastTime       = ts;
  const baseSpeed = simSpeed * 80;

  // ── SHIFT PHASE ──────────────────────────────────────────────────────
  if (simPhase === 'shift') {
    let allDone = true;
    players.forEach(p => {
      if (p.simDone) return;
      const spd  = getMoveSpeed(p, baseSpeed);
      if (stepPlayer(p, p.simShiftPoints, dt, spd)) {
        p.simDone = true;
      } else {
        allDone = false;
      }
    });
    stepDefensePresnapSlide(dt);  // Phase 3.3: X-only defense slide during shift
    if (reactiveFormationActive) reactiveFormationSimStep(dt);
    if (allDone) {
      // After shift → update motion start positions (players shifted, so motion starts from new pos)
      players.forEach(p => {
        p.simMotionStartX = p.simX;
        p.simMotionStartY = p.simY;
      });
      logDebug('<span>SHIFT DONE</span>');
      // Always pause after shift (settle), then decide motion vs play
      initSettlePhase();
    }

  // ── SETTLE PHASE (1s pause) ──────────────────────────────────────────
  } else if (simPhase === 'settle') {
    stepDefensePresnapSlide(dt);  // Phase 3.3: defenders continue X-slide during settle
    if (reactiveFormationActive) reactiveFormationSimStep(dt);
    settleTimer -= dt * simSpeed;
    if (settleTimer <= 0) {
      logDebug('<span>SETTLE DONE</span>');
      // Always go through preplay phase
      initPreplayPhase();
    }

  // ── PREPLAY PHASE ─────────────────────────────────────────────────────
  } else if (simPhase === 'preplay') {
    motionHoldTimer = Math.max(0, motionHoldTimer - dt * simSpeed);

    const mp = players.find(p => p.id === motionOwnerId && !p.simDone);
    if (mp) {
      const spd  = getMoveSpeed(mp, baseSpeed);
      const done = stepPlayer(mp, mp.simMotionPoints, dt, spd);
      stepDefensePresnapSlide(dt);
      if (reactiveFormationActive) reactiveFormationSimStep(dt);  // motion → defense reacts
      if (done) { mp.simWpIdx = 0; mp.simDone = true; }
    } else {
      stepDefensePresnapSlide(dt);
      // No motion player — defense stays put, don't re-trigger reactive
    }

    // Advance to play once motion done AND hold elapsed
    const motionDone = !players.some(p => p.id === motionOwnerId && !p.simDone && p.simMotionPoints.length > 0);
    if (motionDone && motionHoldTimer <= 0) {
      initPlayPhase();
    }

  // ── PLAY PHASE ───────────────────────────────────────────────────────
  } else {
    // Ball snap animation
    if (ballSim.active && !ballSim.done) {
      const dx   = ballSim.tx - ballSim.x;
      const dy   = ballSim.ty - ballSim.y;
      const dist = Math.hypot(dx, dy);
      const step = baseSpeed * 1.8 * dt;
      if (dist <= step + ARRIVE_THRESHOLD) {
        ballSim.x = ballSim.tx; ballSim.y = ballSim.ty;
        ballSim.done = true;
      } else {
        ballSim.x += (dx/dist)*step; ballSim.y += (dy/dist)*step;
      }
    }

    // ── RUN PLAY ─────────────────────────────────────────────────────
    if (playType === 'run') {
      // Advance playPhaseTime so stepDefenseRunFit's RUN_COMMIT_DELAY fires.
      playPhaseTime += dt * simSpeed;

      const carrier = runCarrierId ? players.find(p => p.id === runCarrierId) : null;
      const qb      = players.find(p => p.type === 'QB');

      // ── Snap: ball travels to QB (same as pass) ──────────────────
      // ballSim is already kicked off in initPlayPhase — nothing extra needed.

      // ── Handoff state machine ────────────────────────────────────
       // 'idle'       -> carrier runs route freely; waiting for snap.
       // 'approaching'-> snap done but carrier too far; jogs to QB.
       // 'handoff'    -> 0.1s exchange; both stand still.
       // 'carrying'   -> carrier runs route; QB holds/fakes.
       const HANDOFF_ARRIVE = 20; // px ~1 yard
       if (carrier && !carrier.simDone) {

         // QB is the carrier (QB keeper/scramble) — wait for snap, skip handoff
         const qbIsCarrier = qb && carrier.id === qb.id;

         // idle: carrier runs route immediately at snap (unless carrier IS the QB)
         if (runHandoffState === 'idle') {
           if (qbIsCarrier) {
             // QB carrier: stand still until ball arrives, then go straight to carrying
             if (ballSim.done) {
               runHandoffState = 'carrying';
               ballOwner       = carrier.id;
             }
           } else {
             // Normal RB carrier: run route immediately, check for handoff after snap
             const spd = getMoveSpeed(carrier, baseSpeed) * 1.05;
             if (carrier.simRoutePoints && carrier.simRoutePoints.length > 0) {
               stepPlayer(carrier, carrier.simRoutePoints, dt, spd);
             }
             // Once snap done, check distance for handoff
             if (ballSim.done) {
               const qbX = qb ? (qb.simX ?? qb.x) : ball.x;
               const qbY = qb ? (qb.simY ?? qb.y) : ball.y;
               const cX  = carrier.simX ?? carrier.x;
               const cY  = carrier.simY ?? carrier.y;
               const dist = Math.hypot(qbX - cX, qbY - cY);
               if (dist <= HANDOFF_ARRIVE) {
                 runHandoffState = 'handoff';
                 runHandoffTimer = 0;
                 carrier.simX = qbX; carrier.simY = qbY;
               } else {
                 runHandoffState = 'approaching';
               }
             }
           }
         }

         if (runHandoffState === 'approaching') {
           const qbX = qb ? (qb.simX ?? qb.x) : ball.x;
           const qbY = qb ? (qb.simY ?? qb.y) : ball.y;
           const cX  = carrier.simX ?? carrier.x;
           const cY  = carrier.simY ?? carrier.y;
           const dist = Math.hypot(qbX - cX, qbY - cY);
           if (dist <= HANDOFF_ARRIVE) {
             runHandoffState = 'handoff';
             runHandoffTimer = 0;
             carrier.simX = qbX; carrier.simY = qbY;
           } else {
             const spd = baseSpeed * 0.9 * dt;
             carrier.simX = cX + (qbX - cX) / dist * spd;
             carrier.simY = cY + (qbY - cY) / dist * spd;
           }
         }

         if (runHandoffState === 'handoff') {
           runHandoffTimer += dt * simSpeed;
           if (runHandoffTimer >= HANDOFF_DURATION) {
             runHandoffState = 'carrying';
             ballOwner       = carrier.id;
           }
           // Both stand still during exchange
         }

         if (runHandoffState === 'carrying') {
           const spd = getMoveSpeed(carrier, baseSpeed) * 1.05;
           if (carrier.simRoutePoints && carrier.simRoutePoints.length > 0) {
             if (stepPlayer(carrier, carrier.simRoutePoints, dt, spd)) carrier.simDone = true;
           }
         }
       }

      // Non-carrier skill players (blockers, WR chips, etc.) always run their paths
      players.forEach(p => {
        if (p.id === runCarrierId) return; // carrier handled above
        // QB must wait for snap to arrive before moving
        if (p.type === 'QB' && !ballSim.done) return;
        const spd = getMoveSpeed(p, baseSpeed);
        if (p._blockChaseTargetId != null) {
          const target = defensePlayers.find(d => d.id === p._blockChaseTargetId);
          if (target) {
            const dist = Math.hypot((target.simX ?? target.x) - (p.simX ?? p.x), (target.simY ?? target.y) - (p.simY ?? p.y));
            if (dist <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) { stepBlockHold(p, dt, spd); } else { stepBlockChase(p, dt, spd); }
          } else { stepBlockChase(p, dt, spd); }
          return;
        }
        if (p.simDone) return;
        // Run play: blockPoints take priority over routePoints (WR blocks)
        const hasBlock = p.simBlockPoints && p.simBlockPoints.length > 0;
        const hasRoute = p.simRoutePoints && p.simRoutePoints.length > 0;
        if (hasBlock) {
          const done = stepPlayer(p, p.simBlockPoints, dt, spd);
          if (p._blockChaseTargetId != null) {
            stepBlockChase(p, dt, spd);
          } else if (done) {
            tryStartBlockChase(p, spd, true); // end of path — set done if nobody found
          } else {
            // Early search from 2nd blockpoint onward (don't set done if nobody found)
            const searchActive = p.simBlockPoints.length >= 2 ? p.simWpIdx >= 1 : false;
            if (!p._blockChaseDone && searchActive) tryStartBlockChase(p, spd, false);
          }
        } else if (hasRoute) {
          if (stepPlayer(p, p.simRoutePoints, dt, spd)) p.simDone = true;
        }
      });
      OLINE_IDS.forEach(id => {
        const d = olineData[id];
        const spd2 = getMoveSpeed(d, baseSpeed);
        if (d._blockChaseTargetId != null) {
          const target = defensePlayers.find(def => def.id === d._blockChaseTargetId);
          if (target) {
            const dist = Math.hypot((target.simX ?? target.x) - (d.simX ?? d.x), (target.simY ?? target.y) - (d.simY ?? d.y));
            if (dist <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) { stepBlockHold(d, dt, spd2); } else { stepBlockChase(d, dt, spd2); }
          } else { stepBlockChase(d, dt, spd2); }
          return;
        }
        if (!d.simDone && d.simBlockPoints && d.simBlockPoints.length > 0) {
          const done = stepPlayer(d, d.simBlockPoints, dt, spd2);
          if (d._blockChaseTargetId != null) {
            stepBlockChase(d, dt, spd2);
          } else if (done) {
            tryStartBlockChase(d, spd2, true);
          } else {
            const searchActive = d.simBlockPoints.length >= 2 ? d.simWpIdx >= 1 : false;
            if (!d._blockChaseDone && searchActive) tryStartBlockChase(d, spd2, false);
          }
        }
      });

      // Defense: run fit logic (with predictive pursuit for CB/S)
      stepDefenseRunFit(dt);

      // ── Tackle check ─────────────────────────────────────────────
      // Only check once carrier actually has the ball (carrying state)
      if (runCarrierId && runHandoffState === 'carrying') {
        const car = players.find(p => p.id === runCarrierId);
        if (car && !car.simDone) {
          const cX = car.simX ?? car.x;
          const cY = car.simY ?? car.y;
          const tackled = defensePlayers.some(d => {
            const dX = d.simX ?? d.x;
            const dY = d.simY ?? d.y;
            const radius = d._blockLocked ? 5 : 8; // blocked defenders have reduced tackle radius
            return Math.hypot(dX - cX, dY - cY) <= radius;
          });
          if (tackled) {
            car.simDone = true;
            if (!_tackleTimerActive) {
              _tackleTimerActive = true;
              _tackleTimer = 1.0; // auto-pause after 1 sim second
            }
          }
        }
      }

    // ── PASS PLAY ─────────────────────────────────────────────────────
    } else {
      // Skill players — route or block
      players.forEach(p => {
        // QB must wait for snap to arrive before moving
        if (p.type === 'QB' && !ballSim.done) return;
        const spd = getMoveSpeed(p, baseSpeed);
        if (p._blockChaseTargetId != null) {
          const target = defensePlayers.find(d => d.id === p._blockChaseTargetId);
          if (target) {
            const dist = Math.hypot((target.simX ?? target.x) - (p.simX ?? p.x), (target.simY ?? target.y) - (p.simY ?? p.y));
            if (dist <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) { stepBlockHold(p, dt, spd); } else { stepBlockChase(p, dt, spd); }
          } else { stepBlockChase(p, dt, spd); }
          return;
        }
        if (p.simDone) return;
        const hasBlock = p.simBlockPoints && p.simBlockPoints.length > 0;
        const hasRoute = p.simRoutePoints && p.simRoutePoints.length > 0;
        if (hasBlock) {
          const done = stepPlayer(p, p.simBlockPoints, dt, spd);
          if (p._blockChaseTargetId != null) {
            stepBlockChase(p, dt, spd);
          } else if (done) {
            tryStartBlockChase(p, spd, true);
          } else {
            const searchActive = p.simBlockPoints.length >= 2 ? p.simWpIdx >= 1 : false;
            if (!p._blockChaseDone && searchActive) tryStartBlockChase(p, spd, false);
          }
        } else if (hasRoute) {
          if (stepPlayer(p, p.simRoutePoints, dt, spd)) p.simDone = true;
        }
      });

      // O-Line blockers — 0.5× speed via getMoveSpeed
      OLINE_IDS.forEach(id => {
        const d = olineData[id];
        const spd2 = getMoveSpeed(d, baseSpeed);
        if (d._blockChaseTargetId != null) {
          const target = defensePlayers.find(def => def.id === d._blockChaseTargetId);
          if (target) {
            const dist = Math.hypot((target.simX ?? target.x) - (d.simX ?? d.x), (target.simY ?? target.y) - (d.simY ?? d.y));
            if (dist <= BLOCK_HOLD_DIST + DEF_PLAYER_RADIUS + 2) { stepBlockHold(d, dt, spd2); } else { stepBlockChase(d, dt, spd2); }
          } else { stepBlockChase(d, dt, spd2); }
          return;
        }
        if (!d.simDone && d.simBlockPoints && d.simBlockPoints.length > 0) {
          const done = stepPlayer(d, d.simBlockPoints, dt, spd2);
          if (d._blockChaseTargetId != null) {
            stepBlockChase(d, dt, spd2);
          } else if (done) {
            tryStartBlockChase(d, spd2, true);
          } else {
            const searchActive = d.simBlockPoints.length >= 2 ? d.simWpIdx >= 1 : false;
            if (!d._blockChaseDone && searchActive) tryStartBlockChase(d, spd2, false);
          }
        }
      });

      // Phase 3.1: update live read states after all offense positions are settled
      updateLiveReads(dt);

      // Phase 3.2.5: compute decision from assignment for each defender this tick
      updateDefenseDecisions(offenseStructureSnapshot, liveReadStateById, dt);

      // Phase 3.2.5: move defenders — reads only d.decision, never d.assignment
      stepDefensePlayers(dt);
    }
  }

  // ── TACKLE AUTO-PAUSE: count down and pause after 1 sim second ──
  if (_tackleTimerActive) {
    _tackleTimer -= dt;
    if (_tackleTimer <= 0) {
      _tackleTimerActive = false;
      if (!simPaused) togglePause();  // only pause, don't unpause if already paused
    }
  }

  draw();
  animId = requestAnimationFrame(animateSim);
}

