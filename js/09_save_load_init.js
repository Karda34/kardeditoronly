// ─────────────────────────────────────────────
// SAVE / LOAD
// ─────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', () => {
  const data = {
    ball: { x: ball.x, y: ball.y },
    motionOwnerId,
    annotations,
    olineBlocks: Object.fromEntries(
      OLINE_IDS.map(id => [id, olineData[id].blockPoints])
    ),
    players: players.map(p => ({
      id: p.id, type: p.type, label: p.label,
      x: p.x, y: p.y, origX: p.origX, origY: p.origY,
      important:    p.important,
      routePoints:  p.routePoints,
      motionPoints: p.motionPoints,
      shiftPoints:  p.shiftPoints,
      blockPoints:  p.blockPoints,
      routes: p.routePoints, // legacy compat
    })),
    // Phase 3.2: save defenders
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
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'play.json'; a.click();
});

document.getElementById('loadBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const skillInFile = (data.players||[]).filter(p => SKILL_TYPES.includes(p.type));
      if (skillInFile.length > SKILL_LIMIT) {
        showToast(`⚠ LOAD ABORTED — ${skillInFile.length} skill players (max ${SKILL_LIMIT})`); return;
      }

      ball.x = data.ball.x; ball.y = data.ball.y;
      annotations  = (data.annotations || []).map(s => s.map(pt => ({ x: pt.x, y: pt.y })));
      activeStroke = null;

      // Restore O-Line block points
      if (data.olineBlocks) {
        OLINE_IDS.forEach(id => {
          const raw = data.olineBlocks[id];
          if (Array.isArray(raw)) {
            olineData[id].blockPoints = raw.map(w => ({x:w.x, y:w.y}));
          } else if (raw && typeof raw === 'object' && 'x' in raw) {
            // legacy: single blockTarget object → wrap in array
            olineData[id].blockPoints = [{x:raw.x, y:raw.y}];
          } else {
            olineData[id].blockPoints = [];
          }
        });
      } else {
        OLINE_IDS.forEach(id => { olineData[id].blockPoints = []; });
      }

      players = (data.players||[]).map(p => {
        // Clamp loaded position to LOS constraint (handles stale/invalid saves)
        const cpos = clampToLOS(p.x, p.y);
        const np = makePlayer(p.type, cpos.x, cpos.y);
        np.id    = p.id;
        np.label = p.label;
        np.origX = cpos.x;
        np.origY = cpos.y;
        np.routePoints  = (p.routePoints  || p.routes || []).map(w=>({x:w.x,y:w.y}));
        np.motionPoints = (p.motionPoints || []).map(w=>({x:w.x,y:w.y}));
        np.shiftPoints  = (p.shiftPoints  || []).map(w=>({x:w.x,y:w.y}));
        // Support new blockPoints array AND legacy single blockTarget
        if (Array.isArray(p.blockPoints)) {
          np.blockPoints = p.blockPoints.map(w=>({x:w.x,y:w.y}));
        } else if (p.blockTarget && typeof p.blockTarget === 'object') {
          np.blockPoints = [{x:p.blockTarget.x, y:p.blockTarget.y}];
        } else {
          np.blockPoints = [];
        }
        np.important = p.important === true;
        return np;
      });

      // Enforce single motion owner: take first with motionPoints, clear others
      let foundMotion = false;
      motionOwnerId = null;
      players.forEach(p => {
        if (p.motionPoints.length > 0) {
          if (!foundMotion) { motionOwnerId = p.id; foundMotion = true; }
          else { p.motionPoints = []; } // remove extra motion owners
        }
      });

      // Restore saved motionOwnerId if it matches
      if (data.motionOwnerId !== undefined) {
        const savedOwner = players.find(p => p.id === data.motionOwnerId && p.motionPoints.length > 0);
        if (savedOwner) motionOwnerId = savedOwner.id;
      }

      nextId = Math.max(...players.map(p=>p.id), 0) + 1;
      selectedPlayerId = null;

      // Phase 3.2: restore defenders (backwards compatible — absent = empty)
      defensePlayers = (data.defensePlayers || []).map(d => {
        const asg = d.assignment ? { ...d.assignment } : { type: 'none' };
        return {
          id: d.id, team: 'D', role: d.role || 'CB',
          x: d.x, y: d.y, origX: d.origX ?? d.x, origY: d.origY ?? d.y,
          simX: d.x, simY: d.y,
          assignment: asg,
          speedMultiplier: d.speedMultiplier ?? 1.0,
          isDefender: true,
          simZoneDone: false,
          cbSpacing: d.cbSpacing || 'normal',
          cbShade:   d.cbShade   || 'normal',
          mirroredWRId: d.mirroredWRId ?? null,
          decision: assignmentToDecision(asg),
        };
      });
      nextDefId = data.nextDefId ?? (defensePlayers.length > 0 ? Math.max(...defensePlayers.map(d=>d.id)) + 1 : 1);
      selectedDefId = null;
      refreshDefPlayerList();
      refreshDefAssignBox();

      refreshPlayerList(); refreshSkillCounter(); updateMotionBadge(); draw();
      if (activePreset !== 'manual') refreshPresetMatchList();
      updateFormationBadge();
      showToast(`✓ Play loaded — ${players.length} off + ${defensePlayers.length} def`, 'info');
    } catch(err) { showToast('⚠ Invalid or corrupted play file'); }
  };
  reader.readAsText(file); this.value = '';
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
addPlayer('QB');         // always start with a QB on the field
selectedPlayerId = null; // deselect after auto-add
refreshPlayerList();
refreshSkillCounter();
updateMotionBadge();
updateInfoBar();
draw();
updateFormationBadge();
refreshDefPlayerList();
refreshDefAssignBox();
// Reactive formation: pre-snap active by default
document.getElementById('reactiveFormationBtn')?.classList.add('active');

// ── Collapsible panels ───────────────────────────────────────
function collapsePanel(side) {
  if (side === 'offense') {
    document.getElementById('offensePanel').classList.add('collapsed');
    document.getElementById('offensePanelOpenBtn').style.display = '';
  } else {
    document.getElementById('defensePanel').classList.add('collapsed');
    document.getElementById('defensePanelOpenBtn').style.display = '';
  }
  resizeCanvas();
}
function expandPanel(side) {
  if (side === 'offense') {
    document.getElementById('offensePanel').classList.remove('collapsed');
    document.getElementById('offensePanelOpenBtn').style.display = 'none';
  } else {
    document.getElementById('defensePanel').classList.remove('collapsed');
    document.getElementById('defensePanelOpenBtn').style.display = 'none';
  }
  resizeCanvas();
}

// ── Responsive canvas — sidelines anchored to panel edges ─────
function resizeCanvas() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  if (wrapW <= 0 || wrapH <= 0) return;

  const fieldAR = FIELD_W / FIELD_H;
  let cssW, cssH;
  if (wrapW / wrapH > fieldAR) {
    cssH = wrapH;
    cssW = cssH * fieldAR;
  } else {
    cssW = wrapW;
    cssH = cssW / fieldAR;
  }

  canvas.style.width  = Math.round(cssW) + 'px';
  canvas.style.height = Math.round(cssH) + 'px';
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50);

// ── Change Position handler ──────────────────────────────────
function onDefChangePosition() {
  const sel = document.getElementById('defChangePosition');
  if (!sel || !sel.value) return;
  const d = defensePlayers.find(dd => dd.id === selectedDefId);
  if (!d) return;
  d.role = sel.value;
  sel.value = ''; // reset dropdown
  refreshDefPlayerList();
  refreshDefAssignBox();
  draw();
}


// ═══════════════════════════════════════════════════════════════════
// OFFENSE PLAY PRESETS
// Eligible receivers numbered 1-5 from strong side to weak side.
// #1 = widest strong, ... , #5 = widest weak / backfield last.
// ═══════════════════════════════════════════════════════════════════

function getPlayEligibles() {
  // Build snapshot if needed
  if (!offenseStructureSnapshot) rebuildOffenseStructureSnapshot();
  const snap = offenseStructureSnapshot;
  if (!snap) return [];

  const strong = snap.strongSide || 'R';

  // Collect all non-OL, non-QB players
  const elig = players.filter(p => !p.isOline && p.type !== 'QB');

  // Strong side sideline X
  const strongSidelineX = strong === 'R' ? FIELD_RIGHT : FIELD_LEFT;

  // Sort ALL eligible players by distance from the strong side sideline (closest = #1)
  elig.sort((a, b) => {
    const aX = getSnapPos(a).x;
    const bX = getSnapPos(b).x;
    return Math.abs(aX - strongSidelineX) - Math.abs(bX - strongSidelineX);
  });

  return elig;
}

// ── Route direction helpers ───────────────────────────────────────────────
// Returns ±1: direction from player toward center of field.
// Center player (directly behind QB) → toward coverage weak side.
function _routeToCenter(px, snap) {
  if (Math.abs(px - snap.ballX) < YARD_PX * 0.5) {
    // Center player → weak side
    return snap.coverageStrongSide === 'R' ? -1 : 1;
  }
  return px > snap.ballX ? -1 : 1; // right player → left, left player → right
}
function _routeToSide(px, snap) { return -_routeToCenter(px, snap); }

// ── ROUTE_LIBRARY ─────────────────────────────────────────────────────────
// Each entry: (player, snap) → waypoint array [{x, y}, ...]
// Uses snap.losY, snap.ballX, snap.coverageStrongSide.
const ROUTE_LIBRARY = {

  // 1. Hitch — 2yd stem, 140° break toward center, 1yd back
  'hitch': (p, snap) => {
    const px     = getSnapPos(p).x;
    const losY   = snap.losY;
    const toCtr  = _routeToCenter(px, snap);
    const stemY  = losY - 2 * YARD_PX;
    const ang    = 40 * Math.PI / 180; // 140° break = 40° off from straight back
    return [
      { x: px, y: stemY },
      { x: px + toCtr  * Math.sin(ang) * YARD_PX,
        y: stemY        + Math.cos(ang) * YARD_PX }  // slightly back downfield
    ];
  },

  // 2. Slant — 1yd stem, 60° diagonal inward, 8yd
  'slant': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const toCtr = _routeToCenter(px, snap);
    const stemY = losY - YARD_PX;
    const dist  = 8 * YARD_PX;
    const sin60 = Math.sqrt(3) / 2;  // ≈ 0.866 — stärker zur Seite
    const cos60 = 0.5;               // flacher Tiefenanteil
    return [
      { x: px, y: stemY },
      { x: px    + toCtr * dist * sin60,
        y: stemY -          dist * cos60 }  // upfield + inward
    ];
  },

  // 3. 5-and-In — 5yd stem, 90° horizontal to field center (ballX)
  '5-in': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const stemY = losY - 5 * YARD_PX;
    return [
      { x: px,          y: stemY },
      { x: snap.ballX,  y: stemY }
    ];
  },

  // 4. 5-and-Out — 5yd stem, 90° horizontal to sideline
  '5-out': (p, snap) => {
    const px     = getSnapPos(p).x;
    const losY   = snap.losY;
    const toSide = _routeToSide(px, snap);
    const stemY  = losY - 5 * YARD_PX;
    const sideX  = toSide > 0 ? FIELD_RIGHT : FIELD_LEFT;
    return [
      { x: px,    y: stemY },
      { x: sideX, y: stemY }
    ];
  },

  // 5. Curl — 10yd stem, 140° break toward center, 1yd back
  'curl': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const toCtr = _routeToCenter(px, snap);
    const stemY = losY - 10 * YARD_PX;
    const ang   = 40 * Math.PI / 180;
    return [
      { x: px, y: stemY },
      { x: px + toCtr  * Math.sin(ang) * YARD_PX,
        y: stemY        + Math.cos(ang) * YARD_PX }
    ];
  },

  // 6. 10-and-In — 10yd stem, 90° horizontal to field center (ballX)
  '10-in': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const stemY = losY - 10 * YARD_PX;
    return [
      { x: px,          y: stemY },
      { x: snap.ballX,  y: stemY }
    ];
  },

  // 7. 10-and-Out — 10yd stem, 90° horizontal to sideline
  '10-out': (p, snap) => {
    const px     = getSnapPos(p).x;
    const losY   = snap.losY;
    const toSide = _routeToSide(px, snap);
    const stemY  = losY - 10 * YARD_PX;
    const sideX  = toSide > 0 ? FIELD_RIGHT : FIELD_LEFT;
    return [
      { x: px,    y: stemY },
      { x: sideX, y: stemY }
    ];
  },

  // 8. Post — 10yd stem, 45° diagonal toward center (goalpost), 8yd
  'post': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const toCtr = _routeToCenter(px, snap);
    const stemY = losY - 10 * YARD_PX;
    const dist  = 8 * YARD_PX;
    return [
      { x: px, y: stemY },
      { x: px    + toCtr * dist * Math.SQRT1_2,
        y: stemY -          dist * Math.SQRT1_2 }
    ];
  },

  // 9. Corner — 10yd stem, 45° diagonal toward sideline, 8yd
  'corner': (p, snap) => {
    const px     = getSnapPos(p).x;
    const losY   = snap.losY;
    const toSide = _routeToSide(px, snap);
    const stemY  = losY - 10 * YARD_PX;
    const dist   = 8 * YARD_PX;
    return [
      { x: px, y: stemY },
      { x: px    + toSide * dist * Math.SQRT1_2,
        y: stemY -           dist * Math.SQRT1_2 }
    ];
  },

  // 10. Fly — straight upfield, 25yd, no break
  'fly': (p, snap) => {
    const px   = getSnapPos(p).x;
    const losY = snap.losY;
    return [{ x: px, y: losY - 25 * YARD_PX }];
  },

  // 11. Drag — 45° angle to 1yd line over LOS, then horizontal inward
  'drag': (p, snap) => {
    const px    = getSnapPos(p).x;
    const losY  = snap.losY;
    const toCtr = _routeToCenter(px, snap);
    const y1    = losY - YARD_PX;  // 1yd above LOS
    return [
      { x: px + toCtr * YARD_PX,      y: y1 },  // 45° corner: 1yd up + 1yd in
      { x: px + toCtr * 9 * YARD_PX,  y: y1 }   // horizontal 8 more yards inward
    ];
  },

  // 12. Flat — 1yd over LOS, horizontal toward own sideline, 18yd from ball
  'flat': (p, snap) => {
    const px     = getSnapPos(p).x;
    const losY   = snap.losY;
    const toSide = _routeToSide(px, snap);
    const endX   = snap.ballX + toSide * 18 * YARD_PX;
    return [
      { x: endX, y: losY - YARD_PX }
    ];
  },

  // 13. Flat Strong — 1yd over LOS, always toward coverage strong side, 18yd from ball
  'flat-strong': (p, snap) => {
    const losY  = snap.losY;
    const sDir  = snap.coverageStrongSide === 'R' ? 1 : -1;
    const endX  = snap.ballX + sDir * 18 * YARD_PX;
    return [
      { x: endX, y: losY - YARD_PX }
    ];
  },

};

// ── Route lookup helper ───────────────────────────────────────────────────
function _applyRoute(name, player, snap) {
  const fn = ROUTE_LIBRARY[name];
  if (!fn) { console.warn('ROUTE_LIBRARY: unknown route', name); return null; }
  return fn(player, snap);
}

// ── PLAY_PRESETS ──────────────────────────────────────────────────────────
// Each preset has a routes(numbered, snap) function.
// New presets can use _applyRoute(name, player, snap) for library routes.
const PLAY_PRESETS = {

  // ── Sail Dragon ──────────────────────────────────────────────────────────
  // #1 Fly · #2 Out strong · #3 Flat strong · #4 Flat weak · #5 Angle-in
  'sail-dragon': {
    label: 'Sail Dragon',
    routes(numbered, snap) {
      const losY   = snap.losY;
      const ballX  = snap.ballX;
      const strong = snap.strongSide || 'R';
      const sDir   = strong === 'R' ? 1 : -1;
      const wDir   = -sDir;
      const routes = {};

      // #1 — Fly: straight upfield, 25yd
      if (numbered[0]) routes[numbered[0].id] = _applyRoute('fly', numbered[0], snap);

      // #2 — 10yd out toward strong sideline
      if (numbered[1]) {
        const p  = numbered[1];
        const px = getSnapPos(p).x;
        routes[p.id] = [
          { x: px,                         y: losY - YARD_PX * 10 },
          { x: px + sDir * YARD_PX * 8,   y: losY - YARD_PX * 10 }
        ];
      }

      // #3 — Flat to strong side
      if (numbered[2]) routes[numbered[2].id] = _applyRoute('flat', numbered[2], snap);

      // #4 — Flat to weak side
      if (numbered[3]) routes[numbered[3].id] = _applyRoute('flat', numbered[3], snap);

      // #5 — Dragon: 2yd stem, 45° inward, ends at 7yd depth
      if (numbered[4]) {
        const p      = numbered[4];
        const px     = getSnapPos(p).x;
        const toCtr  = _routeToCenter(px, snap);
        const stemY  = losY - 2 * YARD_PX;
        const endY   = losY - 7 * YARD_PX;
        const hDist  = Math.abs(endY - stemY); // 5yd at 45°
        routes[p.id] = [
          { x: px,                   y: stemY },
          { x: px + toCtr * hDist,  y: endY  }
        ];
      }

      return routes;
    }
  },

  // ── Dagger Mesh Post ─────────────────────────────────────────────────────
  // #1 Post · #2 Post · #3 Mesh-Over (3yd→weak) · #4 Mesh-Under (1yd→strong) · #5 Post
  // Works formations-agnostisch: 2x2, 3x1, Empty — Nummern decken alles ab.
  'dagger-mesh-post': {
    label: 'Dagger Mesh Post',
    routes(numbered, snap) {
      const losY  = snap.losY;
      const ballX = snap.ballX;
      const sDir  = snap.coverageStrongSide === 'R' ? 1 : -1;
      const wDir  = -sDir;
      const routes = {};

      // #1 — 10-and-In: 10yd stem, 90° horizontal toward center, 6yd
      if (numbered[0]) routes[numbered[0].id] = _applyRoute('10-in', numbered[0], snap);

      // #2 — Post: 10yd stem, 45° inward diagonal, 8yd
      if (numbered[1]) routes[numbered[1].id] = _applyRoute('post', numbered[1], snap);

      // #3 — Mesh Over: 3yd stem, then horizontal toward weak side
      // Crosses OVER #4 — 2yd depth separation prevents collision
      if (numbered[2]) {
        const p     = numbered[2];
        const px    = getSnapPos(p).x;
        const stemY = losY - 3 * YARD_PX;
        routes[p.id] = [
          { x: px,                            y: stemY },
          { x: ballX + wDir * 15 * YARD_PX,  y: stemY }
        ];
      }

      // #4 — Mesh Under: 1yd stem, then horizontal toward strong side
      // Crosses UNDER #3 — runs beneath the over-crosser
      if (numbered[3]) {
        const p     = numbered[3];
        const px    = getSnapPos(p).x;
        const stemY = losY - YARD_PX;
        routes[p.id] = [
          { x: px,                            y: stemY },
          { x: ballX + sDir * 15 * YARD_PX,  y: stemY }
        ];
      }

      // #5 — Post: mirrors #1/#2 on weak side
      if (numbered[4]) routes[numbered[4].id] = _applyRoute('post', numbered[4], snap);

      return routes;
    }
  },

  // ── Lion Hold Double Post ────────────────────────────────────────────────
  // RB holds (no route). Remaining receivers numbered from strong side:
  // Normal (2x2 / 3x1): #1 Slant · #2 Slant · #3 Post · #4 Post
  // Empty  (no RB):     #1 Slant · #2 Slant · #3 Drag  · #4 Post · #5 Post
  'lion-hold-double-post': {
    label: 'Lion Hold Double Post',
    routes(numbered, snap) {
      const routes = {};
      const rbIds  = new Set(snap.backfieldPlayers.map(p => p.id));

      // Receivers only — RB bekommt keine Route, bleibt stehen
      const receivers = numbered.filter(p => !rbIds.has(p.id));

      const routeNames = snap.isEmpty
        ? ['slant', 'slant', 'drag', 'post', 'post']
        : ['slant', 'slant', 'post', 'post'];

      receivers.forEach((p, i) => {
        if (routeNames[i]) routes[p.id] = _applyRoute(routeNames[i], p, snap);
      });

      return routes;
    }
  },

  // ── Full Dragon Curl Flat ────────────────────────────────────────────────
  // #1 Slant · #2 Slant · #3 Flat · #4 Flat · #5 Curl
  'full-dragon-curl-flat': {
    label: 'Full Dragon Curl Flat',
    routes(numbered, snap) {
      const routes = {};
      const assign = ['slant', 'slant', 'flat', 'flat', 'curl'];
      numbered.forEach((p, i) => {
        if (assign[i]) routes[p.id] = _applyRoute(assign[i], p, snap);
      });
      return routes;
    }
  },

  // ── Full Flood ───────────────────────────────────────────────────────────
  // #1 Fly · #2 Corner · #3 RB→Flat Strong / Receiver→10-and-Out · #4 RB→Flat Strong / Receiver→Drag · #5 5-and-In
  'full-flood': {
    label: 'Full Flood',
    routes(numbered, snap) {
      const routes = {};
      const rbIds  = new Set(snap.backfieldPlayers.map(p => p.id));

      if (numbered[0]) routes[numbered[0].id] = _applyRoute('fly',    numbered[0], snap);
      if (numbered[1]) routes[numbered[1].id] = _applyRoute('corner', numbered[1], snap);
      if (numbered[2]) {
        const route = rbIds.has(numbered[2].id) ? 'flat-strong' : '10-out';
        routes[numbered[2].id] = _applyRoute(route, numbered[2], snap);
      }
      if (numbered[3]) {
        const route = rbIds.has(numbered[3].id) ? 'flat-strong' : 'drag';
        routes[numbered[3].id] = _applyRoute(route, numbered[3], snap);
      }
      if (numbered[4]) routes[numbered[4].id] = _applyRoute('5-in',  numbered[4], snap);

      return routes;
    }
  },

};

function applyPlayPreset() {
  const sel = document.getElementById('playPresetSelect');
  if (!sel || sel.value === 'manual') return;

  const preset = PLAY_PRESETS[sel.value];
  if (!preset) { showToast('⚠ Unknown play preset'); return; }

  // Rebuild snapshot from current positions
  rebuildOffenseStructureSnapshot();
  const snap = offenseStructureSnapshot;
  if (!snap) { showToast('⚠ Add offense players first'); return; }

  // Get eligible receivers numbered 1-5 from strong side
  const numbered = getPlayEligibles();
  if (numbered.length === 0) { showToast('⚠ No eligible receivers found'); return; }

  // Generate routes
  const routeMap = preset.routes(numbered, snap);

  // Apply routes to players (clear existing first)
  players.forEach(p => {
    if (routeMap[p.id]) {
      p.routePoints = routeMap[p.id].map(wp => ({ x: wp.x, y: wp.y }));
      p.blockPoints = []; // clear blocks when assigning routes
    }
  });

  showToast('✓ ' + preset.label + ' applied');
  draw();
}

