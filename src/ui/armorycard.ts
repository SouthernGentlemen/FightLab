import "./armory-detail.css";

import { effectLines } from "../mods/describe.ts";
import { REGISTRY } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { SHAPES, orientations } from "../mods/shapes.ts";
import { STARS, bestStars, copiesIn, starText } from "../mods/stars.ts";
import type { Stars } from "../mods/stars.ts";
import { catalogShape } from "./catalogcard.ts";
import { catalogShapeView } from "./catalogcardview.ts";
import { button, h, setText } from "./dom.ts";
import { effectBadgeRow } from "./modbadgeview.ts";
import { modLabel } from "./modlabel.ts";
import { effectBadges } from "./modvisual.ts";

export interface ArmoryCard {
  readonly node: HTMLElement;
  show(mod: ModId): void;
}

function compactRules(lines: readonly string[]): string[] {
  const compact = [...lines];
  while (compact.length > 3) compact.splice(0, 2, `${compact[0]} ${compact[1]}`);
  return compact;
}

/** Selected catalogue detail: shape, star preview, generated rules and collection progress only. */
export function armoryCard(owned: (mod: ModId) => number): ArmoryCard {
  let mod: ModId | null = null;
  let stars: Stars = 1;
  let orientation = 0;

  const name = h("h2", { class: "detail-pane__name" });
  const art = h("div", {
    class: "detail-pane__art",
    tabindex: "0",
    "aria-keyshortcuts": "R",
  });
  const starButtons = STARS.map((level) => button(starText(level), "detail-pane__pip", () => {
    stars = level;
    renderArt();
    renderRules();
  }, { "aria-label": `Preview at ${level} star${level === 1 ? "" : "s"}` }));
  const rules = h("div", { class: "detail-pane__rules" });
  const copies = h("p", { class: "detail-pane__copies" });

  const node = h("section", { class: "card detail-pane", "aria-label": "Mod details" },
    h("header", { class: "detail-pane__head" }, name),
    art,
    h("div", { class: "detail-pane__pips", role: "group", "aria-label": "Star level" }, ...starButtons),
    rules,
    copies);

  function turn(): void {
    if (mod === null) return;
    const available = orientations(SHAPES[REGISTRY[mod].shape]);
    orientation = (orientation + 1) % available.length;
    renderArt();
  }

  art.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    turn();
  });
  art.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "r") return;
    event.preventDefault();
    turn();
  });

  function renderArt(): void {
    if (mod === null) return;
    const definition = REGISTRY[mod];
    const available = orientations(SHAPES[definition.shape]);
    const shown = available[orientation] ?? available[0];
    art.dataset.rotation = String(shown.rotation);
    art.setAttribute("aria-label", `${definition.name} shape preview; press R or right click to rotate`);
    art.replaceChildren(
      catalogShapeView(catalogShape(definition, shown.cells, stars)),
      effectBadgeRow(effectBadges(definition, stars), "detail-pane__badges"),
    );
  }

  function renderRules(): void {
    if (mod === null) return;
    const definition = REGISTRY[mod];
    node.setAttribute("aria-label", modLabel(definition, stars));
    starButtons.forEach((node, index) =>
      node.setAttribute("aria-pressed", String(STARS[index] === stars)));
    rules.replaceChildren(...compactRules(effectLines(definition, stars)).map((line) => h("p", {}, line)));
  }

  function render(): void {
    if (mod === null) return;
    const definition = REGISTRY[mod];
    name.dataset.rarity = definition.rarity;
    setText(name, definition.name);
    renderArt();
    renderRules();

    const count = owned(mod);
    const toTwo = copiesIn(2);
    const toThree = copiesIn(3);
    const two = count >= toTwo ? "★★ ready" : `★★ ${toTwo - count} more`;
    const three = count >= toThree ? "★★★ ready" : `★★★ ${toThree - count} more`;
    setText(copies, `Owned ${count} · ${two} · ${three}`);
  }

  return {
    node,
    show(next) {
      if (next !== mod) {
        mod = next;
        stars = bestStars(owned(next));
        orientation = 0;
      }
      render();
    },
  };
}
