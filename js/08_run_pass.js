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

// ── CRA: Call Reaction Delay ──────────────────────────────────────────────
// Wenn ein Coverage-Trigger feuert (Push, Switch, Zone-to-Man, etc.) und die
// neue Decision sich von der aktuellen unterscheidet, wird sie erst nach einem
// Delay angewendet. CRA=75 → ~0.075s. CRA=50 → ~0.15s. CRA=0 → ~0.30s.
const CRA_BASE_DELAY = 0.30; // Max Delay bei CRA=0 (Sim-Sekunden)

// ── Decision Hold: Minimum-Haltezeit nach jedem Commit ────────────────────
// Nach dem Commit einer neuen Decision kann kein neues Pending gestartet werden
// bis DECISION_HOLD_MIN Sekunden vergangen sind. Verhindert globales Bouncing
// wenn Route-Klassifikation instabil ist (hin-und-her-wechselnde moveType etc.).
const DECISION_HOLD_MIN = 0.35; // Sekunden

// updateDefenseDecisions — called every tick in play phase and every draw() in editor.
// In play phase: calls preset.react() per defender → updates decision if non-null.
// In editor: rebuilds full initial decisions for preview.
function updateDefenseDecisions(snapshot, lrState, dt) {
  if (!snapshot) return;

  resolveActivePreset(snapshot);
  const preset = PRESET_REGISTRY[activePreset];

  // ── PLAY PHASE: react() per defender ─────────────────────────────
  if (mode === 'sim') {
    // Per-defender MATCH assignments run regardless of the global call sheet —
    // they borrow a coverage role's react() logic for one defender only.
    const snapAll = patchEmptySnapshot(snapshot);
    runMatchAssignments(snapAll, lrState, dt);

    if (!preset) {
      // Manual mode — derive from assignment
      defensePlayers.forEach(d => {
        // Match defenders are driven by runMatchAssignments() above — don't clobber them.
        if (d.assignment.type === 'match') return;
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
      // Manual override: user's passAssignment is already in d.decision from snap-time decide().
      // Don't let react() clobber it during the play.
      if (d._manualAssignment) return;
      if (playPhaseTime < 0.4) return; // Snap-phase: no react() before 0.4s

      // ── CRA: Pending-Decision Timer ───────────────────────────────────
      // Decrement and apply if ready (before running react() this tick).
      if (d._pendingDecision) {
        d._pendingTimer = Math.max(0, (d._pendingTimer || 0) - dt * simSpeed);
        if (d._pendingTimer <= 0) {
          d.decision.mode            = d._pendingDecision.mode;
          d.decision.focusTargetId   = d._pendingDecision.focusTargetId;
          d.decision.focusLandmarkId = d._pendingDecision.focusLandmarkId;
          d.decision.trailPx         = d._pendingDecision.trailPx;
          d.decision._structRole     = role;
          d._pendingDecision         = null;
          d._lastCommitTime          = playPhaseTime; // Hold-Timer starten
        }
      }

      const prs = ownerPreset(role, d);
      if (!prs) return; // No preset for this role (e.g. backside = manual) — keep initial decision
      const newDec = prs.react(d, role, snap, lrState, dt);
      if (newDec !== null && newDec !== undefined) {
        // ── CRA: Detect meaningful decision change ──────────────────────
        // mode oder focusTargetId ändern sich → Coverage-Trigger → Delay.
        // Gleiche Decision (z.B. nur trailPx-Update) → sofort anwenden.
        const isChange = d.decision.mode !== newDec.mode
                      || d.decision.focusTargetId !== newDec.focusTargetId;

        if (isChange) {
          // ── Hold-Check: kein neues Pending innerhalb der Haltezeit ────
          const timeSinceCommit = playPhaseTime - (d._lastCommitTime ?? 0);
          if (timeSinceCommit < DECISION_HOLD_MIN) {
            // Noch in der Haltezeit — nur non-targeting Felder updaten
            d.decision.focusLandmarkId = newDec.focusLandmarkId;
            d.decision.trailPx         = newDec.trailPx;
            d.decision._structRole     = role;
          } else {
            // Bereits dieselbe Decision in der Queue? → Timer nicht resetten.
            const alreadyPending = d._pendingDecision
              && d._pendingDecision.mode === newDec.mode
              && d._pendingDecision.focusTargetId === newDec.focusTargetId;

            if (!alreadyPending) {
              const cra   = (typeof getAttr === 'function') ? getAttr(d, 'CRA') : 75;
              const delay = CRA_BASE_DELAY * (1 - cra / 100);
              if (delay > 0.02) {
                d._pendingDecision = newDec;
                d._pendingTimer    = delay;
              } else {
                // CRA hoch genug → quasi sofort, Hold-Timer trotzdem setzen
                d.decision.mode            = newDec.mode;
                d.decision.focusTargetId   = newDec.focusTargetId;
                d.decision.focusLandmarkId = newDec.focusLandmarkId;
                d.decision.trailPx         = newDec.trailPx;
                d.decision._structRole     = role;
                d._lastCommitTime          = playPhaseTime;
              }
            }
          }
        } else {
          // Keine Änderung — sofort anwenden (trailPx etc. können sich updaten)
          d.decision.mode            = newDec.mode;
          d.decision.focusTargetId   = newDec.focusTargetId;
          d.decision.focusLandmarkId = newDec.focusLandmarkId;
          d.decision.trailPx         = newDec.trailPx;
          d.decision._structRole     = role;
          // Pending abbrechen falls Target zurück auf aktuelles gewechselt ist
          if (d._pendingDecision) { d._pendingDecision = null; d._pendingTimer = 0; }
        }
      }

      // Update _midpointPlayers from fresh decision (needed every tick for dynamic X midpoint)
      if (newDec != null) d.decision._midpointPlayers = newDec._midpointPlayers ?? null;

      // Safety zone shade toward vertical threat (all presets) — immer sofort
      if (d.decision.mode === 'drop') {
        // Dynamic midpoint override: position safety between two tracked deep receivers
        if (d.decision._midpointPlayers && d.decision._midpointPlayers.length >= 2) {
          const [id1, id2] = d.decision._midpointPlayers;
          const p1 = players.find(p => p.id === id1);
          const p2 = players.find(p => p.id === id2);
          if (p1 && p2) {
            const midX   = ((p1.simX ?? p1.x) + (p2.simX ?? p2.x)) / 2;
            const baseLm = getLandmarkPos(d.decision.focusLandmarkId || 'DEEP_MIDDLE');
            d.decision._shadedLandmarkPos = { x: midX, y: baseLm.y };
          } else {
            d.decision._shadedLandmarkPos = null;
          }
        } else {
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
    // Manual override in editor: user's assignment wins, preset is skipped for this defender.
    // _manualAssignment is set by onDefAssignTypeChange() and cleared when user picks 'none'.
    if (d._manualAssignment) {
      d.decision = assignmentToDecision(d.assignment);
      return;
    }
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

// runMatchAssignments — drive each defender with a `type:'match'` assignment by
// borrowing one coverage role's react() logic from an existing preset. Runs every
// tick in play phase, independent of the global call sheet, so a single defender can
// pattern-match (e.g. a 2-Read corner) while the rest of the defense does its own thing.
function runMatchAssignments(snap, lrState, dt) {
  if (!snap) return;
  const ballX = snap.ballX;
  const spec0 = (typeof MATCH_ROLES !== 'undefined') ? MATCH_ROLES : null;

  defensePlayers.forEach(d => {
    const asg = d.assignment;
    if (!asg || asg.type !== 'match') return;

    const spec = spec0 ? spec0[asg.matchId] : null;
    const prs  = PRESET_REGISTRY[asg.preset || (spec && spec.preset)];
    const role = asg.role || (spec && spec.role);
    if (!prs || typeof prs.react !== 'function' || !role) return;

    if (!d.decision) d.decision = idleDec();
    if (playPhaseTime < 0.4) return; // snap phase — hold initial look

    // Side-agnostic rules: make the borrowed role believe THIS defender is on the
    // strong side, so e.g. a 2-Read corner works whether he lines up left or right.
    // Side-specific role names (APEX-L/APEX-R/HOOK-L/...) are also re-suffixed to the
    // defender's own side, otherwise the preset's isStrong gate never fires for him.
    let useSnap = snap;
    let useRole = role;
    if (spec && spec.sideAgnostic) {
      // Freeze the defender's side at SNAP (same reference the presets use), not his
      // live position. Otherwise, when he chases a receiver across the ball his own
      // side flips, coverageStrongSide flips, and the borrowed role's r2s = rec(side,2)
      // jumps to the OTHER side's #2 — a phantom "second #2" that makes him oscillate.
      // Snap-freezing keeps his #1/#2 reads on the side he lined up on for the whole play.
      const snapX = (typeof snapAlignment !== 'undefined' && snapAlignment[d.id])
        ? snapAlignment[d.id].x : (d.simX ?? d.x);
      const side = snapX <= ballX ? 'L' : 'R';            // defender's own (snap) side
      // Weak/backside roles (e.g. MEG/Nail from meg-weak) read the WEAK side, so set
      // coverageStrongSide to the OPPOSITE of his side — that makes weakSide === his
      // side and his #1/#2 reads resolve where he lined up. Strong roles keep
      // strongSide === his side. Role suffix always normalizes to his own side.
      const strongForPreset = spec.weakRole ? (side === 'L' ? 'R' : 'L') : side;
      useSnap = Object.assign({}, snap, { coverageStrongSide: strongForPreset });
      if (/-(L|R)$/.test(role)) useRole = role.replace(/-(L|R)$/, '-' + side);
    }

    const newDec = prs.react(d, useRole, useSnap, lrState, dt);
    if (newDec) {
      d.decision.mode            = newDec.mode;
      d.decision.focusTargetId   = newDec.focusTargetId;
      d.decision.focusLandmarkId = newDec.focusLandmarkId;
      d.decision.trailPx         = newDec.trailPx;
      d.decision._structRole     = useRole;
    }
  });
}

// refreshPresetMatchList — no-op placeholder (reserved for future UI)
function refreshPresetMatchList() {}

// buildPresetSnapshotKey — no-op placeholder (cache removed)
function buildPresetSnapshotKey(snapshot) { return ''; }


// ── Defender Momentum: ACC-Ramp + Velocity-Vector Low-Pass (E2) ───────
// Zwei unabhängige Momentum-Mechanismen:
//   1) ACC-Ramp: Defender starten bei DEF_ACC_START_MULT Speed und rampen
//      mit ACC-Attribut auf Vollspeed hoch. Modelliert "Anfahren vom Stand".
//   2) Velocity-Vector Low-Pass (E2): Der Schritt erfolgt nicht entlang
//      der rohen Desired-Richtung, sondern entlang eines EMA-gesmootheten
//      Voll-Velocity-Vektors (inkl. Magnitude). Bei 180°-Reversal fällt
//      die Magnitude durch ~0 → Defender verliert Speed im Cut, kein
//      Bogen-Loop am Routen-Ende, physik-korrekte Deceleration.
//      Tau ist AWR-moduliert: höheres AWR = kürzere Reaktionszeit.
//
// CRE-Freeze (03_sim_engine.js) modelliert zusätzlich die Perzeptions-
// Verzögerung beim Cut — greift orthogonal zu E2.
const DEF_ACC_START_MULT  = 0.40;   // Defender starten bei 40% Speed
const DEF_ACC_CUT_RESET   = 0.55;   // Reset bei Assignment-Wechsel
const DEF_ACC_BASE_RATE   = 1.8;    // Ramp bei ACC=75 (~0.33s bis Vollspeed)

// E2: Low-Pass-Tau (sec) für Velocity-Vector.
// AWR=99 → DEF_SMOOTH_TAU_MIN, AWR=0 → DEF_SMOOTH_TAU_MAX.
const DEF_SMOOTH_TAU_MIN  = 0.08;   // 80ms bei AWR=99
const DEF_SMOOTH_TAU_MAX  = 0.14;   // 140ms bei AWR=0

function _applyDefenderMomentum(d, rawTx, rawTy, speed, dt) {
  const fromX = d.simX ?? d.x, fromY = d.simY ?? d.y;
  const dx = rawTx - fromX, dy = rawTy - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) {
    // Ziel erreicht — Velocity sanft auf 0 ziehen (damit Re-Start keine
    // Geister-Velocity erbt).
    if (d._smoothVelX !== undefined) {
      const decay = Math.min(1, dt * simSpeed / 0.10);
      d._smoothVelX += (0 - d._smoothVelX) * decay;
      d._smoothVelY += (0 - d._smoothVelY) * decay;
    }
    return { tx: fromX, ty: fromY };
  }

  const desX = dx / dist, desY = dy / dist;

  // 1) Acceleration ramp (mit ACC-Attribut)
  if (d._defAccMult === undefined) d._defAccMult = DEF_ACC_START_MULT;
  if (d._defAccMult < 1.0) {
    const acc = (typeof getAttr === 'function') ? getAttr(d, 'ACC') : 75;
    const accRate = DEF_ACC_BASE_RATE * (acc / 75);
    d._defAccMult = Math.min(1.0, d._defAccMult + dt * simSpeed * accRate);
  }

  // 2) Desired Velocity = Desired-Richtung * Speed * ACC-Ramp
  //    speed enthält bereits simSpeed (BASE_SPEED = simSpeed * SIM_BASE_SPEED).
  const targetSpd = speed * d._defAccMult;
  const desiredVelX = desX * targetSpd;
  const desiredVelY = desY * targetSpd;

  // 3) Low-Pass EMA auf Velocity-Vektor (E2).
  //    tau ist AWR-moduliert: besseres AWR → schnellere Reaktion.
  if (d._smoothVelX === undefined) { d._smoothVelX = 0; d._smoothVelY = 0; }
  const awr = (typeof getAttr === 'function') ? getAttr(d, 'AWR') : 75;
  const awrNorm = Math.max(0, Math.min(1, awr / 99));
  const tau = DEF_SMOOTH_TAU_MAX - (DEF_SMOOTH_TAU_MAX - DEF_SMOOTH_TAU_MIN) * awrNorm;
  const alpha = Math.min(1, (dt * simSpeed) / Math.max(0.001, tau));
  d._smoothVelX += (desiredVelX - d._smoothVelX) * alpha;
  d._smoothVelY += (desiredVelY - d._smoothVelY) * alpha;

  // 4) Schritt entlang der gesmootheten Velocity.
  //    speed/targetSpd skalieren mit simSpeed → velocity ist in px/sec bzgl.
  //    simSpeed-skaliertem dt; deshalb wird hier direkt mit dt multipliziert
  //    (nicht nochmal mit simSpeed).
  let stepX = d._smoothVelX * dt;
  let stepY = d._smoothVelY * dt;

  // Overshoot-Guard: Schritt nicht länger als Rest-Distanz zum Ziel.
  const stepLen = Math.hypot(stepX, stepY);
  if (stepLen > dist) {
    const scale = dist / stepLen;
    stepX *= scale;
    stepY *= scale;
  }
  return { tx: fromX + stepX, ty: fromY + stepY };
}

// Reset _defAccMult bei Assignment-Wechsel (nach Wurf, Switch, Pursuit-Trigger).
// Aufruf z.B. wenn d.decision.mode oder focusTargetId sich ändert.
function _resetDefAccOnAssignmentChange(d) {
  if (d._defAccMult !== undefined && d._defAccMult > DEF_ACC_CUT_RESET) {
    d._defAccMult = DEF_ACC_CUT_RESET;
  }
}

// ── Underneath-Zone Helpers (ZON-attribute driven) ──────────────────────
// Used by all underneath drop zones (FLAT, CURL, HOOK, HOOK_MIDDLE,
// CURL_FLAT, HOOK_CURL). Deep zones keep their existing single-target OTT.
//
// Two mechanics, both modulated by the defender's ZON attribute:
//
// 1) Split-Target: when ≥2 receivers are inside the zone, the defender
//    aims at a weighted midpoint between the top-2 by depth (lowest Y =
//    most upfield = "deeper"). Bias toward the deeper receiver scales
//    with ZON: ZON 99 → 85/15, ZON 50 → ~50/50, ZON 0 → 15/85 (mis-read).
//
// 2) Pre-Anticipation Drift: when zero receivers are inside the zone,
//    the defender predicts which external receivers will enter the zone
//    in `lookahead` seconds (ZON-scaled, 0..1.0s) and drifts a fraction
//    `driftFactor` (ZON-scaled, 0..0.5) from the landmark toward the
//    predicted entry point. Top-2 logic again if multiple inbound.

// Pure-midpoint between top-2 candidates with depth bias (deeper = lowest Y).
// Uses a velocity-based lookahead so the defender aims at where receivers WILL
// be in the near future, not where they currently are. Without lookahead, the
// defender chases current positions and gets beaten by vertical bait routes.
//
// candidates:   array of receiver player objects (already filtered to in-zone)
// ZON:          defender's ZON attribute (0-99). Drives lookahead horizon:
//               ZON 99 → 0.25s ahead, ZON 0 → no lookahead.
// lrState:      liveReadStateById (used for velocity)
// inZoneCheck:  optional predicate (rx,ry)→bool. If passed, candidates whose
//               PREDICTED position falls outside this zone are dropped from the
//               pool. Prevents Hook-Middle defender from chasing a vertical RB
//               that's about to leave the box.
// Returns { tx, ty } or null.
function _zoneSplitTarget(candidates, ZON, lrState, inZoneCheck) {
  if (!candidates || candidates.length === 0) return null;
  // Soft Drop gate: defender first commits to a real drop before reacting to
  // receivers. Without this the defender bites on shallow receivers and gets
  // beaten vertically (see "FREE (FLAT L)" CB drifting to flat WRs at snap).
  if (typeof playPhaseTime !== 'undefined' && playPhaseTime < SOFT_DROP_PHASE1_DELAY) return null;

  const z = Math.min(99, Math.max(0, ZON));
  const lookahead = (z / 99) * 0.25;  // 0..0.25 sec — ZON drives "how far ahead the defender reads"

  // Predicted position helper — falls back to current position if no velocity available
  function predict(p) {
    const rx = p.simX ?? p.x;
    const ry = p.simY ?? p.y;
    if (lookahead <= 0.01 || !lrState) return { x: rx, y: ry };
    const lr = lrState[p.id];
    if (!lr || !lr.vel) return { x: rx, y: ry };
    return { x: rx + lr.vel.x * lookahead, y: ry + lr.vel.y * lookahead };
  }

  // Build (player, predicted_position) pairs and drop those whose predicted
  // position falls outside the zone-check (if provided).
  let predicted = candidates.map(p => ({ p, pos: predict(p) }));
  if (inZoneCheck) {
    predicted = predicted.filter(c => inZoneCheck(c.pos.x, c.pos.y));
  }
  if (predicted.length === 0) return null;

  if (predicted.length === 1) {
    return { tx: predicted[0].pos.x, ty: predicted[0].pos.y };
  }
  // Sort by predicted depth: smallest predicted Y first = most upfield = "deeper"
  predicted.sort((a, b) => a.pos.y - b.pos.y);
  const deeper    = predicted[0];
  const shallower = predicted[1];
  // ZON 99 → 0.85, ZON 50 → ~0.50, ZON 0 → 0.15
  const biasDeeper    = 0.15 + (z / 99) * 0.70;
  const biasShallower = 1 - biasDeeper;
  return {
    tx: deeper.pos.x * biasDeeper + shallower.pos.x * biasShallower,
    ty: deeper.pos.y * biasDeeper + shallower.pos.y * biasShallower,
  };
}

// Pre-Anticipation Drift target.
// allReceivers: eligible receivers + RB (player objects)
// inZoneCheck: function(rx, ry) → boolean (zone-membership predicate)
// excludeIds: Set of receiver IDs already in the zone (skip these — they're handled elsewhere)
// fromX, fromY: defender's current position (currently unused, reserved for future scoring)
// lp: { x, y } landmark position
// ZON: defender's ZON attribute
// Returns { tx, ty } or null.
function _zoneAnticipationTarget(allReceivers, inZoneCheck, excludeIds, fromX, fromY, lp, ZON, lrState) {
  if (!allReceivers || allReceivers.length === 0) return null;
  // Soft Drop gate: defender first commits to a real drop before anticipating.
  // Without this, single-phase zones (FLAT, CURL, HOOK_MIDDLE) drift toward
  // shallow receivers from tick 1 and get vertically beaten.
  if (typeof playPhaseTime !== 'undefined' && playPhaseTime < SOFT_DROP_PHASE1_DELAY) return null;
  const z = Math.min(99, Math.max(0, ZON));
  const lookahead   = (z / 99) * 0.4;   // 0..0.4 sec
  const driftFactor = (z / 99) * 0.5;   // 0..0.5
  if (lookahead <= 0.05 || driftFactor <= 0.01) return null;

  const predicted = [];
  for (const p of allReceivers) {
    if (excludeIds && excludeIds.has(p.id)) continue;
    const lr = lrState ? lrState[p.id] : null;
    if (!lr || !lr.vel) continue;
    const rx = p.simX ?? p.x;
    const ry = p.simY ?? p.y;
    // Skip receivers already in the box — the in-zone path handles them
    if (inZoneCheck(rx, ry)) continue;
    // Predict position
    const px = rx + lr.vel.x * lookahead;
    const py = ry + lr.vel.y * lookahead;
    // Filter: predicted position must be inside the box
    if (!inZoneCheck(px, py)) continue;
    // Filter: velocity must point toward the landmark (else receiver is fleeing)
    const toLmX = lp.x - rx;
    const toLmY = lp.y - ry;
    const lmDist = Math.hypot(toLmX, toLmY);
    if (lmDist < 1) continue;
    const dot = (lr.vel.x * toLmX + lr.vel.y * toLmY) / lmDist;
    if (dot <= 0) continue;
    predicted.push({ px, py });
  }
  if (predicted.length === 0) return null;

  // Top-2 by predicted depth (lowest py = most upfield)
  predicted.sort((a, b) => a.py - b.py);
  const top = predicted.slice(0, 2);

  let entryX, entryY;
  if (top.length === 1) {
    entryX = top[0].px;
    entryY = top[0].py;
  } else {
    // Same depth-bias on predicted positions
    const biasDeeper    = 0.15 + (z / 99) * 0.70;
    const biasShallower = 1 - biasDeeper;
    entryX = top[0].px * biasDeeper + top[1].px * biasShallower;
    entryY = top[0].py * biasDeeper + top[1].py * biasShallower;
  }

  // Drift from landmark toward entry point by driftFactor
  return {
    tx: lp.x + (entryX - lp.x) * driftFactor,
    ty: lp.y + (entryY - lp.y) * driftFactor,
  };
}

// Soft Drop: Phase-1 anticipation is delayed by this many seconds so the
// defender first commits to a real drop. Without it, defenders abandon their
// drop too early and end up flat-footed under vertical routes.
const SOFT_DROP_PHASE1_DELAY = 0.5;

// Build the eligible receivers + RB pool used for anticipation.
// Pulls from offenseStructureSnapshot if available (consistent with preset code).
function _zoneAnticipationPool() {
  const snap = (typeof offenseStructureSnapshot !== 'undefined') ? offenseStructureSnapshot : null;
  if (!snap) return [];
  const elig = snap.eligiblePlayers || [];
  const rb   = snap.primaryBackfield;
  return rb ? [...elig, rb] : elig;
}

// Move defenders each tick during PlayPhase.
// Reads ONLY d.decision — d.assignment is never touched here.
// ALL modes (follow, drop, rush) check for blockers in path and stop in front.
function stepDefensePlayers(dt) {
  const BASE_SPEED = simSpeed * SIM_BASE_SPEED;  // matches offense baseSpeed exactly
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

    // Assignment-Wechsel erkennen → ACC-Reset (analog zu Route-Cut bei Offense)
    const decKey = (dec.mode || '') + ':' + (dec.focusTargetId ?? dec.focusLandmarkId ?? '');
    if (d._lastDecKey !== undefined && d._lastDecKey !== decKey) {
      _resetDefAccOnAssignmentChange(d);
      // Decision wechselt mid-play (z.B. match drop→follow) → Backpedal-Phase
      // gehört zum INITIAL coverage stance. Jeder rule-getriebene Wechsel
      // bedeutet: Defender soll angreifen, nicht backpedaln.
      d._backpedalDone = true;
    }
    d._lastDecKey = decKey;

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
    // SPD-Attribut moduliert beide (analog zu Offense via getMoveSpeed).
    const posRole  = classifyDefenderRole(d, ball.x, LOS_Y());
    const zoneMult = dec.mode === 'drop' ? (ZONE_SPEED[posRole] ?? 0.9) : (d.speedMultiplier || 1);
    const spdAttr  = (typeof getAttr === 'function') ? getAttr(d, 'SPD') : 75;
    let speed = BASE_SPEED * zoneMult * (spdAttr / 75);

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

      // ── CRE: Cut Reaction Freeze ──────────────────────────────────────
      // Receiver hat einen Cut gemacht → Defender ist kurz eingefroren.
      // Driftet in bisheriger Richtung (Körper-Momentum), statt sofort zu folgen.
      if (d._creFreezeTimer > 0) {
        d._creFreezeTimer = Math.max(0, d._creFreezeTimer - dt * simSpeed);
        const vx = d._velX ?? 0;
        const vy = d._velY ?? 0;
        const velSpd = Math.hypot(vx, vy);
        if (velSpd > 1) {
          const driftStep = speed * 0.25 * dt;
          d.simX = fromX + (vx / velSpd) * driftStep;
          d.simY = fromY + (vy / velSpd) * driftStep;
          pushOutBlockers(d);
        }
        return;
      }

      const tgtX = tgt.simX ?? tgt.x;
      const tgtY = tgt.simY ?? tgt.y;
      const trailPx = dec.trailPx || 0;

      // ── Backpedal-Phase (one-shot, nur am Play-Anfang) ────────────
      // Solange Target vertikal läuft UND Y-Gap > 1yd: Defender backpedalt
      // mit 50% Speed (Y rückwärts), spiegelt WR-X-Velocity mit bis zu 100%
      // Speed (preserved pre-snap X-offset). Sobald Bedingung einmal false
      // war, wird der Backpedal-Modus für diesen Defender für den Rest des
      // Plays gelockt (_backpedalDone = true). Reset bei nächstem Snap.
      const _bpYGap = Math.abs(fromY - tgtY);
      const _lrBP   = liveReadStateById ? liveReadStateById[tgt.id] : null;
      const _bpVert = _lrBP?.moveType === 'vertical';
      if (!d._backpedalDone && _bpVert && _bpYGap > YARD_PX) {
        // CB: spiegelt WR-X-Velocity (preserved pre-snap offset), Cap 100% speed
        // SAF/HOOK/APEX: läuft Richtung WR-X mit 50% speed (closes lateral gap)
        const _bpIsRetreat = covRole.startsWith('SAF') || covRole.startsWith('HOOK') || covRole.startsWith('APEX');
        let _latStep;
        if (_bpIsRetreat) {
          const _dx = tgtX - fromX;
          const _maxSlowStep = speed * 0.5 * dt;
          _latStep = Math.sign(_dx) * Math.min(Math.abs(_dx), _maxSlowStep);
        } else {
          const _wrVx = _lrBP?.vel?.x ?? 0;
          const _maxStep = speed * dt;
          _latStep = _wrVx * dt;
          if (Math.abs(_latStep) > _maxStep) _latStep = Math.sign(_latStep) * _maxStep;
        }
        const _backStep = speed * 0.5 * dt;
        d.simX = fromX + _latStep;
        d.simY = fromY - _backStep;
        pushOutBlockers(d);
        return;
      }
      // Bedingung hier erstmals false → Backpedal lock für rest of play
      d._backpedalDone = true;

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
        const aimDM = _applyDefenderMomentum(d, txDM, tyDM, speed, dt);
        d.simX = aimDM.tx; d.simY = aimDM.ty;
        pushOutBlockers(d);
        return;
      }

      // ── Intercept prediction ──────────────────────────────────────────
      // Closure-Speed-basiert: subtrahiere die Komponente der WR-Velocity
      // entlang des Defender→WR-Vektors. Defender, der WR von hinten verfolgt,
      // hat geringere Closing-Speed → größerer Vorhalt. Defender, der WR
      // entgegenkommt → kürzerer Vorhalt.
      // simSpeed ist bereits in `speed` enthalten (BASE_SPEED = simSpeed*80) —
      // hier KEIN zusätzliches simSpeed multiplizieren.
      const lr = liveReadStateById ? liveReadStateById[tgt.id] : null;
      let interceptX = tgtX;
      let interceptY = tgtY;

      // ── AWR-basierte Velocity-Wahrnehmung ──────────────────────────
      // Defender "sieht" die WR-Velocity mit Verzögerung, statt zero-lag
      // direkt aus lr.vel zu lesen. AWR=99 → ~100ms Lag, AWR=0 → ~400ms.
      // So reagiert der Defender auf Cuts natürlich verspätet, ohne
      // permanente Körper-Steifheit.
      let percVelX = 0, percVelY = 0;
      if (lr && lr.vel) {
        const awrPV   = (typeof getAttr === 'function') ? getAttr(d, 'AWR') : 75;
        const velLag  = 0.10 + (1 - Math.min(1, awrPV / 99)) * 0.30;  // 100..400ms
        if (d._percVelX === undefined) { d._percVelX = lr.vel.x; d._percVelY = lr.vel.y; }
        const blend = Math.min(1, (dt * simSpeed) / Math.max(0.01, velLag));
        d._percVelX += (lr.vel.x - d._percVelX) * blend;
        d._percVelY += (lr.vel.y - d._percVelY) * blend;
        percVelX = d._percVelX;
        percVelY = d._percVelY;
      }

      // WR-Speed (von der WAHRGENOMMENEN Velocity) → Lookahead-Gewicht.
      // Stehender/langsamer WR = kein Vorhalt, verhindert Overshoot am Routen-Ende.
      const recSpd = Math.hypot(percVelX, percVelY);
      const WR_STILL_THR = 20;   // px/s — unterhalb gilt WR als stehend
      const WR_FULL_THR  = 60;   // px/s — ab hier voller Vorhalt
      const lookaheadWeight = recSpd <= WR_STILL_THR ? 0
                             : recSpd >= WR_FULL_THR  ? 1
                             : (recSpd - WR_STILL_THR) / (WR_FULL_THR - WR_STILL_THR);
      // Max Lookahead 0.5s statt 1.2s — Defender ist kein Hellseher mehr.
      const MAX_LOOKAHEAD_SEC = 0.5;
      if (lookaheadWeight > 0) {
        const dx0 = tgtX - fromX, dy0 = tgtY - fromY;
        const dist = Math.hypot(dx0, dy0);
        if (speed > 0 && dist > 0.1) {
          const nx = dx0 / dist, ny = dy0 / dist;
          const closingSpeed = Math.max(speed * 0.5,
            speed - (percVelX * nx + percVelY * ny));
          const t = Math.min(dist / closingSpeed, MAX_LOOKAHEAD_SEC) * lookaheadWeight;
          interceptX = tgtX + percVelX * t;
          interceptY = tgtY + percVelY * t;
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
      // Skaliert mit WR-Speed: stehender WR → kein Offset (kein Overshooting).
      const isVertical = lr && (lr.isVerticalThreatNow || lr.moveType === 'vertical');
      if (isVertical && lookaheadWeight > 0) {
        const ottBase = (covRole === 'CB' || covRole === 'SAF_W' || covRole === 'SAF_S') ? 2 * YARD_PX
                      : (covRole === 'APEX-L' || covRole === 'APEX-R')                   ? 1.5 * YARD_PX
                      : 1 * YARD_PX; // HOOK or anything else
        const ottOffset = ottBase * lookaheadWeight;
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
          // Move to curl point — but if ZON allows anticipation, drift toward incoming threat
          const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
          if (distToCurl <= DEF_ARRIVE_THR) {
            d.simZonePhase = 2; // curl reached — now slide to flat
          }
          rawTx = curlLm.x; rawTy = curlLm.y;
          // Soft Drop: high-ZON defenders look for incoming threats during the drop —
          // but only after a minimum delay so they commit to a real drop first.
          if (playPhaseTime >= SOFT_DROP_PHASE1_DELAY) {
            const ZON_p1CF = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
            const flatZoneIdP1 = isLeft ? 'FLAT_L' : 'FLAT_R';
            const inZoneCheckP1CF = (rx, ry) => isInZoneBounds(flatZoneIdP1, rx, ry, flatLm);
            const antP1CF = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckP1CF, null, fromX, fromY, flatLm, ZON_p1CF, liveReadStateById);
            if (antP1CF) {
              rawTx = antP1CF.tx; rawTy = antP1CF.ty;
              d.simZonePhase = 2; // anticipation kicks in → smart defender skips spot drop
            }
          }
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
          // Split-Target (ZON-modulated) — top-2 by depth, bias to deeper
          const uncoveredCF = candidatesCF.filter(c => !coveredIdsCF.has(c.p.id));
          const poolCF = (uncoveredCF.length > 0 ? uncoveredCF : candidatesCF).map(c => c.p);
          const ZON_CF = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
          const flatZoneId = isLeft ? 'FLAT_L' : 'FLAT_R';
          const inZoneCheckCF = (rx, ry) => isInZoneBounds(flatZoneId, rx, ry, flatLm);
          const splitCF = _zoneSplitTarget(poolCF, ZON_CF, liveReadStateById, inZoneCheckCF);
          if (splitCF) {
            rawTx = splitCF.tx; rawTy = splitCF.ty;
          } else {
            // Empty zone → Pre-Anticipation Drift, else hold landmark
            const antCF = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckCF, null, fromX, fromY, flatLm, ZON_CF, liveReadStateById);
            if (antCF) {
              rawTx = antCF.tx; rawTy = antCF.ty;
            } else {
              const distToFlat = Math.hypot(fromX - flatLm.x, fromY - flatLm.y);
              if (distToFlat <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
              rawTx = flatLm.x; rawTy = flatLm.y;
            }
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
        // Split-Target (ZON-modulated)
        const uncoveredMid = midCandidates.filter(c => !coveredIdsHM.has(c.p.id));
        const poolMid = (uncoveredMid.length > 0 ? uncoveredMid : midCandidates).map(c => c.p);
        const ZON_HM = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
        const inZoneCheckHM = (rx, ry) => isInZoneBounds('HOOK_MIDDLE', rx, ry, hookLmPos);
        const splitMid = _zoneSplitTarget(poolMid, ZON_HM, liveReadStateById, inZoneCheckHM);
        if (splitMid) {
          rawTx = splitMid.tx; rawTy = splitMid.ty;
        } else {
          // Empty zone → Pre-Anticipation Drift (also active during Phase 1 = Soft Drop)
          const antHM = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckHM, null, fromX, fromY, hookLmPos, ZON_HM, liveReadStateById);
          if (antHM) {
            rawTx = antHM.tx; rawTy = antHM.ty;
          } else {
            rawTx = hookLmPos.x; rawTy = hookLmPos.y;
          }
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
          // Soft Drop: ZON-driven anticipation during drop, gated by min delay
          if (playPhaseTime >= SOFT_DROP_PHASE1_DELAY) {
            const ZON_p1HS = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
            const curlSideIdP1 = lmId === 'HOOK_L' ? 'CURL_L' : 'CURL_R';
            const inZoneCheckP1HS = (rx, ry) =>
              isInZoneBounds(lmId, rx, ry, hookLm) || isInZoneBounds(curlSideIdP1, rx, ry);
            const antP1HS = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckP1HS, null, fromX, fromY, hookLm, ZON_p1HS, liveReadStateById);
            if (antP1HS) {
              rawTx = antP1HS.tx; rawTy = antP1HS.ty;
              d.simZonePhase = 2;
            }
          }
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
          // Split-Target (ZON-modulated)
          const uncoveredHS = candidatesHS.filter(c => !coveredIdsHS.has(c.p.id));
          const poolHS = (uncoveredHS.length > 0 ? uncoveredHS : candidatesHS).map(c => c.p);
          const ZON_HS = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
          const inZoneCheckHS = (rx, ry) =>
            isInZoneBounds(lmId, rx, ry, hookSideLmPos) || isInZoneBounds(curlSideId, rx, ry);
          const splitHS = _zoneSplitTarget(poolHS, ZON_HS, liveReadStateById, inZoneCheckHS);
          if (splitHS) {
            rawTx = splitHS.tx; rawTy = splitHS.ty;
          } else {
            // Empty → Pre-Anticipation Drift, else hold curl point
            const antHS = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckHS, null, fromX, fromY, curlLm, ZON_HS, liveReadStateById);
            if (antHS) {
              rawTx = antHS.tx; rawTy = antHS.ty;
            } else {
              const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
              if (distToCurl <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
              rawTx = curlLm.x; rawTy = curlLm.y;
            }
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
          // Soft Drop: ZON-driven anticipation during drop, gated by min delay
          if (playPhaseTime >= SOFT_DROP_PHASE1_DELAY) {
            const ZON_p1HC = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
            const curlHCIdP1 = lmId === 'HOOK_CURL_L' ? 'CURL_L' : 'CURL_R';
            const inZoneCheckP1HC = (rx, ry) =>
              isInZoneBounds(lmId, rx, ry, hookLm) || isInZoneBounds(curlHCIdP1, rx, ry);
            const antP1HC = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckP1HC, null, fromX, fromY, hookLm, ZON_p1HC, liveReadStateById);
            if (antP1HC) {
              rawTx = antP1HC.tx; rawTy = antP1HC.ty;
              d.simZonePhase = 2;
            }
          }
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
          // Split-Target (ZON-modulated)
          const uncoveredHC = candidatesHC.filter(c => !coveredIdsHC.has(c.p.id));
          const poolHC = (uncoveredHC.length > 0 ? uncoveredHC : candidatesHC).map(c => c.p);
          const ZON_HC = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
          const inZoneCheckHC = (rx, ry) =>
            isInZoneBounds(lmId, rx, ry, hookCurlLmPos) || isInZoneBounds(curlHCId, rx, ry);
          const splitHC = _zoneSplitTarget(poolHC, ZON_HC, liveReadStateById, inZoneCheckHC);
          if (splitHC) {
            rawTx = splitHC.tx; rawTy = splitHC.ty;
          } else {
            // Empty → Pre-Anticipation Drift, else hold curl point
            const antHC = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckHC, null, fromX, fromY, curlLm, ZON_HC, liveReadStateById);
            if (antHC) {
              rawTx = antHC.tx; rawTy = antHC.ty;
            } else {
              const distToCurl = Math.hypot(fromX - curlLm.x, fromY - curlLm.y);
              if (distToCurl <= DEF_ARRIVE_THR) { d.simZoneDone = true; return; }
              rawTx = curlLm.x; rawTy = curlLm.y;
            }
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
        // NEW: underneath FLAT/CURL handle their own rawTx/Ty (Split-Target + Anticipation)
        // and set this flag so the central single-target/landmark fallback below is skipped.
        let zoneSelfHandled = false;
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
          // Split-Target (ZON-modulated) — underneath self-handles rawTx/Ty
          const uncoveredFL = candidatesFL.filter(c => !coveredIdsFL.has(c.p.id));
          const poolFL = (uncoveredFL.length > 0 ? uncoveredFL : candidatesFL).map(c => c.p);
          const ZON_FL = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
          const inZoneCheckFL = (rx, ry) => isInZoneBounds(lmId, rx, ry, flatLmPosFL);
          const splitFL = _zoneSplitTarget(poolFL, ZON_FL, liveReadStateById, inZoneCheckFL);
          if (splitFL) {
            rawTx = splitFL.tx; rawTy = splitFL.ty;
            zoneSelfHandled = true;
          } else {
            // Empty zone → Pre-Anticipation Drift
            const antFL = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckFL, null, fromX, fromY, flatLmPosFL, ZON_FL, liveReadStateById);
            if (antFL) {
              rawTx = antFL.tx; rawTy = antFL.ty;
              zoneSelfHandled = true;
            }
            // else: fall through to "no receiver" landmark fallback below
          }
          nearbyReceiver = null;

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
          // Split-Target (ZON-modulated) — underneath self-handles rawTx/Ty
          const uncoveredCURL = candidatesCURL.filter(c => !coveredIdsCURL.has(c.p.id));
          const poolCURL = (uncoveredCURL.length > 0 ? uncoveredCURL : candidatesCURL).map(c => c.p);
          const ZON_CURL = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
          const inZoneCheckCURL = (rx, ry) => isInZoneBounds(lmId, rx, ry, curlLmPos);
          const splitCURL = _zoneSplitTarget(poolCURL, ZON_CURL, liveReadStateById, inZoneCheckCURL);
          if (splitCURL) {
            rawTx = splitCURL.tx; rawTy = splitCURL.ty;
            zoneSelfHandled = true;
          } else {
            // Empty zone → Pre-Anticipation Drift
            const antCURL = _zoneAnticipationTarget(_zoneAnticipationPool(), inZoneCheckCURL, null, fromX, fromY, curlLmPos, ZON_CURL, liveReadStateById);
            if (antCURL) {
              rawTx = antCURL.tx; rawTy = antCURL.ty;
              zoneSelfHandled = true;
            }
            // else: fall through to landmark fallback below
          }
          nearbyReceiver = null;

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

        if (zoneSelfHandled) {
          // FLAT/CURL already set rawTx/Ty via Split-Target or Anticipation — nothing to do.
        } else if (nearbyReceiver) {
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
              // Soft Zone-Pull: graduate by angle, modulated by ZON.
              // Old behavior was a hard 10° cliff (skinny posts disengaged the pull).
              // Now: angle-based strength (0° = full, 60°+ = none), and ZON blends
              // between hard-cliff (low ZON) and gradient (high ZON).
              const ptsS    = rec.simRoutePoints ?? [];
              const wpIdxS  = rec.simWpIdx ?? 0;
              const nextWpS = ptsS[wpIdxS] ?? null;
              const movDxS  = nextWpS ? nextWpS.x - recX : 0;
              const movDyS  = nextWpS ? nextWpS.y - recY : 0;

              // Angle-based pull strength: pure vertical = 1.0, 30° ≈ 0.5, 60°+ = 0.
              // Gradient is only applied for receivers moving upfield (movDyS < 0).
              let anglePull = 0;
              if (nextWpS && movDyS < 0) {
                const ratio = Math.abs(movDxS) / Math.max(0.01, Math.abs(movDyS));
                // ratio 0 → 1.0, ratio 1.732 (60°) → 0
                anglePull = Math.max(0, Math.min(1, 1 - ratio / 1.732));
              }

              // Hard-cliff equivalent (legacy 10° check)
              const hardCliffPull = (nextWpS && movDyS < 0 && Math.abs(movDxS) < Math.abs(movDyS) * 0.176) ? 1 : 0;

              // ZON blends: 0 → pure hard-cliff, 99 → pure gradient
              const ZON_pull = (typeof getAttr === 'function') ? getAttr(d, 'ZON') : 75;
              const zNorm = Math.min(99, Math.max(0, ZON_pull)) / 99;
              const pullStrength = hardCliffPull * (1 - zNorm) + anglePull * zNorm;

              if (pullStrength > 0.01) {
                // Zone pull: blend toward landmark based on how far defender is from home,
                // scaled by pullStrength (angle/ZON-modulated).
                const ZONE_PULL_START = 2 * YARD_PX;
                const ZONE_PULL_FULL  = 6 * YARD_PX;
                const defDistFromLandmark = Math.hypot(fromX - lp.x, fromY - lp.y);
                const distPull = Math.min(1, Math.max(0,
                  (defDistFromLandmark - ZONE_PULL_START) / (ZONE_PULL_FULL - ZONE_PULL_START)
                ));
                const finalPull = distPull * pullStrength;
                rawTx = recX + (lp.x - recX) * finalPull;
                rawTy = recY + (lp.y - recY) * finalPull;
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

      // Soft Drop: speed-decay near landmark for underneath zones (smoother arrival, less robotic)
      const _UNDERNEATH_LMS = new Set([
        'FLAT_L','FLAT_R','CURL_L','CURL_R',
        'HOOK_L','HOOK_R','HOOK_MIDDLE',
        'CURL_FLAT_L','CURL_FLAT_R','HOOK_CURL_L','HOOK_CURL_R'
      ]);
      if (lmId && _UNDERNEATH_LMS.has(lmId)) {
        const _lp = getLandmarkPos(lmId);
        const _distToLm = Math.hypot(fromX - _lp.x, fromY - _lp.y);
        const _DECAY_RADIUS = 4 * YARD_PX;
        if (_distToLm < _DECAY_RADIUS) {
          // 0.6× speed at landmark, 1.0× at edge of decay radius
          const _decay = 0.6 + 0.4 * (_distToLm / _DECAY_RADIUS);
          speed *= _decay;
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

    // Move toward (tx, ty) mit Trägheit (Turn-Rate) und Beschleunigung
    const aim = _applyDefenderMomentum(d, tx, ty, speed, dt);
    d.simX = aim.tx; d.simY = aim.ty;

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
  const slideSpeed = simSpeed * SIM_BASE_SPEED * DEF_SLIDE_SPEED_FACTOR;

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
  saveUndoSnapshot();
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
  const spd = getMoveSpeed(carrier, baseSpeed) * RUN_CARRIER_SPEED_MULT;
  if (carrier.simRoutePoints && carrier.simRoutePoints.length > 0) {
    if (stepPlayer(carrier, carrier.simRoutePoints, dt, spd)) carrier.simDone = true;
  }
}

// ── Sim: step defenders with run fit logic ────────────────────────
function stepDefenseRunFit(dt) {
  const BASE_SPEED = simSpeed * SIM_BASE_SPEED;
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

  // Helper: TRUE interception point (fixed meeting point, NOT a per-frame
  // lead). A per-frame "lead by X seconds" makes the defender chase a point
  // that slides forward every frame → he runs a curve and always ends up
  // BEHIND (dog-chasing-rabbit). Instead we solve for the exact spot where
  // the two paths MEET and aim straight there, so the defender arrives IN
  // FRONT and cuts him off. The catch-up speed guarantees defSpeed ≥ carrier
  // speed, so a forward meeting point always exists.
  //
  //   Carrier path: C(t) = C0 + Vc*t.  Meet when |C(t) - D| = s*t  →
  //     (|Vc|² - s²) t² + 2(P·Vc) t + |P|² = 0,   P = C0 - D,  s = defSpeed
  //   Smallest positive root t* → earliest meeting time; aim at C(t*).
  //
  //   ⚙️  Fallback lead (only used if defender is somehow slower & no
  //       solution exists). MAX_INTERCEPT_SEC caps absurd projections.
  const PURSUIT_LEAD_SEC   = 1.0;
  const MAX_INTERCEPT_SEC  = 2.5;
  const RUN_LEVERAGE_PX    = YARD_PX * 0.75; // outside/inside leverage offset
  function carrierInterceptPoint(fromX, fromY, defSpeed, defender) {
    if (!carrier || carrier._velX === undefined || runHandoffState !== 'carrying') {
      return { x: carrierX, y: carrierY };
    }
    const vx = carrier._velX ?? 0, vy = carrier._velY ?? 0;
    const carrierSpd = Math.hypot(vx, vy);
    if (carrierSpd < 5 || !(defSpeed > 0)) return { x: carrierX, y: carrierY };

    const px = carrierX - fromX, py = carrierY - fromY;
    const a = carrierSpd * carrierSpd - defSpeed * defSpeed;
    const b = 2 * (px * vx + py * vy);
    const c = px * px + py * py;

    let t = -1;
    if (Math.abs(a) < 1e-3) {
      if (b < -1e-6) t = -c / b;                 // equal speed → linear case
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        const cands = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]
          .filter(v => v > 1e-4).sort((m, n) => m - n);
        if (cands.length) t = cands[0];
      }
    }
    if (!(t > 0) || !isFinite(t)) t = PURSUIT_LEAD_SEC; // no solution → lead
    t = Math.min(t, MAX_INTERCEPT_SEC);

    const ix = carrierX + vx * t, iy = carrierY + vy * t;
    if (!isFinite(ix) || !isFinite(iy)) return { x: carrierX, y: carrierY };
    return { x: ix, y: iy };
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

  // ── Flow Read module (toggle: flowReadActive) ─────────────────────
  // All inert unless flowReadActive is ON → toggle OFF reproduces the
  // exact static gap behavior. Determine play flow direction and pick the
  // single backside-most LB to hold the cutback lane.
  let flowDir = 0;            // -1 = flow left, +1 = flow right, 0 = undeclared
  let cutbackDefId = null;    // backside-most LB who holds the cutback
  const FLOW_VX_THRESHOLD = 25; // px/s — lateral flow must be this clear to "declare"
  if (flowReadActive && carrier && runHandoffState === 'carrying') {
    // Latch flow direction + cutback defender for the whole carry, so they
    // don't flip when the RB later cuts upfield and his vx drops to ~0.
    if (!carrier._playFlowDir) {
      const vx = carrier._velX ?? 0;
      if (Math.abs(vx) > FLOW_VX_THRESHOLD) carrier._playFlowDir = vx < 0 ? -1 : 1;
    }
    flowDir = carrier._playFlowDir || 0;
    if (flowDir !== 0) {
      if (carrier._cutbackDefId == null) {
        const pool = defensePlayers.filter(pd => {
          const r = pd.role.toUpperCase();
          if (['DT','NT','DE','CB'].includes(r)) return false; // not DL, not boundary CB
          const a = (pd.runAssignment && pd.runAssignment.type !== 'none') ? pd.runAssignment : pd.assignment;
          return a && (a.type === 'gap' || a.type === 'none' || a.type === 'pursuit');
        }).sort((a, b) => (a.simX ?? a.x) - (b.simX ?? b.x));
        if (pool.length > 0) carrier._cutbackDefId = flowDir < 0 ? pool[pool.length - 1].id : pool[0].id;
      }
      cutbackDefId = carrier._cutbackDefId;
    }
  } else if (carrier) {
    carrier._playFlowDir = 0;      // reset latch before the carry begins
    carrier._cutbackDefId = null;
  }

  // Flow-read fit target for a non-DL gap defender; returns null → caller
  // falls back to the static gapThenThrough behavior.
  //   FLOW_LOOKAHEAD_SEC  — lateral lead while flowing (→ better angle on upcut)
  //   UPFIELD_TRIGGER_PXS — how clearly the RB must turn upfield to commit
  const FLOW_LOOKAHEAD_SEC  = 0.5;
  const UPFIELD_TRIGGER_PXS = 30;
  const FLOW_DEPTH_YD       = 2.0; // cushion off the LOS the LB presses to while flowing
  function flowReadTarget(fd, fromX, fromY, gapId, defSpeed) {
    if (flowDir === 0) return null;
    const gapX = lockedGapX[gapId] ?? (ball.x + (GAP_OFFSETS_PX[gapId] ?? 0));

    // Backside-most defender → cutback discipline: hold the backside gap,
    // only trigger to the carrier if he cuts back or crosses the LOS.
    if (fd.id === cutbackDefId) {
      const carrierCutBack = flowDir < 0 ? (carrierX > ball.x) : (carrierX < ball.x);
      if (carrierCutBack || carrierPastLOS) {
        const ip = carrierInterceptPoint(fromX, fromY, defSpeed, fd);
        return { tx: ip.x, ty: ip.y, cap: false };
      }
      return { tx: gapX, ty: LOS_Y(), cap: true }; // plug the backside gap
    }

    // Frontside: flow over the top, then ATTACK. Triggers (any, latched):
    //   • upfield intent (RB velocity toward the LOS),
    //   • RB already past the LOS,
    //   • FIT ACHIEVED — the LB has closed his depth to the 2yd cushion, i.e.
    //     he's in leverage position. No point mirroring alongside forever, so
    //     he commits to the intercept and makes the play.
    const upfieldIntent = (carrier && carrier._velY !== undefined)
      ? (carrier._velY < -UPFIELD_TRIGGER_PXS) : false;
    const fitAchieved = (carrierY - fromY) <= (FLOW_DEPTH_YD + 0.5) * YARD_PX;
    if (fd._flowTriggered || upfieldIntent || carrierPastLOS || fitAchieved) {
      fd._flowTriggered = true;
      const ip = carrierInterceptPoint(fromX, fromY, defSpeed, fd);
      return { tx: ip.x, ty: ip.y, cap: false };
    }
    // Flow phase: shuffle laterally to the RB's 0.5s-predicted X, and hold
    // depth 2yd in FRONT of the RB (defense side = smaller Y) — tracked
    // directly off the RB, no LOS reference. As the RB's depth changes the
    // LB mirrors it 2yd ahead, so he gets real Y movement instead of gliding.
    const predX = carrierX + (carrier._velX ?? 0) * FLOW_LOOKAHEAD_SEC;
    const ty = carrierY - FLOW_DEPTH_YD * YARD_PX;
    return { tx: predX, ty, cap: true };
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

    // Velocity-Tracking (EMA) für Turn-Rate im Momentum-Helper
    const EMA_RF = 0.3;
    if (d._prevSimX !== undefined && dt > 0) {
      const rawVx = (fromX - d._prevSimX) / dt;
      const rawVy = (fromY - d._prevSimY) / dt;
      d._velX = d._velX !== undefined ? d._velX * (1 - EMA_RF) + rawVx * EMA_RF : rawVx;
      d._velY = d._velY !== undefined ? d._velY * (1 - EMA_RF) + rawVy * EMA_RF : rawVy;
    }
    d._prevSimX = fromX;
    d._prevSimY = fromY;

    // Assignment-Wechsel erkennen → ACC-Reset
    const decKey = (asg.type || 'none') + ':' + (asg.gapId ?? '');
    if (d._lastDecKey !== undefined && d._lastDecKey !== decKey) {
      _resetDefAccOnAssignmentChange(d);
    }
    d._lastDecKey = decKey;

    let speedMult;
    if (isDL)       speedMult = DL_SPEED[role] ?? 0.55;
    else if (isCBS) speedMult = DB_SPEED;
    else            speedMult = LB_SPEED;
    speedMult *= (d.speedMultiplier || 1.0);
    // SPD-Attribut moduliert (analog Schicht 0)
    const spdAttrRF = (typeof getAttr === 'function') ? getAttr(d, 'SPD') : 75;
    const speed = BASE_SPEED * speedMult * (spdAttrRF / 75);
    const step = speed * dt;

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
      if (dist > 4) {
        const aim = _applyDefenderMomentum(d, tx, ty, speed, dt);
        d.simX = aim.tx; d.simY = aim.ty;
      }
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
        const pred = carrierInterceptPoint(fromX, fromY, speed, d);
        tx = pred.x; ty = pred.y;
      }
      const dx = tx-fromX, dy = ty-fromY, dist = Math.hypot(dx,dy);
      if (dist > 4) {
        const aim = _applyDefenderMomentum(d, tx, ty, speed, dt);
        d.simX = aim.tx; d.simY = aim.ty;
      }
      return;
    }

    // ── LBs / DBs with explicit assignment ────────────────────────
    if (asg && asg.type === 'gap' && asg.gapId) {
      filledGaps.add(asg.gapId);
      const fr = (flowReadActive && !isDL) ? flowReadTarget(d, fromX, fromY, asg.gapId, speed) : null;
      if (fr) {
        tx = fr.tx; ty = fr.ty; useBlockerCap = fr.cap;
        if (useBlockerCap) { const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty; }
      } else {
        const r = gapThenThrough(asg.gapId);
        useBlockerCap = r.cap;
        if (!r.cap) {
          // Through-phase: pursue the carrier on a proper intercept angle.
          const ip = carrierInterceptPoint(fromX, fromY, speed, d);
          tx = ip.x; ty = ip.y;
        } else {
          tx = r.tx; ty = r.ty;
          const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;
        }
      }

    } else if (asg && asg.type === 'contain') {
      // Force/edge: aim at the INTERCEPT point with OUTSIDE leverage (a touch
      // to the sideline side), so the defender keeps outside leverage and
      // forces the runner back inside — never chasing his current spot.
      const distToCarrier = Math.hypot(fromX - carrierX, fromY - carrierY);
      if (distToCarrier <= YARD_PX) {
        tx = carrierX; ty = carrierY; // close enough → make the tackle
      } else {
        const ip   = carrierInterceptPoint(fromX, fromY, speed, d);
        const side = carrierX <= ball.x ? -1 : 1; // which side the run is on
        tx = ip.x + side * RUN_LEVERAGE_PX; ty = ip.y;
      }

    } else if (asg && asg.type === 'spill') {
      // Spill: intercept point with INSIDE leverage — force the runner back
      // outside (into pursuit / the force defender).
      const ip   = carrierInterceptPoint(fromX, fromY, speed, d);
      const side = carrierX <= ball.x ? -1 : 1;
      tx = ip.x - side * RUN_LEVERAGE_PX; ty = ip.y;
      const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;

    } else if (asg && asg.type === 'rush') {
      const ip = carrierInterceptPoint(fromX, fromY, speed, d);
      tx = ip.x; ty = ip.y;
      const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;

    } else if (asg && asg.type === 'pursuit') {
      // Pursuit: true intercept point, no blocker cap (pursue around blocks).
      const pred = carrierInterceptPoint(fromX, fromY, speed, d);
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
        const fr = (flowReadActive && !isDL) ? flowReadTarget(d, fromX, fromY, lockedGap, speed) : null;
        if (fr) {
          tx = fr.tx; ty = fr.ty; useBlockerCap = fr.cap;
          if (useBlockerCap) { const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty; }
        } else {
          const r = gapThenThrough(lockedGap);
          useBlockerCap = r.cap;
          if (!r.cap) {
            const ip = carrierInterceptPoint(fromX, fromY, speed, d);
            tx = ip.x; ty = ip.y;
          } else {
            tx = r.tx; ty = r.ty;
            const c = runBlockerCap(fromX, fromY, tx, ty, blockers); tx = c.tx; ty = c.ty;
          }
        }
      } else {
        // Truly nothing available → pursuit on a proper intercept angle
        const ip = carrierInterceptPoint(fromX, fromY, speed, d);
        tx = ip.x; ty = ip.y;
      }
    }

    const dx = tx-fromX, dy = ty-fromY, dist = Math.hypot(dx,dy);
    if (dist > 4) {
      const aim = _applyDefenderMomentum(d, tx, ty, speed, dt);
      d.simX = aim.tx; d.simY = aim.ty;
    }
    resolveBlockerOverlap(d, blockers);
  });
}

function toggleIllegalFormationRules() {
  illegalFormationRulesOn = !illegalFormationRulesOn;
  const btn = document.getElementById('illegalFormationBtn');
  if (!btn) return;
  if (illegalFormationRulesOn) {
    btn.textContent = 'Illegal Formation: ON';
    btn.style.color = '#f87171';
    btn.style.borderColor = 'rgba(248,113,113,0.4)';
    btn.style.background = 'rgba(248,113,113,0.12)';
    btn.style.opacity = '1';
  } else {
    btn.textContent = 'Illegal Formation: OFF';
    btn.style.color = '#fff';
    btn.style.borderColor = '';
    btn.style.background = '';
    btn.style.opacity = '0.5';
  }
}

function toggleQBNeverThrow() {
  qbNeverThrow = !qbNeverThrow;
  const btn = document.getElementById('qbNeverThrowBtn');
  if (!btn) return;
  if (!qbNeverThrow) {
    // QB throws ON
    btn.textContent = 'QB throws: ON';
    btn.style.color = '#60e080';
    btn.style.borderColor = 'rgba(96,224,128,0.4)';
    btn.style.background = 'rgba(96,224,128,0.12)';
  } else {
    // QB throws OFF
    btn.textContent = 'QB throws: OFF';
    btn.style.color = '#fff';
    btn.style.borderColor = '';
    btn.style.background = '';
  }
}

