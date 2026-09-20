import { describe, expect, it } from "vitest";

import { BEATS } from "../../src/battle/matchup.ts";
import { isMixupPlan } from "../../src/battle/mixup.ts";
import { isActionLoadout, sameBar } from "../../src/battle/bars.ts";
import { REGISTRY, priceOf } from "../../src/mods/registry.ts";
import { compileBuild } from "../../src/mods/compile.ts";
import { place } from "../../src/mods/grid.ts";
import type { Grid } from "../../src/mods/grid.ts";
import { ARCHETYPES, OPPONENT_FIGURES, affinityWeights, figureFor, opponentBudget, opponentFor, placementScore } from "../../src/run/opponents.ts";
import { pick, placement } from "../mods/fixtures.ts";

const SEEDS = Array.from({ length: 40 }, (_, index) => index * 7919 + 13);
const DAYS = Array.from({ length: 14 }, (_, index) => index + 1);
const STRIKE = pick({ affinity: "strike", size: 2 });
const ALL_ACTIONS = pick({ affinity: null, size: 2 });
const SOLAR_SINGLE = pick({ type: "solar", size: 1 });
const ARC_SINGLE = pick({ type: "arc", affinity: null, size: 1 });

describe("generated opponents", () => {
  it("are a pure function of the run seed and the day", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const day of DAYS) expect(opponentFor(seed, day)).toEqual(opponentFor(seed, day));
    }
    const days = new Set(DAYS.map((day) => JSON.stringify(opponentFor(SEEDS[0], day).plan)));
    expect(days.size).toBeGreaterThan(DAYS.length / 2);
  });

  it("fight on the player's two-bar contract, and every bar can hurt someone", () => {
    for (const seed of SEEDS) {
      for (const day of DAYS) {
        const { plan } = opponentFor(seed, day);
        expect(isActionLoadout({ primary: plan.primary, secondary: plan.secondary })).toBe(true);
        expect(isMixupPlan(plan.mixup)).toBe(true);
        expect(sameBar(plan.primary, plan.secondary)).toBe(false);
        for (const bar of [plan.primary, plan.secondary]) expect(bar.some((action) => action !== "block")).toBe(true);
      }
    }
  });

  it("give a Trickster a second bar that beats whatever beats its first", () => {
    let tricksters = 0;
    for (const seed of SEEDS) {
      for (const day of DAYS) {
        const { archetype, plan } = opponentFor(seed, day);
        if (archetype !== "trickster") continue;
        tricksters++;
        expect(plan.secondary).toEqual(plan.primary.map((action) => BEATS[action]));
      }
    }
    expect(tricksters).toBeGreaterThan(0);
  });

  it("lean each other archetype's bars towards its action", () => {
    const lean = { brawler: "strike", breaker: "tech", wall: "block" } as const;
    const share = { brawler: [0, 0], breaker: [0, 0], wall: [0, 0] };
    for (const seed of SEEDS) {
      for (const day of DAYS) {
        const { archetype, plan } = opponentFor(seed, day);
        if (archetype === "trickster") continue;
        const actions = [...plan.primary, ...plan.secondary];
        share[archetype][0] += actions.filter((action) => action === lean[archetype]).length;
        share[archetype][1] += actions.length;
      }
    }
    for (const [archetype, [leaning, all]] of Object.entries(share)) expect(leaning / all, archetype).toBeGreaterThan(0.45);
  });

  it("meet every archetype and every figure, and never the same figure two days running", () => {
    const archetypes = new Set<string>();
    const figures = new Set<string>();
    for (const seed of SEEDS) {
      for (const day of DAYS) {
        const opponent = opponentFor(seed, day);
        archetypes.add(opponent.archetype);
        figures.add(opponent.figure);
        if (day > 1) expect(opponent.figure).not.toBe(figureFor(seed, day - 1));
      }
    }
    expect([...archetypes].sort()).toEqual([...ARCHETYPES].sort());
    expect([...figures].sort()).toEqual([...OPPONENT_FIGURES].sort());
  });

  it("build a legal grid within the day's budget, from mods that change the fight", () => {
    for (const seed of SEEDS) {
      for (const day of DAYS) {
        const { grid } = opponentFor(seed, day);
        let rebuilt: Grid = [];
        for (const piece of grid) {
          const next = place(rebuilt, piece);
          expect(next, `seed ${seed} day ${day}`).not.toBeNull();
          rebuilt = next!;
        }
        expect(grid.reduce((spent, piece) => spent + priceOf(piece.mod), 0)).toBeLessThanOrEqual(opponentBudget(day));
        for (const piece of grid) expect(REGISTRY[piece.mod].type === "neutral", piece.mod).toBe(false);
        expect(() => compileBuild(grid)).not.toThrow();
      }
    }
  });

  it("scores mods by plan affinity and same-type adjacency", () => {
    const plan = opponentFor(13, 4).plan;
    const weights = affinityWeights(plan);
    expect(weights.strike + weights.tech + weights.block).toBe(6);

    const strikeWeight = weights.strike;
    expect(placementScore([], placement([STRIKE, 0, 0]), weights)).toBe(strikeWeight);

    const allActions = weights.strike + weights.tech + weights.block;
    expect(placementScore([], placement([ALL_ACTIONS, 0, 0]), weights)).toBe(allActions);

    const solar = place([], { uid: 99, stars: 1, ...placement([SOLAR_SINGLE, 0, 0]) })!;
    expect(placementScore(solar, placement([STRIKE, 0, 1]), weights)).toBe(strikeWeight + 1);
    expect(placementScore(solar, placement([STRIKE, 1, 1]), weights)).toBe(strikeWeight);
    expect(placementScore(solar, placement([ARC_SINGLE, 0, 1]), weights)).toBe(allActions);
  });
});
