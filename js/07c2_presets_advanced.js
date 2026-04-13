// ── PRESET REGISTRY PART C2: Advanced Side-Only Coverages ───────────
// Cougar-weak, Vice, Trio, Zeke, Knife, Stubbie — incl. 3x1 specialised
// Merged into PRESET_REGISTRY in 07d_presets_fullfield.js

const _PR_SIDE2 = {
  // ── Cougar — Weak Side (Side-Only) ───────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Out-call is a live read every tick — no persistentCovCalls needed.
  'cougar-weak': {
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
          // a. Corner: man #1 default
          case 'CB':
            if (isWeak)
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW));
            break;

          // b. Apex: man #2 default
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak)
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;

          // c. FS: deep half zone default
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW)); break;
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
      const isWeak     = roleSide === weakSide;

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const deepHW    = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      const r2wIsOut = r2w ? isOutRoute(r2w, lrState) : false;

      // ── a. Weak Corner ───────────────────────────────────────────────
      // Default: man #1. #2 running out: man #2.
      if (role === 'CB' && isWeak) {
        if (r2wIsOut)
          return r2w ? manCover(r2w.id, YARD_PX * 0.5) : zoneDrop(deepHW);
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);
      }

      // ── b. Weak Apex ─────────────────────────────────────────────────
      // Default: man #2. #2 running out: switch to man #1.
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2wIsOut)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS ────────────────────────────────────────────────────────
      // Default: deep half. #2 running out: man #1.
      if (role === 'SAF_W') {
        if (r2wIsOut)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Vice — Strong Side (Side-Only) ───────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false)
  // No persistentCovCalls — all live reads.
  //   CB  → man #1
  //   Apex → man #2, except #2 isOut → man #1
  //   SS   → man #2
  //   Hook → man RB
  'vice-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
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
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'SAF_S':
            result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepHS));
            break;
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
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

      // ── a. Strong Corner — man #1 always ─────────────────────────────
      if (role === 'CB' && isStrong)
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);

      // ── b. Strong Apex — man #2, except #2 isOut → man #1 ────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isOutRoute(r2s, lrState))
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — man #2 always ─────────────────────────────────────────
      if (role === 'SAF_S')
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(deepHS);

      // ── d. Hook — man RB ──────────────────────────────────────────────
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

  // ── Vice — Weak Side (Side-Only) ─────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  //   CB  → man #1w
  //   Apex → man #2w, except #2w isOut → man #1w
  //   FS   → man #2w
  'vice-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
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
          case 'CB':
            if (isWeak)
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak)
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
          case 'SAF_W':
            result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepHW));
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
      const isWeak     = roleSide === weakSide;

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const deepHW    = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner — man #1 always ───────────────────────────────
      if (role === 'CB' && isWeak)
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);

      // ── b. Weak Apex — man #2, except #2 isOut → man #1 ──────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        if (r2w && isOutRoute(r2w, lrState))
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — man #2 always ─────────────────────────────────────────
      if (role === 'SAF_W')
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(deepHW);

      return null;
    },
  },


  // ── Cone — Strong Side (Side-Only) ───────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false)
  // No persistentCovCalls — all live reads.
  //   CB   → press man #1; if #1 isUnder → zone deep quarter strong
  //   Apex → man #2
  //   SS   → man #1
  //   Hook → man RB
  'cone-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'press', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L'  : 'DEEP_HALF_R';
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L'  : 'DEEP_QRTR_R';
       const curlS  = strongSide === 'L' ? 'CURL_L'       : 'CURL_R';
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
          // a. CB: press man #1 (under-read happens in react)
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS));
            break;
          // b. Apex: man #2
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          // c. SS: man #1
          case 'SAF_S':
            result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          // d. Hook: man RB
          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M':
            result.set(id, rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
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
      const deepQS    = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlS     = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);

      // ── a. Strong Corner — press man #1; #1 isUnder → deep quarter zone
      if (role === 'CB' && isStrong) {
        if (r1s && isUnderRoute(r1s, lrState))
          return zoneDrop(deepQS);
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex — man #2 always
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong)
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);

      // ── c. SS — man #1 always
      if (role === 'SAF_S')
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);

      // ── d. Hook — man RB
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

  // ── Cone — Weak Side (Side-Only) ─────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  //   CB   → press man #1w; if #1w isUnder → zone deep quarter weak
  //   Apex → man #2w
  //   FS   → man #1w
  'cone-weak': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'press', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQW     = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
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
          case 'CB':
            if (isWeak)
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak)
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
          case 'SAF_W':
            result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW));
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
      const isWeak     = roleSide === weakSide;

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const deepHW    = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQW    = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlW     = weakSide   === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      // ── a. Weak Corner — press man #1w; #1w isUnder → deep quarter zone
      if (role === 'CB' && isWeak) {
        if (r1w && isUnderRoute(r1w, lrState))
          return zoneDrop(deepQW);
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW);
      }

      // ── b. Weak Apex — man #2w always
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak)
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);

      // ── c. FS — man #1w always
      if (role === 'SAF_W')
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepHW);

      return null;
    },
  },

  // ── MES — Strong Side (Side-Only) ────────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false)
  // persistentCovCalls prefix: mes_
  //   mes_rbReleaseSide      — Hook: frozen release direction of RB
  //   mes_switchToApexStrong — Hook: RB > 9yd strong → Apex takes RB
  //   switchToApexWeak   — Hook: RB > 9yd weak   → Weak Apex takes RB
  // Under-call is a live read every tick — no persistentCovCalls needed for it.
  'mes-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlS      = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
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
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
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

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)     { return p ? lrState[p.id] : null; }

      const deepHS = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQS = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlS  = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide,   2);

      const r1sIsUnder = r1s ? isUnderRoute(r1s, lrState) : false;

      // ── a. Strong Corner — man #1; #1 isUnder → zone deep quarter
      if (role === 'CB' && isStrong) {
        if (r1sIsUnder) return zoneDrop(deepQS);
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex — priority order i → ii → iii → iiii → default
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const r2sLr    = lr(r2s);
        const r2sDeep  = r2sLr && r2sLr.depthYards >= 8;
        const allRec   = rb ? [...eligible, rb] : eligible;

        // i. #2 > 8yd AND any player isFlat → man that flat player
        if (r2sDeep) {
          const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }

        // ii. Under-call from CB (live read) → man #1
        if (r1sIsUnder)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);

        // iii. Switch-call from Hook → man RB
        if (persistentCovCalls.mes_switchToApexStrong)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);

        // iiii. #2 > 8yd → curl zone
        if (r2sDeep) return zoneDrop(curlS);

        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — deep half; #2 > 6yd → man #2; after 1s if #2 still shallow → man #1
      if (role === 'SAF_S') {
        const r2sLr = lr(r2s);
        if (r2s && r2sLr && r2sLr.depthYards > 6)
          return manCover(r2s.id, YARD_PX);
        if (r1s && playPhaseTime >= 1.0)
          return manCover(r1s.id, YARD_PX * 0.5);
        return zoneDrop(deepHS);
      }

      // ── d. Hook — identical to MEG ────────────────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (rb) {
          const rbLr     = lr(rb);
          const rbVx     = rbLr?.vel?.x ?? 0;
          const rbVy     = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            if (persistentCovCalls.mes_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.mes_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const distYdsRb = Math.hypot(
              (rb.simX ?? rb.x) - (d.simX ?? d.x),
              (rb.simY ?? rb.y) - (d.simY ?? d.y)
            ) / YARD_PX;
            const side = persistentCovCalls.mes_rbReleaseSide;

            if (persistentCovCalls.switchToApexWeak === undefined && distYdsRb > 9) {
              if (side === 'strong') {
                persistentCovCalls.mes_switchToApexStrong = true;
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
              } else {
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }

            if (persistentCovCalls.mes_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
              const apexHasRb = defensePlayers.some(def =>
                def.id !== d.id &&
                (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
                def.decision?.focusTargetId === rb.id
              );
              if (apexHasRb) {
                return side === 'strong'
                  ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                  : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              }
              return manCover(rb.id, YARD_PX);
            }

            return manCover(rb.id, YARD_PX);
          }
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── MES — Weak Side (Side-Only) ──────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads switchToApexWeak from Hook (mes-strong).
  'mes-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const curlW      = weakSide === 'L' ? 'CURL_L'      : 'CURL_R';
      const deepQW     = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
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
          case 'CB':
            if (isWeak)
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW));
            break;
          case 'APEX-L':
          case 'APEX-R':
            if (isWeak)
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW)); break;
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

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)     { return p ? lrState[p.id] : null; }

      const deepHW = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQW = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlW  = weakSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      const r1wIsUnder = r1w ? isUnderRoute(r1w, lrState) : false;

      // ── a. Weak Corner — man #1; #1 isUnder → zone deep quarter
      if (role === 'CB' && isWeak) {
        if (r1wIsUnder) return zoneDrop(deepQW);
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW);
      }

      // ── b. Weak Apex — priority order i → ii → iii → iiii → default
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const r2wLr   = lr(r2w);
        const r2wDeep = r2wLr && r2wLr.depthYards >= 8;
        const allRec  = rb ? [...eligible, rb] : eligible;

        // i. #2 > 8yd AND any player isFlat → man that flat player
        if (r2wDeep) {
          const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }

        // ii. Under-call from CB (live read) → man #1
        if (r1wIsUnder)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);

        // iii. Switch-call from Hook → man RB
        if (persistentCovCalls.switchToApexWeak)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);

        // iiii. #2 > 8yd → curl zone
        if (r2wDeep) return zoneDrop(curlW);

        // default: man #2
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — deep half; #2 > 6yd → man #2; after 1s if #2 still shallow → man #1
      if (role === 'SAF_W') {
        const r2wLr = lr(r2w);
        if (r2w && r2wLr && r2wLr.depthYards > 6)
          return manCover(r2w.id, YARD_PX);
        if (r1w && playPhaseTime >= 1.0)
          return manCover(r1w.id, YARD_PX * 0.5);
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Mix — Strong Side (Side-Only) ────────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false)
  // persistentCovCalls prefix: quarters_
  //   quarters_rbReleaseSide      — Hook: frozen release direction of RB
  //   quarters_switchToApexStrong — Hook: RB > 9yd strong → Apex takes RB
  //   switchToApexWeak   — Hook: RB > 9yd weak   → Weak Apex takes RB
  // Under-call and Smash-call are live reads — no persistentCovCalls needed.
  'quarters-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
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
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
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

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)     { return p ? lrState[p.id] : null; }

      const deepHS = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQS = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlS  = strongSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r2w = rec(weakSide,   2);

      const r1sIsUnder = r1s ? isUnderRoute(r1s, lrState) : false;
      const r1sIsHitch = r1s ? isHitchRoute(r1s, lrState) : false;

      // ── a. Strong Corner — man #1; isUnder or isHitch → zone deep quarter
      if (role === 'CB' && isStrong) {
        if (r1sIsUnder || r1sIsHitch) return zoneDrop(deepQS);
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex — priority i → ii → iii → iiii → iiiii → default
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        const r2sLr   = lr(r2s);
        const r2sDeep = r2sLr && r2sLr.depthYards >= 8;
        const allRec  = rb ? [...eligible, rb] : eligible;

        // i. #2 ≥ 8yd AND flat receiver → man flat receiver
        if (r2sDeep) {
          const flatRec = findFlatRouteRec(allRec, strongSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }

        // ii. Under-call (live) → man #1
        if (r1sIsUnder)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);

        // iii. Smash-call (live) → man #1
        if (r1sIsHitch)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(curlS);

        // iiii. Switch-call from Hook → man RB
        if (persistentCovCalls.quarters_switchToApexStrong)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlS);

        // iiiii. #2 ≥ 8yd (no flat) → CURL zone
        if (r2sDeep) return zoneDrop(curlS);

        // default: man #2
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. SS — deep half; #2 > 6yd → man #2; after 1s if #2 still shallow and not hitch → man #1
      if (role === 'SAF_S') {
        const r2sLr = lr(r2s);
        if (r2s && r2sLr && r2sLr.depthYards > 6)
          return manCover(r2s.id, YARD_PX);
        if (r1s && playPhaseTime >= 1.0 && !isHitchRoute(r1s, lrState))
          return manCover(r1s.id, YARD_PX * 0.5);
        return zoneDrop(deepHS);
      }

      // ── d. Hook — identical to MEG with mix_ prefix
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (rb) {
          const rbLr     = lr(rb);
          const rbVx     = rbLr?.vel?.x ?? 0;
          const rbVy     = rbLr?.vel?.y ?? 0;
          const rbMoving = rbLr?.moveType !== 'stopped' && (Math.abs(rbVx) > 10 || rbVy < -10);

          if (rbMoving) {
            if (persistentCovCalls.quarters_rbReleaseSide === undefined) {
              const rbVertical    = Math.abs(rbVx) < Math.abs(rbVy) * 0.4;
              const rbGoingStrong = !rbVertical && (strongSide === 'L' ? rbVx < 0 : rbVx > 0);
              persistentCovCalls.quarters_rbReleaseSide = rbGoingStrong ? 'strong' : 'weak';
            }
            if (playPhaseTime < 0.1) return zoneDrop('HOOK_MIDDLE');

            const distYdsRb = Math.hypot(
              (rb.simX ?? rb.x) - (d.simX ?? d.x),
              (rb.simY ?? rb.y) - (d.simY ?? d.y)
            ) / YARD_PX;
            const side = persistentCovCalls.quarters_rbReleaseSide;

            if (persistentCovCalls.switchToApexWeak === undefined && distYdsRb > 9) {
              if (side === 'strong') {
                persistentCovCalls.quarters_switchToApexStrong = true;
              } else if (weakApexWillAcceptSwitch(snapshot, ['meg-weak','c2m-weak','palms-weak','bracket-weak','mes-weak','quarters-weak'])) {
                persistentCovCalls.switchToApexWeak = true;
              } else {
                persistentCovCalls.switchToApexWeak = false; // frozen: no switch this play
                return rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
              }
            }

            if (persistentCovCalls.quarters_switchToApexStrong || persistentCovCalls.switchToApexWeak) {
              const apexHasRb = defensePlayers.some(def =>
                def.id !== d.id &&
                (def.decision?._structRole === 'APEX-L' || def.decision?._structRole === 'APEX-R') &&
                def.decision?.focusTargetId === rb.id
              );
              if (apexHasRb) {
                return side === 'strong'
                  ? (r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                  : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              }
              return manCover(rb.id, YARD_PX);
            }

            return manCover(rb.id, YARD_PX);
          }
        }
        return zoneDrop('HOOK_MIDDLE');
      }

      return null;
    },
  },

  // ── Mix — Weak Side (Side-Only) ──────────────────────────────────────
  // Owns: Weak CB, Weak Apex, FS
  // Reads switchToApexWeak from Hook (quarters-strong).
  'quarters-weak': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const deepHW     = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQW     = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlW      = weakSide === 'L' ? 'CURL_L'      : 'CURL_R';
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
          case 'CB':
            if (isWeak)
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isWeak)
              result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW));
            break;
          case 'SAF_W':
            result.set(id, zoneDrop(deepHW)); break;
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

      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)     { return p ? lrState[p.id] : null; }

      const deepHW = weakSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const deepQW = weakSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlW  = weakSide === 'L' ? 'CURL_L'      : 'CURL_R';

      const r1w = rec(weakSide, 1);
      const r2w = rec(weakSide, 2);

      const r1wIsUnder = r1w ? isUnderRoute(r1w, lrState) : false;
      const r1wIsHitch = r1w ? isHitchRoute(r1w, lrState) : false;

      // ── a. Weak Corner — man #1; isUnder or isHitch → zone deep quarter
      if (role === 'CB' && isWeak) {
        if (r1wIsUnder || r1wIsHitch) return zoneDrop(deepQW);
        return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepQW);
      }

      // ── b. Weak Apex — priority i → ii → iii → iiii → iiiii → default
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
        const r2wLr   = lr(r2w);
        const r2wDeep = r2wLr && r2wLr.depthYards >= 8;
        const allRec  = rb ? [...eligible, rb] : eligible;

        // i. #2 ≥ 8yd AND flat receiver → man flat receiver
        if (r2wDeep) {
          const flatRec = findFlatRouteRec(allRec, weakSide, lrState, snapshot);
          if (flatRec) return manCover(flatRec.id, YARD_PX * 0.5);
        }

        // ii. Under-call (live) → man #1
        if (r1wIsUnder)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);

        // iii. Smash-call (live) → man #1
        if (r1wIsHitch)
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(curlW);

        // iiii. Switch-call from Hook → man RB
        if (persistentCovCalls.switchToApexWeak)
          return rb ? manCover(rb.id, YARD_PX * 0.5) : zoneDrop(curlW);

        // iiiii. #2 ≥ 8yd (no flat) → CURL zone
        if (r2wDeep) return zoneDrop(curlW);

        // default: man #2
        return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlW);
      }

      // ── c. FS — deep half; #2 > 6yd → man #2; after 1s if #2 still shallow and not hitch → man #1
      if (role === 'SAF_W') {
        const r2wLr = lr(r2w);
        if (r2w && r2wLr && r2wLr.depthYards > 6)
          return manCover(r2w.id, YARD_PX);
        if (r1w && playPhaseTime >= 1.0 && !isHitchRoute(r1w, lrState))
          return manCover(r1w.id, YARD_PX * 0.5);
        return zoneDrop(deepHW);
      }

      return null;
    },
  },


  // ── Buster — Strong Side (3x1 only) ──────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false) — backside handled by 3x1-backside slot
  // persistentCovCalls prefix: buster_
  //   buster_passCallCB    — CB: #2 >= 9yd → CB man #2, SS man #1
  //   buster_passCallApex  — Apex: #3 isOut → Apex man #3, Hook man #2
  'buster-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'press', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
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
        const r3s = rec(strongSide, 3);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          // a. CB: press man #1
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          // b. Apex: man #2
          case 'APEX-L': case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          // c. Hook: man #3
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            break;
          // d. SS: deep half
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
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
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — press man #1; #2 >= 9yd AND #1 >= 9yd → freeze Pass-call, man #2
      if (role === 'CB' && isStrong) {
        if (persistentCovCalls.buster_passCallCB)
          return r2s ? manCover(r2s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        const r1sLr = lr(r1s);
        const r2sLr = lr(r2s);
        if (r2s && r2sLr && r2sLr.depthYards >= 9 && r1sLr && r1sLr.depthYards >= 9) {
          persistentCovCalls.buster_passCallCB = true;
          return manCover(r2s.id, YARD_PX * 0.5);
        }
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
      }

      // ── b. Strong Apex — man #2; #3 isOut → freeze Push-call, man #3
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (persistentCovCalls.buster_passCallApex)
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop(curlS);
        if (r3s && isOutRoute(r3s, lrState)) {
          persistentCovCalls.buster_passCallApex = true;
          return manCover(r3s.id, YARD_PX);
        }
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);
      }

      // ── c. Hook — man #3; Pass-call from Apex → man #2
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (persistentCovCalls.buster_passCallApex)
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
        return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
      }

      // ── d. SS — deep half; Pass-call from CB → man #1
      if (role === 'SAF_S') {
        if (persistentCovCalls.buster_passCallCB)
          return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);
        return zoneDrop(deepHS);
      }

      return null;
    },
  },


  // ── Steeler — Strong Side (3x1 only) ─────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // Two-high (isOneHigh: false) — backside handled by 3x1-backside slot
  // No persistentCovCalls — all live reads.
  //   CB   → man #1
  //   Apex → man #2
  //   Hook → man #3
  //   SS   → deep half; if only #2 >= 9yd → man #2; if only #3 >= 9yd → man #3;
  //          if both >= 9yd → deep half; if neither >= 9yd and #1 >= 9yd → man #1
  'steeler-strong': {
    fullField: false,
    isOneHigh: false,

    decide(roles, byId, snapshot) {
      const result     = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
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
        const r3s = rec(strongSide, 3);

        switch (role) {
          case 'RUSH': case 'UNDER': result.set(id, rushDec()); break;
          case 'CB':
            if (isStrong)
              result.set(id, r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong)
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS)); break;
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
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1 always
      if (role === 'CB' && isStrong)
        return r1s ? manCover(r1s.id, YARD_PX * 0.5) : zoneDrop(deepHS);

      // ── b. Strong Apex — man #2 always
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong)
        return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(curlS);

      // ── c. Hook — man #3 always
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M')
        return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');

      // ── d. SS — live reads, no freeze
      if (role === 'SAF_S') {
        const r2sLr  = lr(r2s);
        const r3sLr  = lr(r3s);
        const r1sLr  = lr(r1s);
        const r2sDeep = r2s && r2sLr && r2sLr.depthYards >= 9;
        const r3sDeep = r3s && r3sLr && r3sLr.depthYards >= 9;

        // both >= 9yd → deep half
        if (r2sDeep && r3sDeep) return zoneDrop(deepHS);

        // only #2 >= 9yd → man #2
        if (r2sDeep) return manCover(r2s.id, YARD_PX);

        // only #3 >= 9yd → man #3
        if (r3sDeep) return manCover(r3s.id, YARD_PX);

        // neither >= 9yd AND #1 >= 9yd → man #1
        if (r1s && r1sLr && r1sLr.depthYards >= 9)
          return manCover(r1s.id, YARD_PX * 0.5);

        // default: deep half
        return zoneDrop(deepHS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Stump — Strong Side (3x1 only) ──────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: man #1; if #1 hitch → smash call + bail deep quarter
  // Apex: man #2; #3 out → man #3; smash → man #1; #2 under → zone curl; push call
  // Hook: man #3; if #2 or #3 under → man him; #3 out → man #2
  // SS: #3 vert → man; #2 vert → OTT; neither → zone hook
  'stump-strong': {
    fullField: false,
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
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlS      = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepQS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, r3s ? ottDec(r3s.id) : zoneDrop(hookS));
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

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isHitch(p)    { return isHitchRoute(p, lrState); }
      function isVertical(p) { return isDeepVertical(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }

      const deepQS = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const curlS  = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS  = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1; hitch → smash + bail deep quarter ──
      if (role === 'CB' && isStrong) {
        if (persistentCovCalls.stump_smash) return zoneDrop(deepQS);
        if (r1s && isHitch(r1s)) {
          persistentCovCalls.stump_smash = true;
          return zoneDrop(deepQS);
        }
        return r1s ? manCover(r1s.id) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex — #3 out → man #3; smash → man #1; #2 under → curl ──
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // Push call: RB released strong + #2 under
        if (!persistentCovCalls.stump_push && rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingStrong && r2s && isUnder(r2s)) {
            persistentCovCalls.stump_push = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.stump_push) return rb ? manCover(rb.id) : zoneDrop(curlS);
        if (r3s && isOut(r3s)) return manCover(r3s.id);
        if (persistentCovCalls.stump_smash) return r1s ? manCover(r1s.id) : zoneDrop(curlS);
        if (r2s && isUnder(r2s)) return zoneDrop(curlS);
        return r2s ? manCover(r2s.id) : zoneDrop(curlS);
      }

      // ── c. Hook — under crosser match; #3 out → wall #2; default man #3 ──
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const u2 = r2s && isUnder(r2s);
        const u3 = r3s && isUnder(r3s);
        if (u2 && u3) {
          // Both under — take the deeper crosser
          const d2 = lr(r2s)?.depthYards ?? 0;
          const d3 = lr(r3s)?.depthYards ?? 0;
          return manCover(d2 >= d3 ? r2s.id : r3s.id);
        }
        if (u2) return manCover(r2s.id);
        if (u3) return manCover(r3s.id);
        if (r3s && isOut(r3s)) return r2s ? manCover(r2s.id) : zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── d. SS — #3 vert → man; #2 vert → OTT; neither → zone hook ──
      if (role === 'SAF_S') {
        if (r3s && isVertical(r3s)) return manCover(r3s.id);
        if (r2s && isVertical(r2s)) return ottDec(r2s.id);
        return zoneDrop(hookS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Seahawk — Strong Side (3x1 only) ────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: man #1 (off inside)
  // Apex: man #2; #3 out → man #3; push call
  // Hook: man #3; #3 out → man #2
  // SS: bracket deeper of #2/#3; both vert → midpoint; neither → zone hook
  'seahawk-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      const deepQMS    = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(hookS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            // Start OTT over #2 (typically wider threat)
            result.set(id, r2s ? ottDec(r2s.id) : zoneDrop(deepQMS));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isVertical(p) { return isDeepVertical(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }
      function isUnder(p)    { return isUnderRoute(p, lrState); }

      const hookS  = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      const deepQMS = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1, no reads ─────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── b. Strong Apex — #3 out → man #3; push call ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // Push call: RB released strong + #2 under
        if (!persistentCovCalls.seahawk_push && rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingStrong && r2s && isUnder(r2s)) {
            persistentCovCalls.seahawk_push = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.seahawk_push) return rb ? manCover(rb.id) : zoneDrop(hookS);
        if (r3s && isOut(r3s)) return manCover(r3s.id);
        return r2s ? manCover(r2s.id) : zoneDrop(hookS);
      }

      // ── c. Hook — man #3; #3 out → man #2 ──────────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r3s && isOut(r3s)) return r2s ? manCover(r2s.id) : zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── d. SS — bracket deeper; both vert → midpoint; neither → zone ──
      if (role === 'SAF_S') {
        const v2 = r2s && isVertical(r2s);
        const v3 = r3s && isVertical(r3s);
        if (v2 && v3) {
          // Midpoint both verticals — drop to deep quarter between them
          return zoneDrop(deepQMS);
        }
        if (v3 && !v2) return ottDec(r3s.id);
        if (v2 && !v3) return ottDec(r2s.id);
        // Neither vertical — bracket the deeper one by depthYards
        if (r2s && r3s) {
          const d2 = lr(r2s)?.depthYards ?? 0;
          const d3 = lr(r3s)?.depthYards ?? 0;
          return ottDec(d2 >= d3 ? r2s.id : r3s.id);
        }
        return zoneDrop(hookS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Trio — Strong Side (3x1 only) ───────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: man #1
  // Apex: first out of #2/#3; both in → zone off deeper break; default man #2
  // Hook: first in of #2/#3; both out → zone off deeper break; default man #3
  // SS: second in/out (takes what Apex/Hook leave); both vert → midpoint
  'trio-strong': {
    fullField: false,
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
      const curlS      = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      const deepQMS    = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(curlS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, r3s ? ottDec(r3s.id) : zoneDrop(deepQMS));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isVertical(p) { return isDeepVertical(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }

      const curlS   = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS   = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      const deepQMS = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1 ──────────────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── b. Apex — first out; both in → OTT deeper; FREEZE ─────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // Frozen → replay
        if (persistentCovCalls.trio_apex) return persistentCovCalls.trio_apex;

        const o2 = r2s && isOut(r2s);
        const o3 = r3s && isOut(r3s);
        // Out trigger → freeze; both out → deeper wins
        if (o2 || o3) {
          let target;
          if (o2 && o3) {
            const d2 = lr(r2s)?.depthYards ?? 0;
            const d3 = lr(r3s)?.depthYards ?? 0;
            target = d2 >= d3 ? r2s : r3s;
          } else {
            target = o2 ? r2s : r3s;
          }
          const dec = manCover(target.id);
          persistentCovCalls.trio_apex = dec;
          persistentCovCalls.trio_apex_targetId = target.id;
          return dec;
        }
        // Both in → OTT deeper, freeze
        const i2 = r2s && isUnder(r2s);
        const i3 = r3s && isUnder(r3s);
        if (i2 && i3) {
          const d2 = lr(r2s)?.depthYards ?? 0;
          const d3 = lr(r3s)?.depthYards ?? 0;
          const deeper = d2 >= d3 ? r2s : r3s;
          const dec = ottDec(deeper.id);
          persistentCovCalls.trio_apex = dec;
          persistentCovCalls.trio_apex_targetId = deeper.id;
          return dec;
        }
        // Default: man #2 (waiting for read — not frozen yet)
        return r2s ? manCover(r2s.id) : zoneDrop(curlS);
      }

      // ── c. Hook — first in; both out → OTT deeper; FREEZE ─────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        // Frozen → replay
        if (persistentCovCalls.trio_hook) return persistentCovCalls.trio_hook;

        const i2 = r2s && isUnder(r2s);
        const i3 = r3s && isUnder(r3s);
        // In trigger → freeze; both in → deeper wins
        if (i2 || i3) {
          let target;
          if (i2 && i3) {
            const d2 = lr(r2s)?.depthYards ?? 0;
            const d3 = lr(r3s)?.depthYards ?? 0;
            target = d2 >= d3 ? r2s : r3s;
          } else {
            target = i3 ? r3s : r2s;
          }
          const dec = manCover(target.id);
          persistentCovCalls.trio_hook = dec;
          persistentCovCalls.trio_hook_targetId = target.id;
          return dec;
        }
        // Both out → OTT deeper, freeze
        const o2 = r2s && isOut(r2s);
        const o3 = r3s && isOut(r3s);
        if (o2 && o3) {
          const d2 = lr(r2s)?.depthYards ?? 0;
          const d3 = lr(r3s)?.depthYards ?? 0;
          const deeper = d2 >= d3 ? r2s : r3s;
          const dec = ottDec(deeper.id);
          persistentCovCalls.trio_hook = dec;
          persistentCovCalls.trio_hook_targetId = deeper.id;
          return dec;
        }
        // Default: man #3 (waiting for read — not frozen yet)
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── d. SS — takes what Apex/Hook leave; both vert → midpoint; FREEZE ──
      if (role === 'SAF_S') {
        // Frozen → replay
        if (persistentCovCalls.trio_ss) return persistentCovCalls.trio_ss;

        const v2 = r2s && isVertical(r2s);
        const v3 = r3s && isVertical(r3s);
        if (v2 && v3) {
          const dec = zoneDrop(deepQMS);
          persistentCovCalls.trio_ss = dec;
          return dec;
        }
        // Read frozen Apex/Hook targets — take the uncovered one
        const apexTarget = persistentCovCalls.trio_apex_targetId;
        const hookTarget = persistentCovCalls.trio_hook_targetId;
        const uncovered = [r2s, r3s].find(r => r && r.id !== apexTarget && r.id !== hookTarget);
        if (uncovered) {
          const dec = isVertical(uncovered) ? manCover(uncovered.id) : ottDec(uncovered.id);
          persistentCovCalls.trio_ss = dec;
          return dec;
        }
        // Fallback
        if (v3) { const dec = manCover(r3s.id); persistentCovCalls.trio_ss = dec; return dec; }
        if (v2) { const dec = ottDec(r2s.id); persistentCovCalls.trio_ss = dec; return dec; }
        return zoneDrop(hookS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Zeke — Strong Side (3x1 only) ──────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: man #1
  // Apex: first out of #2/#3; no out → man #2
  // Hook: second in of #2/#3; no in → man #2
  // SS: deep half; if #2 or #3 ≥ 9 yards → man the deeper one
  'zeke-strong': {
    fullField: false,
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
      const deepHS     = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepHS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, zoneDrop(deepHS));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }

      const deepHS = strongSide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R';
      const hookS  = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1 ──────────────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── b. Apex — first out of #2/#3; no out → man #2 ─────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && isOut(r2s)) { persistentCovCalls.zeke_apex_took = r2s.id; return manCover(r2s.id); }
        if (r3s && isOut(r3s)) { persistentCovCalls.zeke_apex_took = r3s.id; return manCover(r3s.id); }
        return r2s ? manCover(r2s.id) : zoneDrop(hookS);
      }

      // ── c. Hook — second in; no in → man #2 ───────────────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const i2 = r2s && isUnder(r2s);
        const i3 = r3s && isUnder(r3s);
        // If both under — take the one Apex didn't take (= second)
        if (i2 && i3) {
          const apexTook = persistentCovCalls.zeke_apex_took;
          const other = [r2s, r3s].find(r => r.id !== apexTook);
          if (other) return manCover(other.id);
        }
        // Single under — take it (that's the "second" since Apex takes outs)
        if (i2) return manCover(r2s.id);
        if (i3) return manCover(r3s.id);
        // No in → man #2
        return r2s ? manCover(r2s.id) : zoneDrop(hookS);
      }

      // ── d. SS — deep half; ≥ 9 yards → man the deeper one ─────────
      if (role === 'SAF_S') {
        const d2 = lr(r2s)?.depthYards ?? 0;
        const d3 = lr(r3s)?.depthYards ?? 0;
        const deep2 = r2s && d2 >= 9;
        const deep3 = r3s && d3 >= 9;
        if (deep2 && deep3) return manCover(d2 >= d3 ? r2s.id : r3s.id);
        if (deep2) return manCover(r2s.id);
        if (deep3) return manCover(r3s.id);
        return zoneDrop(deepHS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Knife — Strong Side (3x1 only) ─────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: man #1; if #1 under or hitch → bail deep quarter
  // Apex: man #2; if #2 hitch or under → man #1
  // Hook: man #3 non-vert; if #2 inside → man #2; if #3 vert → zone hook
  // SS: #3 vert → man #3; if #2 inside → man #3; neither → OTT #1 or #2
  'knife-strong': {
    fullField: false,
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
      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(deepQS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(hookS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, r3s ? ottDec(r3s.id) : zoneDrop(deepQS));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isHitch(p)    { return isHitchRoute(p, lrState); }
      function isVertical(p) { return isDeepVertical(p, lrState); }

      const deepQS     = strongSide === 'L' ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R';
      const deepQMS    = strongSide === 'L' ? 'DEEP_QRTR_ML' : 'DEEP_QRTR_MR';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — man #1; under or hitch → bail deep quarter ──
      if (role === 'CB' && isStrong) {
        if (r1s && (isUnder(r1s) || isHitch(r1s))) return zoneDrop(deepQS);
        return r1s ? manCover(r1s.id) : zoneDrop(deepQS);
      }

      // ── b. Strong Apex — man #2; #2 short/under → man #1 ──────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        if (r2s && (isHitch(r2s) || isUnder(r2s))) return r1s ? manCover(r1s.id) : zoneDrop(hookS);
        return r2s ? manCover(r2s.id) : zoneDrop(hookS);
      }

      // ── c. Hook — man #3 non-vert; #2 inside → man #2 ─────────────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        if (r2s && isUnder(r2s)) return manCover(r2s.id);
        if (r3s && isVertical(r3s)) return zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── d. SS — #3 vert → man; help OTT on vertical #1/#2 ─────────
      if (role === 'SAF_S') {
        if (r3s && isVertical(r3s)) return manCover(r3s.id);
        if (r2s && isUnder(r2s)) return r3s ? manCover(r3s.id) : zoneDrop(deepQMS);
        if (r1s && isVertical(r1s)) return ottDec(r1s.id);
        if (r2s && isVertical(r2s)) return ottDec(r2s.id);
        return zoneDrop(deepQMS);
      }

      return null;
    },
  },


  // ══════════════════════════════════════════════════════════════════════
  // ── Stubbie — Strong Side (3x1 only) ────────────────────────────────
  // Owns: Strong CB, Strong Apex, SS, Hook
  // CB: press man #1
  // Apex: man #2; #3 out → man #3; #2 under → zone curl; push call
  // Hook: man #3; #2 or #3 under → man deeper crosser; #3 out → man #2
  // SS: #3 vert → man; #2 vert → OTT; neither → zone hook
  'stubbie-strong': {
    fullField: false,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'press', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = snapshot.coverageStrongSide || (leftCount >= rightCount ? 'L' : 'R');
      const curlS      = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS      = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';
      function rec(s, n) { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

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
            if (isStrong) result.set(id, r1s ? manCover(r1s.id) : zoneDrop(curlS));
            break;
          case 'APEX-L': case 'APEX-R':
            if (isStrong) result.set(id, r2s ? manCover(r2s.id) : zoneDrop(curlS));
            break;
          case 'HOOK-L': case 'HOOK-R': case 'HOOK-M':
            result.set(id, r3s ? manCover(r3s.id) : zoneDrop(hookS));
            break;
          case 'SAF_S':
            result.set(id, r3s ? ottDec(r3s.id) : zoneDrop(hookS));
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
      const snapX      = snapAlignment[d.id]?.x ?? (d.simX ?? d.x);
      const dSide      = snapX <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;

      function rec(s, n)     { return eligible.find(p => p._side === s && p._receiverNumber === n) || null; }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isVertical(p) { return isDeepVertical(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }

      const curlS = strongSide === 'L' ? 'CURL_L' : 'CURL_R';
      const hookS = strongSide === 'L' ? 'HOOK_L' : 'HOOK_R';

      const r1s = rec(strongSide, 1);
      const r2s = rec(strongSide, 2);
      const r3s = rec(strongSide, 3);

      // ── a. Strong Corner — press man #1 ────────────────────────────
      if (role === 'CB' && isStrong) {
        return r1s ? manCover(r1s.id) : null;
      }

      // ── b. Apex — #3 out → man #3; #2 under → curl; push call ─────
      if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
        // Push call: RB released strong + #2 under
        if (!persistentCovCalls.stubbie_push && rb && lr(rb)?.moveType !== 'stopped') {
          const rbVx = lr(rb)?.vel?.x ?? 0;
          const rbGoingStrong = strongSide === 'L' ? rbVx < 0 : rbVx > 0;
          if (rbGoingStrong && r2s && isUnder(r2s)) {
            persistentCovCalls.stubbie_push = true;
            return manCover(rb.id);
          }
        }
        if (persistentCovCalls.stubbie_push) return rb ? manCover(rb.id) : zoneDrop(curlS);
        if (r3s && isOut(r3s)) return manCover(r3s.id);
        if (r2s && isUnder(r2s)) return zoneDrop(curlS);
        return r2s ? manCover(r2s.id) : zoneDrop(curlS);
      }

      // ── c. Hook — under crosser (deeper one); #3 out → man #2 ─────
      if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
        const u2 = r2s && isUnder(r2s);
        const u3 = r3s && isUnder(r3s);
        if (u2 && u3) {
          // Both under — take the one further from LOS (deeper depthYards)
          const d2 = lr(r2s)?.depthYards ?? 0;
          const d3 = lr(r3s)?.depthYards ?? 0;
          return manCover(d2 >= d3 ? r2s.id : r3s.id);
        }
        if (u2) return manCover(r2s.id);
        if (u3) return manCover(r3s.id);
        if (r3s && isOut(r3s)) return r2s ? manCover(r2s.id) : zoneDrop(hookS);
        return r3s ? manCover(r3s.id) : zoneDrop(hookS);
      }

      // ── d. SS — #3 vert → man; #2 vert → OTT; neither → zone hook ──
      if (role === 'SAF_S') {
        if (r3s && isVertical(r3s)) return manCover(r3s.id);
        if (r2s && isVertical(r2s)) return ottDec(r2s.id);
        return zoneDrop(hookS);
      }

      return null;
    },
  },
}; // end _PR_SIDE2
