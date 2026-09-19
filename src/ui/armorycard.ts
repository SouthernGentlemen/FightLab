import { effectLines } from "../mods/describe.ts";
import { REGISTRY } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { RECIPES, STARS, bestStars, copiesIn, starText } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import { button, h, setText } from "./dom.ts";
import { starRow } from "./kit.ts";
import { modSquare } from "./modtile.ts";

export interface ArmoryCard {
  readonly node: HTMLElement;
  show(mod: ModId): void;
}

/**
 * The Armory's left-hand card: everything about one mod. Its star level can be previewed at ★, ★★
 * and ★★★ whatever the player owns.
 */
export function armoryCard(owned: (mod: ModId) => number): ArmoryCard {
  let mod: ModId | null = null;
  let stars: Stars = 1;

  const name = h("h2", { class: "card__name" });
  const square = h("div", { class: "card__square" });
  const description = h("p", { class: "card__description" });
  const starButtons = STARS.map((level) => button(starText(level), "segment card__star", () => {
    stars = level;
    render();
  }, { "aria-label": `Preview at ${level} star${level === 1 ? "" : "s"}` }));
  const rules = h("div", { class: "card__rules" });
  const copies = h("p", { class: "card__copies" });

  const node = h("section", { class: "card", "aria-label": "Mod details" },
    h("header", { class: "card__head" }, name),
    h("div", { class: "card__hero" }, square, h("div", { class: "card__about" }, description)),
    h("div", { class: "segments card__stars", role: "group", "aria-label": "Star level" }, ...starButtons),
    rules, copies);

  function render(): void {
    if (mod === null) return;
    const definition = REGISTRY[mod];
    node.dataset.rarity = definition.rarity;
    setText(name, definition.name);
    square.replaceChildren(modSquare(definition, "square card__big"), starRow(stars, "stars card__bigstars"));
    setText(description, definition.description);
    starButtons.forEach((node, index) => node.setAttribute("aria-pressed", String(STARS[index] === stars)));
    rules.replaceChildren(...effectLines(definition, stars).map((line) => h("p", {}, line)));
    const count = owned(mod);
    const [toTwo, toThree] = [copiesIn(RECIPES[0].to), copiesIn(RECIPES[1].to)];
    const next = count >= toThree ? "enough for ★★★" : count >= toTwo ? `enough for ★★; ${toThree - count} more for ★★★` : `${toTwo - count} more for ★★`;
    setText(copies, `Owned: ${count} · ${RECIPES[0].count} ★ make ★★, ${RECIPES[1].count} ★★ make ★★★ · ${next}`);
  }

  return {
    node,
    show(next) {
      if (next !== mod) {
        mod = next;
        stars = bestStars(owned(next));
      }
      render();
    },
  };
}
