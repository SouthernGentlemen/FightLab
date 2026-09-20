import { describe, expect, it } from "vitest";

import { DEFINITIONS, MOD_IDS, REGISTRY } from "../../src/mods/registry.ts";
import type { ModId } from "../../src/mods/registry.ts";
import {
  BANK_SIZE, BOARD_HEIGHT, BOARD_WIDTH, canPlace, cellsOf, emptyBank, firstFit, firstFreeBankSlot, place, removeFromGrid, rotateInPlace,
  setBankSlot, turnAbout, turnCellsAbout,
} from "../../src/mods/grid.ts";
import type { Grid, PlacedMod } from "../../src/mods/grid.ts";
import { ROTATIONS, SHAPES, SHAPE_IDS, cellsAt, nextRotation, normalise, orientations, shapeCells, sizeOf } from "../../src/mods/shapes.ts";
import type { GridPoint, Rotation, ShapeId } from "../../src/mods/shapes.ts";
import { pick, placement, registryFixture } from "./fixtures.ts";

const point = (x: number, y: number): GridPoint => ({ x, y });
const key = ({ x, y }: GridPoint) => `${x},${y}`;
const sorted = (cells: readonly GridPoint[]) => cells.map(key).sort();
const SINGLE = pick({ size: 1 });
const DOMINO = pick({ size: 2 });
const STRAIGHT_TRIOMINO = registryFixture(DEFINITIONS.find(({ shape }) => shape === "triomino-i"));
const O_MOD = registryFixture(DEFINITIONS.find(({ shape }) => shape === "tetromino-o"));

/** A grid of single-cell blockers on exactly these cells. */
function blockers(cells: readonly GridPoint[], firstUid = 100): PlacedMod[] {
  return cells.map(({ x, y }, index) => ({ uid: firstUid + index, mod: SINGLE.id, stars: 1, rotation: 0, x, y }));
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

  it("places every orientation of all eleven library shapes on the empty 4×4 board", () => {
    expect([BOARD_WIDTH, BOARD_HEIGHT]).toEqual([4, 4]);
    let checked = 0;
    for (const shapeId of SHAPE_IDS) {
      for (const { rotation, cells } of orientations(SHAPES[shapeId])) {
        const legal = ALL_CELLS.some(({ x, y }) =>
          cells.every((cell) => x + cell.x < BOARD_WIDTH && y + cell.y < BOARD_HEIGHT));
        expect(legal, `${shapeId} at ${rotation}°`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(28);
  });

  it("turn clockwise, and four turns come back where they started", () => {
    expect(shapeCells("domino", 90)).toEqual([point(0, 0), point(0, 1)]);
    // ▪·      ▪▪
    // ▪▪  →   ▪·   (the L triomino's corner cell moves from bottom-left to top-left)
    expect(sorted(shapeCells("triomino-l", 90))).toEqual(sorted([point(0, 0), point(1, 0), point(0, 1)]));
    expect(sorted(shapeCells("tetromino-t", 180))).toEqual(sorted([point(1, 0), point(0, 1), point(1, 1), point(2, 1)]));
    for (const shape of SHAPE_IDS) {
      let rotation: Rotation = 0;
      for (let turn = 0; turn < 4; turn++) rotation = nextRotation(rotation);
      expect(shapeCells(shape, rotation)).toEqual(shapeCells(shape, 0));
    }
  });

  it("keep their cell order through a turn, so a grabbed cell stays grabbed", () => {
    // Cell 0 of the straight triomino is its left end; turned once it is the top end.
    expect(shapeCells("triomino-i", 0)[0]).toEqual(point(0, 0));
    expect(shapeCells("triomino-i", 90)[0]).toEqual(point(0, 0));
    expect(shapeCells("triomino-i", 90)[2]).toEqual(point(0, 2));
  });
});

describe("turning about a board cell", () => {
  it("keeps every pivot fixed through every shape and orientation, and four turns return the cells", () => {
    for (const shapeId of SHAPE_IDS) {
      const shape = SHAPES[shapeId];
      for (const rotation of ROTATIONS) {
        const start = cellsAt(shape, rotation).map(({ x, y }) => point(x + 7, y + 9));
        for (const pivot of start) {
          const once = turnCellsAbout(start, pivot);
          expect(once).toContainEqual(pivot);
          expect(sorted(normalise(once))).toEqual(sorted(cellsAt(shape, nextRotation(rotation))));
          let round = start;
          for (let turn = 0; turn < 4; turn++) round = turnCellsAbout(round, pivot);
          expect(sorted(round)).toEqual(sorted(start));
        }
      }
    }
  });

  it("keeps the grabbed board cell occupied for every registry placement", () => {
    for (const mod of MOD_IDS) {
      for (const rotation of ROTATIONS) {
        const placed = { mod, rotation, x: 7, y: 9 };
        for (const pivot of cellsOf(placed)) {
          const turned = turnAbout(placed, pivot);
          expect(turned).not.toBeNull();
          expect(cellsOf(turned!)).toContainEqual(pivot);
        }
      }
    }
  });

  it("does not move or rotate an O, whichever occupied cell is the pivot", () => {
    const placed = placement([O_MOD, 1, 1]);
    for (const pivot of cellsOf(placed)) expect(turnAbout(placed, pivot)).toEqual(placed);
  });
});

describe("the grid", () => {
  it("accepts a placement only when every cell is on the board and empty", () => {
    const grid = Object.freeze(blockers([point(1, 1)]));
    expect(canPlace(grid, placement([DOMINO, 0, 0]))).toBe(true);
    expect(canPlace(grid, placement([DOMINO, 0, 1]))).toBe(false);
    expect(canPlace(grid, placement([DOMINO, 3, 0]))).toBe(false);
    expect(canPlace(grid, placement([DOMINO, 3, 3, 90]))).toBe(false);
    expect(canPlace(grid, placement([SINGLE, -1, 0]))).toBe(false);
    expect(canPlace(grid, placement([SINGLE, 0.5, 0]))).toBe(false);
    // A piece can always be checked against its own old position.
    expect(canPlace(grid, placement([SINGLE, 1, 1]), 100)).toBe(true);
  });

  it("places, refuses and removes without editing the grid it was given", () => {
    const empty: Grid = Object.freeze([]);
    const one = place(empty, { uid: 1, stars: 1, ...placement([STRAIGHT_TRIOMINO, 0, 2]) })!;
    expect(one).toHaveLength(1);
    expect(empty).toHaveLength(0);
    expect(place(one, { uid: 2, stars: 1, ...placement([SINGLE, 1, 2]) })).toBeNull();
    expect(place(one, { uid: 1, stars: 1, ...placement([SINGLE, 0, 0]) })).toBeNull();
    expect(cellsOf(one[0]).map(key)).toEqual(["0,2", "1,2", "2,2"]);
    expect(removeFromGrid(one, 1)).toEqual([]);
    expect(one).toHaveLength(1);
  });

  it("fits a mod at the first legal spot in reading order, trying other rotations when it must", () => {
    expect(firstFit([], STRAIGHT_TRIOMINO.id)).toEqual({ mod: STRAIGHT_TRIOMINO.id, rotation: 0, x: 0, y: 0 });
    const columns = blockers([point(1, 0), point(1, 1), point(1, 2), point(1, 3), point(2, 0), point(2, 1), point(2, 2), point(2, 3)]);
    expect(firstFit(columns, STRAIGHT_TRIOMINO.id)).toEqual({ mod: STRAIGHT_TRIOMINO.id, rotation: 90, x: 0, y: 0 });
    expect(firstFit(blockers(ALL_CELLS), SINGLE.id)).toBeNull();
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
          // Collision is cell-local: cover empty, every possible single neighbour, and saturation.
          const neighbourSets = [[], ...free.map((cell) => [cell]), free] as readonly (readonly GridPoint[])[];
          for (const occupied of neighbourSets) {
            const neighbours = blockers(occupied);
            const grid: Grid = Object.freeze([piece, ...neighbours]);
            const pivot = own[0];
            const expected = turnAbout(piece, pivot)!;
            const turned = cellsOf(expected);
            const taken = new Set(neighbours.map((neighbour) => key(neighbour)));
            const legal = turned.every(({ x: cx, y: cy }) => cx >= 0 && cy >= 0 && cx < BOARD_WIDTH && cy < BOARD_HEIGHT && !taken.has(key(point(cx, cy))));
            const result = rotateInPlace(grid, 1);
            const where = `${mod} r${rotation} at ${x},${y} with ${neighbours.map((neighbour) => `${neighbour.x},${neighbour.y}`).join(" ")}`;
            if (legal) {
              const turnedPiece = result?.find((placed) => placed.uid === 1);
              const others = result?.filter((placed) => placed.uid !== 1) ?? [];
              const kept = others.length === neighbours.length && others.every((other, index) => other === neighbours[index]);
              if (turnedPiece?.rotation !== expected.rotation || turnedPiece.x !== expected.x || turnedPiece.y !== expected.y || !kept) {
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
    expect(cases).toBeGreaterThan(10_000);
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
