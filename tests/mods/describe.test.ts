import { describe, expect, it } from "vitest";

import { effectLines, firingLine } from "../../src/mods/describe.ts";
import { DEFINITIONS, REGISTRY } from "../../src/mods/registry.ts";
import { STARS } from "../../src/mods/stars.ts";

describe("rules text", () => {
  it("is written from the effects, at the star level asked for", () => {
    expect(effectLines(REGISTRY["cinder-edge"], 2)).toEqual([
      "Fires when you Strike; its debuffs land if the hit does.",
      "Spends 1 Heat: +3 damage, 3 Burn on the opponent.",
    ]);
    expect(effectLines(REGISTRY["capacitor-guard"], 3)[1]).toBe("Spends 2 Charge: heals 8 on a parry, +5 riposte damage.");
    expect(effectLines(REGISTRY["chain-circuit"], 1)[1]).toBe("Makes 1 Charge, +1 for every link it is part of.");
    expect(effectLines(REGISTRY["void-tap"], 1)).toEqual([
      "Fires in every exchange.",
      "Drains 1 of the opponent's Heat or Charge, whichever they hold more of, into Void.",
    ]);
    expect(effectLines(REGISTRY["coupon"], 1)).toEqual(["Always on.", "1 free reroll every day."]);
  });

  it("changes with the stars for every mod, so the Armory's three columns always differ", () => {
    for (const definition of DEFINITIONS) {
      const texts = STARS.map((stars) => effectLines(definition, stars).join(" "));
      expect(new Set(texts).size, definition.id).toBe(3);
    }
  });

  it("says when each mod fires", () => {
    expect(firingLine(REGISTRY["basic-sink"])).toBe("Fires when you Block; its payoffs land if your guard holds.");
    expect(firingLine(REGISTRY["battery-cell"])).toBe("Always on.");
  });
});
