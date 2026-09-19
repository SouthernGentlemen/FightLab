import { describe, expect, it } from "vitest";

import { REGISTRY } from "../../src/mods/registry.ts";
import { modLabel } from "../../src/ui/modlabel.ts";

describe("modLabel", () => {
  it("names type, affinity, current shape word, rarity and stars", () => {
    expect(modLabel(REGISTRY["cinder-edge"], 2))
      .toBe("Cinder Edge, Solar, Strike affinity, domino, Uncommon, 2 stars");
  });

  it("says when a mod has no affinity and handles a single star", () => {
    expect(modLabel(REGISTRY["piggy-bank"], 1))
      .toBe("Piggy Bank, Neutral, no affinity, single, Common, 1 star");
  });

  it("can omit star level when the surface does not have one", () => {
    expect(modLabel(REGISTRY["heat-coil"]))
      .toBe("Heat Coil, Solar, no affinity, single, Common");
  });
});
