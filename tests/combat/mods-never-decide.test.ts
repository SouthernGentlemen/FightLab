import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import type { ActionType } from "../../src/battle/actions.ts";
import { resolveMatchup } from "../../src/battle/matchup.ts";
import { CombatArena } from "../../src/combat/adapter.ts";
import type { CombatSide } from "../../src/combat/adapter.ts";
import { FIGHTLAB_FIGHTER } from "../../src/combat/moves.ts";
import { ModdedArena } from "../../src/game/modded.ts";
import { combatSide } from "../../src/game/sides.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import type { Build } from "../../src/mods/compile.ts";
import { GRID_SIZE, canPlace, place } from "../../src/mods/grid.ts";
import type { Grid, Placement } from "../../src/mods/grid.ts";
import { MOD_IDS } from "../../src/mods/registry.ts";
import type { ModState } from "../../src/mods/resolve.ts";
import { ROTATIONS } from "../../src/mods/shapes.ts";
import { STARS } from "../../src/mods/stars.ts";
import { stream } from "../../src/run/random.ts";

const BUILDS = 1000;

/** A grid of up to seven random registry mods, each at random stars and a random legal spot. */
function randomGrid(index: number): Grid {
  const random = stream(0xc9, "build", index);
  let grid: Grid = [];
  const pieces = random.int(8);
  for (let piece = 0; piece < pieces; piece++) {
    const mod = random.pick(MOD_IDS);
    const legal: Placement[] = ROTATIONS.flatMap((rotation) => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, cell) =>
      ({ mod, rotation, x: cell % GRID_SIZE, y: Math.floor(cell / GRID_SIZE) }))).filter((placement) => canPlace(grid, placement));
    if (legal.length > 0) grid = place(grid, { uid: piece + 1, stars: random.pick(STARS), ...random.pick(legal) })!;
  }
  return grid;
}

/** A fighter whose mods have plenty to spend, so every payoff that can fire does. */
function loaded(build: Build, index: number): ModState {
  const random = stream(0xc9, "state", index);
  return { heat: random.int(12), charge: build.capacity, capacity: build.capacity, voidCharge: random.int(12), burn: random.int(9), shock: random.int(9), poison: random.int(9) };
}

const GRIDS = Array.from({ length: BUILDS }, (_, index) => randomGrid(index));
const BUILT: Build[] = GRIDS.map(compileBuild);
const SIDES: CombatSide[] = BUILT.map((build) => combatSide(build));

/** One exchange through the engine and the kernel: commit both actions, step until combat settles. */
function exchange(pair: readonly [number, number], player: ActionType, opponent: ActionType) {
  const arena = new ModdedArena(new CombatArena([SIDES[pair[0]], SIDES[pair[1]]]), [BUILT[pair[0]].program, BUILT[pair[1]].program]);
  arena.states = [loaded(BUILT[pair[0]], pair[0]), loaded(BUILT[pair[1]], pair[1])];
  arena.commit(player, opponent, { round: 2, mixedUp: [false, false] });
  const damage = [0, 0];
  const healing = [0, 0];
  do {
    const step = arena.step();
    for (const side of [0, 1]) {
      damage[side] += step.damage[side];
      healing[side] += step.healing[side];
    }
  } while (arena.status() === "busy");
  return { damage, healing };
}

describe("C9 — mods never decide an exchange", () => {
  it("builds a thousand different fighters to test with, from every rarity, star level and element", () => {
    const distinct = new Set(GRIDS.map((grid) => JSON.stringify(grid.map(({ mod, stars, rotation, x, y }) => [mod, stars, rotation, x, y]))));
    // Many small grids repeat; hundreds of distinct builds is the point.
    expect(distinct.size).toBeGreaterThan(750);
    const placed = GRIDS.flat();
    for (const stars of STARS) expect(placed.some((piece) => piece.stars === stars), `★${stars}`).toBe(true);
    expect(new Set(placed.map((piece) => piece.mod)).size).toBe(MOD_IDS.length);
    expect(BUILT.some((build) => build.program.mods.some((mod) => mod.links > 0))).toBe(true);
  });

  it("fights on the authored frame data, untouched, whatever the build", () => {
    for (const side of SIDES) expect(side.fighter).toBe(FIGHTLAB_FIGHTER);
  });

  it("lets every pair of builds, in every pair of actions, with their mods firing, resolve exactly as the matrix says", () => {
    let exchanges = 0;
    for (let index = 0; index < BUILDS; index++) {
      const pair = [index, (index + 1) % BUILDS] as const;
      for (const player of ACTION_TYPES) {
        for (const opponent of ACTION_TYPES) {
          const { damage, healing } = exchange(pair, player, opponent);
          const result = resolveMatchup(player, opponent);
          const [toPlayer, toOpponent] = damage;
          const agrees = result === "player" ? toOpponent > 0 && toPlayer === 0
            : result === "opponent" ? toPlayer > 0 && toOpponent === 0
            : player === "block" ? toPlayer === 0 && toOpponent === 0
            : toPlayer > 0 && toOpponent > 0;
          if (!agrees) expect.fail(`build ${index}: ${player} against ${opponent} lost ${toPlayer}/${toOpponent}, but the matrix says ${result}`);
          // Only a parry heals, and only the side that blocked a strike parries.
          const parrier = player === "block" && opponent === "strike" ? 0 : opponent === "block" && player === "strike" ? 1 : null;
          if (healing.some((amount, side) => amount > 0 && side !== parrier)) expect.fail(`build ${index}: ${player}/${opponent} healed without a parry`);
          exchanges++;
        }
      }
    }
    expect(exchanges).toBe(BUILDS * 9);
  });

  it("makes a stronger lane hit harder, and nothing more", () => {
    const bare = combatSide(compileBuild([]));
    const strong = SIDES.reduce((best, side) => (side.bonus.strike > best.bonus.strike ? side : best), bare);
    expect(strong.bonus.strike).toBeGreaterThan(0);
    const hit = (sides: readonly [CombatSide, CombatSide]) => {
      const arena = new CombatArena(sides);
      arena.commit("strike", "tech", { round: 1, mixedUp: [false, false] });
      let lost = 0;
      do lost += arena.step().damage[1]; while (arena.status() === "busy");
      return lost;
    };
    expect(hit([strong, bare])).toBe(12 + strong.bonus.strike);
    expect(hit([bare, bare])).toBe(12);
  });
});
