import { cellsOf, occupancy } from "./grid.ts";

export interface AdjacencyGraph {
  neighbours(uid: number): readonly number[];
  edges(a: number, b: number): number;
}

const EMPTY: readonly number[] = Object.freeze([]);

function pairKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

/** Occupied board cells after the placement's stored rotation is applied. */
export function occupiedCells(placed: import("./grid.ts").PlacedMod): readonly import("./shapes.ts").GridPoint[] {
  return cellsOf(placed);
}

/** Number of orthogonal cell-edge contacts between two placed mods. */
export function sharedEdges(
  a: import("./grid.ts").PlacedMod,
  b: import("./grid.ts").PlacedMod,
): number {
  const bCells = new Set(occupiedCells(b).map(({ x, y }) => `${x},${y}`));
  let count = 0;
  for (const { x, y } of occupiedCells(a)) {
    if (bCells.has(`${x + 1},${y}`)) count++;
    if (bCells.has(`${x - 1},${y}`)) count++;
    if (bCells.has(`${x},${y + 1}`)) count++;
    if (bCells.has(`${x},${y - 1}`)) count++;
  }
  return count;
}

export function areAdjacent(
  a: import("./grid.ts").PlacedMod,
  b: import("./grid.ts").PlacedMod,
): boolean {
  return sharedEdges(a, b) > 0;
}

/** Build neighbour and shared-edge lookups once from the grid occupancy. */
export function adjacencyGraph(grid: import("./grid.ts").Grid): AdjacencyGraph {
  const owners = occupancy(grid);
  const neighbours = new Map<number, Set<number>>();
  const edgeCounts = new Map<string, number>();

  for (const placed of grid) neighbours.set(placed.uid, new Set());

  for (const [key, owner] of owners) {
    const [x, y] = key.split(",").map(Number);
    for (const neighbourKey of [`${x + 1},${y}`, `${x},${y + 1}`]) {
      const other = owners.get(neighbourKey);
      if (!other || other.uid === owner.uid) continue;
      neighbours.get(owner.uid)!.add(other.uid);
      neighbours.get(other.uid)!.add(owner.uid);
      const pair = pairKey(owner.uid, other.uid);
      edgeCounts.set(pair, (edgeCounts.get(pair) ?? 0) + 1);
    }
  }

  const lists = new Map(
    [...neighbours].map(([uid, adjacent]) => [uid, Object.freeze([...adjacent].sort((a, b) => a - b))] as const),
  );

  return Object.freeze({
    neighbours: (uid: number): readonly number[] => lists.get(uid) ?? EMPTY,
    edges: (a: number, b: number): number => a === b ? 0 : edgeCounts.get(pairKey(a, b)) ?? 0,
  });
}

export function getAdjacentMods(graph: AdjacencyGraph, uid: number): readonly number[] {
  return graph.neighbours(uid);
}
