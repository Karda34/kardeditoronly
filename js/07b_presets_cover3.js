// ── PRESET REGISTRY PART B: Cover 3 Match Coverages ─────────────────
// Cover 3 Sky, Buzz, Robber, Weak — full-field match variants
// Merged into PRESET_REGISTRY in 07d_presets_fullfield.js

const _PR_COVER3 = {
  // ── Cover 3 Sky ───────────────────────────────────────────────────────
  // 2-high pre-snap shell.
  // Role mapping post-snap:
  //   CB strong   → Strong Corner (mod-man #1s)
  //   SS          → Strong Safety (man #2s)
  //   APEX strong → Strong Apex   (HOOK_S zone)
  //   HOOK        → Hook          (HOOK_W zone)
  //   APEX weak   → Weak Apex     (man #2w)
  //   CB weak     → Weak Corner   (mod-man #1w)
  //   FS          → Deep Middle
  //
  // Frozen calls (persistentCovCalls, prefix sky_):
  //   sky_smashStrong  — Strong CB detects #1s isHitch → SS covers hitch
  //   sky_smashWeak    — Weak CB detects #1w isHitch   → Weak Apex covers hitch
  //   sky_pushStrong   — Strong Apex: rb releases strong, can reach #2s not rb → SS takes rb
  //   sky_pushWeak     — Hook: rb releases weak, can reach #2w not rb → Weak Apex takes rb
  //   sky_underFromStrong — Strong CB or SS: under from strong side → Hook takes crosser
  //   sky_underFromWeak   — Weak CB or Weak Apex: under from weak side → Strong Apex takes crosser
  'cover3-sky': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result   = new Map();
      if (!snapshot) return result;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS      = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW      = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d      = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;
        const rb       = snapshot.primaryBackfield || null;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;

          case 'CB': {
            const r1 = rec(roleSide, 1);
            if (isStrong) result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepS));
            else          result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepW));
            break;
          }
          case 'SAF_S': {
            const r2s = rec(strongSide, 2);
            result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS));
            break;
          }
          case 'APEX-L':
          case 'APEX-R': {
            if (isStrong) result.set(id, zoneDrop(hookS));
            else {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            }
            break;
          }
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop(hookW)); break;

          case 'SAF_W':
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
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = snapshot.isTrips;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // Route helpers
      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isVerticalRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }
      // Zone-to-man conversion: after 1.5s, unguarded receiver in hook/curl zone → man
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        // Include primary RB — not in eligible array
        const allReceivers = rb ? [...eligible, rb] : eligible;
        // Find nearest unguarded receiver — no zone bounds, nearest wins
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

      // Zone landmarks
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW     = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      // Frozen calls (persistentCovCalls — reset each snap automatically)
      // sky_smashStrong     : Strong CB saw #1s hitch  → SS covers #1s
      // sky_smashWeak       : Weak CB saw #1w hitch    → Weak Apex covers #1w
      // sky_pushStrong      : Strong Apex pushed SS    → SS takes RB
      // sky_pushWeak        : Hook pushed Weak Apex    → Weak Apex takes RB
      // sky_underFromStrong : Strong CB or SS saw under → Hook takes deepest crosser
      // sky_underFromWeak   : Weak CB or Weak Apex saw under → Strong Apex takes crosser

      // ── 2x2 ──────────────────────────────────────────────────────────
      if (!isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        // ── a. Strong Corner ──────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i under → Under call for Hook, drop deep third strong
          if (r1s && isUnder(r1s)) {
            persistentCovCalls.sky_underFromStrong = true;
            return zoneDrop(deepS);
          }
          // a.ii hitch → Smash call for SS, drop deep third strong
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.sky_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Safety ─────────────────────────────────────────
        if (role === 'SAF_S') {
          // b.i: smash call → cover #1s hitch (priority)
          if (persistentCovCalls.sky_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.ii: #2s under → Under call for Hook, work Curl-to-Flat
          if (r2s && isUnder(r2s)) {
            persistentCovCalls.sky_underFromStrong = true;
            return zoneDrop(curlFlatS);
          }
          // b.iii: push call → take RB in man
          if (persistentCovCalls.sky_pushStrong) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. Strong Apex ────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // c.i: rb releasing strong, cannot reach rb but can reach #2s → Push call for SS, take #2s
          if (persistentCovCalls.sky_pushStrong === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingStrong && !canReach(d, rb) && r2s && canReach(d, r2s)) {
              persistentCovCalls.sky_pushStrong = true;
              return manCover(r2s.id, YARD_PX);
            }
          }
          if (persistentCovCalls.sky_pushStrong) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: under call from weak side → take crosser from weak side
          if (persistentCovCalls.sky_underFromWeak) {
            const crosser = [r1w, r2w].find(p => p && isUnder(p));
            if (crosser) return manCover(crosser.id, YARD_PX);
          }
          // c.iii: no under call from weak AND rb/#3 late out strong → take in man
          const r3 = rec(strongSide, 3) || rb;
          if (!persistentCovCalls.sky_underFromWeak && r3 && isOut(r3)) {
            return manCover(r3.id, YARD_PX);
          }
          // default: hook zone strong
          return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
        }

        // ── d. Hook ───────────────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // d.0: smash call → Weak Apex took #1w → Hook covers #2w
          if (persistentCovCalls.sky_smashWeak) {
            return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
          }
          // d.i: rb releasing weak, cannot reach rb but can reach #2w → Push call for Weak Apex, take #2w
          if (persistentCovCalls.sky_pushWeak === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingWeak && !canReach(d, rb) && r2w && canReach(d, r2w)) {
              persistentCovCalls.sky_pushWeak = true;
              return manCover(r2w.id, YARD_PX);
            }
          }
          if (persistentCovCalls.sky_pushWeak) {
            return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
          }
          // d.ii: under call from strong side → take deepest crosser from strong side
          if (persistentCovCalls.sky_underFromStrong) {
            const candidates = [r1s, r2s].filter(p => p && isUnder(p));
            if (candidates.length > 0) {
              const deepest = candidates.reduce((a, b) =>
                (a.simY ?? a.y) < (b.simY ?? b.y) ? a : b);
              return manCover(deepest.id, YARD_PX);
            }
          }
          // d.iii: SS already has #2s and RB released → Hook takes RB
          const ssHasR2s = r2s && defensePlayers.some(def =>
            def.id !== d.id && def.decision?.focusTargetId === r2s.id
          );
          if (ssHasR2s && rb && lr(rb)?.moveType !== 'stopped') {
            return manCover(rb.id, YARD_PX);
          }
          // default: hook zone weak
          return zoneToManConvert(d, hookW)        || zoneDrop(hookW);
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // e.i: #2w under → Under call for Strong Apex, work Curl-to-Flat (priority)
          if (r2w && isUnder(r2w)) {
            persistentCovCalls.sky_underFromWeak = true;
            return zoneDrop(curlFlatW);
          }
          // e.ii: smash call from Weak CB → cover #1w hitch
          if (persistentCovCalls.sky_smashWeak) {
            return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
          }
          // e.iii: push call from Hook → take RB in man
          if (persistentCovCalls.sky_pushWeak) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // default: man #2w
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          // f.i: under → Under call for Strong Apex, drop deep third weak
          if (r1w && isUnder(r1w)) {
            persistentCovCalls.sky_underFromWeak = true;
            return zoneDrop(deepW);
          }
          // f.ii: hitch → Smash call for Weak Apex, drop deep third weak
          if (r1w && isHitch(r1w)) {
            persistentCovCalls.sky_smashWeak = true;
            return zoneDrop(deepW);
          }
          // default: mod man #1w
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. Deep Safety ────────────────────────────────────────────
        if (role === 'SAF_W') {
          const d2s = lr(r2s)?.depthYards ?? 0;
          const d2w = lr(r2w)?.depthYards ?? 0;
          const deep2s = r2s && d2s >= 8;
          const deep2w = r2w && d2w >= 8;
          // Both #2s deep → midpoint (stay deep middle between them)
          if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
          // Only one deep → man that one
          if (deep2s) return manCover(r2s.id);
          if (deep2w) return manCover(r2w.id);
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      // ── 3x1 ──────────────────────────────────────────────────────────
      if (isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r3s = rec(strongSide, 3);
        const r1w = rec(weakSide, 1);

        // RB release direction — freeze once detected, first direction wins
        // Vertical RB treated as weak release
        if (rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx   = lr(rb)?.vel?.x ?? 0;
          const rbVert = isVerticalRoute(rb, lrState);
          if (rbVx !== 0 || rbVert) {
            const goingWeak   = (weakSide === 'L' ? rbVx < 0 : rbVx > 0) || rbVert;
            const goingStrong = (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
            if (goingWeak   && !persistentCovCalls.sky_rbReleasedStrong3x1)
              persistentCovCalls.sky_rbReleasedWeak3x1   = true;
            if (goingStrong && !persistentCovCalls.sky_rbReleasedWeak3x1)
              persistentCovCalls.sky_rbReleasedStrong3x1 = true;
          }
        }

        // ── a. Strong Corner ─────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i: under → drop deep (Hook+Weak Apex read directly via sorted index)
          if (r1s && isUnder(r1s)) {
            return zoneDrop(deepS);
          }
          // a.ii: hitch → Smash call for SS, drop deep
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.sky_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Safety ─────────────────────────────────────────
        if (role === 'SAF_S') {
          // b.i: #3s out or flat → take #3s (priority)
          if (r3s && (isOutRoute(r3s, lrState) || isFlatRoute(r3s, strongSide, lrState, snapshot))) {
            return manCover(r3s.id, YARD_PX);
          }
          // b.ii: smash call → cover #1s hitch
          if (persistentCovCalls.sky_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.iii: no smash, #2s under → take #1s (Hook+Weak Apex read crossers directly)
          if (r2s && isUnder(r2s)) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. Strong Apex ────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // c.i: #3s out → take #2s
          if (r3s && isOutRoute(r3s, lrState)) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: smash active → SS took #1s → Strong Apex drops to #2s
          if (persistentCovCalls.sky_smashStrong) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.iii: #3s under → Curl-Hook zone; once #1w crosses middle take him
          if (r3s && isUnder(r3s)) {
            const r1wLr = lr(r1w);
            if (r1w && r1wLr?.crossedMiddleNow) {
              return manCover(r1w.id, YARD_PX);
            }
            return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
          }
          // default: man #3s
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop(hookS);
        }

        // ── d. Hook ───────────────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // d.i: #3s vertical inside → man #3s (priority)
          if (r3s && isVertInsideRoute(r3s, lrState)) {
            return manCover(r3s.id, YARD_PX);
          }
          // d.ii: smash active → Strong Apex took #2s → Hook covers #3s (RB ignored)
          if (persistentCovCalls.sky_smashStrong) {
            return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.sky_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Hook takes index 0 (deepest available)
          if (underCrossers.length > 0) {
            return manCover(underCrossers[0].id, YARD_PX);
          }
          // rb released strong (and no under crossers) → take rb
          if (persistentCovCalls.sky_rbReleasedStrong3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
          }
          return zoneToManConvert(d, 'HOOK_MIDDLE') || zoneDrop('HOOK_MIDDLE');
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // rb releasing weak → man rb (priority)
          if (persistentCovCalls.sky_rbReleasedWeak3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.sky_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Weak Apex takes index 1 (second deepest)
          if (underCrossers.length > 1) {
            return manCover(underCrossers[1].id, YARD_PX);
          }
          // no second crosser after 1s → take #1w
          if (playPhaseTime >= 0.6) {
            return r1w ? manCover(r1w.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          return zoneToManConvert(d, curlFlatW)    || zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. Deep Safety ────────────────────────────────────────────
        if (role === 'SAF_W') {
          // 3x1: only one #2 (strong side)
          const d2s = lr(r2s)?.depthYards ?? 0;
          if (r2s && d2s >= 8) return manCover(r2s.id);
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      return null;
    },
  },


  // ── Cover 3 Buzz ──────────────────────────────────────────────────────
  // 2-high shell. Post-snap role shift:
  //   SS          → plays Strong Hook rules  (HOOK_S)
  //   Strong Apex → plays Strong Apex rules  (man #2 strong / CURL_FLAT_S)
  //   Hook        → plays Weak   Hook rules  (HOOK_W)
  //   Weak Apex   → plays Weak   Apex rules  (man #2 weak  / CURL_FLAT_W)
  //   FS          → Deep Middle
  //   CB          → unchanged (mod-man #1 / deep third)
  // ── Cover 3 Buzz Match ───────────────────────────────────────────────
  // 2-high shell. Post-snap role shift vs Sky:
  //   Strong Apex → plays Strong Apex rules (man #2s) — Sky had SS here
  //   SS          → plays Strong Hook rules (HOOK_S)  — Sky had Strong Apex here
  //   All others identical to Sky Match
  'cover3-buzz': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result   = new Map();
      if (!snapshot) return result;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS      = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW      = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d      = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const rb       = snapshot.primaryBackfield || null;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;

          case 'CB': {
            const r1 = rec(roleSide, 1);
            if (isStrong) result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepS));
            else          result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepW));
            break;
          }
          // Buzz: Strong Apex mans #2s (Sky had SS here)
          case 'APEX-L':
          case 'APEX-R': {
            const apSide = role === 'APEX-L' ? 'L' : 'R';
            if (apSide === strongSide) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS));
            } else {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            }
            break;
          }
          // Buzz: SS drops to HOOK_S (Sky had Strong Apex here)
          case 'SAF_S':
            result.set(id, zoneDrop(hookS)); break;

          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop(hookW)); break;

          case 'SAF_W':
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
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = snapshot.isTrips;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // Route helpers
      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isVerticalRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }
      // Zone-to-man conversion: after 1.5s, unguarded receiver in hook/curl zone → man
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        // Include primary RB — not in eligible array
        const allReceivers = rb ? [...eligible, rb] : eligible;
        // Find nearest unguarded receiver — no zone bounds, nearest wins
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

      // Zone landmarks
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW     = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      // Frozen calls — buzz_ prefix
      // buzz_smashStrong     : Strong CB saw #1s hitch  → Strong Apex covers #1s
      // buzz_smashWeak       : Weak CB saw #1w hitch    → Weak Apex covers #1w
      // buzz_pushStrong      : Strong Apex pushed SS    → SS takes RB  (note: SS now in hook zone)
      // buzz_pushWeak        : Hook pushed Weak Apex    → Weak Apex takes RB
      // buzz_underFromStrong : Strong CB or Strong Apex saw under → Hook takes crosser
      // buzz_underFromWeak   : Weak CB or Weak Apex saw under → Strong Apex takes crosser
      // buzz_rbReleasedWeak3x1   : 3x1 RB going weak
      // buzz_rbReleasedStrong3x1 : 3x1 RB going strong or vertical

      // ── 2x2 ──────────────────────────────────────────────────────────
      if (!isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        // ── a. Strong Corner ──────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          if (r1s && isUnder(r1s)) {
            persistentCovCalls.buzz_underFromStrong = true;
            return zoneDrop(deepS);
          }
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.buzz_smashStrong = true;
            return zoneDrop(deepS);
          }
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (mans #2s — Buzz equivalent of Sky SS) ────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: smash call → cover #1s hitch
          if (persistentCovCalls.buzz_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.ii: #2s under → Under call for Hook, work Curl-to-Flat
          if (r2s && isUnder(r2s)) {
            persistentCovCalls.buzz_underFromStrong = true;
            return zoneDrop(curlFlatS);
          }
          // b.iii: push call from SS → take RB in man
          if (persistentCovCalls.buzz_pushStrong) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. SS (hook zone — Buzz equivalent of Sky Strong Apex) ───
        if (role === 'SAF_S') {
          // c.i: rb releasing strong, cannot reach rb but can reach #2s → Push call for Strong Apex, take #2s
          if (persistentCovCalls.buzz_pushStrong === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingStrong && !canReach(d, rb) && r2s && canReach(d, r2s)) {
              persistentCovCalls.buzz_pushStrong = true;
              return manCover(r2s.id, YARD_PX);
            }
          }
          if (persistentCovCalls.buzz_pushStrong) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: under call from weak side → take crosser from weak side
          if (persistentCovCalls.buzz_underFromWeak) {
            const crosser = [r1w, r2w].find(p => p && isUnder(p));
            if (crosser) return manCover(crosser.id, YARD_PX);
          }
          // c.iii: no under call from weak AND rb/#3 late out strong → take in man
          const r3 = rec(strongSide, 3) || rb;
          if (!persistentCovCalls.buzz_underFromWeak && r3 && isOut(r3)) {
            return manCover(r3.id, YARD_PX);
          }
          // default: hook zone strong
          return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
        }

        // ── d. Hook ───────────────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          if (persistentCovCalls.buzz_pushWeak === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingWeak && !canReach(d, rb) && r2w && canReach(d, r2w)) {
              persistentCovCalls.buzz_pushWeak = true;
              return manCover(r2w.id, YARD_PX);
            }
          }
          if (persistentCovCalls.buzz_pushWeak) {
            return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
          }
          if (persistentCovCalls.buzz_underFromStrong) {
            const candidates = [r1s, r2s].filter(p => p && isUnder(p));
            if (candidates.length > 0) {
              const deepest = candidates.reduce((a, b) =>
                (a.simY ?? a.y) < (b.simY ?? b.y) ? a : b);
              return manCover(deepest.id, YARD_PX);
            }
          }
          return zoneToManConvert(d, hookW)        || zoneDrop(hookW);
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          if (r2w && isUnder(r2w)) {
            persistentCovCalls.buzz_underFromWeak = true;
            return zoneDrop(curlFlatW);
          }
          if (persistentCovCalls.buzz_smashWeak) {
            return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
          }
          if (persistentCovCalls.buzz_pushWeak) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          if (r1w && isUnder(r1w)) {
            persistentCovCalls.buzz_underFromWeak = true;
            return zoneDrop(deepW);
          }
          if (r1w && isHitch(r1w)) {
            persistentCovCalls.buzz_smashWeak = true;
            return zoneDrop(deepW);
          }
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. Deep Safety ────────────────────────────────────────────
        if (role === 'SAF_W') {
          const d2s = lr(r2s)?.depthYards ?? 0;
          const d2w = lr(r2w)?.depthYards ?? 0;
          const deep2s = r2s && d2s >= 8;
          const deep2w = r2w && d2w >= 8;
          if (deep2s && deep2w) return zoneDrop('DEEP_MIDDLE');
          if (deep2s) return manCover(r2s.id);
          if (deep2w) return manCover(r2w.id);
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      // ── 3x1 ──────────────────────────────────────────────────────────
      if (isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r3s = rec(strongSide, 3);
        const r1w = rec(weakSide, 1);

        // RB release direction — freeze once detected
        // RB release direction — first direction wins, vertical treated as weak
        if (rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx   = lr(rb)?.vel?.x ?? 0;
          const rbVert = isVerticalRoute(rb, lrState);
          if (rbVx !== 0 || rbVert) {
            const goingWeak   = (weakSide   === 'L' ? rbVx < 0 : rbVx > 0) || rbVert;
            const goingStrong = (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
            if (goingWeak   && !persistentCovCalls.buzz_rbReleasedStrong3x1)
              persistentCovCalls.buzz_rbReleasedWeak3x1   = true;
            if (goingStrong && !persistentCovCalls.buzz_rbReleasedWeak3x1)
              persistentCovCalls.buzz_rbReleasedStrong3x1 = true;
          }
        }

        // ── a. Strong Corner ─────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          if (r1s && isUnder(r1s)) { return zoneDrop(deepS); }
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.buzz_smashStrong = true;
            return zoneDrop(deepS);
          }
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (mans #2s in 3x1) ─────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: #3s out or flat → take #3s
          if (r3s && (isOutRoute(r3s, lrState) || isFlatRoute(r3s, strongSide, lrState, snapshot))) {
            return manCover(r3s.id, YARD_PX);
          }
          // b.ii: smash call → cover #1s hitch
          if (persistentCovCalls.buzz_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.iii: #2s under → take #1s
          if (r2s && isUnder(r2s)) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. SS (hook zone in 3x1) ──────────────────────────────────
        if (role === 'SAF_S') {
          // c.i: #3s out → take #2s
          if (r3s && isOutRoute(r3s, lrState)) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: #3s under → Curl-Hook zone; once #1w crosses middle take him
          if (r3s && isUnder(r3s)) {
            const r1wLr = lr(r1w);
            if (r1w && r1wLr?.crossedMiddleNow) {
              return manCover(r1w.id, YARD_PX);
            }
            return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
          }
          // default: man #3s
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop(hookS);
        }

        // ── d. Hook ───────────────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          if (r3s && isVertInsideRoute(r3s, lrState)) {
            return manCover(r3s.id, YARD_PX);
          }
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.buzz_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          if (underCrossers.length > 0) {
            return manCover(underCrossers[0].id, YARD_PX);
          }
          if (persistentCovCalls.buzz_rbReleasedStrong3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
          }
          return zoneToManConvert(d, 'HOOK_MIDDLE') || zoneDrop('HOOK_MIDDLE');
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          if (persistentCovCalls.buzz_rbReleasedWeak3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.buzz_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          if (underCrossers.length > 1) {
            return manCover(underCrossers[1].id, YARD_PX);
          }
          if (playPhaseTime >= 0.6) {
            return r1w ? manCover(r1w.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          return zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. Deep Safety ────────────────────────────────────────────
        if (role === 'SAF_W') {
          const d2s = lr(r2s)?.depthYards ?? 0;
          if (r2s && d2s >= 8) return manCover(r2s.id);
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      return null;
    },
  },


  // ── Cover 3 Robber ────────────────────────────────────────────────────
  // 2-high pre-snap shell. Post-snap role shift:
  //   SS          → plays FS rules           (Deep Middle / OTT on verticals)
  //   FS          → plays Weak Hook rules    (HOOK_W)
  //   Hook        → plays Strong Hook rules  (HOOK_S)
  //   Strong Apex → plays Strong Apex rules  (man #2 strong / CURL_FLAT_S)
  //   Weak Apex   → plays Weak Apex rules    (man #2 weak  / CURL_FLAT_W)
  //   CB          → unchanged (mod-man #1 / deep third)
  // ── Cover 3 Robber Match ─────────────────────────────────────────────
  // 2-high shell. Post-snap role shift vs Sky:
  //   Strong Apex → plays Strong Apex rules (man #2s)      — Sky: SS
  //   SS          → plays Strong Hook rules (HOOK_S)        — Sky: Strong Apex
  //   FS          → plays Weak Hook rules   (HOOK_W)        — Sky: Hook
  //   Hook        → plays Deep Middle                       — Sky: FS (Deep Middle → SS)
  //   All others (CB strong, CB weak, Weak Apex) identical to Sky
  'cover3-robber': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result   = new Map();
      if (!snapshot) return result;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS      = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW      = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d      = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const rb       = snapshot.primaryBackfield || null;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;
          case 'CB': {
            const r1 = rec(roleSide, 1);
            if (isStrong) result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepS));
            else          result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepW));
            break;
          }
          // Robber: Strong Apex mans #2s pre-snap
          case 'APEX-L':
          case 'APEX-R': {
            const apSide = role === 'APEX-L' ? 'L' : 'R';
            if (apSide === strongSide) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS));
            } else {
              const r2w = rec(weakSide, 2);
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            }
            break;
          }
          // Robber: SS → Deep Middle (plays FS role)
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          // Robber: Hook → HOOK_S (plays Strong Apex role)
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop(hookS)); break;
          // Robber: FS → HOOK_W (plays Hook role)
          case 'SAF_W':
            result.set(id, zoneDrop(hookW)); break;
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
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = snapshot.isTrips;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // Route helpers
      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isVerticalRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }
      // Zone-to-man conversion: after 1.5s, unguarded receiver in hook/curl zone → man
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        // Include primary RB — not in eligible array
        const allReceivers = rb ? [...eligible, rb] : eligible;
        // Find nearest unguarded receiver — no zone bounds, nearest wins
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

      // Zone landmarks
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW     = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      // Frozen calls (persistentCovCalls — reset each snap automatically)
      // robber_smashStrong     : Strong CB saw #1s hitch  → SS covers #1s
      // robber_smashWeak       : Weak CB saw #1w hitch    → Weak Apex covers #1w
      // robber_pushStrong      : Strong Apex pushed SS    → SS takes RB
      // robber_pushWeak        : Hook pushed Weak Apex    → Weak Apex takes RB
      // robber_underFromStrong : Strong CB or SS saw under → Hook takes deepest crosser
      // robber_underFromWeak   : Weak CB or Weak Apex saw under → Strong Apex takes crosser

      // ── 2x2 ──────────────────────────────────────────────────────────
      if (!isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        // ── a. Strong Corner ──────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i under → Under call for Hook, drop deep third strong
          if (r1s && isUnder(r1s)) {
            persistentCovCalls.robber_underFromStrong = true;
            return zoneDrop(deepS);
          }
          // a.ii hitch → Smash call for SS, drop deep third strong
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.robber_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (mans #2s — Robber equiv of Sky SS) ────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: smash call → cover #1s hitch (priority)
          if (persistentCovCalls.robber_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.ii: #2s under → Under call for Hook, work Curl-to-Flat
          if (r2s && isUnder(r2s)) {
            persistentCovCalls.robber_underFromStrong = true;
            return zoneDrop(curlFlatS);
          }
          // b.iii: push call → take RB in man
          if (persistentCovCalls.robber_pushStrong) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. SS (hook zone strong — Robber equiv of Sky Strong Apex)─
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // c.i: rb releasing strong, cannot reach rb but can reach #2s → Push call for SS, take #2s
          if (persistentCovCalls.robber_pushStrong === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingStrong && !canReach(d, rb) && r2s && canReach(d, r2s)) {
              persistentCovCalls.robber_pushStrong = true;
              return manCover(r2s.id, YARD_PX);
            }
          }
          if (persistentCovCalls.robber_pushStrong) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: under call from weak side → take crosser from weak side
          if (persistentCovCalls.robber_underFromWeak) {
            const crosser = [r1w, r2w].find(p => p && isUnder(p));
            if (crosser) return manCover(crosser.id, YARD_PX);
          }
          // c.iii: no under call from weak AND rb/#3 late out strong → take in man
          const r3 = rec(strongSide, 3) || rb;
          if (!persistentCovCalls.robber_underFromWeak && r3 && isOut(r3)) {
            return manCover(r3.id, YARD_PX);
          }
          // default: hook zone strong
          return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
        }

        // ── d. FS (hook zone weak — Robber equiv of Sky Hook) ──────────
        if (role === 'SAF_W') {
          // d.i: rb releasing weak, cannot reach rb but can reach #2w → Push call for Weak Apex, take #2w
          if (persistentCovCalls.robber_pushWeak === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingWeak && !canReach(d, rb) && r2w && canReach(d, r2w)) {
              persistentCovCalls.robber_pushWeak = true;
              return manCover(r2w.id, YARD_PX);
            }
          }
          if (persistentCovCalls.robber_pushWeak) {
            return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
          }
          // d.ii: under call from strong side → take deepest crosser from strong side
          if (persistentCovCalls.robber_underFromStrong) {
            const candidates = [r1s, r2s].filter(p => p && isUnder(p));
            if (candidates.length > 0) {
              const deepest = candidates.reduce((a, b) =>
                (a.simY ?? a.y) < (b.simY ?? b.y) ? a : b);
              return manCover(deepest.id, YARD_PX);
            }
          }
          // default: hook zone weak
          return zoneToManConvert(d, hookW)        || zoneDrop(hookW);
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // e.i: #2w under → Under call for Strong Apex, work Curl-to-Flat (priority)
          if (r2w && isUnder(r2w)) {
            persistentCovCalls.robber_underFromWeak = true;
            return zoneDrop(curlFlatW);
          }
          // e.ii: smash call from Weak CB → cover #1w hitch
          if (persistentCovCalls.robber_smashWeak) {
            return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
          }
          // e.iii: push call from Hook → take RB in man
          if (persistentCovCalls.robber_pushWeak) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // default: man #2w
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          // f.i: under → Under call for Strong Apex, drop deep third weak
          if (r1w && isUnder(r1w)) {
            persistentCovCalls.robber_underFromWeak = true;
            return zoneDrop(deepW);
          }
          // f.ii: hitch → Smash call for Weak Apex, drop deep third weak
          if (r1w && isHitch(r1w)) {
            persistentCovCalls.robber_smashWeak = true;
            return zoneDrop(deepW);
          }
          // default: mod man #1w
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. SS (deep middle — Robber equiv of Sky FS) ───────────────
        if (role === 'SAF_S') {
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      // ── 3x1 ──────────────────────────────────────────────────────────
      if (isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r3s = rec(strongSide, 3);
        const r1w = rec(weakSide, 1);

        // RB release direction — freeze once detected
        // RB release direction — first direction wins, vertical treated as weak
        if (rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx   = lr(rb)?.vel?.x ?? 0;
          const rbVert = isVerticalRoute(rb, lrState);
          if (rbVx !== 0 || rbVert) {
            const goingWeak   = (weakSide   === 'L' ? rbVx < 0 : rbVx > 0) || rbVert;
            const goingStrong = (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
            if (goingWeak   && !persistentCovCalls.robber_rbReleasedStrong3x1)
              persistentCovCalls.robber_rbReleasedWeak3x1   = true;
            if (goingStrong && !persistentCovCalls.robber_rbReleasedWeak3x1)
              persistentCovCalls.robber_rbReleasedStrong3x1 = true;
          }
        }

        // ── a. Strong Corner ─────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i: under → drop deep (Hook+Weak Apex read directly via sorted index)
          if (r1s && isUnder(r1s)) {
            return zoneDrop(deepS);
          }
          // a.ii: hitch → Smash call for SS, drop deep
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.robber_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (3x1) ───────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: #3s out or flat → take #3s (priority)
          if (r3s && (isOutRoute(r3s, lrState) || isFlatRoute(r3s, strongSide, lrState, snapshot))) {
            return manCover(r3s.id, YARD_PX);
          }
          // b.ii: smash call → cover #1s hitch
          if (persistentCovCalls.robber_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.iii: no smash, #2s under → take #1s (Hook+Weak Apex read crossers directly)
          if (r2s && isUnder(r2s)) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. SS (hook zone 3x1) ──────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // c.i: #3s out → take #2s
          if (r3s && isOutRoute(r3s, lrState)) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: #3s under → Curl-Hook zone; once #1w crosses middle take him
          if (r3s && isUnder(r3s)) {
            const r1wLr = lr(r1w);
            if (r1w && r1wLr?.crossedMiddleNow) {
              return manCover(r1w.id, YARD_PX);
            }
            return zoneDrop(hookS);
          }
          // default: man #3s
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop(hookS);
        }

        // ── d. FS (hook zone weak 3x1) ─────────────────────────────────
        if (role === 'SAF_W') {
          // d.i: #3s vertical inside → man #3s (priority)
          if (r3s && isVertInsideRoute(r3s, lrState)) {
            return manCover(r3s.id, YARD_PX);
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.robber_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Hook takes index 0 (deepest available)
          if (underCrossers.length > 0) {
            return manCover(underCrossers[0].id, YARD_PX);
          }
          // rb released strong (and no under crossers) → take rb
          if (persistentCovCalls.robber_rbReleasedStrong3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
          }
          return zoneDrop('HOOK_MIDDLE');
        }

        // ── e. Weak Apex ──────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // rb releasing weak → man rb (priority)
          if (persistentCovCalls.robber_rbReleasedWeak3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.robber_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Weak Apex takes index 1 (second deepest)
          if (underCrossers.length > 1) {
            return manCover(underCrossers[1].id, YARD_PX);
          }
          // no second crosser after 1s → take #1w
          if (playPhaseTime >= 0.6) {
            return r1w ? manCover(r1w.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          return zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. SS (deep middle 3x1) ────────────────────────────────────
        if (role === 'SAF_S') {
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      return null;
    },
  },

  // ── Cover 3 Weak Match ──────────────────────────────────────────────
  // 2-high shell. Post-snap role shift vs Sky:
  //   Strong Apex → plays Strong Safety rules (man #2s)    — Sky: SS
  //   Hook        → plays Strong Hook rules  (HOOK_S)      — Sky: Strong Apex
  //   Weak Apex   → plays Weak Hook rules    (HOOK_W)      — Sky: Hook
  //   FS          → plays Weak Apex rules    (man #2w)     — Sky: Weak Apex
  //   SS          → plays Deep Middle                      — Sky: FS
  //   CB strong, CB weak unchanged
  'cover3-weak': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result   = new Map();
      if (!snapshot) return result;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW      = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS      = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW      = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      roles.forEach((role, id) => {
        const d      = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const rb       = snapshot.primaryBackfield || null;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;
          case 'CB': {
            const r1 = rec(roleSide, 1);
            if (isStrong) result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepS));
            else          result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : zoneDrop(deepW));
            break;
          }
          // Weak: Strong Apex mans #2s pre-snap
          case 'APEX-L':
          case 'APEX-R': {
            const apSide = role === 'APEX-L' ? 'L' : 'R';
            if (apSide === strongSide) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS));
            } else {
              // Weak Apex: HOOK_W zone pre-snap
              result.set(id, zoneDrop(hookW));
            }
            break;
          }
          // Weak: Hook drops to HOOK_S
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, zoneDrop(hookS)); break;
          // Weak: SS plays Deep Middle
          case 'SAF_S':
            result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          // Weak: FS mans #2w pre-snap
          case 'SAF_W': {
            const r2w = rec(weakSide, 2);
            result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            break;
          }
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
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = snapshot.isTrips;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // Route helpers
      function rec(s, n)          { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)              { return p ? lrState[p.id] : null; }
      function isUnder(p)         { return isUnderRoute(p, lrState); }
      function isHitch(p)         { return isHitchRoute(p, lrState); }
      function isVertical(p)      { return isVerticalRoute(p, lrState); }
      function isOut(p)       { return isOutRoute(p, lrState); }
      function canReach(def, rec) { return canReachRoute(def, rec, lrState); }
      // Zone-to-man conversion: after 1.5s, unguarded receiver in hook/curl zone → man
      function zoneToManConvert(defender, lmId) {
        const hookZones = ['HOOK_L','HOOK_R','HOOK_MIDDLE','CURL_FLAT_L','CURL_FLAT_R'];
        if (!hookZones.includes(lmId)) return null;
        if (playPhaseTime < 1.1) return null;
        const dx = defender.simX ?? defender.x;
        const dy = defender.simY ?? defender.y;
        // Include primary RB — not in eligible array
        const allReceivers = rb ? [...eligible, rb] : eligible;
        // Find nearest unguarded receiver — no zone bounds, nearest wins
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

      // Zone landmarks
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';
      const deepS     = strongSide === 'L' ? 'DEEP_L'      : 'DEEP_R';
      const deepW     = weakSide   === 'L' ? 'DEEP_L'      : 'DEEP_R';

      // Frozen calls (persistentCovCalls — reset each snap automatically)
      // weak_smashStrong     : Strong CB saw #1s hitch  → SS covers #1s
      // weak_smashWeak       : Weak CB saw #1w hitch    → Weak Apex covers #1w
      // weak_pushStrong      : Strong Apex pushed SS    → SS takes RB
      // weak_pushWeak        : Hook pushed Weak Apex    → Weak Apex takes RB
      // weak_underFromStrong : Strong CB or SS saw under → Hook takes deepest crosser
      // weak_underFromWeak   : Weak CB or Weak Apex saw under → Strong Apex takes crosser

      // ── 2x2 ──────────────────────────────────────────────────────────
      if (!isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);

        // ── a. Strong Corner ──────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i under → Under call for Hook, drop deep third strong
          if (r1s && isUnder(r1s)) {
            persistentCovCalls.weak_underFromStrong = true;
            return zoneDrop(deepS);
          }
          // a.ii hitch → Smash call for SS, drop deep third strong
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.weak_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (mans #2s — Weak equiv of Sky SS) ──────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: smash call → cover #1s hitch (priority)
          if (persistentCovCalls.weak_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.ii: #2s under → Under call for Hook, work Curl-to-Flat
          if (r2s && isUnder(r2s)) {
            persistentCovCalls.weak_underFromStrong = true;
            return zoneDrop(curlFlatS);
          }
          // b.iii: push call → take RB in man
          if (persistentCovCalls.weak_pushStrong) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. Hook (HOOK_S — Weak equiv of Sky Strong Apex) ──────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // c.i: rb releasing strong, cannot reach rb but can reach #2s → Push call for SS, take #2s
          if (persistentCovCalls.weak_pushStrong === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingStrong && !canReach(d, rb) && r2s && canReach(d, r2s)) {
              persistentCovCalls.weak_pushStrong = true;
              return manCover(r2s.id, YARD_PX);
            }
          }
          if (persistentCovCalls.weak_pushStrong) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: under call from weak side → take crosser from weak side
          if (persistentCovCalls.weak_underFromWeak) {
            const crosser = [r1w, r2w].find(p => p && isUnder(p));
            if (crosser) return manCover(crosser.id, YARD_PX);
          }
          // c.iii: no under call from weak AND rb/#3 late out strong → take in man
          const r3 = rec(strongSide, 3) || rb;
          if (!persistentCovCalls.weak_underFromWeak && r3 && isOut(r3)) {
            return manCover(r3.id, YARD_PX);
          }
          // default: hook zone strong
          return zoneToManConvert(d, hookS)        || zoneDrop(hookS);
        }

        // ── d. Weak Apex (HOOK_W — Weak equiv of Sky Hook) ────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // d.i: rb releasing weak, cannot reach rb but can reach #2w → Push call for Weak Apex, take #2w
          if (persistentCovCalls.weak_pushWeak === undefined && rb && lr(rb)?.moveType !== 'stopped') {
            const rbVx = lr(rb)?.vel?.x ?? 0;
            const rbGoingWeak = weakSide === 'L' ? rbVx < 0 : rbVx > 0;
            if (rbGoingWeak && !canReach(d, rb) && r2w && canReach(d, r2w)) {
              persistentCovCalls.weak_pushWeak = true;
              return manCover(r2w.id, YARD_PX);
            }
          }
          if (persistentCovCalls.weak_pushWeak) {
            return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(hookW);
          }
          // d.ii: under call from strong side → take deepest crosser from strong side
          if (persistentCovCalls.weak_underFromStrong) {
            const candidates = [r1s, r2s].filter(p => p && isUnder(p));
            if (candidates.length > 0) {
              const deepest = candidates.reduce((a, b) =>
                (a.simY ?? a.y) < (b.simY ?? b.y) ? a : b);
              return manCover(deepest.id, YARD_PX);
            }
          }
          // default: hook zone weak
          return zoneToManConvert(d, hookW)        || zoneDrop(hookW);
        }

        // ── e. FS (man #2w — Weak equiv of Sky Weak Apex) ─────────────
        if (role === 'SAF_W') {
          // e.i: #2w under → Under call for Strong Apex, work Curl-to-Flat (priority)
          if (r2w && isUnder(r2w)) {
            persistentCovCalls.weak_underFromWeak = true;
            return zoneDrop(curlFlatW);
          }
          // e.ii: smash call from Weak CB → cover #1w hitch
          if (persistentCovCalls.weak_smashWeak) {
            return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlFlatW);
          }
          // e.iii: push call from Hook → take RB in man
          if (persistentCovCalls.weak_pushWeak) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // default: man #2w
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          // f.i: under → Under call for Strong Apex, drop deep third weak
          if (r1w && isUnder(r1w)) {
            persistentCovCalls.weak_underFromWeak = true;
            return zoneDrop(deepW);
          }
          // f.ii: hitch → Smash call for Weak Apex, drop deep third weak
          if (r1w && isHitch(r1w)) {
            persistentCovCalls.weak_smashWeak = true;
            return zoneDrop(deepW);
          }
          // default: mod man #1w
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. SS (Deep Middle — Weak equiv of Sky FS) ────────────────
        if (role === 'SAF_S') {
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      // ── 3x1 ──────────────────────────────────────────────────────────
      if (isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r3s = rec(strongSide, 3);
        const r1w = rec(weakSide, 1);

        // RB release direction — freeze once detected
        // RB release direction — first direction wins, vertical treated as weak
        if (rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx   = lr(rb)?.vel?.x ?? 0;
          const rbVert = isVerticalRoute(rb, lrState);
          if (rbVx !== 0 || rbVert) {
            const goingWeak   = (weakSide   === 'L' ? rbVx < 0 : rbVx > 0) || rbVert;
            const goingStrong = (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
            if (goingWeak   && !persistentCovCalls.weak_rbReleasedStrong3x1)
              persistentCovCalls.weak_rbReleasedWeak3x1   = true;
            if (goingStrong && !persistentCovCalls.weak_rbReleasedWeak3x1)
              persistentCovCalls.weak_rbReleasedStrong3x1 = true;
          }
        }

        // ── a. Strong Corner ─────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          // a.i: under → drop deep (Hook+Weak Apex read directly via sorted index)
          if (r1s && isUnder(r1s)) {
            return zoneDrop(deepS);
          }
          // a.ii: hitch → Smash call for SS, drop deep
          if (r1s && isHitch(r1s)) {
            persistentCovCalls.weak_smashStrong = true;
            return zoneDrop(deepS);
          }
          // default: mod man #1s
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepS);
        }

        // ── b. Strong Apex (3x1) ───────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          // b.i: #3s out or flat → take #3s (priority)
          if (r3s && (isOutRoute(r3s, lrState) || isFlatRoute(r3s, strongSide, lrState, snapshot))) {
            return manCover(r3s.id, YARD_PX);
          }
          // b.ii: smash call → cover #1s hitch
          if (persistentCovCalls.weak_smashStrong) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // b.iii: no smash, #2s under → take #1s (Hook+Weak Apex read crossers directly)
          if (r2s && isUnder(r2s)) {
            return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlFlatS);
          }
          // default: man #2s
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlFlatS);
        }

        // ── c. Hook (HOOK_S 3x1) ────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // c.i: #3s out → take #2s
          if (r3s && isOutRoute(r3s, lrState)) {
            return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hookS);
          }
          // c.ii: #3s under → Curl-Hook zone; once #1w crosses middle take him
          if (r3s && isUnder(r3s)) {
            const r1wLr = lr(r1w);
            if (r1w && r1wLr?.crossedMiddleNow) {
              return manCover(r1w.id, YARD_PX);
            }
            return zoneDrop(hookS);
          }
          // default: man #3s
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop(hookS);
        }

        // ── d. Weak Apex (HOOK_W 3x1) ──────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          // d.i: #3s vertical inside → man #3s (priority)
          if (r3s && isVertInsideRoute(r3s, lrState)) {
            return manCover(r3s.id, YARD_PX);
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.weak_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Hook takes index 0 (deepest available)
          if (underCrossers.length > 0) {
            return manCover(underCrossers[0].id, YARD_PX);
          }
          // rb released strong (and no under crossers) → take rb
          if (persistentCovCalls.weak_rbReleasedStrong3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
          }
          return zoneDrop('HOOK_MIDDLE');
        }

        // ── e. FS (man #2w 3x1) ─────────────────────────────────────────
        if (role === 'SAF_W') {
          // rb releasing weak → man rb (priority)
          if (persistentCovCalls.weak_rbReleasedWeak3x1) {
            return rb ? manCover(rb.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          // If #2s is under OR smash active → SS takes #1s → exclude #1s from crosser list
          const ssHasR1s = (r2s && isUnder(r2s)) || persistentCovCalls.weak_smashStrong;
          const underCrossers = [ssHasR1s ? null : r1s, r2s]
            .filter(p => p && isUnder(p))
            .sort((a, b) => (a.simY ?? a.y) - (b.simY ?? b.y));
          // Weak Apex takes index 1 (second deepest)
          if (underCrossers.length > 1) {
            return manCover(underCrossers[1].id, YARD_PX);
          }
          // no second crosser after 1s → take #1w
          if (playPhaseTime >= 0.6) {
            return r1w ? manCover(r1w.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          return zoneDrop(curlFlatW);
        }

        // ── f. Weak Corner ────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── g. SS (Deep Middle 3x1) ─────────────────────────────────────
        if (role === 'SAF_S') {
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      return null;
    },
  },
}; // end _PR_COVER3
