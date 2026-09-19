import { RARITY, rarityLine } from "../mods/rarity.ts";
import type { ModDefinition } from "../mods/registry.ts";
import type { Stars } from "../mods/stars.ts";
import { AFFINITY_LABEL, TYPE_LABEL } from "../mods/tags.ts";
import { h, icon } from "./dom.ts";
import { starRow } from "./kit.ts";

/**
 * A catalogue square: solid in the mod type, with one action disc only when it has an affinity.
 */
export function modSquare(definition: ModDefinition, className = "square"): HTMLElement {
  const action = definition.affinity === null ? [] : [
    h("span", { class: "square__action", "data-action": definition.affinity }, icon(definition.affinity)),
  ];
  return h("span", {
    class: className,
    "aria-hidden": "true",
    "data-type": definition.type,
    "data-affinity": definition.affinity ?? undefined,
  }, ...action);
}

/**
 * One catalogue tile: the square, the stars it is shown at in its rarity's material, its name, its
 * type written out, its rarity, and how many copies the player owns.
 */
export function modTile(definition: ModDefinition, stars: Stars, owned: number): HTMLButtonElement {
  const material = RARITY[definition.rarity].material;
  const typeLine = `${TYPE_LABEL[definition.type].toUpperCase()}${definition.affinity === null ? "" : ` / ${AFFINITY_LABEL[definition.affinity].toUpperCase()}`}`;
  const node = h("button", {
    type: "button",
    class: "tile",
    "data-mod": definition.id,
    "data-material": material,
    "aria-label": `${definition.name}, ${typeLine}, ${RARITY[definition.rarity].label}, ${owned} owned`,
  },
  modSquare(definition, "square tile__square"),
  h("span", { class: "tile__side" }, starRow(stars, material, "stars tile__stars"), h("small", { class: "tile__owned" }, owned > 0 ? `×${owned}` : "—")),
  h("b", { class: "tile__name" }, definition.name),
  h("span", { class: "tile__type" }, typeLine),
  h("span", { class: "tile__rarity" }, rarityLine(definition.rarity)));
  node.classList.toggle("is-unowned", owned === 0);
  return node;
}
