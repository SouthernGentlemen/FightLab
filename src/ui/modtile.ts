import type { ModDefinition } from "../mods/registry.ts";
import type { Stars } from "../mods/stars.ts";
import { h, icon } from "./dom.ts";
import { starRow } from "./kit.ts";
import { modLabel } from "./modlabel.ts";

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

/** One catalogue tile: shape, stars and the mod name. Everything else is in its accessible label. */
export function modTile(definition: ModDefinition, stars: Stars, owned: number): HTMLButtonElement {
  const node = h("button", {
    type: "button",
    class: "tile",
    "data-mod": definition.id,
    "data-rarity": definition.rarity,
    "aria-label": modLabel(definition, stars),
  },
  modSquare(definition, "square tile__square"),
  h("span", { class: "tile__side" }, starRow(stars, "stars tile__stars")),
  h("b", { class: "tile__name" }, definition.name));
  node.classList.toggle("is-unowned", owned === 0);
  return node;
}
