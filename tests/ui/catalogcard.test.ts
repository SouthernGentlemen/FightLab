import { describe, expect, it } from "vitest";

import { DEFINITIONS } from "../../src/mods/registry.ts";
import { SHAPES, sizeOf } from "../../src/mods/shapes.ts";
import { STARS, copiesIn } from "../../src/mods/stars.ts";
import { CATALOG_CARD_BOX, catalogCard } from "../../src/ui/catalogcard.ts";
import { modLabel } from "../../src/ui/modlabel.ts";

describe("catalogue card view model", () => {
  it("fits every registry mod flat inside the fixed 4 x 2 card box", () => {
    for (const definition of DEFINITIONS) {
      const model = catalogCard(definition, 7);
      const keys = model.cells.map(({ x, y }) => `${x},${y}`);

      expect(model.cells, definition.id).toHaveLength(sizeOf(SHAPES[definition.shape]));
      expect(new Set(keys).size, `${definition.id}: distinct cells`).toBe(model.cells.length);
      expect(model.width, `${definition.id}: width`).toBeGreaterThanOrEqual(model.height);
      expect(model.width, `${definition.id}: width bound`).toBeLessThanOrEqual(CATALOG_CARD_BOX.width);
      expect(model.height, `${definition.id}: height bound`).toBeLessThanOrEqual(CATALOG_CARD_BOX.height);
      expect(model.cells.every(({ x, y }) => x >= 0 && x < model.width && y >= 0 && y < model.height),
        `${definition.id}: cells stay inside its bounds`).toBe(true);
      expect(model.cellSize, `${definition.id}: shared cell size`).toBe(CATALOG_CARD_BOX.cellSize);
    }
  });

  it("keeps the single at one cell instead of scaling it up", () => {
    const definition = DEFINITIONS.find(({ shape }) => shape === "single");
    expect(definition).toBeDefined();

    const model = catalogCard(definition!, 1);
    expect(model.cells).toEqual([{ x: 0, y: 0 }]);
    expect([model.width, model.height, model.cellSize]).toEqual([1, 1, 1]);
  });

  it("projects the icon anchor and card text from the definition", () => {
    for (const definition of DEFINITIONS) {
      const model = catalogCard(definition, 0);
      expect(model.iconCell, `${definition.id}: icon cell`).toEqual(model.cells[0]);
      expect(model.name).toBe(definition.name);
      expect(model.rarity).toBe(definition.rarity);
      expect(model.label).toBe(modLabel(definition));
      expect(model.type).toBe(definition.type);
      expect(model.affinity).toBe(definition.affinity);
    }
  });

  it("fills collection pips only in star order at their copy thresholds", () => {
    const definition = DEFINITIONS[0];
    const max = copiesIn(3) + 1;

    for (let owned = 0; owned <= max; owned++) {
      const pips = catalogCard(definition, owned).pips;
      expect(pips.map(({ stars }) => stars)).toEqual(STARS);
      expect(pips.map(({ stars, filled }) => filled === (owned >= copiesIn(stars))),
        `owned copies: ${owned}`).toEqual([true, true, true]);

      const fills = pips.map(({ filled }) => filled);
      const firstEmpty = fills.indexOf(false);
      if (firstEmpty >= 0) {
        expect(fills.slice(firstEmpty), `owned copies: ${owned}`).toEqual(
          Array.from({ length: fills.length - firstEmpty }, () => false),
        );
      }
    }
  });
});
