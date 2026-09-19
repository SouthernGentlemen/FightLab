import { describe, expect, it } from "vitest";

import {
  adjacencyGraph,
  areAdjacent,
  getAdjacentMods,
  occupiedCells,
  sharedEdges,
} from "../../src/mods/adjacency.ts";
import type { Grid, PlacedMod } from "../../src/mods/grid.ts";

function single(uid: number, x: number, y: number): PlacedMod {
  return { uid, mod: "heat-coil", stars: 1, rotation: 0, x, y };
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
    const vertical: PlacedMod = { uid: 1, mod: "chain-circuit", stars: 1, rotation: 90, x: 0, y: 0 };
    const neighbour = single(2, 1, 2);

    expect(occupiedCells(vertical)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
    expect(sharedEdges(vertical, neighbour)).toBe(1);
    expect(areAdjacent(vertical, neighbour)).toBe(true);

    const flat: PlacedMod = { ...vertical, rotation: 0 };
    expect(sharedEdges(flat, neighbour)).toBe(0);
    expect(areAdjacent(flat, neighbour)).toBe(false);
  });

  it("keeps one relationship when several cell edges are shared", () => {
    const square: PlacedMod = { uid: 1, mod: "singularity", stars: 1, rotation: 0, x: 0, y: 0 };
    const side: PlacedMod = { uid: 2, mod: "cinder-edge", stars: 1, rotation: 90, x: 2, y: 0 };
    const graph = adjacencyGraph(Object.freeze([square, side]));

    expect(sharedEdges(square, side)).toBe(2);
    expect(areAdjacent(square, side)).toBe(true);
    expect(graph.edges(1, 2)).toBe(2);
    expect(graph.edges(2, 1)).toBe(2);
    expect(graph.neighbours(1)).toEqual([2]);
    expect(getAdjacentMods(graph, 1)).toEqual([2]);
  });

  it("builds a symmetric graph and never neighbours a piece with itself", () => {
    const grid: Grid = Object.freeze([
      single(3, 2, 2),
      single(1, 0, 0),
      single(2, 1, 0),
    ]);
    const graph = adjacencyGraph(grid);

    expect(graph.neighbours(1)).toEqual([2]);
    expect(graph.neighbours(2)).toEqual([1]);
    expect(graph.neighbours(3)).toEqual([]);
    expect(graph.neighbours(1)).not.toContain(1);
    expect(graph.neighbours(2)).not.toContain(2);
    expect(graph.neighbours(3)).not.toContain(3);
    expect(graph.edges(1, 1)).toBe(0);
    expect(graph.edges(3, 3)).toBe(0);
  });
});
