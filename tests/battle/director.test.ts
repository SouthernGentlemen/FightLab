import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { RULES, createBattle, programSlot, resetBattle, startFight, stepBattle } from "../../src/battle/director.ts";
import type { Arena, ArenaStatus, ArenaStep, BattleRules, BattleState } from "../../src/battle/director.ts";
import { OPPONENT_PROGRAM } from "../../src/battle/opponent.ts";
import { defaultProgram } from "../../src/battle/program.ts";
import type { ActionProgram } from "../../src/battle/program.ts";

/**
 * An arena whose physics are a script, so the director's state machine can be pinned down on its
 * own. The real arena is exercised against the director in tests/combat and tests/game.
 */
class ScriptedArena implements Arena {
  readonly commits: Array<[ActionType, ActionType]> = [];
  readonly health: [number, number] = [100, 100];
  steps = 0;
  private busy = 0;
  private queued: [number, number] | null = null;
  private readonly clash: number;
  private readonly damage: (player: ActionType, opponent: ActionType) => [number, number];

  /** `clash` ticks after a commit the exchange settles; `damage` lands on the first of them. */
  constructor(clash: number, damage: (player: ActionType, opponent: ActionType) => [number, number]) {
    this.clash = clash;
    this.damage = damage;
  }

  status(): ArenaStatus {
    if (this.busy > 0 || this.queued !== null) return "busy";
    return this.health.some((value) => value <= 0) ? "ko" : "ready";
  }

  commit(player: ActionType, opponent: ActionType): void {
    this.commits.push([player, opponent]);
    this.queued = this.damage(player, opponent);
    this.busy = this.clash;
  }

  step(): ArenaStep {
    this.steps++;
    if (this.queued !== null) {
      const lost: [number, number] = [Math.min(this.health[0], this.queued[0]), Math.min(this.health[1], this.queued[1])];
      this.health[0] -= lost[0];
      this.health[1] -= lost[1];
      this.queued = null;
      return { damage: lost };
    }
    if (this.busy > 0) this.busy--;
    return { damage: [0, 0] };
  }

  defeated(): readonly [boolean, boolean] {
    return [this.health[0] <= 0, this.health[1] <= 0];
  }
}

const RULES_FOR_TESTS: BattleRules = { openingBeat: 3, beat: 2, cycleLimit: 4 };

function fightUntil(state: BattleState, arena: Arena, done: (state: BattleState) => boolean, rules = RULES_FOR_TESTS): void {
  for (let guard = 0; !done(state) && guard < 100_000; guard++) stepBattle(state, arena, rules);
  expect(done(state), "the fight did not reach the expected state").toBe(true);
}

function battle(player: ActionProgram = defaultProgram(), opponent: ActionProgram = OPPONENT_PROGRAM): BattleState {
  const state = createBattle(player, opponent);
  startFight(state);
  return state;
}

describe("the battle director", () => {
  it("starts in planning, takes edits there, and locks the program once the fight starts", () => {
    const state = createBattle(defaultProgram(), OPPONENT_PROGRAM);
    expect(state).toMatchObject({ phase: "planning", actionIndex: 0, cycle: 0, history: [], outcome: null, tick: 0 });
    programSlot(state, 2, "block");
    expect(state.playerProgram).toEqual(["strike", "strike", "block", "strike", "strike"]);
    startFight(state);
    expect(state.phase).toBe("fighting");
    expect(() => programSlot(state, 0, "tech")).toThrow(/locked while fighting/);
    expect(() => startFight(state)).toThrow();
  });

  it("runs nothing while planning", () => {
    const state = createBattle(defaultProgram(), OPPONENT_PROGRAM);
    const arena = new ScriptedArena(5, () => [0, 0]);
    for (let tick = 0; tick < 50; tick++) stepBattle(state, arena, RULES_FOR_TESTS);
    expect(arena.steps).toBe(0);
    expect(state.tick).toBe(0);
  });

  it("commits slot i of both programs together after the opening beat", () => {
    const state = battle();
    const arena = new ScriptedArena(5, () => [0, 1]);
    fightUntil(state, arena, () => arena.commits.length === 1);
    expect(arena.commits[0]).toEqual(["strike", "tech"]);
    expect(state.exchange).toMatchObject({ index: 0, cycle: 0, player: "strike", opponent: "tech", result: "player", stage: "clash" });
    expect(state.exchange!.committedAt).toBe(RULES_FOR_TESTS.openingBeat - 1);
  });

  it("advances only when the arena says the exchange has settled", () => {
    const state = battle();
    const arena = new ScriptedArena(40, () => [0, 1]);
    fightUntil(state, arena, () => arena.commits.length === 1);
    for (let tick = 0; tick < 39; tick++) stepBattle(state, arena, RULES_FOR_TESTS);
    expect(state.actionIndex).toBe(0);
    expect(state.history).toHaveLength(0);
    stepBattle(state, arena, RULES_FOR_TESTS);
    expect(state.history).toHaveLength(1);
    expect(state.actionIndex).toBe(1);
    expect(state.history[0].settledAt - state.history[0].committedAt).toBe(41);
  });

  it("walks both programs slot for slot and wraps, counting cycles", () => {
    const state = battle(["strike", "tech", "block", "strike", "tech"]);
    const arena = new ScriptedArena(3, () => [0, 1]);
    fightUntil(state, arena, () => state.history.length === 7);
    expect(state.history.map(({ index, cycle }) => [index, cycle])).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1]]);
    expect(arena.commits).toEqual([
      ["strike", "tech"], ["tech", "block"], ["block", "strike"], ["strike", "tech"], ["tech", "strike"],
      ["strike", "tech"], ["tech", "block"],
    ]);
    expect(state.cycle).toBe(1);
    expect(state.actionIndex).toBe(2);
  });

  it("stops at a knockout, and no sixth action executes after it", () => {
    const state = battle();
    // Twenty to the opponent per exchange: the fifth exchange is the knockout.
    const arena = new ScriptedArena(3, () => [0, 20]);
    fightUntil(state, arena, () => state.phase === "ko");
    expect(state.history).toHaveLength(5);
    expect(state.outcome).toMatchObject({ result: "victory", reason: "ko" });
    const { tick, history } = state;
    const steps = arena.steps;
    for (let extra = 0; extra < 500; extra++) stepBattle(state, arena, RULES_FOR_TESTS);
    expect(arena.commits).toHaveLength(5);
    expect(arena.steps).toBe(steps);
    expect(state.tick).toBe(tick);
    expect(state.history).toBe(history);
  });

  it("calls a defeat a defeat and a double knockout a draw", () => {
    const lost = battle();
    const losing = new ScriptedArena(3, () => [50, 0]);
    fightUntil(lost, losing, () => lost.phase === "ko");
    expect(lost.outcome).toMatchObject({ result: "defeat", reason: "ko" });

    const both = battle();
    const trading = new ScriptedArena(3, () => [50, 50]);
    fightUntil(both, trading, () => both.phase === "ko");
    expect(both.outcome).toMatchObject({ result: "draw", reason: "double-ko" });
  });

  it("ends a loop nobody was hurt in as a stalemate instead of running forever", () => {
    const blocks: ActionProgram = ["block", "block", "block", "block", "block"];
    const state = battle(blocks, blocks);
    const arena = new ScriptedArena(3, () => [0, 0]);
    fightUntil(state, arena, () => state.phase === "ko");
    expect(state.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
    expect(state.history).toHaveLength(5);
  });

  it("ends a match that outlives the cycle limit as a draw", () => {
    const state = battle();
    const arena = new ScriptedArena(3, () => [0, 1]);
    fightUntil(state, arena, () => state.phase === "ko");
    expect(state.outcome).toMatchObject({ result: "draw", reason: "limit" });
    expect(state.history).toHaveLength(RULES_FOR_TESTS.cycleLimit * 5);
    expect(RULES.cycleLimit).toBeGreaterThan(RULES_FOR_TESTS.cycleLimit);
  });

  it("records whether the physics agreed with the matchup, and never corrects it", () => {
    const state = battle();
    // Slot 0 is strike against tech, a player win; this arena hurts the player instead.
    const arena = new ScriptedArena(3, () => [5, 0]);
    fightUntil(state, arena, () => state.history.length === 3);
    expect(state.history[0]).toMatchObject({ result: "player", damage: [5, 0], agrees: false });
    expect(state.history[1]).toMatchObject({ result: "opponent", damage: [5, 0], agrees: true });
    expect(state.history[2]).toMatchObject({ result: "tie", damage: [5, 0], agrees: false });
  });

  it("resets to planning with both programs and none of the fight", () => {
    const player: ActionProgram = ["tech", "tech", "block", "strike", "block"];
    const state = battle(player);
    const arena = new ScriptedArena(3, () => [0, 20]);
    fightUntil(state, arena, () => state.phase === "ko");
    resetBattle(state);
    expect(state).toEqual(createBattle(player, OPPONENT_PROGRAM));
  });
});
