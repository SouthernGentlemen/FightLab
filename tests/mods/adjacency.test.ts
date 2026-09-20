import { describe, expect, it } from "vitest";

import {
  adjacencyGraph,
  areAdjacent,
  getAdjacentMods,
  occupiedCells,
  sharedEdges,
} from "../../src/mods/adjacency.ts";
import type { PlacedMod } from "../../src/mods/grid.ts";
import { ROTATIONS } from "../../src/mods/shapes.ts";
import type { ModDefinition, } from "../../src/mods/registry.ts";
import { pick, placement } from "./fixtures.ts";

const SINGLE = pick({ size: 1 });
const TRIOMINO = pick({ size: 3 });
const LARGE = pick({ size: 4 });
const DOMINO = pick({ size: 2 });

function piece(uid: number, definition: ModDefinition, x: number, y: number, rotation = 0): PlacedMod {
  return { uid, stars: 1, ...placement([definition, x, y, rotation as 0 | 90 | 180 | 270]) };
}

function single(uid: number, x: number, y: number): PlacedMod {
  return piece(uid, SINGLE, x, y);
}

function multiEdgePair(): readonly [PlacedMod, PlacedMod] {
  for (const firstRotation of ROTATIONS) {
    for (const secondRotation of ROTATIONS) {
      for (let ay = 0; ay < 4; ay++) for (let ax = 0; ax < 4; ax++) {
        const first = piece(1, LARGE, ax, ay, firstRotation);
        const firstCells = occupiedCells(first);
        if (firstCells.some(({ x, y }) => x < 0 || y < 0 || x >= 4 || y >= 4)) continue;
        for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
          const second = piece(2, DOMINO, bx, by, secondRotation);
          const secondCells = occupiedCells(second);
          if (secondCells.some(({ x, y }) => x < 0 || y < 0 || x >= 4 || y >= 4)) continue;
          const occupied = new Set(firstCells.map(({ x, y }) => `${x},${y}`));
          if (secondCells.some(({ x, y }) => occupied.has(`${x},${y}`))) continue;
          if (sharedEdges(first, second) > 1) return [first, second];
        }
      }
    }
  }
  throw new Error("fixture catalogue has no multi-edge adjacency pair");
}

describe("adjacency", () => {
  it("counts a shared horizontal edge as adjacent", () => {
    const a = single(1, 0, 0);
    const b = single(2, 1, 0);
    expect(sharedEdges(a, b)).toBe(1);
    expect(areAdjacent(a, b)).toBe(true);
  });

  it("counts a shared vertical edge as adjacent", () => {
    const a = single(1, 0, 0);
    const b = single(2, 0, 1);
    expect(sharedEdges(a, b)).toBe(1);
    expect(areAdjacent(a, b)).toBe(true);
  });

  it("does not count corner contact or separated pieces", () => {
    const origin = single(1, 0, 0);
    const corner = single(2, 1, 1);
    const apart = single(3, 2, 0);
    expect(sharedEdges(origin, corner)).toBe(0);
    expect(areAdjacent(origin, corner)).toBe(false);
    expect(sharedEdges(origin, apart)).toBe(0);
    expect(areAdjacent(origin, apart)).toBe(false);
  });

  it("uses the turned occupied cells of rotated pieces", () => {
    const vertical = piece(1, TRIOMINO, 0, 0, 90);
    const neighbour = single(2, 1, 2);
    expect(occupiedCells(vertical)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
    expect(sharedEdges(vertical, neighbour)).toBe(1);
    expect(areAdjacent(vertical, neighbour)).toBe(true);

    const flat = piece(1, TRIOMINO, 0, 0);
    expect(sharedEdges(flat, neighbour)).toBe(0);
    expect(areAdjacent(flat, neighbour)).toBe(false);
  });

  it("keeps one relationship when several cell edges are shared", () => {
    const [large, side] = multiEdgePair();
    const graph = adjacencyGraph(Object.freeze([large, side]));
    const edges = sharedEdges(large, side);
    expect(edges).toBeGreaterThan(1);
    expect(areAdjacent(large, side)).toBe(true);
    expect(graph.edges(1, 2)).toBe(edges);
    expect(graph.edges(2, 1)).toBe(edges);
    expect(graph.neighbours(1)).toEqual([2]);
    expect(getAdjacentMods(graph, 1)).toEqual([2]);
  });

  it("builds a symmetric graph and never neighbours a piece with itself", () => {
    const graph = adjacencyGraph(Object.freeze([single(3, 2, 2), single(1, 0, 0), single(2, 1, 0)]));
    expect(graph.neighbours(1)).toEqual([2]);
    expect(graph.neighbours(2)).toEqual([1]);
    expect(graph.neighbours(3)).toEqual([]);
    for (const uid of [1, 2, 3]) {
      expect(graph.neighbours(uid)).not.toContain(uid);
      expect(graph.edges(uid, uid)).toBe(0);
    }
  });
});
