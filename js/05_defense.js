// ===================================================================

// ── Constants ────────────────────────────────────────────────────────
const DEF_SPEED_PX      = 160;  // px/s base speed — matches offense baseSpeed at simSpeed×2
const DEF_ARRIVE_THR    = 8;    // px — arrive threshold for zone drop
const DEF_PLAYER_RADIUS = 12;   // canvas hit/draw radius
const DEF_MAX_COUNT     = 11;   // max defenders

// ── Defender colors ──────────────────────────────────────────────────
const DEF_COLOR         = '#3b82f6';   // blue circle stroke
const DEF_COLOR_SEL     = '#00e5ff';   // selected cyan
const DEF_MAN_LINE      = 'rgba(59,130,246,0.55)';
const DEF_ZONE_LINE     = 'rgba(250,204,21,0.55)';
const DEF_LANDMARK_COLOR= 'rgba(250,204,21,0.5)';

// ── Landmark definitions ─────────────────────────────────────────────
// Positions relative to ballX / losY in canvas pixels (upfield = -y).
// YARD_PX is already defined globally.
const DEF_LANDMARKS = {
  // Flat zones — sideline to inner edge of numbers, 0-12 yd upfield, landmark at 6 yd
  FLAT_L:       (bx, ly) => ({ x: bx - YARD_PX * 21.04, y: ly - YARD_PX * 6  }),
  FLAT_R:       (bx, ly) => ({ x: bx + YARD_PX * 21.04, y: ly - YARD_PX * 6  }),
  // Curl zones — numbers to hash, 4-12 yd upfield, landmark at 8 yd
  CURL_L:       (bx, ly) => ({ x: bx - YARD_PX * 11.11, y: ly - YARD_PX * 8  }),
  CURL_R:       (bx, ly) => ({ x: bx + YARD_PX * 11.11, y: ly - YARD_PX * 8  }),
  // Curl/Flat zones — two-phase: first drop to Curl zone, then slide to Flat
  CURL_FLAT_L:  (bx, ly) => ({ x: bx - YARD_PX * 11.11, y: ly - YARD_PX * 8  }),
  CURL_FLAT_R:  (bx, ly) => ({ x: bx + YARD_PX * 11.11, y: ly - YARD_PX * 8  }),
  // Hook zones — center to 1yd outside hash, 4-12 yd upfield, landmark at 8 yd
  HOOK_L:       (bx, ly) => ({ x: bx - YARD_PX * 3.825, y: ly - YARD_PX * 8  }),
  HOOK_MIDDLE:  (bx, ly) => ({ x: bx,                    y: ly - YARD_PX * 8  }),
  HOOK_R:       (bx, ly) => ({ x: bx + YARD_PX * 3.825, y: ly - YARD_PX * 8  }),
  // Hook/Curl zones — two-phase: first drop to Hook zone, then slide to Curl
  HOOK_CURL_L:  (bx, ly) => ({ x: bx - YARD_PX * 3.825, y: ly - YARD_PX * 8  }),
  HOOK_CURL_R:  (bx, ly) => ({ x: bx + YARD_PX * 3.825, y: ly - YARD_PX * 8  }),
  // Deep zones — 10-20 yd upfield, landmark at center of zone
  // Deep L/R: sideline to hash-2yd
  // Deep Middle: hash-2yd each side (wider than hash gap by 2yd each side)
  DEEP_L:       (bx, ly) => ({ x: bx - YARD_PX * 17.575, y: ly - YARD_PX * 15 }),
  DEEP_MIDDLE:  (bx, ly) => ({ x: bx,                     y: ly - YARD_PX * 15 }),
  TAMPA_MIDDLE: (bx, ly) => ({ x: bx,                     y: ly - YARD_PX * 10 }),
  DEEP_R:       (bx, ly) => ({ x: bx + YARD_PX * 17.575, y: ly - YARD_PX * 15 }),
  DEEP_THIRD_L: (bx, ly) => ({ x: bx - YARD_PX * 16, y: ly - YARD_PX * 13 }),
  DEEP_THIRD_R: (bx, ly) => ({ x: bx + YARD_PX * 16, y: ly - YARD_PX * 13 }),
  // Deep Free: sideline to sideline, 10-20yd upfield
  DEEP_FREE:    (bx, ly) => ({ x: bx,                      y: ly - YARD_PX * 15 }),
  // Deep Half zones — sideline to center, 10-20 yd upfield, landmark at center of zone
  DEEP_HALF_L:  (bx, ly) => ({ x: bx - YARD_PX * 13.25, y: ly - YARD_PX * 15 }),
  DEEP_HALF_R:  (bx, ly) => ({ x: bx + YARD_PX * 13.25, y: ly - YARD_PX * 15 }),
  // Deep Quarter zones — field split into 4 equal quarters, 10-20yd upfield
  DEEP_QRTR_L:  (bx, ly) => ({ x: bx - YARD_PX * 19.875, y: ly - YARD_PX * 15 }),
  DEEP_QRTR_ML: (bx, ly) => ({ x: bx - YARD_PX * 6.625,  y: ly - YARD_PX * 15 }),
  DEEP_QRTR_MR: (bx, ly) => ({ x: bx + YARD_PX * 6.625,  y: ly - YARD_PX * 15 }),
  DEEP_QRTR_R:  (bx, ly) => ({ x: bx + YARD_PX * 19.875, y: ly - YARD_PX * 15 }),
};

// Defense tackle box: mirrors the offense OT span (+1 yd each side for DE gap).
// Only defenders inside this box should be eligible to rush the QB.
function getDefenseTackleBox(ballX, losY) {
  const offTB = getTackleBox();
  return {
    boxLeft:  offTB.boxLeftX  - YARD_PX,       // 1 yd outside OT
    boxRight: offTB.boxRightX + YARD_PX,
    maxDepthY: losY + 10 * YARD_PX,            // no rusher deeper than 10 yds behind LOS
  };
}

function getLandmarkPos(landmarkId) {
  const fn = DEF_LANDMARKS[landmarkId];
  const fieldCx = FIELD_W / 2; // zones are anchored to field center, not ball
  if (!fn) return { x: fieldCx, y: LOS_Y() - YARD_PX * 10 };
  return fn(fieldCx, LOS_Y());
}

// ── State ────────────────────────────────────────────────────────────
let defensePlayers   = [];  // [{id, role, x, y, simX, simY, assignment, ...}]
let nextDefId        = 1;
let selectedDefId    = null;  // currently selected defender id (or null)
// "activeTeam": which panel is focused for canvas clicks — 'O' | 'D'
// Switches automatically when clicking in the respective panel area.
let activeTeam       = 'O';

// ── Coverage Engine state ─────────────────────────────────────────────
// Coverage Call Sheet — one preset key per slot
const callSheet = {
  '2x2-strong':    'bracket-strong',
  '2x2-weak':      'cover5-weak',
  '3x1-strong':    'seahawk-strong',
  '3x1-backside':  'c2m-backside',
  'empty-trips':   'buster-strong',
  'empty-backside':'tuff-backside',
};
// Derived — resolved from callSheet + current formation before each dispatch
let activePreset = 'cover4';
// snapAlignment: frozen at snap — {defenderId → {x,y}}
let snapAlignment = {};

// Pre-snap slide speed (X only, fraction of DEF_SPEED_PX)
const DEF_SLIDE_SPEED_FACTOR = 1.0;

// ── Phase 3.4: Match Behavior constants ──────────────────────────────
const BEH_CARRY_TRAIL_YARDS       = 0.5;
const BEH_FOLLOW_TRAIL_YARDS      = 1.0;
const BEH_PASSOFF_ANGLE_MIN       = 65;
const BEH_SAFETY_SHADE_YARDS      = 3;
const BEH_ROB_LANDMARK            = 'HOOK_MIDDLE';
const BEH_RB_STOP_SPEED_THRESHOLD = LR_STOP_SPEED * 1.5;
const BEH_PASSOFF_LABEL_DURATION  = 0.6;

// ── Phase 3.4 helpers ─────────────────────────────────────────────────

// getDefenderRoleHint: per-tick shortcut for frozen behavior path.
// Returns 'CB' | 'safety' | 'underneath'
// Apex/Hook distinction is handled separately via frozen._apexHook tag.
function getDefenderRoleHint(d) {
  const losY    = LOS_Y();
  const depthYd = (losY - d.y) / YARD_PX;
  const widthYd = Math.abs(d.x - ball.x) / YARD_PX;
  if (widthYd >= PRESET_CORNER_WIDTH_YD) return 'CB';
  if (depthYd >= PRESET_SAFETY_DEPTH_YD) return 'safety';
  return 'underneath';
}

// findVerticalThreatSide: scan all eligible players' live reads,
// return 'L', 'R', or null depending on which side has an active vertical threat.
function findVerticalThreatSide() {
  if (!offenseStructureSnapshot) return null;
  let leftVert = false, rightVert = false;
  const relevant = [...(offenseStructureSnapshot.eligiblePlayers || [])];
  relevant.forEach(p => {
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

// resetSwitchState: call on stopSim / reset.
function resetSwitchState() {
  defensePlayers.forEach(d => { d._passoffTime = null; });
}

// ── Factory ──────────────────────────────────────────────────────────
function makeDefender(x, y) {
  const roles = ['CB','CB','S','LB','LB','S','NICKEL','DE','DT','DT','DE'];
  const role  = roles[defensePlayers.length % roles.length];
  return {
    id:         nextDefId++,
    team:       'D',
    role,
    x, y,
    origX: x, origY: y,
    simX: x, simY: y,
    assignment: { type: 'none' },
    speedMultiplier: 1.0,
    isDefender: true,
    cbSpacing: 'normal',
    cbShade:   'normal',
    mirroredWRId: null,
    decision: { mode: 'idle', focusTargetId: null, focusLandmarkId: null, trailPx: 0 },
  };
}

// ── Helper: derive decision from assignment (pure, no side effects) ───
// Falls back to idle if required IDs are missing/invalid.
// trailPx is also computed here so stepDefensePlayers never reads assignment.
// mode: 'idle' | 'follow' | 'drop' | 'rush'
function assignmentToDecision(assignment) {
  if (assignment.type === 'man' && assignment.targetId != null) {
    return {
      mode: 'follow',
      focusTargetId: assignment.targetId,
      focusLandmarkId: null,
      trailPx: (assignment.trailDistance || 0) * YARD_PX,
    };
  }
  if (assignment.type === 'zone' && assignment.landmarkId) {
    return { mode: 'drop', focusTargetId: null, focusLandmarkId: assignment.landmarkId, trailPx: 0 };
  }
  if (assignment.type === 'rush') {
    return { mode: 'rush', focusTargetId: null, focusLandmarkId: null, trailPx: 0 };
  }
  // Run fit types — map to 'idle' for pass-mode decisions (run fit handled separately)
  if (['gap','contain','spill'].includes(assignment.type)) {
    return { mode: 'idle', focusTargetId: null, focusLandmarkId: null, trailPx: 0, _runFit: assignment.type };
  }
  return { mode: 'idle', focusTargetId: null, focusLandmarkId: null, trailPx: 0 };
}

// ── LB Family ──────────────────────────────────────────────────────────────
// All linebacker-type roles. Used everywhere instead of hardcoded 'LB' checks
// so SAM / MIKE / WILL / LOLB / ROLB / LILB / RILB are treated as a group
// for reactive formation, run fits, and spawning — while still being
// individually distinguishable for trigger-based alignment logic.
const LB_ROLES = new Set(['LB', 'SAM', 'MIKE', 'WILL', 'LOLB', 'ROLB', 'LILB', 'RILB']);

const DEF_FORMATIONS = {

  // 4-3 Over
  // Strong side = RIGHT (default). DT1: G–T gap strong side (+2.4). DT2: C–G gap weak side (−0.8).
  '4-3-over': {
    label: '4-3 Over',
    players: [
      { role:'DE',  dx:-4.0,  dyYd:1   },  // LE — outside left tackle
      { role:'DT',  dx:-0.8,  dyYd:1   },  // DT weak — C–G gap (left)
      { role:'DT',  dx: 2.4,  dyYd:1   },  // DT strong — G–T gap (right)
      { role:'DE',  dx: 4.0,  dyYd:1   },  // RE — outside right tackle
      { role:'WILL', dx:-4,    dyYd:4   },  // WILL — weak side LB
      { role:'MIKE', dx: 0,    dyYd:4   },  // MIKE — middle LB
      { role:'SAM',  dx: 4,    dyYd:4   },  // SAM — strong side LB
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // 4-3 Under
  // Strong side = RIGHT. DT strong: C–G gap strong side (+0.8). DT weak: G–T gap weak side (−2.4).
  '4-3-under': {
    label: '4-3 Under',
    players: [
      { role:'DE',  dx:-4.0,  dyYd:1   },  // LE — outside left tackle
      { role:'DT',  dx:-2.4,  dyYd:1   },  // DT weak — G–T gap (left)
      { role:'DT',  dx: 0.8,  dyYd:1   },  // DT strong — C–G gap (right)
      { role:'DE',  dx: 4.0,  dyYd:1   },  // RE — outside right tackle
      { role:'WILL', dx:-5,    dyYd:4.5 },  // WILL — widened weak
      { role:'MIKE', dx: 0.5,  dyYd:4   },  // MIKE
      { role:'SAM',  dx: 5,    dyYd:4   },  // SAM
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // 3-4 Base
  // DEs in the G–T gap (±2.4). NT head-up on center.
  '3-4': {
    label: '3-4 Bear',
    players: [
      { role:'DE',  dx:-2.4,  dyYd:1   },  // Left DE — G–T gap
      { role:'DT',  dx: 0,    dyYd:1   },  // NT — head-up on center
      { role:'DE',  dx: 2.4,  dyYd:1   },  // Right DE — G–T gap
      { role:'LOLB', dx:-5.5,  dyYd:4   },  // LOLB — left outside
      { role:'LILB', dx:-1.5,  dyYd:4   },  // LILB — left inside
      { role:'RILB', dx: 1.5,  dyYd:4   },  // RILB — right inside
      { role:'ROLB', dx: 5.5,  dyYd:4   },  // ROLB — right outside
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // 3-3-5 Nickel
  '3-3-5': {
    label: '3-3-5 Nickel',
    players: [
      { role:'DE',  dx:-4.0,  dyYd:1   },  // Left DE
      { role:'DT',  dx: 0,    dyYd:1   },  // NT
      { role:'DE',  dx: 4.0,  dyYd:1   },  // Right DE
      { role:'WILL', dx:-3.5,  dyYd:4   },  // WILL
      { role:'MIKE', dx: 0,    dyYd:4   },  // MIKE
      { role:'SAM',  dx: 3.5,  dyYd:4   },  // SAM
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'NICKEL', dx:0,  dyYd:7   },  // Nickel — slot
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // 4-2-5 Nickel
  // DT alignment alternates Over / Under randomly each time it's applied.
  // Handled in applyDefFormationPreset via the 'randomDL' flag.
  '4-2-5': {
    label: '4-2-5 Nickel',
    randomDL: true,   // triggers Over/Under coin-flip in spawner
    players: [
      { role:'DE',  dx:-4.0,  dyYd:1   },  // Left DE
      { role:'DT',  dx:'DT_WEAK',  dyYd:1 },  // filled in by randomDL
      { role:'DT',  dx:'DT_STRONG',dyYd:1 },  // filled in by randomDL
      { role:'DE',  dx: 4.0,  dyYd:1   },  // Right DE
      { role:'WILL', dx:-2,    dyYd:4   },  // WILL
      { role:'MIKE', dx: 2,    dyYd:4   },  // MIKE
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'NICKEL', dx:-7, dyYd:7   },  // Nickel — weak slot
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // Dime — 4-1-6
  'dime': {
    label: 'Dime (4-1-6)',
    players: [
      { role:'DE',  dx:-4.0,  dyYd:1   },  // Left DE
      { role:'DT',  dx:-1.5,  dyYd:1   },  // LDT
      { role:'DT',  dx: 1.5,  dyYd:1   },  // RDT
      { role:'DE',  dx: 4.0,  dyYd:1   },  // Right DE
      { role:'MIKE', dx: 0,    dyYd:4   },  // MIKE only
      { role:'CB',  dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',  dx: 13,   dyYd:1   },  // Right CB
      { role:'NICKEL', dx:-7, dyYd:6   },  // Left Nickel — slot
      { role:'NICKEL', dx: 7, dyYd:6   },  // Right Nickel — slot
      { role:'SS',  dx:'HASH_STRONG', dyYd:8   },  // SS — strong hash, 8 yds deep
      { role:'FS',  dx:'HASH_WEAK',   dyYd:12  },  // FS — weak hash, 12 yds deep
    ],
  },

  // Double Mug — 3-4 pressure look, both ILBs walked up over guards
  // Pre-snap disguise: looks like 6-man rush, often Cover 0/2 behind it.
  'double-mug': {
    label: 'Double Mug',
    players: [
      { role:'DE',   dx:-3.5,  dyYd:1   },  // Left DE — G–T gap
      { role:'DT',   dx: 0,    dyYd:1   },  // NT — head-up center
      { role:'DE',   dx: 3.5,  dyYd:1   },  // Right DE — G–T gap
      { role:'LOLB', dx:-5.5,  dyYd:1   },  // LOLB — outside edge
      { role:'ROLB', dx: 5.5,  dyYd:1   },  // ROLB — outside edge
      { role:'LILB', dx:-1.5,  dyYd:1.5 },  // LILB — walked up over LG
      { role:'RILB', dx: 1.5,  dyYd:1.5 },  // RILB — walked up over RG
      { role:'CB',   dx:-13,   dyYd:1   },  // Left CB — press
      { role:'CB',   dx: 13,   dyYd:1   },  // Right CB — press
      { role:'SS',   dx:'HASH_STRONG', dyYd:7  },  // SS — strong hash
      { role:'FS',   dx:'HASH_WEAK',   dyYd:10 },  // FS — weak hash
    ],
  },

  // Dime — 2-3-6
  // 2 DE, 3 LBs (WILL + MIKE + SAM), 2 CB + 2 NICKEL, SS, FS.
  // Extreme pass defense: 6 DBs, only 2 DL rushing.
  'dime-236': {
    label: 'Dime (2-3-6)',
    players: [
      { role:'DE',     dx:-3.5,  dyYd:1   },  // Left DE
      { role:'DE',     dx: 3.5,  dyYd:1   },  // Right DE
      { role:'WILL',   dx:-3.0,  dyYd:4   },  // WILL — weak side
      { role:'MIKE',   dx: 0,    dyYd:4   },  // MIKE — center
      { role:'SAM',    dx: 3.0,  dyYd:4   },  // SAM — strong side
      { role:'CB',     dx:-13,   dyYd:1   },  // Left CB
      { role:'CB',     dx: 13,   dyYd:1   },  // Right CB
      { role:'NICKEL', dx:-6,    dyYd:6   },  // Left Nickel — slot
      { role:'NICKEL', dx: 6,    dyYd:6   },  // Right Nickel — slot
      { role:'SS',     dx:'HASH_STRONG', dyYd:8  },  // SS
      { role:'FS',     dx:'HASH_WEAK',   dyYd:12 },  // FS
    ],
  },
};

// ── Pure formation position calculator (no side effects) ─────────────
// Returns array of {x, y, role} for each player in the preset,
// aligned to the given ball position and offense player positions.
function computeFormationPositions(key, ballX, losY, offensePlayers) {
  const formation = DEF_FORMATIONS[key];
  if (!formation) return [];

  const useOver   = _reactiveDTOver;
  const DT_STRONG = useOver ?  2.4 :  0.8;
  const DT_WEAK   = useOver ? -0.8 : -2.4;

  const raw = formation.players.map(p => {
    let dxVal = p.dx;
    if (dxVal === 'DT_STRONG') dxVal = DT_STRONG;
    if (dxVal === 'DT_WEAK')   dxVal = DT_WEAK;
    if (dxVal === 'HASH_STRONG') {
      const ballOffsetYd = (ballX - FIELD_W / 2) / YARD_PX;
      dxVal = (RIGHT_HASH - ballX) / YARD_PX + ballOffsetYd / 2;
    }
    if (dxVal === 'HASH_WEAK') {
      const ballOffsetYd = (ballX - FIELD_W / 2) / YARD_PX;
      dxVal = (LEFT_HASH - ballX) / YARD_PX + ballOffsetYd / 2;
    }
    const x = Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14, ballX + dxVal * YARD_PX));
    const y = Math.min(losY - 0.5 * YARD_PX, Math.max(20, losY - p.dyYd * YARD_PX));
    return { x, y, role: p.role };
  });

  // Align CBs/Nickels to outermost offense players (mirrors alignDBsToWideouts logic)
  if (offensePlayers && offensePlayers.length > 0) {
    const DB_ROLES = new Set(['CB', 'NICKEL']);
    const leftOff  = offensePlayers.filter(p => p.x < ballX).sort((a,b) => a.x - b.x);
    const rightOff = offensePlayers.filter(p => p.x >= ballX).sort((a,b) => b.x - a.x);
    const dbLeft   = raw.filter(d => DB_ROLES.has(d.role) && d.x < ballX).sort((a,b) => a.x - b.x);
    const dbRight  = raw.filter(d => DB_ROLES.has(d.role) && d.x >= ballX).sort((a,b) => b.x - a.x);
    dbLeft.forEach((db, i)  => { if (leftOff[i])  db.x = leftOff[i].x; });
    dbRight.forEach((db, i) => { if (rightOff[i]) db.x = rightOff[i].x; });
  }

  return raw;
}

function applyDefFormationPreset() {
  const sel = document.getElementById('formationPresetSelect');
  const key = sel ? sel.value : '';
  if (!key) { showToast('⚠ Select a formation first'); return; }
  const formation = DEF_FORMATIONS[key];
  if (!formation) return;

  // Wipe existing defenders and reload
  defensePlayers = [];
  nextDefId = 1;
  selectedDefId = null;

  const cx  = ball.x;
  const los = LOS_Y();

  // 4-2-5: randomly pick Over or Under DT alignment each apply
  // Over:  DT_STRONG = G–T strong (+2.4), DT_WEAK = C–G weak (−0.8)
  // Under: DT_STRONG = C–G strong (+0.8), DT_WEAK = G–T weak (−2.4)
  const useOver = Math.random() < 0.5;
  const DT_STRONG = useOver ?  2.4 :  0.8;
  const DT_WEAK   = useOver ? -0.8 : -2.4;
  const dlLabel   = useOver ? 'Over' : 'Under';

  formation.players.forEach(p => {
    // Resolve random DL tokens
    let dxVal = p.dx;
    if (dxVal === 'DT_STRONG') dxVal = DT_STRONG;
    if (dxVal === 'DT_WEAK')   dxVal = DT_WEAK;
    // Resolve hash tokens — absolute hash position + half-rate ball shift
    if (dxVal === 'HASH_STRONG') {
      const ballOffsetYd = (cx - FIELD_W / 2) / YARD_PX;
      const shiftYd = ballOffsetYd / 2;
      dxVal = (RIGHT_HASH - cx) / YARD_PX + shiftYd;
    }
    if (dxVal === 'HASH_WEAK') {
      const ballOffsetYd = (cx - FIELD_W / 2) / YARD_PX;
      const shiftYd = ballOffsetYd / 2;
      dxVal = (LEFT_HASH - cx) / YARD_PX + shiftYd;
    }

    const x = Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14,
                cx + dxVal * YARD_PX));
    // Clamp so no defender starts behind or on LOS — minimum 0.5 yd upfield
    const y = Math.min(los - 0.5 * YARD_PX, Math.max(20, los - p.dyYd * YARD_PX));
    defensePlayers.push({
      id: nextDefId++, team: 'D', role: p.role,
      x, y, origX: x, origY: y, simX: x, simY: y,
      assignment:      { type: 'none' },
      speedMultiplier: 1.0,
      isDefender:      true,
      simZoneDone:     false,
      cbSpacing: 'normal',
      cbShade:   'normal',
      mirroredWRId: null,
      decision: { mode:'idle', focusTargetId:null, focusLandmarkId:null, trailPx:0 },
    });
  });

  refreshDefPlayerList();
  refreshDefAssignBox();
  if (activePreset !== 'manual') refreshPresetMatchList();
  // Align CBs/Nickels to outermost skill players if offense is on the field
  if (players.length > 0) alignDBsToWideouts();
  updateCallSheetLockState();
  applyPresetAlignment();

  // ── Auto-assign run fits AFTER positions are finalized ─────────────
  applyRunFitAssignments(defensePlayers, false);

  // ── Safety gap-depth adjustment ─────────────────────────────────────
  // For every gap beyond 6, move SS and FS 0.5 yards closer to LOS (max 10 gaps = 2 yards).
  const gapCount = new Set(
    defensePlayers
      .map(d => d.runAssignment && d.runAssignment.gapId ? d.runAssignment.gapId
               : d.assignment && d.assignment.gapId ? d.assignment.gapId : null)
      .filter(Boolean)
  ).size;
  const extraGaps = Math.min(Math.max(gapCount - 6, 0), 4); // 0–4 extra gaps
  if (extraGaps > 0) {
    const shiftPx = extraGaps * 0.5 * YARD_PX;
    defensePlayers.filter(d => d.role === 'SS' || d.role === 'FS').forEach(s => {
      s.y = Math.min(LOS_Y() - 0.5 * YARD_PX, s.y + shiftPx);
      s.origY = s.y; s.simY = s.y;
    });
  }

  refreshRunFitsSummary();
  draw();
  const extra = formation.randomDL ? ` (${dlLabel} front)` : '';
  showToast(`✓ ${formation.label}${extra} — ${formation.players.length} defenders placed`, 'info');
}

// ── Recompute run-fit assignments from current field positions ────────
// Called any time a defender or offense player is moved in the editor,
// so gap assignments stay live and accurate. Gaps are ONLY locked at
// play start (_lockedGapId set on first sim tick).
// ── Core run-fit assignment engine ────────────────────────────────────
// Called both from applyDefFormationPreset (fresh placement, respectManual=false)
// and recomputeRunFits (live editor update, respectManual=true).
//
// POOL LOGIC:
//   totalGaps  = number of active gaps (from computeDynamicGaps)
//   dlGaps     = gaps taken by DL
//   remaining  = totalGaps - dlGaps  → slots to fill from pool
//
//   Pool is filled in strict priority order until remaining slots are full:
//     1. LB / NICKEL
//     2. SS
//     3. FS
//     4. CB  (last resort — only if gaps still open after all above)
//
//   After pool is determined, players are sorted outside-in per side and
//   assigned outermost free gap first.
//   Players in pool with no gap left → pursuit.
//   Players NOT selected for pool → pursuit (no gap available for them).
//   CB not selected for pool → contain.
//
function applyRunFitAssignments(dPlayers, respectManual) {
  computeDynamicGaps();

  const ballX     = ball.x;
  const losY      = LOS_Y();
  const deepSafeties = dPlayers.filter(d => d.role === 'FS' || d.role === 'SS').length;
  const isOneHigh    = deepSafeties <= 1;
  const roleMap      = classifyAllRoles(dPlayers, ballX, losY, isOneHigh, offenseStructureSnapshot?.coverageStrongSide);
  const allGapIds    = Object.keys(GAP_OFFSETS_PX);
  const assignedGaps = new Set();

  // Reset non-manual assignments
  dPlayers.forEach(d => {
    if (!respectManual || !d._manualAssignment) d.assignment = { type: 'none' };
    d._ntBothAGaps = false;
  });

  // ── Step 0: Pre-register manual run fit gaps so auto-logic respects them ──
  // Any player with _manualRunAssignment gets their gap locked in FIRST.
  if (respectManual) {
    dPlayers.forEach(d => {
      if (!d._manualRunAssignment || !d.runAssignment) return;
      if (d.runAssignment.type === 'gap' && d.runAssignment.gapId) {
        assignedGaps.add(d.runAssignment.gapId);
        // Mark this player as taken so they're excluded from auto pool
        d._runFitManualLocked = true;
      } else if (d.runAssignment.type === 'contain' || d.runAssignment.type === 'spill') {
        d._runFitManualLocked = true;
      } else {
        d._runFitManualLocked = false;
      }
    });
  } else {
    dPlayers.forEach(d => { d._runFitManualLocked = false; });
  }

  // ── Step 1: DL — nearest gap, immutable ────────────────────────────
  // NT rule: DL within 0.5 yards of center (ball.x) owns BOTH A-gaps.
  // Assigned A_gap_L, but A_gap_R is also reserved so no other DL takes it.
  // Only DE/DT/NT roles are treated as D-Line here.
  const NT_THRESHOLD_PX = YARD_PX * 0.5;
  const DL_ROLE_SET = new Set(['DE', 'DT', 'NT']);

  dPlayers.forEach(d => {
    const structRole = roleMap.get(d.id) || 'UNDER';
    if (structRole !== 'RUSH') return;
    if (!DL_ROLE_SET.has(d.role.toUpperCase())) return; // only actual DL in Step 1
    if (respectManual && d._runFitManualLocked) return; // manual run fit takes priority
    if (respectManual && d._manualAssignment) {
      if (d.assignment.gapId) assignedGaps.add(d.assignment.gapId);
      return;
    }

    // NT position — head-up on center, owns both A-gaps (DL only)
    if (['DT','NT','DE'].includes(d.role.toUpperCase()) && Math.abs(d.x - ballX) <= NT_THRESHOLD_PX) {
      d.assignment = { type: 'gap', gapId: 'A_gap_L', fillType: 'fill' };
      d._ntBothAGaps = true;
      assignedGaps.add('A_gap_L');
      assignedGaps.add('A_gap_R');
      d.decision = assignmentToDecision(d.assignment);
      return;
    }

    // Normal DL — nearest unoccupied gap
    let best = null, bestDist = Infinity;
    allGapIds.forEach(gId => {
      if (assignedGaps.has(gId)) return;
      const dist = Math.abs(d.x - (ballX + GAP_OFFSETS_PX[gId]));
      if (dist < bestDist) { bestDist = dist; best = gId; }
    });
    if (best) {
      d.assignment = { type: 'gap', gapId: best, fillType: 'fill' };
      assignedGaps.add(best);
    }
    d.decision = assignmentToDecision(d.assignment);
  });

  // ── Step 1.5: QB Rusher (non-DL) — nearest free gap after DL ──────
  // Identify non-DL players designated as QB rushers by the coverage preset
  // (decision mode === 'rush') or by manual rush assignment.
  // They get gap priority before LBs so their run-fit gap is closest to them.
  const presetDec = (activePreset !== 'manual' && offenseStructureSnapshot)
    ? getActivePresetDecisions(offenseStructureSnapshot, dPlayers)
    : null;

  const qbRushers = dPlayers.filter(d => {
    if (d.assignment.type !== 'none') return false; // already assigned (DL, manual, etc.)
    if (DL_ROLE_SET.has(d.role.toUpperCase())) return false; // DL handled in Step 1
    if (respectManual && d._runFitManualLocked) return false;
    // Check preset decision for rush mode
    if (presetDec) {
      const dec = presetDec.get(d.id);
      if (dec && dec.mode === 'rush') return true;
    }
    // Check manual rush assignment (passAssignment preserved across reset)
    if (d.passAssignment && d.passAssignment.type === 'rush') return true;
    return false;
  });

  // QB rusher gap assignment: optimal no-crossing matching by distance.
  // dp[i][j] = min total distance assigning first i rushers using gaps from gaps[0..j-1].
  // Each gap can be skipped, so rushers on the right naturally get right-side gaps.
  // Constraint: leftmost rusher always gets a gap left of the next rusher (no crossings).
  if (qbRushers.length > 0) {
    const rushFreeGaps = allGapIds
      .filter(g => !assignedGaps.has(g))
      .sort((a, b) => (ballX + GAP_OFFSETS_PX[a]) - (ballX + GAP_OFFSETS_PX[b]));
    const rushPool = qbRushers.slice().sort((a, b) => a.x - b.x);
    const R = rushPool.length;
    const G = rushFreeGaps.length;

    if (G === 0) {
      rushPool.forEach(d => { d.assignment = { type: 'rush' }; d.decision = assignmentToDecision(d.assignment); });
    } else {
      const gapX = rushFreeGaps.map(g => ballX + GAP_OFFSETS_PX[g]);
      const assign = Math.min(R, G); // how many rushers get a gap
      const INF2 = 1e15;

      // dp[i][j] = min cost assigning first i rushers, considering gaps[0..j-1]
      const dp = Array.from({ length: R + 1 }, () => new Float64Array(G + 1).fill(INF2));
      for (let j = 0; j <= G; j++) dp[0][j] = 0; // 0 rushers assigned → cost 0

      for (let i = 1; i <= assign; i++) {
        for (let j = i; j <= G - (assign - i); j++) { // enough gaps remain for remaining rushers
          // Option 1: skip gap j-1, don't assign it to anyone
          dp[i][j] = dp[i][j - 1];
          // Option 2: assign rusher i-1 to gap j-1
          const cost = Math.hypot(rushPool[i - 1].x - gapX[j - 1], rushPool[i - 1].y - losY);
          if (dp[i - 1][j - 1] + cost < dp[i][j]) dp[i][j] = dp[i - 1][j - 1] + cost;
        }
      }

      // Backtrack to find which gap each rusher was assigned
      const gapAssigned = new Array(R).fill(-1);
      let i = assign, j = G;
      while (i > 0 && j > 0) {
        const cost = Math.hypot(rushPool[i - 1].x - gapX[j - 1], rushPool[i - 1].y - losY);
        if (dp[i - 1][j - 1] !== INF2 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + cost)) < 0.001) {
          gapAssigned[i - 1] = j - 1; // rusher i-1 gets gap j-1
          i--; j--;
        } else {
          j--; // gap j-1 was skipped
        }
      }

      // Apply assignments
      rushPool.forEach((d, idx) => {
        const gIdx = gapAssigned[idx];
        if (gIdx >= 0) {
          d.assignment = { type: 'gap', gapId: rushFreeGaps[gIdx], fillType: 'fill' };
          assignedGaps.add(rushFreeGaps[gIdx]);
        } else {
          d.assignment = { type: 'rush' }; // more rushers than gaps
        }
        d.decision = assignmentToDecision(d.assignment);
      });
    }
  }

  // ── Step 2: Count remaining gaps after DL + QB Rushers ──────────────
  const openGapIds = allGapIds.filter(g => !assignedGaps.has(g));
  if (openGapIds.length === 0) {
    dPlayers.forEach(d => {
      if (d.assignment.type !== 'none') return;
      const structRole = roleMap.get(d.id) || 'UNDER';
      d.assignment = structRole === 'CB' ? { type: 'contain' } : { type: 'pursuit' };
      d.decision   = assignmentToDecision(d.assignment);
    });
    return;
  }
  let slotsLeft = openGapIds.length;

  // ── Step 3: Build pool in tier priority order ──────────────────────
  // Priority: LB → NICKEL → SS → FS → CB
  // Each tier is fully added. We stop adding NEW tiers once pool >= slotsLeft.
  // If the last tier causes an overflow (pool > slotsLeft), the DP in Step 4
  // will select the optimal subset from the entire pool.
  const isAvail = d => (!respectManual || !d._manualAssignment) && !d._runFitManualLocked && d.assignment.type === 'none';
  const byDistToCenter = (a, b) => Math.abs(a.x - ballX) - Math.abs(b.x - ballX);

  const tiers = [
    dPlayers.filter(d => isAvail(d) && LB_ROLES.has(d.role)).sort(byDistToCenter),
    dPlayers.filter(d => isAvail(d) && d.role === 'NICKEL').sort(byDistToCenter),
    dPlayers.filter(d => isAvail(d) && d.role === 'SS'),
    dPlayers.filter(d => isAvail(d) && d.role === 'FS'),
    dPlayers.filter(d => isAvail(d) && d.role === 'CB'),
  ];

  const gapPool = [];
  for (const tier of tiers) {
    if (gapPool.length >= slotsLeft) break; // pool already full, don't add lower-priority tiers
    for (const d of tier) {
      gapPool.push(d);
    }
  }

  if (gapPool.length === 0) {
    dPlayers.forEach(d => {
      if (d.assignment.type !== 'none') return;
      const structRole = roleMap.get(d.id) || 'UNDER';
      d.assignment = structRole === 'CB' ? { type: 'contain' } : { type: 'pursuit' };
      d.decision   = assignmentToDecision(d.assignment);
    });
    return;
  }

  // Everyone NOT in pool → CB:contain, rest:pursuit (assigned now, before DP)
  const poolIdSet = new Set(gapPool.map(d => d.id));
  dPlayers.forEach(d => {
    if (d.assignment.type !== 'none') return;
    if (poolIdSet.has(d.id)) return;
    const structRole = roleMap.get(d.id) || 'UNDER';
    d.assignment = structRole === 'CB' ? { type: 'contain' } : { type: 'pursuit' };
    d.decision   = assignmentToDecision(d.assignment);
  });

  // ── Step 4: Optimal left-to-right gap assignment via DP ────────────
  // Both gaps and pool members are sorted left-to-right by X.
  // DP selects the best min(poolSize, gapCount) members from the pool
  // such that total travel distance is minimized with no crossings.
  //
  // dp[i][j] = min total distance assigning some subset of pool[0..i-1]
  //            to gaps[0..j-1], all left-to-right.
  const sortedGaps = openGapIds.slice().sort((a, b) =>
    (ballX + GAP_OFFSETS_PX[a]) - (ballX + GAP_OFFSETS_PX[b])
  );
  const gapAbsX = sortedGaps.map(g => ballX + GAP_OFFSETS_PX[g]);
  const N = sortedGaps.length;

  const sortedPool = gapPool.slice().sort((a, b) => a.x - b.x);
  const M = sortedPool.length;
  const fillCount = Math.min(N, M);

  const INF = 1e15;
  const dp = Array.from({ length: M + 1 }, () => new Float64Array(fillCount + 1).fill(INF));
  dp[0][0] = 0;

  for (let i = 1; i <= M; i++) {
    dp[i][0] = 0;
    for (let j = 1; j <= Math.min(i, fillCount); j++) {
      // Option 1: skip pool member i
      dp[i][j] = dp[i - 1][j];
      // Option 2: assign pool member i to gap j (Euclidean distance to gap at LOS)
      const cost = Math.hypot(sortedPool[i - 1].x - gapAbsX[j - 1], sortedPool[i - 1].y - losY);
      if (dp[i - 1][j - 1] + cost < dp[i][j]) {
        dp[i][j] = dp[i - 1][j - 1] + cost;
      }
    }
  }

  // Backtrack to find which pool members were selected
  const selected = new Set();
  let j2 = fillCount;
  for (let i = M; i >= 1 && j2 > 0; i--) {
    const cost = Math.hypot(sortedPool[i - 1].x - gapAbsX[j2 - 1], sortedPool[i - 1].y - losY);
    if (Math.abs(dp[i][j2] - (dp[i - 1][j2 - 1] + cost)) < 0.001) {
      selected.add(i - 1);
      j2--;
    }
  }

  // Assign gaps left-to-right to selected pool members
  let gapIdx = 0;
  for (let i = 0; i < M; i++) {
    if (selected.has(i) && gapIdx < fillCount) {
      const d = sortedPool[i];
      const gapId = sortedGaps[gapIdx];
      d.assignment = { type: 'gap', gapId, fillType: 'scrape' };
      assignedGaps.add(gapId);
      d.decision = assignmentToDecision(d.assignment);
      gapIdx++;
    }
  }

  // Pool members NOT selected by DP → pursuit (they were in the overflow)
  gapPool.forEach(d => {
    if (d.assignment.type !== 'none') return;
    const structRole = roleMap.get(d.id) || 'UNDER';
    d.assignment = structRole === 'CB' ? { type: 'contain' } : { type: 'pursuit' };
    d.decision   = assignmentToDecision(d.assignment);
  });
}

function recomputeRunFits() {
  if (defensePlayers.length === 0) return;
  applyRunFitAssignments(defensePlayers, true); // respectManual=true in editor
  // Apply manual run fit assignments on top — but never overwrite a pass assignment
  defensePlayers.forEach(d => {
    if (d._manualRunAssignment && d.runAssignment && d.runAssignment.type !== 'none') {
      // Only apply run fit if there's no manual pass assignment
      if (!d._manualAssignment) {
        d.assignment = { ...d.runAssignment };
        d.decision   = assignmentToDecision(d.assignment);
      }
    }
    // Restore pass assignment if it was wiped by applyRunFitAssignments
    if (d._manualAssignment && d.passAssignment) {
      d.assignment = { ...d.passAssignment };
      d.decision   = assignmentToDecision(d.assignment);
    }
  });
  refreshRunFitsSummary();
  refreshDefAssignBox();
  draw();
}

// ── CB alignment: save spacing/shade changes ─────────────────────────
function onCBAlignSave() {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d) return;
  const spEl = document.getElementById('defCBSpacing');
  const shEl = document.getElementById('defCBShade');
  d.cbSpacing = spEl ? spEl.value : 'normal';
  d.cbShade   = shEl ? shEl.value : 'normal';
  d._manualAlignment = true; // user override — preset won't overwrite this
  // Re-apply position if we know which WR this CB mirrors
  if (d.mirroredWRId != null) {
    const wr = players.find(p => p.id === d.mirroredWRId);
    if (wr) placeCBOnWR(d, wr);
  }
  draw();
}

// Spacing → yards off LOS (upfield of the WR, same Y reference = WR's Y - offset)
const CB_SPACING_YD = { press: 0.5, normal: 4, near: 7, off: 10 };
// Shade → horizontal offset in yards (toward ball = inside, away = outside)
const CB_SHADE_YD   = { inside: 1, normal: 0, outside: -1 }; // negative = away from ball

// Place a CB/Nickel directly in front of their WR, applying spacing + shade.
// "In front" = same horizontal position as WR (with shade offset), spacing yards upfield.
function placeCBOnWR(db, wr) {
  const los    = LOS_Y();
  const ballX  = ball.x;
  const spacingPx = (CB_SPACING_YD[db.cbSpacing || 'normal'] || 4) * YARD_PX;
  const shadePx   = (CB_SHADE_YD[db.cbShade || 'normal'] || 0) * YARD_PX;

  // Shade direction: inside = toward ball
  const side       = wr.x < ballX ? 'L' : 'R';
  const shadeDir   = side === 'L' ? 1 : -1;  // L side: inside = rightward (+x toward ball)

  const wrX = wr.simX ?? wr.x;
  const wrY = wr.simY ?? wr.y;

  db.x = Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14,
           wrX + shadeDir * shadePx));
  // spacing = upfield of the WR (WR is at or behind LOS; CB is further upfield)
  db.y = Math.min(los - 0.5 * YARD_PX, Math.max(20, wrY - spacingPx));
  db.origX = db.x; db.origY = db.y;
  db.simX  = db.x; db.simY  = db.y;
  db.mirroredWRId = wr.id;
}

// ── After formation is placed, align CBs/Nickels to outermost skill players ──
// Also: nudge LBs toward their covered gaps, and place SS on strong side.
function alignDBsToWideouts() {
  if (players.length === 0) return;

  const los   = LOS_Y();
  const ballX = ball.x;

  // ── Use buildReactiveTargets as single source of truth for X positions ──
  // This ensures formation preset and reactive formation always agree,
  // so defenders don't jump when preplay/reactive kicks in.
  const offNow = players.map(p => ({ x: p.x, isOline: !!p.isOline }));
  const targets = buildReactiveTargets(offNow);

  if (!targets.length) return;

  const DB_ROLES = new Set(['CB', 'NICKEL']);

  // ── Match targets to defenders by role (same algorithm as reactiveFormationSimStep) ──
  const usedIdx = new Set();
  defensePlayers.forEach(d => {
    let bestIdx = -1, bestDist = Infinity;
    targets.forEach((t, i) => {
      if (usedIdx.has(i) || t.role !== d.role) return;
      const dist = Math.abs(t.x - d.x);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    if (bestIdx < 0) return;
    usedIdx.add(bestIdx);

    const tgtX = targets[bestIdx].x;

    if (DB_ROLES.has(d.role)) {
      // CBs / Nickels: X from reactive target + shade, Y from cbSpacing depth
      const shadeOff = computeShadeOffset(d);
      d.x = Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14, tgtX + shadeOff));

      // Find the WR this DB mirrors (closest offense player to the raw target X)
      const skill = players.filter(p => !p.isOline);
      let closestWR = null, closestD = Infinity;
      skill.forEach(wr => {
        const dd = Math.abs(wr.x - tgtX);
        if (dd < closestD) { closestD = dd; closestWR = wr; }
      });
      if (closestWR) {
        d.mirroredWRId = closestWR.id;
        const spacingPx = (CB_SPACING_YD[d.cbSpacing || 'normal'] || 4) * YARD_PX;
        d.y = Math.min(los - 0.5 * YARD_PX, Math.max(20, closestWR.y - spacingPx));
      }
    } else if (LB_ROLES.has(d.role)) {
      // LBs: X and Y from reactive target (trigger-based depth)
      d.x = tgtX;
      if (targets[bestIdx].y !== null) {
        d.y = targets[bestIdx].y;
      }
    }
    // DEs, DTs, safeties: keep current positions (set by formation spawn)

    d.origX = d.x; d.simX = d.x;
    d.origY = d.y; d.simY = d.y;
  });
}

// ── Add / Remove ─────────────────────────────────────────────────────
function addDefender() {
  if (defensePlayers.length >= DEF_MAX_COUNT) {
    showToast(`⚠ Max ${DEF_MAX_COUNT} defenders`); return;
  }
  // Spawn on defense side: above LOS (canvas: y < LOS_Y)
  const col = defensePlayers.length % 5;
  const row = Math.floor(defensePlayers.length / 5);
  const spawnX = FIELD_W / 2 - 80 + col * 40;
  const spawnY = LOS_Y() - YARD_PX * 5 - row * YARD_PX * 4;
  const d = makeDefender(spawnX, Math.max(20, spawnY));
  defensePlayers.push(d);
  selectedDefId = d.id;
  activeTeam = 'D';
  refreshDefPlayerList();
  refreshDefAssignBox();
  if (activePreset !== 'manual') refreshPresetMatchList();
  draw();
}

function removeSelectedDefender() {
  if (!selectedDefId) return;
  defensePlayers = defensePlayers.filter(d => d.id !== selectedDefId);
  selectedDefId  = defensePlayers.length > 0 ? defensePlayers[defensePlayers.length - 1].id : null;
  refreshDefPlayerList();
  refreshDefAssignBox();
  if (activePreset !== 'manual') refreshPresetMatchList();
  draw();
}

// ── UI: Player list ──────────────────────────────────────────────────
function refreshDefPlayerList() {
  const el = document.getElementById('defPlayerList');
  if (!el) return;
  if (defensePlayers.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:4px 2px">No defenders added</div>';
    return;
  }
  el.innerHTML = defensePlayers.map(d => {
    const isSel = d.id === selectedDefId;
    const asg = d.assignment;

    // When a preset is active, show the preset decision as the tag.
    // When manual, show d.assignment.
    let asgTag = '';
    let asgColor = 'var(--text-dim)';

    const presetDec = (activePreset !== 'manual' && offenseStructureSnapshot && d.decision)
      ? d.decision : null;

    if (presetDec) {
      // Preset is active — show the preset decision
      if (presetDec.mode === 'rush') {
        asgTag = 'RUSH'; asgColor = '#f87171';
      } else if (presetDec.mode === 'drop' && presetDec.focusLandmarkId) {
        asgTag = presetDec.focusLandmarkId
          .replace('HOOK_MIDDLE','HK-M').replace('HOOK_L','HK-L').replace('HOOK_R','HK-R')
          .replace('FLAT_L','FL-L').replace('FLAT_R','FL-R')
          .replace('CURL_L','CL-L').replace('CURL_R','CL-R')
          .replace('DEEP_L','DP-L').replace('DEEP_R','DP-R')
          .replace('DEEP_MIDDLE','DP-M').replace('DEEP_FREE','DP-F').replace('TAMPA_MIDDLE','T2-M')
          .replace('DEEP_HALF_L','½L').replace('DEEP_HALF_R','½R')
          .replace('DEEP_QRTR_L','¼L').replace('DEEP_QRTR_R','¼R')
          .replace('DEEP_QRTR_ML','¼ML').replace('DEEP_QRTR_MR','¼MR')
          .replace('CURL_FLAT_L','CF-L').replace('CURL_FLAT_R','CF-R')
          .replace('HOOK_CURL_L','HC-L').replace('HOOK_CURL_R','HC-R');
        asgColor = '#fde68a';
      } else if (presetDec.mode === 'follow' && presetDec.focusTargetId != null) {
        asgTag = `MAN#${presetDec.focusTargetId}`; asgColor = '#67e8f9';
      }
      // mode:'idle' with _runFit means gap/contain/spill — fall through to d.assignment below
      if (!asgTag && asg.type === 'gap') {
        const parts = (asg.gapId || '').split('_gap_');
        asgTag = parts.length === 2 ? `${parts[0]}_${parts[1]}` : (asg.gapId || '').toUpperCase();
        asgColor = '#4ade80';
      } else if (!asgTag && asg.type === 'contain') {
        asgTag = 'CONT'; asgColor = '#facc15';
      } else if (!asgTag && asg.type === 'spill') {
        asgTag = 'SPILL'; asgColor = '#f97316';
      }
    } else {
      // Manual mode — show raw assignment
      if (asg.type === 'man') {
        asgTag = `MAN#${asg.targetId ?? '?'}`; asgColor = '#67e8f9';
      } else if (asg.type === 'zone') {
        asgTag = (asg.landmarkId || 'ZONE').replace('HOOK_MIDDLE','HK-M').replace('HOOK_L','HK-L').replace('HOOK_R','HK-R').replace('FLAT_L','FL-L').replace('FLAT_R','FL-R').replace('CURL_L','CL-L').replace('CURL_R','CL-R').replace('DEEP_L','DP-L').replace('DEEP_R','DP-R').replace('DEEP_MIDDLE','DP-M').replace('TAMPA_MIDDLE','T2-M').replace('DEEP_FREE','DP-F').replace('DEEP_HALF_L','½L').replace('DEEP_HALF_R','½R').replace('DEEP_QRTR_L','¼L').replace('DEEP_QRTR_R','¼R').replace('DEEP_QRTR_ML','¼ML').replace('DEEP_QRTR_MR','¼MR').replace('CURL_FLAT_L','CF-L').replace('CURL_FLAT_R','CF-R').replace('HOOK_CURL_L','HC-L').replace('HOOK_CURL_R','HC-R');
        asgColor = '#fde68a';
      } else if (asg.type === 'rush') {
        asgTag = 'RUSH'; asgColor = '#f87171';
      } else if (asg.type === 'gap') {
        const parts = (asg.gapId || '').split('_gap_');
        asgTag = parts.length === 2 ? `${parts[0]}_${parts[1]}` : (asg.gapId || '').toUpperCase();
        asgColor = '#4ade80';
      } else if (asg.type === 'contain') {
        asgTag = 'CONT'; asgColor = '#facc15';
      } else if (asg.type === 'spill') {
        asgTag = 'SPILL'; asgColor = '#f97316';
      }
    }

    // Structural role badge from current decision
    let ahBadge = '';
    if (activePreset !== 'manual' && d.decision) {
      const dec = d.decision;
      const sl = dec._apexHook || dec._structRole || null;
      const sc = !sl ? '' : sl.startsWith('APEX') ? '#fb923c' : sl.startsWith('HOOK') ? '#a78bfa' : sl === 'CB' ? '#4ade80' : sl === 'SAF_W' ? '#67e8f9' : sl === 'SAF_S' ? '#93c5fd' : '#93c5fd';
      if (sl) ahBadge = `<span style="color:${sc};font-size:9px;font-weight:700;margin-left:4px">${sl}</span>`;
    }
    return `<div class="def-player-item${isSel ? ' selected' : ''}" onclick="selectDefender(${d.id})">
      <span class="dot" style="background:${isSel ? DEF_COLOR_SEL : DEF_COLOR}"></span>
      <span>${d.role}${d.id}${ahBadge}</span>
      ${(asgTag && showJobsActive) ? `<span style="margin-left:auto;font-size:10px;font-weight:700;letter-spacing:0.8px;color:${asgColor}">${asgTag}</span>` : ''}
    </div>`;
  }).join('');
}

function selectDefender(id) {
  selectedDefId = id;
  activeTeam    = 'D';
  refreshDefPlayerList();
  refreshDefAssignBox();
  draw();
}

// ── UI: Assignment box ───────────────────────────────────────────────

function onDefAssignTypeChange() {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d) return;
  const newType = document.getElementById('defAssignType').value;
  d.assignment = { type: newType };
  if (newType === 'man') {
    d.assignment.targetId      = players.length > 0 ? players[0].id : null;
    d.assignment.leverage      = 'headUp';
    d.assignment.trailDistance = 1;
  }
  if (newType === 'zone') {
    d.assignment.landmarkId = 'HOOK_MIDDLE';
  }
  // Store pass assignment separately so recomputeRunFits can restore it
  d.passAssignment    = newType !== 'none' ? { ...d.assignment } : null;
  d._manualAssignment = (newType !== 'none');
  d.decision = assignmentToDecision(d.assignment);
  refreshDefPlayerList();
  refreshDefAssignBox();
  draw();
}

function onDefAssignSave() {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d) return;
  if (d.assignment.type === 'man') {
    const targEl  = document.getElementById('defManTarget');
    const levEl   = document.getElementById('defManLeverage');
    const trailEl = document.getElementById('defTrailDist');
    if (targEl && targEl.value !== '') {
      const parsed = parseInt(targEl.value, 10);
      if (!isNaN(parsed)) d.assignment.targetId = parsed;
    }
    if (levEl)   d.assignment.leverage      = levEl.value;
    if (trailEl) d.assignment.trailDistance = parseFloat(trailEl.value);
  }
  if (d.assignment.type === 'zone') {
    const lmEl = document.getElementById('defZoneLandmark');
    if (lmEl && lmEl.value) d.assignment.landmarkId = lmEl.value;
  }
  if (d.assignment.type === 'gap') {
    const gapEl  = document.getElementById('defGapSelect');
    const fillEl = document.getElementById('defGapFillType');
    if (gapEl)  d.assignment.gapId    = gapEl.value;
    if (fillEl) d.assignment.fillType = fillEl.value;
  }
  refreshDefPlayerList();
  // Keep passAssignment in sync
  if (d._manualAssignment) d.passAssignment = { ...d.assignment };
  const statusEl = document.getElementById('defStatus');
  if (statusEl) {
    let tStr;
    if (d.assignment.type === 'man')     tStr = `MAN → #${d.assignment.targetId ?? '?'}`;
    else if (d.assignment.type === 'zone')    tStr = `ZONE → ${d.assignment.landmarkId}`;
    else if (d.assignment.type === 'rush')    tStr = 'RUSH QB';
    else if (d.assignment.type === 'gap')     tStr = `GAP → ${(d.assignment.gapId||'').replace('_gap_',' ')} (${d.assignment.fillType||'fill'})`;
    else if (d.assignment.type === 'contain') tStr = 'CONTAIN edge';
    else if (d.assignment.type === 'spill')   tStr = 'SPILL/FORCE';
    else                                      tStr = 'NONE';
    statusEl.textContent = `${d.role}${d.id} — ${tStr}`;
  }
  refreshRunFitsSummary();
  draw();
}

// Allow clicking an offense player on the field to set as man-coverage target
// when a defender with man assignment is selected. Called from mousedown.
function tryAssignManTargetByClick(offensePlayer) {
  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d || d.assignment.type !== 'man') return false;
  d.assignment.targetId = offensePlayer.id;
  refreshDefPlayerList();
  refreshDefAssignBox();
  const statusEl = document.getElementById('defStatus');
  if (statusEl) statusEl.textContent = `${d.role}${d.id} — MAN → #${offensePlayer.id} (${offensePlayer.label})`;
  draw();
  return true; // consumed the click
}

function refreshDefAssignBox() {
  const box    = document.getElementById('defAssignBox');
  const status = document.getElementById('defStatus');
  if (!box || !status) return;

  const d = defensePlayers.find(p => p.id === selectedDefId);
  if (!d) {
    box.style.display  = 'none';
    status.textContent = 'No defender selected';
    return;
  }

  box.style.display = 'block';

  // Reset change-position dropdown
  const cpEl = document.getElementById('defChangePosition');
  if (cpEl) cpEl.value = '';

  // Sync pass assignment type dropdown (man/zone/rush/none only)
  const typeEl = document.getElementById('defAssignType');
  const passType = ['man','zone','rush'].includes(d.assignment.type) ? d.assignment.type : 'none';
  if (typeEl) typeEl.value = passType;

  // Show/hide pass sub-panels
  document.getElementById('defManControls').style.display  = d.assignment.type === 'man'  ? 'block' : 'none';
  document.getElementById('defZoneControls').style.display = d.assignment.type === 'zone' ? 'block' : 'none';

  // CB/Nickel alignment controls
  const isCBRole = ['CB', 'NICKEL'].includes(d.role);
  const cbBox = document.getElementById('defCBControls');
  if (cbBox) {
    cbBox.style.display = isCBRole ? 'block' : 'none';
    if (isCBRole) {
      const spEl = document.getElementById('defCBSpacing');
      const shEl = document.getElementById('defCBShade');
      if (spEl) spEl.value = d.cbSpacing || 'normal';
      if (shEl) shEl.value = d.cbShade   || 'normal';
    }
  }

  // Man: rebuild target dropdown
  if (d.assignment.type === 'man') {
    const targEl = document.getElementById('defManTarget');
    if (targEl) {
      if (players.length === 0) {
        targEl.innerHTML = '<option value="">— add offense players first —</option>';
      } else {
        targEl.innerHTML = players.map(p =>
          `<option value="${p.id}"${p.id === d.assignment.targetId ? ' selected' : ''}>${p.label} #${p.id} (${p.type})</option>`
        ).join('');
        if (!players.find(p => p.id === d.assignment.targetId)) {
          d.assignment.targetId = players[0].id;
          targEl.value = String(players[0].id);
        }
      }
    }
    const levEl   = document.getElementById('defManLeverage');
    const trailEl = document.getElementById('defTrailDist');
    const trailVl = document.getElementById('defTrailDistVal');
    if (levEl)   levEl.value   = d.assignment.leverage ?? 'headUp';
    if (trailEl) trailEl.value = d.assignment.trailDistance ?? 1;
    if (trailVl) trailVl.textContent = (d.assignment.trailDistance ?? 1) + 'yd';
  }

  // Zone: sync landmark
  if (d.assignment.type === 'zone') {
    const lmEl = document.getElementById('defZoneLandmark');
    if (lmEl) lmEl.value = d.assignment.landmarkId || 'HOOK_MIDDLE';
  }

  // Run Fit: sync separate runAssignment
  if (!d.runAssignment) d.runAssignment = { type: 'none' };
  const runFitEl = document.getElementById('defRunFitType');
  if (runFitEl) runFitEl.value = d.runAssignment.type || 'none';
  const gapCtrl = document.getElementById('defGapControls');
  if (gapCtrl) gapCtrl.style.display = d.runAssignment.type === 'gap' ? '' : 'none';
  if (d.runAssignment.type === 'gap') {
    const gapEl  = document.getElementById('defGapSelect');
    const fillEl = document.getElementById('defGapFillType');
    if (gapEl)  gapEl.value  = d.runAssignment.gapId    || (d.x < ball.x ? 'A_gap_L' : 'A_gap_R');
    if (fillEl) fillEl.value = d.runAssignment.fillType || 'fill';
  }

  // Status line
  let tStr;
  if (d.assignment.type === 'man')          tStr = `MAN → #${d.assignment.targetId ?? '?'}`;
  else if (d.assignment.type === 'zone')    tStr = `ZONE → ${d.assignment.landmarkId}`;
  else if (d.assignment.type === 'rush')    tStr = 'RUSH QB';
  else                                      tStr = 'NONE';
  const runStr = d.runAssignment.type === 'gap'     ? ` | GAP ${(d.runAssignment.gapId||'').replace('_gap_',' ')}`
               : d.runAssignment.type === 'contain' ? ' | CONTAIN'
               : d.runAssignment.type === 'spill'   ? ' | SPILL'
               : '';
  status.textContent = `${d.role}${d.id} — ${tStr}${runStr}`;
  refreshRunFitsSummary();
}

// ── Deselect all (offense + defense) ─────────────────────────────────
function deselectAll() {
  selectedPlayerId = null;
  selectedDefId    = null;
  activeTeam       = 'O';
  refreshPlayerList();
  refreshDefPlayerList();
  refreshDefAssignBox();
  draw();
}

// ── Defense Players accordion ─────────────────────────────────────────
let defPlayersAccordionOpen = false;
function toggleDefPlayersAccordion() {
  defPlayersAccordionOpen = !defPlayersAccordionOpen;
  const body = document.getElementById('defPlayersAccordionBody');
  const hdr  = document.getElementById('defPlayersAccordionHeader');
  body.classList.toggle('hidden', !defPlayersAccordionOpen);
  hdr.classList.toggle('open', defPlayersAccordionOpen);
}

// ── Zoom Tool ─────────────────────────────────────────────────────────
// When active: canvas is scaled/translated so only ±10 yards around ball is visible.
let zoomToolActive = false;
function toggleZoomTool() {
  zoomToolActive = !zoomToolActive;
  const btn = document.getElementById('zoomToolBtn');
  btn.classList.toggle('active', zoomToolActive);
  draw();
}

// Apply zoom transform to ctx if active. Call before drawing, restore after.
// Returns true if zoom was applied (caller must ctx.restore()).
// Convert a raw canvas-space point (mx, my) to field coordinates,
// accounting for the active zoom transform.
function toFieldCoords(mx, my) {
  if (!zoomToolActive) return { x: mx, y: my };
  const ZOOM_PX = 10 * YARD_PX;
  const srcX = ball.x - ZOOM_PX;
  const srcY = ball.y - ZOOM_PX;
  const srcW = ZOOM_PX * 2;
  const srcH = ZOOM_PX * 2;
  const scaleX = FIELD_W / srcW;
  const scaleY = FIELD_H / srcH;
  return { x: mx / scaleX + srcX, y: my / scaleY + srcY };
}

function applyZoomTransform() {
  if (!zoomToolActive) return false;
  const ZOOM_YARDS  = 10;
  const ZOOM_PX     = ZOOM_YARDS * YARD_PX;          // 200px on each side
  const srcX = ball.x - ZOOM_PX;
  const srcY = ball.y - ZOOM_PX;
  const srcW = ZOOM_PX * 2;
  const srcH = ZOOM_PX * 2;
  const scaleX = FIELD_W / srcW;
  const scaleY = FIELD_H / srcH;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.translate(-srcX, -srcY);
  return true;
}

// ── Show Jobs Toggle ──────────────────────────────────────────────────
let showJobsActive = true; // on by default
function toggleShowJobs() {
  showJobsActive = !showJobsActive;
  const btn = document.getElementById('showJobsBtn');
  btn.classList.toggle('active', showJobsActive);
  refreshDefPlayerList();
  draw();
}

// ── Show Zones Toggle ─────────────────────────────────────────────────
let showZonesActive = false;
function toggleShowZones() {
  showZonesActive = !showZonesActive;
  const btn = document.getElementById('showZonesBtn');
  btn.classList.toggle('active', showZonesActive);
  draw();
}

// ── Show Run Fits Toggle ──────────────────────────────────────────────
let showRunFitsActive = false;
function toggleShowRunFits() {
  showRunFitsActive = !showRunFitsActive;
  const btn = document.getElementById('showRunFitsBtn');
  btn.classList.toggle('active', showRunFitsActive);
  refreshRunFitsSummary();
  draw();
}

// ── Reactive Formation Toggle ─────────────────────────────────────────
let reactiveFormationActive = true;
// 'presnap' | 'after' | false
let reactiveFormationMode = 'presnap';

function toggleReactiveFormation(mode_) {
  const btnPre   = document.getElementById('reactiveFormationBtn');
  const btnAfter = document.getElementById('reactiveFormationAfterBtn');
  if (reactiveFormationMode === mode_) {
    // clicking same button = toggle off
    reactiveFormationMode  = false;
    reactiveFormationActive = false;
  } else {
    reactiveFormationMode  = mode_;
    reactiveFormationActive = true;
  }
  btnPre.classList.toggle('active',   reactiveFormationMode === 'presnap');
  btnAfter.classList.toggle('active', reactiveFormationMode === 'after');
  if (reactiveFormationActive) {
    const key = document.getElementById('formationPresetSelect')?.value;
    if (!key) { showToast('⚠ Select a defense formation first', 'warn'); return; }
    reactiveFormationUpdate();
  }
}

// ── Reactive Formation: re-apply preset when offense moves (editor) ───
function reactiveFormationUpdate() {
  if (!reactiveFormationActive) return;
  if (mode !== 'editor') return;

  // Rebuild snapshot NOW so _attachmentZone reflects current player positions
  rebuildOffenseStructureSnapshot(reactiveFormationMode === 'presnap');

  // Pre-Snap: use p.x — base positions before any shift/motion waypoints
  // After:    use getSnapPos — end of shift/motion waypoints
  const offNow = players.map(p => {
    const pos = reactiveFormationMode === 'after' ? getSnapPos(p) : { x: p.x };
    return { x: pos.x, isOline: !!p.isOline };
  });
  const tmpDef = buildReactiveTargets(offNow);
  if (!tmpDef.length) return;

  const usedIdx = new Set();
  defensePlayers.forEach(d => {
    let bestIdx = -1, bestDist = Infinity;
    tmpDef.forEach((t, i) => {
      if (usedIdx.has(i) || t.role !== d.role) return;
      const dist = Math.abs(t.x - d.x);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    if (bestIdx < 0) return;
    usedIdx.add(bestIdx);
    const DB_ROLES2 = new Set(['CB', 'NICKEL']);
    if (DB_ROLES2.has(d.role)) {
      d.x = tmpDef[bestIdx].x + computeShadeOffset(d);
    } else {
      d.x = tmpDef[bestIdx].x;
    }
    if (tmpDef[bestIdx].y !== null) {
      d.y = tmpDef[bestIdx].y;
    }
    d.origX = d.x; d.simX = d.x;
    d.origY = d.y; d.simY = d.y;
  });
  draw();
}

// ── Reactive Formation: helper — build temp formation targets from current offense positions ──
// offensePositions: array of {x, isOline} using current simX (or p.x in editor)
function buildReactiveTargets(offensePositions) {
  const key = document.getElementById('formationPresetSelect')?.value;
  if (!key) return [];
  const formation = DEF_FORMATIONS[key];
  if (!formation) return [];

  const cx = ball.x;
  const useOver   = _reactiveDTOver;
  const DT_STRONG = useOver ?  2.4 :  0.8;
  const DT_WEAK   = useOver ? -0.8 : -2.4;

  const losY = LOS_Y();

  const tmpDef = formation.players.map(p => {
    let dxVal = p.dx;
    if (dxVal === 'DT_STRONG') dxVal = DT_STRONG;
    if (dxVal === 'DT_WEAK')   dxVal = DT_WEAK;
    if (dxVal === 'HASH_STRONG') { const o=(cx-FIELD_W/2)/YARD_PX; dxVal=(RIGHT_HASH-cx)/YARD_PX+o/2; }
    if (dxVal === 'HASH_WEAK')   { const o=(cx-FIELD_W/2)/YARD_PX; dxVal=(LEFT_HASH -cx)/YARD_PX+o/2; }
    return {
      role: p.role,
      x: Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, cx + dxVal*YARD_PX)),
      y: null,   // null = keep defender's current Y; set to override depth
    };
  });

  const skill   = offensePositions.filter(p => !p.isOline);
  const leftOff = skill.filter(p => p.x < cx).sort((a,b) => a.x - b.x);
  const rightOff= skill.filter(p => p.x >= cx).sort((a,b) => b.x - a.x);

  const DB_ROLES = new Set(['CB','NICKEL']);
  const dbLeft  = tmpDef.filter(d => DB_ROLES.has(d.role) && d.x < cx).sort((a,b) => a.x-b.x);
  const dbRight = tmpDef.filter(d => DB_ROLES.has(d.role) && d.x >= cx).sort((a,b) => b.x-a.x);
  dbLeft.forEach((db,i)  => { if (leftOff[i])  db.x = leftOff[i].x; });
  dbRight.forEach((db,i) => { if (rightOff[i]) db.x = rightOff[i].x; });

  // ── Formation-specific LB trigger logic ───────────────────────────────
  // Each formation block reads offenseStructureSnapshot for attachment zones,
  // strong side, and receiver distribution — then sets X and Y per LB role.
  // Generic LB shift has been removed; all LB movement is trigger-based here.

  if (key === '4-3-over') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = snap?.leftEligible  || [];
    const rightElig  = snap?.rightEligible || [];
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;
    const is2x2         = strongCount === 2 && weakCount === 2;

    const clampX = x => Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    // ── Base spots (formation preset positions, relative to cx) ────────
    const samBaseX  = cx + dir     * 4 * YARD_PX;
    const willBaseX = cx + weakDir * 4 * YARD_PX;
    const mikeBaseX = cx;

    // ── SAM/WILL helper: position based on #2 attachment zone ──────────
    // Returns the target X for SAM or WILL given their base, #2, and its zone.
    // No #2: midpoint between LB base and MIKE base.
    function lbXFromZone(lbBase, rec2) {
      if (!rec2) {
        // No #2 on this side — split between LB base and MIKE base
        return (lbBase + mikeBaseX) / 2;
      }
      const r2x = getSnapPos(rec2).x;
      const zone = rec2._attachmentZone || 'WIDE';
      if (zone === 'ATTACHED') {
        // ATTACHED: stacked just outside, stay at base (reads run first)
        return lbBase;
      } else {
        // DETACHED / WIDE: midpoint between base and #2
        return (lbBase + r2x) / 2;
      }
    }

    // ── CB rule: #1 is ATTACHED → slide 5 yds toward sideline ────────
    const r1strong = recOn(strong, 1);
    const r1weak   = recOn(weak, 1);
    const cbStrongAttached = r1strong?._attachmentZone === 'ATTACHED';
    const cbWeakAttached   = r1weak?._attachmentZone   === 'ATTACHED';

    const cbStrong = tmpDef.find(d => d.role === 'CB' && (strong === 'R' ? d.x >= cx : d.x < cx));
    const cbWeak   = tmpDef.find(d => d.role === 'CB' && (strong === 'R' ? d.x < cx  : d.x >= cx));

    if (cbStrongAttached && cbStrong && r1strong) {
      cbStrong.x = clampX(getSnapPos(r1strong).x + dir * 5 * YARD_PX);
    }
    if (cbWeakAttached && cbWeak && r1weak) {
      cbWeak.x = clampX(getSnapPos(r1weak).x + weakDir * 5 * YARD_PX);
    }

    // ── Defender refs ──────────────────────────────────────────────────
    const sam  = tmpDef.find(d => d.role === 'SAM');
    const mike = tmpDef.find(d => d.role === 'MIKE');
    const will = tmpDef.find(d => d.role === 'WILL');
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // ══════════════════════════════════════════════════════════════════
    // TRIGGER 1 — EMPTY BACKFIELD
    // ══════════════════════════════════════════════════════════════════
    if (isEmpty) {
      if (sam)  sam.y  = losY - YARD_PX * 5;
      if (will) will.y = losY - YARD_PX * 5;
      if (ss)   ss.y   = losY - YARD_PX * 10;

    // ══════════════════════════════════════════════════════════════════
    // TRIGGER 2 — TRIPS STRONG
    // MIKE midpoint between base and #3 strong.
    // SAM: position by zone of #2 strong.
    // WILL: position by zone of #2 weak (or midpoint if no #2 weak).
    // SS rotates to #2 strong. FS shades strong.
    // ══════════════════════════════════════════════════════════════════
    } else if (isTripsStrong) {
      const rec2s = recOn(strong, 2);
      const rec3s = recOn(strong, 3);
      const rec2w = recOn(weak, 2);

      // MIKE → midpoint between base and #3 strong
      if (mike) {
        const r3x = rec3s ? getSnapPos(rec3s).x : samBaseX;
        mike.x = clampX((mikeBaseX + r3x) / 2);
        mike.y = losY - YARD_PX * 4;
      }

      // SAM → zone rule on #2 strong
      if (sam) {
        sam.x = clampX(lbXFromZone(samBaseX, rec2s));
        sam.y = losY - YARD_PX * 3.5;
      }

      // WILL → zone rule on #2 weak
      if (will) {
        will.x = clampX(lbXFromZone(willBaseX, rec2w));
        will.y = losY - YARD_PX * 4.5;
      }

      // SS rotates to #2 strong
      if (ss && rec2s) {
        ss.x = clampX(getSnapPos(rec2s).x);
        ss.y = losY - YARD_PX * 6;
      }

      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);

    // ══════════════════════════════════════════════════════════════════
    // TRIGGER 3 — TRIPS WEAK
    // MIKE midpoint between base and #3 weak.
    // SAM: zone rule on #2 strong.
    // WILL: zone rule on #2 weak.
    // SS rotates to #2 weak.
    // ══════════════════════════════════════════════════════════════════
    } else if (isTripsWeak) {
      const rec2s = recOn(strong, 2);
      const rec2w = recOn(weak, 2);
      const rec3w = recOn(weak, 3);

      // MIKE → midpoint between base and #3 weak
      if (mike) {
        const r3x = rec3w ? getSnapPos(rec3w).x : willBaseX;
        mike.x = clampX((mikeBaseX + r3x) / 2);
        mike.y = losY - YARD_PX * 4;
      }

      // SAM → zone rule on #2 strong
      if (sam) {
        sam.x = clampX(lbXFromZone(samBaseX, rec2s));
        sam.y = losY - YARD_PX * 3.5;
      }

      // WILL → zone rule on #2 weak
      if (will) {
        will.x = clampX(lbXFromZone(willBaseX, rec2w));
        will.y = losY - YARD_PX * 4;
      }

      // SS rotates to #2 weak
      if (ss && rec2w) {
        ss.x = clampX(getSnapPos(rec2w).x);
        ss.y = losY - YARD_PX * 6;
      }

    // ══════════════════════════════════════════════════════════════════
    // TRIGGER 4 — 2x2
    // MIKE stays at base + RB shade.
    // SAM/WILL: zone rule on #2 each side.
    // ══════════════════════════════════════════════════════════════════
    } else if (is2x2) {
      const rec2s = recOn(strong, 2);
      const rec2w = recOn(weak, 2);

      // MIKE base + RB shade
      if (mike) {
        const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : 0;
        mike.x = clampX(mikeBaseX + rbSide * 0.5 * YARD_PX);
        mike.y = losY - YARD_PX * 4;
      }

      if (sam) {
        sam.x = clampX(lbXFromZone(samBaseX, rec2s));
        sam.y = losY - YARD_PX * 3.5;
      }

      if (will) {
        will.x = clampX(lbXFromZone(willBaseX, rec2w));
        will.y = losY - YARD_PX * 4.5;
      }

    // ══════════════════════════════════════════════════════════════════
    // TRIGGER 5 — 1x1 / other (solo receivers each side)
    // MIKE stays at base + RB shade.
    // SAM/WILL: no #2 → midpoint to MIKE.
    // ══════════════════════════════════════════════════════════════════
    } else {
      const rec2s = recOn(strong, 2);
      const rec2w = recOn(weak, 2);

      if (mike) {
        const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : 0;
        mike.x = clampX(mikeBaseX + rbSide * 0.5 * YARD_PX);
        mike.y = losY - YARD_PX * 4;
      }

      if (sam) {
        sam.x = clampX(lbXFromZone(samBaseX, rec2s));
        sam.y = losY - YARD_PX * 3.5;
      }

      if (will) {
        will.x = clampX(lbXFromZone(willBaseX, rec2w));
        will.y = losY - YARD_PX * 4.5;
      }
    }
  }
  // ══════════════════════════════════════════════════════════════════════
  // 4-3 UNDER
  // DL shifts weak → Strong DE head-up on OT, not outside.
  // SAM has more outside contain responsibility.
  // MIKE defaults slightly weak (Under principle).
  // WILL is wider than Over (dx=-5), covers more weak flat.
  // ══════════════════════════════════════════════════════════════════════
  if (key === '4-3-under') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;
    const is2x2         = strongCount === 2 && weakCount === 2;

    const olData    = olinePlayers();
    const oltX      = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX      = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const strongOTX = strong === 'R' ? ortX : oltX;
    const weakOTX   = strong === 'R' ? oltX : ortX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerStrong = sortInner(strongElig, strongOTX)[0] || null;
    const innerWeak   = sortInner(weakElig,   weakOTX)[0]   || null;
    const zoneStrong  = (innerStrong?._attachmentZone === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');
    const zoneWeak    = (innerWeak?._attachmentZone   === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    const sam  = tmpDef.find(d => d.role === 'SAM');
    const mike = tmpDef.find(d => d.role === 'MIKE');
    const will = tmpDef.find(d => d.role === 'WILL');
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // MIKE — Under principle: shade slightly WEAK by default
    if (mike) {
      const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : weakDir;
      mike.x = clampX(cx + rbSide * 0.5 * YARD_PX);
      mike.y = losY - YARD_PX * 4;
    }

    if (isEmpty) {
      if (sam)  sam.y  = losY - YARD_PX * 5;
      if (will) will.y = losY - YARD_PX * 5;
      if (ss)   ss.y   = losY - YARD_PX * 10;

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      const rec3 = recOn(strong, 3);
      if (mike) { mike.x = clampX(cx + dir * 2.5 * YARD_PX); mike.y = losY - YARD_PX * 4; }
      if (sam && rec3) { sam.x = clampX(getSnapPos(rec3).x); sam.y = losY - YARD_PX * 3; }
      else if (sam) sam.y = losY - YARD_PX * 4;
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      if (will) { will.x = clampX(cx + weakDir * 4 * YARD_PX); will.y = losY - YARD_PX * 4.5; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      if (ss && weakRec2) { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }
      if (will && weakRec3) { will.x = clampX(getSnapPos(weakRec3).x); will.y = losY - YARD_PX * 4; }
      else if (will) will.y = losY - YARD_PX * 4.5;
      if (sam && innerStrong) {
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2; }
        else sam.y = losY - YARD_PX * 4;
      }

    } else if (is2x2) {
      if (ss) ss.y = losY - YARD_PX * 10;
      if (fs) fs.y = losY - YARD_PX * 12;
      if (sam && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(ox + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2; }
        else if (zoneStrong === 'DETACHED') { sam.x = clampX(ox); sam.y = losY - YARD_PX * 5; }
        else { const b = cx + dir * 11 * YARD_PX; sam.x = clampX(b + 0.2 * (ox - b)); sam.y = losY - YARD_PX * 4; }
      }
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5; }
        else { const b = cx + weakDir * 11 * YARD_PX; will.x = clampX(b + 0.2 * (ox - b)); will.y = losY - YARD_PX * 4.5; }
      } else if (will) will.y = losY - YARD_PX * 4.5;

    } else {
      if (sam && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(ox + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2; }
        else if (zoneStrong === 'DETACHED') { sam.x = clampX(ox); sam.y = losY - YARD_PX * 5; }
        else { const b = cx + dir * 11 * YARD_PX; sam.x = clampX(b + 0.2 * (ox - b)); sam.y = losY - YARD_PX * 4; }
      }
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5; }
        else { const b = cx + weakDir * 11 * YARD_PX; will.x = clampX(b + 0.2 * (ox - b)); will.y = losY - YARD_PX * 4.5; }
      } else if (will) will.y = losY - YARD_PX * 4.5;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4-2-5 NICKEL
  // No SAM — Nickel handles slot (existing CB/Nickel alignment logic).
  // WILL: weak flat / #2 weak read.
  // MIKE: center, shades to RB side.
  // ══════════════════════════════════════════════════════════════════════
  if (key === '4-2-5') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;

    const olData  = olinePlayers();
    const oltX    = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX    = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const weakOTX = strong === 'R' ? oltX : ortX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerWeak = sortInner(weakElig, weakOTX)[0] || null;
    const zoneWeak  = (innerWeak?._attachmentZone   === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    const mike = tmpDef.find(d => d.role === 'MIKE');
    const will = tmpDef.find(d => d.role === 'WILL');
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // MIKE — center, shades to RB
    if (mike) {
      const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : 0;
      if (rb) mike.x = clampX(cx + rbSide * 0.5 * YARD_PX);
      mike.y = losY - YARD_PX * 4;
    }

    if (isEmpty) {
      if (mike) mike.y = losY - YARD_PX * 5;
      if (will) will.y = losY - YARD_PX * 5;
      if (ss)   ss.y   = losY - YARD_PX * 10;

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      if (mike) { mike.x = clampX(cx + dir * 2 * YARD_PX); mike.y = losY - YARD_PX * 4; }
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      if (will) { will.x = clampX(cx + weakDir * 4 * YARD_PX); will.y = losY - YARD_PX * 4.5; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      if (mike) { mike.x = clampX(cx + weakDir * 1.5 * YARD_PX); mike.y = losY - YARD_PX * 4; }
      if (will && weakRec3) { will.x = clampX(getSnapPos(weakRec3).x); will.y = losY - YARD_PX * 4; }
      else if (will) { will.x = clampX(cx + weakDir * 5 * YARD_PX); will.y = losY - YARD_PX * 4.5; }
      if (ss && weakRec2) { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }

    } else {
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5; }
        else { will.x = clampX(cx + weakDir * 5 * YARD_PX); will.y = losY - YARD_PX * 4.5; }
      } else if (will) will.y = losY - YARD_PX * 4.5;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3-4 BEAR
  // 3 DL + 4 LBs. OLBs are hybrid edge players.
  // Strong side: ROLB reads TE (like SAM in 4-3).
  // Weak side: LOLB holds edge, no deep slot read.
  // ILBs: RILB shades strong, LILB shades weak.
  // ══════════════════════════════════════════════════════════════════════
  if (key === '3-4') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;
    const is2x2         = strongCount === 2 && weakCount === 2;

    const olData    = olinePlayers();
    const oltX      = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX      = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const strongOTX = strong === 'R' ? ortX : oltX;
    const weakOTX   = strong === 'R' ? oltX : ortX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerStrong = sortInner(strongElig, strongOTX)[0] || null;
    const zoneStrong  = (innerStrong?._attachmentZone === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    // Strong OLB = the one on the strong side
    const rolb = strong === 'R'
      ? tmpDef.filter(d => d.role === 'ROLB').sort((a,b) => b.x - a.x)[0]
      : tmpDef.filter(d => d.role === 'LOLB').sort((a,b) => a.x - b.x)[0];
    const lolb = strong === 'R'
      ? tmpDef.filter(d => d.role === 'LOLB').sort((a,b) => a.x - b.x)[0]
      : tmpDef.filter(d => d.role === 'ROLB').sort((a,b) => b.x - a.x)[0];
    // ILBs: strong = closer to strong side
    const ilbs = [...tmpDef.filter(d => d.role === 'RILB'), ...tmpDef.filter(d => d.role === 'LILB')]
      .sort((a, b) => strong === 'R' ? b.x - a.x : a.x - b.x);
    const rilb = ilbs[0] || null;  // strong-side ILB
    const lilb = ilbs[1] || null;  // weak-side ILB
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // ILBs default: shade toward their side, read RB
    if (rilb) {
      const rbShade = rb && getSnapPos(rb).x > cx ? 0.5 : 0;
      rilb.x = clampX(cx + dir * (1.5 + rbShade) * YARD_PX);
      rilb.y = losY - YARD_PX * 4;
    }
    if (lilb) {
      lilb.x = clampX(cx + weakDir * 1.5 * YARD_PX);
      lilb.y = losY - YARD_PX * 4;
    }

    if (isEmpty) {
      // All 4 LBs drop — 4-man DL rush
      if (rolb) rolb.y = losY - YARD_PX * 5;
      if (lolb) lolb.y = losY - YARD_PX * 5;
      if (rilb) rilb.y = losY - YARD_PX * 5;
      if (lilb) lilb.y = losY - YARD_PX * 5;
      if (ss)   ss.y   = losY - YARD_PX * 10;

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      const rec3 = recOn(strong, 3);
      // Strong OLB takes #3
      if (rolb && rec3) { rolb.x = clampX(getSnapPos(rec3).x); rolb.y = losY - YARD_PX * 3; }
      else if (rolb && zoneStrong === 'ATTACHED') { rolb.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX); rolb.y = losY - YARD_PX * 2; }
      // SS bumps down to #2
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      // FS rotates toward trips
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      // RILB shifts strong
      if (rilb) { rilb.x = clampX(cx + dir * 2.5 * YARD_PX); rilb.y = losY - YARD_PX * 4; }
      // Weak OLB holds edge, LILB covers RB flat
      if (lolb) lolb.y = losY - YARD_PX * 4;
      if (lilb) { lilb.x = clampX(cx + weakDir * 3 * YARD_PX); lilb.y = losY - YARD_PX * 4.5; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      // Weak OLB takes #3 weak
      if (lolb && weakRec3) { lolb.x = clampX(getSnapPos(weakRec3).x); lolb.y = losY - YARD_PX * 4; }
      // SS rotates weak to cover #2
      if (ss && weakRec2) { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }
      // LILB helps weak side
      if (lilb) { lilb.x = clampX(cx + weakDir * 2.5 * YARD_PX); lilb.y = losY - YARD_PX * 4; }
      // Strong OLB still reads TE
      if (rolb && zoneStrong === 'ATTACHED') { rolb.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX); rolb.y = losY - YARD_PX * 2; }
      else if (rolb) rolb.y = losY - YARD_PX * 4;

    } else if (is2x2) {
      if (ss) ss.y = losY - YARD_PX * 10;
      if (fs) fs.y = losY - YARD_PX * 12;
      // Both OLBs react to attachment zones
      if (rolb && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { rolb.x = clampX(ox + dir * 0.5 * YARD_PX); rolb.y = losY - YARD_PX * 2; }
        else if (zoneStrong === 'DETACHED') { rolb.x = clampX(ox); rolb.y = losY - YARD_PX * 5; }
        else { rolb.x = clampX(cx + dir * 6 * YARD_PX); rolb.y = losY - YARD_PX * 4; }
      }
      if (lolb) { lolb.x = clampX(cx + weakDir * 5.5 * YARD_PX); lolb.y = losY - YARD_PX * 4; }

    } else {
      // DEFAULT — strong OLB reads TE zone, weak OLB holds edge
      if (rolb && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { rolb.x = clampX(ox + dir * 0.5 * YARD_PX); rolb.y = losY - YARD_PX * 2; }
        else if (zoneStrong === 'DETACHED') { rolb.x = clampX(ox); rolb.y = losY - YARD_PX * 5; }
        else { rolb.x = clampX(cx + dir * 6 * YARD_PX); rolb.y = losY - YARD_PX * 4; }
      }
      // Weak OLB stays on edge — no slot read
      if (lolb) { lolb.x = clampX(cx + weakDir * 5.5 * YARD_PX); lolb.y = losY - YARD_PX * 4; }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3-3-5 NICKEL
  // Same trigger priority as 4-3 Over, but LBs 0.5 yds deeper by default
  // because 3 DL leaves more box gaps — LBs need more gap integrity depth.
  // ══════════════════════════════════════════════════════════════════════
  if (key === '3-3-5') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;
    const is2x2         = strongCount === 2 && weakCount === 2;

    const olData    = olinePlayers();
    const oltX      = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX      = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const strongOTX = strong === 'R' ? ortX : oltX;
    const weakOTX   = strong === 'R' ? oltX : ortX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerStrong = sortInner(strongElig, strongOTX)[0] || null;
    const innerWeak   = sortInner(weakElig,   weakOTX)[0]   || null;
    const zoneStrong  = (innerStrong?._attachmentZone === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');
    const zoneWeak    = (innerWeak?._attachmentZone   === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    const sam  = tmpDef.find(d => d.role === 'SAM');
    const mike = tmpDef.find(d => d.role === 'MIKE');
    const will = tmpDef.find(d => d.role === 'WILL');
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // MIKE — slightly deeper than 4-3 Over (4.5 yds) for gap integrity
    if (mike) {
      const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : 0;
      if (rb) mike.x = clampX(cx + rbSide * 0.5 * YARD_PX);
      mike.y = losY - YARD_PX * 4.5;
    }

    if (isEmpty) {
      if (sam)  sam.y  = losY - YARD_PX * 5.5;
      if (will) will.y = losY - YARD_PX * 5.5;
      if (ss)   ss.y   = losY - YARD_PX * 10;

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      const rec3 = recOn(strong, 3);
      if (mike) { mike.x = clampX(cx + dir * 2 * YARD_PX); mike.y = losY - YARD_PX * 4.5; }
      if (sam && rec3) { sam.x = clampX(getSnapPos(rec3).x); sam.y = losY - YARD_PX * 3.5; }
      else if (sam) sam.y = losY - YARD_PX * 4.5;
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      if (will) { will.x = clampX(cx + weakDir * 3.5 * YARD_PX); will.y = losY - YARD_PX * 5; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      if (ss && weakRec2) { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }
      if (will && weakRec3) { will.x = clampX(getSnapPos(weakRec3).x); will.y = losY - YARD_PX * 4.5; }
      else if (will) will.y = losY - YARD_PX * 5;
      if (sam && innerStrong) {
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2.5; }
        else sam.y = losY - YARD_PX * 4.5;
      }

    } else if (is2x2) {
      if (ss) ss.y = losY - YARD_PX * 10;
      if (fs) fs.y = losY - YARD_PX * 12;
      if (sam && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(ox + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2.5; }
        else if (zoneStrong === 'DETACHED') { sam.x = clampX(ox); sam.y = losY - YARD_PX * 5.5; }
        else { sam.x = clampX(cx + dir * 6 * YARD_PX); sam.y = losY - YARD_PX * 4.5; }
      }
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3.5; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5.5; }
        else { will.x = clampX(cx + weakDir * 6 * YARD_PX); will.y = losY - YARD_PX * 5; }
      } else if (will) will.y = losY - YARD_PX * 5;

    } else {
      if (sam && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(ox + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2.5; }
        else if (zoneStrong === 'DETACHED') { sam.x = clampX(ox); sam.y = losY - YARD_PX * 5.5; }
        else { sam.x = clampX(cx + dir * 6 * YARD_PX); sam.y = losY - YARD_PX * 4.5; }
      }
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3.5; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5.5; }
        else { will.x = clampX(cx + weakDir * 6 * YARD_PX); will.y = losY - YARD_PX * 5; }
      } else if (will) will.y = losY - YARD_PX * 5;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════
  // DOUBLE MUG
  // 3-4 pressure look — both ILBs walked up, OLBs outside.
  // Strong OLB (ROLB) still reads TE like in 3-4 Bear.
  // ILBs default walked up — drop deeper only on Empty.
  // ══════════════════════════════════════════════════════════════════════
  if (key === 'double-mug') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;

    const olData    = olinePlayers();
    const oltX      = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX      = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const strongOTX = strong === 'R' ? ortX : oltX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerStrong = sortInner(strongElig, strongOTX)[0] || null;
    const zoneStrong  = (innerStrong?._attachmentZone === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    // Strong OLB = ROLB if strong is R, LOLB if strong is L
    const rolb = strong === 'R'
      ? tmpDef.filter(d => d.role === 'ROLB').sort((a,b) => b.x - a.x)[0]
      : tmpDef.filter(d => d.role === 'LOLB').sort((a,b) => a.x - b.x)[0];
    const lolb = strong === 'R'
      ? tmpDef.filter(d => d.role === 'LOLB').sort((a,b) => a.x - b.x)[0]
      : tmpDef.filter(d => d.role === 'ROLB').sort((a,b) => b.x - a.x)[0];
    const ilbs = [...tmpDef.filter(d => d.role === 'RILB'), ...tmpDef.filter(d => d.role === 'LILB')]
      .sort((a, b) => strong === 'R' ? b.x - a.x : a.x - b.x);
    const rilb = ilbs[0] || null;  // strong-side ILB
    const lilb = ilbs[1] || null;  // weak-side ILB
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    if (isEmpty) {
      // ILBs can't stay walked up with no RB — drop to LB depth
      if (rilb) { rilb.y = losY - YARD_PX * 5; }
      if (lilb) { lilb.y = losY - YARD_PX * 5; }
      if (rolb) { rolb.y = losY - YARD_PX * 5; }
      if (lolb) { lolb.y = losY - YARD_PX * 5; }
      if (ss)   { ss.y   = losY - YARD_PX * 9; }

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      const rec3 = recOn(strong, 3);
      if (rolb && rec3) { rolb.x = clampX(getSnapPos(rec3).x); rolb.y = losY - YARD_PX * 3; }
      else if (rolb && zoneStrong === 'ATTACHED' && innerStrong) {
        rolb.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX);
        rolb.y = losY - YARD_PX * 2;
      }
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      // RILB shifts strong inside
      if (rilb) { rilb.x = clampX(cx + dir * 2 * YARD_PX); }
      // LILB covers RB/weak flat
      if (lilb) { lilb.x = clampX(cx + weakDir * 2.5 * YARD_PX); lilb.y = losY - YARD_PX * 4; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      if (lolb && weakRec3) { lolb.x = clampX(getSnapPos(weakRec3).x); lolb.y = losY - YARD_PX * 4; }
      if (ss && weakRec2)   { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }
      if (lilb) { lilb.x = clampX(cx + weakDir * 2.5 * YARD_PX); }
      if (rolb && zoneStrong === 'ATTACHED' && innerStrong) {
        rolb.x = clampX(getSnapPos(innerStrong).x + dir * 0.5 * YARD_PX);
        rolb.y = losY - YARD_PX * 2;
      } else if (rolb) rolb.y = losY - YARD_PX * 3;

    } else {
      // DEFAULT — Strong OLB reads TE, ILBs stay walked up
      if (rolb && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { rolb.x = clampX(ox + dir * 0.5 * YARD_PX); rolb.y = losY - YARD_PX * 2; }
        else if (zoneStrong === 'DETACHED') { rolb.x = clampX(ox); rolb.y = losY - YARD_PX * 4; }
        else { rolb.x = clampX(cx + dir * 5.5 * YARD_PX); rolb.y = losY - YARD_PX * 3; }
      }
      // ILBs shade slightly toward RB side but stay walked up depth
      if (rb && rilb) rilb.x = clampX(cx + dir * (1.5 + (getSnapPos(rb).x > cx ? 0.5 : 0)) * YARD_PX);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // DIME 2-3-6
  // 2 DE, WILL + MIKE + SAM, 2 CB + 2 NICKEL, SS, FS.
  // Pure pass defense — minimal run triggers, Nickels handle slots.
  // LB logic mirrors 4-3 Over but 0.5 yds deeper (only 2 DL).
  // ══════════════════════════════════════════════════════════════════════
  if (key === 'dime-236') {
    const snap    = offenseStructureSnapshot;
    const strong  = snap?.strongSide || 'R';
    const weak    = strong === 'R' ? 'L' : 'R';
    const dir     = strong === 'R' ? 1 : -1;
    const weakDir = strong === 'R' ? -1 : 1;

    const leftElig   = (snap?.leftEligible  || []);
    const rightElig  = (snap?.rightEligible || []);
    const strongElig = strong === 'R' ? rightElig : leftElig;
    const weakElig   = strong === 'R' ? leftElig  : rightElig;
    const isEmpty    = snap?.isEmpty || false;
    const rb         = snap?.primaryBackfield || null;

    const strongCount   = strongElig.length;
    const weakCount     = weakElig.length;
    const isTripsStrong = strongCount >= 3;
    const isTripsWeak   = weakCount   >= 3;
    const is2x2         = strongCount === 2 && weakCount === 2;

    const olData    = olinePlayers();
    const oltX      = olData.find(o => o.id === 'olt')?.x ?? (cx - OLINE_SPACING * 2);
    const ortX      = olData.find(o => o.id === 'ort')?.x ?? (cx + OLINE_SPACING * 2);
    const strongOTX = strong === 'R' ? ortX : oltX;
    const weakOTX   = strong === 'R' ? oltX : ortX;

    const sortInner = (arr, otX) => arr.slice().sort((a, b) =>
      Math.abs(getSnapPos(a).x - otX) - Math.abs(getSnapPos(b).x - otX));
    const innerStrong = sortInner(strongElig, strongOTX)[0] || null;
    const innerWeak   = sortInner(weakElig,   weakOTX)[0]   || null;
    const zoneStrong  = (innerStrong?._attachmentZone === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');
    const zoneWeak    = (innerWeak?._attachmentZone   === 'ATTACHED' ? 'ATTACHED' : 'DETACHED');

    const clampX = x => Math.max(FIELD_LEFT+14, Math.min(FIELD_RIGHT-14, x));
    const recOn  = (side, n) =>
      (side === 'L' ? leftElig : rightElig).find(p => p._receiverNumber === n) || null;

    const sam  = tmpDef.find(d => d.role === 'SAM');
    const mike = tmpDef.find(d => d.role === 'MIKE');
    const will = tmpDef.find(d => d.role === 'WILL');
    const ss   = tmpDef.find(d => d.role === 'SS');
    const fs   = tmpDef.find(d => d.role === 'FS');

    // MIKE — deeper than 4-3 (4.5 yds), only 2 DL in front
    if (mike) {
      const rbSide = rb ? (getSnapPos(rb).x >= cx ? 1 : -1) : 0;
      if (rb) mike.x = clampX(cx + rbSide * 0.5 * YARD_PX);
      mike.y = losY - YARD_PX * 4.5;
    }

    if (isEmpty) {
      if (sam)  { sam.y  = losY - YARD_PX * 6; }
      if (mike) { mike.y = losY - YARD_PX * 6; }
      if (will) { will.y = losY - YARD_PX * 6; }
      if (ss)   { ss.y   = losY - YARD_PX * 10; }

    } else if (isTripsStrong) {
      const rec2 = recOn(strong, 2);
      const rec3 = recOn(strong, 3);
      if (mike) { mike.x = clampX(cx + dir * 2 * YARD_PX); mike.y = losY - YARD_PX * 4.5; }
      // SAM on #3, Nickel already on #2 via CB/Nickel logic
      if (sam && rec3) { sam.x = clampX(getSnapPos(rec3).x); sam.y = losY - YARD_PX * 4; }
      else if (sam) { sam.x = clampX(cx + dir * 6 * YARD_PX); sam.y = losY - YARD_PX * 4.5; }
      if (ss && rec2) { ss.x = clampX(getSnapPos(rec2).x); ss.y = losY - YARD_PX * 6; }
      if (fs) fs.x = clampX(cx + dir * 3 * YARD_PX);
      if (will) { will.x = clampX(cx + weakDir * 3.5 * YARD_PX); will.y = losY - YARD_PX * 5; }

    } else if (isTripsWeak) {
      const weakRec2 = recOn(weak, 2);
      const weakRec3 = recOn(weak, 3);
      if (mike) { mike.x = clampX(cx + weakDir * 1.5 * YARD_PX); mike.y = losY - YARD_PX * 4.5; }
      if (will && weakRec3) { will.x = clampX(getSnapPos(weakRec3).x); will.y = losY - YARD_PX * 4.5; }
      else if (will) { will.x = clampX(cx + weakDir * 5 * YARD_PX); will.y = losY - YARD_PX * 5; }
      if (ss && weakRec2) { ss.x = clampX(getSnapPos(weakRec2).x); ss.y = losY - YARD_PX * 6; }
      if (sam) { sam.x = clampX(cx + dir * 6 * YARD_PX); sam.y = losY - YARD_PX * 4.5; }

    } else {
      // DEFAULT — SAM reads strong #2, WILL reads weak #2, Nickels have slots
      if (sam && innerStrong) {
        const ox = getSnapPos(innerStrong).x;
        if (zoneStrong === 'ATTACHED') { sam.x = clampX(ox + dir * 0.5 * YARD_PX); sam.y = losY - YARD_PX * 2.5; }
        else if (zoneStrong === 'DETACHED') { sam.x = clampX(ox); sam.y = losY - YARD_PX * 5.5; }
        else { sam.x = clampX(cx + dir * 6 * YARD_PX); sam.y = losY - YARD_PX * 4.5; }
      }
      if (will && innerWeak) {
        const ox = getSnapPos(innerWeak).x;
        if (zoneWeak === 'ATTACHED') { will.x = clampX(ox + weakDir * 0.5 * YARD_PX); will.y = losY - YARD_PX * 3.5; }
        else if (zoneWeak === 'DETACHED') { will.x = clampX(ox); will.y = losY - YARD_PX * 5.5; }
        else { will.x = clampX(cx + weakDir * 5 * YARD_PX); will.y = losY - YARD_PX * 5; }
      } else if (will) will.y = losY - YARD_PX * 5;
    }
  }

  return tmpDef;
}


// ── Shade offset for reactive formation ──────────────────────────────
// Returns the X offset in px that should be applied to a CB/Nickel's
// reactive target based on their cbShade setting and field side.
function computeShadeOffset(d) {
  const DB_ROLES = new Set(['CB', 'NICKEL']);
  if (!DB_ROLES.has(d.role)) return 0;
  const shade = d.cbShade || 'normal';
  if (shade === 'normal') return 0;
  const shadePx = (CB_SHADE_YD[shade] || 0) * YARD_PX; // +1yd inside, -1yd outside
  const ballX   = ball.x;
  const curX    = d.simX ?? d.x;
  const side    = curX < ballX ? 'L' : 'R';
  const shadeDir = side === 'L' ? 1 : -1; // inside = toward ball
  return shadeDir * shadePx;
}

// Every tick: reads current simX of offense, computes where defense should be, slides toward it.
function reactiveFormationSimStep(dt) {
  if (!reactiveFormationActive) return;
  if (defensePlayers.length === 0) return;

  // ── Rebuild snapshot from current sim positions so triggers read live data ──
  rebuildOffenseStructureSnapshot();

  // ── SAM/WILL swap: when strong side changes, swap roles instead of crossing ──
  const currentStrong = offenseStructureSnapshot?.strongSide || 'R';
  if (currentStrong !== _simInitialStrongSide) {
    const samDef  = defensePlayers.find(d => d.role === 'SAM');
    const willDef = defensePlayers.find(d => d.role === 'WILL');
    if (samDef && willDef) {
      samDef.role  = 'WILL';
      willDef.role = 'SAM';
      logDebug(`<span>SWAP</span> SAM↔WILL — strong side flipped to ${currentStrong}`);
    }
    // FS/SS swap: SS stays on strong side, FS stays on weak side
    const ssDef  = defensePlayers.find(d => d.role === 'SS');
    const fsDef  = defensePlayers.find(d => d.role === 'FS');
    if (ssDef && fsDef) {
      ssDef.role = 'FS';
      fsDef.role = 'SS';
      logDebug(`<span>SWAP</span> SS↔FS — strong side flipped to ${currentStrong}`);
    }
    _simInitialStrongSide = currentStrong;
  }

  // Current offense positions (simX = where they are RIGHT NOW)
  const offNow = players.map(p => ({ x: p.simX ?? p.x, isOline: !!p.isOline }));
  const tmpDef = buildReactiveTargets(offNow);
  if (!tmpDef.length) return;

  const BASE_SPEED = simSpeed * 80;  // match play phase base speed

  // Per-role preplay speed multipliers — mirrors stepDefensePlayers ZONE_SPEED
  // so pre-snap alignment shifts feel the same pace as in-play movement.
  const PREPLAY_ROLE_SPEED = { CB: 0.95, NICKEL: 0.90, FS: 0.90, SS: 0.90, LB: 0.85, DE: 0.85, DT: 0.80, NT: 0.80 };
  function defSpeed(d) {
    const mult = PREPLAY_ROLE_SPEED[d.role] ?? 0.90;
    return BASE_SPEED * mult * (d.speedMultiplier || 1);
  }

  // CB, NICKEL, LB, SS and FS all react pre-snap to triggers
  const REACTIVE_ROLES = new Set(['CB', 'NICKEL', 'SS', 'FS', ...LB_ROLES]);

  const usedIdx = new Set();
  defensePlayers.forEach(d => {
    if (!REACTIVE_ROLES.has(d.role)) return; // DE, DT don't move pre-snap
    let bestIdx = -1, bestDist = Infinity;
    tmpDef.forEach((t,i) => {
      if (usedIdx.has(i) || t.role !== d.role) return;
      const dist = Math.abs(t.x - (d.simX ?? d.x));
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    if (bestIdx < 0) return;
    usedIdx.add(bestIdx);
    const tgtX = tmpDef[bestIdx].x + computeShadeOffset(d);
    const curX = d.simX ?? d.x;
    const deltaX = tgtX - curX;
    const spd = defSpeed(d);
    if (Math.abs(deltaX) >= 0.5)
      d.simX = curX + Math.sign(deltaX) * Math.min(Math.abs(deltaX), spd * dt);

    // Y (depth) — slide toward target if set, else hold at d.y
    const tgtY = tmpDef[bestIdx].y;
    if (tgtY !== null) {
      const curY  = d.simY ?? d.y;
      const deltaY = tgtY - curY;
      if (Math.abs(deltaY) >= 0.5)
        d.simY = curY + Math.sign(deltaY) * Math.min(Math.abs(deltaY), spd * dt);
    } else {
      d.simY = d.y;
    }
  });
}


function refreshRunFitsSummary() {
  const box = document.getElementById('runFitsSummary');
  if (!box) return;
  if (!showRunFitsActive) { box.style.display = 'none'; return; }

  if (defensePlayers.length === 0) {
    box.innerHTML = '<span style="color:rgba(74,222,128,0.4);font-style:italic">No defenders on field</span>';
    box.style.display = 'block';
    return;
  }

  const lines = [];
  defensePlayers.forEach(d => {
    const asg = d.assignment;
    const roleLabel = d.role + d.id;
    let asgLabel = '';
    let color = '#4ade80';

    if (!asg || asg.type === 'none') {
      asgLabel = '\u2014'; color = 'rgba(74,222,128,0.3)';
    } else if (asg.type === 'gap' && asg.gapId) {
      const isNT = asg.gapId === 'A_gap_L' && d._ntBothAGaps;
      if (isNT) {
        asgLabel = 'A-L+R';
      } else {
        const parts = asg.gapId.split('_gap_');
        asgLabel = parts.length === 2 ? parts[0] + '-' + parts[1] : asg.gapId.toUpperCase();
        if (asg.fillType && asg.fillType !== 'fill') asgLabel += ' (' + asg.fillType + ')';
      }
    } else if (asg.type === 'contain') {
      asgLabel = 'CONTAIN';
    } else if (asg.type === 'spill') {
      asgLabel = 'SPILL';
    } else if (asg.type === 'rush') {
      asgLabel = 'RUSH';
    } else if (asg.type === 'pursuit') {
      asgLabel = 'PURSUIT'; color = '#f97316';
    } else if (asg.type === 'man') {
      const tgt = players.find(p => p.id === asg.targetId);
      asgLabel = 'MAN \u2192 ' + (tgt ? tgt.label : '#?');
      color = '#60a5fa';
    } else if (asg.type === 'zone') {
      asgLabel = 'ZONE ' + (asg.landmarkId || '').replace(/_/g, ' ');
      color = '#f59e0b';
    }

    lines.push('<span style="color:var(--text-dim)">' + roleLabel + ':</span> <span style="color:' + color + '">' + asgLabel + '</span>');
  });

  box.innerHTML = lines.join('<br>');
  box.style.display = 'block';
}

// Draw run-fit assignment overlay: gap/contain/spill tags + arrow to gap point per defender.
function drawRunFitsOverlay() {
  if (!showRunFitsActive) return;
  if (defensePlayers.length === 0) return;

  const losY = LOS_Y();
  ctx.save();

  defensePlayers.forEach(d => {
    const asg = d.assignment;
    if (!asg || !['gap','contain','spill','rush','pursuit'].includes(asg.type)) return;

    const px = mode === 'sim' ? (d.simX ?? d.x) : d.x;
    const py = mode === 'sim' ? (d.simY ?? d.y) : d.y;

    let label = '';
    let color = '#4ade80';
    let targetX = null, targetY = null;

    if (asg.type === 'gap' && asg.gapId) {
      // NT with both A-gaps → "A-L+R"
      if (asg.gapId === 'A_gap_L' && d._ntBothAGaps) {
        label = 'A-L+R';
      } else {
        const parts = asg.gapId.split('_gap_');
        label = parts.length === 2 ? `${parts[0]}-${parts[1]}` : asg.gapId.toUpperCase();
      }
      color = '#4ade80';
      const offsetPx = GAP_OFFSETS_PX[asg.gapId] ?? 0;
      targetX = ball.x + offsetPx;
      targetY = losY;
    } else if (asg.type === 'contain') {
      label = 'CONT';
      color = '#facc15';
      const side = px <= ball.x ? -1 : 1;
      targetX = ball.x + side * (YARD_PX * 15);
      targetY = losY;
    } else if (asg.type === 'spill') {
      label = 'SPILL';
      color = '#f97316';
      const side = px <= ball.x ? -1 : 1;
      targetX = ball.x + side * OLINE_SPACING * 2;
      targetY = losY;
    } else if (asg.type === 'rush') {
      label = 'RUSH';
      color = '#f87171';
    } else if (asg.type === 'pursuit') {
      label = 'PURSUIT';
      color = '#f97316';
    }

    if (!label) return;

    // Draw dashed arrow line from defender to target gap point
    if (targetX !== null) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(targetX, targetY);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = color + 'aa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Small circle at gap target
      ctx.beginPath();
      ctx.arc(targetX, targetY, 4, 0, Math.PI * 2);
      ctx.fillStyle = color + '99';
      ctx.fill();

      // NT: second arrow to A_gap_R
      if (d._ntBothAGaps) {
        const targetX2 = ball.x + (GAP_OFFSETS_PX['A_gap_R'] ?? 0);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(targetX2, targetY);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(targetX2, targetY, 4, 0, Math.PI * 2);
        ctx.fillStyle = color + '99';
        ctx.fill();
      }
    }

    // Label badge next to the defender (top-right of circle)
    const lx = px + 15;
    const ly = py - 15;
    ctx.font = 'bold 10px Barlow Condensed';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = color;
    ctx.fillText(label, lx, ly);
  });

  ctx.restore();
}

// Draw semi-transparent zone areas for every defender with a zone assignment / decision.
function drawZoneAreas() {
  if (!showZonesActive) return;
  const losY  = LOS_Y();
  const ballX = ball.x;

  // Zone shape definitions — rectangles centered on landmark point.
  const ZONE_SHAPES = {
    FLAT_L:      (lp) => rect(lp.x, lp.y, 10.925*YARD_PX, 12*YARD_PX),
    FLAT_R:      (lp) => rect(lp.x, lp.y, 10.925*YARD_PX, 12*YARD_PX),
    CURL_L:      (lp) => rect(lp.x, lp.y, 8.925*YARD_PX, 8*YARD_PX),
    CURL_R:      (lp) => rect(lp.x, lp.y, 8.925*YARD_PX, 8*YARD_PX),
    CURL_FLAT_L: (lp) => rect(lp.x, lp.y, 8.925*YARD_PX, 8*YARD_PX),
    CURL_FLAT_R: (lp) => rect(lp.x, lp.y, 8.925*YARD_PX, 8*YARD_PX),
    HOOK_L:      (lp) => rect(lp.x, lp.y, 7.65*YARD_PX,  8*YARD_PX),
    HOOK_MIDDLE: (lp) => rect(lp.x, lp.y, 13.33*YARD_PX, 8*YARD_PX),
    HOOK_R:      (lp) => rect(lp.x, lp.y, 7.65*YARD_PX,  8*YARD_PX),
    HOOK_CURL_L: (lp) => rect(lp.x, lp.y, 7.65*YARD_PX,  8*YARD_PX),
    HOOK_CURL_R: (lp) => rect(lp.x, lp.y, 7.65*YARD_PX,  8*YARD_PX),
    DEEP_L:      (lp) => deepRect(lp.x, 8.925*YARD_PX),
    DEEP_MIDDLE: (lp) => deepRect(lp.x, 8.65*YARD_PX),
    DEEP_R:      (lp) => deepRect(lp.x, 8.925*YARD_PX),
    DEEP_THIRD_L:(lp) => deepRect(lp.x, 9*YARD_PX),
    DEEP_THIRD_R:(lp) => deepRect(lp.x, 9*YARD_PX),
    DEEP_FREE:   (lp) => deepRect(lp.x, 26.5*YARD_PX),
    DEEP_HALF_L: (lp) => deepRect(lp.x, 13.25*YARD_PX),
    DEEP_HALF_R: (lp) => deepRect(lp.x, 13.25*YARD_PX),
    TAMPA_MIDDLE:(lp) => rect(lp.x, lp.y, 14*YARD_PX,     8*YARD_PX),
    DEEP_QRTR_L: (lp) => deepRect(lp.x, 6.625*YARD_PX),
    DEEP_QRTR_ML:(lp) => deepRect(lp.x, 6.625*YARD_PX),
    DEEP_QRTR_MR:(lp) => deepRect(lp.x, 6.625*YARD_PX),
    DEEP_QRTR_R: (lp) => deepRect(lp.x, 6.625*YARD_PX),
  };
  function rect(cx, cy, w, h) {
    ctx.beginPath();
    ctx.rect(cx - w/2, cy - h/2, w, h);
  }
  // Deep zones stretch from 10 yards upfield LOS to ENDZONE_Y
  function deepRect(cx, hw) {
    const yTop = ENDZONE_Y;
    const yBot = losY - 10 * YARD_PX;
    ctx.beginPath();
    ctx.rect(cx - hw, yTop, hw * 2, yBot - yTop);
  }

  // Zone colors by depth layer
  // Flat  = short outside  → green
  // Curl/Hook/Tampa = underneath → amber
  // Deep  = deep           → blue
  const ZONE_COLORS = {
    flat:  { fill: 'rgba(74,222,128,0.12)',  stroke: 'rgba(74,222,128,0.55)',  label: 'rgba(74,222,128,0.8)'  },
    hook:  { fill: 'rgba(251,191,36,0.12)',  stroke: 'rgba(251,191,36,0.55)',  label: 'rgba(251,191,36,0.8)'  },
    deep:  { fill: 'rgba(96,165,250,0.12)',  stroke: 'rgba(96,165,250,0.55)',  label: 'rgba(96,165,250,0.8)'  },
  };

  function zoneLayer(lmId) {
    if (lmId.startsWith('FLAT'))                         return 'flat';
    if (lmId.startsWith('DEEP') || lmId.startsWith('TAMPA')) return 'deep';
    return 'hook'; // CURL_*, HOOK_*
  }

  // Collect active zone decisions per defender
  const zoneEntries = [];
  defensePlayers.forEach(d => {
    let lmId = null;
    if (activePreset !== 'manual' && d.decision && d.decision.mode === 'drop') {
      lmId = d.decision.focusLandmarkId;
    } else if (d.assignment.type === 'zone') {
      lmId = d.assignment.landmarkId;
    }
    if (!lmId) return;
    const lp = getLandmarkPos(lmId);
    zoneEntries.push({ d, lmId, lp });
  });

  // Deduplicate by landmark (if two defenders share a zone, draw once)
  const drawnLandmarks = new Set();
  zoneEntries.forEach(({ d, lmId, lp }) => {
    const shapeFn = ZONE_SHAPES[lmId];
    if (!shapeFn) return;

    if (!drawnLandmarks.has(lmId)) {
      drawnLandmarks.add(lmId);
      const col = ZONE_COLORS[zoneLayer(lmId)];
      // Fill
      ctx.save();
      shapeFn(lp);
      ctx.fillStyle = col.fill;
      ctx.fill();
      // Border
      shapeFn(lp);
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      const label = lmId.replace(/_/g, ' ');
      ctx.font      = `bold 10px Barlow Condensed`;
      ctx.fillStyle = col.label;
      ctx.textAlign = 'center';
      ctx.fillText(label, lp.x, lp.y + 4);
      ctx.restore();
    }
  });
}

// ── Hit testing ──────────────────────────────────────────────────────
// Returns the defender under (mx,my), or null.
function hitTestDefender(mx, my) {
  for (let i = defensePlayers.length - 1; i >= 0; i--) {
    const d  = defensePlayers[i];
    const px = mode === 'sim' ? (d.simX ?? d.x) : d.x;
    const py = mode === 'sim' ? (d.simY ?? d.y) : d.y;
    if (Math.hypot(mx - px, my - py) < DEF_PLAYER_RADIUS + 3) return d;
  }
  return null;
}

// ── Render ───────────────────────────────────────────────────────────
function drawDefenders() {
  if (defensePlayers.length === 0) return;
  const losY  = LOS_Y();
  const ballX = ball.x;

  ctx.save();

  defensePlayers.forEach(d => {
    const px  = mode === 'sim' ? (d.simX ?? d.x) : d.x;
    const py  = mode === 'sim' ? (d.simY ?? d.y) : d.y;
    const sel = d.id === selectedDefId;
    const col = sel ? DEF_COLOR_SEL : DEF_COLOR;

    // ── Assignment / Decision line ───────────────────────────────────
    // When preset is active: draw lines from current decision (not assignment)
    // so editor shows live Cover1 matches immediately.
    const drawFromDecision = showJobsActive && activePreset !== 'manual' && d.decision;
    if (drawFromDecision) {
      const dec = d.decision;
      if (dec.mode === 'rush') {
        if (showZonesActive) {
          // Draw red arrow line toward QB / ball
          const qb = players.find(p => p.type === 'QB');
          const tx = qb ? (mode === 'sim' ? (qb.simX ?? qb.x) : qb.x) : ball.x;
          const ty = qb ? (mode === 'sim' ? (qb.simY ?? qb.y) : qb.y) : ball.y;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty);
          ctx.strokeStyle = 'rgba(248,113,113,0.7)';  // red for rush
          ctx.lineWidth   = 2;
          ctx.setLineDash([3, 3]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (dec.mode === 'follow') {
        const tgt = players.find(p => p.id === dec.focusTargetId);
        if (tgt) {
          const tx = mode === 'sim' ? (tgt.simX ?? tgt.x) : tgt.x;
          const ty = mode === 'sim' ? (tgt.simY ?? tgt.y) : tgt.y;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty);
          ctx.strokeStyle = '#67e8f9';  // cyan for preset man
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (dec.mode === 'drop') {
        const lp = getLandmarkPos(dec.focusLandmarkId);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(lp.x, lp.y);
        ctx.strokeStyle = '#fde68a';  // amber for preset zone
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(lp.x, lp.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253,230,138,0.5)'; ctx.fill();
      } else if (dec.mode === 'ott') {
        const tgt = players.find(p => p.id === dec.focusTargetId);
        if (tgt) {
          const tx = mode === 'sim' ? (tgt.simX ?? tgt.x) : tgt.x;
          const ty = mode === 'sim' ? (tgt.simY ?? tgt.y) : tgt.y;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty);
          ctx.strokeStyle = '#a78bfa'; // purple for OTT
          ctx.lineWidth   = 1.5;
          ctx.setLineDash([3, 4]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    } else if (d.assignment.type === 'man') {
      const tgt = players.find(p => p.id === d.assignment.targetId);
      if (tgt) {
        const tx = mode === 'sim' ? (tgt.simX ?? tgt.x) : tgt.x;
        const ty = mode === 'sim' ? (tgt.simY ?? tgt.y) : tgt.y;
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(tx, ty);
        ctx.strokeStyle = DEF_MAN_LINE;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (d.assignment.type === 'zone') {
      const lp = getLandmarkPos(d.assignment.landmarkId);
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(lp.x, lp.y);
      ctx.strokeStyle = DEF_ZONE_LINE;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Landmark marker
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = DEF_LANDMARK_COLOR;
      ctx.fill();
    }

    // ── Player shape: filled triangle, tip pointing DOWN (toward offense) ──
    ctx.save();
    if (sel) { ctx.shadowColor = DEF_COLOR_SEL; ctx.shadowBlur = 16; }

    const R = DEF_PLAYER_RADIUS;
    // Tip at bottom (+y = toward offense), flat base at top
    const tipX  = px;
    const tipY  = py + R;                           // tip points DOWN
    const baseL = { x: px - R * 0.92, y: py - R * 0.62 };  // base top-left
    const baseR = { x: px + R * 0.92, y: py - R * 0.62 };  // base top-right

    // Fill
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.lineTo(baseL.x, baseL.y);
    ctx.closePath();
    ctx.fillStyle = sel ? 'rgba(0,229,255,0.22)' : 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Stroke
    ctx.strokeStyle = col;
    ctx.lineWidth   = sel ? 3 : 2;
    ctx.stroke();

    // Inner triangle (tinted fill) — slightly inset, same orientation
    ctx.beginPath();
    ctx.moveTo(px,             py + R * 0.55);  // inner tip (down)
    ctx.lineTo(px + R * 0.52,  py - R * 0.36);  // inner base right
    ctx.lineTo(px - R * 0.52,  py - R * 0.36);  // inner base left
    ctx.closePath();
    ctx.fillStyle   = col;
    ctx.globalAlpha = 0.30;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    // Role label — center of mass is in upper two-thirds of downward triangle
    const lbl = `${d.role}`;
    ctx.font          = 'bold 10px Barlow Condensed';
    ctx.fillStyle     = '#ffffff';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(lbl, px, py - R * 0.15 + 1);
    ctx.restore();

    // Debug assignment label — shown in Manual mode only (preset has its own line colors)
    if (activePreset === 'manual' && d.assignment.type !== 'none') {
      const asgLbl = d.assignment.type === 'man'
        ? `MAN:#${d.assignment.targetId}`
        : `ZONE:${(d.assignment.landmarkId||'').replace('_',' ')}`;
      ctx.font          = '9px Barlow Condensed';
      ctx.textAlign     = 'left';
      ctx.textBaseline  = 'top';
      ctx.lineWidth     = 2;
      ctx.strokeStyle   = 'rgba(0,0,0,0.8)';
      ctx.strokeText(asgLbl, px + 15, py - 8);
      ctx.fillStyle     = d.assignment.type === 'man' ? DEF_COLOR : '#facc15';
      ctx.fillText(asgLbl, px + 15, py - 8);
    }

    // DEC label — always shown in preset mode (editor + sim), only sim in manual
    const showDecLabel = d.decision && d.decision.mode !== 'idle' &&
      (activePreset !== 'manual' || mode === 'sim');
    if (showDecLabel) {
      let decLbl = '';
      if (d.decision.mode === 'rush') {
        decLbl = activePreset !== 'manual' ? 'RUSH' : 'DEC: RUSH';
      } else if (d.decision.mode === 'follow') {
        const tgt = players.find(p => p.id === d.decision.focusTargetId);
        const tgtTag = tgt ? `${tgt.label || tgt.type}#${tgt.id}` : `#${d.decision.focusTargetId}`;
        decLbl = activePreset !== 'manual' ? tgtTag : `DEC: FOLLOW ${tgtTag}`;
      } else if (d.decision.mode === 'drop') {
        const lmShort = (d.decision.focusLandmarkId||'').replace(/_/g,' ');
        decLbl = activePreset !== 'manual' ? `FREE (${lmShort})` : `DEC: DROP ${lmShort}`;
      }
      if (decLbl) {
        ctx.font          = 'bold 9px Barlow Condensed';
        ctx.textAlign     = 'left';
        ctx.textBaseline  = 'top';
        ctx.lineWidth     = 2;
        ctx.strokeStyle   = 'rgba(0,0,0,0.85)';
        const labelY = activePreset !== 'manual' ? py - 8 : py + 2;
        ctx.strokeText(decLbl, px + 15, labelY);
        ctx.fillStyle = d.decision.mode === 'rush'   ? '#f87171'
                      : d.decision.mode === 'follow' ? '#67e8f9'
                      : '#fde68a';
        ctx.fillText(decLbl, px + 15, labelY);
      }
    }

    // ── Phase 3.4: Behavior label (only during sim, preset active) ────
    if (mode === 'sim' && activePreset !== 'manual' && d.decision && d.decision.behavior) {
      const beh = d.decision.behavior;
      const behLabel = beh === 'carry' ? 'CARRY'
                     : beh === 'rob'   ? 'ROB'
                     : beh === 'drop'  ? null   // safety drop — no extra badge
                     : null;                     // 'follow' — no badge needed

      if (behLabel) {
        const behColor = beh === 'carry' ? '#a78bfa'   // purple
                       : beh === 'rob'   ? '#fb923c'   // orange
                       : '#fde68a';
        ctx.save();
        ctx.font         = 'bold 8px Barlow Condensed';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
        ctx.lineWidth    = 2;
        const behY = (activePreset !== 'manual' ? py - 8 : py + 2) + 11;
        ctx.strokeText(`BEH:${behLabel}`, px + 15, behY);
        ctx.fillStyle = behColor;
        ctx.fillText(`BEH:${behLabel}`, px + 15, behY);
        ctx.restore();
      }

      // Safety shade arrow
      if (beh === 'drop' && d.decision._shadedLandmarkPos) {
        const baseLm = getLandmarkPos(d.decision.focusLandmarkId || 'DEEP_MIDDLE');
        const shaded = d.decision._shadedLandmarkPos;
        const arrowDir = shaded.x > baseLm.x ? 1 : -1;
        ctx.save();
        ctx.strokeStyle = 'rgba(167,139,250,0.8)';
        ctx.fillStyle   = 'rgba(167,139,250,0.8)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py - DEF_PLAYER_RADIUS - 4);
        ctx.lineTo(px + arrowDir * 10, py - DEF_PLAYER_RADIUS - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + arrowDir * 10, py - DEF_PLAYER_RADIUS - 4);
        ctx.lineTo(px + arrowDir * 7,  py - DEF_PLAYER_RADIUS - 7);
        ctx.lineTo(px + arrowDir * 7,  py - DEF_PLAYER_RADIUS - 1);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

  });  // end defensePlayers.forEach

  ctx.restore();
}

// Freeze defender positions at sim start — seeds decisions and locks gap positions.
function initDefendersForSim(preserveSimPos = false) {
  const presetDecisions = activePreset !== 'manual' && offenseStructureSnapshot
    ? getActivePresetDecisions(offenseStructureSnapshot, defensePlayers)
    : null;

  defensePlayers.forEach(d => {
    // preserveSimPos=true: keep simX/simY from presnap phase (motion end positions)
    // preserveSimPos=false: seed from editor position (first call at sim start)
    if (!preserveSimPos) {
      d.simX = d.x;
      d.simY = d.y;
    }
    d.simZoneDone  = false;
    d.simZonePhase = 1;
    d._lockedGapId = null;
    d._ntElapsed   = 0;
    d._blockLocked = false;
    d._covLock     = null;
    d._covCall     = null;
    d._dualManRole = null;
    d._dualManTargetId = null;
    d._dualManIsTop = false;

    // Manual override: if the user explicitly assigned this defender in the editor,
    // their assignment wins over the preset — even at snap time.
    if (d._manualAssignment && d.passAssignment) {
      d.decision = assignmentToDecision(d.passAssignment);
    } else if (presetDecisions && presetDecisions.has(d.id)) {
      d.decision = { ...presetDecisions.get(d.id) };
    } else {
      d.decision = assignmentToDecision(d.assignment);
    }
  });

  computeDynamicGaps();
  simLockedGapX = {};
  Object.entries(GAP_OFFSETS_PX).forEach(([gapId, offPx]) => {
    simLockedGapX[gapId] = ball.x + offPx;
  });
}

