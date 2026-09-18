import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { BEATS, resolveMatchup } from "../../src/battle/matchup.ts";

/** The whole rule, written out. `resolveMatchup` must reproduce every cell. */
const MATRIX = [
  ["strike", "strike", "tie"],
  ["strike", "tech", "player"],
  ["strike", "block", "opponent"],
  ["tech", "strike", "opponent"],
  ["tech", "tech", "tie"],
  ["tech", "block", "player"],
  ["block", "strike", "player"],
  ["block", "tech", "opponent"],
  ["block", "block", "tie"],
] as const;

describe("the matchup", () => {
  it.each(MATRIX)("%s against %s is %s", (player, opponent, result) => {
    expect(resolveMatchup(player, opponent)).toBe(result);
  });

  it("lists every pair exactly once", () => {
    expect(new Set(MATRIX.map(([player, opponent]) => `${player}/${opponent}`)).size).toBe(ACTION_TYPES.length ** 2);
  });

  it("is a strict cycle: each action beats exactly one and loses to exactly one", () => {
    for (const action of ACTION_TYPES) {
      expect(ACTION_TYPES.filter((other) => resolveMatchup(action, other) === "player")).toEqual([BEATS[action]]);
      expect(ACTION_TYPES.filter((other) => resolveMatchup(action, other) === "opponent")).toHaveLength(1);
      expect(BEATS[BEATS[BEATS[action]]]).toBe(action);
    }
  });

  it("does not care which side an action is on", () => {
    const mirror = { player: "opponent", opponent: "player", tie: "tie" } as const;
    for (const player of ACTION_TYPES) {
      for (const opponent of ACTION_TYPES) {
        expect(resolveMatchup(opponent, player)).toBe(mirror[resolveMatchup(player, opponent)]);
      }
    }
  });
});
