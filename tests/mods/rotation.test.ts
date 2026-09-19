import { describe, expect, it } from "vitest";

import {
  DEGREE_ROTATIONS,
  SHAPES,
  SHAPE_IDS,
  cellsAt,
  normalise,
  normaliseRotation,
  orientations,
  turnClockwise,
} from "../../src/mods/shapes.ts";
import type { GridPoint, ShapeId } from "../../src/mods/shapes.ts";

const point = (x: number, y: number): GridPoint => ({ x, y });
const key = ({ x, y }: GridPoint) => `${x},${y}`;
const keys = (cells: readonly GridPoint[]) => cells.map(key);

const DISTINCT: Readonly<Record<ShapeId, number>> = {
  "tetromino-i": 2,
  "tetromino-o": 1,
  "tetromino-t": 4,
  "tetromino-s": 2,
  "tetromino-z": 2,
  "tetromino-j": 4,
  "tetromino-l": 4,
  "triomino-i": 2,
  "triomino-l": 4,
  domino: 2,
  single: 1,
};

describe("canonical orientation math", () => {
  it("normalises to min zero in reading order without introducing duplicate cells", () => {
    const source = [point(8, 5), point(7, 4), point(7, 5)];
    expect(normalise(source)).toEqual([point(0, 0), point(0, 1), point(1, 1)]);
    expect(source).toEqual([point(8, 5), point(7, 4), point(7, 5)]);

    for (const shapeId of SHAPE_IDS) {
      let cells: readonly GridPoint[] = SHAPES[shapeId].cells;
      for (let turn = 0; turn < 4; turn++) {
        const canonical = normalise(cells);
        expect(new Set(keys(canonical)).size).toBe(canonical.length);
        cells = turnClockwise(cells);
      }
    }
  });

  it("returns to the start after four clockwise quarter turns", () => {
    for (const shapeId of SHAPE_IDS) {
      const start = normalise(SHAPES[shapeId].cells);
      let cells = start;
      for (let turn = 0; turn < 4; turn++) cells = turnClockwise(cells);
      expect(cells).toEqual(start);
    }
  });

  it("collapses duplicate orientations and keeps the first rotation that makes each set", () => {
    let total = 0;
    for (const shapeId of SHAPE_IDS) {
      const shape = SHAPES[shapeId];
      const distinct = orientations(shape);
      expect(distinct).toHaveLength(DISTINCT[shapeId]);
      expect(new Set(distinct.map(({ cells }) => keys(cells).join(";"))).size).toBe(distinct.length);
      for (const { rotation, cells } of distinct) {
        expect(normaliseRotation(shape, rotation)).toBe(rotation);
        expect(cellsAt(shape, rotation)).toEqual(cells);
      }
      total += distinct.length;
    }
    expect(total).toBe(28);

    expect(normaliseRotation(SHAPES["tetromino-o"], 270)).toBe(0);
    expect(normaliseRotation(SHAPES["tetromino-i"], 180)).toBe(0);
    expect(normaliseRotation(SHAPES["tetromino-i"], 270)).toBe(90);
  });

  it("keeps every orientation on non-negative integer cells with min x = min y = 0", () => {
    for (const shapeId of SHAPE_IDS) {
      const shape = SHAPES[shapeId];
      for (const rotation of DEGREE_ROTATIONS) {
        const cells = cellsAt(shape, rotation);
        expect(cells.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0)).toBe(true);
        expect(Math.min(...cells.map(({ x }) => x))).toBe(0);
        expect(Math.min(...cells.map(({ y }) => y))).toBe(0);
        expect(new Set(keys(cells)).size).toBe(cells.length);
      }
    }
  });
});
