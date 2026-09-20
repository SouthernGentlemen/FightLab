// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFINITIONS } from "../../src/mods/registry.ts";
import type { ModDefinition } from "../../src/mods/registry.ts";
import { SHAPES, orientations } from "../../src/mods/shapes.ts";
import { seededCollection } from "../../src/run/collection.ts";
import { mountArmory } from "../../src/ui/armory.ts";

const STYLES = readFileSync(resolve(process.cwd(), "src/ui/styles.css"), "utf8");

let root: HTMLDivElement;
let dispose: () => void;

function cards(): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(".catalog-card")];
}

function definitionFor(card: HTMLButtonElement): ModDefinition {
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
  dispose = mountArmory(root, { collection: seededCollection(), back() {} });
});

afterEach(() => {
  dispose();
  root.remove();
});

describe("Armory catalogue DOM", () => {
  it("renders all 64 real mods with their complete shape, type, action and name rarity", () => {
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

      const actions = [...card.querySelectorAll<HTMLElement>(".catalog-card__action")];
      expect(actions, definition.id).toHaveLength(definition.affinity === null ? 0 : 1);
      if (definition.affinity !== null) expect(actions[0].dataset.action).toBe(definition.affinity);

      const rarityNodes = [...card.querySelectorAll<HTMLElement>("[data-rarity]")];
      expect(rarityNodes, definition.id).toHaveLength(1);
      expect(rarityNodes[0].classList.contains("catalog-card__name"), definition.id).toBe(true);
      expect(rarityNodes[0].dataset.rarity, definition.id).toBe(definition.rarity);
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

      const rarityNodes = [...root.querySelectorAll<HTMLElement>(".detail-pane [data-rarity]")];
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

    const nameRule = cssBody(/\.catalog-card__name\s*\{([^}]*)\}/);
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
