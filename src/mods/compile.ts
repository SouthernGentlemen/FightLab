import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { CATALOG, ELEMENTS, isElement } from "./catalog.ts";
import type { Element } from "./catalog.ts";
import { GRID_SIZE, LANES, cellsOf, occupancy } from "./grid.ts";
import type { Grid, PlacedMod } from "./grid.ts";

/** Every three cells of one element on the grid is a level, up to three. */
export const CELLS_PER_LEVEL = 3;
export const MAX_LEVEL = 3;
/** What each level of an element is worth. */
export const SOLAR_DAMAGE_PER_LEVEL = 1;
export const VOID_HEALTH_PER_LEVEL = 10;
export const ARC_SURGE_PER_LEVEL = 2;

/**
 * A grid as the plain numbers the rest of the game needs. This is the only thing that reads what
 * a mod does, and every number in it is damage, health, healing or money — nothing here can
 * describe a frame, an action order or a bar.
 */
export interface Build {
  /** Lane power: what the grid's row for each action adds to that action's damage. */
  readonly lanes: Readonly<Record<ActionType, number>>;
  /** The element a lane is attuned to, when all three of its cells share one. */
  readonly attuned: Readonly<Record<ActionType, Element | null>>;
  readonly cells: Readonly<Record<Element, number>>;
  readonly levels: Readonly<Record<Element, number>>;
  /** Bonus damage on every hit of each action: lane, Solar level and perks. Block's is the riposte. */
  readonly damage: Readonly<Record<ActionType, number>>;
  /** Further bonus damage on every hit in a round entered with a Mixup: Arc levels and perks. */
  readonly surge: number;
  /** Added to the fighter's maximum health. */
  readonly health: number;
  readonly parryHeal: number;
  /** Dollars added to every payday. */
  readonly income: number;
  readonly freeRerolls: number;
  /** How many times the style payout is paid. */
  readonly styleMultiplier: number;
}

function perAction(value: (action: ActionType) => number): Record<ActionType, number> {
  return Object.fromEntries(ACTION_TYPES.map((action) => [action, value(action)])) as Record<ActionType, number>;
}

function perElement(value: (element: Element) => number): Record<Element, number> {
  return Object.fromEntries(ELEMENTS.map((element) => [element, value(element)])) as Record<Element, number>;
}

/** How many Overclocks touch `placed` — share an edge with one of its cells. */
function overclocksTouching(placed: PlacedMod, owners: ReadonlyMap<string, PlacedMod>): number {
  const touching = new Set<number>();
  for (const [x, y] of cellsOf(placed)) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = owners.get(`${x + dx},${y + dy}`);
      if (other && other.uid !== placed.uid && CATALOG[other.mod].perk?.kind === "overclock") touching.add(other.uid);
    }
  }
  return touching.size;
}

export function compileBuild(grid: Grid): Build {
  const owners = occupancy(grid);
  const boost = new Map(grid.map((placed) => [placed.uid, overclocksTouching(placed, owners)]));

  const lanes = perAction(() => 0);
  const attuned: Record<ActionType, Element | null> = { strike: null, tech: null, block: null };
  for (let y = 0; y < GRID_SIZE; y++) {
    const lane = LANES[y];
    const row = Array.from({ length: GRID_SIZE }, (_, x) => owners.get(`${x},${y}`) ?? null);
    const affinities = row.map((placed) => (placed ? CATALOG[placed.mod].affinity : null));
    const first = affinities[0];
    attuned[lane] = first && isElement(first) && affinities.every((affinity) => affinity === first) ? first : null;
    for (const placed of row) {
      if (!placed || !isElement(CATALOG[placed.mod].affinity)) continue;
      lanes[lane] += (attuned[lane] ? 2 : 1) + boost.get(placed.uid)!;
    }
  }

  const cells = perElement((element) =>
    grid.filter((placed) => CATALOG[placed.mod].affinity === element).reduce((sum, placed) => sum + cellsOf(placed).length, 0));
  const levels = perElement((element) => Math.min(MAX_LEVEL, Math.floor(cells[element] / CELLS_PER_LEVEL)));

  const perks = grid.map((placed) => CATALOG[placed.mod].perk).filter((perk) => perk !== null);
  const sum = (amount: (perk: (typeof perks)[number]) => number) => perks.reduce((total, perk) => total + amount(perk), 0);
  const everyHit = levels.solar * SOLAR_DAMAGE_PER_LEVEL + sum((perk) => (perk.kind === "every-hit" ? perk.amount : 0));

  return {
    lanes,
    attuned,
    cells,
    levels,
    damage: perAction((action) => lanes[action] + everyHit
      + sum((perk) => (perk.kind === "damage" && perk.action === action ? perk.amount : 0))),
    surge: levels.arc * ARC_SURGE_PER_LEVEL + sum((perk) => (perk.kind === "surge" ? perk.amount : 0)),
    health: levels.void * VOID_HEALTH_PER_LEVEL,
    parryHeal: sum((perk) => (perk.kind === "parry-heal" ? perk.amount : 0)),
    income: sum((perk) => (perk.kind === "income" ? perk.amount : 0)),
    freeRerolls: sum((perk) => (perk.kind === "free-reroll" ? perk.amount : 0)),
    styleMultiplier: 1 + sum((perk) => (perk.kind === "style-payout" ? 1 : 0)),
  };
}
