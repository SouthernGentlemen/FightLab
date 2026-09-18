import { describe, expect, it } from "vitest";

import { isActionLoadout } from "../../src/battle/bars.ts";
import { REFERENCE_OPPONENT, decideMixup, isMixupPlan, opponentPlan } from "../../src/battle/mixup.ts";
import type { FinishedRound, MixupPlan } from "../../src/battle/mixup.ts";

const round = (number: number, player: number, opponent: number): FinishedRound => ({ round: number, wins: [player, opponent] });

/** Every combination of exchange wins a finished round of three can have. */
const TALLIES = [0, 1, 2, 3].flatMap((player) => [0, 1, 2, 3].filter((opponent) => player + opponent <= 3).map((opponent) => [player, opponent] as const));

describe("mixup plans", () => {
  it("decide nothing before a round has been fought", () => {
    for (const plan of [{ kind: "steady" }, { kind: "alternate" }, { kind: "reactive" }, { kind: "scripted", rounds: [2] }] as MixupPlan[]) {
      expect(decideMixup(plan, [])).toBe(false);
    }
  });

  it("steady never switches and alternate always does", () => {
    for (let number = 1; number <= 12; number++) {
      for (const [player, opponent] of TALLIES) {
        const finished = [round(number, player, opponent)];
        expect(decideMixup({ kind: "steady" }, finished)).toBe(false);
        expect(decideMixup({ kind: "alternate" }, finished)).toBe(true);
      }
    }
  });

  it("reactive switches exactly after a round it lost more exchanges in than it won", () => {
    for (const [player, opponent] of TALLIES) {
      expect(decideMixup({ kind: "reactive" }, [round(1, player, opponent)]), `${player}-${opponent}`).toBe(opponent < player);
    }
    // Only the round just fought counts.
    expect(decideMixup({ kind: "reactive" }, [round(1, 3, 0), round(2, 0, 3)])).toBe(false);
  });

  it("scripted switches before exactly the rounds it lists", () => {
    const plan: MixupPlan = { kind: "scripted", rounds: [2, 5, 6] };
    const switches = Array.from({ length: 10 }, (_, index) => index + 1).filter((number) => decideMixup(plan, [round(number, 1, 1)]));
    expect(switches.map((number) => number + 1)).toEqual([2, 5, 6]);
  });

  it("is a pure function of the plan and the rounds, and changes neither", () => {
    const plan: MixupPlan = Object.freeze({ kind: "scripted", rounds: Object.freeze([3]) });
    const finished = Object.freeze([Object.freeze(round(1, 2, 1)), Object.freeze(round(2, 0, 1))]);
    const first = decideMixup(plan, finished);
    for (let repeat = 0; repeat < 5; repeat++) expect(decideMixup(plan, finished)).toBe(first);
    expect(first).toBe(true);
  });

  it("validates a plan", () => {
    expect(isMixupPlan({ kind: "steady" })).toBe(true);
    expect(isMixupPlan({ kind: "scripted", rounds: [2, 4] })).toBe(true);
    expect(isMixupPlan({ kind: "scripted", rounds: [1] })).toBe(false);
    expect(isMixupPlan({ kind: "scripted", rounds: [2.5] })).toBe(false);
    expect(isMixupPlan({ kind: "scripted" })).toBe(false);
    expect(isMixupPlan({ kind: "coin-flip" })).toBe(false);
    expect(isMixupPlan(null)).toBe(false);
  });
});

describe("an opponent plan", () => {
  it("is the player's two-bar contract plus a mixup plan, frozen", () => {
    const plan = opponentPlan({ primary: ["tech", "tech", "block"], secondary: ["strike", "block", "tech"] }, { kind: "scripted", rounds: [3] });
    expect(isActionLoadout({ primary: plan.primary, secondary: plan.secondary })).toBe(true);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.mixup)).toBe(true);
    expect(() => opponentPlan({ primary: ["tech"], secondary: ["tech", "tech", "tech"] } as never, { kind: "steady" })).toThrow(/two bars/);
    expect(() => opponentPlan({ primary: ["tech", "tech", "tech"], secondary: ["tech", "tech", "tech"] }, { kind: "maybe" } as never)).toThrow(/mixup/);
  });

  it("has a reference opponent that fights both of its bars", () => {
    expect(REFERENCE_OPPONENT).toMatchObject({ primary: ["tech", "block", "strike"], secondary: ["tech", "strike", "strike"], mixup: { kind: "alternate" } });
  });
});
