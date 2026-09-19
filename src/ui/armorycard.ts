import { effectLines, portLine, profileOf, scaleRows } from "../mods/describe.ts";
import { RARITY, rarityLine } from "../mods/rarity.ts";
import { REGISTRY } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { nextRotation } from "../mods/shapes.ts";
import type { Rotation } from "../mods/shapes.ts";
import { RECIPES, STARS, bestStars, copiesIn, starText } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import { button, h, setText } from "./dom.ts";
import { bevel, modArt, starRow, tagChips } from "./kit.ts";
import { modSquare } from "./modtile.ts";

export interface ArmoryCard {
  readonly node: HTMLElement;
  show(mod: ModId): void;
}

const WORD = { heat: "Heat", charge: "Charge", void: "Void", burn: "Burn", shock: "Shock", poison: "Poison" } as const;

function list(words: readonly (keyof typeof WORD)[]): string {
  return words.map((word) => WORD[word]).join(", ");
}

/**
 * The Armory's left-hand card: everything about one mod. Its star level can be previewed at ★, ★★
 * and ★★★ whatever the player owns, and its piece turned, to watch its ports move with it.
 */
export function armoryCard(owned: (mod: ModId) => number): ArmoryCard {
  let mod: ModId | null = null;
  let stars: Stars = 1;
  let rotation: Rotation = 0;

  const name = h("h2", { class: "card__name" });
  const rarity = h("span", { class: "card__rarity" });
  const square = h("div", { class: "card__square" });
  const chips = h("div", { class: "card__chips" });
  const description = h("p", { class: "card__description" });
  const starButtons = STARS.map((level) => button(starText(level), "segment card__star", () => {
    stars = level;
    render();
  }, { "aria-label": `Preview at ${level} star${level === 1 ? "" : "s"}` }));
  const rules = h("div", { class: "card__rules" });
  const table = h("table", { class: "card__table" });
  const profile = h("p", { class: "card__profile" });
  const piece = h("div", { class: "card__piece" });
  const facing = h("b", { class: "card__facing" });
  const ports = h("small", { class: "card__porttext" });
  const rotate = bevel("Rotate", "sky", () => {
    rotation = nextRotation(rotation);
    render();
  }, "btn--sm card__rotate");
  const copies = h("p", { class: "card__copies" });

  const node = h("section", { class: "card", "aria-label": "Mod details" },
    h("header", { class: "card__head" }, name, rarity),
    h("div", { class: "card__hero" }, square, h("div", { class: "card__about" }, chips, description)),
    h("div", { class: "segments card__stars", role: "group", "aria-label": "Star level" }, ...starButtons),
    rules, table, profile,
    h("div", { class: "card__ports" }, piece, h("div", { class: "card__portinfo" }, facing, ports, rotate)),
    copies);

  function numbers(definitionId: ModId): HTMLTableSectionElement[] {
    const material = RARITY[REGISTRY[definitionId].rarity].material;
    const head = h("tr", {}, h("th", {}, ""), ...STARS.map((level) => {
      const cell = h("th", { class: level === stars ? "is-on" : "" }, starRow(level, material));
      return cell;
    }));
    const rows = scaleRows(REGISTRY[definitionId]).map((row) => h("tr", {}, h("td", {}, row.label),
      ...STARS.map((level) => h("td", { class: level === stars ? "is-on" : "" }, String(row.values[level - 1])))));
    return [h("thead", {}, head), h("tbody", {}, ...rows)];
  }

  function render(): void {
    if (mod === null) return;
    const definition = REGISTRY[mod];
    const material = RARITY[definition.rarity].material;
    node.dataset.material = material;
    setText(name, definition.name);
    setText(rarity, rarityLine(definition.rarity));
    square.replaceChildren(modSquare(definition, "square card__big"), starRow(stars, material, "stars card__bigstars"));
    chips.replaceChildren(tagChips(definition.type, definition.affinity));
    setText(description, definition.description);
    starButtons.forEach((node, index) => node.setAttribute("aria-pressed", String(STARS[index] === stars)));
    rules.replaceChildren(...effectLines(definition, stars).map((line) => h("p", {}, line)));
    table.replaceChildren(...numbers(mod));
    const { makes, spends, applies, cleanses } = profileOf(definition);
    const parts = [
      ...(makes.length ? [`makes ${list(makes)}`] : []), ...(spends.length ? [`spends ${list(spends)}`] : []),
      ...(applies.length ? [`applies ${list(applies)}`] : []), ...(cleanses.length ? [`removes ${list(cleanses)}`] : []),
    ];
    const summary = parts.join(" · ");
    setText(profile, summary ? `${summary[0].toUpperCase()}${summary.slice(1)}.` : "No resources and no debuffs: it works on the run.");
    piece.replaceChildren(modArt(mod, rotation, "card__art", stars));
    setText(facing, `Orientation ${rotation * 90}°`);
    setText(ports, portLine(definition) ?? "No ports: nothing links to it, whichever way it faces.");
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
        rotation = 0;
      }
      render();
    },
  };
}
