import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, serializeGame } from '../js/puzzle.js';

const zeroRandom = {
  getRandomValues(values) {
    values[0] = 0;
    return values;
  },
};

class Path2DStub {
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  closePath() {}
}

test('createGameState builds a serializable puzzle with matching edge pairs', () => {
  const game = createGameState({
    imageData: 'data:image/jpeg;base64,test',
    imageWidth: 1400,
    imageHeight: 950,
    target: 24,
    showGrid: true,
    now: 1234,
    cryptoRef: zeroRandom,
    Path2DClass: Path2DStub,
  });

  assert.equal(game.version, 3);
  assert.equal(game.count, game.cols * game.rows);
  assert.equal(game.pieces.length, game.count);
  assert.equal(game.showGrid, true);
  assert.ok(game.pieces.every(piece => piece.path instanceof Path2DStub));

  for (const piece of game.pieces) {
    if (piece.col < game.cols - 1) {
      const right = game.pieces[piece.id + 1];
      assert.equal(piece.edges.r, -right.edges.l);
    }
    if (piece.row < game.rows - 1) {
      const below = game.pieces[piece.id + game.cols];
      assert.equal(piece.edges.b, -below.edges.t);
    }
  }
});

test('serializeGame omits runtime Path2D objects', () => {
  const game = createGameState({
    imageData: 'data:image/jpeg;base64,test',
    imageWidth: 800,
    imageHeight: 800,
    target: 12,
    now: 5678,
    cryptoRef: zeroRandom,
    Path2DClass: Path2DStub,
  });
  const saved = serializeGame(game);

  assert.equal(saved.lastTick, undefined);
  assert.equal(saved.pieces.length, game.pieces.length);
  assert.ok(saved.pieces.every(piece => !('path' in piece)));
});
