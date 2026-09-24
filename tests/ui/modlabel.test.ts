import { describe, expect, it } from "vitest";

import type { ModDefinition } from "../../src/mods/registry.ts";
import { modLabel } from "../../src/ui/modlabel.ts";

function fixture(
  name: string,
  type: ModDefinition["type"],
  affinity: ModDefinition["affinity"],
  shape: ModDefinition["shape"],
  rarity: ModDefinition["rarity"],
): ModDefinition {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    rarity,
    type,
    affinity,
    shape,
    effect: {
      kind: "exchange",
      payoffs: [{ kind: "damage", amount: { value: [1, 2, 3], per: "flat" } }],
    },
  };
}

describe("modLabel", () => {
  it("names type, affinity, current shape word, rarity and stars", () => {
    const mod = fixture("Fixture One", "solar", "strike", "domino", "uncommon");
    expect(modLabel(mod, 2)).toBe("Fixture One, Solar, Strike affinity, domino, Uncommon, 2 stars, effects: +2 damage on Strike");
  });

  it("says when a mod has no affinity and handles a single star", () => {
    const mod = fixture("Fixture Two", "neutral", null, "single", "common");
    expect(modLabel(mod, 1)).toBe("Fixture Two, Neutral, no affinity, single, Common, 1 star, effects: +1 damage each exchange");
  });

  it("can omit star level when the surface does not have one", () => {
    const plain = fixture("Fixture Three", "solar", null, "single", "common");
    const shaped = fixture("Fixture Four", "arc", "strike", "tetromino-j", "legendary");
    expect(modLabel(plain)).toBe("Fixture Three, Solar, no affinity, single, Common, effects: +1 damage each exchange");
    expect(modLabel(shaped)).toContain("J tetromino");
  });
});
