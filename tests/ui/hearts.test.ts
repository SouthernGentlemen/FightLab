import { describe, expect, it } from "vitest";

import { HEART_COUNT, heartFills } from "../../src/ui/hearts.ts";

const sum = (fills: readonly number[]) => fills.reduce((total, fill) => total + fill, 0);

describe("hearts", () => {
  it("are five, full at full health and empty at none", () => {
    expect(HEART_COUNT).toBe(5);
    expect(heartFills(100, 100)).toEqual([1, 1, 1, 1, 1]);
    expect(heartFills(0, 100)).toEqual([0, 0, 0, 0, 0]);
  });

  it("empty from the last heart and fill in proportion, so health stays granular underneath", () => {
    // A 12-damage jab against 100 health empties 60% of one heart.
    expect(heartFills(88, 100)).toEqual([1, 1, 1, 1, 0.4]);
    expect(heartFills(50, 100)).toEqual([1, 1, 0.5, 0, 0]);
    for (let health = 0; health <= 110; health++) expect(sum(heartFills(health, 110))).toBeCloseTo((5 * health) / 110, 10);
  });

  it("show a +1 or +2 damage mod as a visibly different fill", () => {
    const jab = heartFills(100 - 12, 100);
    const plusOne = heartFills(100 - 13, 100);
    const plusTwo = heartFills(100 - 14, 100);
    expect(jab[4] - plusOne[4]).toBeCloseTo(0.05, 10);
    expect(jab[4] - plusTwo[4]).toBeCloseTo(0.1, 10);
  });

  it("divide whatever maximum health a build gives into five", () => {
    expect(heartFills(130, 130)).toEqual([1, 1, 1, 1, 1]);
    expect(heartFills(26, 130)).toEqual([1, 0, 0, 0, 0]);
    expect(heartFills(13, 130)).toEqual([0.5, 0, 0, 0, 0]);
  });
});
