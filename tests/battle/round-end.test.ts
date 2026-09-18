import { describe, expect, it } from "vitest";

import { actionLoadout } from "../../src/battle/bars.ts";
import { createBattle, nextRound, stepBattle } from "../../src/battle/director.ts";
import type { Arena, ArenaStatus, ArenaStep, BattleRules, BattleState } from "../../src/battle/director.ts";
import { opponentPlan } from "../../src/battle/mixup.ts";

/** An arena where every exchange settles at once and hurts nobody; only the round's end can. */
class RoundArena implements Arena {
  readonly health: [number, number] = [100, 100];
  ends = 0;
  private busy = false;
  private readonly ending: (round: number) => readonly [number, number];

  constructor(ending: (round: number) => readonly [number, number]) {
    this.ending = ending;
  }

  status(): ArenaStatus {
    if (this.busy) return "busy";
    return this.health.some((value) => value <= 0) ? "ko" : "ready";
  }

  commit(): void {
    this.busy = true;
  }

  step(): ArenaStep {
    this.busy = false;
    return { damage: [0, 0], healing: [0, 0] };
  }

  defeated(): readonly [boolean, boolean] {
    return [this.health[0] <= 0, this.health[1] <= 0];
  }

  endRound(): ArenaStep {
    const lost = this.ending(++this.ends);
    const dealt: [number, number] = [Math.min(this.health[0], lost[0]), Math.min(this.health[1], lost[1])];
    this.health[0] -= dealt[0];
    this.health[1] -= dealt[1];
    return { damage: dealt, healing: [0, 0] };
  }
}

const RULES: BattleRules = { roundIntro: 2, beat: 2, roundLimit: 10 };
const GUARDS = actionLoadout(["block", "block", "block"], ["block", "block", "block"]);
const WALL = opponentPlan({ primary: ["block", "block", "block"], secondary: ["block", "block", "block"] }, { kind: "steady" });

function untilStops(state: BattleState, arena: Arena): void {
  for (let guard = 0; state.phase !== "round-pause" && state.phase !== "ko" && guard < 10_000; guard++) stepBattle(state, arena, RULES);
}

describe("the end of a round", () => {
  it("is resolved once, after slot 3 settles, in no time, and recorded with the round", () => {
    const hurting = new RoundArena(() => [3, 5]);
    const idle = new RoundArena(() => [0, 0]);
    const [a, b] = [createBattle(GUARDS, WALL), createBattle(GUARDS, WALL)];
    untilStops(a, hurting);
    untilStops(b, idle);
    expect(a.phase).toBe("round-pause");
    expect(hurting.ends).toBe(1);
    expect(a.history).toHaveLength(3);
    expect(a.rounds[0].afflictions).toEqual([3, 5]);
    expect(a.tick).toBe(b.tick);
    expect(hurting.health).toEqual([97, 95]);
  });

  it("ends the fight when it knocks a fighter out, as a victory, a defeat or a double knockout", () => {
    for (const [lost, result, reason] of [[[0, 200], "victory", "ko"], [[200, 0], "defeat", "ko"], [[200, 200], "draw", "double-ko"]] as const) {
      // Round 1 stings a little, so it is no stalemate; round 2 is the one that ends it.
      const arena = new RoundArena((round) => (round === 2 ? lost : [1, 1]));
      const state = createBattle(GUARDS, WALL);
      untilStops(state, arena);
      expect(state.phase).toBe("round-pause");
      nextRound(state);
      expect(state.phase).toBe("round-intro");
      untilStops(state, arena);
      expect(state.outcome, `${lost}`).toMatchObject({ result, reason });
      expect(state.rounds.at(-1)!.afflictions).toEqual(lost.map((amount) => Math.min(99, amount)));
    }
  });

  it("keeps a round of guards that still hurt someone from counting as a stalemate", () => {
    const burning = new RoundArena(() => [1, 1]);
    const state = createBattle(GUARDS, WALL);
    untilStops(state, burning);
    nextRound(state);
    expect(state.phase).toBe("round-intro");
    const still = createBattle(GUARDS, WALL);
    untilStops(still, new RoundArena(() => [0, 0]));
    nextRound(still);
    expect(still.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
  });
});
