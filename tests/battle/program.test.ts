import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import { PROGRAM_LENGTH, advanceCursor, defaultProgram, isActionProgram, setSlot } from "../../src/battle/program.ts";

describe("a five-action program", () => {
  it("starts as five strikes", () => {
    expect(defaultProgram()).toEqual(["strike", "strike", "strike", "strike", "strike"]);
    expect(PROGRAM_LENGTH).toBe(5);
  });

  it("changes one slot without touching any other, or the program it came from", () => {
    for (let slot = 0; slot < PROGRAM_LENGTH; slot++) {
      for (const action of ACTION_TYPES) {
        const before = defaultProgram();
        const after = setSlot(before, slot, action);
        expect(after[slot]).toBe(action);
        after.forEach((value, index) => { if (index !== slot) expect(value).toBe(before[index]); });
        expect(before).toEqual(defaultProgram());
      }
    }
    const three = setSlot(defaultProgram(), 2, "tech");
    expect(three).toEqual(["strike", "strike", "tech", "strike", "strike"]);
  });

  it("cannot be edited in place", () => {
    const program = setSlot(defaultProgram(), 0, "block");
    expect(Object.isFrozen(program)).toBe(true);
    expect(Object.isFrozen(defaultProgram())).toBe(true);
    expect(() => { (program as unknown as string[])[1] = "tech"; }).toThrow();
  });

  it("refuses a slot or an action that does not exist", () => {
    expect(() => setSlot(defaultProgram(), 5, "tech")).toThrow(RangeError);
    expect(() => setSlot(defaultProgram(), -1, "tech")).toThrow(RangeError);
    expect(() => setSlot(defaultProgram(), 1.5, "tech")).toThrow(RangeError);
    expect(() => setSlot(defaultProgram(), 0, "kick" as never)).toThrow(TypeError);
  });

  it("is exactly five known actions", () => {
    expect(isActionProgram(defaultProgram())).toBe(true);
    expect(isActionProgram(["strike", "tech", "block", "tech"])).toBe(false);
    expect(isActionProgram(["strike", "tech", "block", "tech", "strike", "block"])).toBe(false);
    expect(isActionProgram(["strike", "tech", "block", "tech", "kick"])).toBe(false);
    expect(isActionProgram("strike")).toBe(false);
  });

  it("is walked 0 → 1 → 2 → 3 → 4 → 0, counting a cycle at each wrap", () => {
    const visited: Array<[number, number]> = [];
    let cursor = { index: 0, cycle: 0 };
    for (let step = 0; step < 12; step++) {
      visited.push([cursor.index, cursor.cycle]);
      cursor = advanceCursor(cursor);
    }
    expect(visited).toEqual([
      [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
      [0, 2], [1, 2],
    ]);
  });
});
