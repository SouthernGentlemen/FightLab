import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import type { ActionType } from "../../src/battle/actions.ts";
import { resolveMatchup } from "../../src/battle/matchup.ts";
import { CombatArena } from "../../src/combat/adapter.ts";
import type { CombatSide } from "../../src/combat/adapter.ts";
import type { MoveDefinition } from "../../src/combat/kernel/index.ts";
import { FIGHTLAB_FIGHTER } from "../../src/combat/moves.ts";
import { combatSide } from "../../src/game/sides.ts";
import { MOD_IDS } from "../../src/mods/catalog.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { GRID_SIZE, canPlace, place } from "../../src/mods/grid.ts";
import type { Grid, Placement } from "../../src/mods/grid.ts";
import { ROTATIONS } from "../../src/mods/shapes.ts";
import { stream } from "../../src/run/random.ts";

const BUILDS = 1000;

/** A grid of up to seven random mods, each at a random legal spot, from its own seeded stream. */
function randomGrid(index: number): Grid {
  const random = stream(0xc9, "build", index);
  let grid: Grid = [];
  const pieces = random.int(8);
  for (let piece = 0; piece < pieces; piece++) {
    const mod = random.pick(MOD_IDS);
    const legal: Placement[] = ROTATIONS.flatMap((rotation) => Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, cell) =>
      ({ mod, rotation, x: cell % GRID_SIZE, y: Math.floor(cell / GRID_SIZE) }))).filter((placement) => canPlace(grid, placement));
    if (legal.length > 0) grid = place(grid, { uid: piece + 1, ...random.pick(legal) })!;
  }
  return grid;
}

const SIDES: CombatSide[] = Array.from({ length: BUILDS }, (_, index) => combatSide(compileBuild(randomGrid(index))));

/** One exchange straight on the arena: commit both actions, step until combat settles. */
function exchange(sides: readonly [CombatSide, CombatSide], player: ActionType, opponent: ActionType, mixedUp: readonly [boolean, boolean]) {
  const arena = new CombatArena(sides);
  arena.commit(player, opponent, { round: 2, mixedUp });
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

/** Every timing field of a move: everything except how hard it hits and how much its parry heals. */
function timing(move: MoveDefinition): unknown {
  return {
    ...move,
    hitboxes: move.hitboxes.map(({ damage: _damage, ...rest }) => rest),
    parry: move.parry && { ...move.parry, heal: undefined },
  };
}

describe("C9 — mods never decide an exchange", () => {
  it("builds a thousand different fighters to test with", () => {
    const distinct = new Set(SIDES.map((side) => JSON.stringify([side.bonus, side.surge, side.fighter.maxHealth, side.fighter.moves.parry.parry!.heal])));
    // Many small grids compile alike; hundreds of distinct fighters is the point.
    expect(distinct.size).toBeGreaterThan(400);
    expect(SIDES.some((side) => side.surge > 0)).toBe(true);
    expect(SIDES.some((side) => side.fighter.moves.parry.parry!.heal > 0)).toBe(true);
    expect(SIDES.some((side) => side.fighter.maxHealth > 100)).toBe(true);
  });

  it("copies every timing field of the authored frame data untouched", () => {
    for (const side of SIDES) {
      const { maxHealth: _maxHealth, moves, ...body } = side.fighter;
      const { maxHealth: _base, moves: authored, ...authoredBody } = FIGHTLAB_FIGHTER;
      expect(body).toEqual(authoredBody);
      expect(Object.keys(moves)).toEqual(Object.keys(authored));
      for (const [id, move] of Object.entries(moves)) expect(timing(move), id).toEqual(timing(authored[id]));
      expect(side.actions).toEqual(SIDES[0].actions);
    }
  });

  it("lets every pair of builds, in every pair of actions, with and without a surge, resolve exactly as the matrix says", () => {
    const surges: ReadonlyArray<readonly [boolean, boolean]> = [[false, false], [true, false], [false, true], [true, true]];
    let exchanges = 0;
    for (let index = 0; index < BUILDS; index++) {
      const sides = [SIDES[index], SIDES[(index + 1) % BUILDS]] as const;
      const mixedUp = surges[index % surges.length];
      for (const player of ACTION_TYPES) {
        for (const opponent of ACTION_TYPES) {
          const { damage, healing } = exchange(sides, player, opponent, mixedUp);
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

  it("makes a stronger build hit harder, and a surge harder still — and nothing more", () => {
    const bare = combatSide(compileBuild([]));
    const strong = SIDES.reduce((best, side) => (side.bonus.strike > best.bonus.strike ? side : best), bare);
    expect(strong.bonus.strike).toBeGreaterThan(0);
    const plain = exchange([strong, bare], "strike", "tech", [false, false]);
    const surged = exchange([strong, bare], "strike", "tech", [true, false]);
    expect(plain.damage).toEqual([0, 12 + strong.bonus.strike]);
    expect(surged.damage).toEqual([0, 12 + strong.bonus.strike + strong.surge]);
    expect(exchange([bare, bare], "strike", "tech", [false, false]).damage).toEqual([0, 12]);
  });
});
