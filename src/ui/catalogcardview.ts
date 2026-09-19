import type { CatalogCardModel } from "./catalogcard.ts";
import { h, icon } from "./dom.ts";

function sameCell(first: { x: number; y: number }, second: { x: number; y: number }): boolean {
  return first.x === second.x && first.y === second.y;
}

/** DOM renderer for the pure catalogue-card model. */
export function catalogCardView(model: CatalogCardModel): HTMLButtonElement {
  const shape = h("span", {
    class: "catalog-card__shape",
    "data-type": model.type,
    "data-affinity": model.affinity ?? undefined,
    style: `width: calc(var(--catalog-cell) * ${model.width}); height: calc(var(--catalog-cell) * ${model.height})`,
    "aria-hidden": "true",
  });

  for (const cell of model.cells) {
    const node = h("span", {
      class: "catalog-card__cell",
      style: `left: calc(var(--catalog-cell) * ${cell.x}); top: calc(var(--catalog-cell) * ${cell.y})`,
    });
    if (model.affinity !== null && sameCell(cell, model.iconCell)) {
      node.append(h("span", { class: "catalog-card__action", "data-action": model.affinity }, icon(model.affinity)));
    }
    shape.append(node);
  }

  const pips = h("span", { class: "catalog-card__pips", "aria-hidden": "true" },
    ...model.pips.map(({ stars, filled }) =>
      h("span", { class: "catalog-card__pip", "data-filled": String(filled) }, "★".repeat(stars))),
  );

  return h("button", {
    type: "button",
    class: "catalog-card",
    "data-mod": model.id,
    "data-rarity": model.rarity,
    "aria-label": model.label,
  },
  h("span", { class: "catalog-card__art" }, shape),
  pips,
  h("b", { class: "catalog-card__name", title: model.name }, model.name));
}
