import {
  createGameState,
  makePath,
  makeTrayOrder,
  neighbors,
  serializeGame,
} from './puzzle.js';

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function createGameController(app) {
  function createGame(data, target) {
    return app.loadImage(data).then(loadedImage => {
      app.image = loadedImage;
      app.game = createGameState({
        imageData: data,
        imageWidth: loadedImage.width,
        imageHeight: loadedImage.height,
        target,
        showGrid: app.gridOn,
      });
      app.showView('game');
      app.buildDock();
      app.fitBoard();
      app.updateHUD();
      app.queueSave();
      app.toast('Choose a piece from the tray to begin');
    });
  }

  async function restoreGame(saved) {
    app.image = await app.loadImage(saved.imageData);
    app.game = saved;
    app.game.showGrid = app.gridOn;
    if (!app.game.trayOrder) app.game.trayOrder = makeTrayOrder(app.game.pieces);
    app.game.pieces.forEach(piece => {
      piece.path = makePath(piece);
      if (piece.inTray === undefined) piece.inTray = false;
    });
    app.game.lastTick = Date.now();
    app.showView('game');
    app.buildDock();
    app.fitBoard();
    app.updateHUD();
    app.toast('Welcome back');
  }

  function groupMembers(gid) {
    return app.game.pieces.filter(piece => piece.gid === gid);
  }

  function connectedCount() {
    const groups = new Set(app.game.pieces.map(piece => piece.gid));
    return app.game.count - groups.size;
  }

  function updateHUD() {
    const game = app.game;
    if (!game) return;
    const correct = game.pieces.filter(piece => !piece.inTray && piece.gid === -1).length;
    const percent = Math.round(correct / game.count * 100);
    app.$('#progressPercent').textContent = percent;
    app.$('#pieceProgress').textContent = `${correct} / ${game.count} ${app.tr('placed')}`;
    app.$('#gameTimer').textContent = formatTime(game.seconds);
    app.$('#zoomLabel').textContent = `${Math.round(app.camera.scale * 100)}%`;
  }

  function startClock() {
    stopClock();
    if (!app.game || app.game.completed) return;
    app.game.lastTick = Date.now();
    app.timerInterval = setInterval(() => {
      const now = Date.now();
      app.game.seconds += (now - app.game.lastTick) / 1000;
      app.game.lastTick = now;
      updateHUD();
      if (Math.floor(app.game.seconds) % 8 === 0) queueSave();
    }, 1000);
  }

  function stopClock() {
    clearInterval(app.timerInterval);
    app.timerInterval = null;
  }

  function queueSave() {
    clearTimeout(app.saveTimer);
    app.saveTimer = setTimeout(() => {
      if (app.game) app.storage.putCurrent(serializeGame(app.game));
    }, 500);
  }

  function bringGroupFront(gid) {
    const ids = app.game.order.filter(id => app.game.pieces[id].gid === gid);
    app.game.order = app.game.order
      .filter(id => app.game.pieces[id].gid !== gid)
      .concat(ids);
  }

  function trySnap(gid) {
    const moving = groupMembers(gid);
    const cell = Math.min(app.game.boardW / app.game.cols, app.game.boardH / app.game.rows);
    const gridThreshold = cell * 0.36;
    const offsetX = moving[0].x - moving[0].targetX;
    const offsetY = moving[0].y - moving[0].targetY;

    // The board itself is a valid snap target, so a piece never has to wait for a neighbour.
    if (Math.hypot(offsetX, offsetY) < gridThreshold) {
      moving.forEach(piece => {
        piece.x = piece.targetX;
        piece.y = piece.targetY;
        piece.gid = -1;
      });
      afterSnap();
      return true;
    }

    const others = app.game.pieces.filter(piece => !piece.inTray && piece.gid !== gid);
    const pieceThreshold = cell * 0.30;
    let match = null;
    outer:
    for (const a of moving) {
      for (const b of others) {
        if (!neighbors(a, b)) continue;
        const ax = a.x - a.targetX;
        const ay = a.y - a.targetY;
        const bx = b.x - b.targetX;
        const by = b.y - b.targetY;
        const dx = bx - ax;
        const dy = by - ay;
        if (Math.hypot(dx, dy) < pieceThreshold) {
          match = { dx, dy, newGid: b.gid };
          break outer;
        }
      }
    }

    if (!match) return false;
    moving.forEach(piece => {
      piece.x += match.dx;
      piece.y += match.dy;
      piece.gid = match.newGid;
    });
    afterSnap();
    return true;
  }

  function afterSnap() {
    playClick();
    globalThis.navigator?.vibrate?.(20);
    updateHUD();
    queueSave();
    app.requestRender();
    if (app.game.pieces.every(piece => !piece.inTray && piece.gid === -1)) finishGame();
  }

  function playClick() {
    if (!app.soundOn) return;
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      const audioContext = playClick.audioContext || (playClick.audioContext = new AudioContextClass());
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.setValueAtTime(280, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(520, audioContext.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.09);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch {
      // Audio feedback is optional and unavailable in some WebViews.
    }
  }

  function finishGame() {
    const game = app.game;
    game.completed = true;
    stopClock();
    const offsetX = game.pieces[0].x - game.pieces[0].targetX;
    const offsetY = game.pieces[0].y - game.pieces[0].targetY;
    game.pieces.forEach(piece => {
      piece.x = piece.targetX + offsetX;
      piece.y = piece.targetY + offsetY;
    });
    app.stats.solved = (app.stats.solved || 0) + 1;
    app.stats.seconds = (app.stats.seconds || 0) + game.seconds;
    app.storage.saveStats(app.stats);
    app.storage.deleteCurrent();
    setTimeout(() => {
      app.els.completeImage.src = game.imageData;
      app.$('#completeTime').textContent = formatTime(game.seconds);
      app.$('#completePieces').textContent = game.count;
      app.openModal(app.els.complete, true);
    }, 650);
    app.requestRender();
  }

  function shuffle() {
    const game = app.game;
    if (!game) return;
    if (app.trayState.mode === 'carry') app.abortCarry();
    else if (app.trayState.mode === 'peel') app.abortPeel();
    game.pieces.forEach(piece => {
      piece.x = piece.targetX;
      piece.y = piece.targetY;
      piece.gid = piece.id;
      piece.inTray = true;
    });
    game.trayOrder = makeTrayOrder(game.pieces);
    game.completed = false;
    game.seconds = 0;
    game.lastTick = Date.now();
    app.buildDock();
    app.fitBoard();
    updateHUD();
    queueSave();
    app.toast('Puzzle reset and tray reshuffled');
  }

  return {
    createGame,
    restoreGame,
    serialGame: () => serializeGame(app.game),
    groupMembers,
    connectedCount,
    updateHUD,
    startClock,
    stopClock,
    queueSave,
    bringGroupFront,
    trySnap,
    afterSnap,
    playClick,
    finishGame,
    shuffle,
    formatTime,
  };
}
