import { describe, expect, it } from "vitest";

import { MAX_SEED, isSeed, keyHash, stream } from "../../src/run/random.ts";

const draws = (seed: number, key: readonly (string | number)[], count = 8) => {
  const random = stream(seed, ...key);
  return Array.from({ length: count }, () => random.next());
};

describe("seeded random streams", () => {
  it("replay exactly from the same seed and key", () => {
    expect(draws(1234, ["shop", 3, 0])).toEqual(draws(1234, ["shop", 3, 0]));
    expect(draws(0, ["opponent", 1])).toEqual(draws(0, ["opponent", 1]));
    expect(draws(MAX_SEED, ["opponent", 1])).toEqual(draws(MAX_SEED, ["opponent", 1]));
  });

  it("give every purpose, index and seed its own sequence", () => {
    const keys: Array<readonly (string | number)[]> = [["shop", 1, 0], ["shop", 1, 1], ["shop", 2, 0], ["opponent", 1], ["opponent", 2], ["figure", 1]];
    const firsts = new Set(keys.map((key) => draws(99, key, 1)[0]));
    expect(firsts.size).toBe(keys.length);
    expect(draws(99, ["shop", 1, 0])).not.toEqual(draws(100, ["shop", 1, 0]));
    // "shop|1|10" and "shop|11|0" must not collide by concatenation.
    expect(keyHash(5, ["shop", 1, 10])).not.toBe(keyHash(5, ["shop", 11, 0]));
  });

  it("are independent: drawing from one never shifts another", () => {
    const alone = draws(7, ["opponent", 4]);
    const shop = stream(7, "shop", 4, 0);
    for (let index = 0; index < 1000; index++) shop.next();
    expect(draws(7, ["opponent", 4])).toEqual(alone);
  });

  it("draw integers inside their bounds and floats in [0, 1)", () => {
    const random = stream(42, "bounds");
    for (let index = 0; index < 5000; index++) {
      const value = random.next();
      expect(value >= 0 && value < 1).toBe(true);
      const integer = random.int(6);
      expect(Number.isInteger(integer) && integer >= 0 && integer < 6).toBe(true);
    }
    expect(() => random.int(0)).toThrow(RangeError);
    expect(() => random.pick([])).toThrow(RangeError);
  });

  it("weight a choice as asked and never pick a zero-weight item", () => {
    const random = stream(3, "weights");
    const counts = { a: 0, b: 0, c: 0 };
    for (let index = 0; index < 20_000; index++) counts[random.weighted(["a", "b", "c"] as const, [70, 30, 0])]++;
    expect(counts.c).toBe(0);
    expect(counts.a / 20_000).toBeCloseTo(0.7, 1);
    expect(() => random.weighted(["a"], [0])).toThrow(RangeError);
  });

  it("accepts only 32-bit unsigned integer seeds", () => {
    expect(isSeed(0)).toBe(true);
    expect(isSeed(MAX_SEED)).toBe(true);
    expect(isSeed(-1)).toBe(false);
    expect(isSeed(MAX_SEED + 1)).toBe(false);
    expect(isSeed(1.5)).toBe(false);
    expect(isSeed("1")).toBe(false);
    expect(() => stream(-1, "x")).toThrow(RangeError);
  });
});
