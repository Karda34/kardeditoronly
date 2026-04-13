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
        if (r1w && isUnder(r1w)) return zoneDrop(deepQW);
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

      // ── e. Weak Corner — first to flat; none → rob #1w underneath ──
      if (role === 'CB' && isWeak) {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return r1w ? manCover(r1w.id) : zoneDrop(flatW);
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

      // ── a. Strong Corner — first to flat; none → rob #1s ──────────
      if (role === 'CB' && isStrong) {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return r1s ? manCover(r1s.id) : zoneDrop(flatS);
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

      // ── a. Weak Corner — flat defender; none → rob #1w ────────────
      if (role === 'CB' && isWeak) {
        const flatRec = getFlatReceiver(weakSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return r1w ? manCover(r1w.id) : zoneDrop(flatW);
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
      const allRec = eligible;

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Strong Corner — first to flat; none → rob #1s underneath ──
      if (role === 'CB' && isStrong) {
        const flatRec = getFlatReceiver(strongSide, allRec, snapshot, lrState);
        if (flatRec) return manCover(flatRec.id);
        return r1s ? manCover(r1s.id) : zoneDrop(flatS);
      }

      // ── b. Strong Apex — man #2s; #2s flat → hook-curl zone ────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) {
          return zoneDrop(hookCurlS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── f. SS — deep third strong; #1s vertical → man ──────────────
      if (role === 'SAF_S') {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(deepTS);
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── e. Weak Corner — man #1w; under → Under call; hitch → Smash ──
      if (role === 'CB' && isWeak) {
        if (r1w && isUnder(r1w)) {
          persistentCovCalls.cs_underWeak = true;
          return zoneDrop(deepTW);
        }
        if (r1w && isHitch(r1w)) {
          persistentCovCalls.cs_smashWeak = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW);
      }

      // ── d. Weak Apex — man #2w; under → curl-flat; smash → #1w; push → rb ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isUnder(r2w)) {
          persistentCovCalls.cs_underWeak = true;
          return zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.cs_smashWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.cs_pushWeak) {
          return rb ? manCover(rb.id) : zoneDrop(curlFlatW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── c. Hook — hook zone weak; rb out → Push + man #2w; under → crosser ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Push call: rb out fast, can't reach rb but can reach #2w
        if (!persistentCovCalls.cs_pushWeak) {
          if (rb && isOut(rb) && !canReach(d, rb) && r2w && canReach(d, r2w)) {
            persistentCovCalls.cs_pushWeak = true;
            return manCover(r2w.id);
          }
        }
        if (persistentCovCalls.cs_pushWeak) {
          return r2w ? manCover(r2w.id) : zoneDrop(hookW);
        }
        // Under call → take the crosser
        if (persistentCovCalls.cs_underWeak) {
          const crossers = [r1w, r2w].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            return manCover(deepest.id);
          }
        }
        return zoneDrop(hookW);
      }

      // ── g. Free Safety — deep middle; #2 depth; #1 in-breaking ─────
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

