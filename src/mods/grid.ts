import type { ActionType } from "../battle/actions.ts";
import { CATALOG } from "./catalog.ts";
import type { ModId } from "./catalog.ts";
import { ROTATIONS, nextRotation, shapeCells } from "./shapes.ts";
import type { Cell, Rotation } from "./shapes.ts";

export const GRID_SIZE = 3;
export const BANK_SIZE = 4;

/** Row y of the grid is the lane of `LANES[y]`: a cell powers the action of the row it sits in. */
export const LANES: readonly ActionType[] = Object.freeze(["strike", "tech", "block"]);

/** A mod the player owns. `uid` tells two copies of the same mod apart. */
export interface OwnedMod {
  readonly uid: number;
  readonly mod: ModId;
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

export function cellsOf(placement: Placement): Cell[] {
  return shapeCells(CATALOG[placement.mod].shape, placement.rotation).map(([dx, dy]) => [placement.x + dx, placement.y + dy]);
}

function onBoard([x, y]: Cell): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

/** Which placed mod covers each cell, by `"x,y"`, ignoring the mod `except` so it can move over itself. */
export function occupancy(grid: Grid, except: number | null = null): Map<string, PlacedMod> {
  const owners = new Map<string, PlacedMod>();
  for (const placed of grid) {
    if (placed.uid === except) continue;
    for (const [x, y] of cellsOf(placed)) owners.set(`${x},${y}`, placed);
  }
  return owners;
}

/** Legal against an occupancy already worked out: every cell on the board and empty. */
export function fits(taken: ReadonlyMap<string, PlacedMod>, placement: Placement): boolean {
  return cellsOf(placement).every((cell) => onBoard(cell) && !taken.has(`${cell[0]},${cell[1]}`));
}

/** Legal when every cell is on the board and empty. */
export function canPlace(grid: Grid, placement: Placement, except: number | null = null): boolean {
  return fits(occupancy(grid, except), placement);
}

/** The grid with `placed` added, or null when the placement is not legal. */
export function place(grid: Grid, placed: PlacedMod): Grid | null {
  if (grid.some((other) => other.uid === placed.uid) || !canPlace(grid, placed)) return null;
  return Object.freeze([...grid, Object.freeze({ ...placed })]);
}

export function removeFromGrid(grid: Grid, uid: number): Grid {
  return Object.freeze(grid.filter((placed) => placed.uid !== uid));
}

/**
 * The grid with `uid` turned a quarter clockwise where it stands — the top-left of its bounding box
 * stays put — or null when that placement would not be legal. A refused rotation changes nothing.
 */
export function rotateInPlace(grid: Grid, uid: number): Grid | null {
  const placed = grid.find((candidate) => candidate.uid === uid);
  if (!placed) return null;
  const turned: PlacedMod = { ...placed, rotation: nextRotation(placed.rotation) };
  if (!canPlace(grid, turned, uid)) return null;
  return Object.freeze(grid.map((candidate) => (candidate.uid === uid ? Object.freeze(turned) : candidate)));
}

/** The first legal placement in reading order, trying the given rotation first and then the rest. */
export function firstFit(grid: Grid, mod: ModId, preferred: Rotation = 0): Placement | null {
  for (const rotation of [preferred, ...ROTATIONS.filter((other) => other !== preferred)]) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
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
  next[slot] = owned && Object.freeze({ uid: owned.uid, mod: owned.mod, rotation: owned.rotation });
  return Object.freeze(next);
}
