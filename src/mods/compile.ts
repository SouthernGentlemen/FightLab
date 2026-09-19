import type { ActionType } from "../battle/actions.ts";
import { ATTUNED_LANE_POWER, LANE_POWER } from "./balance.ts";
import { GRID_SIZE, LANES, cellsOf, occupancy } from "./grid.ts";
import type { Grid, PlacedMod } from "./grid.ts";
import { programOf } from "./program.ts";
import type { ModProgram } from "./program.ts";
import { REGISTRY } from "./registry.ts";
import { freshState, staticTotal } from "./resolve.ts";
import { scaled } from "./stars.ts";
import type { ModType } from "./tags.ts";

type Elemental = Exclude<ModType, "neutral">;
const ELEMENTAL: readonly Elemental[] = ["solar", "arc", "void"];

/**
 * A grid as what the rest of the game needs: the lane power each action's row gives it, the
 * program the resource engine runs in a fight, and the run's perks. This is the only thing that
 * reads a placed grid, and nothing in it can describe a frame, an action order or a bar.
 */
export interface Build {
  /** What each action's row adds to every hit of that action. Block's reaches the riposte. */
  readonly lanes: Readonly<Record<ActionType, number>>;
  /** The element a lane is attuned to, when every one of its three cells carries it. */
  readonly attuned: Readonly<Record<ActionType, Elemental | null>>;
  /** The placed mods at their stars, with the links their ports make, as the engine runs them. */
  readonly program: ModProgram;
  /** How much Charge the fighter can hold. */
  readonly capacity: number;
  /** Dollars added to every payday. */
  readonly income: number;
  readonly freeRerolls: number;
  /** How many times the style payout is paid. */
  readonly styleMultiplier: number;
}

function elementalOf(placed: PlacedMod): Elemental[] {
  const type = REGISTRY[placed.mod].type;
  return type === "neutral" ? [] : [type];
}

/** What the Amplifiers touching `placed` add to each of its elemental cells. */
function boostOn(placed: PlacedMod, owners: ReadonlyMap<string, PlacedMod>): number {
  const touching = new Map<number, PlacedMod>();
  for (const [x, y] of cellsOf(placed)) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = owners.get(`${x + dx},${y + dy}`);
      if (other && other.uid !== placed.uid) touching.set(other.uid, other);
    }
  }
  let boost = 0;
  for (const other of touching.values()) {
    for (const effect of REGISTRY[other.mod].effects) if (effect.kind === "lane-boost") boost += scaled(effect.amount, other.stars);
  }
  return boost;
}

export function compileBuild(grid: Grid): Build {
  const owners = occupancy(grid);
  const lanes: Record<ActionType, number> = { strike: 0, tech: 0, block: 0 };
  const attuned: Record<ActionType, Elemental | null> = { strike: null, tech: null, block: null };
  for (let y = 0; y < GRID_SIZE; y++) {
    const lane = LANES[y];
    const row = Array.from({ length: GRID_SIZE }, (_, x) => owners.get(`${x},${y}`) ?? null);
    attuned[lane] = ELEMENTAL.find((element) => row.every((placed) => placed !== null && elementalOf(placed).includes(element))) ?? null;
    for (const placed of row) {
      if (placed === null || elementalOf(placed).length === 0) continue;
      lanes[lane] += (attuned[lane] ? ATTUNED_LANE_POWER : LANE_POWER) + boostOn(placed, owners);
    }
  }
  const program = programOf(grid);
  return {
    lanes,
    attuned,
    program,
    capacity: freshState(program).capacity,
    income: staticTotal(program, "income"),
    freeRerolls: staticTotal(program, "free-reroll"),
    styleMultiplier: 1 + staticTotal(program, "style"),
  };
}
