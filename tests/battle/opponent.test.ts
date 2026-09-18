import { describe, expect, it } from "vitest";

import { createBattle } from "../../src/battle/director.ts";
import { OPPONENT_PROGRAM } from "../../src/battle/opponent.ts";
import { defaultProgram, isActionProgram } from "../../src/battle/program.ts";

describe("the opponent", () => {
  it("runs the same five-action contract as the player", () => {
    expect(isActionProgram(OPPONENT_PROGRAM)).toBe(true);
    expect(Object.isFrozen(OPPONENT_PROGRAM)).toBe(true);
    expect(createBattle(defaultProgram(), OPPONENT_PROGRAM).opponentProgram).toBe(OPPONENT_PROGRAM);
  });

  it("is the fixed first-slice sequence", () => {
    expect(OPPONENT_PROGRAM).toEqual(["tech", "block", "strike", "tech", "strike"]);
  });

  it("is validated exactly like the player's", () => {
    expect(() => createBattle(defaultProgram(), ["tech", "block"] as never)).toThrow(/opponent program/);
    expect(() => createBattle(["tech"] as never, OPPONENT_PROGRAM)).toThrow(/player program/);
  });
});
