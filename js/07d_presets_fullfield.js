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
  // ── Cover 3 Cloud Strong 3×1 (Full Field, 3x1 only) ───────────────
  // Cloud side = Strong (Trips). Corner plays flat, SS plays deep third strong.
  // Weak side = simple man. FS = deep middle.
  // No persistentCovCalls needed — all live reads.
  'cover3-cloud-strong-3x1-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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
  'cover3-cloud-weak-3x1-bugged': {
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
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
  'cover3-cloud-strong-3x1-new-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      // ── a. Strong Corner — cloud flat; rob #1s underneath (don't follow vertical); else flat zone ──
      if (role === 'CB' && isStrong) {
        const flatRec = getCloudFlatRec(strongSide, r1s, r2s);
        if (flatRec) return manCover(flatRec.id);
        if (r1s && !isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(flatS);
      }

      // ── b. Strong Apex — man #2s; flat → hookCurlS; #2s ≥6y + #1s under → man #1s (not if WA locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return zoneDrop(hookCurlS);
        const d2s = lr(r2s)?.depthYards ?? 0;
        if (r2s && d2s >= 6 && r1s && isUnderRoute(r1s, lrState) && !isStickyLocked('cs3_cross_r1s') && stickyOnce('cs3_under_r1s_sa', true)) return manCover(r1s.id);
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

      // ── f. Weak Apex — RB to weak side → man RB; else hookCurlW and rob #1 under (not if SA locked) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb && isReleasedRoute(rb, lrState)) {
          const rbVx     = lr(rb)?.vel?.x ?? 0;
          const rbMoving = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = !!(rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('cs3_rbWeak_wa', rbGoingWeak)) return manCover(rb.id);
        }
        if (r1s && isUnderRoute(r1s, lrState) && !isStickyLocked('cs3_under_r1s_sa') && stickyOnce('cs3_cross_r1s', true)) return manCover(r1s.id);
        return zoneDrop(hookCurlW);
      }

      // ── g. SAF_W (FS) — deep middle; read #2s seam/post → man; else deep middle ──
      if (role === 'SAF_W') {
        if (r2s && isVertical(r2s) && stickyOnce('cs3_fs_r2s', true)) return manCover(r2s.id);
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
  'cover3-cloud-weak-3x1-new-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
  'cover3-cloud-strong-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (deep2s && deep2w) {
          const r2sCov = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === r2s.id);
          const r2wCov = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === r2w.id);
          if ( r2sCov && !r2wCov) return manCover(r2w.id);
          if (!r2sCov &&  r2wCov) return manCover(r2s.id);
          return { ...zoneDrop('DEEP_MIDDLE'), _midpointPlayers: [r2s.id, r2w.id] };
        }
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Cloud Strong 2×2 BOOK ─────────────────────────────────────
  // Strict implementation of the book rules:
  // a. Strong CB    — first to flat; else rob #1 underneath (curl zone)
  // b. Strong Apex  — man #2s; #2s flat → hook-curl
  // c. Strong Safety — deep third strong; #1s vertical → man
  // d. Hook         — hook zone weak; under call → take crosser
  // e. Weak Apex    — man #2w; #2w under → curl-flat (under call);
  //                   smash call → man #1w (hitch)
  // f. Weak CB (Mod) — man #1w; #1w under → deep third (under call);
  //                    #1w hitch → deep third (smash call, look for #2 corner)
  // g. Free Safety  — deep middle; #2 deep → man that #2;
  //                   no #2 deep → deny #1 vertical in-breaking;
  //                   else deep middle
  // persistentCovCalls prefix: csb_
  // ══════════════════════════════════════════════════════════════════════
  'cover3-cloud-strong-book-bugged': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const flatS      = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
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
          // a. Strong CB: flat zone (will reactively pick first to flat / rob #1)
          // f. Weak CB:   man #1w (Mod)
          case 'CB':
            if (isStrong) result.set(id, zoneDrop(flatS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW));
            break;
          // b. Strong Apex: man #2s
          // e. Weak Apex:   man #2w
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: hook zone weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookW));
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

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isHitch(p)    { return isHitchRoute(p, lrState); }
      function isVertical(p) { return isDeepVertical(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ════════════════════════════════════════════════════════════════
      // STRONG SIDE — Cloud rules
      // ════════════════════════════════════════════════════════════════

      // ── a. Strong CB — first to flat; else rob #1 underneath ────────
      if (role === 'CB' && isStrong) {
        // First receiver into the flat zone takes priority
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return manCover(r2s.id);
        if (r1s && isFlatRoute(r1s, strongSide, lrState, snapshot)) return manCover(r1s.id);
        // No flat threat → rob #1 underneath (curl zone, inside leverage)
        return zoneDrop(curlS);
      }

      // ── b. Strong Apex — man #2s; #2s flat → hook-curl ──────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isFlatRoute(r2s, strongSide, lrState, snapshot)) return zoneDrop(hookCurlS);
        return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
      }

      // ── c. Strong Safety — deep third strong; #1s vertical → man ────
      if (role === 'SAF_S') {
        if (r1s && isVertical(r1s)) return manCover(r1s.id);
        return zoneDrop(deepTS);
      }

      // ════════════════════════════════════════════════════════════════
      // WEAK SIDE — Cover 3 Match rules
      // ════════════════════════════════════════════════════════════════

      // ── f. Weak CB (Mod) — man #1w; under → Under call (deep third);
      //      hitch → Smash call (deep third) ─────────────────────────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('csb_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('csb_underW_cb')) persistentCovCalls.csb_underWeak = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('csb_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('csb_smashW')) persistentCovCalls.csb_smashWeak = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepTW);
      }

      // ── e. Weak Apex — man #2w; under → curl-flat (Under call);
      //      smash call → man #1w hitch ────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (stickyOnce('csb_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('csb_underW_wa')) persistentCovCalls.csb_underWeak = true;
          return zoneDrop(curlFlatW);
        }
        if (persistentCovCalls.csb_smashWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── d. Hook — hook zone weak; under call → take crosser ─────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.csb_underWeak) {
          const lockedId = getStickyTarget('csb_hook_crosser');
          if (lockedId) return manCover(lockedId);
          const crossers = [r1w, r2w].filter(p => p && isUnder(p));
          if (crossers.length > 0) {
            const deepest = crossers.reduce((a, b) =>
              (lr(a)?.depthYards ?? 0) >= (lr(b)?.depthYards ?? 0) ? a : b);
            lockStickyTarget('csb_hook_crosser', deepest.id);
            return manCover(deepest.id);
          }
        }
        return zoneDrop(hookW);
      }

      // ── g. Free Safety — deep middle; #2 deep → man;
      //      else deny #1 vertical in-breaking; else deep middle ─────
      if (role === 'SAF_W') {
        const d2s = lr(r2s)?.depthYards ?? 0;
        const d2w = lr(r2w)?.depthYards ?? 0;
        const deep2s = r2s && d2s >= 9;
        const deep2w = r2w && d2w >= 9;
        if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        // No #2 deep → deny vertical in-breaking by #1
        if (r1s && isVertInsideRoute(r1s, lrState)) return manCover(r1s.id);
        if (r1w && isVertInsideRoute(r1w, lrState)) return manCover(r1w.id);
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (deep2s && deep2w) {
          const r2sCov = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === r2s.id);
          const r2wCov = defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === r2w.id);
          if ( r2sCov && !r2wCov) return manCover(r2w.id);
          if (!r2sCov &&  r2wCov) return manCover(r2s.id);
          return { ...zoneDrop('DEEP_MIDDLE'), _midpointPlayers: [r2s.id, r2w.id] };
        }
        if (deep2s) return manCover(r2s.id);
        if (deep2w) return manCover(r2w.id);
        return zoneDrop('DEEP_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Tampa 2 Match 3×1 (bugged) ────────────────────────────────────
  // Old version — kept for A/B comparison.
  // Issue: SS/FS/Hook commit to man as soon as vertical detection fires —
  // no sticky confirm and no lateral engagement gate. Top-down can leave
  // the half too early and chase WRs they can't reach.
  // persistentCovCalls prefix: t2m3x1_
  'tampa2-match-3x1-bugged': {
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


  // ── Tampa 2 Match 3×1 (Full Field, 3x1 only) ──────────────────────
  // 2-high. Corners = flat. Safeties = deep half + vertical reads.
  // Hook = Tampa-Mike deep middle, has #3 vertical.
  // Weak Apex uses RB directly (no factory).
  // Match version: sticky 0.5s + canMatchVertical (6yd lateral) before man.
  // Pattern (analog to Cover 3 Match):
  //   1) Maintenance — if tookId already locked, stay on target
  //   2) Detection   — stickyOnce(0.5s) on vertical condition
  //   3) Engagement  — canMatchVertical (6yd lateral) gate before commit
  //   4) Default     — stay in deep half / DEEP_MIDDLE during wait
  // persistentCovCalls prefix: t2m3_
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
          case 'CB':
            result.set(id, zoneDrop(isStrong ? flatS : flatW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookCurlS));
            if (isWeak)   result.set(id, rb ? manCover(rb.id) : zoneDrop(hookCurlW));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS));
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
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n)      { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)          { return p ? lrState[p.id] : null; }
      function isVertical(p)  { return isDeepVertical(p, lrState); }

      // Engagement gate — defender only commits to a vertical match when WR
      // is close enough laterally. Prevents top-down chasing across the field.
      const VERT_MATCH_LATERAL_YDS = 6;
      function canMatchVertical(def, wr) {
        if (!def || !wr) return false;
        const dx = def.simX ?? def.x;
        const wx = wr.simX ?? wr.x;
        const lateralGap = Math.abs(dx - wx) / YARD_PX;
        return lateralGap < VERT_MATCH_LATERAL_YDS;
      }

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

      // ── c. Hook — Tampa-Mike (sticky + engagement gate on #3 vert) ─
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // (1) Maintenance
        if (persistentCovCalls.t2m3_hookTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.t2m3_hookTookId);
          if (tgt) return manCover(tgt.id);
          persistentCovCalls.t2m3_hookTookId = null;
        }
        // (2+3) #3 vertical sticky + gate
        const r3sVert = !!(r3s && isVertical(r3s));
        if (stickyOnce('t2m3_hookR3Vert', r3sVert)
            && (isStickyLocked('t2m3_hookR3Vert') || r3sVert)
            && canMatchVertical(d, r3s)) {
          persistentCovCalls.t2m3_hookTookId = r3s.id;
          return manCover(r3s.id);
        }
        // (4) Default — Tampa-Mike deep middle
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── d. SS — deep half strong (sticky + engagement gate) ───────
      if (role === 'SAF_S') {
        // (1) Maintenance
        if (persistentCovCalls.t2m3_ssTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.t2m3_ssTookId);
          if (tgt) {
            // If the locked target was an OTT (#2s/#3s), maintain as ottDec
            if (persistentCovCalls.t2m3_ssTookKind === 'ott') return ottDec(tgt.id);
            return manCover(tgt.id);
          }
          persistentCovCalls.t2m3_ssTookId = null;
          persistentCovCalls.t2m3_ssTookKind = null;
        }
        // (2+3) #1s vertical → man (sticky + gate)
        const r1sVert = !!(r1s && isVertical(r1s));
        if (stickyOnce('t2m3_ssR1Vert', r1sVert)
            && (isStickyLocked('t2m3_ssR1Vert') || r1sVert)
            && canMatchVertical(d, r1s)) {
          persistentCovCalls.t2m3_ssTookId   = r1s.id;
          persistentCovCalls.t2m3_ssTookKind = 'man';
          return manCover(r1s.id);
        }
        // #1s not vertical → OTT on deepest vertical #2s/#3s (sticky + gate)
        const r2sVert = !!(r2s && isVertical(r2s) && !r1sVert);
        if (stickyOnce('t2m3_ssR2OTT', r2sVert)
            && (isStickyLocked('t2m3_ssR2OTT') || r2sVert)
            && canMatchVertical(d, r2s)) {
          persistentCovCalls.t2m3_ssTookId   = r2s.id;
          persistentCovCalls.t2m3_ssTookKind = 'ott';
          return ottDec(r2s.id);
        }
        const r3sVertS = !!(r3s && isVertical(r3s) && !r1sVert && !(r2s && isVertical(r2s)));
        if (stickyOnce('t2m3_ssR3OTT', r3sVertS)
            && (isStickyLocked('t2m3_ssR3OTT') || r3sVertS)
            && canMatchVertical(d, r3s)) {
          persistentCovCalls.t2m3_ssTookId   = r3s.id;
          persistentCovCalls.t2m3_ssTookKind = 'ott';
          return ottDec(r3s.id);
        }
        // (4) Default — deep half
        return zoneDrop(deepHS);
      }

      // ── f. FS — deep half weak (sticky + engagement gate) ─────────
      if (role === 'SAF_W') {
        if (persistentCovCalls.t2m3_fsTookId) {
          const tgt = [...eligible, ...(rb ? [rb] : [])].find(p => p.id === persistentCovCalls.t2m3_fsTookId);
          if (tgt) return manCover(tgt.id);
          persistentCovCalls.t2m3_fsTookId = null;
        }
        const r1wVert = !!(r1w && isVertical(r1w));
        if (stickyOnce('t2m3_fsR1Vert', r1wVert)
            && (isStickyLocked('t2m3_fsR1Vert') || r1wVert)
            && canMatchVertical(d, r1w)) {
          persistentCovCalls.t2m3_fsTookId = r1w.id;
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
  'cover3-sky-2x2-match-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // d. Hook: zone hook curl weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // c.iii: RB releasing strong + SS still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => def.id !== d.id &&
              frozenRoleMap?.get(def.id) === 'SAF_S' &&
              def.decision?.mode === 'follow' &&
              def.decision?.focusTargetId === r2s.id))
          return manCover(rb.id);
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        // d.i:   Under call from strong side (locked) → pick up uncovered strong crosser
        if (persistentCovCalls.nsk2_underS) {
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
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
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
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
  // ── New Sky 2×2 NEW (Full Field, 2x2 only) — TEST COPY ────────────
  // Identical to cover3-sky-2x2-match-bugged — use for testing changes.
  // persistentCovCalls prefix: nsk2new_  (separated from nsk2_ to avoid state collision)
  'cover3-sky-2x2-match-new-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // d. Hook: zone hook curl weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('nsk2new_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('nsk2new_underS_cb')) persistentCovCalls.nsk2new_underS = true;
          return zoneDrop(deepTS);
        }
        // ii. #1s hitch → Smash call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2new_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nsk2new_smashS')) persistentCovCalls.nsk2new_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety ──────────────────────────────────────────────
      if (role === 'SAF_S') {
        // i. #2s under → Under call strong (sticky 0.5s)
        if (stickyOnce('nsk2new_underS_ss', !!(r2s && isUnder(r2s)))) {
          if (isStickyLocked('nsk2new_underS_ss')) persistentCovCalls.nsk2new_underS = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (stickyOnce('nsk2new_rbGlobal_strong', rbGoingStrong)) {
            if (persistentCovCalls.nsk2new_smashS) return zoneDrop(curlFlatS);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // ii. Smash call strong (locked) → cover #1s on hitch
        if (persistentCovCalls.nsk2new_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        // iii. NEW: RB releases strong → distance-based decision (fast+late combined)
        //      SS closer to RB than Strong Apex → Push call: SS takes RB, Apex takes #2s
        //      Strong Apex closer → late scenario: Apex takes RB, SS stays on #2s
        {
          const rbLr2 = lr(rb); const rbVx2 = rbLr2?.vel?.x ?? 0;
          const rbMoving2 = rbLr2?.moveType !== 'stopped';
          const rbGoingStrong = !!(rb && rbMoving2 && (strongSide === 'L' ? rbVx2 < 0 : rbVx2 > 0));
          if (rbGoingStrong) {
            if (!persistentCovCalls.nsk2new_rbStrongDecided) {
              const strongApex = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
                const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
                return (dsx <= ballX ? 'L' : 'R') === strongSide;
              });
              if (strongApex) {
                const ssX = d.simX ?? d.x, ssY = d.simY ?? d.y;
                const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
                const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
                persistentCovCalls.nsk2new_rbStrongDecided = true;
                persistentCovCalls.nsk2new_pushStrong =
                  Math.hypot(ssX - rbX, ssY - rbY) < Math.hypot(apX - rbX, apY - rbY);
              }
            }
            if (persistentCovCalls.nsk2new_pushStrong) return manCover(rb.id);
          }
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
        if (persistentCovCalls.nsk2new_underW) {
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // c.iii: NEW — RB releases strong → distance-based decision (mirror SAF_S)
        //        Push (SS closer) → I take #2s man
        //        Late  (Apex closer) → I take RB man
        if (rbGoingStrong && rb) {
          if (!persistentCovCalls.nsk2new_rbStrongDecided) {
            const ss = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_S');
            if (ss) {
              const ssX = ss.simX ?? ss.x, ssY = ss.simY ?? ss.y;
              const apX = d.simX ?? d.x,   apY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.nsk2new_rbStrongDecided = true;
              persistentCovCalls.nsk2new_pushStrong =
                Math.hypot(ssX - rbX, ssY - rbY) < Math.hypot(apX - rbX, apY - rbY);
            }
          }
          if (persistentCovCalls.nsk2new_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.nsk2new_rbStrongDecided && !persistentCovCalls.nsk2new_pushStrong)
            return manCover(rb.id);
        }
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        // d.i:   Under call from strong side (locked) → pick up uncovered strong crosser
        if (persistentCovCalls.nsk2new_underS) {
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // d.iii: NEW — RB releases weak → distance-based decision (mirror Weak Apex)
        //        Push (WeakApex closer) → I take #2w man
        //        Late  (Hook closer)     → I take RB man
        if (rbGoingWeak && rb) {
          if (!persistentCovCalls.nsk2new_rbWeakDecided) {
            const wapex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === weakSide;
            });
            if (wapex) {
              const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
              const hkX = d.simX ?? d.x,         hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
              persistentCovCalls.nsk2new_rbWeakDecided = true;
              persistentCovCalls.nsk2new_pushWeak =
                Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.nsk2new_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.nsk2new_rbWeakDecided && !persistentCovCalls.nsk2new_pushWeak)
            return manCover(rb.id);
        }
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // i. #2w under → Under call weak (sticky 0.5s)
        if (stickyOnce('nsk2new_underW_wa', !!(r2w && isUnder(r2w)))) {
          if (isStickyLocked('nsk2new_underW_wa')) persistentCovCalls.nsk2new_underW = true;
          const rbLr = lr(rb); const rbVx = rbLr?.vel?.x ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));
          if (!persistentCovCalls.nsk2new_rbGlobal_strong && rbGoingWeak) {
            if (persistentCovCalls.nsk2new_smashW) return zoneDrop(curlFlatW);
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        // ii. Smash call weak (locked) → cover #1w on hitch
        if (persistentCovCalls.nsk2new_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        // iii. NEW: RB releases weak → distance-based decision (fast+late combined)
        //      Weak Apex closer to RB than Hook → Push call: I take RB, Hook takes #2w
        //      Hook closer → late scenario: Hook takes RB, I stay on #2w
        {
          const rbLr3 = lr(rb); const rbVx3 = rbLr3?.vel?.x ?? 0;
          const rbMoving3 = rbLr3?.moveType !== 'stopped';
          const rbGoingWeak = !!(rb && rbMoving3 && (weakSide === 'L' ? rbVx3 < 0 : rbVx3 > 0));
          if (rbGoingWeak) {
            if (!persistentCovCalls.nsk2new_rbWeakDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const waX = d.simX ?? d.x,       waY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.nsk2new_rbWeakDecided = true;
                persistentCovCalls.nsk2new_pushWeak =
                  Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.nsk2new_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2new_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('nsk2new_underW_cb')) persistentCovCalls.nsk2new_underW = true;
          return zoneDrop(deepTW);
        }
        // ii. #1w hitch → Smash call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('nsk2new_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('nsk2new_smashW')) persistentCovCalls.nsk2new_smashW = true;
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
  // ── Cover 3 Muffin Match (Full Field, 2x2) — RELATE-FIRST EXPERIMENT
  // Base copy of cover3-sky-2x2-match-new-bugged (with push-call distance heuristic).
  // Will iteratively get relate-first / top-down logic on top.
  // persistentCovCalls prefix: mufm_
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // d. Hook: zone hook curl weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      // ── Phase-A helpers: Relate-First gating ─────────────────────────
      // Y-convention in this codebase: smaller simY = more upfield ("deeper").
      // So defender deeper than WR ⇔ d.simY < wr.simY.
      const YPX = (typeof YARD_PX !== 'undefined') ? YARD_PX : 20;
      const LATERAL_THRESH_YDS   = 5;   // RB must move ≥5yd laterally before match
      const SUSTAINED_DIR_SECS   = 0.5; // RB direction must hold ≥0.5s before match
      const RB_MATCH_MIN_TIME    = 1.0; // hard floor: no RB-match before 1.0s ("drop first")
      const RB_FLAT_DEPTH_YDS    = 2;   // RB must be within 2yd of LOS (flat-route depth)
      const CROSSER_LATERAL_YDS  = 6;   // crosser within 6yd LATERAL of defender → engage
      const UNDER_DECLARE_YDS    = 2;   // #2 must move ≥2yd laterally before Under-call
      const _pt = (typeof playPhaseTime !== 'undefined') ? playPhaseTime : 0;

      // RB committed to a side: time-gated + flat-depth + lateral + sustained direction
      function rbCommittedTo(side) {
        if (!rb) return false;
        // Hard floor: don't even consider RB-match before 1.0s (zone-drop first)
        if (_pt < RB_MATCH_MIN_TIME) return false;
        const rbLrX = lr(rb);
        if (!rbLrX) return false;
        if (rbLrX.moveType === 'stopped') return false;
        // RB must be at/near LOS depth (real flat release, not still blocking in backfield)
        const depthAbs = Math.abs(rbLrX.depthYards ?? 0);
        if (depthAbs > RB_FLAT_DEPTH_YDS) return false;
        const vx = rbLrX.vel?.x ?? 0;
        const movingThatWay = side === 'L' ? vx < 0 : vx > 0;
        if (!movingThatWay) return false;
        const initX = rbLrX.initPos?.x ?? rbLrX.pos?.x ?? 0;
        const curX  = rbLrX.pos?.x ?? 0;
        if (Math.abs(curX - initX) < LATERAL_THRESH_YDS * YPX) return false;
        const sinceChange = _pt - (rbLrX.lastDecisionChangeAt ?? 0);
        if (sinceChange < SUSTAINED_DIR_SECS) return false;
        return true;
      }

      // Receiver has truly declared a route (lateral commit beyond release noise)
      function hasDeclared(p, minYds) {
        const plr = lr(p);
        if (!plr) return false;
        const initX = plr.initPos?.x ?? plr.pos?.x ?? 0;
        const curX  = plr.pos?.x ?? 0;
        return Math.abs(curX - initX) >= (minYds * YPX);
      }

      // Defender can match a crosser. Engage when EITHER:
      //   - WR has crossed midfield to defender's side (committed cross), OR
      //   - WR is laterally close to defender (within CROSSER_LATERAL_YDS)
      // NOTE: depth check removed — sticky lock now handles maintenance, so we
      // no longer self-disqualify when the defender naturally moves to intercept.
      // Top-down behavior emerges from zone snap position + sticky lock.
      function canMatchCrosser(def, wr) {
        if (!def || !wr) return false;
        const wrLr = lr(wr);
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        const hasCrossedMid = !!(wrLr && wrLr.crossedMiddleNow);
        const lateralGap   = Math.abs(dx - wx);
        const isLatClose   = lateralGap < CROSSER_LATERAL_YDS * YPX;
        return hasCrossedMid || isLatClose;
      }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('mufm_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('mufm_underS_cb')) persistentCovCalls.mufm_underS = true;
          return zoneDrop(deepTS);
        }
        // ii. #1s hitch → Smash call strong (sticky 0.5s) + bail deep third
        if (stickyOnce('mufm_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('mufm_smashS')) persistentCovCalls.mufm_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety ──────────────────────────────────────────────
      if (role === 'SAF_S') {
        // STEP 1: Detect Under-call (sets persistent flag for Hook to read),
        //         but DO NOT return yet — smash needs priority below.
        const underTrigS = stickyOnce('mufm_underS_ss', !!(r2s && isUnder(r2s)));
        if (underTrigS && isStickyLocked('mufm_underS_ss')) {
          persistentCovCalls.mufm_underS = true;
        }
        // ii. Smash call PRIORITY: #1s hitch → cover #1 man, beats under-call action.
        //     Even if #2 also went under, smash is the more urgent coverage call.
        if (persistentCovCalls.mufm_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        // i. Under-call action (only reached if no smash): bail to curl-flat,
        //    or take RB if RB is fully committed strong.
        if (underTrigS) {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (stickyOnce('mufm_rbGlobal_strong', rbGoingStrong)) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // iii. RB releases strong → distance-based decision (fast+late combined)
        //      PHASE-A: only fire once RB is COMMITTED (lateral + sustained), not on first step.
        //      Below threshold → SS stays on #2s man (= relate to #2s).
        //      SS closer to RB than Strong Apex → Push call: SS takes RB, Apex takes #2s
        //      Strong Apex closer → late scenario: Apex takes RB, SS stays on #2s
        {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (rbGoingStrong) {
            if (!persistentCovCalls.mufm_rbStrongDecided) {
              const strongApex = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
                const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
                return (dsx <= ballX ? 'L' : 'R') === strongSide;
              });
              if (strongApex) {
                const ssX = d.simX ?? d.x, ssY = d.simY ?? d.y;
                const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
                const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
                persistentCovCalls.mufm_rbStrongDecided = true;
                persistentCovCalls.mufm_pushStrong =
                  Math.hypot(ssX - rbX, ssY - rbY) < Math.hypot(apX - rbX, apY - rbY);
              }
            }
            if (persistentCovCalls.mufm_pushStrong) return manCover(rb.id);
          }
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── c. Strong Apex ────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // PHASE-A: use committed-to-side instead of raw vel direction
        const rbGoingStrong = rbCommittedTo(strongSide);

        // c.i:   Under call from weak side (locked) → pick up uncovered weak crosser
        //        PHASE-A: top-down gate ONLY for initial engagement.
        //        Once engaged, sticky lock keeps Apex on the crosser even when geometry
        //        flips (i.e. Apex moves to intercept and becomes shallower than WR).
        if (persistentCovCalls.mufm_underW) {
          // (a) Sticky maintenance: already locked onto a crosser → stay on him
          const lockedId = persistentCovCalls.mufm_apexCrosserId;
          if (lockedId) {
            const lockedWr = [r2w, r1w].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            // locked target gone (rare) → clear and re-scan
            persistentCovCalls.mufm_apexCrosserId = null;
          }
          // (b) Initial engagement: scan for uncovered crosser passing top-down gate
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.mufm_apexCrosserId = crosser.id; // LOCK
            return manCover(crosser.id);
          }
        }
        // c.iii: RB releases strong → distance-based decision (mirror SAF_S)
        //        PHASE-A: only fire once RB is COMMITTED (lateral + sustained).
        //        PHASE-A FIX: skip push entirely if Under-call from strong is active —
        //                     #2s has gone under, Hook is the right defender for the crosser.
        //                     Strong Apex stays in zone instead of stealing #2s.
        //        Push (SS closer) → I take #2s man
        //        Late  (Apex closer) → I take RB man
        if (rbGoingStrong && rb && !persistentCovCalls.mufm_underS) {
          if (!persistentCovCalls.mufm_rbStrongDecided) {
            const ss = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_S');
            if (ss) {
              const ssX = ss.simX ?? ss.x, ssY = ss.simY ?? ss.y;
              const apX = d.simX ?? d.x,   apY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.mufm_rbStrongDecided = true;
              persistentCovCalls.mufm_pushStrong =
                Math.hypot(ssX - rbX, ssY - rbY) < Math.hypot(apX - rbX, apY - rbY);
            }
          }
          if (persistentCovCalls.mufm_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.mufm_rbStrongDecided && !persistentCovCalls.mufm_pushStrong)
            return manCover(rb.id);
        }
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // PHASE-A: use committed-to-side instead of raw vel direction
        const rbGoingWeak = rbCommittedTo(weakSide);

        // d.i:   Under call from strong side (locked) → pick up uncovered strong crosser
        //        PHASE-A: top-down gate ONLY for initial engagement.
        //        Once engaged, sticky lock keeps Hook on the crosser even when geometry
        //        flips (i.e. Hook moves to intercept and becomes shallower than WR).
        if (persistentCovCalls.mufm_underS) {
          // (a) Sticky maintenance: already locked onto a crosser → stay on him
          const lockedId = persistentCovCalls.mufm_hookCrosserId;
          if (lockedId) {
            const lockedWr = [r2s, r1s].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            // locked target gone (rare) → clear and re-scan
            persistentCovCalls.mufm_hookCrosserId = null;
          }
          // (b) Initial engagement: scan for uncovered crosser passing top-down gate
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.mufm_hookCrosserId = crosser.id; // LOCK
            return manCover(crosser.id);
          }
        }
        // d.iii: RB releases weak → distance-based decision (mirror Weak Apex)
        //        PHASE-A: only fire once RB is COMMITTED (lateral + sustained).
        //        PHASE-A FIX: skip push entirely if Under-call from weak is active —
        //                     #2w has gone under, Strong Apex is the right defender for the crosser.
        //                     Hook stays in zone instead of stealing #2w.
        //        Push (WeakApex closer) → I take #2w man
        //        Late  (Hook closer)     → I take RB man
        if (rbGoingWeak && rb && !persistentCovCalls.mufm_underW) {
          if (!persistentCovCalls.mufm_rbWeakDecided) {
            const wapex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === weakSide;
            });
            if (wapex) {
              const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
              const hkX = d.simX ?? d.x,         hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
              persistentCovCalls.mufm_rbWeakDecided = true;
              persistentCovCalls.mufm_pushWeak =
                Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.mufm_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.mufm_rbWeakDecided && !persistentCovCalls.mufm_pushWeak)
            return manCover(rb.id);
        }
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
      }

      // ── e. Weak Apex ──────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        // STEP 1: Detect Under-call (sets flag for Strong Apex to read crosser).
        //         Don't return — smash priority below.
        const underTrigW = stickyOnce('mufm_underW_wa', !!(r2w && isUnder(r2w)));
        if (underTrigW && isStickyLocked('mufm_underW_wa')) {
          persistentCovCalls.mufm_underW = true;
        }
        // ii. Smash call PRIORITY: #1w hitch → cover #1w man, beats under-call action.
        if (persistentCovCalls.mufm_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        // i. Under-call action (only reached if no smash): bail to curl-flat,
        //    or take RB if RB is fully committed weak.
        if (underTrigW) {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (!persistentCovCalls.mufm_rbGlobal_strong && rbGoingWeak) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        // iii. RB releases weak → distance-based decision (fast+late combined)
        //      PHASE-A: only fire once RB is COMMITTED (lateral + sustained).
        //      Below threshold → I stay on #2w man (= relate).
        //      Weak Apex closer to RB than Hook → Push call: I take RB, Hook takes #2w
        //      Hook closer → late scenario: Hook takes RB, I stay on #2w
        {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (rbGoingWeak) {
            if (!persistentCovCalls.mufm_rbWeakDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const waX = d.simX ?? d.x,       waY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.mufm_rbWeakDecided = true;
                persistentCovCalls.mufm_pushWeak =
                  Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.mufm_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        // i. #1w under → Under call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('mufm_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('mufm_underW_cb')) persistentCovCalls.mufm_underW = true;
          return zoneDrop(deepTW);
        }
        // ii. #1w hitch → Smash call weak (sticky 0.5s) + bail deep third
        if (stickyOnce('mufm_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('mufm_smashW')) persistentCovCalls.mufm_smashW = true;
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
  // Mirror of Cover 3 Sky 2×2 Match — SAF_S and Strong Apex swap jobs:
  //   - SAF_S plays the zone hookCurlS role (Sky: Strong Apex's job).
  //   - Strong Apex mans #2s (Sky: SAF_S's job).
  //   - Cross-reads flipped: where Sky's SS partner lookup happened, Buzz
  //     looks for Strong Apex (and vice versa). Push semantic preserved:
  //     the MAN defender (now Strong Apex) takes RB when closer; the ZONE
  //     defender (now SAF_S) takes #2s on push, or RB late.
  // persistentCovCalls prefix: cbz2_
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // b. Strong Safety: zone hook curl strong  (BUZZ SWAP: was man #2s in Sky)
          case 'SAF_S':
            result.set(id, zoneDrop(hookCurlS));
            break;
          // c. Strong Apex: man #2s  (BUZZ SWAP: was zone hookCurlS in Sky)
          //    Weak Apex: man #2w
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: zone hook curl weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      // ── Phase-A helpers (identical to Sky 2×2 Match) ─────────────────
      const YPX = (typeof YARD_PX !== 'undefined') ? YARD_PX : 20;
      const LATERAL_THRESH_YDS   = 5;
      const SUSTAINED_DIR_SECS   = 0.5;
      const RB_MATCH_MIN_TIME    = 1.0;
      const RB_FLAT_DEPTH_YDS    = 2;
      const CROSSER_LATERAL_YDS  = 6;
      const _pt = (typeof playPhaseTime !== 'undefined') ? playPhaseTime : 0;

      function rbCommittedTo(side) {
        if (!rb) return false;
        if (_pt < RB_MATCH_MIN_TIME) return false;
        const rbLrX = lr(rb);
        if (!rbLrX) return false;
        if (rbLrX.moveType === 'stopped') return false;
        const depthAbs = Math.abs(rbLrX.depthYards ?? 0);
        if (depthAbs > RB_FLAT_DEPTH_YDS) return false;
        const vx = rbLrX.vel?.x ?? 0;
        const movingThatWay = side === 'L' ? vx < 0 : vx > 0;
        if (!movingThatWay) return false;
        const initX = rbLrX.initPos?.x ?? rbLrX.pos?.x ?? 0;
        const curX  = rbLrX.pos?.x ?? 0;
        if (Math.abs(curX - initX) < LATERAL_THRESH_YDS * YPX) return false;
        const sinceChange = _pt - (rbLrX.lastDecisionChangeAt ?? 0);
        if (sinceChange < SUSTAINED_DIR_SECS) return false;
        return true;
      }

      function canMatchCrosser(def, wr) {
        if (!def || !wr) return false;
        const wrLr = lr(wr);
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        const hasCrossedMid = !!(wrLr && wrLr.crossedMiddleNow);
        const lateralGap   = Math.abs(dx - wx);
        const isLatClose   = lateralGap < CROSSER_LATERAL_YDS * YPX;
        return hasCrossedMid || isLatClose;
      }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('cbz2_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('cbz2_underS_cb')) persistentCovCalls.cbz2_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('cbz2_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('cbz2_smashS')) persistentCovCalls.cbz2_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety  (BUZZ SWAP: plays Sky's Strong-Apex job) ────
      //   Zone hookCurlS, weak-crosser pickup on Under-W, push decision
      //   where the partner is now Strong Apex (the man defender on #2s).
      if (role === 'SAF_S') {
        const rbGoingStrong = rbCommittedTo(strongSide);

        // i. Under call from weak side → pick up uncovered weak crosser
        if (persistentCovCalls.cbz2_underW) {
          const lockedId = persistentCovCalls.cbz2_ssCrosserId;
          if (lockedId) {
            const lockedWr = [r2w, r1w].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.cbz2_ssCrosserId = null;
          }
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.cbz2_ssCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        // ii. RB releases strong → distance push vs Strong Apex partner.
        //     Skip if Under-S active (man defender already bailed; Hook owns crosser).
        //     pushStrong = (Apex closer to RB than SS).
        //     pushStrong true  → SS (me, zone) takes #2s (Apex pushed off to RB).
        //     pushStrong false → SS takes RB late (Apex too far to chase).
        if (rbGoingStrong && rb && !persistentCovCalls.cbz2_underS) {
          if (!persistentCovCalls.cbz2_rbStrongDecided) {
            const strongApex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === strongSide;
            });
            if (strongApex) {
              const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
              const ssX = d.simX ?? d.x,                   ssY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.cbz2_rbStrongDecided = true;
              persistentCovCalls.cbz2_pushStrong =
                Math.hypot(apX - rbX, apY - rbY) < Math.hypot(ssX - rbX, ssY - rbY);
            }
          }
          if (persistentCovCalls.cbz2_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.cbz2_rbStrongDecided && !persistentCovCalls.cbz2_pushStrong)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlS);
      }

      // ── c. Strong Apex  (BUZZ SWAP: plays Sky's SAF_S job) ────────────
      //   Mans #2s, writes Under-S, smash priority, push decision where
      //   the partner is now SAF_S (the zone defender in hookCurlS).
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // STEP 1: detect Under-call (sets flag for Hook to read crossers).
        const underTrigS = stickyOnce('cbz2_underS_sa', !!(r2s && isUnder(r2s)));
        if (underTrigS && isStickyLocked('cbz2_underS_sa')) {
          persistentCovCalls.cbz2_underS = true;
        }
        // ii. Smash PRIORITY: #1s hitch → cover #1 man, beats under-call action.
        if (persistentCovCalls.cbz2_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        // i. Under-call action: bail to curl-flat, or take RB if RB committed strong.
        if (underTrigS) {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (stickyOnce('cbz2_rbGlobal_strong', rbGoingStrong)) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // iii. RB releases strong → distance push vs SAF_S partner.
        //      pushStrong = (Apex closer to RB than SS).
        //      pushStrong true → I (Apex, the man defender) push off #2s to take RB.
        {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (rbGoingStrong) {
            if (!persistentCovCalls.cbz2_rbStrongDecided) {
              const ss = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_S');
              if (ss) {
                const apX = d.simX ?? d.x,   apY = d.simY ?? d.y;
                const ssX = ss.simX ?? ss.x, ssY = ss.simY ?? ss.y;
                const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
                persistentCovCalls.cbz2_rbStrongDecided = true;
                persistentCovCalls.cbz2_pushStrong =
                  Math.hypot(apX - rbX, apY - rbY) < Math.hypot(ssX - rbX, ssY - rbY);
              }
            }
            if (persistentCovCalls.cbz2_pushStrong) return manCover(rb.id);
          }
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (unchanged vs Sky) ───────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbGoingWeak = rbCommittedTo(weakSide);

        if (persistentCovCalls.cbz2_underS) {
          const lockedId = persistentCovCalls.cbz2_hookCrosserId;
          if (lockedId) {
            const lockedWr = [r2s, r1s].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.cbz2_hookCrosserId = null;
          }
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.cbz2_hookCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        if (rbGoingWeak && rb && !persistentCovCalls.cbz2_underW) {
          if (!persistentCovCalls.cbz2_rbWeakDecided) {
            const wapex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === weakSide;
            });
            if (wapex) {
              const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
              const hkX = d.simX ?? d.x,         hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
              persistentCovCalls.cbz2_rbWeakDecided = true;
              persistentCovCalls.cbz2_pushWeak =
                Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.cbz2_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.cbz2_rbWeakDecided && !persistentCovCalls.cbz2_pushWeak)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── e. Weak Apex (unchanged vs Sky) ──────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const underTrigW = stickyOnce('cbz2_underW_wa', !!(r2w && isUnder(r2w)));
        if (underTrigW && isStickyLocked('cbz2_underW_wa')) {
          persistentCovCalls.cbz2_underW = true;
        }
        if (persistentCovCalls.cbz2_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        if (underTrigW) {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (!persistentCovCalls.cbz2_rbGlobal_strong && rbGoingWeak) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (rbGoingWeak) {
            if (!persistentCovCalls.cbz2_rbWeakDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const waX = d.simX ?? d.x,       waY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.cbz2_rbWeakDecided = true;
                persistentCovCalls.cbz2_pushWeak =
                  Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.cbz2_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('cbz2_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('cbz2_underW_cb')) persistentCovCalls.cbz2_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('cbz2_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('cbz2_smashW')) persistentCovCalls.cbz2_smashW = true;
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
  // ── Cover 3 M (Buzz) — Hook-Code refactor experiment ─────────────
  // Initial copy: identical to cover3-buzz-2x2-match with prefix renamed
  // from cbz2_ to bzm_ to avoid state collision. Hook-Code refactor (Final 3
  // detection, Mirror function, isFlatRoute-based Push) will be applied
  // incrementally to SAF_S and Hook (the two zone-hook defenders in Buzz).
  // persistentCovCalls prefix: bzm_
  'cover3-buzz-m': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
            result.set(id, zoneDrop(hookCurlS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }

      const YPX = (typeof YARD_PX !== 'undefined') ? YARD_PX : 20;
      const LATERAL_THRESH_YDS   = 5;
      const SUSTAINED_DIR_SECS   = 0.5;
      const RB_MATCH_MIN_TIME    = 1.0;
      const RB_FLAT_DEPTH_YDS    = 2;
      const CROSSER_LATERAL_YDS  = 6;
      const _pt = (typeof playPhaseTime !== 'undefined') ? playPhaseTime : 0;

      function rbCommittedTo(side) {
        if (!rb) return false;
        if (_pt < RB_MATCH_MIN_TIME) return false;
        const rbLrX = lr(rb);
        if (!rbLrX) return false;
        if (rbLrX.moveType === 'stopped') return false;
        const depthAbs = Math.abs(rbLrX.depthYards ?? 0);
        if (depthAbs > RB_FLAT_DEPTH_YDS) return false;
        const vx = rbLrX.vel?.x ?? 0;
        const movingThatWay = side === 'L' ? vx < 0 : vx > 0;
        if (!movingThatWay) return false;
        const initX = rbLrX.initPos?.x ?? rbLrX.pos?.x ?? 0;
        const curX  = rbLrX.pos?.x ?? 0;
        if (Math.abs(curX - initX) < LATERAL_THRESH_YDS * YPX) return false;
        const sinceChange = _pt - (rbLrX.lastDecisionChangeAt ?? 0);
        if (sinceChange < SUSTAINED_DIR_SECS) return false;
        return true;
      }

      function canMatchCrosser(def, wr) {
        if (!def || !wr) return false;
        const wrLr = lr(wr);
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        const hasCrossedMid = !!(wrLr && wrLr.crossedMiddleNow);
        const lateralGap   = Math.abs(dx - wx);
        const isLatClose   = lateralGap < CROSSER_LATERAL_YDS * YPX;
        return hasCrossedMid || isLatClose;
      }

      // ── Hook-Code helpers (Coach's Final-3 / Mirror framework) ──────
      // isFlat: thin wrapper around existing isFlatRoute. Returns true if
      // the player is in the flat zone (≤3yd-beyond / ≤5yd-behind LOS AND
      // outside the curl-flat boundary toward the sideline).
      function isFlat(p, side) {
        return isFlatRoute(p, side, lrState, snapshot);
      }

      // xPositionsEqual: lateral proximity gate for Hook → Final 3 matching
      // when an opposite-side under-call fires. Coach: "match sobald x-positions
      // are equal" — we use a 1.5yd tolerance because exact equality is unrealistic.
      const X_EQUAL_THRESH_YDS = 1.5;
      function xPositionsEqual(def, wr) {
        if (!def || !wr) return false;
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        return Math.abs(dx - wx) <= X_EQUAL_THRESH_YDS * YPX;
      }

      // getFinalThree: dynamic "Number 3" on a given side.
      // Priority: RB if released to this side, else first crosser arriving
      // from opposite side. Returns null if neither applies.
      // Sticky-locked once chosen via persistentCovCalls.bzm_final3<Side>
      // so we don't flip-flop between candidates mid-play.
      function getFinalThree(side) {
        const stickyKey = side === strongSide ? 'bzm_final3Strong' : 'bzm_final3Weak';
        const lockedId = persistentCovCalls[stickyKey];
        if (lockedId) {
          if (rb && rb.id === lockedId) return rb;
          const found = eligible.find(p => p.id === lockedId);
          if (found) return found;
          persistentCovCalls[stickyKey] = null;
        }
        // Priority 1: RB committed to this side
        if (rb && rbCommittedTo(side)) {
          persistentCovCalls[stickyKey] = rb.id;
          return rb;
        }
        // Priority 2: crosser from opposite side now on my side
        const oppR1 = side === strongSide ? r1w : r1s;
        const oppR2 = side === strongSide ? r2w : r2s;
        for (const p of [oppR2, oppR1]) {
          if (!p) continue;
          const plr = lr(p);
          if (!plr) continue;
          if (!plr.crossedMiddleNow) continue;
          const px = plr.pos?.x ?? p.simX ?? p.x;
          const pCurSide = (px <= ballX) ? 'L' : 'R';
          if (pCurSide !== side) continue;
          persistentCovCalls[stickyKey] = p.id;
          return p;
        }
        return null;
      }

      // zoneDropTrackingX: zoneDrop with X-coordinate shadowing the tracked
      // player (Coach's Mirror function), clamped to hook-zone X-range.
      // Y stays at landmark Y. Uses _shadedLandmarkPos like the safety-
      // midpoint mechanism in run_pass.js.
      function zoneDropTrackingX(landmarkId, trackPlayer, xMin, xMax) {
        const dec = zoneDrop(landmarkId);
        if (trackPlayer && typeof getLandmarkPos === 'function') {
          const base = getLandmarkPos(landmarkId);
          if (base) {
            const tx = trackPlayer.simX ?? trackPlayer.x;
            const shadedX = Math.max(xMin, Math.min(xMax, tx));
            dec._shadedLandmarkPos = { x: shadedX, y: base.y };
          }
        }
        return dec;
      }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('bzm_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('bzm_underS_cb')) persistentCovCalls.bzm_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('bzm_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('bzm_smashS')) persistentCovCalls.bzm_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (Buzz: zone hookCurlS) ──────────────────────
      if (role === 'SAF_S') {
        const rbGoingStrong = rbCommittedTo(strongSide);

        // ── FLOOD RULE: weak-side crosser (under) + RB both flooding the
        //    strong hook → spot-drop ZONE, never man-chase one of them.
        //    Zone walls the deeper crosser; RB underneath is the lesser
        //    (checkdown) threat. Push only makes sense with a SINGLE threat.
        if (persistentCovCalls.bzm_underW && rbGoingStrong) {
          return zoneDrop(hookCurlS);
        }

        if (persistentCovCalls.bzm_underW) {
          const lockedId = persistentCovCalls.bzm_ssCrosserId;
          if (lockedId) {
            const lockedWr = [r2w, r1w].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.bzm_ssCrosserId = null;
          }
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.bzm_ssCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        if (rbGoingStrong && rb && !persistentCovCalls.bzm_underS) {
          if (!persistentCovCalls.bzm_rbStrongDecided) {
            const strongApex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === strongSide;
            });
            if (strongApex) {
              const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
              const ssX = d.simX ?? d.x,                   ssY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.bzm_rbStrongDecided = true;
              persistentCovCalls.bzm_pushStrong =
                Math.hypot(apX - rbX, apY - rbY) < Math.hypot(ssX - rbX, ssY - rbY);
            }
          }
          if (persistentCovCalls.bzm_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.bzm_rbStrongDecided && !persistentCovCalls.bzm_pushStrong)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlS);
      }

      // ── c. Strong Apex (Buzz: man #2s) ───────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const underTrigS = stickyOnce('bzm_underS_sa', !!(r2s && isUnder(r2s)));
        if (underTrigS && isStickyLocked('bzm_underS_sa')) {
          persistentCovCalls.bzm_underS = true;
        }
        if (persistentCovCalls.bzm_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        if (underTrigS) {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (stickyOnce('bzm_rbGlobal_strong', rbGoingStrong)) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (rbGoingStrong) {
            if (!persistentCovCalls.bzm_rbStrongDecided) {
              const ss = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_S');
              if (ss) {
                const apX = d.simX ?? d.x,   apY = d.simY ?? d.y;
                const ssX = ss.simX ?? ss.x, ssY = ss.simY ?? ss.y;
                const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
                persistentCovCalls.bzm_rbStrongDecided = true;
                persistentCovCalls.bzm_pushStrong =
                  Math.hypot(apX - rbX, apY - rbY) < Math.hypot(ssX - rbX, ssY - rbY);
              }
            }
            if (persistentCovCalls.bzm_pushStrong) return manCover(rb.id);
          }
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook ──────────────────────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbGoingWeak = rbCommittedTo(weakSide);

        // ── FLOOD RULE (mirror of SAF_S): strong-side crosser (under) + RB
        //    both flooding the weak hook → spot-drop ZONE, never man-chase
        //    one of them. Zone walls the deeper crosser; RB is the lesser
        //    (checkdown) threat. Push only makes sense with a SINGLE threat.
        if (persistentCovCalls.bzm_underS && rbGoingWeak) {
          return zoneDrop(hookCurlW);
        }

        if (persistentCovCalls.bzm_underS) {
          const lockedId = persistentCovCalls.bzm_hookCrosserId;
          if (lockedId) {
            const lockedWr = [r2s, r1s].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.bzm_hookCrosserId = null;
          }
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.bzm_hookCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        if (rbGoingWeak && rb && !persistentCovCalls.bzm_underW) {
          if (!persistentCovCalls.bzm_rbWeakDecided) {
            const wapex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === weakSide;
            });
            if (wapex) {
              const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
              const hkX = d.simX ?? d.x,         hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
              persistentCovCalls.bzm_rbWeakDecided = true;
              persistentCovCalls.bzm_pushWeak =
                Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.bzm_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.bzm_rbWeakDecided && !persistentCovCalls.bzm_pushWeak)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── e. Weak Apex ─────────────────────────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const underTrigW = stickyOnce('bzm_underW_wa', !!(r2w && isUnder(r2w)));
        if (underTrigW && isStickyLocked('bzm_underW_wa')) {
          persistentCovCalls.bzm_underW = true;
        }
        if (persistentCovCalls.bzm_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        if (underTrigW) {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (!persistentCovCalls.bzm_rbGlobal_strong && rbGoingWeak) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (rbGoingWeak) {
            if (!persistentCovCalls.bzm_rbWeakDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const waX = d.simX ?? d.x,       waY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.bzm_rbWeakDecided = true;
                persistentCovCalls.bzm_pushWeak =
                  Math.hypot(waX - rbX, waY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.bzm_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('bzm_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('bzm_underW_cb')) persistentCovCalls.bzm_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('bzm_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('bzm_smashW')) persistentCovCalls.bzm_smashW = true;
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
  // ── Cover 3 Robber 2×2 Match (Full Field, 2x2) ────────────────────
  // Based on Cover 3 Sky 2×2 Match with a 4-position rotation:
  //   SAF_S      ← SAF_W's  job (deep middle)
  //   Strong Apex ← SAF_S's  job (man #2s, writes Under-S, smash priority, push)
  //   Hook       ← Strong Apex's job (zone hookCurlS, weak-crosser, push)
  //   SAF_W      ← Hook's   job (zone hookCurlW, strong-crosser, push)
  //   Weak Apex (and CBs) unchanged.
  // Cross-read flips so each defender looks for the partner who now sits
  // in the role they used to look for:
  //   - Strong Apex's push partner (zone hookCurlS) was Strong Apex → now Hook.
  //   - Hook's push partner (man on #2s) was SAF_S → now Strong Apex.
  //   - SAF_W's push partner (man on #2w) was Weak Apex — unchanged.
  //   - Weak Apex's push partner (zone hookCurlW) was Hook → now SAF_W.
  // persistentCovCalls prefix: crob_
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // b. Strong Safety: deep middle  (ROBBER ROT: was SAF_W's job in Sky)
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // c. Strong Apex: man #2s  (ROBBER ROT: was SAF_S's job in Sky)
          //    Weak Apex: man #2w (unchanged)
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, r2w ? manCover(r2w.id) : zoneDrop(curlFlatW));
            break;
          // d. Hook: zone hookCurlS  (ROBBER ROT: was Strong Apex's job in Sky)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlS));
            break;
          // g. Weak Safety: zone hookCurlW  (ROBBER ROT: was Hook's job in Sky)
          case 'SAF_W':
            result.set(id, zoneDrop(hookCurlW));
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

      // ── Phase-A helpers (identical to Sky 2×2 Match) ─────────────────
      const YPX = (typeof YARD_PX !== 'undefined') ? YARD_PX : 20;
      const LATERAL_THRESH_YDS   = 5;
      const SUSTAINED_DIR_SECS   = 0.5;
      const RB_MATCH_MIN_TIME    = 1.0;
      const RB_FLAT_DEPTH_YDS    = 2;
      const CROSSER_LATERAL_YDS  = 6;
      const _pt = (typeof playPhaseTime !== 'undefined') ? playPhaseTime : 0;

      function rbCommittedTo(side) {
        if (!rb) return false;
        if (_pt < RB_MATCH_MIN_TIME) return false;
        const rbLrX = lr(rb);
        if (!rbLrX) return false;
        if (rbLrX.moveType === 'stopped') return false;
        const depthAbs = Math.abs(rbLrX.depthYards ?? 0);
        if (depthAbs > RB_FLAT_DEPTH_YDS) return false;
        const vx = rbLrX.vel?.x ?? 0;
        const movingThatWay = side === 'L' ? vx < 0 : vx > 0;
        if (!movingThatWay) return false;
        const initX = rbLrX.initPos?.x ?? rbLrX.pos?.x ?? 0;
        const curX  = rbLrX.pos?.x ?? 0;
        if (Math.abs(curX - initX) < LATERAL_THRESH_YDS * YPX) return false;
        const sinceChange = _pt - (rbLrX.lastDecisionChangeAt ?? 0);
        if (sinceChange < SUSTAINED_DIR_SECS) return false;
        return true;
      }

      function canMatchCrosser(def, wr) {
        if (!def || !wr) return false;
        const wrLr = lr(wr);
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        const hasCrossedMid = !!(wrLr && wrLr.crossedMiddleNow);
        const lateralGap   = Math.abs(dx - wx);
        const isLatClose   = lateralGap < CROSSER_LATERAL_YDS * YPX;
        return hasCrossedMid || isLatClose;
      }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('crob_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('crob_underS_cb')) persistentCovCalls.crob_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('crob_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('crob_smashS')) persistentCovCalls.crob_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety  (ROBBER ROT: plays Sky's SAF_W job) ─────────
      //   Deep middle only — no push lookups in SAF_W's Sky job.
      if (role === 'SAF_S') {
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── c. Strong Apex  (ROBBER ROT: plays Sky's SAF_S job) ───────────
      //   Mans #2s, writes Under-S, smash priority, push decision.
      //   Push partner is now HOOK (who plays the zone hookCurlS role).
      //   pushStrong = (Strong Apex closer to RB than Hook).
      //   pushStrong true → I (Apex, the man defender) push off #2s to take RB.
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const underTrigS = stickyOnce('crob_underS_sa', !!(r2s && isUnder(r2s)));
        if (underTrigS && isStickyLocked('crob_underS_sa')) {
          persistentCovCalls.crob_underS = true;
        }
        // Smash PRIORITY: #1s hitch → man #1, beats under-call action.
        if (persistentCovCalls.crob_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        // Under-call action: bail to curl-flat, or take RB if RB committed strong.
        if (underTrigS) {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (stickyOnce('crob_rbGlobal_strong', rbGoingStrong)) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        // Push decision: compare distances to Hook (the new zone partner).
        {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (rbGoingStrong) {
            if (!persistentCovCalls.crob_rbStrongDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const apX = d.simX ?? d.x,       apY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.crob_rbStrongDecided = true;
                persistentCovCalls.crob_pushStrong =
                  Math.hypot(apX - rbX, apY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.crob_pushStrong) return manCover(rb.id);
          }
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook  (ROBBER ROT: plays Sky's Strong Apex job) ────────────
      //   Zone hookCurlS, weak-crosser pickup on Under-W, push decision.
      //   Push partner is now STRONG APEX (who plays the man-on-#2s role).
      //   pushStrong = (Strong Apex closer to RB than Hook).
      //   pushStrong true → I (Hook, zone) take #2s; false+decided → I take RB late.
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbGoingStrong = rbCommittedTo(strongSide);

        // Under-W → pick up uncovered weak crosser
        if (persistentCovCalls.crob_underW) {
          const lockedId = persistentCovCalls.crob_hookCrosserId;
          if (lockedId) {
            const lockedWr = [r2w, r1w].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.crob_hookCrosserId = null;
          }
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.crob_hookCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        // Push decision (skip if Under-S active — Apex already bailed, SAF_W owns the crosser).
        if (rbGoingStrong && rb && !persistentCovCalls.crob_underS) {
          if (!persistentCovCalls.crob_rbStrongDecided) {
            const strongApex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === strongSide;
            });
            if (strongApex) {
              const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
              const hkX = d.simX ?? d.x,                   hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.crob_rbStrongDecided = true;
              persistentCovCalls.crob_pushStrong =
                Math.hypot(apX - rbX, apY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.crob_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.crob_rbStrongDecided && !persistentCovCalls.crob_pushStrong)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex (unchanged role, push partner re-aimed) ──────────
      //   Push partner is now SAF_W (who plays the zone hookCurlW role).
      //   pushWeak = (Weak Apex closer to RB than SAF_W).
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const underTrigW = stickyOnce('crob_underW_wa', !!(r2w && isUnder(r2w)));
        if (underTrigW && isStickyLocked('crob_underW_wa')) {
          persistentCovCalls.crob_underW = true;
        }
        if (persistentCovCalls.crob_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        if (underTrigW) {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (!persistentCovCalls.crob_rbGlobal_strong && rbGoingWeak) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (rbGoingWeak) {
            if (!persistentCovCalls.crob_rbWeakDecided) {
              const safW = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_W');
              if (safW) {
                const waX = d.simX ?? d.x,         waY = d.simY ?? d.y;
                const sfX = safW.simX ?? safW.x,   sfY = safW.simY ?? safW.y;
                const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
                persistentCovCalls.crob_rbWeakDecided = true;
                persistentCovCalls.crob_pushWeak =
                  Math.hypot(waX - rbX, waY - rbY) < Math.hypot(sfX - rbX, sfY - rbY);
              }
            }
            if (persistentCovCalls.crob_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('crob_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('crob_underW_cb')) persistentCovCalls.crob_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('crob_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('crob_smashW')) persistentCovCalls.crob_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Weak Safety  (ROBBER ROT: plays Sky's Hook job) ────────────
      //   Zone hookCurlW, strong-crosser pickup on Under-S, push decision.
      //   Push partner is WEAK APEX (unchanged — Weak Apex still mans #2w).
      //   pushWeak = (Weak Apex closer to RB than SAF_W).
      //   pushWeak true → I (SAF_W, zone) take #2w; false+decided → I take RB late.
      if (role === 'SAF_W') {
        const rbGoingWeak = rbCommittedTo(weakSide);

        // Under-S → pick up uncovered strong crosser
        if (persistentCovCalls.crob_underS) {
          const lockedId = persistentCovCalls.crob_sfwCrosserId;
          if (lockedId) {
            const lockedWr = [r2s, r1s].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.crob_sfwCrosserId = null;
          }
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.crob_sfwCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        // Push decision (skip if Under-W active — WA already bailed, Hook owns crosser).
        if (rbGoingWeak && rb && !persistentCovCalls.crob_underW) {
          if (!persistentCovCalls.crob_rbWeakDecided) {
            const wapex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === weakSide;
            });
            if (wapex) {
              const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
              const sfX = d.simX ?? d.x,         sfY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
              persistentCovCalls.crob_rbWeakDecided = true;
              persistentCovCalls.crob_pushWeak =
                Math.hypot(waX - rbX, waY - rbY) < Math.hypot(sfX - rbX, sfY - rbY);
            }
          }
          if (persistentCovCalls.crob_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.crob_rbWeakDecided && !persistentCovCalls.crob_pushWeak)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Weak 2×2 Match (Full Field, 2x2) ──────────────────────
  // Based on Cover 3 Robber 2×2 Match with one additional swap:
  //   SAF_W      ← Weak Apex's Robber-job (man #2w, writes Under-W, smash, push)
  //   Weak Apex  ← SAF_W's     Robber-job (zone hookCurlW, strong-crosser, push)
  //   Everyone else identical to Robber (SAF_S deep middle, Strong Apex man #2s,
  //   Hook zone hookCurlS, CBs man #1).
  // Cross-read flips on the weak side:
  //   - SAF_W's push partner (zone hookCurlW) is now Weak Apex (was SAF_W in Robber).
  //   - Weak Apex's push partner (man on #2w) is now SAF_W (was Weak Apex in Robber).
  //   - Hook's Under-W crosser-pickup still triggered by the under-W flag — now
  //     written by SAF_W instead of Weak Apex (flag name unchanged).
  // persistentCovCalls prefix: cwm_
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // b. Strong Safety: deep middle (same as Robber)
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // c. Strong Apex: man #2s (same as Robber)
          //    Weak Apex: zone hookCurlW (WEAK SWAP: was man #2w in Robber)
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
            break;
          // d. Hook: zone hookCurlS (same as Robber)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlS));
            break;
          // g. Weak Safety: man #2w (WEAK SWAP: was zone hookCurlW in Robber)
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

      // ── Phase-A helpers (identical to Sky/Robber 2×2 Match) ──────────
      const YPX = (typeof YARD_PX !== 'undefined') ? YARD_PX : 20;
      const LATERAL_THRESH_YDS   = 5;
      const SUSTAINED_DIR_SECS   = 0.5;
      const RB_MATCH_MIN_TIME    = 1.0;
      const RB_FLAT_DEPTH_YDS    = 2;
      const CROSSER_LATERAL_YDS  = 6;
      const _pt = (typeof playPhaseTime !== 'undefined') ? playPhaseTime : 0;

      function rbCommittedTo(side) {
        if (!rb) return false;
        if (_pt < RB_MATCH_MIN_TIME) return false;
        const rbLrX = lr(rb);
        if (!rbLrX) return false;
        if (rbLrX.moveType === 'stopped') return false;
        const depthAbs = Math.abs(rbLrX.depthYards ?? 0);
        if (depthAbs > RB_FLAT_DEPTH_YDS) return false;
        const vx = rbLrX.vel?.x ?? 0;
        const movingThatWay = side === 'L' ? vx < 0 : vx > 0;
        if (!movingThatWay) return false;
        const initX = rbLrX.initPos?.x ?? rbLrX.pos?.x ?? 0;
        const curX  = rbLrX.pos?.x ?? 0;
        if (Math.abs(curX - initX) < LATERAL_THRESH_YDS * YPX) return false;
        const sinceChange = _pt - (rbLrX.lastDecisionChangeAt ?? 0);
        if (sinceChange < SUSTAINED_DIR_SECS) return false;
        return true;
      }

      function canMatchCrosser(def, wr) {
        if (!def || !wr) return false;
        const wrLr = lr(wr);
        const dx = def.simX ?? def.x;
        const wx = wr.simX  ?? wr.x;
        const hasCrossedMid = !!(wrLr && wrLr.crossedMiddleNow);
        const lateralGap   = Math.abs(dx - wx);
        const isLatClose   = lateralGap < CROSSER_LATERAL_YDS * YPX;
        return hasCrossedMid || isLatClose;
      }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
        if (stickyOnce('cwm_underS_cb', !!(r1s && isUnder(r1s)))) {
          if (isStickyLocked('cwm_underS_cb')) persistentCovCalls.cwm_underS = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('cwm_smashS', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('cwm_smashS')) persistentCovCalls.cwm_smashS = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (same as Robber: deep middle only) ──────────
      if (role === 'SAF_S') {
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── c. Strong Apex (same as Robber: man #2s + push vs Hook) ──────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const underTrigS = stickyOnce('cwm_underS_sa', !!(r2s && isUnder(r2s)));
        if (underTrigS && isStickyLocked('cwm_underS_sa')) {
          persistentCovCalls.cwm_underS = true;
        }
        if (persistentCovCalls.cwm_smashS) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        if (underTrigS) {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (stickyOnce('cwm_rbGlobal_strong', rbGoingStrong)) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatS);
        }
        {
          const rbGoingStrong = rbCommittedTo(strongSide);
          if (rbGoingStrong) {
            if (!persistentCovCalls.cwm_rbStrongDecided) {
              const hook = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                return rr === 'HOOK-L' || rr === 'HOOK-R' || rr === 'HOOK-M';
              });
              if (hook) {
                const apX = d.simX ?? d.x,       apY = d.simY ?? d.y;
                const hkX = hook.simX ?? hook.x, hkY = hook.simY ?? hook.y;
                const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
                persistentCovCalls.cwm_rbStrongDecided = true;
                persistentCovCalls.cwm_pushStrong =
                  Math.hypot(apX - rbX, apY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
              }
            }
            if (persistentCovCalls.cwm_pushStrong) return manCover(rb.id);
          }
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (same as Robber: zone hookCurlS + weak-crosser + push) ─
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbGoingStrong = rbCommittedTo(strongSide);

        if (persistentCovCalls.cwm_underW) {
          const lockedId = persistentCovCalls.cwm_hookCrosserId;
          if (lockedId) {
            const lockedWr = [r2w, r1w].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.cwm_hookCrosserId = null;
          }
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.cwm_hookCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        if (rbGoingStrong && rb && !persistentCovCalls.cwm_underS) {
          if (!persistentCovCalls.cwm_rbStrongDecided) {
            const strongApex = defensePlayers.find(def => {
              const rr = frozenRoleMap?.get(def.id);
              if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
              const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return (dsx <= ballX ? 'L' : 'R') === strongSide;
            });
            if (strongApex) {
              const apX = strongApex.simX ?? strongApex.x, apY = strongApex.simY ?? strongApex.y;
              const hkX = d.simX ?? d.x,                   hkY = d.simY ?? d.y;
              const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
              persistentCovCalls.cwm_rbStrongDecided = true;
              persistentCovCalls.cwm_pushStrong =
                Math.hypot(apX - rbX, apY - rbY) < Math.hypot(hkX - rbX, hkY - rbY);
            }
          }
          if (persistentCovCalls.cwm_pushStrong && r2s) return manCover(r2s.id);
          if (persistentCovCalls.cwm_rbStrongDecided && !persistentCovCalls.cwm_pushStrong)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex  (WEAK SWAP: plays Robber's SAF_W job) ───────────
      //   Zone hookCurlW, strong-crosser pickup on Under-S, push decision.
      //   Push partner is now SAF_W (the new man defender on #2w).
      //   pushWeak = (SAF_W closer to RB than Weak Apex).
      //   pushWeak true → I (Weak Apex, zone) take #2w; false+decided → I take RB late.
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const rbGoingWeak = rbCommittedTo(weakSide);

        // Under-S → pick up uncovered strong crosser
        if (persistentCovCalls.cwm_underS) {
          const lockedId = persistentCovCalls.cwm_waCrosserId;
          if (lockedId) {
            const lockedWr = [r2s, r1s].find(p => p && p.id === lockedId);
            if (lockedWr) return manCover(lockedWr.id);
            persistentCovCalls.cwm_waCrosserId = null;
          }
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser && canMatchCrosser(d, crosser)) {
            persistentCovCalls.cwm_waCrosserId = crosser.id;
            return manCover(crosser.id);
          }
        }
        // Push decision (skip if Under-W active — SAF_W already bailed, Hook owns crosser).
        if (rbGoingWeak && rb && !persistentCovCalls.cwm_underW) {
          if (!persistentCovCalls.cwm_rbWeakDecided) {
            const safW = defensePlayers.find(def => frozenRoleMap?.get(def.id) === 'SAF_W');
            if (safW) {
              const sfX = safW.simX ?? safW.x, sfY = safW.simY ?? safW.y;
              const waX = d.simX ?? d.x,       waY = d.simY ?? d.y;  // me = Weak Apex
              const rbX = rb.simX ?? rb.x,     rbY = rb.simY ?? rb.y;
              persistentCovCalls.cwm_rbWeakDecided = true;
              persistentCovCalls.cwm_pushWeak =
                Math.hypot(sfX - rbX, sfY - rbY) < Math.hypot(waX - rbX, waY - rbY);
            }
          }
          if (persistentCovCalls.cwm_pushWeak && r2w) return manCover(r2w.id);
          if (persistentCovCalls.cwm_rbWeakDecided && !persistentCovCalls.cwm_pushWeak)
            return manCover(rb.id);
        }
        return zoneDrop(hookCurlW);
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        if (stickyOnce('cwm_underW_cb', !!(r1w && isUnder(r1w)))) {
          if (isStickyLocked('cwm_underW_cb')) persistentCovCalls.cwm_underW = true;
          return zoneDrop(deepTW);
        }
        if (stickyOnce('cwm_smashW', !!(r1w && isHitch(r1w)))) {
          if (isStickyLocked('cwm_smashW')) persistentCovCalls.cwm_smashW = true;
          return zoneDrop(deepTW);
        }
        return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
      }

      // ── g. Weak Safety  (WEAK SWAP: plays Robber's Weak Apex job) ─────
      //   Mans #2w, writes Under-W, smash priority, push decision.
      //   Push partner is now WEAK APEX (the new zone defender in hookCurlW).
      //   pushWeak = (SAF_W closer to RB than Weak Apex).
      //   pushWeak true → I (SAF_W, the man defender) push off #2w to take RB.
      if (role === 'SAF_W') {
        const underTrigW = stickyOnce('cwm_underW_sw', !!(r2w && isUnder(r2w)));
        if (underTrigW && isStickyLocked('cwm_underW_sw')) {
          persistentCovCalls.cwm_underW = true;
        }
        if (persistentCovCalls.cwm_smashW) {
          return r1w ? manCover(r1w.id) : zoneDrop(deepTW);
        }
        if (underTrigW) {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (!persistentCovCalls.cwm_rbGlobal_strong && rbGoingWeak) {
            return manCover(rb.id);
          }
          return zoneDrop(curlFlatW);
        }
        {
          const rbGoingWeak = rbCommittedTo(weakSide);
          if (rbGoingWeak) {
            if (!persistentCovCalls.cwm_rbWeakDecided) {
              const wapex = defensePlayers.find(def => {
                const rr = frozenRoleMap?.get(def.id);
                if (rr !== 'APEX-L' && rr !== 'APEX-R') return false;
                const dsx = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
                return (dsx <= ballX ? 'L' : 'R') === weakSide;
              });
              if (wapex) {
                const sfX = d.simX ?? d.x,         sfY = d.simY ?? d.y;  // me = SAF_W
                const waX = wapex.simX ?? wapex.x, waY = wapex.simY ?? wapex.y;
                const rbX = rb.simX ?? rb.x,       rbY = rb.simY ?? rb.y;
                persistentCovCalls.cwm_rbWeakDecided = true;
                persistentCovCalls.cwm_pushWeak =
                  Math.hypot(sfX - rbX, sfY - rbY) < Math.hypot(waX - rbX, waY - rbY);
              }
            }
            if (persistentCovCalls.cwm_pushWeak) return manCover(rb.id);
          }
        }
        return r2w ? manCover(r2w.id) : zoneDrop(curlFlatW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Buzz 2×2 Match — BUGGED legacy version ────────────────
  // Old buzz preset, kept for reference/comparison.
  // persistentCovCalls prefix: nbz2_
  'cover3-buzz-2x2-match-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // d. Hook: zone hook curl weak
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop(hookCurlW));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // ii:  RB releasing strong + Strong Apex still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => {
              const defRole  = frozenRoleMap?.get(def.id);
              const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return def.id !== d.id &&
                     (defRole === 'APEX-L' || defRole === 'APEX-R') &&
                     (defSnapX <= ballX ? 'L' : 'R') === strongSide &&
                     def.decision?.mode === 'follow' &&
                     def.decision?.focusTargetId === r2s.id;
            }))
          return manCover(rb.id);
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
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
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
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
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
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
  // Strong Safety → deep middle (was SAF_W)  |  Weak Safety → zone hookCurlW (was Hook)
  // persistentCovCalls prefix: nrob_
  'cover3-robber-2x2-match-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
          // g. Weak Safety: zone hook curl weak (robber: gets Hook role)
          case 'SAF_W':
            result.set(id, zoneDrop(hookCurlW));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        // ii:  RB releasing strong + Strong Apex still on #2s → take RB (live every tick)
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => {
              const defRole  = frozenRoleMap?.get(def.id);
              const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return def.id !== d.id &&
                     (defRole === 'APEX-L' || defRole === 'APEX-R') &&
                     (defSnapX <= ballX ? 'L' : 'R') === strongSide &&
                     def.decision?.mode === 'follow' &&
                     def.decision?.focusTargetId === r2s.id;
            }))
          return manCover(rb.id);
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
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
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
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
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Weak 2×2 Match (Full Field, 2x2) ─────────────────────
  // Based on Cover 3 Robber Match — Weak Apex and Weak Safety roles swapped:
  // Weak Apex → zone hookCurlW (gets SAF_W role)  |  SAF_W → man #2w (gets Weak Apex role)
  // persistentCovCalls prefix: nwk2_
  'cover3-weak-2x2-match-bugged': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW     = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
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
            if (isWeak)   result.set(id, zoneDrop(hookCurlW));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepTW    = weakSide   === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          const crosser = [r2w, r1w].filter(Boolean).find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
        }
        if (rbGoingStrong && rb && r2s &&
            defensePlayers.some(def => {
              const defRole  = frozenRoleMap?.get(def.id);
              const defSnapX = snapAlignment[def.id]?.x ?? (def.simX ?? def.x);
              return def.id !== d.id &&
                     (defRole === 'APEX-L' || defRole === 'APEX-R') &&
                     (defSnapX <= ballX ? 'L' : 'R') === strongSide &&
                     def.decision?.mode === 'follow' &&
                     def.decision?.focusTargetId === r2s.id;
            }))
          return manCover(rb.id);
        // Default: hook curl strong
        return zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex: zone hook curl weak (gets SAF_W role from robber) ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const rbLr        = lr(rb);
        const rbVx        = rbLr?.vel?.x ?? 0;
        const rbMoving    = rbLr?.moveType !== 'stopped';
        const rbGoingWeak = !!(rb && rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0));

        if (persistentCovCalls.nwk2_underS) {
          const crosser = [r2s, r1s].filter(Boolean).find(p =>
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
        // Default: hook curl weak
        return zoneDrop(hookCurlW);
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
  'cover3-sky-match-3x1': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Buzz Match 3×1 (Full Field, 3x1) ──────────────────────
  // Mirror of Cover 3 Sky Match 3×1 — SAF_S and Strong Apex swap jobs:
  //   - SAF_S      plays Sky's Strong Apex job (man #3s + #3-route reads).
  //   - Strong Apex plays Sky's SAF_S       job (man #2s + Under-S writer + smash).
  //   Hook, Weak Apex, SAF_W, CBs unchanged. Cross-reads via flags still flow
  //   correctly: the Under-S flag is now written by Strong Apex (man on #2s)
  //   instead of SAF_S, read by Hook & Weak Apex as before.
  // persistentCovCalls prefix: nbz3_
  'cover3-buzz-match-3x1': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          // b. Strong Safety: man #3s (BUZZ SWAP)
          case 'SAF_S':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookCurlS));
            break;
          // c. Strong Apex: man #2s (BUZZ SWAP)  /  e. Weak Apex: man RB
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, rb   ? manCover(rb.id)  : zoneDrop('HOOK_MIDDLE'));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, zoneDrop('HOOK_MIDDLE'));
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

      function rec(s, n)  { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)       { return p ? lrState[p.id] : null; }
      function isUnder(p)  { return isUnderRoute(p, lrState); }
      function isHitch(p)  { return isHitchRoute(p, lrState); }
      function isOut(p)    { return isOutRoute(p, lrState); }
      function isVert(p)   { return isVerticalRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r3IsOut = !!(r3s && (isOut(r3s) || isFlatRoute(r3s, strongSide, lrState, snapshot)));

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.nbz3_under = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nbz3_smash', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nbz3_smash')) persistentCovCalls.nbz3_smash = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (BUZZ SWAP: plays Sky Strong Apex's job) ────
      if (role === 'SAF_S') {
        if (r3IsOut) return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
        if (r3s && isUnder(r3s) && r1s && isUnder(r1s)) return manCover(r1s.id);
        if (r3s && isUnder(r3s)) return zoneDrop(hookCurlS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookCurlS);
      }

      // ── c. Strong Apex (BUZZ SWAP: plays Sky SS's job) ───────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r3IsOut) return r3s ? manCover(r3s.id) : zoneDrop(curlFlatS);
        if (persistentCovCalls.nbz3_smash) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.nbz3_under = true;
          return zoneDrop(flatS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (unchanged from Sky) ──────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingWeak   = !!(rb && rbMoving && (weakSide   === 'L' ? rbVx < 0 : rbVx > 0));
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        const r3Vertical    = !!(r3s && isVert(r3s));

        if (rbGoingWeak || persistentCovCalls.nbz3_rbLockWeak) {
          const strongRecs = [r1s, r2s, r3s].filter(Boolean);
          const crosser = strongRecs.find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
          return zoneDrop('HOOK_MIDDLE');
        }
        if (!r3Vertical && rbGoingStrong && Math.abs(rbVx) > 10 && rb) {
          return manCover(rb.id);
        }
        if (persistentCovCalls.nbz3_under) {
          if (r2s && isUnder(r2s)) return manCover(r2s.id);
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      // ── e. Weak Apex (unchanged from Sky) ─────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb) {
          const rbVx        = lr(rb)?.vel?.x ?? 0;
          const rbMoving    = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0);
          if (stickyOnce('nbz3_rbLockWeak', rbGoingWeak)) {
            if (isStickyLocked('nbz3_rbLockWeak')) persistentCovCalls.nbz3_rbLockWeak = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.nbz3_under) {
          if (r1s && isUnder(r1s)) return manCover(r1s.id);
          return zoneDrop('HOOK_MIDDLE');
        }
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


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Robber Match 3×1 (Full Field, 3x1) ────────────────────
  // 4-position rotation from Cover 3 Sky Match 3×1:
  //   SAF_S      ← SAF_W's       job (deep middle)
  //   Strong Apex ← Sky SAF_S's   job (man #2s + writes Under-S + smash)
  //   Hook       ← Sky Strong Apex's job (man #3s + #3-route reads)
  //   SAF_W      ← Sky Hook's     job (HOOK_MIDDLE + crosser pickup + RB-fast-strong + Under read)
  //   Weak Apex + CBs unchanged.
  // No defender-lookups in Sky 3×1's SS/Apex/Hook code → no partner-finding
  // to flip; cross-flags (Under, RB-lock) still flow correctly through the new owners.
  // persistentCovCalls prefix: nrob3_
  'cover3-robber-match-3x1': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          // b. Strong Safety: deep middle (ROBBER ROT)
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // c. Strong Apex: man #2s (ROBBER ROT — was SS's job)
          //    Weak Apex: man RB (unchanged)
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, rb   ? manCover(rb.id)  : zoneDrop('HOOK_MIDDLE'));
            break;
          // d. Hook: man #3s (ROBBER ROT — was Strong Apex's job)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookCurlS));
            break;
          // g. Weak Safety: zone HOOK_MIDDLE (ROBBER ROT — was Hook's job)
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
      function isOut(p)    { return isOutRoute(p, lrState); }
      function isVert(p)   { return isVerticalRoute(p, lrState); }

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r3IsOut = !!(r3s && (isOut(r3s) || isFlatRoute(r3s, strongSide, lrState, snapshot)));

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.nrob3_under = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nrob3_smash', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nrob3_smash')) persistentCovCalls.nrob3_smash = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (ROBBER ROT: deep middle only) ──────────────
      if (role === 'SAF_S') {
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── c. Strong Apex (ROBBER ROT: plays Sky SS's job) ──────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r3IsOut) return r3s ? manCover(r3s.id) : zoneDrop(curlFlatS);
        if (persistentCovCalls.nrob3_smash) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.nrob3_under = true;
          return zoneDrop(flatS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (ROBBER ROT: plays Sky Strong Apex's job) ────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3IsOut) return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
        if (r3s && isUnder(r3s) && r1s && isUnder(r1s)) return manCover(r1s.id);
        if (r3s && isUnder(r3s)) return zoneDrop(hookCurlS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex (unchanged from Sky) ─────────────────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (rb) {
          const rbVx        = lr(rb)?.vel?.x ?? 0;
          const rbMoving    = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0);
          if (stickyOnce('nrob3_rbLockWeak', rbGoingWeak)) {
            if (isStickyLocked('nrob3_rbLockWeak')) persistentCovCalls.nrob3_rbLockWeak = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.nrob3_under) {
          if (r1s && isUnder(r1s)) return manCover(r1s.id);
          return zoneDrop('HOOK_MIDDLE');
        }
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

      // ── g. Weak Safety (ROBBER ROT: plays Sky Hook's job) ────────────
      if (role === 'SAF_W') {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingWeak   = !!(rb && rbMoving && (weakSide   === 'L' ? rbVx < 0 : rbVx > 0));
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        const r3Vertical    = !!(r3s && isVert(r3s));

        if (rbGoingWeak || persistentCovCalls.nrob3_rbLockWeak) {
          const strongRecs = [r1s, r2s, r3s].filter(Boolean);
          const crosser = strongRecs.find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
          return zoneDrop('HOOK_MIDDLE');
        }
        if (!r3Vertical && rbGoingStrong && Math.abs(rbVx) > 10 && rb) {
          return manCover(rb.id);
        }
        if (persistentCovCalls.nrob3_under) {
          if (r2s && isUnder(r2s)) return manCover(r2s.id);
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Cover 3 Weak Match 3×1 (Full Field, 3x1) ──────────────────────
  // Robber 3×1 base + one extra swap on the weak side:
  //   SAF_W     ← Weak Apex's Sky job (man RB + RB-weak sticky lock — writes rb-lock flag)
  //   Weak Apex ← Sky Hook's   job (HOOK_MIDDLE + strong-crosser pickup + RB-fast-strong + Under read)
  //   Strong-side identical to Robber (SAF_S deep middle, Strong Apex man #2s, Hook man #3s).
  //   CBs unchanged.
  // Cross-read on the weak side flips: the rb-lock flag is now written by SAF_W
  // (the new RB defender) and read by Weak Apex (the new zone defender) — same
  // flow direction, different owners.
  // persistentCovCalls prefix: nwk3_
  'cover3-weak-match-3x1': {
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
      const deepTS     = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
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
          case 'CB':
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepTS));
            if (isWeak)   result.set(id, r1w ? manCover(r1w.id) : zoneDrop(deepHW));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          // c. Strong Apex: man #2s (same as Robber)
          //    e. Weak Apex: zone HOOK_MIDDLE (WEAK SWAP — was man RB in Robber)
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlFlatS));
            if (isWeak)   result.set(id, zoneDrop('HOOK_MIDDLE'));
            break;
          // d. Hook: man #3s (same as Robber)
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookCurlS));
            break;
          // g. Weak Safety: man RB (WEAK SWAP — was zone HOOK_MIDDLE in Robber)
          case 'SAF_W':
            result.set(id, rb ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE'));
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

      const deepTS    = strongSide === 'L' ? 'DEEP_L' : 'DEEP_R';
      const deepHW    = weakSide   === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L'  : 'CURL_FLAT_R';
      const hookCurlS = strongSide === 'L' ? 'HOOK_CURL_L'  : 'HOOK_CURL_R';
      const flatS     = strongSide === 'L' ? 'FLAT_L' : 'FLAT_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);
      const r1w = rec(weakSide, 1);
      const r3IsOut = !!(r3s && (isOut(r3s) || isFlatRoute(r3s, strongSide, lrState, snapshot)));

      // ── a. Strong Corner ──────────────────────────────────────────────
      if (role === 'CB' && isStrong) {
        if (r1s && isUnder(r1s)) {
          persistentCovCalls.nwk3_under = true;
          return zoneDrop(deepTS);
        }
        if (stickyOnce('nwk3_smash', !!(r1s && isHitch(r1s)))) {
          if (isStickyLocked('nwk3_smash')) persistentCovCalls.nwk3_smash = true;
          return zoneDrop(deepTS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
      }

      // ── b. Strong Safety (deep middle, same as Robber) ───────────────
      if (role === 'SAF_S') {
        return zoneDrop('DEEP_MIDDLE');
      }

      // ── c. Strong Apex (same as Robber: Sky SS code) ─────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r3IsOut) return r3s ? manCover(r3s.id) : zoneDrop(curlFlatS);
        if (persistentCovCalls.nwk3_smash) {
          return r1s ? manCover(r1s.id) : zoneDrop(deepTS);
        }
        if (r2s && isUnder(r2s)) {
          persistentCovCalls.nwk3_under = true;
          return zoneDrop(flatS);
        }
        return r2s ? manCover(r2s.id) : zoneDrop(curlFlatS);
      }

      // ── d. Hook (same as Robber: Sky Strong Apex code) ───────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3IsOut) return r2s ? manCover(r2s.id) : zoneDrop(hookCurlS);
        if (r3s && isUnder(r3s) && r1s && isUnder(r1s)) return manCover(r1s.id);
        if (r3s && isUnder(r3s)) return zoneDrop(hookCurlS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookCurlS);
      }

      // ── e. Weak Apex (WEAK SWAP: plays Sky Hook's job) ───────────────
      //   Reads rb-lock flag written by SAF_W (the new RB defender).
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const rbLr          = lr(rb);
        const rbVx          = rbLr?.vel?.x ?? 0;
        const rbMoving      = rbLr?.moveType !== 'stopped';
        const rbGoingWeak   = !!(rb && rbMoving && (weakSide   === 'L' ? rbVx < 0 : rbVx > 0));
        const rbGoingStrong = !!(rb && rbMoving && (strongSide === 'L' ? rbVx < 0 : rbVx > 0));
        const r3Vertical    = !!(r3s && isVert(r3s));

        if (rbGoingWeak || persistentCovCalls.nwk3_rbLockWeak) {
          const strongRecs = [r1s, r2s, r3s].filter(Boolean);
          const crosser = strongRecs.find(p =>
            isUnder(p) &&
            !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
          );
          if (crosser) return manCover(crosser.id);
          return zoneDrop('HOOK_MIDDLE');
        }
        if (!r3Vertical && rbGoingStrong && Math.abs(rbVx) > 10 && rb) {
          return manCover(rb.id);
        }
        if (persistentCovCalls.nwk3_under) {
          if (r2s && isUnder(r2s)) return manCover(r2s.id);
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      // ── f. Weak Corner ────────────────────────────────────────────────
      if (role === 'CB' && isWeak) {
        return r1w ? manCover(r1w.id) : zoneDrop(deepHW);
      }

      // ── g. Weak Safety (WEAK SWAP: plays Sky Weak Apex's job) ────────
      //   Mans RB, writes rb-lock flag for Weak Apex (new zone defender) to read.
      if (role === 'SAF_W') {
        if (rb) {
          const rbVx        = lr(rb)?.vel?.x ?? 0;
          const rbMoving    = lr(rb)?.moveType !== 'stopped';
          const rbGoingWeak = rbMoving && (weakSide === 'L' ? rbVx < 0 : rbVx > 0);
          if (stickyOnce('nwk3_rbLockWeak', rbGoingWeak)) {
            if (isStickyLocked('nwk3_rbLockWeak')) persistentCovCalls.nwk3_rbLockWeak = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.nwk3_under) {
          if (r1s && isUnder(r1s)) return manCover(r1s.id);
          return zoneDrop('HOOK_MIDDLE');
        }
        const strongRecs = [r1s, r2s, r3s].filter(Boolean);
        const crosser = strongRecs.find(p =>
          isUnder(p) &&
          !defensePlayers.some(def => def.id !== d.id && def.decision?.focusTargetId === p.id)
        );
        if (crosser) return manCover(crosser.id);
        return zoneDrop('HOOK_MIDDLE');
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

