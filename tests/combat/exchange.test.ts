import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import type { ActionType } from "../../src/battle/actions.ts";
import { actionBar, actionLoadout } from "../../src/battle/bars.ts";
import { resolveMatchup } from "../../src/battle/matchup.ts";
import { opponentPlan } from "../../src/battle/mixup.ts";
import type { CombatEvent } from "../../src/combat/kernel/index.ts";
import { DEFAULT_MATCH, Match } from "../../src/game/match.ts";

const all = (action: ActionType) => actionBar(action, action, action);

/** The first exchange of a real match: real director, real arena, real kernel. */
function firstExchange(player: ActionType, opponent: ActionType) {
  const match = new Match({
    ...DEFAULT_MATCH,
    player: actionLoadout(all(player), all(player)),
    opponent: opponentPlan({ primary: all(opponent), secondary: all(opponent) }, { kind: "steady" }),
  });
  for (let guard = 0; match.battle.history.length === 0 && guard < 10_000; guard++) match.step();
  const record = match.battle.history[0];
  const during = match.events.filter((event) => event.frame >= record.committedAt && event.frame < record.settledAt);
  return { match, record, events: during };
}

const of = (events: readonly CombatEvent[], kind: CombatEvent["kind"]) => events.filter((event) => event.kind === kind);

const PAIRS = ACTION_TYPES.flatMap((player) => ACTION_TYPES.map((opponent) => [player, opponent] as const));

describe("an exchange resolved by the real combat simulation", () => {
  it.each(PAIRS)("%s against %s comes out as the matchup says", (player, opponent) => {
    const { record, events } = firstExchange(player, opponent);
    const result = resolveMatchup(player, opponent);
    expect(record.result).toBe(result);
    expect(record.agrees).toBe(true);

    const hits = of(events, "hit");
    if (result === "player") {
      expect(record.damage[0]).toBe(0);
      expect(record.damage[1]).toBeGreaterThan(0);
      expect(record.winner).toBe("player");
      expect(hits.every((hit) => hit.source === "player")).toBe(true);
    } else if (result === "opponent") {
      expect(record.damage[1]).toBe(0);
      expect(record.damage[0]).toBeGreaterThan(0);
      expect(record.winner).toBe("opponent");
      expect(hits.every((hit) => hit.source === "opponent")).toBe(true);
    } else if (player === "block") {
      expect(record.damage).toEqual([0, 0]);
      expect(record.winner).toBeNull();
      expect(hits).toHaveLength(0);
    } else {
      // A trade: both hitboxes connect on the same tick.
      expect(hits.map((hit) => hit.source).sort()).toEqual(["opponent", "player"]);
      expect(new Set(hits.map((hit) => hit.frame)).size).toBe(1);
      expect(record.damage[0]).toBe(record.damage[1]);
      expect(record.winner).toBeNull();
    }
  });

  it.each(PAIRS)("%s against %s hurts only through hitbox contact", (player, opponent) => {
    const { match, events } = firstExchange(player, opponent);
    const lost = of(events, "damage-received");
    for (const damage of lost) {
      const contact = of(events, "hit").find((hit) => hit.frame === damage.frame && hit.target === damage.fighter);
      expect(contact, `damage to ${damage.fighter} on tick ${damage.frame} without a hit`).toBeDefined();
    }
    const [playerHealth, opponentHealth] = match.arena.state.fighters.map((fighter) => fighter.health);
    const total = (fighter: string) => lost.filter((event) => event.fighter === fighter)
      .reduce((sum, event) => sum + Number(event.detail.match(/-(\d+)/)![1]), 0);
    expect(100 - playerHealth).toBe(total("player"));
    expect(100 - opponentHealth).toBe(total("opponent"));
    // Bare fighters' parries heal nothing, so health only ever goes down.
    expect(of(events, "healed")).toHaveLength(0);
    expect(match.battle.history[0].healing).toEqual([0, 0]);
  });

  it.each(PAIRS)("%s against %s resolves the same from either side of the stage", (player, opponent) => {
    const forward = firstExchange(player, opponent).record;
    const backward = firstExchange(opponent, player).record;
    expect(backward.damage).toEqual([forward.damage[1], forward.damage[0]]);
    expect(backward.settledAt).toBe(forward.settledAt);
  });

  it("resolves each win through its own mechanism", () => {
    const strikeTech = firstExchange("strike", "tech").events;
    expect(of(strikeTech, "hit")).toMatchObject([{ source: "player", detail: "fist connected" }]);
    expect(of(strikeTech, "phase-changed").filter((event) => event.fighter === "opponent" && event.detail === "active")).toHaveLength(0);

    const techBlock = firstExchange("tech", "block").events;
    expect(of(techBlock, "parried")).toHaveLength(0);
    expect(of(techBlock, "hit")).toMatchObject([{ source: "player", detail: "overhead connected" }]);

    const blockStrike = firstExchange("block", "strike").events;
    expect(of(blockStrike, "parried")).toMatchObject([{ source: "opponent", target: "player" }]);
    expect(of(blockStrike, "hit")).toMatchObject([{ source: "player", detail: "riposte connected" }]);
  });
});
