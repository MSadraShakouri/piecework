export function createBoardInput(app) {
  const { els } = app;

  function bind() {
    els.canvas.addEventListener('pointerdown', event => {
      if (!app.game) return;
      if (app.trayState.mode === 'carry' || app.trayState.mode === 'peel') return;
      els.canvas.setPointerCapture(event.pointerId);
      app.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (app.pointers.size === 2) {
        const points = [...app.pointers.values()];
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        app.gesture = {
          dist: Math.hypot(dx, dy),
          scale: app.camera.scale,
          cx: (points[0].x + points[1].x) / 2,
          cy: (points[0].y + points[1].y) / 2,
          camX: app.camera.x,
          camY: app.camera.y,
        };
        app.drag = null;
        return;
      }

      const world = app.screenToWorld(event.clientX, event.clientY);
      const piece = app.hitPiece(world);
      if (piece) {
        app.bringGroupFront(piece.gid);
        app.drag = { type: 'piece', gid: piece.gid, last: world };
      } else {
        app.drag = { type: 'pan', last: { x: event.clientX, y: event.clientY } };
      }
      app.requestRender();
    });

    els.canvas.addEventListener('pointermove', event => {
      if (!app.pointers.has(event.pointerId)) return;
      app.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (app.pointers.size >= 2 && app.gesture) {
        const points = [...app.pointers.values()];
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const cx = (points[0].x + points[1].x) / 2;
        const cy = (points[0].y + points[1].y) / 2;
        app.camera.scale = Math.max(
          0.18,
          Math.min(3, app.gesture.scale * Math.hypot(dx, dy) / app.gesture.dist),
        );
        app.camera.x = app.gesture.camX + (cx - app.gesture.cx);
        app.camera.y = app.gesture.camY + (cy - app.gesture.cy);
        app.updateHUD();
        app.requestRender();
        return;
      }
      if (!app.drag) return;

      if (app.drag.type === 'piece') {
        const world = app.screenToWorld(event.clientX, event.clientY);
        const dx = world.x - app.drag.last.x;
        const dy = world.y - app.drag.last.y;
        app.groupMembers(app.drag.gid).forEach(piece => {
          piece.x += dx;
          piece.y += dy;
        });
        app.drag.last = world;
        app.setDockDroppable(event.clientY >= app.dockTopY());
      } else {
        app.camera.x += event.clientX - app.drag.last.x;
        app.camera.y += event.clientY - app.drag.last.y;
        app.drag.last = { x: event.clientX, y: event.clientY };
      }
      app.requestRender();
    });

    const pointerEnd = event => {
      app.pointers.delete(event.pointerId);
      app.setDockDroppable(false);
      if (app.drag?.type === 'piece') {
        if (event.clientY >= app.dockTopY()) app.returnGroupToTray(app.drag.gid);
        else app.trySnap(app.drag.gid);
      }
      app.drag = null;
      app.gesture = null;
      app.queueSave();
      app.requestRender();
    };

    els.canvas.addEventListener('pointerup', pointerEnd);
    els.canvas.addEventListener('pointercancel', pointerEnd);
    els.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = els.canvas.getBoundingClientRect();
      app.zoomAt(
        event.deltaY < 0 ? 1.1 : 0.9,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    }, { passive: false });
  }

  return { bind };
}
