// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFINITIONS } from "../../src/mods/registry.ts";
import type { RegisteredModDefinition } from "../../src/mods/registry.ts";
import { SHAPES, orientations } from "../../src/mods/shapes.ts";
import { bestStars } from "../../src/mods/stars.ts";
import { seededCollection } from "../../src/run/collection.ts";
import type { CollectionRepository } from "../../src/run/collection.ts";
import { mountArmory } from "../../src/ui/armory.ts";
import { modLabel } from "../../src/ui/modlabel.ts";

const STYLES = readFileSync(resolve(process.cwd(), "src/ui/styles.css"), "utf8");

let root: HTMLDivElement;
let dispose: () => void;
let collection: CollectionRepository;
let backs: number;

function cards(): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(".catalog-card")];
}

function definitionFor(card: HTMLButtonElement): RegisteredModDefinition {
  const definition = DEFINITIONS.find(({ id }) => id === card.dataset.mod);
  if (definition === undefined) throw new Error(`unknown catalogue card ${card.dataset.mod}`);
  return definition;
}

function cssBody(selector: RegExp): string {
  const body = STYLES.match(selector)?.[1];
  if (body === undefined) throw new Error("expected CSS rule was not found");
  return body;
}

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  collection = seededCollection();
  backs = 0;
  dispose = mountArmory(root, { collection, back() { backs++; } });
});

afterEach(() => {
  dispose();
  root.remove();
});

describe("Armory catalogue DOM", () => {
  it("renders all 64 real mods with complete split shapes, effect values and name rarity", () => {
    const rendered = cards();
    expect(rendered).toHaveLength(64);
    expect(rendered.map((card) => card.dataset.mod)).toEqual(DEFINITIONS.map(({ id }) => id));

    for (const card of rendered) {
      const definition = definitionFor(card);
      const cells = [...card.querySelectorAll<HTMLElement>(".catalog-card__cell")];
      expect(cells, definition.id).toHaveLength(SHAPES[definition.shape].cells.length);
      expect(new Set(cells.map((cell) => `${cell.style.left}|${cell.style.top}`)).size, definition.id)
        .toBe(cells.length);
      expect(cells.every((cell) => cell.dataset.type === definition.type), definition.id).toBe(true);

      const shape = card.querySelector<HTMLElement>(".catalog-card__shape");
      expect(shape?.dataset.affinity, definition.id).toBe(definition.affinity ?? undefined);
      expect(shape?.dataset.rarity, definition.id).toBe(definition.rarity);
      expect(card.querySelectorAll(".catalog-card__action, .catalog-card__shape .icon"), definition.id).toHaveLength(0);
      expect(card.querySelectorAll(".catalog-card__mark"), definition.id).toHaveLength(1);
      expect(card.querySelectorAll(".catalog-card__badges .mod-badge").length, definition.id).toBeGreaterThan(0);

      const rarityNodes = [...card.querySelectorAll<HTMLElement>(".catalog-card__name[data-rarity]")];
      expect(rarityNodes, definition.id).toHaveLength(1);
      expect(rarityNodes[0].classList.contains("catalog-card__name"), definition.id).toBe(true);
      expect(rarityNodes[0].dataset.rarity, definition.id).toBe(definition.rarity);
      expect(card.getAttribute("aria-label"), definition.id).toBe(modLabel(definition));
    }
  });

  it("turns the selected detail through every distinct orientation and back", () => {
    const art = root.querySelector<HTMLElement>(".detail-pane__art");
    if (art === null) throw new Error("detail art is missing");

    for (const card of cards()) {
      const definition = definitionFor(card);
      card.click();

      const expected = orientations(SHAPES[definition.shape]).map(({ rotation }) => String(rotation));
      const seen = [art.dataset.rotation];
      for (let index = 1; index < expected.length; index++) {
        art.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        seen.push(art.dataset.rotation);
      }
      expect(seen, definition.id).toEqual(expected);

      art.dispatchEvent(new KeyboardEvent("keydown", { key: "R", bubbles: true, cancelable: true }));
      expect(art.dataset.rotation, definition.id).toBe(expected[0]);

      const rarityNodes = [...root.querySelectorAll<HTMLElement>(".detail-pane__name[data-rarity]")];
      expect(rarityNodes, definition.id).toHaveLength(1);
      expect(rarityNodes[0].classList.contains("detail-pane__name"), definition.id).toBe(true);
      expect(rarityNodes[0].dataset.rarity, definition.id).toBe(definition.rarity);
    }
  });

  it("keeps long names on the ellipsis class and separates hover from selection styling", () => {
    const name = root.querySelector<HTMLElement>(".catalog-card__name");
    if (name === null) throw new Error("catalogue name is missing");
    name.textContent = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";
    expect(name.textContent).toHaveLength(32);
    expect(name.classList.contains("catalog-card__name")).toBe(true);

    const nameRule = cssBody(/(?:^|\n)\.catalog-card__name\s*\{([^}]*)\}/);
    expect(nameRule).toMatch(/overflow:\s*hidden/);
    expect(nameRule).toMatch(/text-overflow:\s*ellipsis/);
    expect(nameRule).toMatch(/white-space:\s*nowrap/);

    const hoverRule = cssBody(/\.catalog-card:hover,[^{]+\{([^}]*)\}/);
    const selectedRule = cssBody(/\.catalog-card\[aria-pressed="true"\]\s*\{([^}]*)\}/);
    expect(hoverRule).toContain("var(--surface-card-hover)");
    expect(selectedRule).toContain("var(--surface-selected)");
    expect(hoverRule).not.toBe(selectedRule);

    const [first, second] = cards();
    expect(first.getAttribute("aria-pressed")).toBe("true");
    second.click();
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(second.getAttribute("aria-pressed")).toBe("true");
  });

  it("exposes complete detail and filter labels and supports the keyboard contract", () => {
    const first = cards()[0];
    const firstDefinition = definitionFor(first);
    const detail = root.querySelector<HTMLElement>(".detail-pane");
    if (detail === null) throw new Error("detail pane is missing");

    expect(detail.getAttribute("aria-label"))
      .toBe(modLabel(firstDefinition, bestStars(collection.ownedCopies(firstDefinition.id))));

    const threeStars = root.querySelector<HTMLButtonElement>('.detail-pane__pip[aria-label="Preview at 3 stars"]');
    if (threeStars === null) throw new Error("three-star detail control is missing");
    threeStars.click();
    expect(detail.getAttribute("aria-label")).toBe(modLabel(firstDefinition, 3));

    const filterButton = root.querySelector<HTMLButtonElement>('[data-control="filter"]');
    if (filterButton === null) throw new Error("filter button is missing");
    filterButton.click();

    const chips = [...root.querySelectorAll<HTMLButtonElement>(".filter-chip")];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.textContent?.trim().length).toBeGreaterThan(0);
      expect(chip.getAttribute("aria-pressed")).toMatch(/^(?:true|false)$/);
    }

    const firstChip = chips[0];
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(firstChip);
    firstChip.click();
    expect(firstChip.getAttribute("aria-pressed")).toBe("true");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(filterButton);
    root.querySelector<HTMLButtonElement>('[data-control="clear"]')?.click();

    const [gridFirst, gridSecond, , , , gridSixth] = cards();
    gridFirst.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(gridSecond);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(gridSixth);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(gridSixth.getAttribute("aria-pressed")).toBe("true");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(backs).toBe(1);
  });

  it("updates the selected art's printed value and badges with the star preview", () => {
    const card = cards().find((node) => node.dataset.mod === "ember-edge");
    if (card === undefined) throw new Error("Cinder Edge is missing");
    card.click();
    const art = root.querySelector<HTMLElement>(".detail-pane__art");
    if (art === null) throw new Error("detail art is missing");
    expect(art.querySelector(".detail-pane__badges")?.textContent).toBe("DMG +2");
    const threeStars = root.querySelector<HTMLButtonElement>('.detail-pane__pip[aria-label="Preview at 3 stars"]');
    if (threeStars === null) throw new Error("three-star detail control is missing");
    threeStars.click();
    expect(art.querySelector(".detail-pane__badges")?.textContent).toBe("DMG +6");
    expect(art.querySelector(".catalog-card__mark")?.textContent).toBe("+6");
  });

  it("combines filter groups and CLEAR restores the full catalogue", () => {
    root.querySelector<HTMLButtonElement>('[data-control="filter"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-group="types"][data-value="solar"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-group="affinities"][data-value="strike"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-group="sizes"][data-value="2"]')?.click();

    const filtered = cards();
    expect(filtered).toHaveLength(2);
    expect(filtered.every((card) => {
      const definition = definitionFor(card);
      return definition.type === "solar"
        && definition.affinity === "strike"
        && SHAPES[definition.shape].cells.length === 2;
    })).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-control="clear"]')?.click();
    expect(cards()).toHaveLength(64);
  });
});
