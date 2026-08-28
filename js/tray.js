import { neighbors } from './puzzle.js';

export function createTrayController(app) {
  const trayState = app.trayState;
  const dockMomentum = app.dockMomentum;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dockEl = () => app.$('#dockPieces');
  const dockTopY = () => app.$('#pieceDock').getBoundingClientRect().top;

  function buildDock() {
    const game = app.game;
    if (!game) return;
    const dock = dockEl();
    dock.innerHTML = '';
    const loose = game.trayOrder
      .map(id => game.pieces[id])
      .filter(piece => piece.inTray);
    app.$('#dockCount').textContent = `${loose.length} ${app.tr('LEFT')}`;
    const hint = app.$('#dockHint');
    if (hint) hint.textContent = app.tr('Release to return to tray');
    if (!loose.length) {
      dock.innerHTML = `<span class="dock-empty">${app.tr('All pieces are on the board')}</span>`;
      return;
    }

    loose.forEach(piece => {
      const button = app.document.createElement('button');
      const canvas = app.document.createElement('canvas');
      button.className = 'dock-piece';
      button.title = `Place piece ${piece.id + 1}`;
      button.setAttribute('aria-label', `Put piece ${piece.id + 1} on the board`);
      app.drawDockPiece(piece, canvas);
      button.appendChild(canvas);
      button.onclick = () => {
        if (trayState.suppressClick) {
          trayState.suppressClick = false;
          return;
        }
        button.classList.add('removing');
        setTimeout(() => releaseFromTray(piece), 100);
      };
      dock.appendChild(button);
      attachTrayGesture(button, piece);
    });
  }

  function refreshDockCount() {
    if (!app.game) return;
    const loose = app.game.pieces.filter(piece => piece.inTray).length;
    app.$('#dockCount').textContent = `${loose} ${app.tr('LEFT')}`;
  }

  function releaseFromTray(piece) {
    piece.inTray = false;
    const rect = app.els.canvas.getBoundingClientRect();
    const center = app.screenToWorld(
      rect.left + rect.width / 2,
      rect.top + (rect.height - 112) / 2,
    );
    const spread = Math.min(app.game.boardW, app.game.boardH) * 0.28;
    piece.x = center.x - piece.w / 2 + (Math.random() - 0.5) * spread;
    piece.y = center.y - piece.h / 2 + (Math.random() - 0.5) * spread;
    piece.gid = piece.id;
    app.bringGroupFront(piece.gid);
    buildDock();
    app.updateHUD();
    app.queueSave();
    app.requestRender();
  }

  function returnGroupToTray(gid) {
    const members = app.groupMembers(gid);
    if (!members.length || gid === -1) return;
    members.forEach(piece => {
      piece.inTray = true;
      piece.gid = piece.id;
      piece.x = piece.targetX;
      piece.y = piece.targetY;
    });
    buildDock();
    app.updateHUD();
    app.queueSave();
    app.requestRender();
    app.toast(members.length > 1 ? 'Piece group returned to tray' : 'Piece returned to tray');
  }

  function returnAllLoose() {
    const game = app.game;
    if (!game) return;
    game.pieces
      .filter(piece => !piece.inTray && piece.gid !== -1)
      .forEach(piece => {
        piece.inTray = true;
        piece.gid = piece.id;
        piece.x = piece.targetX;
        piece.y = piece.targetY;
      });
    buildDock();
    app.updateHUD();
    app.queueSave();
    app.requestRender();
    app.toast('Loose pieces returned to tray');
  }

  // Press → directional intent lock (horizontal scrolls the strip with custom
  // momentum + rubber-band, vertical lifts the piece) → the piece peels off a
  // resistance curve into a floating ghost → seamless morph onto the board
  // canvas (scale-matched) → velocity tilt, hover-lift, edge auto-pan, live
  // snap preview → choreographed drop or fly-back into the slot.
  function ghostK(piece, scale) {
    return scale * Math.max(piece.w, piece.h) / (72 * 0.66);
  }

  function setDockDroppable(on) {
    app.$('#pieceDock').classList.toggle('droppable', Boolean(on));
  }

  function makeGhost(piece) {
    const ghost = app.document.createElement('canvas');
    app.drawDockPiece(piece, ghost);
    ghost.className = 'tray-ghost';
    ghost.style.width = '72px';
    ghost.style.height = '72px';
    ghost.style.transformOrigin = '0 0';
    app.document.body.appendChild(ghost);
    return ghost;
  }

  function placeGhost(ghost, centerX, centerY, scale) {
    ghost.style.transform = `translate(${centerX - 36 * scale}px,${centerY - 36 * scale}px) scale(${scale})`;
  }

  function flyGhost(piece, from, toFn, onDone, duration = 240, reuse) {
    const ghost = reuse || makeGhost(piece);
    const start = globalThis.performance.now();
    placeGhost(ghost, from.x, from.y, from.k);
    const step = () => {
      const progress = clamp((globalThis.performance.now() - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const to = toFn();
      placeGhost(
        ghost,
        from.x + (to.x - from.x) * eased,
        from.y + (to.y - from.y) * eased,
        from.k + (to.k - from.k) * eased,
      );
      ghost.style.opacity = String(1 - 0.25 * eased);
      if (progress < 1) globalThis.requestAnimationFrame(step);
      else {
        ghost.remove();
        onDone?.();
      }
    };
    globalThis.requestAnimationFrame(step);
  }

  function animateSlot(button, direction) {
    const gap = parseFloat(globalThis.getComputedStyle(dockEl()).columnGap) || 9;
    const ease = 'cubic-bezier(.3,.7,.25,1)';
    button.style.overflow = 'hidden';
    globalThis.requestAnimationFrame(() => {
      button.style.transition = `flex-basis .24s ${ease},width .24s ${ease},margin-right .24s ${ease},opacity .18s`;
      button.style.flexBasis = direction < 0 ? '0px' : '';
      button.style.width = direction < 0 ? '0px' : '';
      button.style.marginRight = direction < 0 ? `-${gap}px` : '';
      button.style.opacity = direction < 0 ? '0' : '1';
    });
    setTimeout(() => {
      if (direction > 0 && button.isConnected) {
        ['transition', 'overflow', 'flexBasis', 'width', 'marginRight', 'opacity']
          .forEach(property => button.style.removeProperty(property));
      }
    }, 270);
  }

  function recoilStrip() {
    const dock = dockEl();
    if (!dock) return;
    const rtl = globalThis.getComputedStyle(dock).direction === 'rtl';
    const impulse = clamp(trayState.vx * 16, -24, 24) * (rtl ? -1 : 1);
    if (Math.abs(impulse) < 3) return;
    dock.style.transition = 'transform .05s ease-out';
    dock.style.transform = `translateX(${impulse}px)`;
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => {
      dock.style.transition = 'transform .45s cubic-bezier(.2,.7,.3,1)';
      dock.style.transform = 'translateX(0)';
    }));
  }

  function startDockMomentum() {
    const dock = dockEl();
    if (!dock) return;
    const rtl = globalThis.getComputedStyle(dock).direction === 'rtl';
    const sign = rtl ? 1 : -1;
    let velocity = clamp(trayState.vx, -2.8, 2.8);
    if (Math.abs(velocity) < 0.22) return;
    let last = globalThis.performance.now();
    const step = () => {
      const now = globalThis.performance.now();
      const delta = Math.min(48, now - last);
      last = now;
      velocity *= Math.exp(-delta / 380);
      if (Math.abs(velocity) < 0.02) return;
      const before = dock.scrollLeft;
      dock.scrollLeft += sign * velocity * delta;
      if (dock.scrollLeft !== before) {
        dockMomentum.raf = globalThis.requestAnimationFrame(step);
      }
    };
    dockMomentum.raf = globalThis.requestAnimationFrame(step);
  }

  function releaseRubber() {
    const dock = dockEl();
    if (!dock || !trayState.rubber) return;
    const from = trayState.rubber;
    trayState.rubber = 0;
    const start = globalThis.performance.now();
    const step = () => {
      const progress = clamp((globalThis.performance.now() - start) / 260, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      dock.style.transform = `translateX(${(1 - eased) * 44 * Math.tanh(from / 44)}px)`;
      if (progress < 1) globalThis.requestAnimationFrame(step);
      else dock.style.transform = '';
    };
    globalThis.requestAnimationFrame(step);
  }

  function beginPeel() {
    const button = trayState.btn;
    trayState.mode = 'peel';
    button.classList.remove('pressed');
    button.classList.add('peeling');
    const center = slotCenter(button);
    trayState.slotCx = center.x;
    trayState.slotCy = center.y;
    trayState.ghostX = center.x;
    trayState.ghostY = center.y;
    trayState.ghostK0 = center.k;
    trayState.ghost = makeGhost(trayState.piece);
    placeGhost(trayState.ghost, center.x, center.y, center.k);
  }

  function detachToCarry() {
    const piece = trayState.piece;
    const button = trayState.btn;
    piece.inTray = false;
    piece.gid = piece.id;
    app.bringGroupFront(piece.gid);
    trayState.carry = {
      gid: piece.id,
      px: trayState.last.x,
      py: trayState.last.y,
      cx: trayState.ghostX,
      cy: trayState.ghostY,
      k0: trayState.ghostK0,
      k1: ghostK(piece, app.camera.scale),
      tilt: 0,
      vx: trayState.vx,
      button,
      ghost: trayState.ghost,
      morphT0: globalThis.performance.now(),
      lastT: globalThis.performance.now(),
      ready: false,
      offX: trayState.ghostX - trayState.last.x,
      offY: trayState.ghostY - trayState.last.y,
      offT0: globalThis.performance.now(),
    };
    const world = app.screenToWorld(trayState.carry.cx, trayState.carry.cy);
    piece.x = world.x - piece.w / 2;
    piece.y = world.y - piece.h / 2;
    trayState.ghost = null;
    trayState.suppressClick = true;
    trayState.mode = 'carry';
    button.classList.remove('peeling');
    animateSlot(button, -1);
    recoilStrip();
    refreshDockCount();
    app.updateHUD();
    app.requestRender();
    globalThis.requestAnimationFrame(carryLoop);
  }

  function carryLoop() {
    const carry = trayState.carry;
    if (!carry || trayState.mode !== 'carry') return;
    const now = globalThis.performance.now();
    const delta = clamp(now - carry.lastT, 4, 40) / 1000;
    carry.lastT = now;
    const piece = app.game.pieces[carry.gid];
    const rect = app.els.canvas.getBoundingClientRect();
    const dockTop = dockTopY();
    const halfHeight = piece.h * app.camera.scale / 2;
    const offsetProgress = 1 - Math.pow(1 - clamp((now - carry.offT0) / 130, 0, 1), 3);
    let targetX = carry.px + carry.offX * (1 - offsetProgress);
    let targetY = carry.py + carry.offY * (1 - offsetProgress);
    targetY = Math.min(targetY, dockTop - halfHeight - 4);
    targetY = Math.max(targetY, rect.top + halfHeight * 0.4);
    targetX = clamp(targetX, rect.left + 14, rect.right - 14);
    const follow = 1 - Math.exp(-delta * 20);
    carry.cx += (targetX - carry.cx) * follow;
    carry.cy += (targetY - carry.cy) * follow;

    const margin = 44;
    let pan = 0;
    if (carry.px < rect.left + margin) pan = -1 + (carry.px - rect.left) / margin;
    else if (carry.px > rect.right - margin) pan = 1 - (rect.right - carry.px) / margin;
    else if (
      carry.py < rect.top + margin
      && carry.px > rect.left + rect.width * 0.22
      && carry.px < rect.right - rect.width * 0.22
    ) {
      pan = -(1 - (carry.py - rect.top) / margin);
    }
    if (pan) app.camera.x += pan * 820 * delta;

    carry.tilt += (clamp(carry.vx * 0.0012, -0.085, 0.085) - carry.tilt)
      * (1 - Math.exp(-delta * 9));
    carry.vx *= Math.exp(-delta * 4);
    const world = app.screenToWorld(carry.cx, carry.cy);
    piece.x = world.x - piece.w / 2;
    piece.y = world.y - piece.h / 2;
    carry.ready = true;
    const morph = clamp((now - carry.morphT0) / 150, 0, 1);
    if (carry.ghost) {
      if (morph >= 1) {
        carry.ghost.remove();
        carry.ghost = null;
      } else {
        placeGhost(
          carry.ghost,
          carry.cx,
          carry.cy,
          carry.k0 + (carry.k1 - carry.k0) * (1 - Math.pow(1 - morph, 3)),
        );
      }
    }
    setDockDroppable(carry.py >= dockTop);
    app.requestRender();
    if (trayState.mode === 'carry') globalThis.requestAnimationFrame(carryLoop);
  }

  function slotCenter(button) {
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      k: rect.width / 72,
    };
  }

  function snapPreviewPos(piece) {
    const game = app.game;
    const cell = Math.min(game.boardW / game.cols, game.boardH / game.rows);
    if (Math.hypot(piece.x - piece.targetX, piece.y - piece.targetY) < cell * 0.36) {
      return { x: piece.targetX, y: piece.targetY };
    }
    for (const other of game.pieces) {
      if (other.inTray || other.gid === piece.gid || !neighbors(piece, other)) continue;
      const dx = (other.x - other.targetX) - (piece.x - piece.targetX);
      const dy = (other.y - other.targetY) - (piece.y - piece.targetY);
      if (Math.hypot(dx, dy) < cell * 0.30) return { x: piece.x + dx, y: piece.y + dy };
    }
    return null;
  }

  function dropCarried(event) {
    const carry = trayState.carry;
    trayState.carry = null;
    trayState.suppressClick = true;
    trayState.mode = 'idle';
    trayState.btn = null;
    trayState.piece = null;
    setDockDroppable(false);
    if (carry.ghost) {
      carry.ghost.remove();
      carry.ghost = null;
    }
    const piece = app.game.pieces[carry.gid];
    trayState.settleFx = { gid: carry.gid, t0: globalThis.performance.now() };
    if (event.clientY >= dockTopY()) {
      flyBackToTray(piece, carry);
      return;
    }
    retireSlot(carry.button);
    if (!app.trySnap(piece.gid)) {
      app.updateHUD();
      app.queueSave();
    }
    app.requestRender();
  }

  function retireSlot(button) {
    const gone = () => {
      if (button.isConnected) button.remove();
      refreshDockCount();
      if (app.game && !app.game.pieces.some(piece => piece.inTray)) buildDock();
    };
    if (button.style.opacity === '0') gone();
    else {
      animateSlot(button, -1);
      setTimeout(gone, 260);
    }
  }

  function flyBackToTray(piece, carry) {
    piece.inTray = true;
    piece.gid = piece.id;
    piece.x = piece.targetX;
    piece.y = piece.targetY;
    animateSlot(carry.button, 1);
    flyGhost(
      piece,
      { x: carry.cx, y: carry.cy, k: carry.k1 },
      () => slotCenter(carry.button),
      () => {
        refreshDockCount();
        app.queueSave();
      },
      230,
    );
    app.updateHUD();
    app.requestRender();
  }

  function cancelPeel() {
    const piece = trayState.piece;
    const button = trayState.btn;
    const ghost = trayState.ghost;
    trayState.ghost = null;
    button.classList.remove('peeling');
    trayState.suppressClick = true;
    trayState.mode = 'idle';
    trayState.btn = null;
    trayState.piece = null;
    if (ghost) {
      flyGhost(
        piece,
        { x: trayState.ghostX, y: trayState.ghostY, k: trayState.ghostK0 },
        () => slotCenter(button),
        () => {},
        170,
        ghost,
      );
    }
  }

  function abortCarry() {
    const carry = trayState.carry;
    if (!carry) return;
    trayState.carry = null;
    setDockDroppable(false);
    if (carry.ghost) carry.ghost.remove();
    const piece = app.game.pieces[carry.gid];
    piece.inTray = true;
    piece.gid = piece.id;
    piece.x = piece.targetX;
    piece.y = piece.targetY;
    if (carry.button.isConnected) animateSlot(carry.button, 1);
    trayState.suppressClick = true;
    trayState.mode = 'idle';
    trayState.btn = null;
    trayState.piece = null;
    buildDock();
    app.updateHUD();
    app.queueSave();
    app.requestRender();
  }

  function abortPeel() {
    if (trayState.ghost) trayState.ghost.remove();
    trayState.ghost = null;
    if (trayState.btn) trayState.btn.classList.remove('peeling');
    trayState.mode = 'idle';
    trayState.btn = null;
    trayState.piece = null;
  }

  function attachTrayGesture(button, piece) {
    const slop = 7;
    const peelMax = 44;
    const detachLift = 20;
    button.addEventListener('pointerdown', event => {
      if (!app.game || app.game.completed || trayState.mode !== 'idle' || !piece.inTray) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      Object.assign(trayState, {
        mode: 'press',
        pointerId: event.pointerId,
        btn: button,
        piece,
        start: { x: event.clientX, y: event.clientY },
        last: { x: event.clientX, y: event.clientY },
        samples: [{ x: event.clientX, y: event.clientY, t: globalThis.performance.now() }],
        vx: 0,
        vy: 0,
        pull: 0,
        lift: 0,
        rubber: 0,
      });
      button.classList.add('pressed');
      globalThis.cancelAnimationFrame(dockMomentum.raf);
    });

    button.addEventListener('pointermove', event => {
      if (trayState.mode === 'idle' || trayState.pointerId !== event.pointerId) return;
      const now = globalThis.performance.now();
      trayState.samples.push({ x: event.clientX, y: event.clientY, t: now });
      if (trayState.samples.length > 6) trayState.samples.shift();
      const first = trayState.samples[0];
      const elapsed = Math.max(1, now - first.t);
      trayState.vx = (event.clientX - first.x) / elapsed;
      trayState.vy = (event.clientY - first.y) / elapsed;
      const dx = event.clientX - trayState.last.x;
      const dy = event.clientY - trayState.last.y;
      trayState.last = { x: event.clientX, y: event.clientY };

      if (trayState.mode === 'press') {
        const ax = event.clientX - trayState.start.x;
        const ay = event.clientY - trayState.start.y;
        if (Math.hypot(ax, ay) < slop) return;
        if (Math.abs(ax) > Math.abs(ay) * 1.15) {
          trayState.mode = 'scroll';
          button.classList.remove('pressed');
        } else beginPeel();
      }

      if (trayState.mode === 'scroll') {
        const ay = event.clientY - trayState.start.y;
        if (ay < -34 && Math.abs(trayState.vy) > Math.abs(trayState.vx) * 0.8) {
          trayState.start = { x: event.clientX, y: event.clientY };
          beginPeel();
        } else {
          const dock = dockEl();
          const rtl = globalThis.getComputedStyle(dock).direction === 'rtl';
          const desired = dock.scrollLeft + (rtl ? dx : -dx);
          dock.scrollLeft = desired;
          trayState.rubber = clamp(
            trayState.rubber + (desired - dock.scrollLeft) * 0.35,
            -70,
            70,
          );
          dock.style.transform = `translateX(${44 * Math.tanh(trayState.rubber / 44)}px)`;
        }
      } else if (trayState.mode === 'peel') {
        const pull = Math.max(0, trayState.start.y - event.clientY);
        trayState.pull = pull;
        trayState.lift = peelMax * (1 - Math.exp(-pull / peelMax));
        trayState.ghostX = trayState.slotCx + (event.clientX - trayState.start.x) * 0.18;
        trayState.ghostY = trayState.slotCy - trayState.lift;
        if (trayState.ghost) {
          placeGhost(
            trayState.ghost,
            trayState.ghostX,
            trayState.ghostY,
            trayState.ghostK0 * (1 + trayState.lift / peelMax * 0.14),
          );
        }
        if (trayState.lift > detachLift && event.clientY < dockTopY() - 4 && trayState.ghost) {
          detachToCarry();
        }
      } else if (trayState.mode === 'carry' && trayState.carry) {
        trayState.carry.px = event.clientX;
        trayState.carry.py = event.clientY;
        trayState.carry.vx = trayState.vx;
      }
    });

    const finish = event => {
      if (trayState.mode === 'idle' || trayState.pointerId !== event.pointerId) return;
      button.classList.remove('pressed');
      if (trayState.mode === 'press') {
        trayState.mode = 'idle';
        return;
      }
      trayState.suppressClick = true;
      if (trayState.mode === 'scroll') {
        releaseRubber();
        startDockMomentum();
        trayState.mode = 'idle';
        trayState.btn = null;
        trayState.piece = null;
        return;
      }
      if (trayState.mode === 'peel') {
        cancelPeel();
        return;
      }
      if (trayState.mode === 'carry') dropCarried(event);
    };
    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', event => {
      if (trayState.pointerId !== event.pointerId) return;
      button.classList.remove('pressed');
      if (trayState.mode === 'carry') abortCarry();
      else if (trayState.mode === 'peel') cancelPeel();
      else if (trayState.mode === 'scroll') releaseRubber();
      trayState.mode = 'idle';
      trayState.btn = null;
      trayState.piece = null;
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  return {
    buildDock,
    refreshDockCount,
    releaseFromTray,
    returnGroupToTray,
    returnAllLoose,
    dockTopY,
    setDockDroppable,
    snapPreviewPos,
    abortCarry,
    abortPeel,
    attachTrayGesture,
  };
}
