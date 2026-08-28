export function createRenderer(app) {
  const { els, ctx, hctx } = app;

  function drawHero() {
    const canvas = els.hero;
    const width = canvas.width;
    const height = canvas.height;
    const gradient = hctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#d1a37f');
    gradient.addColorStop(0.45, '#7b9989');
    gradient.addColorStop(1, '#29474b');
    hctx.fillStyle = gradient;
    hctx.fillRect(0, 0, width, height);

    hctx.fillStyle = '#ecddc3';
    hctx.beginPath();
    hctx.arc(width * 0.22, height * 0.23, 83, 0, 7);
    hctx.fill();

    hctx.fillStyle = '#223c3e';
    hctx.beginPath();
    hctx.moveTo(0, height * 0.76);
    hctx.quadraticCurveTo(width * 0.22, height * 0.36, width * 0.47, height * 0.78);
    hctx.quadraticCurveTo(width * 0.72, height * 0.28, width, height * 0.72);
    hctx.lineTo(width, height);
    hctx.lineTo(0, height);
    hctx.fill();

    hctx.strokeStyle = 'rgba(255,255,255,.28)';
    hctx.lineWidth = 2;
    for (let index = 1; index < 5; index += 1) {
      hctx.beginPath();
      hctx.moveTo(index * width / 5, 0);
      hctx.lineTo(index * width / 5, height);
      hctx.stroke();
    }
    for (let index = 1; index < 4; index += 1) {
      hctx.beginPath();
      hctx.moveTo(0, index * height / 4);
      hctx.lineTo(width, index * height / 4);
      hctx.stroke();
    }
  }

  function drawDockPiece(piece, canvas) {
    const size = 72;
    const density = 2;
    canvas.width = size * density;
    canvas.height = size * density;
    const context = canvas.getContext('2d');
    context.scale(density, density);
    const scale = size * 0.66 / Math.max(piece.w, piece.h);
    const offsetX = (size - piece.w * scale) / 2;
    const offsetY = (size - piece.h * scale) / 2;
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    context.save();
    context.clip(piece.path);
    context.drawImage(app.image, -piece.targetX, -piece.targetY, app.game.boardW, app.game.boardH);
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,.8)';
    context.lineWidth = 1.2 / scale;
    context.stroke(piece.path);
  }

  function resize() {
    if (app.currentView !== 'game') return;
    const rect = els.canvas.getBoundingClientRect();
    const density = Math.min(globalThis.devicePixelRatio || 1, 2);
    els.canvas.width = Math.round(rect.width * density);
    els.canvas.height = Math.round(rect.height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
    render();
  }

  function screenToWorld(x, y) {
    const rect = els.canvas.getBoundingClientRect();
    return {
      x: (x - rect.left - app.camera.x) / app.camera.scale,
      y: (y - rect.top - app.camera.y) / app.camera.scale,
    };
  }

  function requestRender() {
    if (app.raf) return;
    app.raf = requestAnimationFrame(() => {
      app.raf = 0;
      render();
    });
  }

  function render() {
    const game = app.game;
    if (!game || app.currentView !== 'game') return;
    const rect = els.canvas.getBoundingClientRect();
    const density = Math.min(globalThis.devicePixelRatio || 1, 2);
    const camera = app.camera;
    const trayState = app.trayState;
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    ctx.fillStyle = 'rgba(241,238,231,.42)';
    ctx.strokeStyle = 'rgba(18,19,22,.2)';
    ctx.lineWidth = 1 / camera.scale;
    ctx.fillRect(0, 0, game.boardW, game.boardH);
    ctx.strokeRect(0, 0, game.boardW, game.boardH);
    if (game.showGrid) {
      ctx.strokeStyle = 'rgba(18,19,22,.13)';
      ctx.lineWidth = 0.8 / camera.scale;
      for (const piece of game.pieces) {
        ctx.save();
        ctx.translate(piece.targetX, piece.targetY);
        ctx.stroke(piece.path);
        ctx.restore();
      }
    }

    for (const id of game.order) {
      const piece = game.pieces[id];
      if (piece.inTray) continue;
      if (trayState.mode === 'carry' && trayState.carry && piece.id === trayState.carry.gid) continue;
      ctx.save();
      let pop = 1;
      if (trayState.settleFx && trayState.settleFx.gid === piece.id) {
        const progress = (performance.now() - trayState.settleFx.t0) / 170;
        if (progress >= 1 || piece.inTray) trayState.settleFx = null;
        else pop = 1 + 0.06 * Math.sin(progress * Math.PI);
      }
      ctx.translate(piece.x + piece.w / 2, piece.y + piece.h / 2);
      ctx.scale(pop, pop);
      ctx.translate(-(piece.x + piece.w / 2), -(piece.y + piece.h / 2));
      ctx.translate(piece.x, piece.y);
      if (game.shadows) {
        ctx.shadowColor = 'rgba(18,19,22,.32)';
        ctx.shadowBlur = 8 / camera.scale;
        ctx.shadowOffsetY = 4 / camera.scale;
      }
      ctx.save();
      ctx.clip(piece.path);
      ctx.drawImage(app.image, -piece.targetX, -piece.targetY, game.boardW, game.boardH);
      ctx.restore();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,.58)';
      ctx.lineWidth = Math.max(0.7, 1.1 / camera.scale);
      ctx.stroke(piece.path);
      ctx.restore();
    }

    if (trayState.mode === 'carry' && trayState.carry) {
      const carry = trayState.carry;
      const piece = game.pieces[carry.gid];
      const now = performance.now();
      const snapPosition = carry.ready ? app.snapPreviewPos(piece) : null;
      if (snapPosition) {
        const alpha = 0.55 + 0.35 * Math.sin(now / 175);
        const pulse = 1.03 + 0.015 * Math.sin(now / 175);
        const centerX = snapPosition.x + piece.w / 2;
        const centerY = snapPosition.y + piece.h / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(pulse, pulse);
        ctx.translate(-centerX, -centerY);
        ctx.translate(snapPosition.x, snapPosition.y);
        ctx.fillStyle = `rgba(229,88,63,${0.18 + 0.1 * alpha})`;
        ctx.fill(piece.path);
        ctx.strokeStyle = `rgba(229,88,63,${alpha})`;
        ctx.lineWidth = 2.2 / camera.scale;
        ctx.shadowColor = 'rgba(229,88,63,.85)';
        ctx.shadowBlur = 13 / camera.scale;
        ctx.stroke(piece.path);
        ctx.restore();
      }

      const morph = 1 - Math.pow(1 - Math.max(0, Math.min(1, (now - carry.morphT0) / 150)), 3);
      ctx.save();
      ctx.globalAlpha = morph * (snapPosition ? 0.86 : 1);
      ctx.translate(piece.x + piece.w / 2, piece.y + piece.h / 2);
      ctx.rotate(carry.tilt);
      ctx.translate(-(piece.x + piece.w / 2), -(piece.y + piece.h / 2));
      ctx.translate(piece.x, piece.y);
      ctx.shadowColor = 'rgba(18,19,22,.42)';
      ctx.shadowBlur = 24 / camera.scale;
      ctx.shadowOffsetY = 12 / camera.scale;
      ctx.save();
      ctx.clip(piece.path);
      ctx.drawImage(app.image, -piece.targetX, -piece.targetY, game.boardW, game.boardH);
      ctx.restore();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = Math.max(0.8, 1.2 / camera.scale);
      ctx.stroke(piece.path);
      ctx.restore();
    }
    ctx.restore();
  }

  function fitBoard() {
    const game = app.game;
    if (!game) return;
    const rect = els.canvas.getBoundingClientRect();
    const sidePad = Math.max(28, Math.min(80, rect.width * 0.08));
    const topPad = 34;
    const dockSpace = rect.width < 800 ? 150 : 165;
    const usableHeight = Math.max(180, rect.height - topPad - dockSpace);
    app.camera.scale = Math.min(
      (rect.width - sidePad * 2) / game.boardW,
      usableHeight / game.boardH,
      1.45,
    );
    app.camera.x = (rect.width - game.boardW * app.camera.scale) / 2;
    app.camera.y = topPad + (usableHeight - game.boardH * app.camera.scale) / 2;
    app.updateHUD();
    requestRender();
  }

  function fitAll() {
    fitBoard();
  }

  function zoomAt(factor, screenX, screenY) {
    const rect = els.canvas.getBoundingClientRect();
    const x = screenX ?? rect.width / 2;
    const y = screenY ?? rect.height / 2;
    const worldX = (x - app.camera.x) / app.camera.scale;
    const worldY = (y - app.camera.y) / app.camera.scale;
    app.camera.scale = Math.max(0.18, Math.min(3, app.camera.scale * factor));
    app.camera.x = x - worldX * app.camera.scale;
    app.camera.y = y - worldY * app.camera.scale;
    app.updateHUD();
    requestRender();
  }

  function hitPiece(world) {
    const game = app.game;
    for (let index = game.order.length - 1; index >= 0; index -= 1) {
      const piece = game.pieces[game.order[index]];
      if (piece.inTray || piece.gid === -1) continue;
      const localX = world.x - piece.x;
      const localY = world.y - piece.y;
      if (
        localX > -piece.w * 0.25
        && localX < piece.w * 1.25
        && localY > -piece.h * 0.25
        && localY < piece.h * 1.25
        && ctx.isPointInPath(piece.path, localX, localY)
      ) return piece;
    }
    return null;
  }

  return {
    drawHero,
    drawDockPiece,
    resize,
    screenToWorld,
    requestRender,
    render,
    fitBoard,
    fitAll,
    zoomAt,
    hitPiece,
  };
}
