// ── PRESET REGISTRY PART C: Side-Only Coverages ─────────────────────
// Sky-strong/weak, MEG, C2M, Cover5, Palms, Bracket, MES, Quarters
// Merged into PRESET_REGISTRY in 07d_presets_fullfield.js

const _PR_SIDE = {
  // ── Cover 3 Sky — Strong Side (Side-Only) ────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook (all HOOKs)
  // Paired with cover3-sky-weak for full coverage.
  // persistentCovCalls prefix: sky_  (shared with weak side — same coverage)
  'cover3-sky-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS      = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const rb       = snapshot.primaryBackfield || null;
        const r2w      = rec(weakSide, 2);

        switch (role) {
          case 'RUSH':  result.set(id, rushDec()); break;
          case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) {
              const r1s = rec(strongSide, 1);
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS));
            }
            break;
          case 'SAF_S': {
            const r2s = rec(strongSide, 2);
            result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS));
            break;
          }
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong) result.set(id, zoneDrop(hookS));
            break;
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isVerticalRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        const allReceivers = rb ? [...eligible, rb] : eligible;
        const nearest = allReceivers
          .filter(p => !defensePlayers.some(def =>
            def.id !== defender.id && def.decision?.focusTargetId === p.id
          ))
          .sort((a, b) => {
            const dA = Math.hypot((a.simX??a.x) - dx, (a.simY??a.y) - dy);
            const dB = Math.hypot((b.simX??b.x) - dx, (b.simY??b.y) - dy);
            return dA - dB;
          })[0];
        return nearest ? manCover(nearest.id, YARD_PX) : null;
      }

      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.sky_underFromStrong = true;
          return zoneDrop(deepS);
        }
        if (r1s && isHitch(r1s)) {
          persistentCovCalls.sky_smashStrong = true;
          return zoneDrop(deepS);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
      }

      // ── b. Strong Safety ────────────────────────────────────────────
      if (role === 'SAF_S') {
        if (persistentCovCalls.sky_smashStrong)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.sky_underFromStrong = true;
          return zoneToManConvert(d, curlFlatS) || zoneDrop(curlFlatS);
        }
        if (persistentCovCalls.sky_pushStrong)
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
      }

      // ── c. Strong Apex ───────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (persistentCovCalls.sky_pushStrong === undefined && rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingStrong && !canReach(d, rb) && r2s && canReach(d, r2s)) {
            persistentCovCalls.sky_pushStrong = true;
            return manCover(r2s.id, YARD_PX);
          }
        }
        if (persistentCovCalls.sky_pushStrong)
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
        if (persistentCovCalls.sky_underFromWeak) {
          const crosser = [r1w, r2w].find(p => p && isUnder(p));
          if (crosser) return manCover(crosser.id, YARD_PX);
        }
        const r3 = rec(strongSide, 3) || rb;
        if (!persistentCovCalls.sky_underFromWeak && r3 && isOut(r3))
          return manCover(r3.id, YARD_PX);
        return zoneToManConvert(d, hookS) || zoneDrop(hookS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.sky_pushWeak === undefined && rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingWeak && !canReach(d, rb) && r2w && canReach(d, r2w)) {
            // Only push if Weak Apex is on the matching weak preset (cover3-sky-weak)
            // which knows sky_pushWeak. Otherwise Hook covers RB himself.
            if (!weakApexWillAcceptPush(snapshot, ['cover3-sky-weak'])) {
              persistentCovCalls.sky_pushWeak = false; // freeze: no push this play
              return rb ? manCover(rb.id, YARD_PX) : zoneDrop(hookW);
            }
            persistentCovCalls.sky_pushWeak = true;
            return manCover(r2w.id, YARD_PX);
          }
        }
        if (persistentCovCalls.sky_pushWeak)
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
        if (persistentCovCalls.sky_underFromStrong) {
          const candidates = [r1s, r2s].filter(p => p && isUnder(p));
          if (candidates.length > 0) {
            const deepest = candidates.reduce((a, b) =>
              (a.simY ?? a.y) < (b.simY ?? b.y) ? a : b);
            return manCover(deepest.id, YARD_PX);
          }
        }
        const ssHasR2s = r2s && defensePlayers.some(def =>
          def.id !== d.id && def.decision?.focusTargetId === r2s.id
        );
        if (ssHasR2s && rb && lr(rb)?.moveType !== 'stopped')
          return manCover(rb.id, YARD_PX);
        return zoneToManConvert(d, hookW) || zoneDrop(hookW);
      }

      return null;
    },
  },

  // ── Cover 3 Sky — Weak Side (Side-Only) ──────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Paired with cover3-sky-strong. Same sky_ persistentCovCalls prefix.
  'cover3-sky-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatW  = weakSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const deepW      = weakSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'CB':
            if (isWeak) {
              const r1w = rec(weakSide, 1);
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW));
            }
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak) {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            }
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        const allReceivers = rb ? [...eligible, rb] : eligible;
        const nearest = allReceivers
          .filter(p => !defensePlayers.some(def =>
            def.id !== defender.id && def.decision?.focusTargetId === p.id
          ))
          .sort((a, b) => {
            const dA = Math.hypot((a.simX??a.x) - dx, (a.simY??a.y) - dy);
            const dB = Math.hypot((b.simX??b.x) - dx, (b.simY??b.y) - dy);
            return dA - dB;
          })[0];
        return nearest ? manCover(nearest.id, YARD_PX) : null;
      }

      const curlFlatW = weakSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const deepW     = weakSide === 'L' ? 'DEEP_L'      : 'DEEP_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── e. Weak Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isUnder(r2w)) {
          persistentCovCalls.sky_underFromWeak = true;
          return zoneToManConvert(d, curlFlatW) || zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.sky_smashWeak)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
        if (persistentCovCalls.sky_pushWeak)
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ───────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (r1w && isUnder(r1w)) {
          persistentCovCalls.sky_underFromWeak = true;
          return zoneDrop(deepW);
        }
        if (r1w && isHitch(r1w)) {
          persistentCovCalls.sky_smashWeak = true;
          return zoneDrop(deepW);
        }
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
      }

      // ── g. FS ────────────────────────────────────────────────────────
      if (role === 'SAF_W') return zoneDrop('DEEP_MIDDLE');

      return null;
    },
  },

  // ── MEG — Strong Side (Side-Only) ────────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // persistentCovCalls prefix: meg_
  //   meg_switchToApexStrong — Hook detected RB releasing strong, can't cover → Strong Apex takes RB
  //   switchToApexWeak   — Hook detected RB releasing weak/vertical    → Weak Apex takes RB
  'meg-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'outside' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH':
          case 'UNDER':
            result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) {
              const r1s = rec(strongSide, 1);
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS));
            }
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepS)); break;
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            }
            break;
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isVertical(p) { return isVerticalRoute(p, lrState); }

      const deepS     = strongSide === 'L' ? 'DEEP_HALF_L'      : 'DEEP_HALF_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner — man #1, no exceptions ─────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
      }

      // ── b. Strong Apex — man #2 ──────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const r2sLr = lr(r2s);
        if (r2s && isVertical(r2s) && r2sLr && r2sLr.depthYards >= 8)
          return zoneDrop(curlS);
        if (persistentCovCalls.meg_switchToApexStrong)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — deep half strong ──────────────────────────────────────
      if (role === 'SAF_S') {
        const r2sLr = lr(r2s);
        // c.i: #2 >= 8 yards deep → man #2 (any route)
        if (r2s && r2sLr && r2sLr.depthYards >= 8) return manCover(r2s.id, YARD_PX);
        // c.ii: #2 shallow AND #1 >= 8 yards deep → man #1
        const r1sLr = lr(r1s);
        if (r1s && r1sLr && r1sLr.depthYards >= 8) return manCover(r1s.id, YARD_PX * 0.5);
        return zoneDrop(deepS);
      }

      // ── d. Hook ───────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (rb) {
          const rbLr     = lr(rb);
          const rbVx     = rbLr?.vel?.x ?? 0;
          const rbVy     = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            if (persistentCovCalls.meg_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.meg_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const distYdsRb = Math.hypot(
              (rb.simX ?? rb.x) - (d.simX ?? d.x),
              (rb.simY ?? rb.y) - (d.simY ?? d.y)
            ) / YARD_PX;
            const side = persistentCovCalls.meg_rbReleaseSide;

            // Set switch call when RB out of range — only evaluate once (freeze on first decision)
            // Guard: only switch to Weak Apex if the active weak preset will react to it.
            if (persistentCovCalls.switchToApexWeak === undefined && distYdsRb > 9) {
              if (side === 'strong') {
                persistentCovCalls.meg_switchToApexStrong = true;
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
              } else {
                // Weak Apex won't react — freeze this decision, Hook keeps RB himself
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }

            // If switch call active — only release RB if Apex actually has him
            if (persistentCovCalls.meg_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
              const apexHasRb = defensePlayers.some(def =>
                def.id !== d.id &&
                (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
                def.decision?.focusTargetId === rb.id
              );
              if (apexHasRb) {
                // Apex confirmed on RB → Hook covers #2 of release side
                return side === 'strong'
                  ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                  : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              }
              // Apex not on RB → Hook stays on RB regardless
              return manCover(rb.id, YARD_PX);
            }

            // No switch call yet — Hook takes RB directly
            return manCover(rb.id, YARD_PX);
          }
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── MEG — Weak Side (Side-Only) ──────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads switchToApexWeak written by Hook (meg-strong block).
  'meg-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide  = strongSide === 'L' ? 'R' : 'L';
      const deepW     = weakSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'SAF_W':
            result.set(id, zoneDrop(deepW)); break;
          case 'CB':
            if (isWeak) {
              const r1w = rec(weakSide, 1);
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW));
            }
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak) {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            }
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)       { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)           { return p ? lrState[p.id] : null; }
      function isVertical(p)   { return isVerticalRoute(p, lrState); }

      const deepW     = weakSide === 'L' ? 'DEEP_HALF_L'      : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner — man #1, no exceptions ────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
      }

      // ── b. Weak Apex — man #2 ─────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // b.i: #2 vertical AND over 8 yards → hook curl zone weak
        const r2wLr = lr(r2w);
        if (r2w && isVertical(r2w) && r2wLr && r2wLr.depthYards >= 8) {
          return zoneDrop(curlW);
        }
        // b.ii: Switch call — hold RB unconditionally
        if (persistentCovCalls.switchToApexWeak) {
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);
        }
        // default: man #2
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — deep half weak ─────────────────────────────────────────
      if (role === 'SAF_W') {
        const r2wLr = lr(r2w);
        // c.i: #2 >= 8 yards deep → man #2 (any route)
        if (r2w && r2wLr && r2wLr.depthYards >= 8) return manCover(r2w.id, YARD_PX);
        // c.ii: #2 shallow AND #1 >= 8 yards deep → man #1
        const r1wLr = lr(r1w);
        if (r1w && r1wLr && r1wLr.depthYards >= 8) return manCover(r1w.id, YARD_PX * 0.5);
        return zoneDrop(deepW);
      }

      return null;
    },
  },


  // ── Cover 2 Match — Strong Side (Side-Only) ──────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // persistentCovCalls prefix: c2m_
  //   c2m_rbReleaseSide       — 'strong' | 'weak', frozen on first RB commit
  //   c2m_switchToApexStrong  — Hook: RB releasing strong, outside radius → Apex takes RB
  //   switchToApexWeak    — Hook: RB releasing weak/vert, outside radius → Apex takes RB
  'c2m-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'outside' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepS      = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const flatZoneS  = strongSide === 'L' ? 'FLAT_L'  : 'FLAT_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH':
          case 'UNDER':
            result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(flatZoneS));
            break;
          case 'SAF_S': {
            const r1s = rec(strongSide, 1);
            result.set(id, zoneDrop(deepS));
            break;
          }
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            }
            break;
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)       { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)           { return p ? lrState[p.id] : null; }
      function isVertical(p)   { return isVerticalRoute(p, lrState); }
      function isFlat(p, side) { return isFlatRoute(p, side, lrState, snapshot); }

      const deepS     = strongSide === 'L' ? 'DEEP_HALF_L'      : 'DEEP_HALF_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ─────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        const allRec = rb ? [...eligible, rb] : eligible;
        const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
        if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        if (r1s) return manCover(r1s.id, YARD_PX * 0.5);
        return null;
      }

      // ── b. Strong Apex — man #2 ──────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // b.i: RB not releasing to strong side AND #2 is THE flat receiver → man #1
        const rbRelease = persistentCovCalls.c2m_rbReleaseSide;
        const rbNotStrong = rbRelease !== 'strong';
        const allRec = rb ? [...eligible, rb] : eligible;
        if (rbNotStrong && r2s && isFlatReceiverFor(r2s, strongSide, allRec, snapshot, lrState)) {
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);
        }
        // b.ii: Switch call → man RB unconditionally
        if (persistentCovCalls.c2m_switchToApexStrong)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);
        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — deep half, man #1 if deep, else man #2 if deep ──────────
      if (role === 'SAF_S') {
        // Once committed to a receiver — hold unconditionally
        if (persistentCovCalls.c2m_ssTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.c2m_ssTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }
        const r1sLr = lr(r1s);
        const r2sLr = lr(r2s);
        // c.i: #1 left flat zone and >= 8 yards deep → man #1
        if (r1s && !isFlat(r1s, strongSide) && r1sLr && r1sLr.depthYards >= 8) {
          persistentCovCalls.c2m_ssTookId = r1s.id;
          return manCover(r1s.id, YARD_PX * 0.5);
        }
        // c.ii: #1 still flat/shallow AND #2 left flat zone and >= 8 yards → man #2
        if (r2s && !isFlat(r2s, strongSide) && r2sLr && r2sLr.depthYards >= 8) {
          persistentCovCalls.c2m_ssTookId = r2s.id;
          return manCover(r2s.id, YARD_PX);
        }
        return zoneDrop(deepS);
      }

      // ── d. Hook — identical to MEG ────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Switch call active — only release RB if Apex actually has him
        if (persistentCovCalls.c2m_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
          if (rb) {
            const apexHasRb = defensePlayers.some(def =>
              def.id !== d.id &&
              (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
              def.decision?.focusTargetId === rb.id
            );
            const side = persistentCovCalls.c2m_rbReleaseSide;
            if (apexHasRb) {
              // Apex confirmed on RB → Hook covers #2 of release side
              return side === 'strong'
                ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            }
            // Apex not on RB (e.g. took #1 because #2 went flat) → Hook stays on RB
            return manCover(rb.id, YARD_PX);
          }
          const side = persistentCovCalls.c2m_rbReleaseSide;
          return side === 'strong'
            ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
            : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
        }

        if (rb) {
          const rbLr    = lr(rb);
          const rbVx    = rbLr?.vel?.x ?? 0;
          const rbVy    = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            // Freeze release side first — before any early return
            if (persistentCovCalls.c2m_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.c2m_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            // RB flat → stay in hook middle zone
            if (isFlatRoute(rb, null, lrState, snapshot)) return zoneDrop('HOOK_MIDDLE');

            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const distYds = Math.hypot(
              (rb.simX ?? rb.x) - (d.simX ?? d.x),
              (rb.simY ?? rb.y) - (d.simY ?? d.y)
            ) / YARD_PX;

            if (distYds <= 9) {
              return manCover(rb.id, YARD_PX);
            } else if (persistentCovCalls.switchToApexWeak === undefined) {
              const side = persistentCovCalls.c2m_rbReleaseSide;
              if (side === 'strong') {
                persistentCovCalls.c2m_switchToApexStrong = true;
                return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
                return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              } else {
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }
          }
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── Cover 2 Match — Weak Side (Side-Only) ────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads c2m_rbReleaseSide and switchToApexWeak from Hook (c2m-strong).
  'c2m-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepW      = weakSide === 'L' ? 'DEEP_HALF_L'      : 'DEEP_HALF_R';
      const curlW      = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      const flatZoneW  = weakSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'SAF_W': {
            const r1w = rec(weakSide, 1);
            result.set(id, zoneDrop(deepW));
            break;
          }
          case 'CB':
            if (isWeak) result.set(id, zoneDrop(flatZoneW));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak) {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            }
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)       { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)           { return p ? lrState[p.id] : null; }
      function isVertical(p)   { return isVerticalRoute(p, lrState); }
      function isFlat(p, side) { return isFlatRoute(p, side, lrState, snapshot); }

      const deepW     = weakSide === 'L' ? 'DEEP_HALF_L'      : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner ───────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        const allRec = rb ? [...eligible, rb] : eligible;
        const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
        if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        if (r1w) return manCover(r1w.id, YARD_PX * 0.5);
        return null;
      }

      // ── b. Weak Apex — man #2 ─────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // b.i: RB not releasing to weak side AND #2 is THE flat receiver → man #1
        // Higher priority than switch call — if #2 is flat, Apex takes #1 regardless.
        // Hook monitors via apexHasRb and takes RB himself if Apex is on #1 not RB.
        const rbRelease = persistentCovCalls.c2m_rbReleaseSide;
        const rbNotWeak = rbRelease !== 'weak';
        const allRec = rb ? [...eligible, rb] : eligible;
        if (rbNotWeak && r2w && isFlatReceiverFor(r2w, weakSide, allRec, snapshot, lrState)) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);
        }
        // b.ii: Switch call → man RB unconditionally
        if (persistentCovCalls.switchToApexWeak)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);
        // default: man #2
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — deep half, man #1 if deep, else man #2 if deep ───────────
      if (role === 'SAF_W') {
        // Once committed to a receiver — hold unconditionally
        if (persistentCovCalls.c2m_fsTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.c2m_fsTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }
        const r1wLr = lr(r1w);
        const r2wLr = lr(r2w);
        // c.i: #1 left flat zone and >= 8 yards deep → man #1
        if (r1w && !isFlat(r1w, weakSide) && r1wLr && r1wLr.depthYards >= 8) {
          persistentCovCalls.c2m_fsTookId = r1w.id;
          return manCover(r1w.id, YARD_PX * 0.5);
        }
        // c.ii: #1 still flat/shallow AND #2 left flat zone and >= 8 yards → man #2
        if (r2w && !isFlat(r2w, weakSide) && r2wLr && r2wLr.depthYards >= 8) {
          persistentCovCalls.c2m_fsTookId = r2w.id;
          return manCover(r2w.id, YARD_PX);
        }
        return zoneDrop(deepW);
      }

      return null;
    },
  },



  // ── Cover 5 | Cover 2 Man — Strong Side ─────────────────────────────
  // 2x2 only. Strong CB man #1, Strong Apex man #2, Hook man RB (always),
  // SAF_S deep half strong. No react() — all assignments are static.
  'cover5-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepS      = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const rb         = snapshot.primaryBackfield || null;
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH':
          case 'UNDER':
            result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) {
              const r1s = rec(strongSide, 1);
              result.set(id, r1s ? manCover(r1s.id) : rushDec());
            }
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id) : rushDec());
            }
            break;
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, rb ? manCover(rb.id) : rushDec()); break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepS)); break;
        }
      });
      return result;
    },

    react() { return null; },
  },

  // ── Cover 5 | Cover 2 Man — Weak Side ───────────────────────────────
  // Owns: Weak CB, Weak Apex, SAF_W. No react().
  'cover5-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepW      = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'CB':
            if (isWeak) {
              const r1w = rec(weakSide, 1);
              result.set(id, r1w ? manCover(r1w.id) : rushDec());
            }
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak) {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id) : rushDec());
            }
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepW)); break;
        }
      });
      return result;
    },

    react() { return null; },
  },

  // ── Palms 2-Read — Strong Side (Side-Only) ───────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // persistentCovCalls prefix: palms_
  //   palms_outStrong/Weak        — Corner or Apex: #2 isOut → Apex takes #2
  //   palms_underStrong/Weak      — Corner: #1 isUnder → Apex reroutes #2, takes #1 cross
  //   palms_smashStrong/Weak      — Corner: #1 isHitch → Apex breaks to #1
  //   palms_switchToApexStrong/Weak — Hook: RB outside radius → Apex takes RB
  'palms-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'outside' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L'  : 'DEEP_QRTR_R';
      const deepQMS    = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
       const curlS  = strongSide === 'L' ? 'CURL_L'       : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS));
            break;
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepQMS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)        { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)            { return p ? lrState[p.id] : null; }
      function isUnder(p)       { return isUnderRoute(p, lrState); }
      function isHitch(p)       { return isHitchRoute(p, lrState); }
      function isOut(p)         { return isOutRoute(p, lrState); }
      function isVertical(p)    { return isVerticalRoute(p, lrState); }
      function distYds(a, b)    { return Math.hypot((a.simX??a.x)-(b.simX??b.x),(a.simY??a.y)-(b.simY??b.y))/YARD_PX; }

      const deepQS    = strongSide === 'L' ? 'DEEP_QRTR_L'  : 'DEEP_QRTR_R';
      const deepQMS   = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
      const curlS     = strongSide === 'L' ? 'CURL_L'       : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ─────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // a.i: #2 isOut → Out call, take #2
        if (r2s && isOut(r2s)) {
          persistentCovCalls.palms_outStrong = true;
          return manCover(r2s.id, YARD_PX * 0.5);
        }
        // a.ii: #1 isUnder → Under call, deep quarter outer
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.palms_underStrong = true;
          return zoneDrop(deepQS);
        }
        // a.iii: #1 isHitch → Smash call, deep quarter outer
        if (r1s && isHitch(r1s)) {
          persistentCovCalls.palms_smashStrong = true;
          return zoneDrop(deepQS);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // b.i: #2 isOut → Out call, take flat receiver (no curl fallback)
        if (r2s && isOut(r2s)) {
          persistentCovCalls.palms_outStrong = true;
          const allRec = rb ? [...eligible, rb] : eligible;
          const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }
        // b.ii: #2 vertical >= 8 yards → take flat (no curl fallback)
        const r2sLr = lr(r2s);
        if (r2s && isVertical(r2s) && r2sLr && r2sLr.depthYards >= 8) {
          const allRec = rb ? [...eligible, rb] : eligible;
          const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }
        // b.iii: Under call → take #1 crossing
        if (persistentCovCalls.palms_underStrong) {
          const crosser = [r1s].find(p => p && isUnder(p));
          if (crosser) return manCover(crosser.id, YARD_PX);
        }
        // b.iv: Smash call → take #1
        if (persistentCovCalls.palms_smashStrong)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);
        // b.v: Switch call from Hook → take RB
        if (persistentCovCalls.palms_switchToApexStrong)
          return rb && isOutRoute(rb, lrState) ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);
        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS ─────────────────────────────────────────────────────────
      if (role === 'SAF_S') {
        if (persistentCovCalls.palms_ssTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.palms_ssTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepQMS);
        }
        const r2sLr = lr(r2s);
        if (r2s && isOut(r2s) && r2sLr && r2sLr.depthYards <= 5) {
          persistentCovCalls.palms_ssTookId = r1s?.id ?? 'none';
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQMS);
        }
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepQMS);
      }

      // ── d. Hook ───────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        function findUncovered() {
          const allRec = rb ? [...eligible, rb] : eligible;
          return allRec.find(p =>
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
        }

        if (rb) {
          const rbLr     = lr(rb);
          const rbVx     = rbLr?.vel?.x ?? 0;
          const rbVy     = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            if (persistentCovCalls.palms_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.palms_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const distYdsRb = distYds(d, rb);
            const side = persistentCovCalls.palms_rbReleaseSide;

            // Set switch call when RB out of range — only evaluate once (freeze on first decision)
            if (persistentCovCalls.switchToApexWeak === undefined && distYdsRb > 9) {
              if (side === 'strong') {
                persistentCovCalls.palms_switchToApexStrong = true;
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
              } else {
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }

            // If switch call active — only release RB if Apex actually has him
            if (persistentCovCalls.palms_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
              const apexHasRb = defensePlayers.some(def =>
                def.id !== d.id &&
                (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
                def.decision?.focusTargetId === rb.id
              );
              if (apexHasRb) {
                // Apex confirmed on RB → Hook covers #2 of release side
                return side === 'strong'
                  ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                  : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              }
              // Apex not on RB yet (or dropped him) → Hook stays on RB regardless
              return manCover(rb.id, YARD_PX);
            }

            // No switch call yet — Hook takes RB directly
            return manCover(rb.id, YARD_PX);
          }
        }
        // No RB or not moving — find uncovered player
        const unc = findUncovered();
        return unc ? manCover(unc.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
      }
      return null;
    },
  },

  // ── Palms 2-Read — Weak Side (Side-Only) ─────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads switchToApexWeak from Hook (palms-strong).
  'palms-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepQW     = weakSide === 'L' ? 'DEEP_QRTR_L'  : 'DEEP_QRTR_R';
      const deepQMW    = weakSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
      const curlW      = weakSide   === 'L' ? 'CURL_L'       : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        switch (role) {
          case 'SAF_W':
            result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepQMW));
            break;
          case 'CB':
            if (isWeak) result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)        { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)            { return p ? lrState[p.id] : null; }
      function isUnder(p)       { return isUnderRoute(p, lrState); }
      function isHitch(p)       { return isHitchRoute(p, lrState); }
      function isOut(p)         { return isOutRoute(p, lrState); }
      function isVertical(p)    { return isVerticalRoute(p, lrState); }

      const deepQW    = weakSide === 'L' ? 'DEEP_QRTR_L'  : 'DEEP_QRTR_R';
      const deepQMW   = weakSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
       const curlW = weakSide === 'L' ? 'CURL_L'       : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (r2w && isOut(r2w)) {
          persistentCovCalls.palms_outWeak = true;
          return manCover(r2w.id, YARD_PX * 0.5);
        }
        if (r1w && isUnder(r1w)) {
          persistentCovCalls.palms_underWeak = true;
          return zoneDrop(deepQW);
        }
        if (r1w && isHitch(r1w)) {
          persistentCovCalls.palms_smashWeak = true;
          return zoneDrop(deepQW);
        }
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW);
      }

      // ── b. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // b.i: #2 isOut → take flat (no curl fallback)
        if (r2w && isOut(r2w)) {
          persistentCovCalls.palms_outWeak = true;
          const allRec = rb ? [...eligible, rb] : eligible;
          const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }
        // b.ii: #2 vertical >= 8 yards → take flat (no curl fallback)
        const r2wLr = lr(r2w);
        if (r2w && isVertical(r2w) && r2wLr && r2wLr.depthYards >= 8) {
          const allRec = rb ? [...eligible, rb] : eligible;
          const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }
        // b.iii: Under call → take #1 crossing
        if (persistentCovCalls.palms_underWeak) {
          const crosser = [r1w].find(p => p && isUnder(p));
          if (crosser) return manCover(crosser.id, YARD_PX);
        }
        // b.iv: Smash call → take #1
        if (persistentCovCalls.palms_smashWeak)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);
        // b.v: Switch call from Hook → take RB
        if (persistentCovCalls.switchToApexWeak)
          return rb && isOutRoute(rb, lrState) ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);
        // default: man #2
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS ─────────────────────────────────────────────────────────
      if (role === 'SAF_W') {
        if (persistentCovCalls.palms_fsTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.palms_fsTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepQMW);
        }
        const r2wLr = lr(r2w);
        if (r2w && isOut(r2w) && r2wLr && r2wLr.depthYards <= 5) {
          persistentCovCalls.palms_fsTookId = r1w?.id ?? 'none';
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQMW);
        }
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepQMW);
      }

      return null;
    },
  },


  // ── Tuff — Strong Side (Side-Only) ───────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // isOneHigh: false (2-High shell)
  // No frozen persistentCovCalls — all reactive
  'tuff-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const flatS      = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepS      = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(strongSide === 'L' ? 'DEEP_L' : 'DEEP_R'));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(flatS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function isFlat(p, s)   { return isFlatRoute(p, s, lrState, snapshot); }

      const flatS     = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ─────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        const r1sLr = lr(r1s);
        const deepZoneS = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
        // #1 vertical >= 8 yards → man #1
        if (r1s && isVertical(r1s) && r1sLr && r1sLr.depthYards >= 8)
          return manCover(r1s.id, YARD_PX * 0.5);
        // #1 definitively not vertical → man #2
        const r1sNotVert = r1sLr && (
          isUnderRoute(r1s, lrState) ||
          isOutRoute(r1s, lrState) ||
          isHitchRoute(r1s, lrState) ||
          (r1sLr.moveType === 'outside' && r1sLr.depthYards >= 3)
        );
        if (r1sNotVert)
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepZoneS);
        // Still unclear — stay deep
        return zoneDrop(deepZoneS);
      }

      // ── b. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // b.i+ii+iii: RB not in flat AND #2 is flat → man #1
        const rbFlat = rb && isFlat(rb, strongSide);
        if (!rbFlat && r2s && isFlat(r2s, strongSide))
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);
        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS ─────────────────────────────────────────────────────────
      if (role === 'SAF_S') {
        // Take flat receiver if any
        const allRec = rb ? [...eligible, rb] : eligible;
        const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
        if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        // No flat → man #1
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(flatS);
      }

      // ── d. Hook ───────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const allRec = rb ? [...eligible, rb] : eligible;
        const unc = allRec.find(p =>
          !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
        );
        return unc ? manCover(unc.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── Tuff — Weak Side (Side-Only) ─────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  'tuff-weak': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const flatW      = weakSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlW      = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepW      = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        switch (role) {
          case 'SAF_W':
            result.set(id, zoneDrop(flatW)); break;
          case 'CB':
            if (isWeak) result.set(id, zoneDrop(weakSide === 'L' ? 'DEEP_L' : 'DEEP_R'));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function isFlat(p, s)   { return isFlatRoute(p, s, lrState, snapshot); }

      const flatW     = weakSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        const r1wLr = lr(r1w);
        const deepZoneW = weakSide === 'L' ? 'DEEP_L' : 'DEEP_R';
        // #1 vertical >= 8 yards → man #1
        if (r1w && isVertical(r1w) && r1wLr && r1wLr.depthYards >= 8)
          return manCover(r1w.id, YARD_PX * 0.5);
        // #1 definitively not vertical → man #2
        const r1wNotVert = r1wLr && (
          isUnderRoute(r1w, lrState) ||
          isOutRoute(r1w, lrState) ||
          isHitchRoute(r1w, lrState) ||
          (r1wLr.moveType === 'outside' && r1wLr.depthYards >= 3)
        );
        if (r1wNotVert)
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepZoneW);
        // Still unclear — stay deep
        return zoneDrop(deepZoneW);
      }

      // ── b. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const rbFlat = rb && isFlat(rb, weakSide);
        if (!rbFlat && r2w && isFlat(r2w, weakSide))
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS ─────────────────────────────────────────────────────────
      if (role === 'SAF_W') {
        const allRec = rb ? [...eligible, rb] : eligible;
        const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
        if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(flatW);
      }

      return null;
    },
  },


  // ── Tampa 2 Match 2x2 ────────────────────────────────────────────────
  // Full-field, 2-High shell. Clean build for 2x2 only.
  // persistentCovCalls prefix: tampa2m_
  //   tampa2m_ssTookId  — SS committed to a receiver (frozen)
  //   tampa2m_fsTookId  — FS committed to a receiver (frozen)
  'tampa2-match-2x2': {
    fullField: true,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        const flatS  = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
        const flatW  = weakSide   === 'L' ? 'FLAT_L'      : 'FLAT_R';
        const curlS  = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
        const curlW  = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
        const deepHS = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
        const deepHW = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
        const r2s = rec(strongSide, 2);
        const r2w = rec(weakSide, 2);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            result.set(id, zoneDrop(isStrong ? flatS : flatW)); break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW)); break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            else          result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          default: result.set(id, rushDec());
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function isFlat(p, s)   { return isFlatRoute(p, s, lrState, snapshot); }

      const flatS  = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const flatW  = weakSide   === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlS  = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const curlW  = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepHS = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a/f. Corner (Strong and Weak) ────────────────────────────────
      if (role === 'CB') {
        const side      = isStrong ? strongSide : weakSide;
        const flatZone  = isStrong ? flatS : flatW;
        const allRec    = rb ? [...eligible, rb] : eligible;
        const flatRec   = findFlatRouteRec(allRec, side, lrState, snapshot);
        if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        return zoneDrop(flatZone);
      }

      // ── b. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlat(r2s, strongSide)) return zoneDrop(curlS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isFlat(r2w, weakSide)) return zoneDrop(curlW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. Hook — Tampa Middle ─────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Eligible receivers first, then RB — vertical >= 8 yards
        const candidates = [r2s, r2w].filter(p => {
          if (!p) return false;
          const pLr = lr(p);
          return pLr && pLr.depthYards >= 8;
        });
        if (candidates.length > 0) {
          // Take deepest
          const deepest = candidates.reduce((a, b) =>
            (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b
          );
          return manCover(deepest.id, YARD_PX);
        }
        // RB vertical >= 8 yards
        if (rb) {
          const rbLr = lr(rb);
          if (rbLr && isVertical(rb) && rbLr.depthYards >= 8)
            return manCover(rb.id, YARD_PX);
        }
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. SS — Deep Half Strong ──────────────────────────────────────
      if (role === 'SAF_S') {
        if (persistentCovCalls.tampa2m_ssTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.tampa2m_ssTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        }
        const r1sLr = lr(r1s);
        const r2sLr = lr(r2s);
        // #1 vertical >= 8 yards → man #1
        if (r1s && isVertical(r1s) && r1sLr && r1sLr.depthYards >= 8) {
          persistentCovCalls.tampa2m_ssTookId = r1s.id;
          return manCover(r1s.id, YARD_PX * 0.5);
        }
        // #1 not vertical AND #2 >= 8 yards → man #2
        if (!isVertical(r1s) && r2s && r2sLr && r2sLr.depthYards >= 8) {
          persistentCovCalls.tampa2m_ssTookId = r2s.id;
          return manCover(r2s.id, YARD_PX);
        }
        return zoneDrop(deepHS);
      }

      // ── f. FS — Deep Half Weak ────────────────────────────────────────
      if (role === 'SAF_W') {
        if (persistentCovCalls.tampa2m_fsTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.tampa2m_fsTookId);
          return tgt ? manCover(tgt.id, YARD_PX * 0.5) : zoneDrop(deepHW);
        }
        const r1wLr = lr(r1w);
        const r2wLr = lr(r2w);
        // #1 vertical >= 8 yards → man #1
        if (r1w && isVertical(r1w) && r1wLr && r1wLr.depthYards >= 8) {
          persistentCovCalls.tampa2m_fsTookId = r1w.id;
          return manCover(r1w.id, YARD_PX * 0.5);
        }
        // #1 not vertical AND #2 >= 8 yards → man #2
        if (!isVertical(r1w) && r2w && r2wLr && r2wLr.depthYards >= 8) {
          persistentCovCalls.tampa2m_fsTookId = r2w.id;
          return manCover(r2w.id, YARD_PX);
        }
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Bracket — Strong Side (Side-Only) ────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // persistentCovCalls prefix: bracket_
  //   bracket_rbReleaseSide       — RB release direction (frozen)
  //   bracket_switchToApexStrong  — Hook pushed Switch to Strong Apex
  //   switchToApexWeak    — Hook pushed Switch to Weak Apex
  'bracket-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepHS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function distYds(a, b)  { return Math.hypot((a.simX??a.x)-(b.simX??b.x),(a.simY??a.y)-(b.simY??b.y))/YARD_PX; }

      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner — man #1 always ─────────────────────────────
      if (role === 'CB' && isStrong)
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);

      // ── b. Strong Apex — man #2, switch → man RB ─────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (persistentCovCalls.bracket_switchToApexStrong)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — man #2, reactive switch to #1 ────────────────────────
      if (role === 'SAF_S') {
        const r2sLr = lr(r2s);
        // #2 not vertical → man #1
        if (r2sLr && (
          isUnderRoute(r2s, lrState) ||
          isOutRoute(r2s, lrState) ||
          isHitchRoute(r2s, lrState) ||
          (r2sLr.moveType === 'outside' && r2sLr.depthYards >= 3)
        )) return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepHS);
      }

      // ── d. Hook — man RB, switch call if out of range ─────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Switch call active — only release RB if Apex actually has him
        if (persistentCovCalls.bracket_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
          if (rb) {
            const apexHasRb = defensePlayers.some(def =>
              def.id !== d.id &&
              (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
              def.decision?.focusTargetId === rb.id
            );
            const side = persistentCovCalls.bracket_rbReleaseSide;
            if (apexHasRb) {
              return side === 'strong'
                ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            }
            return manCover(rb.id, YARD_PX);
          }
          const side = persistentCovCalls.bracket_rbReleaseSide;
          return side === 'strong'
            ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
            : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
        }

        if (rb) {
          const rbLr     = lr(rb);
          const rbVx     = rbLr?.vel?.x ?? 0;
          const rbVy     = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            if (persistentCovCalls.bracket_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.bracket_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const dist = distYds(d, rb);
            if (dist <= 9) return manCover(rb.id, YARD_PX);

            // Out of range → frozen switch call (only evaluate once)
            if (persistentCovCalls.switchToApexWeak === undefined) {
              const side = persistentCovCalls.bracket_rbReleaseSide;
              if (side === 'strong') {
                persistentCovCalls.bracket_switchToApexStrong = true;
                return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
                return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              } else {
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }
          }
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── Bracket — Weak Side (Side-Only) ──────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads switchToApexWeak from Hook (bracket-strong).
  'bracket-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW      = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        switch (role) {
          case 'SAF_W':
            result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepHW));
            break;
          case 'CB':
            if (isWeak) result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }

      const deepHW    = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner — man #1 always ───────────────────────────────
      if (role === 'CB' && isWeak)
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);

      // ── b. Weak Apex — man #2, switch → man RB ───────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (persistentCovCalls.switchToApexWeak)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — man #2, reactive switch to #1 ────────────────────────
      if (role === 'SAF_W') {
        const r2wLr = lr(r2w);
        if (r2wLr && (
          isUnderRoute(r2w, lrState) ||
          isOutRoute(r2w, lrState) ||
          isHitchRoute(r2w, lrState) ||
          (r2wLr.moveType === 'outside' && r2wLr.depthYards >= 3)
        )) return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Bronco — Strong Side (Side-Only) ─────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // persistentCovCalls prefix: bronco_
  //   bronco_pushStrong — SS: #2 isUnder + RB releasing → Apex takes #2, Hook drops to middle
  //   bronco_pushWeak   — FS: #2 isUnder + RB releasing → Weak Apex takes #2
  'bronco-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const r1s = rec(strongSide, 1);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }

      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);

      // ── a. Strong Corner — man #1 always ─────────────────────────────
      if (role === 'CB' && isStrong)
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);

      // ── b. Strong Apex — curl zone, reads SS push call ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // Push call from SS → man #2
        if (persistentCovCalls.bronco_pushStrong)
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
        // #2 isUnder or vertical <= 5 yards → man #2
        const r2sLr = lr(r2s);
        if (r2s && (isUnder(r2s) || (isVertical(r2s) && r2sLr && r2sLr.depthYards <= 5)))
          return manCover(r2s.id, YARD_PX);
        // default: curl zone
        return zoneDrop(curlS);
      }

      // ── c. SS — deep half, reactive man reads ─────────────────────────
      if (role === 'SAF_S') {
        const r2sLr = lr(r2s);
        const rbLr  = lr(rb);
        // Frozen push call — hold man RB
        if (persistentCovCalls.bronco_pushStrong)
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(deepHS);
        const rbReleasing = rb && rbLr && rbLr.moveType !== 'stopped' &&
                            (Math.abs(rbLr.vel?.x ?? 0) > 10 || (rbLr.vel?.y ?? 0) < -10);
        // #2 isUnder + RB releasing → Push call + man RB
        if (r2s && isUnder(r2s) && rbReleasing) {
          persistentCovCalls.bronco_pushStrong = true;
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(deepHS);
        }
        // #2 isUnder (no RB) → man #1
        if (r2s && isUnder(r2s))
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        // #2 > 5 yards or isOut → man #2
        if (r2s && (isOut(r2s) || (r2sLr && r2sLr.depthYards > 5)))
          return manCover(r2s.id, YARD_PX);
        // default: deep half zone
        return zoneDrop(deepHS);
      }

      // ── d. Hook — man RB unless push call ────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.bronco_pushStrong || persistentCovCalls.bronco_pushWeak)
          return zoneDrop('HOOK_MIDDLE');
        if (rb) {
          const rbLr     = lr(rb);
          const rbMoving = rbLr && rbLr.moveType !== 'stopped' &&
                           (Math.abs(rbLr.vel?.x ?? 0) > 10 || (rbLr.vel?.y ?? 0) < -10);
          if (rbMoving) return manCover(rb.id, YARD_PX);
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── Bronco — Weak Side (Side-Only) ───────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  'bronco-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW      = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isWeak   = roleSide === weakSide;
        const r1w = rec(weakSide, 1);

        switch (role) {
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW)); break;
          case 'CB':
            if (isWeak) result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, zoneDrop(curlW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }

      const deepHW    = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner — man #1 always ───────────────────────────────
      if (role === 'CB' && isWeak)
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);

      // ── b. Weak Apex — curl zone, reads FS push call ──────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (persistentCovCalls.bronco_pushWeak)
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
        const r2wLr = lr(r2w);
        if (r2w && (isUnder(r2w) || (isVertical(r2w) && r2wLr && r2wLr.depthYards <= 5)))
          return manCover(r2w.id, YARD_PX);
        return zoneDrop(curlW);
      }

      // ── c. FS — deep half, reactive man reads ─────────────────────────
      if (role === 'SAF_W') {
        const r2wLr = lr(r2w);
        const rbLr  = lr(rb);
        // Frozen push call — hold man RB
        if (persistentCovCalls.bronco_pushWeak)
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(deepHW);
        const rbReleasing = rb && rbLr && rbLr.moveType !== 'stopped' &&
                            (Math.abs(rbLr.vel?.x ?? 0) > 10 || (rbLr.vel?.y ?? 0) < -10);
        if (r2w && isUnder(r2w) && rbReleasing) {
          persistentCovCalls.bronco_pushWeak = true;
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(deepHW);
        }
        if (r2w && isUnder(r2w))
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);
        if (r2w && (isOut(r2w) || (r2wLr && r2wLr.depthYards > 5)))
          return manCover(r2w.id, YARD_PX);
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Cougar — Strong Side (Side-Only) ─────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false)
  // Out-call is a live read every tick — no persistentCovCalls needed.
  //   #2 isOut → Apex → man #1 | CB → man #2 | SS → man #1
  //   #2 not out → Apex → man #2 | CB → man #1 | SS → deep half
  'cougar-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const rb         = snapshot.primaryBackfield || null;
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);

        switch (role) {
          case 'RUSH':
          case 'UNDER':
            result.set(id, rushDec()); break;

          // a. Corner: man #1 default
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;

          // b. Apex: man #2 default
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;

          // c. SS: deep half zone default
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;

          // d. Hook: man RB if present, else hook middle
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE')); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;

      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const rb         = snapshot.primaryBackfield || null;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)     { return p ? lrState[p.id] : null; }

      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);

      const r2sIsOut = r2s ? isOutRoute(r2s, lrState) : false;

      // ── a. Strong Corner ─────────────────────────────────────────────
      // Default: man #1. #2 running out: man #2.
      if (role === 'CB' && isStrong) {
        if (r2sIsOut)
          return r2s ? manCover(r2s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
      }

      // ── b. Strong Apex ───────────────────────────────────────────────
      // Default: man #2. #2 running out: switch to man #1.
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2sIsOut)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS ────────────────────────────────────────────────────────
      // Default: deep half. #2 running out: man #1.
      if (role === 'SAF_S') {
        if (r2sIsOut)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        return zoneDrop(deepHS);
      }

      // ── d. Hook — man RB ─────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (rb) {
          const rbLr     = lr(rb);
          const rbMoving = rbLr && rbLr.moveType !== 'stopped' &&
                           (Math.abs(rbLr.vel?.x ?? 0) > 10 || (rbLr.vel?.y ?? 0) < -10);
          if (rbMoving) return manCover(rb.id, YARD_PX);
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

}; // end _PR_SIDE
