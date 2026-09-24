import { ACTION_TYPES } from "../battle/actions.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import { DEFINITIONS, REGISTRY } from "../mods/registry.ts";
import type { ModId } from "../mods/registry.ts";
import { MOD_TYPES, TYPE_LABEL } from "../mods/types.ts";
import { AFFINITY_LABEL } from "../mods/types.ts";
import { catalogCard } from "./catalogcard.ts";
import { catalogCardView } from "./catalogcardview.ts";
import { h } from "./dom.ts";
import { modArt } from "./kit.ts";

const AFFINITIES = [null, ...ACTION_TYPES] as const;
function definition(type: (typeof MOD_TYPES)[number], affinity: (typeof AFFINITIES)[number]): ModId {
  const found = DEFINITIONS.find((mod) => mod.type === type && mod.affinity === affinity);
  if (found === undefined) throw new Error(`Missing ${type}/${affinity ?? "none"} sample`);
  return found.id;
}

function sample(view: ModId, size: "card" | "board"): HTMLElement {
  return h("div", { class: `palette-sheet__sample palette-sheet__sample--${size}` },
    h("small", {}, size),
    modArt(view, 0, size === "card" ? "mod--mini" : ""));
}

function stateSample(label: string, node: HTMLElement): HTMLElement {
  return h("div", { class: "palette-sheet__state" }, h("small", {}, label), node);
}

function stateSheet(): HTMLElement {
  const card = (state: "hover" | "selected" | "focus") => {
    const node = catalogCardView(catalogCard(REGISTRY["ember-edge"], 1));
    node.tabIndex = -1;
    if (state === "selected") node.setAttribute("aria-pressed", "true");
    else node.dataset.demoState = state;
    return node;
  };
  const poor = h("div", { class: "offer is-poor" },
    h("div", { class: "offer__art" }, modArt("ember-edge", 0, "mod--mini")),
    h("div", { class: "offer__foot" }, h("span", { class: "offer__name" }, "Cinder Edge"), h("b", { class: "offer__price" }, "$4")));
  const sold = h("div", { class: "offer", "data-sold": "true" });
  const placement = (state: "valid" | "invalid") => {
    const art = modArt("ember-edge", 0, "piece");
    art.dataset.placement = state;
    return art;
  };
  const source = modArt("ember-edge", 0, "piece is-source");

  return h("aside", { class: "palette-sheet__states", "aria-label": "State swatches" },
    h("h3", {}, "States"),
    h("div", { class: "palette-sheet__state-grid" },
      stateSample("Hover", card("hover")),
      stateSample("Selected", card("selected")),
      stateSample("Focus", card("focus")),
      stateSample("Unaffordable", poor),
      stateSample("Sold", sold),
      stateSample("Valid carry", placement("valid")),
      stateSample("Invalid carry", placement("invalid")),
      stateSample("Source", source)));
}

/** Debug-only visual proof for the semantic palette and the real piece renderer. */
export function paletteDebugSheet(): HTMLElement {
  const pairs = MOD_TYPES.flatMap((type) =>
    AFFINITIES.map((affinity) => {
      const view = definition(type, affinity);
      const action = affinity === null ? "None" : AFFINITY_LABEL[affinity];
      return h("article", {
        class: "palette-sheet__pair",
        "data-type": type,
        "data-affinity": affinity ?? "none",
      },
      h("b", { class: "palette-sheet__label" }, TYPE_LABEL[type], h("small", {}, action)),
      sample(view, "card"),
      sample(view, "board"));
    }),
  );

  const rarities = RARITIES.map((rarity) =>
    h("span", { class: "palette-sheet__rarity", "data-rarity": rarity }, RARITY[rarity].label));

  return h("section", { class: "palette-sheet", "aria-label": "Debug palette swatch sheet" },
    h("header", { class: "palette-sheet__head" },
      h("h2", {}, "Palette sheet"),
      h("p", {}, "16 type × affinity pieces · production modArt · card / board")),
    h("div", { class: "palette-sheet__body" },
      h("div", { class: "palette-sheet__grid" }, ...pairs),
      stateSheet()),
    h("footer", { class: "palette-sheet__rarities" }, ...rarities));
}
