import { describe, expect, it } from "vitest";

import { CATALOG, MOD_IDS } from "../../src/mods/catalog.ts";
import type { ModId } from "../../src/mods/catalog.ts";
import {
  BANK_SIZE, GRID_SIZE, LANES, canPlace, cellsOf, emptyBank, firstFit, firstFreeBankSlot, place, removeFromGrid, rotateInPlace,
  setBankSlot,
} from "../../src/mods/grid.ts";
import type { Grid, PlacedMod } from "../../src/mods/grid.ts";
import { ROTATIONS, SHAPES, SHAPE_IDS, nextRotation, shapeCells, shapeSize } from "../../src/mods/shapes.ts";
import type { Rotation } from "../../src/mods/shapes.ts";

const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
const sorted = (cells: ReadonlyArray<readonly [number, number]>) => cells.map(key).sort();

/** A grid of single-cell blockers on exactly these cells. */
function blockers(cells: ReadonlyArray<readonly [number, number]>, firstUid = 100): PlacedMod[] {
  return cells.map(([x, y], index) => ({ uid: firstUid + index, mod: "ember", rotation: 0, x, y }));
}

const ALL_CELLS: Array<[number, number]> = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => [index % GRID_SIZE, Math.floor(index / GRID_SIZE)]);

describe("shapes", () => {
  it("are polyominoes of one to four cells that fit a 3×3 board in every rotation", () => {
    for (const shape of SHAPE_IDS) {
      for (const rotation of ROTATIONS) {
        const cells = shapeCells(shape, rotation);
        expect(cells).toHaveLength(SHAPES[shape].length);
        expect(new Set(cells.map(key)).size).toBe(cells.length);
        expect(Math.min(...cells.map(([x]) => x))).toBe(0);
        expect(Math.min(...cells.map(([, y]) => y))).toBe(0);
        const [width, height] = shapeSize(cells);
        expect(width).toBeLessThanOrEqual(GRID_SIZE);
        expect(height).toBeLessThanOrEqual(GRID_SIZE);
      }
    }
  });

  it("turn clockwise, and four turns come back where they started", () => {
    expect(shapeCells("duo", 1)).toEqual([[0, 0], [0, 1]]);
    // ▪·      ▪▪
    // ▪▪  →   ▪·   (the L3's corner cell moves from bottom-left to top-left)
    expect(sorted(shapeCells("l3", 1))).toEqual(sorted([[0, 0], [1, 0], [0, 1]]));
    expect(sorted(shapeCells("t4", 2))).toEqual(sorted([[1, 0], [0, 1], [1, 1], [2, 1]]));
    for (const shape of SHAPE_IDS) {
      let rotation: Rotation = 0;
      for (let turn = 0; turn < 4; turn++) rotation = nextRotation(rotation);
      expect(shapeCells(shape, rotation)).toEqual(shapeCells(shape, 0));
    }
  });

  it("keep their cell order through a turn, so a grabbed cell stays grabbed", () => {
    // Cell 0 of an I3 is its left end; turned once it is the top end.
    expect(shapeCells("i3", 0)[0]).toEqual([0, 0]);
    expect(shapeCells("i3", 1)[0]).toEqual([0, 0]);
    expect(shapeCells("i3", 1)[2]).toEqual([0, 2]);
  });
});

describe("the grid", () => {
  it("is three lanes: Strike, Tech and Block from the top", () => {
    expect(LANES).toEqual(["strike", "tech", "block"]);
  });

  it("accepts a placement only when every cell is on the board and empty", () => {
    const grid = Object.freeze(blockers([[1, 1]]));
    expect(canPlace(grid, { mod: "sunburst", rotation: 0, x: 0, y: 0 })).toBe(true);
    expect(canPlace(grid, { mod: "sunburst", rotation: 0, x: 0, y: 1 })).toBe(false);
    expect(canPlace(grid, { mod: "sunburst", rotation: 0, x: 2, y: 0 })).toBe(false);
    expect(canPlace(grid, { mod: "sunburst", rotation: 1, x: 2, y: 2 })).toBe(false);
    expect(canPlace(grid, { mod: "ember", rotation: 0, x: -1, y: 0 })).toBe(false);
    expect(canPlace(grid, { mod: "ember", rotation: 0, x: 0.5, y: 0 })).toBe(false);
    // A piece can always be checked against its own old position.
    expect(canPlace(grid, { mod: "ember", rotation: 0, x: 1, y: 1 }, 100)).toBe(true);
  });

  it("places, refuses and removes without editing the grid it was given", () => {
    const empty: Grid = Object.freeze([]);
    const one = place(empty, { uid: 1, mod: "static", rotation: 0, x: 0, y: 2 })!;
    expect(one).toHaveLength(1);
    expect(empty).toHaveLength(0);
    expect(place(one, { uid: 2, mod: "ember", rotation: 0, x: 1, y: 2 })).toBeNull();
    expect(place(one, { uid: 1, mod: "ember", rotation: 0, x: 0, y: 0 })).toBeNull();
    expect(cellsOf(one[0]).map(key)).toEqual(["0,2", "1,2", "2,2"]);
    expect(removeFromGrid(one, 1)).toEqual([]);
    expect(one).toHaveLength(1);
  });

  it("fits a mod at the first legal spot in reading order, trying other rotations when it must", () => {
    expect(firstFit([], "static")).toEqual({ mod: "static", rotation: 0, x: 0, y: 0 });
    const columns = blockers([[1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]);
    expect(firstFit(columns, "static")).toEqual({ mod: "static", rotation: 1, x: 0, y: 0 });
    expect(firstFit(blockers(ALL_CELLS), "ember")).toBeNull();
  });
});

describe("rotating a placed mod", () => {
  it("succeeds exactly when the turned piece is legal where it stands, for every mod, rotation, position and neighbour", () => {
    let cases = 0;
    let refused = 0;
    for (const mod of MOD_IDS as readonly ModId[]) {
      for (const rotation of ROTATIONS) {
        for (const [x, y] of ALL_CELLS) {
          const piece: PlacedMod = { uid: 1, mod, rotation, x, y };
          const own = cellsOf(piece);
          if (!own.every(([cx, cy]) => cx < GRID_SIZE && cy < GRID_SIZE)) continue;
          const free = ALL_CELLS.filter((cell) => !own.some((mine) => key(mine) === key(cell)));
          // Every subset of the other cells, each filled by a neighbour.
          for (let mask = 0; mask < 1 << free.length; mask++) {
            const neighbours = blockers(free.filter((_, index) => mask & (1 << index)));
            const grid: Grid = Object.freeze([piece, ...neighbours]);
            const turned = cellsOf({ mod, rotation: nextRotation(rotation), x, y });
            const taken = new Set(neighbours.map((neighbour) => key([neighbour.x, neighbour.y])));
            const legal = turned.every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < GRID_SIZE && cy < GRID_SIZE && !taken.has(key([cx, cy])));
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
    expect(rotateInPlace(blockers([[0, 0]]), 7)).toBeNull();
  });

  it("is always the same mod, only turned", () => {
    for (const mod of MOD_IDS) expect(CATALOG[mod].shape in SHAPES).toBe(true);
  });
});

describe("the bank", () => {
  it("is four slots, each holding any one mod", () => {
    const bank = emptyBank();
    expect(bank).toEqual([null, null, null, null]);
    expect(BANK_SIZE).toBe(4);
    const full = MOD_IDS.slice(0, 4).reduce((slots, mod, index) => setBankSlot(slots, index, { uid: index + 1, mod, rotation: 0 }), bank);
    expect(firstFreeBankSlot(full)).toBeNull();
    expect(firstFreeBankSlot(setBankSlot(full, 2, null))).toBe(2);
    expect(Object.isFrozen(full)).toBe(true);
    expect(bank).toEqual([null, null, null, null]);
  });
});
