// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { REGISTRY } from "../../src/mods/registry.ts";
import { shapeCells } from "../../src/mods/shapes.ts";
import { modArt } from "../../src/ui/kit.ts";

describe("shared board, bank, offer and run-end mod art", () => {
  it("uses the same diagonal and varied-outline data without action glyphs", () => {
    for (const id of ["ember-edge", "searpoint", "spark-wire", "blight-fang", "cinder-wall"] as const) {
      const definition = REGISTRY[id];
      const art = modArt(id, 0, "piece");
      expect(art.dataset.type).toBe(definition.type);
      expect(art.dataset.affinity).toBe(definition.affinity ?? undefined);
      expect(art.dataset.rarity).toBe(definition.rarity);
      expect(art.querySelectorAll(".mod__cell")).toHaveLength(shapeCells(definition.shape, 0).length);
      expect(art.querySelectorAll(".mod__mark")).toHaveLength(1);
      expect(art.querySelectorAll(".mod__action, .mod__cell .icon")).toHaveLength(0);
    }
    expect(modArt("ember-edge", 0).dataset.rarity).not.toBe(modArt("searpoint", 0).dataset.rarity);
    expect(modArt("ember-edge", 0).querySelector(".mod__mark")?.textContent).toBe("+2");
    expect(modArt("searpoint", 0).querySelector(".mod__mark")?.textContent).toBe("B1");
  });
});
