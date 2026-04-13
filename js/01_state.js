const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ─────────────────────────────────────────────
// FIELD CONSTANTS
// ─────────────────────────────────────────────
const FIELD_W     = 1060;  // 53 yards * 20px/yd
const FIELD_H     = 700;
const YARD_PX     = 20;
const ENDZONE_Y   = 0;     // Top of field (upfield end) — adjust when field grows
const FIELD_LEFT  = 0;
const FIELD_RIGHT = FIELD_W;
// College field layout (from each sideline):
//  9 yd | Numbers (5.67 yd) | 13.33 yd between hashes center-to-center
// Hash offset from center = 13.33/2 = 6.67 yd
const HASH_OFFSET = Math.round(6.67 * YARD_PX);   // 133px from center
const HASH_WIDTH  = Math.round(0.5 * YARD_PX);    // 10px total hash width
const LEFT_HASH   = FIELD_W / 2 - HASH_OFFSET;
const RIGHT_HASH  = FIELD_W / 2 + HASH_OFFSET;

const CAM_BEHIND_YARDS = 10;
const BALL_SCREEN_Y    = FIELD_H - CAM_BEHIND_YARDS * YARD_PX;

canvas.width  = FIELD_W;
canvas.height = FIELD_H;

// ─────────────────────────────────────────────
// GAME CONSTANTS
// ─────────────────────────────────────────────
const SKILL_TYPES    = ['QB', 'RB', 'WR', 'TE', 'FB'];
const SKILL_LIMIT    = 6;
const OLINE_SPACING  = 32;
const ARRIVE_THRESHOLD = 6;

// COLORS per assignment type
// Non-selected paths use slightly thinner lines but same full color — no fading.
const COLOR = {
  route:  { line: '#4477ff', wp: '#88aaff' },
  motion: { line: '#cc66ff', wp: '#dd99ff' },
  block:  { line: '#ff4444', wp: '#ff8888' },
  shift:  { line: '#000000', wp: '#333333' },  // black spring, visually distinct
};

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let ball = { x: FIELD_W / 2, y: BALL_SCREEN_Y };
const LOS_Y = () => ball.y;

let players        = [];
let nextId         = 1;
let mode           = 'editor'; // 'editor' | 'sim'
let simSpeed       = 2;
let selectedPlayerId = null;
let animId         = null;
let lastTime       = null;
let simPaused      = false;
let _reactiveDTOver = true; // frozen at sim start, used by reactiveFormationSimStep
let simLockedGapX  = {};  // gap X positions frozen at snap

// ── TOOL STATE ──────────────────────────────────
// activeTool: 'route' | 'block' | 'motion' | 'shift' | 'brush'
let activeTool = 'route';

// motionOwnerId: id of the single player that has motionPoints, or null
// (invariant: at most one player has motionPoints.length > 0 at a time)
let motionOwnerId = null;

// ── ANNOTATION STATE ─────────────────────────────────────────────────
let annotations  = [];   // array of strokes; each stroke = [{x,y}, ...]
let activeStroke = null; // stroke currently being drawn (null when not drawing)

function setTool(tool) {
  activeTool = tool;
  ['route','block','motion','shift','brush'].forEach(t => {
    const el = document.getElementById('tool' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('active', t === tool);
  });
  updateInfoBar();
}

function updateInfoBar() {
  const tips = {
    route:  'ROUTE — Left-click to add waypoints · Right-click removes last',
    block:  'BLOCK — Left-click to add block points · Right-click removes last',
    motion: 'MOTION — Pre-snap after shift (max 1 player) · Left/Right-click',
    shift:  'SHIFT — Pre-snap before motion (multi-player, skill only) · Left/Right-click',
    brush:  'BRUSH — Hold+drag to annotate · Right-click undoes last stroke',
  };
  document.getElementById('infoBar').textContent = tips[activeTool] || '';
}

function updateMotionBadge() {
  const badge = document.getElementById('motionOwnerBadge');
  if (motionOwnerId !== null) {
    const p = players.find(pl => pl.id === motionOwnerId);
    badge.textContent = p ? `Motion: ${p.label} #${p.id}` : '';
  } else {
    badge.textContent = '';
  }
}

function toggleImportant() {
  const p = players.find(pl => pl.id === selectedPlayerId);
  if (!p) return;
  p.important = !p.important;
  const btn = document.getElementById('importantBtn');
  if (btn) btn.textContent = p.important ? '★ Unmark Important' : '★ Mark Important';
  refreshPlayerList();
  draw();
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'error') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type === 'info' ? ' toast-info' : '') + ' show';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3200);
}

// ─────────────────────────────────────────────
// SKILL COUNTER
// ─────────────────────────────────────────────
function countSkillPlayers() {
  return players.filter(p => SKILL_TYPES.includes(p.type)).length;
}
function refreshSkillCounter() {
  const count = countSkillPlayers();
  const full  = count >= SKILL_LIMIT;
  document.getElementById('skillCountText').textContent = count + '/' + SKILL_LIMIT;
  document.getElementById('skillCountText').style.color = full ? '#e74c3c' : '';
  const pips = document.getElementById('skillPips');
  pips.innerHTML = '';
  for (let i = 0; i < SKILL_LIMIT; i++) {
    const pip = document.createElement('div');
    pip.className = 'pip' + (i < count ? (full ? ' full' : ' filled') : '');
    pips.appendChild(pip);
  }
}

// ─────────────────────────────────────────────
// DEBUG LOG
// ─────────────────────────────────────────────
function logDebug(msg) {
  console.log('[SIM]', msg.replace(/<[^>]*>/g, ''));
  const entries = document.getElementById('debugEntries');
  const el = document.createElement('div');
  el.className = 'log-entry';
  el.innerHTML = msg;
  entries.appendChild(el);
  while (entries.children.length > 30) entries.removeChild(entries.firstChild);
  document.getElementById('debugLog').scrollTop = 9999;
}
function clearDebugLog() {
  document.getElementById('debugEntries').innerHTML = '';
}

// ─────────────────────────────────────────────
// PLAYER MODEL
// Each player has:
//   routePoints  : [{x,y}]   blue route waypoints
//   motionPoints : [{x,y}]   purple spring — pre-snap motion (max 1 player; runs AFTER shift)
//   shiftPoints  : [{x,y}]   grey spring   — pre-snap shift  (multi-player; runs BEFORE motion)
//   blockPoints  : [{x,y}]   red block path (multi-point, mutually exclusive with route)
// Route ↔ Block are mutually exclusive. Shift/Motion are independent of both.
// Shift is only for skill positions (QB/RB/WR/TE/FB). O-Line cannot shift.
// ─────────────────────────────────────────────
function makePlayer(type, x, y) {
  return {
    id: nextId++, type, label: type,
    x, y, origX: x, origY: y,
    important:    false,
    routePoints:  [],
    motionPoints: [],
    shiftPoints:  [],
    blockPoints:  [],
    get routes() { return this.routePoints; },
    set routes(v) { this.routePoints = v; },
  };
}

// ── O-LINE DATA ──────────────────────────────────────────────────────────
// O-Line players are auto-placed; block assignments stored in olineData map.
const OLINE_IDS    = ['olt','olg','oc','org','ort'];
const OLINE_LABELS = { olt:'LT', olg:'LG', oc:'C', org:'RG', ort:'RT' };
let olineData = {};
OLINE_IDS.forEach(id => { olineData[id] = { blockPoints: [] }; });

let olineOpen = false; // accordion state — starts closed

// Patch 3: O-Line is placed 1 yard (YARD_PX) BEHIND the LOS (backfield = higher Y)
const OLINE_BACKFIELD_OFFSET = YARD_PX;

function olinePlayers() {
  const cy = LOS_Y() + OLINE_BACKFIELD_OFFSET; // behind LOS
  return [
    { id:'olt', label:'LT', x: ball.x - OLINE_SPACING*2, y:cy, isOline:true },
    { id:'olg', label:'LG', x: ball.x - OLINE_SPACING,   y:cy, isOline:true },
    { id:'oc',  label:'C',  x: ball.x,                   y:cy, isOline:true },
    { id:'org', label:'RG', x: ball.x + OLINE_SPACING,   y:cy, isOline:true },
    { id:'ort', label:'RT', x: ball.x + OLINE_SPACING*2, y:cy, isOline:true },
  ];
}

// ─────────────────────────────────────────────
// PLACEMENT HELPERS
// ─────────────────────────────────────────────

// LOS constraint: upfield = smaller Y → players must stay at or BELOW LOS (y >= LOS_Y())
// A tiny 1-px tolerance keeps players exactly on the line without floating-point jitter.
function clampToLOS(x, y) {
  return {
    x: Math.max(FIELD_LEFT + 14, Math.min(FIELD_RIGHT - 14, x)),
    y: Math.max(LOS_Y(), y),          // y must be >= LOS (backfield side)
  };
}

// Per-type spawn count (how many of this type already on field) → offset so duplicates don't stack.
// Pattern: diagonal grid +24px X, +36px Y per existing same-type player (doubled from original).
// Wraps after 5 to avoid pushing off-field. Always clamped afterwards.
function spawnOffset(type) {
  const sameType = players.filter(p => p.type === type).length; // count before push
  const col = sameType % 5;
  const row = Math.floor(sameType / 5) % 3;
  return { dx: col * 28, dy: row * 36 };
}

function addPlayer(type) {
  if (mode !== 'editor') return;
  if (SKILL_TYPES.includes(type) && countSkillPlayers() >= SKILL_LIMIT) {
    showToast(`⚠ SKILL LIMIT REACHED — max ${SKILL_LIMIT} skill players allowed`);
    return;
  }

  // Base spawn positions (all guaranteed on or behind LOS)
  const los = LOS_Y();
  const defaults = {
    QB: { x: ball.x,                    y: los + YARD_PX * 5 },
    RB: { x: ball.x - 20 - YARD_PX,    y: los + 90 },
    WR: { x: FIELD_LEFT + 80,           y: los + YARD_PX },
    TE: { x: ball.x + OLINE_SPACING*3,  y: los + YARD_PX },
    FB: { x: ball.x + YARD_PX,          y: los + 65 },
  };
  const base = defaults[type] || { x: ball.x, y: los + 60 };
  const off  = spawnOffset(type);

  // Apply offset then clamp to field + LOS
  const clamped = clampToLOS(base.x + off.dx, base.y + off.dy);

  const p = makePlayer(type, clamped.x, clamped.y);
  players.push(p);
  selectedPlayerId = p.id;
  refreshPlayerList();
  refreshSkillCounter();
  draw();
}

function deletePlayer(id) {
  if (motionOwnerId === id) motionOwnerId = null;
  if (runCarrierId === id) runCarrierId = null;
  players = players.filter(p => p.id !== id);
  if (selectedPlayerId === id) selectedPlayerId = null;
  refreshPlayerList();
  refreshSkillCounter();
  updateMotionBadge();
  draw();
}

function refreshPlayerList() {
  // ── Skill players ──────────────────────────────────────
  const list = document.getElementById('playerList');
  list.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-item' + (p.id === selectedPlayerId ? ' selected' : '');
    const icons = [
      p.routePoints.length  ? '<span style="color:#4477ff;font-size:10px">R</span>' : '',
      p.motionPoints.length ? '<span style="color:#cc66ff;font-size:10px">M</span>' : '',
      p.shiftPoints.length  ? '<span style="color:#aaa;font-size:10px">S</span>'    : '',
      p.blockPoints.length  ? '<span style="color:#ff4444;font-size:10px">B</span>' : '',
      p.important           ? '<span style="color:#ffe066;font-size:10px">★</span>' : '',
    ].join('');
    div.innerHTML =
      `<span class="dot" style="background:${p.id === selectedPlayerId ? '#00e5ff' : '#f0e040'}"></span>` +
      `${p.label} #${p.id} ${icons}` +
      `<button class="del-btn" data-id="${p.id}">×</button>`;
    div.addEventListener('click', e => {
      if (e.target.classList.contains('del-btn')) { deletePlayer(+e.target.dataset.id); return; }
      selectedPlayerId = p.id;
      refreshPlayerList();
      draw();
    });
    list.appendChild(div);
  });

  // ── O-Line accordion ───────────────────────────────────
  refreshOlineList();
  // ── Run carrier selector ────────────────────────────────
  refreshRunCarrierSelect();
}

function refreshOlineList() {
  const list = document.getElementById('olineList');
  list.innerHTML = '';
  olinePlayers().forEach(ol => {
    const data  = olineData[ol.id];
    const isSel = selectedPlayerId === ol.id;
    const div   = document.createElement('div');
    div.className = 'player-item' + (isSel ? ' selected' : '');
    const bIcon = data.blockPoints.length
      ? '<span style="color:#ff4444;font-size:10px">B</span>' : '';
    div.innerHTML =
      `<span class="dot" style="background:${isSel ? '#00e5ff' : '#e8a020'}"></span>` +
      `${ol.label} ${bIcon}`;
    div.addEventListener('click', () => {
      selectedPlayerId = ol.id;
      // Switch to block tool — O-Line can only block
      if (activeTool !== 'block') setTool('block');
      refreshPlayerList();
      draw();
    });
    list.appendChild(div);
  });
}

function toggleOlineAccordion() {
  olineOpen = !olineOpen;
  document.getElementById('olineList').classList.toggle('hidden', !olineOpen);
  document.getElementById('olineHeader').classList.toggle('collapsed', !olineOpen);
}

function toggleOffPlayersAccordion() {
  const body = document.getElementById('offPlayersBody');
  const header = document.getElementById('offPlayersHeader');
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden', !isHidden);
  header.classList.toggle('collapsed', isHidden);
}

// ─────────────────────────────────────────────
// DRAWING
// ─────────────────────────────────────────────
function drawField() {
  ctx.fillStyle = '#2d5a1b';
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  for (let i = -15; i <= 35; i++) {
    const yTop    = LOS_Y() - (i+1)*YARD_PX;
    const yBottom = LOS_Y() - i*YARD_PX;
    if (yBottom < 0 || yTop > FIELD_H) continue;
    if (Math.floor(i/5) % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(FIELD_LEFT, yTop, FIELD_RIGHT - FIELD_LEFT, YARD_PX);
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(FIELD_LEFT, 0);  ctx.lineTo(FIELD_LEFT, FIELD_H);
  ctx.moveTo(FIELD_RIGHT, 0); ctx.lineTo(FIELD_RIGHT, FIELD_H);
  ctx.stroke();

  for (let i = -15; i <= 35; i++) {
    const y = LOS_Y() - i*YARD_PX;
    if (y < -1 || y > FIELD_H+1) continue;
    ctx.strokeStyle = i%5===0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = i%5===0 ? 1.5 : 0.8;
    ctx.beginPath(); ctx.moveTo(FIELD_LEFT, y); ctx.lineTo(FIELD_RIGHT, y); ctx.stroke();
  }

  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  for (let i = -15; i <= 35; i++) {
    const y = LOS_Y() - i*YARD_PX;
    if (y < 0 || y > FIELD_H) continue;
    const hw = HASH_WIDTH / 2;
    ctx.beginPath();
    ctx.moveTo(LEFT_HASH - hw, y);  ctx.lineTo(LEFT_HASH + hw, y);
    ctx.moveTo(RIGHT_HASH - hw, y); ctx.lineTo(RIGHT_HASH + hw, y);
    ctx.stroke();
  }

  // ── Yard numbers — between hash and sideline, pointing toward sideline ──
  // Only 10-yard lines: 50 (LOS), 40 (+10), 30 (+20), 20 (+30)
  // Left numbers rotate so top points LEFT (toward left sideline)
  // Right numbers rotate so top points RIGHT (toward right sideline)
  const YARD_LABELS = { 0:'50', 10:'40', 20:'30', 30:'20' };
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 48px Barlow Condensed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [offset, label] of Object.entries(YARD_LABELS)) {
    const i  = Number(offset);
    const y  = LOS_Y() - i * YARD_PX;
    if (y < 20 || y > FIELD_H - 10) continue;

    // Left number — top of digit points toward left sideline (rotate +90°)
    const lx = (FIELD_LEFT + LEFT_HASH) / 2;
    ctx.save();
    ctx.translate(lx, y);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();

    // Right number — top of digit points toward right sideline (rotate -90°)
    const rx = (RIGHT_HASH + FIELD_RIGHT) / 2;
    ctx.save();
    ctx.translate(rx, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  ctx.setLineDash([4,6]);
  ctx.beginPath();
  ctx.moveTo(LEFT_HASH,  0); ctx.lineTo(LEFT_HASH,  FIELD_H);
  ctx.moveTo(RIGHT_HASH, 0); ctx.lineTo(RIGHT_HASH, FIELD_H);
  ctx.stroke(); ctx.setLineDash([]);

  ctx.save(); ctx.translate(FIELD_W/2, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = 'bold 11px Barlow Condensed'; ctx.textAlign = 'center';
  ctx.fillText('▲  UPFIELD', 0, 0); ctx.restore();
}

function drawLOS() {
  const y = LOS_Y();
  ctx.save();
  ctx.strokeStyle = 'rgba(100,180,255,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([8,5]);
  ctx.beginPath(); ctx.moveTo(FIELD_LEFT, y); ctx.lineTo(FIELD_RIGHT, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(100,180,255,0.9)';
  ctx.font = 'bold 11px Barlow Condensed'; ctx.textAlign = 'left';
  ctx.fillText('LINE OF SCRIMMAGE', FIELD_LEFT+5, y-5);
  ctx.restore();
}

// Helper: draw a polyline with arrow heads and waypoint dots
function drawPolyline(startX, startY, pts, lineCol, wpCol, lineWidth, dashed) {
  if (!pts || pts.length === 0) return;
  ctx.save();
  ctx.strokeStyle = lineCol; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(startX, startY);
  pts.forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke(); ctx.setLineDash([]);

  const all = [{x:startX,y:startY}, ...pts];
  for (let i = 0; i < all.length-1; i++) {
    const a=all[i], b=all[i+1];
    drawArrow(ctx, (a.x+b.x)/2, (a.y+b.y)/2, b.x, b.y, lineCol);
  }
  pts.forEach(wp => {
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 5, 0, Math.PI*2);
    ctx.fillStyle = wpCol; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.restore();
}

// ── Motion "spring" renderer ──────────────────────────────────────────
// Draws a wavy zig-zag line along each segment of the motion path.
// The wave oscillates perpendicular to the travel direction, giving a
// spring / coil look that is visually distinct from Route (solid line)
// and Block (dashed line + rect marker).
function drawMotionSpringPath(startX, startY, pts, lineCol, wpCol, lineWidth) {
  if (!pts || pts.length === 0) return;
  ctx.save();
  ctx.strokeStyle = lineCol;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  const WAVE_AMP  = 6;   // px perpendicular amplitude
  const WAVE_STEP = 10;  // px along-segment between zig and zag

  const all = [{ x: startX, y: startY }, ...pts];
  ctx.beginPath();

  let firstMove = true;
  for (let seg = 0; seg < all.length - 1; seg++) {
    const a = all[seg], b = all[seg + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1) continue;

    // Unit tangent and perpendicular
    const tx = dx / segLen, ty = dy / segLen;
    const nx = -ty,         ny =  tx;   // 90° CCW = left of travel dir

    const steps = Math.max(2, Math.round(segLen / WAVE_STEP));
    for (let i = 0; i <= steps; i++) {
      const t      = i / steps;
      const cx     = a.x + t * dx;
      const cy     = a.y + t * dy;
      // Alternating sign: even → +amp (left), odd → −amp (right)
      const sign   = (i % 2 === 0) ? 1 : -1;
      // Taper amplitude to 0 at segment endpoints for smooth join
      const taper  = Math.sin(t * Math.PI);          // 0→1→0
      const amp    = sign * WAVE_AMP * taper;
      const px     = cx + nx * amp;
      const py     = cy + ny * amp;
      if (firstMove) { ctx.moveTo(px, py); firstMove = false; }
      else             ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  // Small dots at each motion waypoint (excluding start — player circle is there)
  pts.forEach(wp => {
    ctx.beginPath(); ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = wpCol; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
  });

  ctx.restore();
}
function drawBlockPath(startX, startY, pts, lineCol, wpCol) {
  if (!pts || pts.length === 0) return;
  ctx.save();
  ctx.strokeStyle = lineCol; ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(startX, startY);
  pts.forEach(wp => ctx.lineTo(wp.x, wp.y));
  ctx.stroke(); ctx.setLineDash([]);

  // Arrow heads at midpoint of each segment
  const all = [{x:startX,y:startY}, ...pts];
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i], b = all[i+1];
    drawArrow(ctx, (a.x+b.x)/2, (a.y+b.y)/2, b.x, b.y, lineCol);
  }

  // Intermediate waypoint dots (not the last one — replaced by rectangle)
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 4, 0, Math.PI*2);
    ctx.fillStyle = wpCol; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  // ── Rectangle end-marker at last blockPoint ──────────────────────────
  // Orientation: perpendicular to approach direction (long side across path)
  const last = pts[pts.length - 1];
  const prev = pts.length >= 2 ? pts[pts.length - 2] : { x: startX, y: startY };
  const dx   = last.x - prev.x, dy = last.y - prev.y;
  const len  = Math.hypot(dx, dy) || 1;
  // Unit vector along approach direction
  const ux = dx / len, uy = dy / len;
  // Perpendicular (normal) = rotate 90°
  const nx = -uy, ny = ux;
  // Rectangle: wide=22px across path, thin=8px along path
  const halfW = 11, halfH = 4;
  ctx.save();
  ctx.translate(last.x, last.y);
  // Build rotated rect using perpendicular as X-axis
  // corners: (±halfW along normal) × (±halfH along approach)
  ctx.beginPath();
  ctx.moveTo( nx*halfW + ux*halfH,  ny*halfW + uy*halfH);
  ctx.lineTo(-nx*halfW + ux*halfH, -ny*halfW + uy*halfH);
  ctx.lineTo(-nx*halfW - ux*halfH, -ny*halfW - uy*halfH);
  ctx.lineTo( nx*halfW - ux*halfH,  ny*halfW - uy*halfH);
  ctx.closePath();
  ctx.fillStyle   = wpCol;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawAssignments() {
  // ── Skill players ───────────────────────────────────────────────────
  players.forEach(p => {
    const isSel = p.id === selectedPlayerId;

    const rPts = (mode === 'sim' && p.simRoutePoints)  ? p.simRoutePoints  : p.routePoints;
    const mPts = (mode === 'sim' && p.simMotionPoints) ? p.simMotionPoints : p.motionPoints;
    const sPts = (mode === 'sim' && p.simShiftPoints)  ? p.simShiftPoints  : p.shiftPoints;
    const bPts = (mode === 'sim' && p.simBlockPoints)  ? p.simBlockPoints  : p.blockPoints;

    // Shift start: always from player's original/sim start position
    const ssx = (mode === 'sim' && p.simStartX !== undefined) ? p.simStartX : p.x;
    const ssy = (mode === 'sim' && p.simStartY !== undefined) ? p.simStartY : p.y;

    // getPrePlayAnchor: last shift point if shift exists, else player start
    // This is where motion should begin (or route/block if no motion)
    let prePlayX, prePlayY;
    if (sPts && sPts.length > 0) {
      prePlayX = sPts[sPts.length - 1].x;
      prePlayY = sPts[sPts.length - 1].y;
    } else {
      prePlayX = ssx;
      prePlayY = ssy;
    }

    // Motion start: after shift end (or player start)
    const msx = prePlayX;
    const msy = prePlayY;

    // getPreRouteAnchor: last motion point if motion exists, else last shift point, else player start
    let sx, sy;
    if (mPts && mPts.length > 0) {
      sx = mPts[mPts.length - 1].x;
      sy = mPts[mPts.length - 1].y;
    } else {
      sx = prePlayX;
      sy = prePlayY;
    }

    const lw = isSel ? 3 : (p.important ? 3.5 : 2);
    const routeLineCol = p.important ? '#77aaff' : COLOR.route.line;
    const routeWpCol   = p.important ? '#aaccff' : COLOR.route.wp;
    const blockLineCol = p.important ? '#ff7777' : COLOR.block.line;
    const blockWpCol   = p.important ? '#ffaaaa' : COLOR.block.wp;

    // Shift (black spring) — drawn from player start, before motion
    if (sPts && sPts.length > 0)
      drawMotionSpringPath(ssx, ssy, sPts, COLOR.shift.line, COLOR.shift.wp, lw);

    // Motion (purple spring) — drawn from shift end (or player pos if no shift)
    if (mPts && mPts.length > 0)
      drawMotionSpringPath(msx, msy, mPts, COLOR.motion.line, COLOR.motion.wp, lw);

    if (rPts && rPts.length > 0)
      drawPolyline(sx, sy, rPts, routeLineCol, routeWpCol, lw, false);

    if (bPts && bPts.length > 0)
      drawBlockPath(sx, sy, bPts, blockLineCol, blockWpCol);
  });

  // ── O-Line block assignments ────────────────────────────────────────
  olinePlayers().forEach(ol => {
    const data = olineData[ol.id];
    if (!data) return;

    const bPts = (mode === 'sim' && data.simBlockPoints) ? data.simBlockPoints : data.blockPoints;
    if (!bPts || bPts.length === 0) return;

    const startX = (mode === 'sim' && data.simStartX !== undefined) ? data.simStartX : ol.x;
    const startY = (mode === 'sim' && data.simStartY !== undefined) ? data.simStartY : ol.y;
    drawBlockPath(startX, startY, bPts, COLOR.block.line, COLOR.block.wp);
  });

  // ── Designated block target lines (middle-click assignments) ────────
  const allBlockers = [
    ...players,
    ...olinePlayers().map(ol => ({ ...olineData[ol.id], _isOlineData: true, id: ol.id, x: ol.x, y: ol.y }))
  ];
  allBlockers.forEach(b => {
    if (!b._designatedBlockTargetId) return;
    const target = defensePlayers.find(d => d.id === b._designatedBlockTargetId);
    if (!target) return;

    // Start from last block point if exists, else from player position
    const blockPts = b._isOlineData ? (b.blockPoints || []) : (b.blockPoints || []);
    const hasBlockPath = blockPts.length > 0;
    const lastBP = hasBlockPath ? blockPts[blockPts.length - 1] : null;

    const bx = mode === 'sim' ? (b.simX ?? b.x) : (lastBP ? lastBP.x : b.x);
    const by = mode === 'sim' ? (b.simY ?? b.y) : (lastBP ? lastBP.y : b.y);
    const tx = (mode === 'sim' ? (target.simX ?? target.x) : target.x);
    const ty = (mode === 'sim' ? (target.simY ?? target.y) : target.y);

    const dx  = tx - bx, dy = ty - by;
    const len = Math.hypot(dx, dy) || 1;
    const ux  = dx / len, uy = dy / len;
    const nx  = -uy,      ny = ux;

    // Stop 18px before defender center
    const endX = tx - ux * 18;
    const endY = ty - uy * 18;

    ctx.save();
    // Dashed line
    ctx.strokeStyle = COLOR.block.line;
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow at midpoint
    drawArrow(ctx, bx, by, endX, endY, COLOR.block.line);
    ctx.restore();

    // Rectangle at endpoint
    const halfW = 11, halfH = 4;
    ctx.save();
    ctx.translate(endX, endY);
    ctx.beginPath();
    ctx.moveTo( nx*halfW + ux*halfH,  ny*halfW + uy*halfH);
    ctx.lineTo(-nx*halfW + ux*halfH, -ny*halfW + uy*halfH);
    ctx.lineTo(-nx*halfW - ux*halfH, -ny*halfW - uy*halfH);
    ctx.lineTo( nx*halfW - ux*halfH,  ny*halfW - uy*halfH);
    ctx.closePath();
    ctx.fillStyle   = COLOR.block.wp;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  });
}

function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const angle = Math.atan2(toY-fromY, toX-fromX);
  const size  = 8;
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(fromX, fromY); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-size,-size/2); ctx.lineTo(-size,size/2);
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawPlayers() {
  // O-Line — selectable for block assignment; moves in sim if they have a block target
  olinePlayers().forEach(ol => {
    const isSel = selectedPlayerId === ol.id;
    const d  = olineData[ol.id];
    const px = (mode === 'sim' && d.simX !== undefined) ? d.simX : ol.x;
    const py = (mode === 'sim' && d.simY !== undefined) ? d.simY : ol.y;
    drawPlayerCircle(px, py, isSel ? '#00e5ff' : '#e8a020', ol.label, isSel);
  });
  // Skill players
  players.forEach(p => {
    const px  = mode === 'sim' ? (p.simX ?? p.x) : p.x;
    const py  = mode === 'sim' ? (p.simY ?? p.y) : p.y;
    const sel = p.id === selectedPlayerId;
    const isCarrier = playType === 'run' && p.id === runCarrierId;
    const color = sel ? '#00e5ff' : isCarrier ? '#22c55e' : '#f0e040';
    drawPlayerCircle(px, py, color, p.label, sel);
    if (p.important) {
      ctx.save();
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 11px Barlow Condensed';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', px + 14, py - 14);
      ctx.restore();
    }
  });
}

function drawPlayerCircle(x, y, color, label, selected) {
  ctx.save();
  if (selected) { ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18; }
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2);
  ctx.fillStyle = selected ? 'rgba(0,229,255,0.25)' : 'rgba(0,0,0,0.5)';
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = selected ? 3 : 2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color; ctx.font = 'bold 9px Barlow Condensed';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y); ctx.restore();
}

// Patch 4: Ball rotated 90° — long axis vertical so tip points upfield (↑)
// Patch 5: In sim, ball is animated from LOS → QB, then follows QB
function drawBall() {
  let bx, by;
  if (mode === 'sim') {
    if (playType === 'run') {
      if (runHandoffState === 'carrying') {
        // Carrier has the ball
        const carrier = players.find(p => p.id === runCarrierId);
        if (carrier) { bx = carrier.simX ?? carrier.x; by = carrier.simY ?? carrier.y; }
        else { bx = ball.x; by = ball.y; }
      } else if (ballSim.done) {
        // Snap done but handoff not yet complete — ball with QB
        const qb = players.find(p => p.type === 'QB');
        if (qb) { bx = qb.simX ?? qb.x; by = qb.simY ?? qb.y; }
        else { bx = ballSim.x; by = ballSim.y; }
      } else if (ballSim.active) {
        bx = ballSim.x; by = ballSim.y;
      } else {
        bx = ball.x; by = ball.y;
      }
    } else if (ballSim.done) {
      // Snap complete: ball travels with QB
      const qb = players.find(p => p.type === 'QB');
      if (qb) { bx = qb.simX ?? qb.x; by = qb.simY ?? qb.y; }
      else return; // no QB, nothing to draw
    } else if (ballSim.active) {
      // In-flight snap animation
      bx = ballSim.x; by = ballSim.y;
    } else {
      // Motion phase or pre-play: ball stays at LOS spot
      bx = ball.x; by = ball.y;
    }
  } else {
    bx = ball.x; by = ball.y;
  }

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.PI / 2); // 90° → oval tip points toward screen-top = upfield

  ctx.shadowColor = '#f08020'; ctx.shadowBlur = 20;

  // Oval: scale Y to make it elongated, then the 90° rotation makes it vertical
  ctx.save();
  ctx.scale(1, 0.55);
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#c8651a'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // Laces — rotated 90° relative to ball so they run across the short axis
  ctx.save();
  ctx.rotate(Math.PI / 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -3); ctx.lineTo(0,  3);   // center seam
  ctx.moveTo(-3, -1); ctx.lineTo(3, -1);  // top lace
  ctx.moveTo(-3,  1); ctx.lineTo(3,  1);  // bottom lace
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawAnnotations() {
  if (mode === 'sim') return;
  if (!annotations.length && !activeStroke) return;
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = '#ffe83a';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  const drawStroke = pts => {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  annotations.forEach(drawStroke);
  if (activeStroke) drawStroke(activeStroke);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,FIELD_W,FIELD_H);
  computeDynamicGaps(); // rebuild A–F gap offsets from current offense alignment
  // In editor presnap mode: ignore waypoints so snapshot reflects base positions
  _snapRawOverride = (mode !== 'sim' && reactiveFormationMode === 'presnap');
  rebuildOffenseStructureSnapshot();
  // Coverage engine: update defender decisions for editor preview
  // Keep _snapRawOverride active during updateDefenseDecisions so preset.decide()
  // also reads pre-motion positions when classifying routes/alignments.
  if (mode !== 'sim') {
    updateDefenseDecisions(offenseStructureSnapshot, {}, 0);
  } else if (simPhase === 'shift' || simPhase === 'settle' || simPhase === 'preplay') {
    updateDefenseDecisions(offenseStructureSnapshot, {}, 0);
  }
  _snapRawOverride = false; // reset after all decisions are built
  const zoomed = applyZoomTransform();
  drawField(); drawLOS();

  // ── Run/PA visuals ────────────────────────────────────────────
  if (playType === 'run' || playType === 'pa') {
    drawGapMarkers();
    const carrier = players.find(p => p.id === runCarrierId);
    if (carrier) drawRunPath(carrier);
    if (showRunFitsActive) drawRunFitLines();
  }

  drawAssignments(); drawPlayers(); drawBall();
  drawAnnotations();
  drawDefenders();  // Phase 3.2 / 3.3
  drawZoneAreas();  // Show Zones overlay
  drawRunFitsOverlay(); // Show Run Fits overlay
  if (debugOverlayOn) drawDebugOverlay();
  else if (liveReadOn) drawLiveReadOverlay(); // standalone live read (no formation overlay)
  if (zoomed) ctx.restore();
}

// ─────────────────────────────────────────────
