import { describe, expect, it } from "vitest";

import type { ActionType } from "../../src/battle/actions.ts";
import { actionLoadout, defaultLoadout } from "../../src/battle/bars.ts";
import type { ActionBar, ActionLoadout } from "../../src/battle/bars.ts";
import { RULES, activeBar, createBattle, mixup, nextRound, stepBattle } from "../../src/battle/director.ts";
import type { Arena, ArenaStatus, ArenaStep, BattleRules, BattleState, CommitContext } from "../../src/battle/director.ts";
import { REFERENCE_OPPONENT, opponentPlan } from "../../src/battle/mixup.ts";
import type { MixupPlan, OpponentPlan } from "../../src/battle/mixup.ts";

/**
 * An arena whose physics are a script, so the director's state machine can be pinned down on its
 * own. The real arena is exercised against the director in tests/combat and tests/game.
 */
class ScriptedArena implements Arena {
  readonly commits: Array<[ActionType, ActionType]> = [];
  readonly contexts: CommitContext[] = [];
  readonly health: [number, number] = [100, 100];
  steps = 0;
  /** Ticks before the fighters stand ready again after an exchange — a walk back to the marks. */
  walk = 0;
  private busy = 0;
  private walking = 0;
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
    if (this.health.some((value) => value <= 0)) return "ko";
    return this.walking > 0 ? "moving" : "ready";
  }

  commit(player: ActionType, opponent: ActionType, context: CommitContext): void {
    this.commits.push([player, opponent]);
    this.contexts.push(context);
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
      return { damage: lost, healing: [0, 0] };
    }
    if (this.busy > 0) {
      this.busy--;
      if (this.busy === 0) this.walking = this.walk;
    } else if (this.walking > 0) {
      this.walking--;
    }
    return { damage: [0, 0], healing: [0, 0] };
  }

  defeated(): readonly [boolean, boolean] {
    return [this.health[0] <= 0, this.health[1] <= 0];
  }
}

const RULES_FOR_TESTS: BattleRules = { roundIntro: 3, beat: 2, roundLimit: 4 };

/** Everything hurts whoever the matchup says loses, by `amount`; ties trade, guards do nothing. */
function byMatchup(amount: number) {
  return (player: ActionType, opponent: ActionType): [number, number] => {
    if (player === opponent) return player === "block" ? [0, 0] : [amount, amount];
    const beats: Record<ActionType, ActionType> = { strike: "tech", tech: "block", block: "strike" };
    return beats[player] === opponent ? [0, amount] : [amount, 0];
  };
}

function step(state: BattleState, arena: Arena, until: (state: BattleState) => boolean, rules = RULES_FOR_TESTS): void {
  for (let guard = 0; !until(state) && guard < 100_000; guard++) stepBattle(state, arena, rules);
  expect(until(state), "the fight did not reach the expected state").toBe(true);
}

const paused = (state: BattleState) => state.phase === "round-pause" || state.phase === "ko";

const loadout = (primary: ActionBar, secondary: ActionBar): ActionLoadout => actionLoadout(primary, secondary);
const plan = (primary: ActionBar, secondary: ActionBar, mixup: MixupPlan = { kind: "steady" }): OpponentPlan =>
  opponentPlan({ primary, secondary }, mixup);

const PLAYER = loadout(["strike", "tech", "block"], ["block", "block", "strike"]);
const OPPONENT = plan(["tech", "block", "strike"], ["tech", "strike", "strike"]);

describe("a fight in rounds", () => {
  it("starts round 1 on both primary bars, in the round intro", () => {
    const state = createBattle(PLAYER, OPPONENT);
    expect(state).toMatchObject({ phase: "round-intro", round: 1, bars: ["primary", "primary"], mixedUp: [false, false], actionIndex: 0, history: [], outcome: null, tick: 0 });
    expect(activeBar(state, 0)).toEqual(PLAYER.primary);
    expect(activeBar(state, 1)).toEqual(OPPONENT.primary);
  });

  it("waits the intro, standing ready, before the round's first exchange opens", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, () => [0, 1]);
    for (let tick = 0; tick < RULES_FOR_TESTS.roundIntro; tick++) {
      expect(state.phase).toBe("round-intro");
      stepBattle(state, arena, RULES_FOR_TESTS);
    }
    expect(state.phase).toBe("fighting");
    expect(state.exchange).toBeNull();
    expect(arena.commits).toHaveLength(0);
  });

  it("plays exactly three exchanges, slots 0 → 1 → 2, then pauses only once slot 3 has settled", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(5, () => [0, 1]);
    const indices: number[] = [];
    for (let guard = 0; state.phase !== "round-pause" && guard < 10_000; guard++) {
      if (state.phase === "fighting" && indices.at(-1) !== state.actionIndex) indices.push(state.actionIndex);
      stepBattle(state, arena, RULES_FOR_TESTS);
    }
    expect(indices).toEqual([0, 1, 2]);
    expect(state.history.map((record) => record.index)).toEqual([0, 1, 2]);
    expect(arena.commits).toEqual([["strike", "tech"], ["tech", "block"], ["block", "strike"]]);
    expect(state.history[2].settledAt).toBe(state.tick);
    expect(arena.status()).not.toBe("busy");
    expect(state.exchange).toBeNull();
  });

  it("never wraps inside a round: nothing more is committed while paused, however long it lasts", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, () => [0, 1]);
    step(state, arena, paused);
    const { steps } = arena;
    const tick = state.tick;
    for (let extra = 0; extra < 500; extra++) stepBattle(state, arena, RULES_FOR_TESTS);
    expect(arena.commits).toHaveLength(3);
    expect(arena.steps).toBe(steps);
    expect(state.tick).toBe(tick);
    expect(state.phase).toBe("round-pause");
  });

  it.each([0, 1])("ends the fight at a knockout in slot %i, and nothing after it executes", (slot) => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, () => [0, 1]);
    arena.health[1] = slot + 1;
    step(state, arena, paused);
    expect(state.phase).toBe("ko");
    expect(state.outcome).toMatchObject({ result: "victory", reason: "ko" });
    expect(state.history).toHaveLength(slot + 1);
    expect(state.rounds).toEqual([expect.objectContaining({ round: 1, exchanges: slot + 1 })]);
    const { steps } = arena;
    const tick = state.tick;
    for (let extra = 0; extra < 500; extra++) stepBattle(state, arena, RULES_FOR_TESTS);
    expect(arena.commits).toHaveLength(slot + 1);
    expect(arena.steps).toBe(steps);
    expect(state.tick).toBe(tick);
    expect(() => mixup(state)).toThrow(/while ko/);
    expect(() => nextRound(state)).toThrow(/while ko/);
  });

  it("calls a defeat a defeat and a double knockout a draw", () => {
    const lost = createBattle(PLAYER, OPPONENT);
    step(lost, new ScriptedArena(3, () => [50, 0]), (state) => state.phase === "ko");
    expect(lost.outcome).toMatchObject({ result: "defeat", reason: "ko" });

    const both = createBattle(PLAYER, OPPONENT);
    step(both, new ScriptedArena(3, () => [50, 50]), (state) => state.phase === "ko");
    expect(both.outcome).toMatchObject({ result: "draw", reason: "double-ko" });
  });

  it("carries health from round to round", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, byMatchup(10));
    step(state, arena, paused);
    const after = [...arena.health];
    nextRound(state);
    step(state, arena, (current) => current.phase === "fighting");
    expect(arena.health).toEqual(after);
    expect(state.rounds[0].damage).toEqual([100 - after[0], 100 - after[1]]);
  });

  it("walks back to the marks during the intro, however long that takes", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, () => [0, 1]);
    arena.walk = 20;
    step(state, arena, paused);
    nextRound(state);
    const start = state.tick;
    step(state, arena, (current) => current.phase === "fighting");
    // The tick both fighters arrive on is their first ready tick.
    expect(state.tick - start).toBe(20 + RULES_FOR_TESTS.roundIntro - 1);
  });
});

describe("the pause and Mixup", () => {
  function pausedBattle(opponent: OpponentPlan = OPPONENT, player: ActionLoadout = PLAYER) {
    const state = createBattle(player, opponent);
    const arena = new ScriptedArena(3, () => [0, 1]);
    step(state, arena, paused);
    expect(state.phase).toBe("round-pause");
    return { state, arena };
  }

  it("keeps the active bar when the player leaves without Mixup", () => {
    const { state, arena } = pausedBattle();
    nextRound(state);
    expect(state).toMatchObject({ phase: "round-intro", round: 2, bars: ["primary", "primary"], mixedUp: [false, false], actionIndex: 0 });
    step(state, arena, paused);
    expect(arena.commits.slice(3)).toEqual([["strike", "tech"], ["tech", "block"], ["block", "strike"]]);
  });

  it("toggles primary ↔ secondary, and a second press swaps back", () => {
    const { state } = pausedBattle();
    mixup(state);
    expect(state.bars[0]).toBe("secondary");
    mixup(state);
    expect(state.bars[0]).toBe("primary");
    mixup(state);
    nextRound(state);
    expect(state.bars).toEqual(["secondary", "primary"]);
    expect(state.mixedUp).toEqual([true, false]);
    expect(activeBar(state, 0)).toEqual(PLAYER.secondary);
  });

  it("plays the other bar after a Mixup, slot for slot", () => {
    const { state, arena } = pausedBattle();
    mixup(state);
    nextRound(state);
    step(state, arena, paused);
    expect(arena.commits.slice(3)).toEqual([["block", "tech"], ["block", "block"], ["strike", "strike"]]);
    expect(state.history.slice(3).every((record) => record.bars[0] === "secondary" && record.round === 2)).toBe(true);
    expect(arena.contexts.slice(3).every((context) => context.round === 2 && context.mixedUp[0] && !context.mixedUp[1])).toBe(true);
  });

  it("refuses Mixup while an exchange is running, in the intro and after a knockout", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(8, () => [0, 1]);
    expect(() => mixup(state)).toThrow(/while round-intro/);
    step(state, arena, (current) => current.exchange?.stage === "clash");
    expect(() => mixup(state)).toThrow(/while fighting/);
    expect(() => nextRound(state)).toThrow(/while fighting/);
    expect(state.bars).toEqual(["primary", "primary"]);
  });

  it("offers no way to edit a slot once combat has begun", () => {
    const source = { primary: [...PLAYER.primary], secondary: [...PLAYER.secondary] } as unknown as ActionLoadout;
    const state = createBattle(source, OPPONENT);
    (source.primary as unknown as string[])[0] = "tech";
    expect(state.playerLoadout.primary[0]).toBe("strike");
    expect(() => { (state.playerLoadout.primary as unknown as string[])[0] = "tech"; }).toThrow(TypeError);
    expect(() => { (state.opponentLoadout.secondary as unknown as string[])[1] = "block"; }).toThrow(TypeError);
    expect(() => { (state.playerLoadout as { primary: ActionBar }).primary = PLAYER.secondary; }).toThrow(TypeError);
    expect(Object.isFrozen(state.opponentMixup)).toBe(true);
  });

  it("fixes the opponent's decision the moment the pause begins, whatever the player then does", () => {
    const switching = plan(["tech", "block", "strike"], ["tech", "strike", "strike"], { kind: "alternate" });
    const stays = pausedBattle(switching);
    expect(stays.state.opponentSwitch).toBe(true);
    const moves = pausedBattle(switching);
    mixup(moves.state);
    mixup(moves.state);
    mixup(moves.state);
    expect(moves.state.opponentSwitch).toBe(true);
    nextRound(stays.state);
    nextRound(moves.state);
    expect(stays.state.bars).toEqual(["primary", "secondary"]);
    expect(moves.state.bars).toEqual(["secondary", "secondary"]);
    expect(stays.state.mixedUp).toEqual([false, true]);
    expect(moves.state.mixedUp).toEqual([true, true]);
    expect(stays.state.opponentSwitch).toBeNull();
  });

  it("switches a reactive opponent after a round it lost on exchanges, and only then", () => {
    const reactive = plan(["tech", "block", "strike"], ["tech", "strike", "strike"], { kind: "reactive" });
    // Strike Tech Block against Tech Block Strike wins all three: the opponent reacts.
    const beaten = pausedBattle(reactive, loadout(["strike", "tech", "block"], ["strike", "strike", "strike"]));
    expect(beaten.state.rounds[0].wins).toEqual([3, 0]);
    expect(beaten.state.opponentSwitch).toBe(true);
    // Block Strike Tech against it loses all three: the opponent stays.
    const winning = createBattle(loadout(["block", "strike", "tech"], ["strike", "strike", "strike"]), reactive);
    step(winning, new ScriptedArena(3, byMatchup(1)), paused);
    expect(winning.rounds[0].wins).toEqual([0, 3]);
    expect(winning.opponentSwitch).toBe(false);
  });

  it("draws a round nobody could be hurt in when the next round would repeat it", () => {
    const blocks = loadout(["block", "block", "block"], ["strike", "block", "block"]);
    const walls = plan(["block", "block", "block"], ["tech", "tech", "tech"]);
    const state = createBattle(blocks, walls);
    const arena = new ScriptedArena(3, byMatchup(5));
    step(state, arena, paused);
    expect(state.rounds[0].damage).toEqual([0, 0]);
    nextRound(state);
    expect(state.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
    expect(arena.commits).toHaveLength(3);
  });

  it("lets a Mixup out of a stalemate, and treats two identical bars as the same bar", () => {
    const blocks = loadout(["block", "block", "block"], ["strike", "block", "block"]);
    const walls = plan(["block", "block", "block"], ["block", "block", "tech"]);
    const escaped = createBattle(blocks, walls);
    step(escaped, new ScriptedArena(3, byMatchup(5)), paused);
    mixup(escaped);
    nextRound(escaped);
    expect(escaped.phase).toBe("round-intro");

    const twins = createBattle(loadout(["block", "block", "block"], ["block", "block", "block"]), walls);
    step(twins, new ScriptedArena(3, byMatchup(5)), paused);
    mixup(twins);
    nextRound(twins);
    expect(twins.outcome).toMatchObject({ result: "draw", reason: "stalemate" });
  });

  it("ends a fight that reaches the round limit as a draw", () => {
    const state = createBattle(PLAYER, OPPONENT);
    const arena = new ScriptedArena(3, () => [1, 1]);
    for (let round = 1; state.phase !== "ko"; round++) {
      step(state, arena, paused);
      if (state.phase === "round-pause") nextRound(state);
    }
    expect(state.outcome).toMatchObject({ result: "draw", reason: "limit" });
    expect(state.rounds).toHaveLength(RULES_FOR_TESTS.roundLimit);
    expect(state.history).toHaveLength(RULES_FOR_TESTS.roundLimit * 3);
    expect(RULES.roundLimit).toBeGreaterThan(RULES_FOR_TESTS.roundLimit);
  });
});

describe("the exchange record", () => {
  it("records whether the physics agreed with the matchup, and never corrects it", () => {
    const state = createBattle(PLAYER, OPPONENT);
    // Slot 0 is strike against tech, a player win; this arena hurts the player instead.
    step(state, new ScriptedArena(3, () => [5, 0]), paused);
    expect(state.history[0]).toMatchObject({ result: "player", damage: [5, 0], agrees: false, winner: "opponent" });
    expect(state.history[1]).toMatchObject({ result: "player", damage: [5, 0], agrees: false, winner: "opponent" });
    expect(state.history[2]).toMatchObject({ result: "player", damage: [5, 0], agrees: false, winner: "opponent" });
  });

  it("names the physical winner, a trade or nobody", () => {
    const state = createBattle(loadout(["strike", "block", "tech"], ["strike", "strike", "strike"]), plan(["tech", "block", "tech"], ["tech", "tech", "tech"]));
    step(state, new ScriptedArena(3, byMatchup(4)), paused);
    expect(state.history.map((record) => [record.result, record.winner, record.damage])).toEqual([
      ["player", "player", [0, 4]],
      ["tie", null, [0, 0]],
      ["tie", null, [4, 4]],
    ]);
    expect(state.rounds[0]).toEqual({ round: 1, bars: ["primary", "primary"], mixedUp: [false, false], exchanges: 3, damage: [4, 8], wins: [1, 0] });
  });

  it("validates both loadouts on the way in", () => {
    expect(() => createBattle({ primary: ["strike"], secondary: PLAYER.secondary } as never, OPPONENT)).toThrow(/primary/);
    expect(() => createBattle(PLAYER, { ...OPPONENT, mixup: { kind: "sometimes" } } as never)).toThrow(/mixup plan/);
    expect(() => createBattle(defaultLoadout(), REFERENCE_OPPONENT)).not.toThrow();
  });
});
