import { ACTION_TYPES } from "../battle/actions.ts";
import type { ActionType } from "../battle/actions.ts";
import { actionBar, sameBar } from "../battle/bars.ts";
import type { ActionBar } from "../battle/bars.ts";
import { BEATS } from "../battle/matchup.ts";
import { opponentPlan } from "../battle/mixup.ts";
import type { MixupPlan, OpponentPlan } from "../battle/mixup.ts";
import { REGISTRY, priceOf } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { BOARD_HEIGHT, BOARD_WIDTH, LANES, cellsOf, fits, occupancy, place } from "../mods/grid.ts";
import type { Grid, Placement } from "../mods/grid.ts";
import { ROTATIONS } from "../mods/shapes.ts";
import { stream } from "./random.ts";
import type { Random } from "./random.ts";
import { SHOP_SIZE, drawOffer } from "./shop.ts";

/** Boneyard figures an opponent can wear; the player always wears the authored fighter. */
export const OPPONENT_FIGURES = ["barst", "kiran", "yuliya"] as const;
export type OpponentFigure = (typeof OPPONENT_FIGURES)[number];

/** How an opponent was made. Never shown: an opponent is read by fighting it. */
export const ARCHETYPES = ["brawler", "breaker", "wall", "trickster"] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export interface Opponent {
  readonly day: number;
  readonly figure: OpponentFigure;
  readonly archetype: Archetype;
  readonly plan: OpponentPlan;
  readonly grid: Grid;
}

/** The action each archetype leans on, three times as likely as either other action. */
const LEAN: Readonly<Record<Exclude<Archetype, "trickster">, ActionType>> = { brawler: "strike", breaker: "tech", wall: "block" };
const LEAN_WEIGHT = 3;

const MIXUP_KINDS = ["steady", "alternate", "reactive", "scripted"] as const;
/** Weights over `MIXUP_KINDS` per archetype. */
const MIXUP_WEIGHTS: Readonly<Record<Archetype, readonly [number, number, number, number]>> = {
  brawler: [5, 0, 3, 2],
  breaker: [0, 2, 5, 3],
  wall: [6, 0, 4, 0],
  trickster: [0, 5, 0, 5],
};
/** A scripted opponent considers switching before each of these rounds. */
const SCRIPT_ROUNDS = [2, 3, 4, 5, 6, 7, 8, 9];

/** Rolls of the day's shop an opponent buys from, and what it can spend on them. */
const OPPONENT_SHOP_ROLLS = 4;
export function opponentBudget(day: number): number {
  return 6 + 5 * day;
}

function drawAction(random: Random, archetype: Archetype): ActionType {
  if (archetype === "trickster") return random.pick(ACTION_TYPES);
  return random.weighted(ACTION_TYPES, ACTION_TYPES.map((action) => (action === LEAN[archetype] ? LEAN_WEIGHT : 1)));
}

/** A bar that cannot hurt anyone only ever draws or loses, so no opponent is given one. */
function attacks(bar: readonly ActionType[]): boolean {
  return bar.some((action) => action !== "block");
}

function drawBar(random: Random, archetype: Archetype, accept: (bar: ActionBar) => boolean): ActionBar {
  for (let attempt = 0; attempt < 32; attempt++) {
    const bar = actionBar(drawAction(random, archetype), drawAction(random, archetype), drawAction(random, archetype));
    if (attacks(bar) && accept(bar)) return bar;
  }
  // Unreachable in practice; a fixed answer keeps the function total and deterministic.
  return actionBar("strike", "tech", "block");
}

/** A Trickster's second bar beats whatever beats its first, slot for slot. */
function secondThought(bar: ActionBar): ActionBar {
  return actionBar(BEATS[bar[0]], BEATS[bar[1]], BEATS[bar[2]]);
}

function barsFor(random: Random, archetype: Archetype): readonly [ActionBar, ActionBar] {
  if (archetype === "trickster") {
    const primary = drawBar(random, archetype, (bar) => attacks(secondThought(bar)));
    return [primary, secondThought(primary)];
  }
  const primary = drawBar(random, archetype, () => true);
  return [primary, drawBar(random, archetype, (bar) => !sameBar(bar, primary))];
}

function mixupFor(random: Random, archetype: Archetype): MixupPlan {
  const kind = random.weighted(MIXUP_KINDS, MIXUP_WEIGHTS[archetype]);
  if (kind !== "scripted") return { kind };
  const rounds = SCRIPT_ROUNDS.filter(() => random.next() < 0.4);
  return { kind, rounds: rounds.length > 0 ? rounds : [random.pick(SCRIPT_ROUNDS.slice(0, 3))] };
}

/** Never the same figure two days running. */
export function figureFor(seed: number, day: number): OpponentFigure {
  const yesterday = day > 1 ? figureFor(seed, day - 1) : null;
  return stream(seed, "figure", day).pick(OPPONENT_FIGURES.filter((figure) => figure !== yesterday));
}

/** How much each lane matters to a plan: how often its action appears across both bars. */
function laneWeights(plan: OpponentPlan): Record<ActionType, number> {
  const weights: Record<ActionType, number> = { strike: 0, tech: 0, block: 0 };
  for (const action of [...plan.primary, ...plan.secondary]) weights[action]++;
  return weights;
}

/**
 * Where a mod does the plan the most good: element cells in the lanes its bars use most, with a
 * nudge towards rows already holding the same element. The first best placement in reading order
 * wins a tie, so packing is deterministic.
 */
function bestPlacement(grid: Grid, mod: ModId, weights: Readonly<Record<ActionType, number>>): Placement | null {
  const owners = occupancy(grid);
  const type = REGISTRY[mod].type === "neutral" ? null : REGISTRY[mod].type;
  let best: Placement | null = null;
  let bestScore = -Infinity;
  for (const rotation of ROTATIONS) {
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const placement = { mod, rotation, x, y };
        if (!fits(owners, placement)) continue;
        let score = 0;
        for (const { y: row } of cellsOf(placement)) {
          if (type === null) continue;
          score += weights[LANES[row]];
          for (let column = 0; column < BOARD_WIDTH; column++) {
            const neighbour = owners.get(`${column},${row}`);
            if (neighbour && REGISTRY[neighbour.mod].type === type) score += 1;
          }
        }
        if (score > bestScore) {
          best = placement;
          bestScore = score;
        }
      }
    }
  }
  return best;
}

function buildFor(seed: number, day: number, plan: OpponentPlan): Grid {
  const weights = laneWeights(plan);
  let grid: Grid = [];
  let budget = opponentBudget(day);
  let uid = 1;
  for (let roll = 0; roll < OPPONENT_SHOP_ROLLS; roll++) {
    const random = stream(seed, "opponent-shop", day, roll);
    for (let offer = 0; offer < SHOP_SIZE; offer++) {
      const mod = drawOffer(random, day);
      // Money is worth nothing to an opponent, so it never buys a Neutral mod.
      if (priceOf(mod) > budget || REGISTRY[mod].type === "neutral") continue;
      const placement = bestPlacement(grid, mod, weights);
      if (placement === null) continue;
      grid = place(grid, { uid: uid++, stars: 1, ...placement })!;
      budget -= priceOf(mod);
    }
  }
  return grid;
}

/** Day `day`'s opponent: a pure function of the run seed and the day. */
export function opponentFor(seed: number, day: number): Opponent {
  const random = stream(seed, "opponent", day);
  const archetype = random.pick(ARCHETYPES);
  const [primary, secondary] = barsFor(random, archetype);
  const plan = opponentPlan({ primary, secondary }, mixupFor(random, archetype));
  return Object.freeze({ day, figure: figureFor(seed, day), archetype, plan, grid: buildFor(seed, day, plan) });
}
