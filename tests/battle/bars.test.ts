import { describe, expect, it } from "vitest";

import { ACTION_TYPES } from "../../src/battle/actions.ts";
import {
  BAR_IDS, BAR_LENGTH, actionBar, actionLoadout, defaultLoadout, isActionBar, isActionLoadout, otherBar, sameBar, setBarSlot,
  setLoadoutSlot,
} from "../../src/battle/bars.ts";
import type { ActionBar } from "../../src/battle/bars.ts";

describe("an action bar", () => {
  it("is exactly three valid actions", () => {
    expect(BAR_LENGTH).toBe(3);
    expect(isActionBar(["strike", "tech", "block"])).toBe(true);
    expect(isActionBar(["strike", "tech"])).toBe(false);
    expect(isActionBar(["strike", "tech", "block", "tech"])).toBe(false);
    expect(isActionBar(["strike", "tech", "kick"])).toBe(false);
    expect(isActionBar(["strike", "tech", "block", "strike", "tech"])).toBe(false);
    expect(isActionBar("strike")).toBe(false);
    expect(() => actionBar("strike", "tech", "kick" as never)).toThrow(TypeError);
  });

  it("changes one slot without touching any other, or the bar it came from", () => {
    const before = actionBar("strike", "strike", "strike");
    for (let slot = 0; slot < BAR_LENGTH; slot++) {
      for (const action of ACTION_TYPES) {
        const after = setBarSlot(before, slot, action);
        expect(after[slot]).toBe(action);
        after.forEach((value, index) => { if (index !== slot) expect(value).toBe(before[index]); });
      }
    }
    expect(before).toEqual(["strike", "strike", "strike"]);
    expect(setBarSlot(before, 1, "tech")).toEqual(["strike", "tech", "strike"]);
  });

  it("cannot be edited in place", () => {
    const bar = setBarSlot(actionBar("strike", "tech", "block"), 0, "block");
    expect(Object.isFrozen(bar)).toBe(true);
    expect(() => { (bar as unknown as string[])[1] = "tech"; }).toThrow(TypeError);
  });

  it("refuses a slot or an action that does not exist", () => {
    const bar = actionBar("strike", "tech", "block");
    expect(() => setBarSlot(bar, 3, "tech")).toThrow(RangeError);
    expect(() => setBarSlot(bar, -1, "tech")).toThrow(RangeError);
    expect(() => setBarSlot(bar, 1.5, "tech")).toThrow(RangeError);
    expect(() => setBarSlot(bar, 0, "kick" as never)).toThrow(TypeError);
  });

  it("compares by content", () => {
    expect(sameBar(actionBar("block", "block", "block"), ["block", "block", "block"])).toBe(true);
    expect(sameBar(actionBar("block", "block", "block"), ["block", "block", "tech"])).toBe(false);
  });
});

describe("a loadout", () => {
  it("is exactly two bars, primary and secondary", () => {
    const bar: ActionBar = ["strike", "tech", "block"];
    expect(BAR_IDS).toEqual(["primary", "secondary"]);
    expect(isActionLoadout({ primary: bar, secondary: bar })).toBe(true);
    expect(isActionLoadout({ primary: bar })).toBe(false);
    expect(isActionLoadout({ primary: bar, secondary: bar, tertiary: bar })).toBe(false);
    expect(isActionLoadout({ primary: bar, secondary: ["strike"] })).toBe(false);
    expect(isActionLoadout({ first: bar, second: bar })).toBe(false);
    expect(isActionLoadout([bar, bar])).toBe(false);
    expect(isActionLoadout(null)).toBe(false);
  });

  it("starts a run as Strike Tech Block over Block Block Strike", () => {
    expect(defaultLoadout()).toEqual({ primary: ["strike", "tech", "block"], secondary: ["block", "block", "strike"] });
  });

  it("changes one slot of one bar and nothing else", () => {
    const before = defaultLoadout();
    const after = setLoadoutSlot(before, "secondary", 2, "tech");
    expect(after.secondary).toEqual(["block", "block", "tech"]);
    expect(after.primary).toEqual(before.primary);
    expect(before.secondary).toEqual(["block", "block", "strike"]);
    expect(() => setLoadoutSlot(before, "tertiary" as never, 0, "tech")).toThrow(TypeError);
  });

  it("is frozen all the way down, and copies what it is given", () => {
    const primary = ["strike", "tech", "block"] as unknown as ActionBar;
    const loadout = actionLoadout(primary, ["tech", "tech", "tech"]);
    (primary as unknown as string[])[0] = "block";
    expect(loadout.primary[0]).toBe("strike");
    expect(Object.isFrozen(loadout)).toBe(true);
    expect(Object.isFrozen(loadout.primary)).toBe(true);
    expect(Object.isFrozen(loadout.secondary)).toBe(true);
  });

  it("names the other bar", () => {
    expect(otherBar("primary")).toBe("secondary");
    expect(otherBar("secondary")).toBe("primary");
  });
});
