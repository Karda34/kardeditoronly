// ── PRESET REGISTRY PART A: Base Coverages ──────────────────────────
// Cover 1, Cover 2, Cover 3 Zone variants, Fire Zone, Silver, 0-Blitz, Muffin
// Merged into PRESET_REGISTRY in 07d_presets_fullfield.js

const _PR_BASE = {

  // ── Cover 1 Man Free ──────────────────────────────────────────────
  cover1: {
    fullField: true,
    isOneHigh: true,
    decide(roles, byId, snapshot) {
      const result    = new Map();
      const ballX     = snapshot ? snapshot.ballX : ball.x;
      const eligible  = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const rb        = snapshot ? snapshot.primaryBackfield : null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;

      function recOn(side, n) {
        return eligible.find(p => p._side === side && p._receiverNumber === n) || null;
      }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'HOOK-L' || role === 'APEX-L') ? 'L'
                       : (role === 'HOOK-R' || role === 'APEX-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;
          case 'SAF_W':   result.set(id, zoneDrop('DEEP_FREE')); break;

          // CB: man #1 on their side
          case 'CB': {
            const r1 = recOn(dSide, 1);
            result.set(id, r1 ? manCover(r1.id) : rushDec());
            break;
          }

          // APEX: man #2 on role side (both formations)
          case 'APEX-L':
          case 'APEX-R': {
            if (isTrips && isWeak) {
              // weak APEX in 3x1: placeholder — react() assigns based on RB release direction
              result.set(id, zoneDrop('HOOK_MIDDLE'));
            } else {
              const r2 = recOn(roleSide, 2);
              result.set(id, r2 ? manCover(r2.id) : zoneDrop('HOOK_MIDDLE'));
            }
            break;
          }

          // HOOK:
          // 2x2: strong/weak both → release check on RB (react handles), else rush
          // 3x1: strong → man #3; weak → placeholder, react() assigns based on RB release direction
          case 'HOOK-L':
          case 'HOOK-R': {
            if (isTrips && isStrong) {
              const r3 = recOn(strongSide, 3);
              result.set(id, r3 ? manCover(r3.id) : zoneDrop('HOOK_MIDDLE'));
            } else if (isTrips && isWeak) {
              // placeholder — react() decides
              result.set(id, zoneDrop('HOOK_MIDDLE'));
            } else {
              // 2x2: release check on RB, react() handles
              result.set(id, rb ? manCover(rb.id) : rushDec());
            }
            break;
          }

          case 'HOOK-M': result.set(id, zoneDrop('HOOK_MIDDLE')); break;
          default: result.set(id, rushDec()); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      const eligible   = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const rb         = snapshot ? snapshot.primaryBackfield : null;
      const ballX      = snapshot ? snapshot.ballX : ball.x;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'HOOK-L' || role === 'APEX-L') ? 'L'
                       : (role === 'HOOK-R' || role === 'APEX-R') ? 'R'
                       : dSide;
      const isWeak     = roleSide === weakSide;

      // Roles that do the RB read
      const isRBReader = (!isTrips && (role === 'HOOK-L' || role === 'HOOK-R')) ||
                         (isTrips && isWeak && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'APEX-L' || role === 'APEX-R'));

      // ── Freeze RB-read decision after 0.1s ───────────────────────
      if (isRBReader) {
        if (d._covCall && playPhaseTime > 0.5) return d._covCall;
      }

      // ── Helper: compute and freeze RB-read decision ──────────────
      function computeAndFreeze(fn) {
        const result = fn();
        if (result !== null && isRBReader) d._covCall = result;
        return result;
      }

      // ── RB release helpers ────────────────────────────────────────
      // rbMoveDir: absolute direction — 'R', 'L', 'vertical', or null (no release / blocking)
      function rbMoveDir() {
        if (!rb) return null;
        const lr = lrState[rb.id];
        if (!lr || lr.moveType === 'stopped') return null;
        if (lr.moveType === 'vertical') return 'vertical';
        // For all routes (including under/backwards): read vel.x direction
        if (!lr.vel) return null;
        if (Math.abs(lr.vel.x) < 2) return null; // truly no lateral component
        return lr.vel.x > 0 ? 'R' : 'L';
      }

      // closer: which of two defenders (by id) is physically closer to the RB
      function closerToRB(idA, idB) {
        if (!rb) return idA;
        const rbX = rb.simX ?? rb.x;
        const rbY = rb.simY ?? rb.y;
        const dA  = snapshot ? defensePlayers.find(x => x.id === idA) : null;
        const dB  = snapshot ? defensePlayers.find(x => x.id === idB) : null;
        if (!dA) return idB;
        if (!dB) return idA;
        const distA = Math.hypot((dA.simX ?? dA.x) - rbX, (dA.simY ?? dA.y) - rbY);
        const distB = Math.hypot((dB.simX ?? dB.x) - rbX, (dB.simY ?? dB.y) - rbY);
        return distA <= distB ? idA : idB;
      }

      // ── 2x2: HOOK-L / HOOK-R ─────────────────────────────────────
      if (!isTrips && (role === 'HOOK-L' || role === 'HOOK-R')) {
        return computeAndFreeze(() => {
          if (!rb) return role === 'HOOK-R' ? rushDec() : zoneDrop('HOOK_MIDDLE');
          const dir = rbMoveDir();

          if (dir === null) {
            return role === 'HOOK-R' ? rushDec() : zoneDrop('HOOK_MIDDLE');
          }

          if (dir === 'vertical') {
            const partnerRole = role === 'HOOK-L' ? 'HOOK-R' : 'HOOK-L';
            const partnerDef = defensePlayers.find(x =>
              x.id !== d.id && x.decision?._structRole === partnerRole
            );
            const partnerId = partnerDef ? partnerDef.id : null;
            const closerId  = partnerId ? closerToRB(d.id, partnerId) : d.id;
            return closerId === d.id ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE');
          }

          if (role === 'HOOK-R' && dir === 'R') return manCover(rb.id);
          if (role === 'HOOK-L' && dir === 'L') return manCover(rb.id);
          return zoneDrop('HOOK_MIDDLE');
        });
      }

      // ── 3x1: weak HOOK + weak APEX ───────────────────────────────
      if (isTrips && isWeak && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'APEX-L' || role === 'APEX-R')) {
        const isHook = role === 'HOOK-L' || role === 'HOOK-R';
        const isApex = role === 'APEX-L' || role === 'APEX-R';
        return computeAndFreeze(() => {
          if (!rb) return isHook ? rushDec() : zoneDrop('HOOK_MIDDLE');
          const dir = rbMoveDir();

          if (dir === null) {
            return isHook ? rushDec() : zoneDrop('HOOK_MIDDLE');
          }

          if (dir === 'vertical') {
            const partnerRole = isHook ? (weakSide === 'L' ? 'APEX-L' : 'APEX-R')
                                       : (weakSide === 'L' ? 'HOOK-L' : 'HOOK-R');
            const partnerDef = defensePlayers.find(x =>
              x.id !== d.id && x.decision?._structRole === partnerRole
            );
            const partnerId = partnerDef ? partnerDef.id : null;
            const closerId  = partnerId ? closerToRB(d.id, partnerId) : d.id;
            return closerId === d.id ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE');
          }

          const releasedToStrong = (strongSide === 'R' && dir === 'R') ||
                                   (strongSide === 'L' && dir === 'L');
          if (releasedToStrong) {
            return isHook ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE');
          } else {
            return isApex ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE');
          }
        });
      }

      return null;
    },
  },

  // ── Cover 2 Man ───────────────────────────────────────────────────
  cover2man: {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result   = new Map();
      const ballX    = snapshot ? snapshot.ballX : ball.x;
      const eligible = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const rb       = snapshot ? snapshot.primaryBackfield : null;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;

      function recOn(side, n) {
        return eligible.find(p => p._side === side && p._receiverNumber === n) || null;
      }

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
          case 'RUSH': result.set(id, rushDec()); break;

          // Safeties: deep half by role — SS covers strong side, FS covers weak side
          case 'SAF_W':
          case 'SAF_S': {
            const safetySide = role === 'SAF_S' ? strongSide : weakSide;
            result.set(id, zoneDrop(safetySide === 'L' ? 'DEEP_HALF_L' : 'DEEP_HALF_R'));
            break;
          }

          // CB: always man #1 on their side
          case 'CB': {
            const r1 = recOn(dSide, 1);
            result.set(id, r1 ? manCover(r1.id) : rushDec());
            break;
          }

          // APEX:
          // 2x2 → man #2 on role side
          // 3x1 → strong APEX man #2; weak APEX release check on RB, else HOOK_MIDDLE
          case 'APEX-L':
          case 'APEX-R': {
            if (isTrips && isWeak) {
              // weak APEX in 3x1: release check handled in react()
              result.set(id, rb ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE'));
            } else {
              const r2 = recOn(roleSide, 2);
              result.set(id, r2 ? manCover(r2.id) : zoneDrop('HOOK_MIDDLE'));
            }
            break;
          }

          // HOOK-M:
          // 2x2 → release check on RB, else HOOK_MIDDLE (react() handles)
          // 3x1 → man #3 always
          case 'HOOK-M': {
            if (isTrips) {
              const r3 = recOn(strongSide, 3);
              result.set(id, r3 ? manCover(r3.id) : zoneDrop('HOOK_MIDDLE'));
            } else {
              result.set(id, rb ? manCover(rb.id) : zoneDrop('HOOK_MIDDLE'));
            }
            break;
          }

          default: result.set(id, rushDec()); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      const eligible = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const rb       = snapshot ? snapshot.primaryBackfield : null;
      const ballX    = snapshot ? snapshot.ballX : ball.x;
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L') ? 'L' : (role === 'APEX-R') ? 'R' : dSide;
      const isWeak     = roleSide === weakSide;

      // 2x2 HOOK-M: release check
      if (role === 'HOOK-M' && !isTrips) {
        if (!rb) return zoneDrop('HOOK_MIDDLE');
        const lr = lrState[rb.id];
        if (!lr || lr.moveType === 'stopped' || lr.moveType === 'backwards')
          return zoneDrop('HOOK_MIDDLE');
        return manCover(rb.id);
      }

      // 3x1 weak APEX: release check
      if ((role === 'APEX-L' || role === 'APEX-R') && isTrips && isWeak) {
        if (!rb) return zoneDrop('HOOK_MIDDLE');
        const lr = lrState[rb.id];
        if (!lr || lr.moveType === 'stopped' || lr.moveType === 'backwards')
          return zoneDrop('HOOK_MIDDLE');
        return manCover(rb.id);
      }

      return null;
    },
  },

  // ── Cover 2 Zone ──────────────────────────────────────────────────
  cover2zone: {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result = new Map();
      const ballX  = snapshot ? snapshot.ballX : ball.x;
      const safetyIds = [];
      roles.forEach((role, id) => {
        const d = byId.get(id);
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'FLAT_L' : 'FLAT_R')); break;
          case 'APEX-L': result.set(id, zoneDrop('CURL_L')); break;
          case 'APEX-R': result.set(id, zoneDrop('CURL_R')); break;
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_MIDDLE')); break;
          case 'UNDER':  result.set(id, rushDec()); break;
          case 'SAF_W': case 'SAF_S': safetyIds.push(id); break;
        }
      });
      // Sort by current sim position (simX if available, else snap x)
      safetyIds.sort((a, b) => (byId.get(a).simX ?? byId.get(a).x) - (byId.get(b).simX ?? byId.get(b).x));
      if (safetyIds[0]) result.set(safetyIds[0], zoneDrop('DEEP_HALF_L'));
      if (safetyIds[1]) result.set(safetyIds[1], zoneDrop('DEEP_HALF_R'));
      return result;
    },
    react() { return null; },
  },

  // ── Cover 3 Zone ──────────────────────────────────────────────────
  cover3zone: {
    fullField: true,
    isOneHigh: true,
    decide(roles, byId, snapshot) {
      const result = new Map();
      const ballX  = snapshot ? snapshot.ballX : ball.x;
      roles.forEach((role, id) => {
        const d = byId.get(id);
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'DEEP_L' : 'DEEP_R')); break;
          case 'SAF_W':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'SAF_S':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_MIDDLE')); break;
          case 'APEX-L': result.set(id, zoneDrop('CURL_FLAT_L')); break;
          case 'APEX-R': result.set(id, zoneDrop('CURL_FLAT_R')); break;
          case 'HOOK-L': result.set(id, zoneDrop('HOOK_L')); break;
          case 'HOOK-R': result.set(id, zoneDrop('HOOK_R')); break;
          case 'UNDER':  result.set(id, rushDec()); break;
        }
      });
      return result;
    },
    react() { return null; },
  },

  // ── Cover 3 Sky (Zone) ───────────────────────────────────────────
  // Schablone: Cover 3 Buzz
  // SS ↔ APEX-Strong tauschen Jobs
  // ── Cover 3 Sky (Zone) ───────────────────────────────────────────
  // isOneHigh: false — SS + FS beide aktiv
  // SS → Curl Flat Strong | FS → Deep Middle
  // Apex Strong → Hook Curl Strong | Apex Weak → Curl Flat Weak
  // MIKE → Hook Curl Weak
  'cover3-sky-zone': {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result    = new Map();
      const ballX     = snapshot ? snapshot.ballX : ball.x;
      const eligible  = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const apexStrongRole = strongSide === 'L' ? 'APEX-L' : 'APEX-R';
      const curlFlatS  = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW  = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookCurlS  = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hookCurlW  = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'DEEP_L' : 'DEEP_R')); break;
          case 'SAF_S':     result.set(id, zoneDrop(curlFlatS)); break;
          case 'SAF_W':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'HOOK-M': result.set(id, zoneDrop(hookCurlW)); break;
          case 'APEX-L':
          case 'APEX-R':
            result.set(id, role === apexStrongRole
              ? zoneDrop(hookCurlS)
              : zoneDrop(curlFlatW));
            break;
          default: result.set(id, rushDec()); break;
        }
      });
      return result;
    },
    react() { return null; },
  },

  // ── Cover 3 Weak (Zone) ──────────────────────────────────────────
  // isOneHigh: false — SS + FS beide aktiv
  // SS → Deep Middle | FS → Curl Flat Weak
  // Apex Strong → Curl Flat Strong | Apex Weak → Hook Weak
  // MIKE → Hook Curl R
  'cover3-weak-zone': {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result    = new Map();
      const ballX     = snapshot ? snapshot.ballX : ball.x;
      const eligible  = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const apexStrongRole = strongSide === 'L' ? 'APEX-L' : 'APEX-R';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookW     = weakSide   === 'L' ? 'HOOK_L'      : 'HOOK_R';

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'DEEP_L' : 'DEEP_R')); break;
          case 'SAF_S':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'SAF_W':     result.set(id, zoneDrop(curlFlatW)); break;
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_CURL_R')); break;
          case 'APEX-L':
          case 'APEX-R':
            result.set(id, role === apexStrongRole
              ? zoneDrop(curlFlatS)
              : zoneDrop(hookW));
            break;
          default: result.set(id, rushDec()); break;
        }
      });
      return result;
    },
    react() { return null; },
  },

  // ── Cover 3 Robber (Zone) ────────────────────────────────────────
  // isOneHigh: false — SS + FS beide aktiv
  // SS → Deep Middle | FS → Hook Curl L
  // Apex Strong → Curl Flat Strong | Apex Weak → Curl Flat Weak
  // MIKE/Hook-M → Hook Curl R
  'cover3-robber-zone': {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result    = new Map();
      const ballX     = snapshot ? snapshot.ballX : ball.x;
      const eligible  = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const curlFlatS = strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'DEEP_L' : 'DEEP_R')); break;
          case 'SAF_S':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'SAF_W':     result.set(id, zoneDrop('HOOK_CURL_L')); break;
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_CURL_R')); break;
          case 'APEX-L': result.set(id, zoneDrop('CURL_FLAT_L')); break;
          case 'APEX-R': result.set(id, zoneDrop('CURL_FLAT_R')); break;
          default: result.set(id, rushDec()); break;
        }
      });
      return result;
    },
    react() { return null; },
  },

  // ── Cover 4 Quarters ─────────────────────────────────────────────
  cover4: {
    fullField: true,
    isOneHigh: false,
    decide(roles, byId, snapshot) {
      const result = new Map();
      const ballX  = snapshot ? snapshot.ballX : ball.x;
      const safetyIds = [];
      roles.forEach((role, id) => {
        const d = byId.get(id);
        switch (role) {
          case 'RUSH':   result.set(id, rushDec()); break;
          case 'CB':     result.set(id, zoneDrop(d.x <= ballX ? 'DEEP_QRTR_L' : 'DEEP_QRTR_R')); break;
          case 'APEX-L': result.set(id, zoneDrop('CURL_FLAT_L')); break;
          case 'APEX-R': result.set(id, zoneDrop('CURL_FLAT_R')); break;
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_MIDDLE')); break;
          case 'UNDER':  result.set(id, rushDec()); break;
          case 'SAF_W': case 'SAF_S': safetyIds.push(id); break;
        }
      });
      // Best-fit safeties to mid-quarter zones
      const midZones = ['DEEP_QRTR_ML', 'DEEP_QRTR_MR'];
      const zp = midZones.map(z => getLandmarkPos(z));
      if (safetyIds.length === 1) {
        const d = byId.get(safetyIds[0]);
        const best = midZones.reduce((a, z, i) =>
          Math.hypot(d.x - zp[i].x, d.y - zp[i].y) < Math.hypot(d.x - zp[midZones.indexOf(a)].x, d.y - zp[midZones.indexOf(a)].y) ? z : a,
          midZones[0]);
        result.set(safetyIds[0], zoneDrop(best));
      } else if (safetyIds.length >= 2) {
        const c0 = (i, zi) => { const d = byId.get(safetyIds[i]); return Math.hypot(d.x - zp[zi].x, d.y - zp[zi].y); };
        const [a0, a1] = c0(0,0)+c0(1,1) <= c0(0,1)+c0(1,0) ? [0,1] : [1,0];
        result.set(safetyIds[0], zoneDrop(midZones[a0]));
        result.set(safetyIds[1], zoneDrop(midZones[a1]));
      }
      return result;
    },
    react(d, role, snapshot, lrState) {
      // Cover 4 match: if #1 runs vertical, CB carries; safety matches #2
      if (role !== 'CB' && role !== 'SAF_W' && role !== 'SAF_S') return null;
      if (!snapshot) return null;
      const ballX = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      // SS/FS: use role-based side (SS → strong, FS → weak), CB: physical side
      let side;
      if (role === 'SAF_S' || role === 'SAF_W') {
        const leftCount  = eligible.filter(p => p._side === 'L').length;
        const rightCount = eligible.filter(p => p._side === 'R').length;
        const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
        const weakSide   = strongSide === 'L' ? 'R' : 'L';
        side = role === 'SAF_S' ? strongSide : weakSide;
      } else {
        side = d.x <= ballX ? 'L' : 'R';
      }
      const rec1 = eligible.find(p => p._side === side && p._receiverNumber === 1);
      const rec2 = eligible.find(p => p._side === side && p._receiverNumber === 2);
      if (role === 'CB' && rec1) {
        const rt = classifyRoute(rec1.id, lrState);
        if (rt === 'vertical' || rt === 'corner' || rt === 'post') {
          return manCover(rec1.id, YARD_PX * 0.5);
        }
      }
      if ((role === 'SAF_W' || role === 'SAF_S') && rec2) {
        const rt = classifyRoute(rec2.id, lrState);
        const ts = threatScore(d, rec2, rt, lrState, snapshot);
        if (ts >= THREAT_MATCH_THRESHOLD) return manCover(rec2.id);
      }
      return null;
    },
  },

  // ── Fire Zone (one-high blitz) ────────────────────────────────────
  firezone: {
    fullField: true,
    isOneHigh: true,

    // Alignment applied to defenders when this preset is selected or formation is reset.
    // Keyed by coverage role. Only CB is relevant here — others left at formation default.
    alignment: {
      CB: { cbSpacing: 'off', cbShade: 'inside' },
    },

    decide(roles, byId, snapshot) {
      const result = new Map();
      const ballX  = snapshot ? snapshot.ballX : ball.x;
      const losY   = snapshot ? (snapshot.losY ?? LOS_Y()) : LOS_Y();
      const eligible = snapshot ? (snapshot.eligiblePlayers || []) : [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';

      // Track whether we've already assigned the one weak-side hook rusher
      let weakHookRusherAssigned = false;

      roles.forEach((role, id) => {
        const d = byId.get(id);
        const dSide = d.x <= ballX ? 'L' : 'R';

        switch (role) {
          case 'RUSH':
            // Only real DL (DE/DT) stay as rushers.
            // LBs that fell through to RUSH in classifyAllRoles get a hook zone instead.
            if (RUSH_ELIGIBLE_ROLES.has(d.role.toUpperCase())) {
              result.set(id, rushDec());
            } else {
              result.set(id, zoneDrop('HOOK_MIDDLE'));
            }
            break;
          case 'CB':     result.set(id, manCover(-1)); break; // placeholder; react() takes over
          case 'SAF_W':     result.set(id, zoneDrop('DEEP_MIDDLE')); break;
          case 'APEX-L':
          case 'APEX-R': {
            const rec2 = (snapshot ? (snapshot.eligiblePlayers || []) : [])
              .find(p => p._side === dSide && p._receiverNumber === 2);
            result.set(id, rec2 ? manCover(rec2.id) : zoneDrop(dSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R'));
            break;
          }
          case 'HOOK-L':
          case 'HOOK-R': {
            // Exactly one Hook rushes: the weak-side Hook (by role, not physical position).
            const roleSide = role === 'HOOK-L' ? 'L' : 'R';
            const isWeakSide = roleSide === weakSide;
            if (isWeakSide && !weakHookRusherAssigned) {
              result.set(id, rushDec());
              weakHookRusherAssigned = true;
            } else {
              result.set(id, zoneDrop(roleSide === 'L' ? 'HOOK_L' : 'HOOK_R'));
            }
            break;
          }
          case 'HOOK-M': result.set(id, zoneDrop('HOOK_MIDDLE')); break;
          case 'UNDER':  result.set(id, rushDec()); break;
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (role === 'RUSH' || role === 'UNDER' || role === 'SAF_W') return null;
      if (!snapshot) return null;

      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const backfield = snapshot.backfieldPlayers || [];
      const formation = getFormationRead(snapshot);
      const isTrips   = formation.formation === '3x1' || formation.formation === 'empty';

      // Determine which side this defender is on (physical)
      const side = d.x <= ballX ? 'L' : 'R';
      // For Hook roles, use role-based side (not physical) to avoid mismatches
      const roleSide = (role === 'HOOK-L' || role === 'APEX-L') ? 'L'
                     : (role === 'HOOK-R' || role === 'APEX-R') ? 'R'
                     : side;
      // Strong side = side with more receivers
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // Weak-side Hook is a rusher — never reacts to coverage
      if ((role === 'HOOK-L' || role === 'HOOK-R') && isWeak) return null;

      // Receiver helpers
      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }
      function lr(p) { return p ? lrState[p.id] : null; }

      // Route type helpers — global functions with local lrState binding
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isStopped(p)  { return isStoppedRoute(p, lrState); }
      function isVertical(p) { return isVerticalRoute(p, lrState); }
      function isHitch(p)    { return isHitchRoute(p, lrState); }
      function isOut(p)      { return isOutRoute(p, lrState); }
      function canReach(defender, receiver) { return canReachRoute(defender, receiver, lrState); }

      // ── Inter-defender calls — stored on snapshot per-play ────────────
      // We use snapshot as a shared scratchpad for calls (safe: snapshot is stable per tick)
      if (!snapshot._fzCalls) snapshot._fzCalls = {};
      const calls = snapshot._fzCalls;

      // ─────────────────────────────────────────────────────────────────
      // 2x2 / 1x1 rules (Sections 13)
      // ─────────────────────────────────────────────────────────────────
      if (!isTrips) {

        // ── CB (Corner) ───────────────────────────────────────────────
        if (role === 'CB') {
          const r1 = rec(side, 1);
          if (!r1) return zoneDrop(side === 'L' ? 'DEEP_L' : 'DEEP_R');

          if (isUnder(r1)) {
            calls[`under_corner_${side}`] = true;
            calls[`smash_corner_${side}`] = false;
            return zoneDrop(side === 'L' ? 'DEEP_L' : 'DEEP_R');
          }
          if (isHitch(r1)) {
            calls[`smash_corner_${side}`] = true;
            calls[`under_corner_${side}`] = false;
            return zoneDrop(side === 'L' ? 'DEEP_L' : 'DEEP_R');
          }
          // Base: man on #1 — clear all calls
          calls[`under_corner_${side}`] = false;
          calls[`smash_corner_${side}`] = false;
          return manCover(r1.id, YARD_PX * 0.5);
        }

        // ── APEX (Slot / Inside LB) ───────────────────────────────────
        if (role === 'APEX-L' || role === 'APEX-R') {
          const r2 = rec(roleSide, 2);
          const r3 = rec(roleSide, 3);
          const smashCall = calls[`smash_corner_${roleSide}`];
          const curlFlatActive = calls[`under_apex_${roleSide}`];

          // 1. #2 under → Curl-Flat
          if (r2 && isUnder(r2)) {
            calls[`under_apex_${roleSide}`] = true;
            // 4. Curl-Flat active AND #3 on route → man #3 (RB in 2x2)
            if (r3 && !isStopped(r3)) return manCover(r3.id, YARD_PX);
            return zoneDrop(roleSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
          } else {
            calls[`under_apex_${roleSide}`] = false;
          }

          // 2. smash_corner call → Curl-Flat
          if (smashCall) {
            // 4. Curl-Flat active AND #3 on route → man #3
            if (r3 && !isStopped(r3)) return manCover(r3.id, YARD_PX);
            return zoneDrop(roleSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
          }

          // 3. Base → man #2
          if (r2) return manCover(r2.id, YARD_PX);
          return zoneDrop(roleSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
        }

        // ── HOOK (Middle LB) ─────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // Apex owns #3 in man — Hook always plays HOOK_MIDDLE zone
          return zoneDrop('HOOK_MIDDLE');
        }

      // ─────────────────────────────────────────────────────────────────
      // 3x1 Trips rules (Section 14)
      // ─────────────────────────────────────────────────────────────────
      } else {

        // ── CB Strong ─────────────────────────────────────────────────
        if (role === 'CB' && isStrong) {
          const r1 = rec(strongSide, 1);
          if (!r1) return zoneDrop(strongSide === 'L' ? 'DEEP_L' : 'DEEP_R');
          if (isUnder(r1)) {
            calls[`under_corner_${strongSide}`] = true;
            calls[`smash_corner_${strongSide}`] = false;
            return zoneDrop(strongSide === 'L' ? 'DEEP_L' : 'DEEP_R');
          }
          if (isHitch(r1)) {
            calls[`smash_corner_${strongSide}`] = true;
            calls[`under_corner_${strongSide}`] = false;
            return zoneDrop(strongSide === 'L' ? 'DEEP_L' : 'DEEP_R');
          }
          calls[`under_corner_${strongSide}`] = false;
          calls[`smash_corner_${strongSide}`] = false;
          return manCover(r1.id, YARD_PX * 0.5);
        }

        // ── CB Weak ───────────────────────────────────────────────────
        if (role === 'CB' && isWeak) {
          const r1w = rec(weakSide, 1);
          if (r1w) return manCover(r1w.id, YARD_PX * 0.5);
          return zoneDrop(weakSide === 'L' ? 'DEEP_L' : 'DEEP_R');
        }

        // ── APEX Strong ───────────────────────────────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          const r2s = rec(strongSide, 2);
          const r3s = rec(strongSide, 3);
          const smashCall = calls[`smash_corner_${strongSide}`];

          if (r3s && isOut(r3s)) return manCover(r3s.id, YARD_PX * 0.5); // take #3, top-down
          if (smashCall) {
            const r1s = rec(strongSide, 1);
            if (r1s) return manCover(r1s.id, YARD_PX); // rob hitch from #1
            return zoneDrop(strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
          }
          if (r2s && isUnder(r2s)) {
            calls[`under_apex_${strongSide}`] = true;
            return zoneDrop(strongSide === 'L' ? 'FLAT_L' : 'FLAT_R'); // buzz to flat
          }
          if (r2s) return manCover(r2s.id, YARD_PX);
          return zoneDrop(strongSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
        }

        // ── APEX Weak (doubles as 2-man side apex) ────────────────────
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          const rb = snapshot.primaryBackfield || null;
          const r1s = rec(strongSide, 1); // shallow crossers from strong
          if (rb && isUnder(rb)) return manCover(rb.id, YARD_PX);
          if (rb && (isVertical(rb) || isOut(rb) || isHitch(rb))) return manCover(rb.id, YARD_PX);
          // RB blocking: take shallow crossers from strong, else rob weak #1
          if (r1s && isUnder(r1s)) return manCover(r1s.id, YARD_PX);
          const r1w = rec(weakSide, 1);
          if (r1w) return manCover(r1w.id, YARD_PX * 1.5); // rob underneath
          return zoneDrop(weakSide === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R');
        }

        // ── HOOK ─────────────────────────────────────────────────────
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          const r3s = rec(strongSide, 3);
          const r2s = rec(strongSide, 2);
          const r1w = rec(weakSide,   1); // shallow cross from weak

          if (r3s && isOut(r3s)) {
            // #3 fast out — take #2 man, vertical depth
            if (r2s) return manCover(r2s.id, YARD_PX * 0.5);
          }
          if (r3s && isUnder(r3s)) {
            // #3 shallow under (flat/angle) — curl hook, pick up shallow cross from weak
            // Slants (inside with real depth) do NOT trigger this — hook stays on #3
            if (r1w && isUnder(r1w)) return manCover(r1w.id, YARD_PX);
            return zoneDrop('HOOK_MIDDLE');
          }
          if (r3s && isVertical(r3s)) return manCover(r3s.id, YARD_PX * 0.5);
          // Base: man on #3
          if (r3s) return manCover(r3s.id, YARD_PX);
          return zoneDrop('HOOK_MIDDLE');
        }
      }

      return null;
    },
  },

  // ── TE Double ─────────────────────────────────────────────────────────
  tedouble: {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }

      // Bracket leverage: relative to the other defender covering the same receiver.
      // If the other defender is inside (closer to ball center) → this one is outside, and vice versa.
      // otherDefender: the byId defender object of the paired man-cover defender.
      // receiver: the player being bracketed.
      
      // First pass: collect man assignments so bracket can reference them
      // We need to know which defender covers which receiver before setting leverage.
      // Strategy: build role→defender map, then assign.
      const roleToId = new Map();
      roles.forEach((role, id) => roleToId.set(role, id));

      // Helper: find defender with a specific role
      function defWithRole(role) {
        const id = roleToId.get(role);
        return id !== undefined ? byId.get(id) : null;
      }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide  = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : (role === 'SAF_S') ? strongSide : (role === 'SAF_W') ? weakSide
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH': result.set(id, rushDec()); break;

          case 'CB': {
            const side = roleSide;
            const r1 = rec(side, 1);
            result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : rushDec());
            break;
          }

          case 'APEX-L':
          case 'APEX-R': {
            const r2 = rec(roleSide, 2);
            const target = isWeak && isTrips ? rb : r2;
            result.set(id, target ? manCover(target.id, YARD_PX) : rushDec());
            break;
          }

          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M': {
            // Hook: man #3 strong (RB in 2x2, #3 in 3x1)
            const r3s = rec(strongSide, 3);
            const hookTarget = isTrips ? r3s : rb;
            result.set(id, hookTarget ? manCover(hookTarget.id, YARD_PX) : rushDec());
            break;
          }

          case 'SAF_S':
          case 'SAF_W': {
            if (isTrips) {
              if (isStrong) {
                // Bracket #3 strong — paired with Hook
                const r3s = rec(strongSide, 3);
                result.set(id, r3s ? bracketDec(r3s.id) : rushDec());
              } else {
                // Bracket #1 weak — paired with weak CB
                const r1w = rec(weakSide, 1);
                result.set(id, r1w ? bracketDec(r1w.id) : rushDec());
              }
            } else {
              // 2x2: bracket #2 on own side — paired with APEX
              const r2 = rec(roleSide, 2);
              result.set(id, r2 ? bracketDec(r2.id) : rushDec());
            }
            break;
          }

          default: result.set(id, rushDec());
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      // All assignments are man/bracket — no zone reactions needed.
      // Coverage locks in from decide(); react() returns null to keep decisions stable.
      return null;
    },
  },

  // ── Silver — Man Rush 5 ───────────────────────────────────────────────
  silver: {
    fullField: true,
    isOneHigh: true,
    alignment: { CB: { cbSpacing: 'off', cbShade: 'normal' } },

    decide(roles, byId, snapshot) {
      const result = new Map();
      if (!snapshot) return result;
      const ballX      = snapshot.ballX;
      const eligible   = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }

      // Track which hook role is weak/strong
      let weakHookAssigned = false;

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
          case 'RUSH':
            result.set(id, rushDec());
            break;

          case 'CB':
            const r1 = rec(roleSide, 1);
            result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : rushDec());
            break;

          case 'APEX-L':
          case 'APEX-R': {
            if (isStrong) {
              // Strong Apex: always man #2 strong
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : rushDec());
            } else {
              // Weak Apex: 2x2 → man #2 weak / 3x1 → man RB (react handles no-release)
              if (isTrips) {
                result.set(id, rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              } else {
                const r2w = rec(weakSide, 2);
                result.set(id, r2w ? manCover(r2w.id, YARD_PX) : rushDec());
              }
            }
            break;
          }

          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M': {
            // Weak hook rushes, strong hook covers
            if (isWeak && !weakHookAssigned) {
              result.set(id, rushDec());
              weakHookAssigned = true;
            } else {
              // Strong Hook: 2x2 → man RB (react handles no-release) / 3x1 → man #3
              if (isTrips) {
                const r3s = rec(strongSide, 3);
                result.set(id, r3s ? manCover(r3s.id, YARD_PX) : rushDec());
              } else {
                result.set(id, rb ? manCover(rb.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
              }
            }
            break;
          }

          case 'SAF_W':
            result.set(id, zoneDrop('DEEP_FREE'));
            break;

          default:
            result.set(id, rushDec());
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      // RB readers — same roles as Cover 1
      const isRBReader = (!isTrips && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M')) ||
                         (isTrips && isWeak && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M' || role === 'APEX-L' || role === 'APEX-R'));

      // Freeze after 0.1s (same as Cover 1)
      if (isRBReader) {
        if (d._covCall && playPhaseTime > 0.5) return d._covCall;
      }

      function computeAndFreeze(fn) {
        const result = fn();
        if (result !== null && isRBReader) d._covCall = result;
        return result;
      }

      // Absolute direction from RB velocity
      function rbMoveDir() {
        if (!rb) return null;
        const lr = lrState[rb.id];
        if (!lr || lr.moveType === 'stopped') return null;
        if (lr.moveType === 'vertical') return 'vertical';
        // For all routes (including under/backwards): read vel.x direction
        if (!lr.vel) return null;
        if (Math.abs(lr.vel.x) < 2) return null; // truly no lateral component
        return lr.vel.x > 0 ? 'R' : 'L';
      }

      function closerToRB(idA, idB) {
        if (!rb) return idA;
        const rbX = rb.simX ?? rb.x, rbY = rb.simY ?? rb.y;
        const dA = defensePlayers.find(x => x.id === idA);
        const dB = defensePlayers.find(x => x.id === idB);
        if (!dA) return idB; if (!dB) return idA;
        return Math.hypot((dA.simX??dA.x)-rbX,(dA.simY??dA.y)-rbY) <=
               Math.hypot((dB.simX??dB.x)-rbX,(dB.simY??dB.y)-rbY) ? idA : idB;
      }

      // ── 2x2: Both Hooks directional RB read ──
      if (!isTrips && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M')) {
        return computeAndFreeze(() => {
          if (!rb) return rushDec();
          const dir = rbMoveDir();
          if (dir === null) return rushDec();
          if (dir === 'vertical') {
            const partnerRole = role === 'HOOK-L' ? 'HOOK-R' : 'HOOK-L';
            const partnerDef = defensePlayers.find(x => x.id !== d.id && x.decision?._structRole === partnerRole);
            const closerId = partnerDef ? closerToRB(d.id, partnerDef.id) : d.id;
            return closerId === d.id ? manCover(rb.id) : rushDec();
          }
          if (role === 'HOOK-R' && dir === 'R') return manCover(rb.id);
          if (role === 'HOOK-L' && dir === 'L') return manCover(rb.id);
          if (role === 'HOOK-M') {
            const partnerRole2 = dir === 'R' ? 'HOOK-R' : 'HOOK-L';
            const partnerDef2 = defensePlayers.find(x => x.id !== d.id && x.decision?._structRole === partnerRole2);
            const closerId2 = partnerDef2 ? closerToRB(d.id, partnerDef2.id) : d.id;
            return closerId2 === d.id ? manCover(rb.id) : rushDec();
          }
          return rushDec();
        });
      }

      // ── 3x1: Weak HOOK + Weak APEX directional RB read ──
      if (isTrips && isWeak && (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M' || role === 'APEX-L' || role === 'APEX-R')) {
        const isHook = role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M';
        const isApex = role === 'APEX-L' || role === 'APEX-R';
        return computeAndFreeze(() => {
          if (!rb) return rushDec();
          const dir = rbMoveDir();
          if (dir === null) return rushDec();
          if (dir === 'vertical') {
            const partnerRole = isHook ? (weakSide === 'L' ? 'APEX-L' : 'APEX-R')
                                       : (weakSide === 'L' ? 'HOOK-L' : 'HOOK-R');
            const partnerDef = defensePlayers.find(x => x.id !== d.id && x.decision?._structRole === partnerRole);
            const closerId = partnerDef ? closerToRB(d.id, partnerDef.id) : d.id;
            return closerId === d.id ? manCover(rb.id) : rushDec();
          }
          const releasedToStrong = (strongSide === 'R' && dir === 'R') || (strongSide === 'L' && dir === 'L');
          if (releasedToStrong) return isHook ? manCover(rb.id) : rushDec();
          return isApex ? manCover(rb.id) : rushDec();
        });
      }

      // ── Deep Safety: OTT on vertical threats, else DEEP_FREE ────────
      if (role === 'SAF_W') {
        const threats = isTrips
          ? [eligible.find(p => p._side === strongSide && p._receiverNumber === 2),
             eligible.find(p => p._side === strongSide && p._receiverNumber === 3)].filter(Boolean)
          : [eligible.find(p => p._side === strongSide && p._receiverNumber === 2),
             eligible.find(p => p._side === weakSide   && p._receiverNumber === 2)].filter(Boolean);
        const lr2 = (p) => p ? lrState[p.id] : null;
        const vertThreat = threats.find(p => { const r = lr2(p); return r && (r.isVerticalThreatNow || r.moveType === 'vertical'); });
        if (vertThreat) return ottDec(vertThreat.id);
        return zoneDrop('DEEP_FREE');
      }

      return null;
    },
  },

  // ── 0 Blitz Lock — 6 Man Rush ────────────────────────────────────────
  'zero-blitz-lock': {
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
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }

      roles.forEach((role, id) => {
        const d = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : (role === 'SAF_S') ? strongSide : (role === 'SAF_W') ? weakSide
                       : dSide;
        const isStrong = roleSide === strongSide;

        switch (role) {
          case 'RUSH':
            result.set(id, rushDec());
            break;

          case 'CB': {
            const r1 = rec(roleSide, 1);
            result.set(id, r1 ? manCover(r1.id, YARD_PX * 0.5) : rushDec());
            break;
          }

          case 'APEX-L':
          case 'APEX-R': {
            if (isStrong) {
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : rushDec());
            } else {
              if (isTrips) {
                // Weak Apex 3x1: release check on RB (react handles)
                result.set(id, rb ? manCover(rb.id, YARD_PX) : rushDec());
              } else {
                const r2w = rec(weakSide, 2);
                result.set(id, r2w ? manCover(r2w.id, YARD_PX) : rushDec());
              }
            }
            break;
          }

          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M': {
            // 0 Blitz: HOOK is always the 6th rusher
            // 2x2: APEX already covers #2 on each side
            // 3x1: no #2 weak exists
            result.set(id, rushDec());
            break;
          }

          case 'SAF_S':
          case 'SAF_W': {
            if (isTrips) {
              // 3x1: SS starts on #3 strong, FS starts rush (react sorts by release)
              const r3s = rec(strongSide, 3);
              if (role === 'SAF_S') {
                result.set(id, r3s ? manCover(r3s.id, YARD_PX) : rushDec());
              } else {
                result.set(id, rushDec()); // FS rushes until react re-assigns
              }
            } else {
              // 2x2: SS starts on RB man, FS rushes until react assigns by release
              if (role === 'SAF_S') {
                result.set(id, rb ? manCover(rb.id, YARD_PX) : rushDec());
              } else {
                result.set(id, rushDec());
              }
            }
            break;
          }

          default:
            result.set(id, rushDec());
        }
      });
      return result;
    },

    react(d, role, snapshot, lrState) {
      if (!snapshot) return null;
      const ballX    = snapshot.ballX;
      const eligible = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : (role === 'SAF_S') ? strongSide : (role === 'SAF_W') ? weakSide
                       : dSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }

      function isReleased(p) { return isReleasedRoute(p, lrState); }

      function releaseSide(p) {
        if (!p) return null;
        const r = lrState[p.id]; if (!r) return null;
        const vx = r.velX ?? r.vel?.x ?? 0;
        if (Math.abs(vx) < 5) return null; // not clearly going either way
        // Moving toward strong side sideline?
        if (strongSide === 'R' && vx > 5) return 'strong';
        if (strongSide === 'R' && vx < -5) return 'weak';
        if (strongSide === 'L' && vx < -5) return 'strong';
        if (strongSide === 'L' && vx > 5) return 'weak';
        return null;
      }

      // ── 2x2: SS/FS split on RB release direction ──────────────────────
      if ((role === 'SAF_S' || role === 'SAF_W') && !isTrips) {
        if (!rb) return rushDec();
        if (!isReleased(rb)) {
          // RB hasn't released yet — SS holds man, FS rushes
          return role === 'SAF_S' ? manCover(rb.id, YARD_PX) : rushDec();
        }
        const rel = releaseSide(rb);
        if (rel === 'strong' && role === 'SAF_S') return manCover(rb.id, YARD_PX);
        if (rel === 'strong' && role === 'SAF_W') return rushDec();
        if (rel === 'weak' && role === 'SAF_W') return manCover(rb.id, YARD_PX);
        if (rel === 'weak' && role === 'SAF_S') return rushDec();
        // Unclear direction — SS keeps man, FS rushes
        if (role === 'SAF_S') return manCover(rb.id, YARD_PX);
        return rushDec();
      }

      // ── 3x1: SS/FS split on #3 strong release ─────────────────────────
      if ((role === 'SAF_S' || role === 'SAF_W') && isTrips) {
        const r3s = rec(strongSide, 3);
        if (!r3s) return rushDec();
        if (!isReleased(r3s)) {
          // Not released — SS holds man, FS holds rush
          return role === 'SAF_S' ? manCover(r3s.id, YARD_PX) : rushDec();
        }
        const rel = releaseSide(r3s);
        if (rel === 'strong' && role === 'SAF_S') return manCover(r3s.id, YARD_PX);
        if (rel === 'strong' && role === 'SAF_W') return rushDec();
        if (rel === 'weak' && role === 'SAF_W') return manCover(r3s.id, YARD_PX);
        if (rel === 'weak' && role === 'SAF_S') return rushDec();
        // Vertical / unclear — SS stays
        if (role === 'SAF_S') return manCover(r3s.id, YARD_PX);
        return rushDec();
      }

      // ── Weak Apex (3x1): RB man if released, else rush ────────────────
      if ((role === 'APEX-L' || role === 'APEX-R') && isWeak && isTrips) {
        if (rb && isReleased(rb)) return manCover(rb.id, YARD_PX);
        return rushDec();
      }

      return null;
    },
  },

  // ── Muffin Cover 3 Cloud Strong ──────────────────────────────────────
  // Two-high shell. Strong CB plays flat zone (Cloud), all others match-man.
  // RB role: 2x2 → #3 (floater); 3x1 → weak #2.
  // RB/Hook decision uses Sky-pattern (persistentCovCalls) — frozen at 0.2s, no flag flip.
  'muffin-cover3-cloud-strong': {
    fullField: true,
    isOneHigh: false,
    alignment: { CB: { cbSpacing: 'normal', cbShade: 'inside' } },

    decide(roles, byId, snapshot) {
      const result    = new Map();
      if (!snapshot) return result;
      const ballX     = snapshot.ballX;
      const eligible  = snapshot.eligiblePlayers || [];
      const leftCount  = eligible.filter(p => p._side === 'L').length;
      const rightCount = eligible.filter(p => p._side === 'R').length;
      const strongSide = (snapshot?.coverageStrongSide) || (leftCount >= rightCount ? 'L' : 'R');
      const weakSide   = strongSide === 'L' ? 'R' : 'L';
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }
      // RB identity by formation:
      // 2x2 → rb is the floater "#3", no side assigned
      // 3x1 → rb counts as weak #2 (Apex takes him)
      const r3_2x2  = rb;                          // 2x2 only: rb as #3
      const r2w_3x1 = isTrips ? rb : null;         // 3x1 only: rb as weak #2

      roles.forEach((role, id) => {
        const d      = byId.get(id);
        if (!d) return;
        const dSide    = d.x <= ballX ? 'L' : 'R';
        const roleSide = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
        const isStrong = roleSide === strongSide;
        const isWeak   = roleSide === weakSide;

        switch (role) {
          case 'RUSH':
            result.set(id, rushDec());
            break;

          case 'CB': {
            if (isStrong) {
              // Strong CB: starts in flat zone (cloud)
              result.set(id, zoneDrop(strongSide === 'L' ? 'FLAT_L' : 'FLAT_R'));
            } else {
              // Weak CB: man #1 weak
              const r1w = rec(weakSide, 1);
              result.set(id, r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(weakSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R'));
            }
            break;
          }

          case 'APEX-L':
          case 'APEX-R': {
            if (isStrong) {
              // Strong Apex: man #2 strong
              const r2s = rec(strongSide, 2);
              result.set(id, r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R'));
            } else {
              // Weak Apex: 2x2 → man #2 weak; 3x1 → man rb (weak #2)
              if (isTrips) {
                result.set(id, r2w_3x1 ? manCover(r2w_3x1.id, YARD_PX) : zoneDrop(weakSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R'));
              } else {
                const r2w = rec(weakSide, 2);
                result.set(id, r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(weakSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R'));
              }
            }
            break;
          }

          case 'HOOK-L':
          case 'HOOK-R':
          case 'HOOK-M': {
            // 3x1 → man strong #3; 2x2 → drop HOOK_MIDDLE (rb decision in react)
            if (isTrips) {
              const r3s = rec(strongSide, 3);
              result.set(id, r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            } else {
              result.set(id, zoneDrop('HOOK_MIDDLE'));
            }
            break;
          }

          case 'SAF_S': {
            // Strong Safety: deep third strong
            result.set(id, zoneDrop(strongSide === 'L' ? 'DEEP_THIRD_L' : 'DEEP_THIRD_R'));
            break;
          }

          case 'SAF_W': {
            result.set(id, zoneDrop('DEEP_MIDDLE'));
            break;
          }

          default:
            result.set(id, rushDec());
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
      const isTrips    = leftCount >= 3 || rightCount >= 3;
      const rb         = snapshot.primaryBackfield || null;
      const dSide      = d.x <= ballX ? 'L' : 'R';
      const roleSide   = (role === 'APEX-L' || role === 'HOOK-L') ? 'L'
                       : (role === 'APEX-R' || role === 'HOOK-R') ? 'R'
                       : dSide;
      const isStrong   = roleSide === strongSide;
      const isWeak     = roleSide === weakSide;

      function rec(s, n) {
        return eligible.find(p => p._side === s && p._receiverNumber === n) || null;
      }
      function lr(p)         { return p ? lrState[p.id] : null; }
      function isFlat(p)     { return isFlatRoute(p, null, lrState, snapshot); }
      function isUnder(p)    { return isUnderRoute(p, lrState); }
      function isHitch(p)    { return isHitchRoute(p, lrState); }
      function isVertical(p) { return isVerticalRoute(p, lrState); }

      // ── Inline zone membership helpers (no ZONE_HALF/isInZoneBounds needed) ──
      const losY = LOS_Y ? LOS_Y() : (snapshot.losY ?? 0);
      // Deep Third: 10+ yards upfield of LOS, within half-width of landmark
      function inDeepZone(zoneId, p) {
        const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
        if (ry > losY - 10 * YARD_PX) return false;
        const lp = getLandmarkPos(zoneId);
        const hw = zoneId === 'DEEP_MIDDLE' ? 8.65 * YARD_PX : 9 * YARD_PX;
        return Math.abs(rx - lp.x) <= hw;
      }
      // Hook Middle: within 6.67yds lateral and 8yds vertical of HOOK_MIDDLE landmark
      function inHookMiddle(p) {
        const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
        const lp = getLandmarkPos('HOOK_MIDDLE');
        return Math.abs(rx - lp.x) <= 6.67 * YARD_PX && Math.abs(ry - lp.y) <= 8 * YARD_PX;
      }
      // Curl-Flat zone: within 4.46yds lateral and 8yds vertical of landmark
      function inCurlFlat(zoneId, p) {
        const rx = p.simX ?? p.x, ry = p.simY ?? p.y;
        const lp = getLandmarkPos(zoneId);
        return Math.abs(rx - lp.x) <= 4.46 * YARD_PX && Math.abs(ry - lp.y) <= 8 * YARD_PX;
      }

      // ── RB identity (same logic as decide) ──
      // 2x2: rb is #3 (floater); 3x1: rb is weak #2
      const r3_2x2  = rb;
      const r2w_3x1 = isTrips ? rb : null;

      // Scratchpad (tick-local, for Under flags)
      if (!snapshot._muffinCalls) snapshot._muffinCalls = {};
      const calls = snapshot._muffinCalls;

      // Zone landmarks
      const flatZoneS = strongSide === 'L' ? 'FLAT_L'      : 'FLAT_R';
      const deepS     = strongSide === 'L' ? 'DEEP_THIRD_L': 'DEEP_THIRD_R';
      const deepW     = weakSide   === 'L' ? 'DEEP_THIRD_L': 'DEEP_THIRD_R';
      const hcS       = strongSide === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const hcW       = weakSide   === 'L' ? 'HOOK_CURL_L' : 'HOOK_CURL_R';
      const curlFlatW = weakSide   === 'L' ? 'CURL_FLAT_L' : 'CURL_FLAT_R';
      const hookS     = strongSide === 'L' ? 'HOOK_L'      : 'HOOK_R';

      // ─── 2x2 ──────────────────────────────────────────────────────────
      if (!isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r1w = rec(weakSide, 1);
        const r2w = rec(weakSide, 2);
        // rb = r3_2x2 (the floater #3)

        // ── Strong CB: flat zone; man if isFlat only ──
        if (role === 'CB' && isStrong) {
          if (r1s && isFlat(r1s)) return manCover(r1s.id, YARD_PX * 0.5);
          if (r2s && isFlat(r2s)) return manCover(r2s.id, YARD_PX);
          if (rb  && isFlatRoute(rb, strongSide, lrState, snapshot)) return manCover(rb.id, YARD_PX * 0.5);
          return zoneDrop(flatZoneS);
        }

        // ── Strong Apex: man #2s; if isFlat(#2s) → drop to HOOK_S ──
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          if (r2s && isFlat(r2s)) return zoneDrop(hcS);
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hcS);
        }

        // ── Strong Safety: man #1s if vertical, else deep third strong ──
        if (role === 'SAF_S') {
          if (r1s && isVertical(r1s)) return manCover(r1s.id, YARD_PX * 1.5);
          if (r1s && inDeepZone(deepS, r1s)) return manCover(r1s.id, YARD_PX);
          return zoneDrop(deepS);
        }
        //   RB decision (Sky-pattern): if rb releases weak → frozen distanced read ──
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          // Under → man crosser (highest priority when present)
          const hasUnder = (r1w && isUnder(r1w)) || (r2w && isUnder(r2w))
                        || calls.muffinUnderCornerWeak || calls.muffinUnderApexWeak;
          if (hasUnder) {
            const crosser = [r1s, r1w, r2s, r2w].find(p => p && isUnder(p));
            if (crosser) return manCover(crosser.id, YARD_PX);
          }

          // RB decision — frozen Sky-style
          if (persistentCovCalls.muffinRbDecision !== undefined) {
            return persistentCovCalls.muffinRbDecision === 'hookR2w'
              ? (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
              : (rb  ? manCover(rb.id,  YARD_PX) : zoneDrop('HOOK_MIDDLE'));
          }
          // RB has released weak → read own distance to #2w, freeze decision
          if (rb && lr(rb)?.moveType !== 'stopped') {
            const rbLr = lr(rb);
            const rbVx = rbLr?.vel?.x ?? 0;
            const rbRelWeak = rbVx !== 0 && (weakSide === 'L' ? rbVx < 0 : rbVx > 0);
            if (rbRelWeak || isFlat(rb)) {
              const dxH = r2w ? ((r2w.simX ?? r2w.x) - (d.simX ?? d.x)) : 999;
              const dyH = r2w ? ((r2w.simY ?? r2w.y) - (d.simY ?? d.y)) : 999;
              const hookNearR2w = Math.hypot(dxH, dyH) <= 5 * YARD_PX;
              persistentCovCalls.muffinRbDecision = hookNearR2w ? 'hookR2w' : 'hookRb';
              return persistentCovCalls.muffinRbDecision === 'hookR2w'
                ? (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop('HOOK_MIDDLE'))
                : (rb  ? manCover(rb.id,  YARD_PX) : zoneDrop('HOOK_MIDDLE'));
            }
          }
          // Man receiver physically in hook zone
          const hookThreat = eligible.find(p => inHookMiddle(p));
          if (hookThreat) return manCover(hookThreat.id, YARD_PX);
          return zoneDrop('HOOK_MIDDLE');
        }

        // ── Weak Apex: man #2w; under→CURL_FLAT; smash→rob #1w; mirrors Hook RB decision ──
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          if (r2w && isUnder(r2w)) {
            calls.muffinUnderApexWeak = true;
            const curlThreat = eligible.find(p => inCurlFlat(curlFlatW, p));
            return curlThreat ? manCover(curlThreat.id, YARD_PX) : zoneDrop(curlFlatW);
          } else { calls.muffinUnderApexWeak = false; }
          // Smash: #1w runs hitch (outside + stopped, ≤7yds) → rob underneath
          const r1wLr = lr(r1w);
          const r1wIsHitch = r1wLr && r1wLr.depthYards <= 7
                          && (r1wLr.moveType === 'outside' || r1wLr.moveType === 'stopped');
          if (r1w && r1wIsHitch) return manCover(r1w.id, YARD_PX);
          // Mirror Hook RB decision (frozen)
          if (rb && lr(rb)?.moveType !== 'stopped') {
            if (persistentCovCalls.muffinRbDecision !== undefined) {
              return persistentCovCalls.muffinRbDecision === 'hookR2w'
                ? (rb  ? manCover(rb.id,  YARD_PX) : zoneDrop(curlFlatW))
                : (r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW));
            }
          }
          return r2w ? manCover(r2w.id, YARD_PX) : zoneDrop(curlFlatW);
        }

        // ── Weak CB: man #1w; under or stable hitch → drop deep third weak ──
        if (role === 'CB' && isWeak) {
          const r1wLr = lr(r1w);
          const r1wStableHitch = r1wLr && r1wLr.depthYards <= 7
                              && (r1wLr.moveType === 'outside' || r1wLr.moveType === 'stopped');
          if (r1w && isUnder(r1w)) {
            calls.muffinUnderCornerWeak = true;
            const deepThreat = eligible.find(p => inDeepZone(deepW, p));
            return deepThreat ? manCover(deepThreat.id, YARD_PX) : zoneDrop(deepW);
          }
          if (r1w && r1wStableHitch) {
            calls.muffinUnderCornerWeak = false;
            const deepThreat = eligible.find(p => inDeepZone(deepW, p));
            return deepThreat ? manCover(deepThreat.id, YARD_PX) : zoneDrop(deepW);
          }
          calls.muffinUnderCornerWeak = false;
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── FS: deep middle; man any deep middle entrant; 2 in zone → split ──
        if (role === 'SAF_W') {
          const deepMidThreats = eligible.filter(p => inDeepZone('DEEP_MIDDLE', p));
          if (deepMidThreats.length === 1) return manCover(deepMidThreats[0].id, YARD_PX);
          if (deepMidThreats.length >= 2) {
            // Split: track midpoint between the two deepest threats
            const p1 = deepMidThreats[0], p2 = deepMidThreats[1];
            const midX = ((p1.simX ?? p1.x) + (p2.simX ?? p2.x)) / 2;
            const midY = Math.min(p1.simY ?? p1.y, p2.simY ?? p2.y);
            snapshot._muffinFsSplit = { x: midX, y: midY };
            // Use OTT-style on the deeper receiver, slight inside shade
            return ottDec(deepMidThreats[0].id);
          }
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      // ─── 3x1 ──────────────────────────────────────────────────────────
      if (isTrips) {
        const r1s = rec(strongSide, 1);
        const r2s = rec(strongSide, 2);
        const r3s = rec(strongSide, 3);
        const r1w = rec(weakSide, 1);
        // rb = r2w_3x1 (rb counts as weak #2 in 3x1)

        // ── Strong CB: flat zone; man if isFlat only ──
        if (role === 'CB' && isStrong) {
          if (r1s && isFlat(r1s)) return manCover(r1s.id, YARD_PX * 0.5);
          if (r2s && isFlat(r2s)) return manCover(r2s.id, YARD_PX);
          if (r3s && isFlat(r3s)) return manCover(r3s.id, YARD_PX);
          return zoneDrop(flatZoneS);
        }

        // ── Strong Apex: man #2s; flat → HOOK_S ──
        if ((role === 'APEX-L' || role === 'APEX-R') && isStrong) {
          if (r2s && isFlat(r2s)) return zoneDrop(hcS);
          return r2s ? manCover(r2s.id, YARD_PX) : zoneDrop(hcS);
        }

        // ── Strong Safety: man #1s if vertical, else deep third strong ──
        if (role === 'SAF_S') {
          if (r1s && isVertical(r1s)) return manCover(r1s.id, YARD_PX * 1.5);
          if (r1s && inDeepZone(deepS, r1s)) return manCover(r1s.id, YARD_PX);
          return zoneDrop(deepS);
        }
        if (role === 'HOOK-L' || role === 'HOOK-R' || role === 'HOOK-M') {
          if (r3s && isFlat(r3s))     return zoneDrop(hookS);
          if (r3s && isVertical(r3s)) return zoneDrop('HOOK_MIDDLE'); // pass to FS
          return r3s ? manCover(r3s.id, YARD_PX) : zoneDrop('HOOK_MIDDLE');
        }

        // ── Weak Apex: man rb (= weak #2 in 3x1)
        //   under rb → CURL_FLAT, man any curl receiver
        //   smash (r1w hitch) → man r1w ──
        if ((role === 'APEX-L' || role === 'APEX-R') && isWeak) {
          if (rb && isUnder(rb)) {
            const curlThreat = eligible.find(p => inCurlFlat(curlFlatW, p));
            return curlThreat ? manCover(curlThreat.id, YARD_PX) : zoneDrop(curlFlatW);
          }
          if (r1w && isHitch(r1w)) return manCover(r1w.id, YARD_PX);
          return rb ? manCover(rb.id, YARD_PX) : zoneDrop(hcW);
        }

        // ── Weak CB: man #1w; under or stable hitch → deep third weak ──
        if (role === 'CB' && isWeak) {
          const r1wLr = lr(r1w);
          const r1wStableHitch = r1wLr && r1wLr.depthYards <= 7
                              && (r1wLr.moveType === 'outside' || r1wLr.moveType === 'stopped');
          if (r1w && (isUnder(r1w) || r1wStableHitch)) {
            const deepThreat = eligible.find(p => inDeepZone(deepW, p));
            return deepThreat ? manCover(deepThreat.id, YARD_PX) : zoneDrop(deepW);
          }
          return r1w ? manCover(r1w.id, YARD_PX * 0.5) : zoneDrop(deepW);
        }

        // ── FS: deep middle; split on 2 threats ──
        if (role === 'SAF_W') {
          const deepMidThreats = eligible.filter(p => inDeepZone('DEEP_MIDDLE', p));
          if (deepMidThreats.length === 1) return manCover(deepMidThreats[0].id, YARD_PX);
          if (deepMidThreats.length >= 2)  return ottDec(deepMidThreats[0].id);
          return zoneDrop('DEEP_MIDDLE');
        }
      }

      return null;
    },
  },
}; // end _PR_BASE
