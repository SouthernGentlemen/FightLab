import { ACTION_TYPES } from "../battle/actions.ts";
import { RARITIES, RARITY } from "../mods/rarity.ts";
import { REGISTRY } from "../mods/registry.ts";
import { SHAPE_IDS, SHAPE_LABEL, shapeCells } from "../mods/shapes.ts";
import type { ShapeId } from "../mods/shapes.ts";
import { MOD_TYPES, TYPE_LABEL } from "../mods/tags.ts";
import { AFFINITY_LABEL } from "../mods/tags.ts";
import { catalogCard, iconPlacements } from "./catalogcard.ts";
import { catalogCardView } from "./catalogcardview.ts";
import { h } from "./dom.ts";
import { modArt } from "./kit.ts";
import type { ModArtDefinition } from "./kit.ts";

const AFFINITIES = [null, ...ACTION_TYPES] as const;
const DEBUG_SHAPES: readonly ShapeId[] = ["single", "domino", "triomino-l", "tetromino-o"];

function definition(type: (typeof MOD_TYPES)[number], affinity: (typeof AFFINITIES)[number], shape: ShapeId): ModArtDefinition {
  return { type, affinity, shape };
}

function sample(view: ModArtDefinition, size: "card" | "board"): HTMLElement {
  return h("div", { class: `palette-sheet__sample palette-sheet__sample--${size}` },
    h("small", {}, size),
    modArt(view, 0, size === "card" ? "mod--mini" : ""));
}

function stateSample(label: string, node: HTMLElement): HTMLElement {
  return h("div", { class: "palette-sheet__state" }, h("small", {}, label), node);
}

function stateSheet(): HTMLElement {
  const card = (state: "hover" | "selected" | "focus") => {
    const node = catalogCardView(catalogCard(REGISTRY["cinder-edge"], 1));
    node.tabIndex = -1;
    if (state === "selected") node.setAttribute("aria-pressed", "true");
    else node.dataset.demoState = state;
    return node;
  };
  const poor = h("div", { class: "offer is-poor" },
    h("div", { class: "offer__art" }, modArt("cinder-edge", 0, "mod--mini")),
    h("div", { class: "offer__foot" }, h("span", { class: "offer__name" }, "Cinder Edge"), h("b", { class: "offer__price" }, "$4")));
  const sold = h("div", { class: "offer", "data-sold": "true" });
  const placement = (state: "valid" | "invalid") => {
    const art = modArt("cinder-edge", 0, "piece");
    art.dataset.placement = state;
    return art;
  };
  const source = modArt("cinder-edge", 0, "piece is-source");

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

function paletteSheet(): HTMLElement {
  const pairs = MOD_TYPES.flatMap((type, typeIndex) =>
    AFFINITIES.map((affinity, affinityIndex) => {
      const shape = DEBUG_SHAPES[(typeIndex + affinityIndex) % DEBUG_SHAPES.length];
      const view = definition(type, affinity, shape);
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

function placementArt(shape: ShapeId, type: (typeof MOD_TYPES)[number], size: "card" | "board", placement: "centre" | "anchor"): HTMLElement {
  const view = definition(type, "strike", shape);
  const art = modArt(view, 0, size === "card" ? "mod--mini" : "");
  const action = art.querySelector<HTMLElement>(".mod__action");
  if (action === null) throw new Error(`${shape}: comparison art has no action icon`);

  const point = iconPlacements(shapeCells(shape, 0))[placement];
  action.remove();
  action.setAttribute(
    "style",
    `inset: auto; left: calc(var(--cell) * ${point.x}); top: calc(var(--cell) * ${point.y}); width: calc(var(--cell) * .66); height: calc(var(--cell) * .66); transform: translate(-50%, -50%)`,
  );
  art.append(action);

  return h("div", {
    class: `palette-sheet__sample palette-sheet__sample--${size}`,
    "data-placement": placement,
    "data-size": size,
    style: "display:grid; place-items:center; min-width:0; min-height:5.6rem",
  }, art);
}

function iconPlacementSheet(): HTMLElement {
  const rows = SHAPE_IDS.map((shape, index) => {
    const type = MOD_TYPES[index % MOD_TYPES.length];
    return h("article", {
      "data-shape": shape,
      style: "display:grid;grid-template-columns:15rem repeat(4,minmax(0,1fr));align-items:center;min-height:6.1rem;padding:.35rem .7rem;border:.2rem solid var(--border-subtle);border-radius:.8rem;background:var(--surface-panel)",
    },
    h("b", { style: "font-size:1.35rem;text-transform:uppercase" }, SHAPE_LABEL[shape]),
    placementArt(shape, type, "card", "centre"),
    placementArt(shape, type, "board", "centre"),
    placementArt(shape, type, "card", "anchor"),
    placementArt(shape, type, "board", "anchor"));
  });

  const heading = (text: string) => h("b", {
    style: "color:var(--text-secondary);font-size:1.2rem;text-align:center;text-transform:uppercase",
  }, text);

  return h("section", {
    class: "palette-sheet",
    "data-sheet": "icon-placement",
    "aria-label": "Icon placement comparison",
  },
  h("header", { class: "palette-sheet__head" },
    h("h2", {}, "Icon placement"),
    h("p", {}, "A = bounding-box centre · B = occupied cell nearest centroid, ties top-left")),
  h("div", {
    style: "display:grid;grid-template-columns:15rem repeat(4,minmax(0,1fr));align-items:center;padding:0 .7rem",
  },
  heading("Shape"), heading("A · card"), heading("A · board"), heading("B · card"), heading("B · board")),
  h("div", { style: "display:grid;gap:.45rem;min-height:0" }, ...rows));
}

/** Debug-only visual proof for the semantic palette and the real piece renderer. */
export function paletteDebugSheet(): HTMLElement {
  if (new URLSearchParams(window.location.search).get("debug") === "icon-placement") {
    return iconPlacementSheet();
  }
  return paletteSheet();
}
