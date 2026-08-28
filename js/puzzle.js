export function secureIndex(max, cryptoRef = globalThis.crypto) {
  if (max <= 1) return 0;
  const limit = Math.floor(4294967296 / max) * max;
  const values = new Uint32Array(1);
  do {
    cryptoRef.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}

export function secureShuffle(items, cryptoRef = globalThis.crypto) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1, cryptoRef);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function makeTrayOrder(pieces, cryptoRef = globalThis.crypto) {
  const ids = pieces.map(piece => piece.id);
  const near = (a, b) => Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
  let best = null;
  let bestScore = Infinity;

  // Use independent cryptographic shuffles, then reject visually clustered orders.
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const order = secureShuffle(ids, cryptoRef);
    let score = 0;
    for (let index = 1; index < order.length; index += 1) {
      if (near(pieces[order[index - 1]], pieces[order[index]])) score += 1;
    }
    if (score < bestScore) {
      best = order;
      bestScore = score;
    }
    if (score === 0) return order;
  }
  return best;
}

export function sampleArtwork(width = 1400, height = 950, documentRef = globalThis.document) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#d9b18d');
  gradient.addColorStop(0.42, '#809b8a');
  gradient.addColorStop(1, '#304b4d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#e9d9bd';
  context.beginPath();
  context.arc(width * 0.23, height * 0.25, height * 0.12, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#263c3e';
  context.beginPath();
  context.moveTo(0, height * 0.72);
  context.quadraticCurveTo(width * 0.2, height * 0.42, width * 0.42, height * 0.73);
  context.quadraticCurveTo(width * 0.64, height * 0.32, width, height * 0.7);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.fill();

  context.fillStyle = '#bb684f';
  context.beginPath();
  context.moveTo(width * 0.34, height);
  context.quadraticCurveTo(width * 0.53, height * 0.52, width * 0.73, height);
  context.fill();

  context.strokeStyle = 'rgba(240,225,194,.7)';
  context.lineWidth = 5;
  for (let index = 0; index < 7; index += 1) {
    context.beginPath();
    context.moveTo(width * (0.08 + index * 0.15), height);
    context.quadraticCurveTo(
      width * (0.15 + index * 0.13),
      height * 0.62,
      width * (0.18 + index * 0.14),
      height * 0.54
    );
    context.stroke();
  }

  context.fillStyle = 'rgba(255,255,255,.14)';
  for (let index = 0; index < 70; index += 1) {
    context.beginPath();
    context.arc(Math.random() * width, Math.random() * height, Math.random() * 3 + 1, 0, 7);
    context.fill();
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

export const difficultyRanges = {
  12: [9, 16],
  24: [20, 30],
  48: [42, 56],
  80: [70, 90],
};

export function chooseGrid(target, aspect) {
  const [min, max] = difficultyRanges[target] || [Math.max(4, target - 4), target + 6];
  let best = [target, 1];
  let bestScore = Infinity;

  for (let rows = 2; rows <= 20; rows += 1) {
    for (let cols = 2; cols <= 20; cols += 1) {
      const total = rows * cols;
      if (total < min || total > max) continue;
      const pieceAspect = aspect * rows / cols;
      const shapePenalty = Math.abs(Math.log(pieceAspect));
      const countPenalty = Math.abs(total - target) / target;
      const score = shapePenalty * 4 + countPenalty * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = [cols, rows];
      }
    }
  }
  return best;
}

export function edgePath(path, x1, y1, x2, y2, nx, ny, sign, size) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const at = t => [x1 + dx * t, y1 + dy * t];
  const a = at(0.34);
  const b = at(0.42);
  const d = at(0.58);
  const e = at(0.66);
  path.lineTo(a[0], a[1]);

  const amplitude = size * 0.2 * sign;
  path.bezierCurveTo(
    b[0], b[1],
    b[0] + nx * amplitude * 0.15,
    b[1] + ny * amplitude * 0.15,
    b[0] + nx * amplitude * 0.55,
    b[1] + ny * amplitude * 0.55
  );
  path.bezierCurveTo(
    b[0] + nx * amplitude,
    b[1] + ny * amplitude,
    d[0] + nx * amplitude,
    d[1] + ny * amplitude,
    d[0] + nx * amplitude * 0.55,
    d[1] + ny * amplitude * 0.55
  );
  path.bezierCurveTo(
    d[0] + nx * amplitude * 0.15,
    d[1] + ny * amplitude * 0.15,
    d[0],
    d[1],
    e[0],
    e[1]
  );
  path.lineTo(x2, y2);
}

export function makePath(piece, Path2DClass = globalThis.Path2D) {
  if (!Path2DClass) throw new Error('Path2D is not available in this environment');
  const path = new Path2DClass();
  const { w, h } = piece;
  path.moveTo(0, 0);
  edgePath(path, 0, 0, w, 0, 0, -1, piece.edges.t, w);
  edgePath(path, w, 0, w, h, 1, 0, piece.edges.r, h);
  edgePath(path, w, h, 0, h, 0, 1, piece.edges.b, w);
  edgePath(path, 0, h, 0, 0, -1, 0, piece.edges.l, h);
  path.closePath();
  return path;
}

export function neighbors(a, b) {
  return (a.row === b.row && Math.abs(a.col - b.col) === 1)
    || (a.col === b.col && Math.abs(a.row - b.row) === 1);
}

export function createGameState({
  imageData,
  imageWidth,
  imageHeight,
  target,
  showGrid = false,
  now = Date.now(),
  cryptoRef = globalThis.crypto,
  Path2DClass = globalThis.Path2D,
}) {
  const aspect = imageWidth / imageHeight;
  const [cols, rows] = chooseGrid(target, aspect);
  const count = cols * rows;
  const boardW = 800;
  const boardH = boardW / aspect;
  const cellWidth = boardW / cols;
  const cellHeight = boardH / rows;
  const pieces = [];
  let seed = now >>> 0;
  const random = () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 4294967296);
  const right = Array.from({ length: rows }, () => Array(cols).fill(0));
  const bottom = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (col < cols - 1) right[row][col] = random() > 0.5 ? 1 : -1;
      if (row < rows - 1) bottom[row][col] = random() > 0.5 ? 1 : -1;
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = row * cols + col;
      const piece = {
        id,
        row,
        col,
        w: cellWidth,
        h: cellHeight,
        targetX: col * cellWidth,
        targetY: row * cellHeight,
        x: col * cellWidth,
        y: row * cellHeight,
        gid: id,
        inTray: true,
        edges: {
          t: row ? -bottom[row - 1][col] : 0,
          r: right[row][col],
          b: bottom[row][col],
          l: col ? -right[row][col - 1] : 0,
        },
      };
      piece.path = makePath(piece, Path2DClass);
      pieces.push(piece);
    }
  }

  return {
    version: 3,
    imageData,
    count,
    cols,
    rows,
    boardW,
    boardH,
    pieces,
    order: pieces.map(piece => piece.id),
    trayOrder: makeTrayOrder(pieces, cryptoRef),
    seconds: 0,
    lastTick: now,
    completed: false,
    shadows: true,
    showGrid,
  };
}

export function serializeGame(game) {
  if (!game) return null;
  return {
    ...game,
    lastTick: undefined,
    pieces: game.pieces.map(({ path, ...piece }) => piece),
  };
}
