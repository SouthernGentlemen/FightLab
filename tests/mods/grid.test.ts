import { describe, expect, it } from "vitest";

import { MOD_IDS, REGISTRY } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import {
  BANK_SIZE, BOARD_HEIGHT, BOARD_WIDTH, LANES, canPlace, cellsOf, emptyBank, firstFit, firstFreeBankSlot, place, removeFromGrid, rotateInPlace,
  setBankSlot,
} from "../../src/mods/grid.ts";
import type { Grid, PlacedMod } from "../../src/mods/grid.ts";
import { ROTATIONS, SHAPES, SHAPE_IDS, nextRotation, shapeCells, shapeSize, sizeOf } from "../../src/mods/shapes.ts";
import type { GridPoint, Rotation, ShapeId } from "../../src/mods/shapes.ts";

const point = (x: number, y: number): GridPoint => ({ x, y });
const key = ({ x, y }: GridPoint) => `${x},${y}`;
const sorted = (cells: readonly GridPoint[]) => cells.map(key).sort();

/** A grid of single-cell blockers on exactly these cells. */
function blockers(cells: readonly GridPoint[], firstUid = 100): PlacedMod[] {
  return cells.map(({ x, y }, index) => ({ uid: firstUid + index, mod: "heat-coil", stars: 1, rotation: 0, x, y }));
}

const ALL_CELLS: GridPoint[] = Array.from(
  { length: BOARD_WIDTH * BOARD_HEIGHT },
  (_, index) => point(index % BOARD_WIDTH, Math.floor(index / BOARD_WIDTH)),
);

const FOOTPRINTS: Readonly<Record<ShapeId, { readonly cells: readonly GridPoint[]; readonly size: number }>> = {
  "tetromino-i": { cells: [point(0, 0), point(1, 0), point(2, 0), point(3, 0)], size: 4 },
  "tetromino-o": { cells: [point(0, 0), point(1, 0), point(0, 1), point(1, 1)], size: 4 },
  "tetromino-t": { cells: [point(0, 0), point(1, 0), point(2, 0), point(1, 1)], size: 4 },
  "tetromino-s": { cells: [point(1, 0), point(2, 0), point(0, 1), point(1, 1)], size: 4 },
  "tetromino-z": { cells: [point(0, 0), point(1, 0), point(1, 1), point(2, 1)], size: 4 },
  "tetromino-j": { cells: [point(0, 0), point(0, 1), point(1, 1), point(2, 1)], size: 4 },
  "tetromino-l": { cells: [point(2, 0), point(0, 1), point(1, 1), point(2, 1)], size: 4 },
  "triomino-i": { cells: [point(0, 0), point(1, 0), point(2, 0)], size: 3 },
  "triomino-l": { cells: [point(0, 0), point(0, 1), point(1, 1)], size: 3 },
  domino: { cells: [point(0, 0), point(1, 0)], size: 2 },
  single: { cells: [point(0, 0)], size: 1 },
};

describe("shapes", () => {
  it("pins all eleven canonical footprints and their sizes", () => {
    expect(SHAPE_IDS).toEqual(Object.keys(FOOTPRINTS));
    for (const shapeId of SHAPE_IDS) {
      const expected = FOOTPRINTS[shapeId];
      expect(SHAPES[shapeId].id).toBe(shapeId);
      expect(sorted(SHAPES[shapeId].cells)).toEqual(sorted(expected.cells));
      expect(sizeOf(SHAPES[shapeId])).toBe(expected.size);
      expect(Math.min(...SHAPES[shapeId].cells.map(({ x }) => x))).toBe(0);
      expect(Math.min(...SHAPES[shapeId].cells.map(({ y }) => y))).toBe(0);
    }
  });

  it("keeps every registry shape legal on the current 3×3 board in every rotation", () => {
    const registryShapes = new Set(MOD_IDS.map((mod) => REGISTRY[mod].shape));
    for (const shapeId of registryShapes) {
      for (const rotation of ROTATIONS) {
        const cells = shapeCells(shapeId, rotation);
        expect(cells).toHaveLength(sizeOf(SHAPES[shapeId]));
        expect(new Set(cells.map(key)).size).toBe(cells.length);
        expect(Math.min(...cells.map(({ x }) => x))).toBe(0);
        expect(Math.min(...cells.map(({ y }) => y))).toBe(0);
        const [width, height] = shapeSize(cells);
        expect(width).toBeLessThanOrEqual(BOARD_WIDTH);
        expect(height).toBeLessThanOrEqual(BOARD_HEIGHT);
      }
    }
  });

  it("turn clockwise, and four turns come back where they started", () => {
    expect(shapeCells("domino", 1)).toEqual([point(0, 0), point(0, 1)]);
    // ▪·      ▪▪
    // ▪▪  →   ▪·   (the L triomino's corner cell moves from bottom-left to top-left)
    expect(sorted(shapeCells("triomino-l", 1))).toEqual(sorted([point(0, 0), point(1, 0), point(0, 1)]));
    expect(sorted(shapeCells("tetromino-t", 2))).toEqual(sorted([point(1, 0), point(0, 1), point(1, 1), point(2, 1)]));
    for (const shape of SHAPE_IDS) {
      let rotation: Rotation = 0;
      for (let turn = 0; turn < 4; turn++) rotation = nextRotation(rotation);
      expect(shapeCells(shape, rotation)).toEqual(shapeCells(shape, 0));
    }
  });

  it("keep their cell order through a turn, so a grabbed cell stays grabbed", () => {
    // Cell 0 of the straight triomino is its left end; turned once it is the top end.
    expect(shapeCells("triomino-i", 0)[0]).toEqual(point(0, 0));
    expect(shapeCells("triomino-i", 1)[0]).toEqual(point(0, 0));
    expect(shapeCells("triomino-i", 1)[2]).toEqual(point(0, 2));
  });
});

describe("the grid", () => {
  it("is three lanes: Strike, Tech and Block from the top", () => {
    expect(LANES).toEqual(["strike", "tech", "block"]);
    expect(BOARD_HEIGHT).toBe(LANES.length);
  });

  it("accepts a placement only when every cell is on the board and empty", () => {
    const grid = Object.freeze(blockers([point(1, 1)]));
    expect(canPlace(grid, { mod: "furnace", rotation: 0, x: 0, y: 0 })).toBe(true);
    expect(canPlace(grid, { mod: "furnace", rotation: 0, x: 0, y: 1 })).toBe(false);
    expect(canPlace(grid, { mod: "furnace", rotation: 0, x: 2, y: 0 })).toBe(false);
    expect(canPlace(grid, { mod: "furnace", rotation: 1, x: 2, y: 2 })).toBe(false);
    expect(canPlace(grid, { mod: "heat-coil", rotation: 0, x: -1, y: 0 })).toBe(false);
    expect(canPlace(grid, { mod: "heat-coil", rotation: 0, x: 0.5, y: 0 })).toBe(false);
    // A piece can always be checked against its own old position.
    expect(canPlace(grid, { mod: "heat-coil", rotation: 0, x: 1, y: 1 }, 100)).toBe(true);
  });

  it("places, refuses and removes without editing the grid it was given", () => {
    const empty: Grid = Object.freeze([]);
    const one = place(empty, { uid: 1, mod: "chain-circuit", stars: 1, rotation: 0, x: 0, y: 2 })!;
    expect(one).toHaveLength(1);
    expect(empty).toHaveLength(0);
    expect(place(one, { uid: 2, mod: "heat-coil", stars: 1, rotation: 0, x: 1, y: 2 })).toBeNull();
    expect(place(one, { uid: 1, mod: "heat-coil", stars: 1, rotation: 0, x: 0, y: 0 })).toBeNull();
    expect(cellsOf(one[0]).map(key)).toEqual(["0,2", "1,2", "2,2"]);
    expect(removeFromGrid(one, 1)).toEqual([]);
    expect(one).toHaveLength(1);
  });

  it("fits a mod at the first legal spot in reading order, trying other rotations when it must", () => {
    expect(firstFit([], "chain-circuit")).toEqual({ mod: "chain-circuit", rotation: 0, x: 0, y: 0 });
    const columns = blockers([point(1, 0), point(1, 1), point(1, 2), point(2, 0), point(2, 1), point(2, 2)]);
    expect(firstFit(columns, "chain-circuit")).toEqual({ mod: "chain-circuit", rotation: 1, x: 0, y: 0 });
    expect(firstFit(blockers(ALL_CELLS), "heat-coil")).toBeNull();
  });
});

describe("rotating a placed mod", () => {
  it("succeeds exactly when the turned piece is legal where it stands, for every mod, rotation, position and neighbour", () => {
    let cases = 0;
    let refused = 0;
    for (const mod of MOD_IDS as readonly ModId[]) {
      for (const rotation of ROTATIONS) {
        for (const { x, y } of ALL_CELLS) {
          const piece: PlacedMod = { uid: 1, mod, stars: 1, rotation, x, y };
          const own = cellsOf(piece);
          if (!own.every(({ x: cx, y: cy }) => cx < BOARD_WIDTH && cy < BOARD_HEIGHT)) continue;
          const free = ALL_CELLS.filter((cell) => !own.some((mine) => key(mine) === key(cell)));
          // Every subset of the other cells, each filled by a neighbour.
          for (let mask = 0; mask < 1 << free.length; mask++) {
            const neighbours = blockers(free.filter((_, index) => mask & (1 << index)));
            const grid: Grid = Object.freeze([piece, ...neighbours]);
            const turned = cellsOf({ mod, rotation: nextRotation(rotation), x, y });
            const taken = new Set(neighbours.map((neighbour) => key(neighbour)));
            const legal = turned.every(({ x: cx, y: cy }) => cx >= 0 && cy >= 0 && cx < BOARD_WIDTH && cy < BOARD_HEIGHT && !taken.has(key(point(cx, cy))));
            const result = rotateInPlace(grid, 1);
            const where = `${mod} r${rotation} at ${x},${y} with ${neighbours.map((neighbour) => `${neighbour.x},${neighbour.y}`).join(" ")}`;
            if (legal) {
              const turnedPiece = result?.find((placed) => placed.uid === 1);
              const others = result?.filter((placed) => placed.uid !== 1) ?? [];
              const kept = others.length === neighbours.length && others.every((other, index) => other === neighbours[index]);
              if (turnedPiece?.rotation !== nextRotation(rotation) || turnedPiece.x !== x || turnedPiece.y !== y || !kept) {
                expect.fail(`${where}: a legal turn was refused or moved something`);
              }
            } else {
              if (result !== null) expect.fail(`${where}: an illegal turn was allowed`);
              refused++;
            }
            if (grid[0] !== piece || piece.rotation !== rotation) expect.fail(`${where}: the grid it was given changed`);
            cases++;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(50_000);
    expect(refused).toBeGreaterThan(0);
  });

  it("refuses a piece that is not there", () => {
    expect(rotateInPlace(blockers([point(0, 0)]), 7)).toBeNull();
  });

  it("is always the same mod, only turned", () => {
    for (const mod of MOD_IDS) expect(REGISTRY[mod].shape in SHAPES).toBe(true);
  });
});

describe("the bank", () => {
  it("is four slots, each holding any one mod", () => {
    const bank = emptyBank();
    expect(bank).toEqual([null, null, null, null]);
    expect(BANK_SIZE).toBe(4);
    const full = MOD_IDS.slice(0, 4).reduce((slots, mod, index) => setBankSlot(slots, index, { uid: index + 1, mod, stars: 1, rotation: 0 }), bank);
    expect(firstFreeBankSlot(full)).toBeNull();
    expect(firstFreeBankSlot(setBankSlot(full, 2, null))).toBe(2);
    expect(Object.isFrozen(full)).toBe(true);
    expect(bank).toEqual([null, null, null, null]);
  });
});
