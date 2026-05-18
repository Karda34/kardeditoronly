// ── UNDO (5 Ebenen, Snapshot-Stack) ────────────────────────────────────────

const UNDO_MAX = 5;
let _undoStack = [];

// ── Deep-copy helpers ──────────────────────────────────────────────────────

function _deepCopyPlayer(p) {
  return {
    id:               p.id,
    type:             p.type,
    x:                p.x,
    y:                p.y,
    important:        p.important,
    routePoints:      p.routePoints.map(pt => ({ x: pt.x, y: pt.y })),
    motionPoints:     p.motionPoints.map(pt => ({ x: pt.x, y: pt.y })),
    shiftPoints:      p.shiftPoints.map(pt => ({ x: pt.x, y: pt.y })),
    blockPoints:      p.blockPoints.map(pt => ({ x: pt.x, y: pt.y })),
    _designatedBlockTargetId: p._designatedBlockTargetId || null,
    _blockChaseTargetId:      p._blockChaseTargetId      || null,
  };
}

function _deepCopyDefender(d) {
  const asgCopy = d.assignment ? Object.assign({}, d.assignment) : {};
  return {
    id:         d.id,
    role:       d.role,
    x:          d.x,
    y:          d.y,
    origX:      d.origX,
    origY:      d.origY,
    assignment: asgCopy,
  };
}

function _deepCopyOline(src) {
  const out = {};
  for (const id in src) {
    out[id] = {
      blockPoints: src[id].blockPoints.map(pt => ({ x: pt.x, y: pt.y })),
      important:   src[id].important,
    };
  }
  return out;
}

// ── Save snapshot ──────────────────────────────────────────────────────────

function saveUndoSnapshot() {
  const snapshot = {
    players:           players.map(_deepCopyPlayer),
    defensePlayers:    defensePlayers.map(_deepCopyDefender),
    olineData:         _deepCopyOline(olineData),
    ball:              { x: ball.x, y: ball.y },
    motionOwnerId:     motionOwnerId,
    nextId:            nextId,
    nextDefId:         nextDefId,
    annotationStrokes: annotationStrokes.map(s => s.map(pt => ({ x: pt.x, y: pt.y }))),
  };
  _undoStack.push(snapshot);
  if (_undoStack.length > UNDO_MAX) _undoStack.shift();
  // Activate undo button
  const btn = document.getElementById('undoBtn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
}

// ── Restore snapshot ───────────────────────────────────────────────────────

function undo() {
  if (_undoStack.length === 0) return;
  const snap = _undoStack.pop();

  // Restore players
  players = snap.players.map(p => {
    const full = makePlayer(p.type, p.x, p.y);
    full.id          = p.id;
    full.important   = p.important;
    full.routePoints  = p.routePoints;
    full.motionPoints = p.motionPoints;
    full.shiftPoints  = p.shiftPoints;
    full.blockPoints  = p.blockPoints;
    full._designatedBlockTargetId = p._designatedBlockTargetId;
    full._blockChaseTargetId      = p._blockChaseTargetId;
    return full;
  });

  // Restore defense
  defensePlayers = snap.defensePlayers.map(d => {
    const full = makeDefender(d.x, d.y);
    full.id         = d.id;
    full.role       = d.role;
    full.x          = d.x;
    full.y          = d.y;
    full.origX      = d.origX != null ? d.origX : d.x;
    full.origY      = d.origY != null ? d.origY : d.y;
    full.assignment = Object.assign({}, d.assignment);
    return full;
  });

  // Restore o-line
  for (const id in snap.olineData) {
    if (olineData[id]) {
      olineData[id].blockPoints = snap.olineData[id].blockPoints;
      olineData[id].important   = snap.olineData[id].important;
    }
  }

  // Restore misc
  ball.x             = snap.ball.x;
  ball.y             = snap.ball.y;
  motionOwnerId      = snap.motionOwnerId;
  nextId             = snap.nextId;
  nextDefId          = snap.nextDefId;
  annotationStrokes  = snap.annotationStrokes.map(s => s.map(pt => ({ x: pt.x, y: pt.y })));
  annotationCurrentStroke = null;

  // Deactivate button when stack empty
  const btn = document.getElementById('undoBtn');
  if (btn && _undoStack.length === 0) {
    btn.disabled = true;
    btn.style.opacity = '0.35';
    btn.style.cursor  = 'not-allowed';
  }

  // Refresh UI
  if (typeof refreshPlayerList      === 'function') refreshPlayerList();
  if (typeof refreshSkillCounter    === 'function') refreshSkillCounter();
  if (typeof updateMotionBadge      === 'function') updateMotionBadge();
  if (typeof refreshDefPlayerList   === 'function') refreshDefPlayerList();
  if (typeof refreshDefAssignBox    === 'function') refreshDefAssignBox();
  if (typeof refreshPresetMatchList === 'function' && typeof activePreset !== 'undefined' && activePreset !== 'manual') refreshPresetMatchList();
  draw();
}
