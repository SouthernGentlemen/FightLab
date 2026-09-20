import { REGISTRY } from "./registry.ts";
import type { ModId } from "./registry.ts";
import { SHAPES, cellsAt, nextRotation, normalise, normaliseRotation, orientations } from "./shapes.ts";
import type { GridPoint, Rotation } from "./shapes.ts";
import type { Stars } from "./stars.ts";

export const BOARD_WIDTH = 4;
export const BOARD_HEIGHT = 4;
export const BANK_SIZE = 4;

/** A mod the player owns, at its star level. `uid` tells two of the same mod apart. */
export interface OwnedMod {
  readonly uid: number;
  readonly mod: ModId;
  readonly stars: Stars;
  readonly rotation: Rotation;
}

/** An owned mod on the grid, its bounding box's top-left cell at `(x, y)`. */
export interface PlacedMod extends OwnedMod {
  readonly x: number;
  readonly y: number;
}

export type Grid = readonly PlacedMod[];
export type Bank = readonly (OwnedMod | null)[];

export interface Placement {
  readonly mod: ModId;
  readonly rotation: Rotation;
  readonly x: number;
  readonly y: number;
}

function canonicalRotation(mod: ModId, rotation: Rotation): Rotation {
  return normaliseRotation(SHAPES[REGISTRY[mod].shape], rotation);
}

export function cellsOf(placement: Placement): GridPoint[] {
  return cellsAt(SHAPES[REGISTRY[placement.mod].shape], placement.rotation)
    .map(({ x, y }) => ({ x: placement.x + x, y: placement.y + y }));
}

function onBoard({ x, y }: GridPoint): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT;
}

/** A pure clockwise quarter turn around one occupied board cell. */
export function turnCellsAbout(cells: readonly GridPoint[], pivot: GridPoint): GridPoint[] {
  return cells.map(({ x, y }) => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return { x: pivot.x - dy, y: pivot.y + dx };
  });
}

function sameCells(left: readonly GridPoint[], right: readonly GridPoint[]): boolean {
  if (left.length !== right.length) return false;
  const key = (cells: readonly GridPoint[]) => normalise(cells).map(({ x, y }) => `${x},${y}`).join(";");
  return key(left) === key(right);
}

/**
 * Turns a placement a quarter clockwise about one of its occupied board cells. The pivot stays at the
 * same board coordinate; the returned top-left and rotation describe the turned canonical footprint.
 * A shape with only one distinct orientation (O or single) does not move.
 */
export function turnAbout(placement: Placement, pivot: GridPoint): Placement | null {
  const shape = SHAPES[REGISTRY[placement.mod].shape];
  const rotation = canonicalRotation(placement.mod, placement.rotation);
  const current: Placement = { ...placement, rotation };
  const cells = cellsOf(current);
  if (!cells.some(({ x, y }) => x === pivot.x && y === pivot.y)) return null;

  const next = canonicalRotation(placement.mod, nextRotation(rotation));
  if (next === rotation) return current;

  const turned = turnCellsAbout(cells, pivot);
  const match = orientations(shape).find(({ cells: orientation }) => sameCells(orientation, turned));
  if (!match) return null;
  return {
    ...placement,
    rotation: match.rotation,
    x: Math.min(...turned.map(({ x }) => x)),
    y: Math.min(...turned.map(({ y }) => y)),
  };
}

/** Which placed mod covers each cell, by `"x,y"`, ignoring the mod `except` so it can move over itself. */
export function occupancy(grid: Grid, except: number | null = null): Map<string, PlacedMod> {
  const owners = new Map<string, PlacedMod>();
  for (const placed of grid) {
    if (placed.uid === except) continue;
    for (const { x, y } of cellsOf(placed)) owners.set(`${x},${y}`, placed);
  }
  return owners;
}

/** Legal against an occupancy already worked out: every cell on the board and empty. */
export function fits(taken: ReadonlyMap<string, PlacedMod>, placement: Placement): boolean {
  return cellsOf(placement).every((cell) => onBoard(cell) && !taken.has(`${cell.x},${cell.y}`));
}

/** Legal when every cell is on the board and empty. */
export function canPlace(grid: Grid, placement: Placement, except: number | null = null): boolean {
  return fits(occupancy(grid, except), placement);
}

/** The grid with `placed` added, or null when the placement is not legal. */
export function place(grid: Grid, placed: PlacedMod): Grid | null {
  if (grid.some((other) => other.uid === placed.uid)) return null;
  const normalised = { ...placed, rotation: canonicalRotation(placed.mod, placed.rotation) };
  if (!canPlace(grid, normalised)) return null;
  return Object.freeze([...grid, Object.freeze(normalised)]);
}

export function removeFromGrid(grid: Grid, uid: number): Grid {
  return Object.freeze(grid.filter((placed) => placed.uid !== uid));
}

/**
 * The grid with `uid` turned a quarter clockwise about `pivot`, or about its first cell when no
 * pivot is supplied. A refused turn changes nothing.
 */
export function rotateInPlace(grid: Grid, uid: number, pivot?: GridPoint): Grid | null {
  const placed = grid.find((candidate) => candidate.uid === uid);
  if (!placed) return null;
  const anchor = pivot ?? cellsOf(placed)[0];
  const turned = turnAbout(placed, anchor);
  if (turned === null || !canPlace(grid, turned, uid)) return null;
  const next: PlacedMod = { ...placed, ...turned };
  return Object.freeze(grid.map((candidate) => (candidate.uid === uid ? Object.freeze(next) : candidate)));
}

/** The first legal placement in reading order, trying the given rotation first and then the rest. */
export function firstFit(grid: Grid, mod: ModId, preferred: Rotation = 0): Placement | null {
  const shape = SHAPES[REGISTRY[mod].shape];
  const first = normaliseRotation(shape, preferred);
  for (const rotation of [first, ...orientations(shape).map(({ rotation }) => rotation).filter((other) => other !== first)]) {
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const placement = { mod, rotation, x, y };
        if (canPlace(grid, placement)) return placement;
      }
    }
  }
  return null;
}

export function emptyBank(): Bank {
  return Object.freeze(Array.from({ length: BANK_SIZE }, () => null));
}

export function firstFreeBankSlot(bank: Bank): number | null {
  const slot = bank.indexOf(null);
  return slot < 0 ? null : slot;
}

export function setBankSlot(bank: Bank, slot: number, owned: OwnedMod | null): Bank {
  const next = [...bank];
  next[slot] = owned && Object.freeze({
    uid: owned.uid,
    mod: owned.mod,
    stars: owned.stars,
    rotation: canonicalRotation(owned.mod, owned.rotation),
  });
  return Object.freeze(next);
}
