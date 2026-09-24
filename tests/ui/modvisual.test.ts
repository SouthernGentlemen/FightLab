import { describe, expect, it } from "vitest";

import { DEFINITIONS, REGISTRY } from "../../src/mods/registry.ts";
import { effectBadges, outlineSignature, pieceMarkText } from "../../src/ui/modvisual.ts";

describe("mod visual readouts", () => {
  it("keeps same-footprint mods distinct with honest one-star numbers", () => {
    expect(effectBadges(REGISTRY["ember-edge"], 1).map(({ text }) => text)).toEqual(["DMG +2"]);
    expect(effectBadges(REGISTRY.searpoint, 1).map(({ text }) => text)).toEqual(["DMG +2", "BURN +1/ADJ"]);
    expect(effectBadges(REGISTRY["spark-wire"], 1).map(({ text }) => text)).toEqual(["DMG +2", "SHOCK +1"]);
    expect(effectBadges(REGISTRY["blight-fang"], 1).map(({ text }) => text)).toEqual(["DMG +1", "POISON +1/ADJ"]);
    expect(effectBadges(REGISTRY["cinder-wall"], 1).map(({ text }) => text)).toEqual(["BLOCK RIP +2", "BURN +2"]);
    expect(pieceMarkText(effectBadges(REGISTRY.searpoint, 1))).toBe("B1");
    expect(pieceMarkText(effectBadges(REGISTRY["ember-edge"], 1))).toBe("+2");
    expect(pieceMarkText(effectBadges(REGISTRY["nest-egg"], 1))).toBe("$2");
  });

  it("updates values with stars and preserves conditional scales", () => {
    expect(effectBadges(REGISTRY["ember-edge"], 3)[0].text).toBe("DMG +6");
    expect(effectBadges(REGISTRY.searpoint, 3)[1].text).toBe("BURN +3/ADJ");
    expect(effectBadges(REGISTRY["daybreak-array"], 1)[0].text).toContain("/BURN");
    expect(effectBadges(REGISTRY["boost-spine"], 1)[0].text).toBe("BOOST +1/ADJ");
  });

  it("gives every catalogue definition a unique outline/color/shape key and at least one value", () => {
    const signatures = DEFINITIONS.map(outlineSignature);
    expect(new Set(signatures).size).toBe(DEFINITIONS.length);
    for (const definition of DEFINITIONS) {
      const badges = effectBadges(definition, 1);
      expect(badges.length, definition.id).toBeGreaterThan(0);
      expect(badges.every(({ text }) => text.length > 0), definition.id).toBe(true);
    }
  });
});
