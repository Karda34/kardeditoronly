// ── PRESET REGISTRY PART D: Backside (3x1) + Full-Field Coverages ───
// C2M-backside, Cover 3 Cloud variants
// Also assembles the complete PRESET_REGISTRY from all parts.

const _PR_FULLFIELD = {
  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 2 Man — Backside (3x1 only) ──────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // 2-high. No factory — direct RB reference.
  // CB: man #1w
  // Apex: man RB if released, else zone hook middle
  // FS: deep half weak
  'cover2man-backside': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1w = rec(weakSide, 1);

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
            if (isWeak) result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function isReleased(p)  { return isReleasedRoute(p, lrState); }

      const deepHW = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const r1w    = rec(weakSide, 1);

      // ── a. Weak Corner — man #1 ───────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : null;
      }

      // ── b. Weak Apex — RB released → man RB, else hook middle ─────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (!persistentCovCalls.c2mb_rbReleased && rb && isReleased(rb)) {
          persistentCovCalls.c2mb_rbReleased = true;
        }
        if (persistentCovCalls.c2mb_rbReleased && rb) return manCover(rb.id);
        return zoneDrop('HOOK_MIDDLE');
      }

      // ── c. FS — deep half weak ────────────────────────────────────
      if (role === 'SAF_W') {
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cone — Backside (3x1 only) ─────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // 2-high.
  // CB: press inside man #1w; if #1 under → bail deep quarter
  // Apex: man RB if released weak/vertical; else take strong-side under crosser
  // FS: man #1w
  'cone-backside': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'press', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepQW     = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1w = rec(weakSide, 1);

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
            if (isWeak) result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepQW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak) result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          case 'SAF_W':
            result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepQW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isReleased(p)  { return isReleasedRoute(p, lrState); }
      function isVertical(p)  { return isVerticalRoute(p, lrState); }

      const deepQW = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const r1w    = rec(weakSide, 1);

      // ── a. Weak Corner — man #1; #1 under → bail deep quarter ─────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('cone_backsideUnderSwitched', !!(r1w && isUnder(r1w)))) return zoneDrop(deepQW);
        return r1w ? manCover(r1w.id) : zoneDrop(deepQW);
      }

      // ── b. Weak Apex — RB released weak/vert → man RB; else take strong under crosser ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleased(rb)) {
          const rbLr = lr(rb);
          const rbVx = rbLr?.vel?.x ?? 0;
          const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingWeak || isVertical(rb)) return manCover(rb.id);
        }
        // RB not going weak/vert — pick up strong-side under crosser
        const strongRecs = eligible.filter(p => p._side === strongSide);
        const crosser = strongRecs.find(p => isUnder(p));
        if (crosser) return manCover(crosser.id);
        return zoneDrop('HOOK_MIDDLE');
      }

      // ── c. FS — man #1w ───────────────────────────────────────────
      if (role === 'SAF_W') {
        return r1w ? manCover(r1w.id) : zoneDrop(deepQW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Weak 2×2 (Full Field, 2x2 only) ─────────────────
  // 2-high pre-snap. Post-snap: FS → deep middle, SS → deep third weak.
  // Strong side = Cover 3 match rules (Under/Smash/Push).
  // Weak side = Cloud rules (Corner plays flat, SS plays deep third).
  // persistentCovCalls prefix: cw_
  'cover3-cloud-weak-bugged': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS));
            // e. Weak Corner: starts in flat
            if (isWeak)   result.set(id, zoneDrop(flatW));
            break;
          // b. Strong Apex: man #2s
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            // d. Weak Apex: man #2w
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(hookCurlW));
            break;
          // c. Hook: hook zone strong
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookS));
            break;
          // f. Strong Safety: deep middle
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // g. Weak Safety: deep third weak
          case 'SAF_W':
            result.set(id, zoneDrop(deepTW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = snapshot.isTrips;
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isHitch(p)     { return isHitchRoute(p, lrState); }
      function isVertical(p)  { return isDeepVertical(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L'       : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = eligible;

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Strong Corner — man #1s; under → Under call; hitch → Smash call ──
      if (role === 'CB' && isStrong) {
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.cw_underStrong = true;
          return zoneDrop(deepTS);
        }
        if (r1s && isHitch(r1s)) {
          persistentCovCalls.cw_smashStrong = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS);
      }

      // ── b. Strong Apex — man #2s; under → curl-flat; smash → #1s; push → #3 ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.cw_underStrong = true;
          return zoneDrop(curlFlatS);
        }
        if (persistentCovCalls.cw_smashStrong) {
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
        }
        if (persistentCovCalls.cw_pushStrong) {
          const r3 = r3s || rb;
          return r3 ? manCover(r3.id) : zoneDrop(curlFlatS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── c. Hook — hook zone; #3 out → Push call + man #2s; under → crosser ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Push call: #3 out fast, can't reach #3 but can reach #2s
        if (!persistentCovCalls.cw_pushStrong) {
          const r3 = r3s || rb;
          if (r3 && isOut(r3) && !canReach(d, r3) && r2s && canReach(d, r2s)) {
            persistentCovCalls.cw_pushStrong = true;
            return manCover(r2s.id);
          }
        }
        if (persistentCovCalls.cw_pushStrong) {
          return r2s ? manCover(r2s.id) : zoneDrop(hookS);
        }
        // Under call → take the crosser
        if (persistentCovCalls.cw_underStrong) {
          const crossers = [r1s, r2s].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            return manCover(deepest.id);
          }
        }
        return zoneDrop(hookS);
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── d. Weak Apex — man #2w; #2w flat → hook-curl zone ─────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isFlatRoute(r2w, weakSide, lrState, snapshot)) {
          return zoneDrop(hookCurlW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(hookCurlW);
      }

      // ── e. Weak Corner — first to flat; #1w not under → rob #1w; else flat zone ──
      if (role === 'CB' && isWeak) {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        if (r1w && !isUnderRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop(flatW);
      }

      // ── f. Strong Safety — deep middle; #2s depth read; #1 in-breaking ──
      if (role === 'SAF_S') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        // Both #2s deep → midpoint
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        // One #2 deep → man
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        // No #2 deep → check #1 vertical in-breaking
        if (r1s && isVertInsideRoute(r1s, lrState)) return manCover(r1s.id);
        if (r1w && isVertInsideRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── g. Weak Safety — deep third weak; #1w vertical → man ──
      if (role === 'SAF_W') {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        return zoneDrop(deepTW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Strong 3×1 (Full Field, 3x1 only) ───────────────
  // Cloud side = Strong (Trips). Corner plays flat, SS plays deep third strong.
  // Weak side = simple man. FS = deep middle.
  // No persistentCovCalls needed — all live reads.
  'cover3-cloud-strong-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: flat defender
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(flatS));
            // f. Weak Corner: man #1w
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(hookCurlW));
            break;
          // b. Strong Apex: man #2s
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            // e. Weak Apex: hook-curl zone (waits for RB)
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            break;
          // d. Hook: man #3s
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          // c. Strong Safety: deep third strong
          case 'SAF_S':
            result.set(id, zoneDrop(deepTS));
            break;
          // g. Free Safety: deep middle
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }
      function isReleased(p)  { return isReleasedRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = eligible;

      // ── a. Strong Corner — first to flat; #1s not under → rob #1s; else flat zone ──
      if (role === 'CB' && isStrong) {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        if (r1s && !isUnderRoute(r1s, lrState)) return manCover(r1s.id);
        return zoneDrop(flatS);
      }

      // ── b. Strong Apex — man #2s; #2s flat → hook-curl zone ───────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) {
          return zoneDrop(hookCurlS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── c. Strong Safety — deep third strong; #1s vertical → man ──
      if (role === 'SAF_S') {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(deepTS);
      }

      // ── d. Hook — man #3s; #3s flat → hook zone; #3s vertical → hook zone ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot)) return zoneDrop(hookS);
        if (r3s && isVertical(r3s)) return zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── e. Weak Apex — RB released weak → man RB; else hook-curl ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleased(rb)) {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingWeak) return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── f. Weak Corner — man #1w ──────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : null;
      }

      // ── g. Free Safety — deep middle; #2 depth; #1 in-breaking ────
      if (role === 'SAF_W') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        if (r1s && isVertInsideRoute(r1s, lrState)) return manCover(r1s.id);
        if (r1w && isVertInsideRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Weak 3×1 (Full Field, 3x1 only) ─────────────────
  // Mirror of Cloud Strong 3×1: Cloud side = Weak, Man side = Strong.
  // Weak CB plays flat. SS plays deep third weak. Strong CB plays man #1s.
  // No persistentCovCalls needed — all live reads.
  'cover3-cloud-weak-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Weak Corner: flat defender (cloud side)
          case 'CB':
            if (isWeak)   result.set(id, zoneDrop(flatW));
            // f. Strong Corner: man #1s (man side)
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(hookCurlS));
            break;
          // b. Strong Apex: man #2s with flat read
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            // e. Weak Apex: hook-curl zone (waits for RB)
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            break;
          // d. Hook: man #3s
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          // c. Strong Safety: deep middle
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // g. Weak Safety: deep third weak (cloud side)
          case 'SAF_W':
            result.set(id, zoneDrop(deepTW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }
      function isReleased(p)  { return isReleasedRoute(p, lrState); }

      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = eligible;

      // ── a. Weak Corner — flat defender; #1w not under → rob #1w; else flat zone ──
      if (role === 'CB' && isWeak) {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        if (r1w && !isUnderRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop(flatW);
      }

      // ── b. Strong Apex — man #2s; #2s flat → hook-curl zone ───────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) {
          return zoneDrop(hookCurlS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── c. Strong Safety — deep middle; #2 depth; #1 in-breaking ────
      if (role === 'SAF_S') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        if (r1s && isVertInsideRoute(r1s, lrState)) return manCover(r1s.id);
        if (r1w && isVertInsideRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. Hook — man #3s; flat → hook zone; vert → hook zone ─────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot)) return zoneDrop(hookS);
        if (r3s && isVertical(r3s)) return zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── e. Weak Apex — RB released weak → man RB; else hook-curl ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleased(rb)) {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingWeak) return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── f. Strong Corner — man #1s ────────────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── g. Weak Safety — deep third weak; #1w vertical → man ──────
      if (role === 'SAF_W') {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        return zoneDrop(deepTW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Strong 3×1 NEW ──────────────────────────────────────
  // Cloud side = Strong (Trips). Upgraded 3×1 with stickyOnce, getCloudFlatRec,
  // under/smash calls on weak CB, RB direction lock, Hook crosser pickup.
  // persistentCovCalls prefix: cs3_
  'cover3-cloud-strong-3x1-new': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L'       : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide,   1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(flatS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepTS));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isDeepVertical(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L'       : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide,   1);
      const allRec = rb ? [...eligible, rb] : eligible;

      function getCloudFlatRec(cloudSide, rec1, rec2) {
        const rbLr  = lr(rb);
        const rbVx  = rbLr?.vel?.x ?? 0;
        const rbMovingToFlat = rb && rbLr?.moveType !== 'stopped'
          && !isDeepVertical(rb, lrState)
          && (cloudSide === 'L' ? rbVx < 0 : rbVx > 0);
        const r1flat = rec1 && isFlatRoute(rec1, cloudSide, lrState, snapshot) && !isDeepVertical(rec1, lrState);
        const r2flat = rec2 && isFlatRoute(rec2, cloudSide, lrState, snapshot);
        const rbFlat = rb   && (isFlatRoute(rb, cloudSide, lrState, snapshot) || rbMovingToFlat)
                           && canReach(d, rb);
        if (r1flat) return rec1;
        if (r2flat) return rec2;
        if (rbFlat) return rb;
        return null;
      }

      // ── a. Strong Corner — cloud flat; rob #1s if not under; else flat zone ──
      if (role === 'CB' && isStrong) {
        const flatRec = getCloudFlatRec(strongSide, r1s, r2s);
        if (flatRec) return manCover(flatRec.id);
        if (r1s && !isUnderRoute(r1s, lrState)) return manCover(r1s.id);
        return zoneDrop(flatS);
      }

      // ── b. Strong Apex — man #2s; flat → hookCurlS; #2s ≥6y + #1s under → man #1s ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return zoneDrop(hookCurlS);
        const d2s = lr(r2s)?.depthYards ?? 0;
        if (r2s && d2s >= 6 && r1s && isUnderRoute(r1s, lrState) && stickyOnce('cs3_under_r1s_sa', true)) return manCover(r1s.id);
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── c. SAF_S — deep third strong; #1s vertical → man ─────────────
      if (role === 'SAF_S') {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(deepTS);
      }

      // ── d. Hook — man #3s; flat → hookS; vertical → carry to FS (stay man) ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot)) return zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── e. Weak Corner — man #1w ─────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── f. Weak Apex — RB to weak side → man RB; else hookCurlW and rob #1 under ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleasedRoute(rb, lrState)) {
          const rbVx     = lr(rb)?.vel?.x ?? 0;
          const rbMoving = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = !!(rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('cs3_rbWeak_wa', rbGoingWeak)) return manCover(rb.id);
        }
        if (r1s && isUnderRoute(r1s, lrState) && stickyOnce('cs3_cross_r1s', true)) return manCover(r1s.id);
        return zoneDrop(hookCurlW);
      }

      // ── g. SAF_W (FS) — deep middle ──────────────────────────────────────
      if (role === 'SAF_W') {
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Weak 3×1 NEW ────────────────────────────────────────
  // Cloud side = Weak (solo #1w). Man side = Strong (Trips).
  // Weak CB plays flat. SAF_W plays deep third weak.
  // Strong side has Cover 3 Match rules (Under/Smash).
  // persistentCovCalls prefix: cw3_
  'cover3-cloud-weak-3x1-new': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L'       : 'FLAT_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide,   1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isWeak)   result.set(id, zoneDrop(flatW));
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepTW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isDeepVertical(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L'       : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide,   1);
      const allRec = rb ? [...eligible, rb] : eligible;

      function getCloudFlatRec(cloudSide, rec1, rec2) {
        const rbLr  = lr(rb);
        const rbVx  = rbLr?.vel?.x ?? 0;
        const rbMovingToFlat = rb && rbLr?.moveType !== 'stopped'
          && !isDeepVertical(rb, lrState)
          && (cloudSide === 'L' ? rbVx < 0 : rbVx > 0);
        const r1flat = rec1 && isFlatRoute(rec1, cloudSide, lrState, snapshot) && !isDeepVertical(rec1, lrState);
        const r2flat = rec2 && isFlatRoute(rec2, cloudSide, lrState, snapshot);
        const rbFlat = rb   && (isFlatRoute(rb, cloudSide, lrState, snapshot) || rbMovingToFlat)
                           && canReach(d, rb);
        if (r1flat) return rec1;
        if (r2flat) return rec2;
        if (rbFlat) return rb;
        return null;
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Weak Corner — cloud flat; rob #1w if not under; else flat zone ──
      if (role === 'CB' && isWeak) {
        const flatRec = getCloudFlatRec(weakSide, r1w, null);
        if (flatRec) return manCover(flatRec.id);
        if (r1w && !isUnderRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop(flatW);
      }

      // ── b. Weak Apex — "3 Up is 3"; RB weak → man RB; #3 not vert + RB fast strong → man RB; else hookCurlW ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // d.i "3 Up is 3": #3 bends vertical inside → man #3
        if (r3s && isVertical(r3s) && stickyOnce('cw3_3up_wa', true)) return manCover(r3s.id);
        const rbLr     = lr(rb);
        const rbVx     = rbLr?.vel?.x ?? 0;
        const rbMoving = rbLr?.moveType !== 'stopped';
        // d.ii: RB out weak → man RB
        if (rb && isReleasedRoute(rb, lrState) && !isStickyLocked('cw3_rbStrong_sa')) {
          const rbGoingWeak = !!(rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('cw3_rbWeak_wa', rbGoingWeak)) return manCover(rb.id);
        }
        // d.iii: #3 not going vertical + RB fast strong → man RB
        if (!r3s || !isVertical(r3s)) {
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (rb && !isStickyLocked('cw3_rbWeak_wa') && stickyOnce('cw3_rbStrong_sa', rbGoingStrong)) return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── c. SAF_W — deep third weak; #1w vertical → man ───────────────
      if (role === 'SAF_W') {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        return zoneDrop(deepTW);
      }

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── d. Hook — Push → man #2s; under call → crosser; #3 under/vert-inside → hookS + rob r1w; else man #3s ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // c.i Push: #3 out flat → swap, take #2 man
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot) && stickyOnce('cw3_push_hook', true)) {
          return r2s ? manCover(r2s.id) : zoneDrop(hookS);
        }
        // Under-call crosser duty
        if (persistentCovCalls.cw3_underStrong) {
          const lockedId = getStickyTarget('cw3_hook_crosser');
          if (lockedId) return manCover(lockedId);
          const crossers = [r1s, r2s].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            lockStickyTarget('cw3_hook_crosser', deepest.id);
            return manCover(deepest.id);
          }
        }
        // c.ii #3 under/shallow → hookS; rob weak #1 crosser
        if (r3s && isUnderRoute(r3s, lrState) && stickyOnce('cw3_hook_r3u', true)) {
          if (r1w && isUnderRoute(r1w, lrState) && stickyOnce('cw3_hook_r1w', true)) return manCover(r1w.id);
          return zoneDrop(hookS);
        }
        // c.iii #3 vertical inside → release to Weak Hook, play hookS; rob weak #1 crosser
        if (r3s && isVertical(r3s) && stickyOnce('cw3_hook_r3v', true)) {
          if (r1w && isUnderRoute(r1w, lrState) && stickyOnce('cw3_hook_r1w', true)) return manCover(r1w.id);
          return zoneDrop(hookS);
        }
        // Default: man #3s
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── e. Strong Corner — man #1s; under → deep third strong (sticky); smash → deep third strong (sticky) ──
      if (role === 'CB' && isStrong) {
        if (stickyOnce('cw3_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('cw3_underS_cb')) persistentCovCalls.cw3_underStrong = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('cw3_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('cw3_smashS')) persistentCovCalls.cw3_smashStrong = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS);
      }

      // ── f. Strong Apex — Push → man #3s; under → curlFlatS; smash → man #1s; else man #2s ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // b.i Push: #3 out flat → take #3 top-down
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot) && stickyOnce('cw3_push_sa', true)) return manCover(r3s.id);
        // b.iii Under: #2s shallow → buzz to flat
        if (stickyOnce('cw3_underS_sa', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('cw3_underS_sa')) persistentCovCalls.cw3_underStrong = true;
          return zoneDrop(curlFlatS);
        }
        // b.ii Smash: → man #1s hitch
        if (persistentCovCalls.cw3_smashStrong) {
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
        }
        // Default: man #2s
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── g. SAF_S (FS) — scan strong side 3→2→1 at ≥6y; take uncovered; else deep middle ──
      if (role === 'SAF_S') {
        const d3s = lr(r3s)?.depthYards ?? 0;
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d1s = lr(r1s)?.depthYards ?? 0;

        // #3s: Hook has #3 by default; releases on Push/under/vert. SA gets #3 via Push. WA gets #3 via 3Up.
        const hookHasR3 = !isStickyLocked('cw3_push_hook') && !isStickyLocked('cw3_hook_r3u') && !isStickyLocked('cw3_hook_r3v');
        const saHasR3   = isStickyLocked('cw3_push_sa');
        const waHasR3   = isStickyLocked('cw3_3up_wa');
        if (r3s && d3s >= 6 && !hookHasR3 && !saHasR3 && !waHasR3) return manCover(r3s.id);

        // #2s: SA has #2 by default; releases on Under/Push/Smash. Hook gets #2 via Push.
        const saHasR2   = !isStickyLocked('cw3_underS_sa') && !isStickyLocked('cw3_push_sa') && !persistentCovCalls.cw3_smashStrong;
        const hookHasR2 = isStickyLocked('cw3_push_hook');
        if (r2s && d2s >= 6 && !saHasR2 && !hookHasR2) return manCover(r2s.id);

        // #1s: CB has #1 by default; releases on Under/Smash. SA gets #1 via Smash.
        const cbHasR1   = !isStickyLocked('cw3_underS_cb') && !isStickyLocked('cw3_smashS');
        const saHasR1   = persistentCovCalls.cw3_smashStrong;
        if (r1s && d1s >= 6 && !cbHasR1 && !saHasR1) return manCover(r1s.id);

        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Strong 2×2 (Full Field, 2x2 only) ───────────────
  // Mirror of Cloud Weak 2×2: Cloud side = Strong, Match side = Weak.
  // Strong CB plays flat. SS plays deep third strong.
  // Weak side has full Cover 3 Match rules (Under/Smash/Push).
  // persistentCovCalls prefix: cs_
  'cover3-cloud-strong': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L' : 'HOOK_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: flat defender (cloud side)
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(flatS));
            // e. Weak Corner: man #1w (match side)
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW));
            break;
          // b. Strong Apex: man #2s with flat read (cloud side)
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            // d. Weak Apex: man #2w (match side)
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // c. Hook: hook zone weak (match side)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookW));
            break;
          // f. SS: deep third strong (cloud side)
          case 'SAF_S':
            result.set(id, zoneDrop(deepTS));
            break;
          // g. Free Safety: deep middle
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isHitch(p)     { return isHitchRoute(p, lrState); }
      function isVertical(p)  { return isDeepVertical(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L'       : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = rb ? [...eligible, rb] : eligible;

      // Local flat-receiver picker for the cloud side:
      // – #1: only if in flat zone AND not going vertical
      // – #2: only if in flat zone
      // – RB: if in flat zone OR moving toward the cloud sideline (and not vertical)
      // Priority: #1 > #2 > RB
      function getCloudFlatRec(cloudSide, rec1, rec2) {
        const rbLr  = lr(rb);
        const rbVx  = rbLr?.vel?.x ?? 0;
        const rbMovingToFlat = rb && rbLr?.moveType !== 'stopped'
          && !isDeepVertical(rb, lrState)
          && (cloudSide === 'L' ? rbVx < 0 : rbVx > 0);
        const r1flat = rec1 && isFlatRoute(rec1, cloudSide, lrState, snapshot) && !isDeepVertical(rec1, lrState);
        const r2flat = rec2 && isFlatRoute(rec2, cloudSide, lrState, snapshot);
        const rbFlat = rb   && (isFlatRoute(rb, cloudSide, lrState, snapshot) || rbMovingToFlat)
                           && canReach(d, rb);
        if (r1flat) return rec1;
        if (r2flat) return rec2;
        if (rbFlat) return rb;
        return null;
      }

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Strong Corner — first to flat; #1s not under → rob #1s; else flat zone ──
      if (role === 'CB' && isStrong) {
        const flatRec = getCloudFlatRec(strongSide, r1s, r2s);
        if (flatRec) return manCover(flatRec.id);
        if (r1s && !isUnderRoute(r1s, lrState)) return manCover(r1s.id);
        return zoneDrop(flatS);
      }

      // ── b. Strong Apex — man #2s; #2s flat → hook-curl; #2s deep (FS takes) → man RB (dir locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) {
          if (rb) {
            const rbCovered = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === rb.id);
            if (!rbCovered) return manCover(rb.id);
          }
          return zoneDrop(hookCurlS);
        }
        const d2s     = lr(r2s)?.depthYards ?? 0;
        const rbLr    = lr(rb);
        const rbVx    = rbLr?.vel?.x ?? 0;
        const rbMoving = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        if (r2s && d2s >= 9 && rb && stickyOnce('cs_rbStrong_sa', rbGoingStrong)) return manCover(rb.id);
        if (!r2s) {
          if (rb) {
            const rbCovered = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === rb.id);
            if (!rbCovered) return manCover(rb.id);
          }
          return zoneDrop(hookCurlS);
        }
        return manCover(r2s.id);
      }

      // ── f. SS — deep third strong; #1s vertical → man ──────────────
      if (role === 'SAF_S') {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(deepTS);
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── e. Weak Corner — man #1w; under → Under call (sticky); hitch → Smash (sticky) ──
      if (role === 'CB' && isWeak) {
        if (stickyOnce('cs_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('cs_underW_cb')) persistentCovCalls.cs_underWeak = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('cs_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('cs_smashW')) persistentCovCalls.cs_smashWeak = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW);
      }

      // ── d. Weak Apex — man #2w; under → curl-flat (sticky); smash → #1w; #2w deep (FS takes) → man RB (dir locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (stickyOnce('cs_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('cs_underW_wa')) persistentCovCalls.cs_underWeak = true;
          return zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.cs_smashWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
        }
        const d2w      = lr(r2w)?.depthYards ?? 0;
        const rbLr     = lr(rb);
        const rbVx     = rbLr?.vel?.x ?? 0;
        const rbMoving = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
        if (r2w && d2w >= 9 && rb && stickyOnce('cs_rbWeak_wa', rbGoingWeak)) return manCover(rb.id);
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── c. Hook — hook zone weak; under → crosser (sticky target) ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.cs_underWeak) {
          const lockedId = getStickyTarget('cs_hook_crosser');
          if (lockedId) return manCover(lockedId);
          const crossers = [r1w, r2w].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            lockStickyTarget('cs_hook_crosser', deepest.id);
            return manCover(deepest.id);
          }
        }
        return zoneDrop(hookW);
      }

      // ── g. Free Safety — deep middle; #2 depth ──────────────────────
      if (role === 'SAF_W') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ── Cover 3 Cloud Weak 2×2 (Full Field, 2x2 only) ────────────────────
  // Mirror of Cloud Strong 2×2: Cloud side = Weak, Match side = Strong.
  // Weak CB plays flat. SAF_W plays deep third weak.
  // Strong side has full Cover 3 Match rules (Under/Smash).
  // persistentCovCalls prefix: cw_
  'cover3-cloud-weak': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L'       : 'FLAT_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Weak Corner: flat defender (cloud side)
          case 'CB':
            if (isWeak)   result.set(id, zoneDrop(flatW));
            // e. Strong Corner: man #1s (match side)
            if (isStrong) result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS));
            break;
          // b. Weak Apex: man #2w (cloud side)
          case 'APEX-L': case 'APEX-R':
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(hookCurlW));
            // d. Strong Apex: man #2s (match side)
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            break;
          // c. Hook: hook zone strong (match side)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookS));
            break;
          // g. SS: deep middle
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // f. Free Safety: deep third weak (cloud side)
          case 'SAF_W':
            result.set(id, zoneDrop(deepTW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isDeepVertical(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'       : 'HOOK_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L'       : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = rb ? [...eligible, rb] : eligible;

      // Local flat-receiver picker for the cloud side:
      // – #1: only if in flat zone AND not going vertical
      // – #2: only if in flat zone
      // – RB: if in flat zone OR moving toward the cloud sideline (and not vertical)
      // Priority: #1 > #2 > RB
      function getCloudFlatRec(cloudSide, rec1, rec2) {
        const rbLr  = lr(rb);
        const rbVx  = rbLr?.vel?.x ?? 0;
        const rbMovingToFlat = rb && rbLr?.moveType !== 'stopped'
          && !isDeepVertical(rb, lrState)
          && (cloudSide === 'L' ? rbVx < 0 : rbVx > 0);
        const r1flat = rec1 && isFlatRoute(rec1, cloudSide, lrState, snapshot) && !isDeepVertical(rec1, lrState);
        const r2flat = rec2 && isFlatRoute(rec2, cloudSide, lrState, snapshot);
        const rbFlat = rb   && (isFlatRoute(rb, cloudSide, lrState, snapshot) || rbMovingToFlat)
                           && canReach(d, rb);
        if (r1flat) return rec1;
        if (r2flat) return rec2;
        if (rbFlat) return rb;
        return null;
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Weak Corner — first to flat; #1w not under → rob #1w; else flat zone ──
      if (role === 'CB' && isWeak) {
        const flatRec = getCloudFlatRec(weakSide, r1w, r2w);
        if (flatRec) return manCover(flatRec.id);
        if (r1w && !isUnderRoute(r1w, lrState)) return manCover(r1w.id);
        return zoneDrop(flatW);
      }

      // ── b. Weak Apex — man #2w; #2w flat → hook-curl; #2w deep (SS takes) → man RB (dir locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isFlatRoute(r2w, weakSide, lrState, snapshot)) {
          if (rb) {
            const rbCovered = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === rb.id);
            if (!rbCovered) return manCover(rb.id);
          }
          return zoneDrop(hookCurlW);
        }
        const d2w      = lr(r2w)?.depthYards ?? 0;
        const rbLr     = lr(rb);
        const rbVx     = rbLr?.vel?.x ?? 0;
        const rbMoving = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
        if (r2w && d2w >= 9 && rb && stickyOnce('cw_rbWeak_wa', rbGoingWeak)) return manCover(rb.id);
        if (!r2w) {
          if (rb) {
            const rbCovered = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === rb.id);
            if (!rbCovered) return manCover(rb.id);
          }
          return zoneDrop(hookCurlW);
        }
        return manCover(r2w.id);
      }

      // ── f. Free Safety — deep third weak; #1w vertical → man ───────
      if (role === 'SAF_W') {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        return zoneDrop(deepTW);
      }

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── e. Strong Corner — man #1s; under → Under call (sticky); hitch → Smash (sticky) ──
      if (role === 'CB' && isStrong) {
        if (stickyOnce('cw_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('cw_underS_cb')) persistentCovCalls.cw_underStrong = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('cw_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('cw_smashS')) persistentCovCalls.cw_smashStrong = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepTS);
      }

      // ── d. Strong Apex — man #2s; under → curl-flat (sticky); smash → #1s; #2s deep (SS takes) → man RB (dir locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (stickyOnce('cw_underS_sa', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('cw_underS_sa')) persistentCovCalls.cw_underStrong = true;
          return zoneDrop(curlFlatS);
        }
        if (persistentCovCalls.cw_smashStrong) {
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
        }
        const d2s      = lr(r2s)?.depthYards ?? 0;
        const rbLr     = lr(rb);
        const rbVx     = rbLr?.vel?.x ?? 0;
        const rbMoving = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        if (r2s && d2s >= 9 && rb && stickyOnce('cw_rbStrong_sa', rbGoingStrong)) return manCover(rb.id);
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── c. Hook — hook zone strong; under → crosser (sticky target) ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.cw_underStrong) {
          const lockedId = getStickyTarget('cw_hook_crosser');
          if (lockedId) return manCover(lockedId);
          const crossers = [r1s, r2s].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            lockStickyTarget('cw_hook_crosser', deepest.id);
            return manCover(deepest.id);
          }
        }
        return zoneDrop(hookS);
      }

      // ── g. SS — deep middle; #2 depth ────────────────────────────────
      if (role === 'SAF_S') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Tampa 2 Match 3×1 (Full Field, 3x1 only) ──────────────────────
  // 2-high. Corners = flat. Safeties = deep half + vertical reads.
  // Hook = Tampa-Mike deep middle, has #3 vertical.
  // Weak Apex uses RB directly (no factory).
  // persistentCovCalls prefix: t2m3x1_
  'tampa2-match-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW     = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r2s = rec(strongSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a/g. Corners: flat zone
          case 'CB':
            result.set(id, zoneDrop(isStrong ? flatS : flatW));
            break;
          // b. Strong Apex: man #2s
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            // e. Weak Apex: man RB (or hook-curl zone if no RB)
            if (isWeak)   result.set(id, rb ? manCover(rb.id) : zoneDrop(hookCurlW));
            break;
          // c. Hook: deep middle
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // d. SS: deep half strong
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS));
            break;
          // f. FS: deep half weak
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }

      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const allRec = eligible;

      // ── a. Strong Corner — first to flat ──────────────────────────
      if (role === 'CB' && isStrong) {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatS);
      }

      // ── g. Weak Corner — first to flat ────────────────────────────
      if (role === 'CB' && isWeak) {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatW);
      }

      // ── b. Strong Apex — man #2s; flat → hook-curl ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) {
          return zoneDrop(hookCurlS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex — man RB; flat → hook-curl ───────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isFlatRoute(rb, weakSide, lrState, snapshot)) {
          return zoneDrop(hookCurlW);
        }
        return rb ? manCover(rb.id) : zoneDrop(hookCurlW);
      }

      // ── c. Hook — Tampa-Mike deep middle; #3 vertical → man ───────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isVertical(r3s)) return manCover(r3s.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. SS — deep half strong; #1s vert → man; else OTT #2/#3 ──
      if (role === 'SAF_S') {
        // Freeze once committed
        if (persistentCovCalls.t2m3x1_ssTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.t2m3x1_ssTookId);
          return tgt ? manCover(tgt.id) : zoneDrop(deepHS);
        }
        // #1s vertical → man (freeze)
        if (r1s && isVertical(r1s)) {
          persistentCovCalls.t2m3x1_ssTookId = r1s.id;
          return manCover(r1s.id);
        }
        // #1s not vertical → OTT on deepest vertical #2s or #3s
        if (r2s && isVertical(r2s)) {
          persistentCovCalls.t2m3x1_ssTookId = r2s.id;
          return ottDec(r2s.id);
        }
        if (r3s && isVertical(r3s)) {
          persistentCovCalls.t2m3x1_ssTookId = r3s.id;
          return ottDec(r3s.id);
        }
        return zoneDrop(deepHS);
      }

      // ── f. FS — deep half weak; #1w vert → man ────────────────────
      if (role === 'SAF_W') {
        if (persistentCovCalls.t2m3x1_fsTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.t2m3x1_fsTookId);
          return tgt ? manCover(tgt.id) : zoneDrop(deepHW);
        }
        if (r1w && isVertical(r1w)) {
          persistentCovCalls.t2m3x1_fsTookId = r1w.id;
          return manCover(r1w.id);
        }
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Invert 2 — 2×2 (Full Field, 2x2 only) ─────────────────────────
  // 2-high. Corners bail to deep half. Safeties crash to flat.
  // No persistentCovCalls — all live reads.
  'invert2-2x2': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW     = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a/g. Corners: bail to deep half
          case 'CB':
            result.set(id, zoneDrop(isStrong ? deepHS : deepHW));
            break;
          // b. Strong Apex: man #2s
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            else          result.set(id, r2w ? manCover(r2w.id) : zoneDrop(hookCurlW));
            break;
          // c. Hook: deep middle
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // d. SS: flat strong (crash)
          case 'SAF_S':
            result.set(id, zoneDrop(flatS));
            break;
          // f. FS: flat weak (crash)
          case 'SAF_W':
            result.set(id, zoneDrop(flatW));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }

      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);
      const allRec = eligible;

      // ── a. Strong Corner — deep half; #1s vert → man; else OTT #2s ──
      if (role === 'CB' && isStrong) {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        if (r2s && isVertical(r2s)) return ottDec(r2s.id);
        return zoneDrop(deepHS);
      }

      // ── g. Weak Corner — deep half; #1w vert → man; else OTT #2w ──
      if (role === 'CB' && isWeak) {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        if (r2w && isVertical(r2w)) return ottDec(r2w.id);
        return zoneDrop(deepHW);
      }

      // ── b. Strong Apex — man #2s; flat → hook-curl ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return zoneDrop(hookCurlS);
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex — man #2w; flat → hook-curl ──────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isFlatRoute(r2w, weakSide, lrState, snapshot)) return zoneDrop(hookCurlW);
        return r2w ? manCover(r2w.id) : zoneDrop(hookCurlW);
      }

      // ── c. Hook — deep middle (no #3 in 2x2) ─────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. SS — crash flat strong ─────────────────────────────────
      if (role === 'SAF_S') {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatS);
      }

      // ── f. FS — crash flat weak ───────────────────────────────────
      if (role === 'SAF_W') {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Invert 2 — 3×1 (Full Field, 3x1 only) ─────────────────────────
  // Same shell as 2×2 but:
  //   Hook: deep middle + #3 vertical read
  //   Weak Apex: man RB directly (no #2w in 3x1)
  //   Weak Corner: only #1w vertical (no #2w to OTT)
  // No persistentCovCalls — all live reads.
  'invert2-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW     = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW      = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r2s = rec(strongSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            result.set(id, zoneDrop(isStrong ? deepHS : deepHW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            else          result.set(id, rb ? manCover(rb.id) : zoneDrop(hookCurlW));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(flatS));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(flatW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }

      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const flatW     = weakSide   === 'L' ? 'FLAT_L' : 'FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const allRec = eligible;

      // ── a. Strong Corner — deep half; #1s vert → man; else OTT #2s/#3s ──
      if (role === 'CB' && isStrong) {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        if (r2s && isVertical(r2s)) return ottDec(r2s.id);
        if (r3s && isVertical(r3s)) return ottDec(r3s.id);
        return zoneDrop(deepHS);
      }

      // ── g. Weak Corner — deep half; #1w vert → man; else deep half ──
      if (role === 'CB' && isWeak) {
        if (r1w && isVertical(r1w)) return manCover(r1w.id);
        return zoneDrop(deepHW);
      }

      // ── b. Strong Apex — man #2s; flat → hook-curl ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return zoneDrop(hookCurlS);
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex — man RB; flat → hook-curl ───────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isFlatRoute(rb, weakSide, lrState, snapshot)) return zoneDrop(hookCurlW);
        return rb ? manCover(rb.id) : zoneDrop(hookCurlW);
      }

      // ── c. Hook — deep middle; #3s vertical → man ─────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isVertical(r3s)) return manCover(r3s.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. SS — crash flat strong ─────────────────────────────────
      if (role === 'SAF_S') {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatS);
      }

      // ── f. FS — crash flat weak ───────────────────────────────────
      if (role === 'SAF_W') {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Poach (Full Field, 3x1 only) ──────────────────────────────────
  // 2-high. Strong side: Quarters shell (CB man #1, SS man #2 with release).
  // Apex = flat defender. Hook = man #3, push to #2 if #3 flat.
  // Weak side: CB man #1w. Apex = RB/crosser. FS = Poach (#3 vert / #1 bracket).
  // No persistentCovCalls — all live reads.
  'poach-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const flatS      = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW     = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepHS));
            // g. Weak Corner: man #1w
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          // b. Strong Apex: flat defender
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, zoneDrop(flatS));
            // e. Weak Apex: hook-curl (waits for RB/crosser)
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            break;
          // c. Hook: man #3s
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop('HOOK_MIDDLE'));
            break;
          // d. SS: man #2s (quarters read)
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id) : zoneDrop(deepHS));
            break;
          // f. FS: deep half weak (poach)
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      // Use snap-time position for side — prevents CB flipping when crossing midfield
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }
      function isUnder(p)     { return isUnderRoute(p, lrState); }
      function isReleased(p)  { return isReleasedRoute(p, lrState); }

      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';
      const deepHS    = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const allRec = eligible;

      // ── a. Strong Corner — man #1s ────────────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── g. Weak Corner — man #1w ──────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : null;
      }

      // ── b. Strong Apex — flat defender ────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return zoneDrop(flatS);
      }

      // ── e. Weak Apex — RB weak → man; else first crosser ─────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleased(rb)) {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingWeak) return manCover(rb.id);
        }
        // First crosser from strong side
        const strongRecs = eligible.filter(p => p._side === strongSide);
        const crosser = strongRecs.find(p => isUnder(p));
        if (crosser) return manCover(crosser.id);
        return zoneDrop(hookCurlW);
      }

      // ── c. Hook — man #3s; #3s flat → push man #2s ────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isFlatRoute(r3s, strongSide, lrState, snapshot)) {
          return r2s ? manCover(r2s.id) : zoneDrop('HOOK_MIDDLE');
        }
        return r3s ? manCover(r3s.id) : zoneDrop('HOOK_MIDDLE');
      }

      // ── d. SS — quarters read on #2s; not deep vert → deep half ───
      if (role === 'SAF_S') {
        if (r2s && isVertical(r2s)) return manCover(r2s.id);
        return zoneDrop(deepHS);
      }

      // ── f. FS — poach: #3s vert → OTT; else bracket #1w after 2s ──
      if (role === 'SAF_W') {
        if (r3s && isVertical(r3s)) return ottDec(r3s.id);
        if (r1w && playPhaseTime >= 2.0) return ottDec(r1w.id);
        return zoneDrop(deepHW);
      }

      return null;
    },
  },



  // ══════════════════════════════════════════════════════════════════════
  // ── New Sky 2×2 (Full Field, 2x2 only) ────────────────────────────
  // 2-high. Strong/Weak CBs: mod-man on #1 with Under + Smash reads.
  // Strong Safety: man #2s; Under→curl-flat; Smash→#1s; Push call→RB (OTP shallow ≤5yd).
  // Strong Apex: zone hook strong; RB fast strong+can't reach→push call (sticky); RB in strong flat→take RB; weak under→weak crosser.
  // Hook: zone middle; RB flat weak→take RB; strong under→strong crosser.
  // Weak Apex: man #2w; Under→curl-flat; Smash→#1w.
  // Deep Safety (SAF_W): deep middle.
  // All calls (under S/W, smash S/W, push) use stickyOnce 0.5s for full stickiness.
  // persistentCovCalls prefix: nsk2_
  'cover3-sky-2x2-match': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s  /  f. Weak Corner: man #1w
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepTW));
            break;
          // b. Strong Safety: man #2s
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            break;
          // c. Strong Apex: zone hook strong  /  e. Weak Apex: man #2w
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, zoneDrop(hookCurlS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: zone hook middle
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          // g. Deep Safety: deep middle
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // i. #1s under → Under call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('nsk2_underS_cb')) persistentCovCalls.nsk2_underS = true;
          return zoneDrop(deepTS);
        }
        // ii. #1s hitch → Smash call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nsk2_smashS')) persistentCovCalls.nsk2_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety ──────────────────────────────────────────────
      if (role === 'SAF_S') {
        // i. #2s under → Under call strong (sticky 0.5s)
        if (stickyOnce('nsk2_underS_ss', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('nsk2_underS_ss')) persistentCovCalls.nsk2_underS = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('nsk2_rbGlobal_strong', rbGoingStrong)) {
            if (persistentCovCalls.nsk2_smashS) return zoneDrop(curlFlatS);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // ii. Smash call strong (locked) → cover #1s on hitch
        if (persistentCovCalls.nsk2_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── c. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));

        // c.i:   Under call from weak side (locked) → pick up uncovered weak crosser
        if (persistentCovCalls.nsk2_underW) {
          const crosser = [r1w, r2w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // c.iii: RB releasing strong + SS still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2s.id))
          return manCover(rb.id);
        // Default: Hook dropping → hookCurlS (separation); else → HOOK_MIDDLE
        const hookZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'HOOK-L' || r === 'HOOK-R' || r === 'HOOK-M') &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(hookZoning ? hookCurlS : 'HOOK_MIDDLE');
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        // d.i:   Under call from strong side (locked) → pick up uncovered strong crosser
        if (persistentCovCalls.nsk2_underS) {
          const crosser = [r1s, r2s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // d.iii: RB releasing weak + Weak Apex still on #2w → take RB (live every tick)
        if (rbGoingWeak && rb && r2w &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2w.id))
          return manCover(rb.id);
        // Default: Strong Apex dropping → hookCurlW (separation); else → HOOK_MIDDLE
        const strongApexZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'APEX-L' || r === 'APEX-R') &&
                 (defSnapX <= ballX ? 'L' : 'R') === strongSide &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(strongApexZoning ? hookCurlW : 'HOOK_MIDDLE');
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // i. #2w under → Under call weak (sticky 0.5s)
        if (stickyOnce('nsk2_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('nsk2_underW_wa')) persistentCovCalls.nsk2_underW = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (!persistentCovCalls.nsk2_rbGlobal_strong && rbGoingWeak) {
            if (persistentCovCalls.nsk2_smashW) return zoneDrop(curlFlatW);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        // ii. Smash call weak (locked) → cover #1w on hitch
        if (persistentCovCalls.nsk2_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('nsk2_underW_cb')) persistentCovCalls.nsk2_underW = true;
          return zoneDrop(deepTW);
        }
        // ii. #1w hitch → Smash call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('nsk2_smashW')) persistentCovCalls.nsk2_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Deep Safety ────────────────────────────────────────────────
      if (role === 'SAF_W') {
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Buzz 2×2 Match (Full Field, 2x2) ──────────────────────
  // Identical to Cover 3 Sky 2×2 Match except SS and Strong Apex swap roles:
  // SS → zone hookCurlS/HOOK_MIDDLE, Strong Apex → man #2s
  // persistentCovCalls prefix: nbz2_
  'cover3-buzz-2x2-match': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s  /  f. Weak Corner: man #1w
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepTW));
            break;
          // b. Strong Safety: zone hook strong (buzz: swapped from sky)
          case 'SAF_S':
            result.set(id, zoneDrop(hookCurlS));
            break;
          // c. Strong Apex: man #2s (buzz: swapped from sky)  /  e. Weak Apex: man #2w
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: zone hook middle
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          // g. Deep Safety: deep middle
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // i. #1s under → Under call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nbz2_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('nbz2_underS_cb')) persistentCovCalls.nbz2_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nbz2_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nbz2_smashS')) persistentCovCalls.nbz2_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (buzz: zone, swapped with Strong Apex from sky) ──
      if (role === 'SAF_S') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));

        // i:   Under call from weak side (locked) → pick up uncovered weak crosser
        if (persistentCovCalls.nbz2_underW) {
          const crosser = [r1w, r2w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // ii:  RB releasing strong + Strong Apex still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2s.id))
          return manCover(rb.id);
        // Default: Hook dropping → hookCurlS (separation); else → HOOK_MIDDLE
        const hookZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'HOOK-L' || r === 'HOOK-R' || r === 'HOOK-M') &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(hookZoning ? hookCurlS : 'HOOK_MIDDLE');
      }

      // ── c. Strong Apex (buzz: man #2s, swapped with SS from sky) ─────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // i. #2s under → Under call strong (sticky 0.5s)
        if (stickyOnce('nbz2_underS_sa', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('nbz2_underS_sa')) persistentCovCalls.nbz2_underS = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('nbz2_rbGlobal_strong', rbGoingStrong)) {
            if (persistentCovCalls.nbz2_smashS) return zoneDrop(curlFlatS);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // ii. Smash call strong (locked) → cover #1s on hitch
        if (persistentCovCalls.nbz2_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        // d.i:   Under call from strong side (locked) → pick up uncovered strong crosser
        if (persistentCovCalls.nbz2_underS) {
          const crosser = [r1s, r2s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // d.iii: RB releasing weak + Weak Apex still on #2w → take RB (live every tick)
        if (rbGoingWeak && rb && r2w &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2w.id))
          return manCover(rb.id);
        // Default: SS dropping (zone player on strong side) → hookCurlW (separation); else → HOOK_MIDDLE
        const strongSideZoning = defensePlayers.some(def => {
          const r = frozenRoleMap?.get(def.id);
          return r === 'SAF_S' && def.decision?.mode === 'drop';
        });
        return zoneDrop(strongSideZoning ? hookCurlW : 'HOOK_MIDDLE');
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // i. #2w under → Under call weak (sticky 0.5s)
        if (stickyOnce('nbz2_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('nbz2_underW_wa')) persistentCovCalls.nbz2_underW = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (!persistentCovCalls.nbz2_rbGlobal_strong && rbGoingWeak) {
            if (persistentCovCalls.nbz2_smashW) return zoneDrop(curlFlatW);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        // ii. Smash call weak (locked) → cover #1w on hitch
        if (persistentCovCalls.nbz2_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nbz2_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('nbz2_underW_cb')) persistentCovCalls.nbz2_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('nbz2_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('nbz2_smashW')) persistentCovCalls.nbz2_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Deep Safety ────────────────────────────────────────────────
      if (role === 'SAF_W') return zoneDrop('DEEP_MIDDLE');

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Robber Match (Full Field, 2x2) ────────────────────────
  // Based on Sky 2×2 Match with role rotation:
  // Strong Apex → man #2s (was SS)  |  Hook → zone hookCurlS (was Strong Apex)
  // Strong Safety → deep middle (was SAF_W)  |  Weak Safety → zone HOOK_MIDDLE (was Hook)
  // persistentCovCalls prefix: nrob_
  'cover3-robber-2x2-match': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s  /  f. Weak Corner: man #1w
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepTW));
            break;
          // b. Strong Safety: deep middle (robber: gets SAF_W role)
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // c. Strong Apex: man #2s (robber: gets SS role)  /  e. Weak Apex: man #2w
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: zone hookCurlS (robber: gets Strong Apex role)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlS));
            break;
          // g. Weak Safety: zone HOOK_MIDDLE (robber: gets Hook role)
          case 'SAF_W':
            result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // i. #1s under → Under call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nrob_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('nrob_underS_cb')) persistentCovCalls.nrob_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nrob_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nrob_smashS')) persistentCovCalls.nrob_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (robber: deep middle, gets SAF_W role) ──────────
      if (role === 'SAF_S') return zoneDrop('DEEP_MIDDLE');

      // ── c. Strong Apex (robber: man #2s, gets SS role) ───────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // i. #2s under → Under call strong (sticky 0.5s)
        if (stickyOnce('nrob_underS_sa', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('nrob_underS_sa')) persistentCovCalls.nrob_underS = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('nrob_rbGlobal_strong', rbGoingStrong)) {
            if (persistentCovCalls.nrob_smashS) return zoneDrop(curlFlatS);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // ii. Smash call strong (locked) → cover #1s on hitch
        if (persistentCovCalls.nrob_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (robber: zone, gets Strong Apex role) ────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));

        // i:   Under call from weak side (locked) → pick up uncovered weak crosser
        if (persistentCovCalls.nrob_underW) {
          const crosser = [r1w, r2w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // ii:  RB releasing strong + Strong Apex still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2s.id))
          return manCover(rb.id);
        // Default: SAF_W dropping → hookCurlS (separation); else → HOOK_MIDDLE
        const safWZoning = defensePlayers.some(def => {
          const r = frozenRoleMap?.get(def.id);
          return r === 'SAF_W' && def.decision?.mode === 'drop';
        });
        return zoneDrop(safWZoning ? hookCurlS : 'HOOK_MIDDLE');
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // i. #2w under → Under call weak (sticky 0.5s)
        if (stickyOnce('nrob_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('nrob_underW_wa')) persistentCovCalls.nrob_underW = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (!persistentCovCalls.nrob_rbGlobal_strong && rbGoingWeak) {
            if (persistentCovCalls.nrob_smashW) return zoneDrop(curlFlatW);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        // ii. Smash call weak (locked) → cover #1w on hitch
        if (persistentCovCalls.nrob_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nrob_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('nrob_underW_cb')) persistentCovCalls.nrob_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('nrob_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('nrob_smashW')) persistentCovCalls.nrob_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Weak Safety (robber: zone, gets Hook role) ────────────────────
      if (role === 'SAF_W') {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        // i:   Under call from strong side (locked) → pick up uncovered strong crosser
        if (persistentCovCalls.nrob_underS) {
          const crosser = [r1s, r2s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // ii:  RB releasing weak + Weak Apex still on #2w → take RB (live every tick)
        if (rbGoingWeak && rb && r2w &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2w.id))
          return manCover(rb.id);
        // Default: Hook dropping → hookCurlW (separation); else → HOOK_MIDDLE
        const hookZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'HOOK-L' || r === 'HOOK-R' || r === 'HOOK-M') &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(hookZoning ? hookCurlW : 'HOOK_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Weak 2×2 Match (Full Field, 2x2) ─────────────────────
  // Based on Cover 3 Robber Match — Weak Apex and Weak Safety roles swapped:
  // Weak Apex → zone HOOK_MIDDLE (gets SAF_W role)  |  SAF_W → man #2w (gets Weak Apex role)
  // persistentCovCalls prefix: nwk2_
  'cover3-weak-2x2-match': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepTW));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlS));
            break;
          case 'SAF_W':
            result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // i. #1s under → Under call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nwk2_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('nwk2_underS_cb')) persistentCovCalls.nwk2_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nwk2_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nwk2_smashS')) persistentCovCalls.nwk2_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety: deep middle ─────────────────────────────────
      if (role === 'SAF_S') return zoneDrop('DEEP_MIDDLE');

      // ── c. Strong Apex: man #2s ───────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // i. #2s under → Under call strong (sticky 0.5s)
        if (stickyOnce('nwk2_underS_sa', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('nwk2_underS_sa')) persistentCovCalls.nwk2_underS = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('nwk2_rbGlobal_strong', rbGoingStrong)) {
            if (persistentCovCalls.nwk2_smashS) return zoneDrop(curlFlatS);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        if (persistentCovCalls.nwk2_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook: zone hookCurlS (Strong Apex role) ───────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));

        if (persistentCovCalls.nwk2_underW) {
          const crosser = [r1w, r2w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2s.id))
          return manCover(rb.id);
        const weakApexZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'APEX-L' || r === 'APEX-R') &&
                 (defSnapX <= ballX ? 'L' : 'R') === weakSide &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(weakApexZoning ? hookCurlS : 'HOOK_MIDDLE');
      }

      // ── e. Weak Apex: zone HOOK_MIDDLE (gets SAF_W role from robber) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        if (persistentCovCalls.nwk2_underS) {
          const crosser = [r1s, r2s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        if (rbGoingWeak && rb && r2w &&
            defensePlayers.some(def => def.id !== d.id &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2w.id))
          return manCover(rb.id);
        const hookZoning = defensePlayers.some(def => {
          const r        = frozenRoleMap?.get(def.id);
          const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
          return (r === 'HOOK-L' || r === 'HOOK-R' || r === 'HOOK-M') &&
                 def.decision?.mode === 'drop';
        });
        return zoneDrop(hookZoning ? hookCurlW : 'HOOK_MIDDLE');
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nwk2_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('nwk2_underW_cb')) persistentCovCalls.nwk2_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('nwk2_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('nwk2_smashW')) persistentCovCalls.nwk2_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Weak Safety: man #2w (gets Weak Apex role from robber) ────
      if (role === 'SAF_W') {
        // i. #2w under → Under call weak (sticky 0.5s)
        if (stickyOnce('nwk2_underW_sw', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('nwk2_underW_sw')) persistentCovCalls.nwk2_underW = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (!persistentCovCalls.nwk2_rbGlobal_strong && rbGoingWeak) {
            if (persistentCovCalls.nwk2_smashW) return zoneDrop(curlFlatW);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.nwk2_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── New Sky 3×1 (Full Field, 3x1 only) ────────────────────────────
  // 2-high shell: SS man #2s, FS deep middle. 1-high look post-snap.
  // Strong CB: man #1s; under → bail deep third (Under call); hitch → bail deep third (Smash call, sticky 0.5s).
  // SS: man #2s; #3 out → take #3; Smash locked → cover #1s; #2 under → Under call + flat.
  // Strong Apex: man #3s; #3 out → take #2s; #3 under+#1 under → #1s; #3 under → hook-curl.
  // Hook: middle zone; RB weak → cover strong unders; #3 not vert + RB out fast strong → RB; Under call → crossers.
  // Weak Apex: RB releasing weak (sticky 0.5s) → man RB; else strong crossers; else hook middle.
  // Weak CB: man #1w.
  // Deep Safety (SAF_W): deep middle.
  // persistentCovCalls prefix: nsky_
  'new-sky-3x1': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepHW     = weakSide   === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. Strong Corner: man #1s  /  f. Weak Corner: man #1w
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          // b. Strong Safety: man #2s
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            break;
          // c. Strong Apex: man #3s  /  e. Weak Apex: man RB
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookCurlS));
            if (isWeak)   result.set(id, rb   ? manCover(rb.id)  : zoneDrop('HOOK_MIDDLE'));
            break;
          // d. Hook: middle hook zone
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          // g. Deep Safety: deep middle
          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const rb         = snapshot.primaryBackfield || null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }
      function isOut(p)    { return isOutRoute(p, lrState); }
      function isVert(p)   { return isVerticalRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);

      // #3 going out to the flat — detected by outward motion OR physical flat position
      const r3IsOut = !!(r3s && (isOut(r3s) || isFlatRoute(r3s, strongSide, lrState, snapshot)));

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        // i. #1 under → Under call + bail deep third
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.nsky_under = true;
          return zoneDrop(deepTS);
        }
        // ii. #1 hitch → Smash call (sticky 0.5s) + bail deep third
        if (stickyOnce('nsky_smash', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nsky_smash')) persistentCovCalls.nsky_smash = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety ──────────────────────────────────────────────
      if (role === 'SAF_S') {
        // i. #3 out now → take #3
        if (r3IsOut) return r3s ? manCover(r3s.id) : zoneDrop(curlFlatS);
        // ii. Smash call locked → cover #1s on the hitch
        if (persistentCovCalls.nsky_smash) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        // iii. #3 not out, no Smash, #2 under → Under call + take flat strong side
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.nsky_under = true;
          return zoneDrop(flatS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── c. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // i. #3 out now → work to take #2s
        if (r3IsOut) return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
        // ii. #3 under AND #1 under → take #1s
        if (r3s && isUnder(r3s) && r1s && isUnder(r1s)) return manCover(r1s.id);
        // iii. #3 under → hook-curl strong (zone)
        if (r3s && isUnder(r3s)) return zoneDrop(hookCurlS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookCurlS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingWeak   = !!(rb && rbMoving && (weakSide   === 'L' ? rbVx < 0 : rbVx > 0));
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        const r3Vertical    = !!(r3s && isVert(r3s));

        // d.i: RB out weak (or Weak Apex locked on RB) → cover strong-side unders
        if (rbGoingWeak || persistentCovCalls.nsky_rbLockWeak) {
          const strongRecs = [r1s, r2s, r3s].filter(Boolean);
          const crosser = strongRecs.find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
          return zoneDrop('HOOK_MIDDLE');
        }

        // d.ii: #3 not going vertical + RB releasing fast to strong side → cover RB
        if (!r3Vertical && rbGoingStrong && Math.abs(rbVx) > 10 && rb) {
          return manCover(rb.id);
        }

        // Under call active → Hook owns #2s (SS abandoned him)
        if (persistentCovCalls.nsky_under) {
          if (r2s && isUnder(r2s)) return manCover(r2s.id);
        }

        return zoneDrop('HOOK_MIDDLE');
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb) {
          const rbVx        = lr(rb)?.vel?.x ?? 0;
          const rbMoving    = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0);
          if (stickyOnce('nsky_rbLockWeak', rbGoingWeak)) {
            if (isStickyLocked('nsky_rbLockWeak')) persistentCovCalls.nsky_rbLockWeak = true;
            return manCover(rb.id);
          }
        }
        // Under call active → Apex Weak owns #1s (CB abandoned him)
        if (persistentCovCalls.nsky_under) {
          if (r1s && isUnder(r1s)) return manCover(r1s.id);
          return zoneDrop('HOOK_MIDDLE');
        }
        // No under call → pick up first uncovered shallow crosser from strong side
        const strongRecs = [r1s, r2s, r3s].filter(Boolean);
        const crosser = strongRecs.find(p =>
          isUnder(p) &&
          !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
        );
        if (crosser) return manCover(crosser.id);
        return zoneDrop('HOOK_MIDDLE');
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : zoneDrop(deepHW);
      }

      // ── g. Deep Safety ────────────────────────────────────────────────
      if (role === 'SAF_W') {
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },

};

// ── Final merge ─────────────────────────────────────────────────────
const PRESET_REGISTRY = {
  ..._PR_BASE,
  ..._PR_COVER3,
  ..._PR_SIDE,
  ..._PR_SIDE2,
  ..._PR_FULLFIELD,
};

// ── Factory: 3x1 Backside from 2x2 Weak ─────────────────────────────
// In 3x1, the weak side has only #1 (lone WR). The RB takes the role of
// #2 weak. This factory wraps any 2x2-weak preset so that:
//   - rec(weakSide, 2) finds the RB (injected as fake #2w eligible)
//   - snapshot.primaryBackfield = null (no separate back — he IS #2)
// RB-specific switch/flat logic in the original preset won't fire (rb=null).
// ── Empty formation snapshot patch ──────────────────────────────────
// In Empty there is no RB, but many presets reference primaryBackfield.
// This patch maps #2 weak-side receiver as primaryBackfield so preset
// logic ("RB man", RB reads etc.) targets #2w instead.
function patchEmptySnapshot(snapshot) {
  if (!snapshot) return snapshot;
  if (snapshot.primaryBackfield) return snapshot; // has a real RB — no patch
  const formation = getFormationRead(snapshot).formation;
  if (formation !== 'empty') return snapshot;
  const strongSide = snapshot.coverageStrongSide || 'R';
  const weakSide   = strongSide === 'L' ? 'R' : 'L';
  const w2 = (snapshot.eligiblePlayers || []).find(
    p => p._side === weakSide && p._receiverNumber === 2
  );
  if (!w2) return snapshot; // no #2w exists (e.g. 4x1) — nothing to map
  return Object.assign({}, snapshot, { primaryBackfield: w2 });
}

