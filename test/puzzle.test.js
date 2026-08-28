import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseGrid,
  makeTrayOrder,
  secureShuffle,
} from '../js/puzzle.js';

const zeroRandom = {
  getRandomValues(values) {
    values[0] = 0;
    return values;
  },
};

test('secureShuffle returns a permutation without mutating the input', () => {
  const source = [0, 1, 2, 3, 4];
  const shuffled = secureShuffle(source, zeroRandom);

  assert.deepEqual(source, [0, 1, 2, 3, 4]);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), source);
});

test('chooseGrid keeps square images close to square grids', () => {
  const [columns, rows] = chooseGrid(24, 1);

  assert.equal(columns, 5);
  assert.equal(rows, 5);
});

test('chooseGrid adapts the grid to a wide image', () => {
  const [columns, rows] = chooseGrid(24, 2);

  assert.ok(columns > rows);
  assert.ok(columns * rows >= 20 && columns * rows <= 30);
});

test('makeTrayOrder returns every puzzle piece exactly once', () => {
  const pieces = Array.from({ length: 12 }, (_, id) => ({
    id,
    row: Math.floor(id / 4),
    col: id % 4,
  }));
  const order = makeTrayOrder(pieces, zeroRandom);

  assert.equal(order.length, pieces.length);
  assert.deepEqual([...order].sort((a, b) => a - b), pieces.map(piece => piece.id));
});
